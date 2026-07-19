#!/usr/bin/env python3
"""Rebuild tickets/ticket-dashboard.html and tickets/queue.json from the tickets tree.

Source of truth: the ticket markdown files. This script never edits them. It
emits two build artifacts plus append-only trend history inside tickets/:

  tickets/ticket-dashboard.html   human dashboard (self-contained HTML)
  tickets/queue.json              machine/LLM-readable queue index
  tickets/history.jsonl           append-only state snapshots for trends

Usage:
  python build_dashboard.py                  # regenerate both artefacts
  python build_dashboard.py --check          # lint tickets, write nothing
  python build_dashboard.py --check-artifacts # verify tracked output is fresh
  python build_dashboard.py --quiet          # for git hooks

Conventions parsed (see README.md > "Ticket dashboard"):
  # Ticket NNN: Title
  **Sprint:**   free text; the leading number groups the ticket ("1 — Foundation")
  **Status:**   one of the TICKET_TEMPLATE.md statuses; drives the machine state
  **Owner:** / **Estimate:**  optional metadata badges
  - [ ] / - [x] checkboxes are counted as acceptance progress

The generator skips tickets/completed/ (the archive that process_tickets.py
fills) and any tickets/bin-style tooling dirs. A done-sounding ticket still
living in the live tree renders as "Needs closing" — the signal to verify it
and run process_tickets.py.

Stdlib only. No third-party dependencies.
"""

import argparse
import json
import os
import re
import subprocess
import sys
from datetime import datetime

# --------------------------------------------------------------------------
# Configuration
# --------------------------------------------------------------------------

# Directories under tickets/ skipped entirely (matched anywhere in the path).
EXCLUDE_DIRS = {
    "completed",   # archived tickets (process_tickets.py moves them here)
    "bin",
}

# Canonical machine states, in display/sort rank order. These mirror the
# statuses in tickets/TICKET_TEMPLATE.md, plus two derived states:
# "Needs closing" (a Done ticket still in the live tree) and "Unspecified"
# (the parser could not tell — fix the ticket).
CANONICAL_STATES = [
    "Blocked",
    "In progress",
    "In review",
    "Needs closing",
    "Not started",
    "Planned",
    "Deferred",
    "Unspecified",
]
STATE_RANK = {s: i for i, s in enumerate(CANONICAL_STATES)}

# Status prefixes checked first (startswith, lowercase).
PREFIX_STATES = [
    ("in progress", "In progress"),
    ("in review", "In review"),
    ("blocked", "Blocked"),
    ("not started", "Not started"),
    ("planned", "Planned"),
    ("deferred", "Deferred"),
    ("parked", "Deferred"),
]

# Done-sounding words. A ticket that reads "done" but still lives in the live
# tree means "verify and archive" -> Needs closing.
DONEISH = (
    "done", "resolved", "closed", "complete", "shipped", "delivered",
    "landed", "merged", "implemented", "fixed",
)

SUMMARY_LIMIT = 280

# Metadata fields lifted out of the body (and excluded from the summary).
META_FIELDS = {"sprint", "status", "owner", "estimate"}
DEPENDENCY_FIELDS = {"blocks", "blocked by"}
PARSED_FIELDS = META_FIELDS | DEPENDENCY_FIELDS
DEFAULT_STALE_DAYS = 14

# Execution metadata changes every run; freshness comparisons ignore it while
# comparing every source-derived byte of both artefacts.
DASHBOARD_ASSIGNMENT_RE = re.compile(
    r"(const dashboard = )({.*?})(;\nconst stateClass)", re.DOTALL
)

FIELD_LINE_RE = re.compile(
    r"^\s*(?:[-*]\s+)?\*\*([A-Za-z][A-Za-z /-]*):\*\*\s*(.*)$")
H1_RE = re.compile(r"^#\s+(.*)$")
TICKET_NUM_RE = re.compile(r"(?:ticket\s+)?(\d{2,6})", re.I)
CHECKBOX_RE = re.compile(r"^\s*[-*]\s+\[( |x|X)\]")
BOLD_FIELD_INLINE_RE = re.compile(r"\*\*([A-Za-z][A-Za-z /-]*):\*\*")
DATE_BULLET_RE = re.compile(
    r"^\s*[-*]\s+(\d{4}-\d{2}-\d{2})\s*(?:—|--|:|-)")
NOTES_HEADING_RE = re.compile(r"^#{2,}\s+notes\s*/\s*decisions\s+log\s*$", re.I)
HEADING_RE = re.compile(r"^#{1,6}\s+")
TICKET_REF_RE = re.compile(r"(?:ticket\s*)?#?(\d{2,6})\b", re.I)


def derive_state(status_first_line):
    s = (status_first_line or "").strip().lower()
    if not s:
        return "Unspecified"
    for prefix, state in PREFIX_STATES:
        if s.startswith(prefix):
            return state
    if "needs clos" in s:
        return "Needs closing"
    if any(w in s for w in DONEISH):
        return "Needs closing"
    if "in progress" in s:
        return "In progress"
    return "Unspecified"


