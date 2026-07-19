# busTracker

A bus operator's public website: real-time vehicle tracking, journey planning, timetables, and ticket sales — plus the staff tooling behind them.

**Start here:** [`tickets/overview.md`](./tickets/overview.md) is the roadmap. [`features.md`](./features.md) is the original functional brief. Sprint 0 resolves readiness; the live tracker (Sprints 1–2) is the implementation priority.

**Stack:** Next.js (App Router, TypeScript) · MapLibre GL JS + Stadia Maps · Postgres 16 + PostGIS · GTFS / GTFS-Realtime · Stripe. Recorded as an ADR in ticket 101.

---

## What's in here

```
.
├── README.md               ← you are here
├── private.md              ← local-only notes: paths, secrets layout, run examples
├── process_tickets.py      ← closes completed tickets and updates the roadmap
├── build_dashboard.py      ← regenerates the ticket dashboard + queue.json (read-only over tickets/)
├── check_completed_links.py ← advisory: flags archive links that need rebasing
├── test_build_dashboard.py ← regression tests for the generator
├── post-merge              ← git hook: regenerate the dashboard after every pull
├── pre-commit              ← git hook: reject stale dashboard artifacts
├── ci.example.yml          ← CI recipe for dashboard checks and tests
├── tickets/
│   ├── overview.md         ← the roadmap. start here.
│   ├── TICKET_TEMPLATE.md  ← copy this when filing a new ticket
│   ├── {id}-{slug}.md      ← one file per ticket
│   ├── ticket-dashboard.html ← generated: human dashboard (never hand-edit)
│   ├── queue.json          ← generated: machine/LLM index (never hand-edit)
│   ├── history.jsonl       ← generated: append-only state-change history
│   └── completed/          ← closed tickets land here automatically
├── features.md             ← the operator's functional brief (source requirements)
└── WordPressAudit.md       ← audit of the incumbent site
```

The application itself is not scaffolded yet — that is ticket 101.

`private.md` is gitignored. Treat it as your local scratchpad: machine-specific paths, a working `.env` layout, the command you actually run to invoke the project. Do not put secrets there — put them in `.env`.

---

## The workflow

This project is run as a sequence of **sprints**, each containing **tickets**. The roadmap lives in `tickets/overview.md`.

1. **Read `tickets/overview.md`.** It tells you which sprint is active and which ticket is the recommended next pick.
2. **Pick a ticket.** Open its file (e.g. `tickets/001-product-and-launch-readiness.md`). Tickets follow the structure in `TICKET_TEMPLATE.md`: Context, Goal, Acceptance criteria, Out of scope, Dependencies.
3. **Do the work.** Append notes and decisions to the ticket's "Notes / decisions log" as you go — these feed the sprint review.
4. **Close the ticket.** In `tickets/overview.md`, change the ticket's bullet from `- [ ]` to `- [x]`.
5. **Run `python3 process_tickets.py`.** This moves the ticket file into `tickets/completed/`, updates both overview files, and with `--push` regenerates and stages dashboard artifacts in the archive commit.

### Sprint review gates

Sprints are sequential. The last ticket in each sprint is a **review ticket** (`199`, `299`, `399`, ...) that asks: *is the sprint's exit criteria met, and should we continue to the next sprint?* The honest answer is sometimes "no, stop here" — that's the gate working as intended.

### Filing a new ticket

1. Pick the next free ID in the sprint's range (`1xx` for Sprint 1, `2xx` for Sprint 2, etc.).
2. Copy `tickets/TICKET_TEMPLATE.md` to `tickets/{id}-{short-slug}.md`.
3. Add the bullet to the right sprint section in `tickets/overview.md`.

---

## Setup

The application is not scaffolded yet — see ticket 101. Once it is, this section
covers the app; the commands below cover the ticket tooling, which needs only a
Python 3 interpreter and no dependencies.

## Tests

```bash
pytest test_build_dashboard.py   # regression tests for the ticket generator
```

Application tests arrive with ticket 101. Per the project rules in `CLAUDE.md`,
any new backend behaviour ships with at least one test on the existing harness.

---