def split_inline_fields(rest_of_line):
    """'1 — Foundation **Owner:** ...' -> value up to the next inline field."""
    m = BOLD_FIELD_INLINE_RE.search(rest_of_line)
    return rest_of_line[: m.start()].strip() if m else rest_of_line.strip()


def sprint_group(sprint_field, number):
    """Group label for a ticket: the Sprint field if present, else the
    hundred-block derived from the ticket number (101 -> 'Sprint 1')."""
    sprint_field = (sprint_field or "").strip()
    if sprint_field:
        m = re.match(r"\s*(\d+)", sprint_field)
        if m:
            return f"Sprint {int(m.group(1))}"
        return sprint_field
    if number and number != 999999:
        return f"Sprint {number // 100}"
    return "Unassigned"


def sprint_sort_key(label):
    m = re.search(r"(\d+)", label or "")
    return (int(m.group(1)) if m else 9999, label or "")


def ticket_references(value):
    """Extract unique ticket IDs from a Blocks / Blocked by field."""
    seen, refs = set(), []
    for match in TICKET_REF_RE.finditer(value or ""):
        number = int(match.group(1))
        if number not in seen:
            seen.add(number)
            refs.append(number)
    return refs


def parse_ticket(path, rel_path, today=None, stale_days=DEFAULT_STALE_DAYS):
    text = open(path, encoding="utf-8", errors="replace").read()
    lines = text.splitlines()

    title, number = "", 999999
    fields = {}
    checked = total = 0
    summary_lines = []
    in_summary = False
    summary_done = False
    status_continuation = False
    in_notes_log = False
    latest_note = None

    for raw in lines:
        line = raw.rstrip()

        if not title:
            m = H1_RE.match(line)
            if m:
                title = m.group(1).strip()
                nm = TICKET_NUM_RE.search(title)
                if nm:
                    number = int(nm.group(1))
                continue

        cm = CHECKBOX_RE.match(line)
        if cm:
            total += 1
            if cm.group(1) in "xX":
                checked += 1

        fm = FIELD_LINE_RE.match(line)
        if fm:
            name = fm.group(1).strip().lower()
            if name in PARSED_FIELDS:
                status_continuation = False
                if name == "status":
                    fields.setdefault("status", fm.group(2).strip())
                    status_continuation = True
                else:
                    fields.setdefault(name, split_inline_fields(fm.group(2)))
                continue  # metadata line: never part of the summary
            # Unknown bold field flows into the summary.

        stripped = line.strip()

        if NOTES_HEADING_RE.match(stripped):
            in_notes_log = True
        elif in_notes_log and HEADING_RE.match(stripped):
            in_notes_log = False
        if in_notes_log:
            dm = DATE_BULLET_RE.match(line)
            if dm:
                try:
                    dated = datetime.strptime(dm.group(1), "%Y-%m-%d").date()
                    latest_note = max(latest_note, dated) if latest_note else dated
                except ValueError:
                    pass

        if status_continuation:
            if not stripped or stripped.startswith(("#", "---")) or FIELD_LINE_RE.match(line):
                status_continuation = False
            else:
                fields["status"] += " " + stripped
                continue

        if summary_done:
            continue
        if not stripped:
            if in_summary:
                summary_done = True
            continue
        if stripped.startswith("#") or stripped in ("---", "***", "___"):
            continue
        if stripped.startswith("<!--") or stripped.startswith("-->"):
            continue
        in_summary = True
        summary_lines.append(stripped)

    if number == 999999:
        nm = re.match(r"(\d{2,6})", os.path.basename(path))
        if nm:
            number = int(nm.group(1))

    summary = " ".join(summary_lines).strip()
    if len(summary) > SUMMARY_LIMIT:
        summary = summary[:SUMMARY_LIMIT].rstrip() + "..."

    status = fields.get("status", "").strip()
    state = derive_state(status)
    age_days = None
    stale = False
    if state == "In progress":
        if latest_note:
            age_days = max(0, ((today or datetime.now().date()) - latest_note).days)
            stale = age_days >= stale_days
        else:
            stale = True

    lint = []
    if not status:
        lint.append("missing **Status:** line")
    if state == "Unspecified":
        lint.append("state could not be derived (start **Status:** with a "
                    "canonical word: Not started / In progress / Blocked / "
                    "In review / Planned / Deferred / Done)")

    item = {
        "number": number,
        "title": title or os.path.basename(path),
        "status": status,
        "state": state,
        "owner": fields.get("owner", ""),
        "estimate": fields.get("estimate", ""),
        "sprint": sprint_group(fields.get("sprint", ""), number),
        "path": rel_path,
        "href": rel_path,
        "checked": checked,
        "total": total,
        "summary": summary,
        "blocks": ticket_references(fields.get("blocks", "")),
        "blocked_by": ticket_references(fields.get("blocked by", "")),
        "blocked_by_open": [],
        "last_note_date": latest_note.isoformat() if latest_note else "",
        "note_age_days": age_days,
        "stale": stale,
    }
    return item, lint


def _ticket_paths(tickets_dir, include_completed=False):
    for root, dirs, files in os.walk(tickets_dir):
        dirs[:] = sorted(
            d for d in dirs
            if not d.startswith(".") and (include_completed or d not in EXCLUDE_DIRS)
        )
        for fname in sorted(files):
            if fname.endswith(".md") and re.match(r"\d", fname):
                full = os.path.join(root, fname)
                rel = os.path.relpath(full, tickets_dir).replace(os.sep, "/")
                yield full, rel


def _dependency_lints(items, archived_items):
    """Validate references and calculate the derived open-blocker badge."""
    lints = []
    live_by_number = {item["number"]: item for item in items}
    known_numbers = set(live_by_number) | {item["number"] for item in archived_items}
    blockers = {number: set(item["blocked_by"]) for number, item in live_by_number.items()}

    for item in items:
        for field in ("blocks", "blocked_by"):
            for ref in item[field]:
                if ref not in known_numbers:
                    label = "Blocks" if field == "blocks" else "Blocked by"
                    lints.append((item["path"], [
                        f"{label} references missing ticket #{ref}"
                    ]))
        # `Blocks` is the inverse spelling of another ticket's `Blocked by`.
        for blocked in item["blocks"]:
            if blocked in blockers:
                blockers[blocked].add(item["number"])

    for number, item in live_by_number.items():
        item["blocked_by"] = sorted(blockers[number])
        item["blocked_by_open"] = [
            ref for ref in item["blocked_by"]
            if ref in live_by_number and live_by_number[ref]["state"] != "Needs closing"
        ]

    # Edges point from work to the work it needs first.  Report each cycle once
    # on every participating ticket, so a `--check` reader can fix either end.
    reported = set()
    visiting, visited, stack = set(), set(), []

    def visit(number):
        if number in visiting:
            cycle = stack[stack.index(number):] + [number]
            key = tuple(sorted(cycle[:-1]))
            if key not in reported:
                reported.add(key)
                chain = " -> ".join(f"#{n}" for n in cycle)
                for member in cycle[:-1]:
                    lints.append((live_by_number[member]["path"], [
                        f"dependency cycle: {chain}"
                    ]))
            return
        if number in visited:
            return
        visiting.add(number)
        stack.append(number)
        for ref in sorted(blockers[number]):
            if ref in live_by_number:
                visit(ref)
        stack.pop()
        visiting.remove(number)
        visited.add(number)

    for number in sorted(live_by_number):
        visit(number)
    return lints


def collect(tickets_dir, stale_days=DEFAULT_STALE_DAYS):
    items, lints = [], []
    today = datetime.now().date()
    for full, rel in _ticket_paths(tickets_dir):
        item, lint = parse_ticket(full, rel, today, stale_days)
        items.append(item)
        if lint:
            lints.append((rel, lint))

    archived_items = []
    completed_dir = os.path.join(tickets_dir, "completed")
    if os.path.isdir(completed_dir):
        for full, rel in _ticket_paths(completed_dir, include_completed=True):
            # Keep a tickets/-relative path for diagnostics and make archive
            # items available for valid dependency references and sprint totals.
            archive_rel = os.path.join("completed", rel).replace(os.sep, "/")
            item, _ = parse_ticket(full, archive_rel, today, stale_days)
            archived_items.append(item)

    # A duplicate ticket number makes dashboard references ambiguous; reject it.
    by_number = {}
    for item in items:
        by_number.setdefault(item["number"], []).append(item["path"])
    for number, paths in sorted(by_number.items()):
        if len(paths) > 1:
            listed = ", ".join(sorted(paths))
            for path in paths:
                lints.append((path, [
                    f"duplicate ticket number {number} (also indexed: {listed})"
                ]))
    lints.extend(_dependency_lints(items, archived_items))
    return items, archived_items, lints


def git_head(anywhere):
    try:
        return subprocess.run(
            ["git", "-C", anywhere, "rev-parse", "--short", "HEAD"],
            capture_output=True, text=True, timeout=5,
        ).stdout.strip()
    except Exception:
        return ""


def normalise_dashboard_metadata(dashboard):
    dashboard = dict(dashboard)
    dashboard["generatedAt"] = "__ignored__"
    dashboard["head"] = "__ignored__"
    return dashboard


def normalise_json_artifact(content):
    try:
        dashboard = normalise_dashboard_metadata(json.loads(content))
    except (TypeError, ValueError):
        return content
    return json.dumps(dashboard, ensure_ascii=False, indent=1)


def normalise_html_artifact(content):
    match = DASHBOARD_ASSIGNMENT_RE.search(content)
    if not match:
        return content
    try:
        dashboard = normalise_dashboard_metadata(json.loads(match.group(2)))
    except (TypeError, ValueError):
        return content
    replacement = match.group(1) + json.dumps(dashboard, ensure_ascii=False) + match.group(3)
    return content[:match.start()] + replacement + content[match.end():]


def check_artifacts(expected_html, expected_json, out_html, out_json):
    stale = []
    for path, expected, normalise in (
        (out_html, expected_html, normalise_html_artifact),
        (out_json, expected_json, normalise_json_artifact),
    ):
        try:
            actual = open(path, encoding="utf-8").read()
        except OSError as exc:
            print(f"ERROR: {path} cannot be read ({exc}).")
            stale.append(path)
            continue
        if normalise(actual) != normalise(expected):
            print(f"ERROR: {path} is stale.")
            stale.append(path)
    if stale:
        print("Regenerate with: python build_dashboard.py")
    return stale