## process_tickets.py — quick reference

```bash
python3 process_tickets.py              # preview what would change (dry run)
python3 process_tickets.py --apply      # actually move files and rewrite overview
python3 process_tickets.py --apply --push   # also commit and push to origin
```

Defaults to dry-run for safety. See the script's `--help` for full options.

---

## Ticket dashboard

The ticket markdown files are the source of truth. Three **generated** artifacts
give you a fast read over the whole tree without opening every file — all live
in `tickets/` and are **never hand-edited**:

- `tickets/ticket-dashboard.html` — a self-contained HTML snapshot: every live
  ticket, grouped by sprint, filterable by sprint/state/search, with a
  `checked/total` acceptance-criteria progress badge per ticket.
- `tickets/queue.json` — the same inventory as machine/LLM-readable JSON.
- `tickets/history.jsonl` — state-count snapshots appended only when a sprint's
  live counts change. It powers the burndown and weekly closure sparklines.

**LLM sessions: read `tickets/queue.json` first** (number, title, state, owner,
estimate, sprint, checklist progress, summary), then `tickets/overview.md` for
ordering, then open only the ticket file(s) you'll actually work on. Don't read
every ticket to orient.

### Regenerating

```bash
python3 build_dashboard.py                  # rewrite both artifacts
python3 build_dashboard.py --check          # lint tickets, write nothing
python3 build_dashboard.py --check-artifacts # verify the tracked artifacts are fresh
```

Regenerate and commit the dashboard artifacts alongside your ticket edits at the end of a
session. `--check-artifacts` ignores only the generated timestamp and git HEAD
stamp, so run it in CI / pre-merge to catch a stale dashboard:

```bash
python3 build_dashboard.py --check --check-artifacts
```

To regenerate automatically on every pull, install the hook once:

```bash
cp post-merge .git/hooks/post-merge && chmod +x .git/hooks/post-merge
cp pre-commit .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
```

The pre-commit guard runs `--check-artifacts` and blocks commits when HTML or
JSON has drifted from ticket markdown. The tracked GitHub Actions workflow at
`.github/workflows/ticket-dashboard.yml` runs the same freshness/lint check and
test suite on pushes and pull requests; `ci.example.yml` is a portable example
for other CI providers.

### State, and the "Needs closing" signal

The generator derives a machine **state** from each ticket's `**Status:**` line
(the vocabulary in `TICKET_TEMPLATE.md`: *Not started, In progress, Blocked, In
review, Done, Planned, Deferred*). One derived state matters most: a ticket that
reads **Done** but still lives in the live `tickets/` tree renders as **Needs
closing** — the signal to verify it and run `python3 process_tickets.py --apply`,
which moves it into `tickets/completed/`. The generator skips `tickets/completed/`
entirely, so archived tickets never clutter the dashboard.

The dashboard flags **In progress** tickets with no dated entry in their Notes /
decisions log for 14 days (change this with `--stale-days`), warns when a card is
blocked by unfinished work, and shows each sprint's closure count plus its `N99`
Go/No-Go gate. Cards have durable `#101` anchors; use the ticket-number button
to copy the ID.

`**Blocks:**` and `**Blocked by:**` accept ticket IDs such as `101` or
`Ticket 101`. `python3 build_dashboard.py --check` rejects dangling references
and cycles; references to archived tickets remain valid and are treated as
closed dependencies.

After archiving, `python3 check_completed_links.py` reports any `../{id}-*.md`
links inside completed tickets that should now point at a `./{id}-*.md` sibling
(advisory; it never edits files). Run the generator's tests with
`pytest test_build_dashboard.py`.

---

## Conventions

- **One ticket, one outcome.** If a ticket has two goals, it's two tickets.
- **Out-of-scope is mandatory.** Every ticket lists what it doesn't do. This is the single best defence against scope creep.
- **Follow-up work gets a new ticket.** Don't silently absorb it into the one you're working on.
- **Commits reference ticket IDs.** Format: `tickets: close 101, 102 (core workflow, structured output)` or `wip 103: add structured logger`.
- **`main` is always runnable.** WIP lives on branches.