def state_counts(items):
    counts = {}
    for item in items:
        counts[item["state"]] = counts.get(item["state"], 0) + 1
    return dict(sorted(counts.items()))


def read_history(path):
    """Read valid JSONL snapshots without making a check command mutate them."""
    records, errors = [], []
    if not os.path.exists(path):
        return records, errors
    with open(path, encoding="utf-8") as fh:
        for line_no, line in enumerate(fh, 1):
            if not line.strip():
                continue
            try:
                record = json.loads(line)
                if not isinstance(record, dict):
                    raise ValueError("not an object")
                if not isinstance(record.get("date"), str) or not isinstance(record.get("sprint"), str):
                    raise ValueError("missing date or sprint")
                counts = record.get("state_counts")
                if not isinstance(counts, dict):
                    raise ValueError("missing state_counts")
                records.append(record)
            except (TypeError, ValueError, json.JSONDecodeError) as exc:
                errors.append(f"history.jsonl:{line_no}: invalid snapshot ({exc})")
    return records, errors


def append_history(path, items, history):
    """Append a per-sprint snapshot only when its live state counts change."""
    current = {}
    for item in items:
        current.setdefault(item["sprint"], []).append(item)
    current_counts = {sprint: state_counts(group) for sprint, group in current.items()}
    previous = {}
    for record in history:
        previous[record["sprint"]] = record["state_counts"]

    # Keep a final zero snapshot when a sprint's last live ticket is archived;
    # that gives the burndown and velocity views a closure event to plot.
    date = datetime.now().date().isoformat()
    additions = []
    for sprint in sorted(set(current_counts) | set(previous), key=sprint_sort_key):
        counts = current_counts.get(sprint, {})
        if previous.get(sprint) != counts:
            additions.append({"date": date, "sprint": sprint, "state_counts": counts})
    if additions:
        with open(path, "a", encoding="utf-8") as fh:
            for record in additions:
                fh.write(json.dumps(record, ensure_ascii=False, sort_keys=True) + "\n")
        history.extend(additions)
    return history


def sprint_summaries(items, archived_items):
    """Build closure and N99 review-gate state from both live and archived work."""
    all_items = [(item, False) for item in items] + [(item, True) for item in archived_items]
    grouped = {}
    for item, archived in all_items:
        grouped.setdefault(item["sprint"], []).append((item, archived))

    summaries = {}
    for sprint, group in grouped.items():
        total = len(group)
        closed = sum(1 for _, archived in group if archived)
        match = re.search(r"(\d+)", sprint)
        gate_number = int(match.group(1)) * 100 + 99 if match else None
        gate_item = next((item for item, _ in group if item["number"] == gate_number), None)
        gate_archived = any(
            archived for item, archived in group if item["number"] == gate_number
        )
        if gate_archived:
            gate_state = "Closed"
        elif gate_item:
            gate_state = gate_item["state"]
        else:
            gate_state = "Missing"
        summaries[sprint] = {
            "total": total,
            "closed": closed,
            "gate_number": gate_number,
            "gate_state": gate_state,
        }
    return summaries


def render_html(dashboard, ticket_count, sprint_count):
    payload = json.dumps(dashboard, ensure_ascii=False)
    return (DASHBOARD_TEMPLATE
            .replace("__DASHBOARD_JSON__", payload)
            .replace("__TICKET_COUNT__", str(ticket_count))
            .replace("__SPRINT_COUNT__", str(sprint_count)))


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    default_tickets = os.path.join(script_dir, "tickets")
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--tickets", default=default_tickets,
                    help="tickets/ directory (default: ./tickets next to this script)")
    ap.add_argument("--out", default=None,
                    help="dashboard HTML path (default: <tickets>/ticket-dashboard.html)")
    ap.add_argument("--json", default=None,
                    help="queue.json path (default: <tickets>/queue.json)")
    ap.add_argument("--history", default=None,
                    help="history JSONL path (default: <tickets>/history.jsonl)")
    ap.add_argument("--check", action="store_true", help="lint only, write nothing")
    ap.add_argument("--check-artifacts", action="store_true",
                    help="verify generated artefacts match ticket sources, write nothing")
    ap.add_argument("--quiet", action="store_true")
    ap.add_argument("--stale-days", type=int, default=DEFAULT_STALE_DAYS,
                    help=f"flag In progress tickets without a dated note for this many days (default: {DEFAULT_STALE_DAYS})")
    args = ap.parse_args()

    if args.stale_days < 0:
        ap.error("--stale-days must be zero or greater")

    tickets_dir = os.path.abspath(args.tickets)
    out_html = args.out or os.path.join(tickets_dir, "ticket-dashboard.html")
    out_json = args.json or os.path.join(tickets_dir, "queue.json")
    history_path = args.history or os.path.join(tickets_dir, "history.jsonl")

    items, archived_items, lints = collect(tickets_dir, args.stale_days)
    history, history_errors = read_history(history_path)
    lints.extend(("history.jsonl", [error]) for error in history_errors)
    items.sort(key=lambda i: (sprint_sort_key(i["sprint"]),
                              STATE_RANK.get(i["state"], 99),
                              i["number"]))

    failed = False
    if args.check:
        if not lints:
            print(f"OK: {len(items)} tickets, no lint findings.")
        else:
            for rel, problems in lints:
                for p in problems:
                    print(f"{rel}: {p}")
            print(f"\n{len(lints)} ticket(s) with findings out of {len(items)}.")
            failed = True

        stale_items = [item for item in items if item["stale"]]
        for item in stale_items:
            age = (f"{item['note_age_days']} days since its last dated note"
                   if item["last_note_date"] else "no dated Notes / decisions log entry")
            print(f"warning: {item['path']}: In progress but {age} (threshold: {args.stale_days} days)")

    sprints = sorted({i["sprint"] for i in items}, key=sprint_sort_key)
    seen, states = set(), []
    for i in sorted(items, key=lambda i: STATE_RANK.get(i["state"], 99)):
        if i["state"] not in seen:
            seen.add(i["state"])
            states.append(i["state"])

    # Checks are intentionally read-only.  A normal regeneration appends the
    # snapshot before rendering, so the artifacts and history move together.
    if not args.check and not args.check_artifacts:
        history = append_history(history_path, items, history)

    dashboard = {
        "generatedAt": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "head": git_head(tickets_dir),
        "items": items,
        "sprints": sprints,
        "states": states,
        "history": history,
        "sprint_summaries": sprint_summaries(items, archived_items),
        "stale_days": args.stale_days,
    }

    html = render_html(dashboard, len(items), len(sprints))
    json_content = json.dumps(dashboard, ensure_ascii=False, indent=1)

    if args.check_artifacts:
        stale = check_artifacts(html, json_content, out_html, out_json)
        if not stale:
            print(f"OK: {len(items)} tickets, dashboard artefacts are fresh.")
        return 1 if failed or stale else 0

    if args.check:
        return 1 if failed else 0

    for path, content in ((out_html, html), (out_json, json_content)):
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as fh:
            fh.write(content)
        os.replace(tmp, path)

    if not args.quiet:
        print(f"{len(items)} tickets -> {out_html}")
        print(f"{'':>{len(str(len(items)))}}         -> {out_json}")
        if lints:
            print(f"note: {len(lints)} ticket(s) have lint findings; run --check to list them.")
    return 0


# --------------------------------------------------------------------------
# Embedded HTML shell. Placeholders __DASHBOARD_JSON__, __TICKET_COUNT__ and
# __SPRINT_COUNT__ are filled by render_html(). The `const dashboard = {...};`
# line is a fixed contract the freshness check keys off — do not reformat it.
# --------------------------------------------------------------------------

DASHBOARD_TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ticket Dashboard</title>
<style>
:root {
  --bg: #f6f7f4;
  --panel: #ffffff;
  --ink: #1d2522;
  --muted: #66736c;
  --line: #d8ded6;
  --green: #207653;
  --teal: #16727a;
  --amber: #b66a00;
  --red: #b23b3b;
  --blue: #3a6797;
  --violet: #7a548e;
  --shadow: 0 1px 2px rgba(25, 35, 30, 0.08);
}
* { box-sizing: border-box; }
body {
  margin: 0;
  min-width: 320px;
  background: var(--bg);
  color: var(--ink);
  font: 14px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
a { color: inherit; }
.shell { max-width: 1440px; margin: 0 auto; padding: 22px 22px 40px; }
.topbar {
  display: grid;
  grid-template-columns: minmax(280px, 1fr) auto;
  gap: 18px;
  align-items: end;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--line);
}
h1 { margin: 0; font-size: 28px; line-height: 1.08; font-weight: 720; letter-spacing: 0; }
.meta { margin-top: 7px; color: var(--muted); font-size: 13px; display: flex; flex-wrap: wrap; gap: 10px; }
.controls { display: grid; grid-template-columns: minmax(220px, 340px) auto auto; gap: 10px; align-items: center; }
.search, select, button {
  min-height: 38px;
  border: 1px solid var(--line);
  background: #fff;
  color: var(--ink);
  border-radius: 6px;
  font: inherit;
}
.search { width: 100%; padding: 0 12px; }
select { padding: 0 34px 0 10px; }
.segment { display: inline-grid; grid-auto-flow: column; gap: 4px; padding: 4px; background: #e8ece7; border-radius: 8px; }
.segment button { min-height: 30px; border: 0; padding: 0 10px; background: transparent; cursor: pointer; }
.segment button.active { background: #fff; box-shadow: var(--shadow); }
.stats { display: grid; grid-template-columns: repeat(5, minmax(130px, 1fr)); gap: 10px; margin: 18px 0; }
.stat { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 12px; box-shadow: var(--shadow); }
.stat .label { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
.stat .value { margin-top: 6px; font-size: 25px; font-weight: 740; line-height: 1; }
.stat .bar { height: 6px; margin-top: 10px; border-radius: 999px; background: #e6ebe7; overflow: hidden; }
.stat .bar span { display: block; height: 100%; background: var(--green); }
.progress { display: grid; grid-template-columns: repeat(2, minmax(260px, 1fr)); gap: 10px; margin: 0 0 18px; }
.trend { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 12px; box-shadow: var(--shadow); }
.trend h2 { margin: 0; font-size: 14px; }
.trend p { margin: 3px 0 8px; color: var(--muted); font-size: 12px; }
.sparkline { display: block; width: 100%; height: 52px; }
.gate-banner { margin: 0 0 10px; padding: 8px 10px; border: 1px solid #d8ded6; border-radius: 6px; background: #f8faf7; color: #405049; font-size: 12px; }
.gate-banner strong { color: var(--ink); }
.sprint-nav { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0 22px; }
.sprint-chip { border: 1px solid var(--line); background: #fff; border-radius: 999px; padding: 7px 10px; color: var(--muted); text-decoration: none; font-size: 13px; }
.sprint-chip strong { color: var(--ink); font-weight: 700; }
.sprint { margin-top: 24px; }
.sprint-header { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 10px; }
.sprint-title { display: flex; align-items: center; gap: 10px; min-width: 0; }
.sprint-title h2 { margin: 0; font-size: 19px; line-height: 1.2; letter-spacing: 0; }
.count-pill { flex: 0 0 auto; min-width: 30px; text-align: center; color: #fff; background: var(--ink); border-radius: 999px; padding: 3px 9px; font-weight: 700; }
.sprint-bars { display: flex; flex-wrap: wrap; gap: 6px; color: var(--muted); font-size: 12px; }
.state-dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 5px; }
.ticket-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(310px, 1fr)); gap: 10px; }
.ticket { display: grid; grid-template-rows: auto 1fr auto; min-height: 190px; background: var(--panel); border: 1px solid var(--line); border-left: 5px solid var(--blue); border-radius: 6px; padding: 12px; box-shadow: var(--shadow); }
.ticket[data-state="In progress"] { border-left-color: var(--teal); }
.ticket[data-state="Blocked"] { border-left-color: var(--red); }
.ticket[data-state="In review"] { border-left-color: var(--blue); }
.ticket[data-state="Needs closing"] { border-left-color: var(--amber); }
.ticket[data-state="Planned"] { border-left-color: var(--teal); }
.ticket[data-state="Not started"] { border-left-color: #8b7b42; }
.ticket[data-state="Deferred"] { border-left-color: var(--violet); }
.ticket-head { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; }
.ticket-title { margin: 0; font-size: 15px; line-height: 1.25; font-weight: 720; letter-spacing: 0; }
.ticket-title a { text-decoration: none; }
.ticket-title a:hover { text-decoration: underline; }
.num { flex: 0 0 auto; color: var(--muted); font-weight: 720; font-size: 12px; border: 1px solid var(--line); border-radius: 999px; padding: 2px 7px; }
.num.copy-id { cursor: copy; font: inherit; background: #fff; }
.permalink { color: var(--muted); text-decoration: none; font-weight: 700; padding: 2px 1px; }
.permalink:hover { color: var(--blue); }
.badge.warning { border-color: #d88d32; color: #8a4e00; background: #fff6e8; }
.summary { margin: 9px 0 0; color: #35423c; font-size: 13px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.ticket-meta { display: flex; flex-wrap: wrap; gap: 6px; align-content: end; margin-top: 12px; }
.badge { display: inline-flex; align-items: center; max-width: 100%; min-height: 24px; padding: 3px 7px; border-radius: 999px; border: 1px solid var(--line); background: #f9faf8; color: #405049; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.badge.state { color: #fff; border: 0; background: var(--blue); }
.badge.state.In_progress { background: var(--teal); }
.badge.state.Blocked { background: var(--red); }
.badge.state.In_review { background: var(--blue); }
.badge.state.Needs_closing { background: var(--amber); }
.badge.state.Planned { background: var(--teal); }
.badge.state.Not_started { background: #8b7b42; }
.badge.state.Deferred { background: var(--violet); }
.path { min-width: 0; max-width: 100%; color: var(--muted); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 8px; }
.empty { padding: 34px 0; color: var(--muted); text-align: center; border-top: 1px solid var(--line); }
@media (max-width: 960px) {
  .topbar { grid-template-columns: 1fr; align-items: start; }
  .controls { grid-template-columns: 1fr; }
  .stats { grid-template-columns: repeat(2, minmax(130px, 1fr)); }
  .progress { grid-template-columns: 1fr; }
}
@media (max-width: 560px) {
  .shell { padding: 16px 12px 28px; }
  h1 { font-size: 23px; }
  .stats { grid-template-columns: 1fr; }
  .ticket-grid { grid-template-columns: 1fr; }
  .sprint-header { align-items: flex-start; flex-direction: column; }
}
</style>
</head>
<body>
<div class="shell">
  <header class="topbar">
    <div>
      <h1>Ticket Dashboard</h1>
      <div class="meta"><span id="generated"></span><span>__TICKET_COUNT__ live tickets</span><span>__SPRINT_COUNT__ sprints</span></div>
    </div>
    <div class="controls">
      <input id="search" class="search" type="search" placeholder="Search tickets" autocomplete="off">
      <select id="sprint" aria-label="Sprint"></select>
      <div class="segment" role="group" aria-label="Mode">
        <button type="button" class="active" data-mode="all">All</button>
        <button type="button" data-mode="actionable">Actionable</button>
        <button type="button" data-mode="closing">Closing</button>
      </div>
    </div>
  </header>
  <section id="stats" class="stats"></section>
  <section id="progress" class="progress" aria-label="Progress trends"></section>
  <nav id="sprintNav" class="sprint-nav"></nav>
  <main id="groups"></main>
  <div id="empty" class="empty" style="display:none">No tickets match the current filters.</div>
</div>
<script>
const dashboard = __DASHBOARD_JSON__;
const stateClass = (s) => s.replace(/[^a-z0-9]+/gi, '_');
const stateColors = {
  'In progress': '#16727a', 'Blocked': '#b23b3b', 'In review': '#3a6797',
  'Needs closing': '#b66a00', 'Not started': '#8b7b42', 'Planned': '#16727a',
  'Deferred': '#7a548e', 'Unspecified': '#66736c'
};
let mode = 'all';
const els = {};
function byId(id) { return document.getElementById(id); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
function slug(value) { return String(value).replace(/[^a-z0-9]+/gi, '-'); }
function filteredItems() {
  const q = els.search.value.trim().toLowerCase();
  const sprint = els.sprint.value;
  return dashboard.items.filter(item => {
    if (sprint && item.sprint !== sprint) return false;
    if (mode === 'actionable' && item.state === 'Needs closing') return false;
    if (mode === 'closing' && item.state !== 'Needs closing') return false;
    if (!q) return true;
    const hay = [item.title, item.status, item.sprint, item.path, item.owner, item.estimate, item.summary].join(' ').toLowerCase();
    return hay.includes(q);
  });
}
function groupBySprint(items) {
  const groups = new Map();
  for (const item of items) {
    if (!groups.has(item.sprint)) groups.set(item.sprint, []);
    groups.get(item.sprint).push(item);
  }
  const order = new Map(dashboard.sprints.map((s, i) => [s, i]));
  return [...groups.entries()].sort((a, b) => (order.get(a[0]) ?? 999) - (order.get(b[0]) ?? 999) || a[0].localeCompare(b[0]));
}
function renderStats(items) {
  const actionable = items.filter(i => i.state !== 'Needs closing').length;
  const closing = items.filter(i => i.state === 'Needs closing').length;
  const blocked = items.filter(i => i.state === 'Blocked').length;
  const sprints = new Set(items.map(i => i.sprint)).size;
  const total = dashboard.items.length || 1;
  const values = [
    ['Showing', items.length, 100, '#207653'],
    ['Actionable', actionable, actionable / total * 100, '#16727a'],
    ['Needs closing', closing, closing / total * 100, '#b66a00'],
    ['Blocked', blocked, blocked / total * 100, '#b23b3b'],
    ['Sprints', sprints, dashboard.sprints.length ? sprints / dashboard.sprints.length * 100 : 0, '#3a6797'],
  ];
  els.stats.innerHTML = values.map(([label, value, pct, color]) => `
    <div class="stat"><div class="label">${label}</div><div class="value">${value}</div><div class="bar"><span style="width:${Math.max(3, Math.min(100, pct))}%;background:${color}"></span></div></div>
  `).join('');
}
function historyTotals(records) {
  return records.map(record => ({ date: record.date, total: Object.values(record.state_counts || {}).reduce((sum, count) => sum + Number(count || 0), 0) }));
}
function sparkline(values, color) {
  if (!values.length) return '<p>No state changes recorded yet.</p>';
  const max = Math.max(1, ...values);
  const points = values.map((value, index) => `${index * (100 / Math.max(1, values.length - 1))},${48 - (value / max * 42)}`).join(' ');
  return `<svg class="sparkline" viewBox="0 0 100 52" preserveAspectRatio="none" role="img" aria-label="Trend: ${values.join(', ')}"><polyline fill="none" stroke="${color}" stroke-width="2.5" vector-effect="non-scaling-stroke" points="${points}"/></svg>`;
}
function isoWeek(dateString) {
  const date = new Date(`${dateString}T00:00:00Z`); const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return `${date.getUTCFullYear()}-W${String(Math.ceil((((date - yearStart) / 86400000) + 1) / 7)).padStart(2, '0')}`;
}
function renderProgress() {
  const records = dashboard.history || [];
  const latestSprint = dashboard.sprints[dashboard.sprints.length - 1];
  const sprintRecords = records.filter(record => record.sprint === latestSprint).slice(-14);
  const burndown = historyTotals(sprintRecords);
  const bySprint = new Map();
  for (const record of records) {
    if (!bySprint.has(record.sprint)) bySprint.set(record.sprint, []);
    bySprint.get(record.sprint).push(record);
  }
  const weekly = new Map();
  for (const sprintRecords of bySprint.values()) {
    let prior = null;
    for (const { date, total } of historyTotals(sprintRecords)) {
      if (prior !== null && total < prior) {
        const week = isoWeek(date); weekly.set(week, (weekly.get(week) || 0) + prior - total);
      }
      prior = total;
    }
  }
  const weeks = [...weekly.keys()].sort().slice(-8);
  els.progress.innerHTML = `
    <article class="trend"><h2>${escapeHtml(latestSprint || 'Sprint')} burndown</h2><p>Live tickets at each recorded state change.</p>${sparkline(burndown.map(point => point.total), '#16727a')}</article>
    <article class="trend"><h2>Closed per week</h2><p>Archive events inferred from live-ticket count reductions.</p>${sparkline(weeks.map(week => weekly.get(week)), '#207653')}</article>`;
}
function ticketHtml(item) {
  const check = item.total ? `${item.checked}/${item.total} checks` : 'no checklist';
  const estimate = item.estimate ? `<span class="badge">${escapeHtml(item.estimate)}</span>` : '';
  const owner = item.owner ? `<span class="badge">${escapeHtml(item.owner)}</span>` : '';
  const ticketId = item.number === 999999 ? '?' : item.number;
  const blockers = (item.blocked_by_open || []).length ? `<span class="badge warning">Blocked by open #${item.blocked_by_open.join(', #')}</span>` : '';
  const stale = item.stale ? `<span class="badge warning">Stale: ${item.last_note_date ? `${item.note_age_days}d since note` : 'no dated note'}</span>` : '';
  return `<article class="ticket" id="${ticketId}" data-state="${escapeHtml(item.state)}">
    <div><div class="ticket-head"><h3 class="ticket-title"><a href="${escapeHtml(item.href)}">${escapeHtml(item.title)}</a></h3><div><a class="permalink" href="#${ticketId}" aria-label="Link to ticket ${ticketId}">#</a><button type="button" class="num copy-id" data-ticket-id="${ticketId}" title="Copy ticket ID">${ticketId}</button></div></div><p class="summary">${escapeHtml(item.summary || item.status)}</p></div>
    <div class="ticket-meta"><span class="badge state ${stateClass(item.state)}">${escapeHtml(item.state)}</span>${blockers}${stale}${estimate}${owner}<span class="badge">${escapeHtml(check)}</span></div>
    <div class="path" title="${escapeHtml(item.path)}">${escapeHtml(item.path)}</div>
  </article>`;
}
function renderGroups(items) {
  const groups = groupBySprint(items);
  els.sprintNav.innerHTML = groups.map(([sprint, list]) => `<a class="sprint-chip" href="#${escapeHtml(slug(sprint))}"><strong>${list.length}</strong> ${escapeHtml(sprint)}</a>`).join('');
  els.groups.innerHTML = groups.map(([sprint, list]) => {
    const stateCounts = new Map();
    for (const item of list) stateCounts.set(item.state, (stateCounts.get(item.state) || 0) + 1);
    const stateBits = [...stateCounts.entries()].sort((a, b) => b[1] - a[1]).map(([state, count]) => `<span><i class="state-dot" style="background:${stateColors[state] || '#66736c'}"></i>${count} ${escapeHtml(state)}</span>`).join('');
    const summary = (dashboard.sprint_summaries || {})[sprint] || {};
    const gate = summary.gate_number ? `, gate #${summary.gate_number} ${summary.gate_state}` : '';
    const gateBanner = summary.total ? `<div class="gate-banner"><strong>Exit criteria:</strong> ${summary.closed}/${summary.total} tickets closed${escapeHtml(gate)}</div>` : '';
    return `<section class="sprint" id="${escapeHtml(slug(sprint))}"><div class="sprint-header"><div class="sprint-title"><h2>${escapeHtml(sprint)}</h2><span class="count-pill">${list.length}</span></div><div class="sprint-bars">${stateBits}</div></div>${gateBanner}<div class="ticket-grid">${list.map(ticketHtml).join('')}</div></section>`;
  }).join('');
  els.empty.style.display = groups.length ? 'none' : 'block';
}
function render() { const items = filteredItems(); renderStats(items); renderProgress(); renderGroups(items); }
function init() {
  els.search = byId('search'); els.sprint = byId('sprint'); els.stats = byId('stats'); els.progress = byId('progress'); els.groups = byId('groups'); els.sprintNav = byId('sprintNav'); els.empty = byId('empty');
  els.sprint.innerHTML = '<option value="">All sprints</option>' + dashboard.sprints.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
  byId('generated').textContent = `Generated ${dashboard.generatedAt}${dashboard.head ? ' at ' + dashboard.head : ''}`;
  els.search.addEventListener('input', render);
  els.sprint.addEventListener('change', render);
  document.querySelectorAll('[data-mode]').forEach(btn => btn.addEventListener('click', () => { mode = btn.dataset.mode; document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('active', b === btn)); render(); }));
  document.addEventListener('click', async event => {
    const button = event.target.closest('.copy-id');
    if (!button) return;
    const original = button.textContent;
    try {
      await navigator.clipboard.writeText(button.dataset.ticketId);
      button.textContent = 'Copied';
    } catch (_) { button.textContent = `#${button.dataset.ticketId}`; }
    setTimeout(() => { button.textContent = original; }, 1200);
  });
  render();
}
document.addEventListener('DOMContentLoaded', init);
</script>
</body>
</html>
"""


if __name__ == "__main__":
    sys.exit(main())
