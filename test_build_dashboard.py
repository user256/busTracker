#!/usr/bin/env python3
"""Focused regression coverage for the ticket dashboard generator."""

import pathlib
import subprocess
import sys
import tempfile
import unittest
import json


REPO_ROOT = pathlib.Path(__file__).resolve().parent
BUILD_SCRIPT = REPO_ROOT / "build_dashboard.py"
COMPLETED_LINK_CHECK = REPO_ROOT / "check_completed_links.py"


class DashboardArtifactFreshnessTest(unittest.TestCase):
    def run_generator(self, tickets_dir, *args):
        return subprocess.run(
            [sys.executable, str(BUILD_SCRIPT), "--tickets", str(tickets_dir), *args],
            text=True,
            capture_output=True,
            check=False,
        )

    def test_freshness_check_detects_stale_artifacts_without_writing(self):
        with tempfile.TemporaryDirectory() as tmp:
            tickets_dir = pathlib.Path(tmp) / "tickets"
            tickets_dir.mkdir()
            ticket = tickets_dir / "101-fixture.md"
            ticket.write_text(
                "# Ticket 101: Fixture\n\n"
                "**Sprint:** 1 — Foundation\n"
                "**Status:** Not started\n"
                "**Owner:** unassigned\n"
                "**Estimate:** S\n\n"
                "---\n\n"
                "## Context\n\n"
                "Fixture source.\n",
                encoding="utf-8",
            )

            generated = self.run_generator(tickets_dir)
            self.assertEqual(generated.returncode, 0, generated.stderr)

            artifacts = (tickets_dir / "ticket-dashboard.html", tickets_dir / "queue.json")
            before = {path: path.read_bytes() for path in artifacts}

            fresh = self.run_generator(tickets_dir, "--check", "--check-artifacts")
            self.assertEqual(fresh.returncode, 0, fresh.stdout + fresh.stderr)
            self.assertIn("dashboard artefacts are fresh", fresh.stdout)
            self.assertEqual(before, {path: path.read_bytes() for path in artifacts})

            ticket.write_text(ticket.read_text(encoding="utf-8").replace(
                "Fixture source.", "Changed fixture source."
            ), encoding="utf-8")
            stale = self.run_generator(tickets_dir, "--check", "--check-artifacts")
            self.assertNotEqual(stale.returncode, 0)
            self.assertIn("is stale", stale.stdout)
            self.assertIn("python build_dashboard.py", stale.stdout)
            self.assertEqual(before, {path: path.read_bytes() for path in artifacts})

    def test_done_ticket_in_live_tree_is_needs_closing(self):
        with tempfile.TemporaryDirectory() as tmp:
            tickets_dir = pathlib.Path(tmp) / "tickets"
            tickets_dir.mkdir()
            (tickets_dir / "102-shipped.md").write_text(
                "# Ticket 102: Shipped\n\n"
                "**Sprint:** 1 — Foundation\n"
                "**Status:** Done\n",
                encoding="utf-8",
            )
            import json
            self.run_generator(tickets_dir)
            queue = json.loads((tickets_dir / "queue.json").read_text(encoding="utf-8"))
            states = {i["number"]: i["state"] for i in queue["items"]}
            self.assertEqual(states[102], "Needs closing")

    def test_completed_dir_is_skipped(self):
        with tempfile.TemporaryDirectory() as tmp:
            tickets_dir = pathlib.Path(tmp) / "tickets"
            (tickets_dir / "completed").mkdir(parents=True)
            (tickets_dir / "103-live.md").write_text(
                "# Ticket 103: Live\n\n**Status:** In progress\n", encoding="utf-8")
            (tickets_dir / "completed" / "090-archived.md").write_text(
                "# Ticket 090: Archived\n\n**Status:** Done\n", encoding="utf-8")
            import json
            self.run_generator(tickets_dir)
            queue = json.loads((tickets_dir / "queue.json").read_text(encoding="utf-8"))
            numbers = {i["number"] for i in queue["items"]}
            self.assertIn(103, numbers)
            self.assertNotIn(90, numbers)

    def test_check_rejects_duplicate_ticket_numbers(self):
        with tempfile.TemporaryDirectory() as tmp:
            tickets_dir = pathlib.Path(tmp) / "tickets"
            tickets_dir.mkdir()
            for slug in ("first", "second"):
                (tickets_dir / f"104-{slug}.md").write_text(
                    "# Ticket 104: Fixture\n\n**Status:** Not started\n",
                    encoding="utf-8",
                )

            checked = self.run_generator(tickets_dir, "--check")
            self.assertNotEqual(checked.returncode, 0)
            self.assertIn("duplicate ticket number 104", checked.stdout)
            self.assertIn("104-first.md", checked.stdout)
            self.assertIn("104-second.md", checked.stdout)

    def test_dependency_lint_and_open_blocker_badge(self):
        with tempfile.TemporaryDirectory() as tmp:
            tickets_dir = pathlib.Path(tmp) / "tickets"
            tickets_dir.mkdir()
            (tickets_dir / "101-first.md").write_text(
                "# Ticket 101: First\n\n**Status:** In progress\n"
                "**Blocks:** Ticket 102\n",
                encoding="utf-8",
            )
            second = tickets_dir / "102-second.md"
            second.write_text(
                "# Ticket 102: Second\n\n**Status:** Not started\n"
                "**Blocked by:** #101\n",
                encoding="utf-8",
            )

            generated = self.run_generator(tickets_dir)
            self.assertEqual(generated.returncode, 0, generated.stdout + generated.stderr)
            queue = json.loads((tickets_dir / "queue.json").read_text(encoding="utf-8"))
            item = next(item for item in queue["items"] if item["number"] == 102)
            self.assertEqual(item["blocked_by_open"], [101])
            html = (tickets_dir / "ticket-dashboard.html").read_text(encoding="utf-8")
            self.assertIn('id="${ticketId}"', html)
            self.assertIn('data-ticket-id="${ticketId}"', html)

            second.write_text(second.read_text(encoding="utf-8").replace("#101", "#999"), encoding="utf-8")
            checked = self.run_generator(tickets_dir, "--check")
            self.assertNotEqual(checked.returncode, 0)
            self.assertIn("missing ticket #999", checked.stdout)

    def test_dependency_cycle_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            tickets_dir = pathlib.Path(tmp) / "tickets"
            tickets_dir.mkdir()
            for number, blocker in ((101, 102), (102, 101)):
                (tickets_dir / f"{number}-fixture.md").write_text(
                    f"# Ticket {number}: Fixture\n\n**Status:** Not started\n"
                    f"**Blocked by:** #{blocker}\n",
                    encoding="utf-8",
                )
            checked = self.run_generator(tickets_dir, "--check")
            self.assertNotEqual(checked.returncode, 0)
            self.assertIn("dependency cycle: #101 -> #102 -> #101", checked.stdout)

    def test_in_progress_ticket_with_old_dated_note_is_surfaced(self):
        with tempfile.TemporaryDirectory() as tmp:
            tickets_dir = pathlib.Path(tmp) / "tickets"
            tickets_dir.mkdir()
            (tickets_dir / "101-stale.md").write_text(
                "# Ticket 101: Stale\n\n**Status:** In progress\n\n"
                "## Notes / decisions log\n\n"
                "- 2000-01-01 — Started investigation.\n",
                encoding="utf-8",
            )
            self.assertEqual(self.run_generator(tickets_dir).returncode, 0)
            queue = json.loads((tickets_dir / "queue.json").read_text(encoding="utf-8"))
            item = queue["items"][0]
            self.assertTrue(item["stale"])
            self.assertEqual(item["last_note_date"], "2000-01-01")
            checked = self.run_generator(tickets_dir, "--check", "--stale-days", "14")
            self.assertEqual(checked.returncode, 0, checked.stdout + checked.stderr)
            self.assertIn("In progress but", checked.stdout)

    def test_history_and_sprint_gate_summary(self):
        with tempfile.TemporaryDirectory() as tmp:
            tickets_dir = pathlib.Path(tmp) / "tickets"
            completed = tickets_dir / "completed"
            completed.mkdir(parents=True)
            (completed / "101-closed.md").write_text(
                "# Ticket 101: Closed\n\n**Sprint:** 1 — Foundation\n**Status:** Done\n",
                encoding="utf-8",
            )
            gate = tickets_dir / "199-gate.md"
            gate.write_text(
                "# Ticket 199: Gate\n\n**Sprint:** 1 — Foundation\n**Status:** Not started\n",
                encoding="utf-8",
            )

            self.assertEqual(self.run_generator(tickets_dir).returncode, 0)
            history_path = tickets_dir / "history.jsonl"
            initial_history = history_path.read_text(encoding="utf-8")
            self.assertEqual(self.run_generator(tickets_dir).returncode, 0)
            self.assertEqual(initial_history, history_path.read_text(encoding="utf-8"))

            queue = json.loads((tickets_dir / "queue.json").read_text(encoding="utf-8"))
            summary = queue["sprint_summaries"]["Sprint 1"]
            self.assertEqual((summary["closed"], summary["total"]), (1, 2))
            self.assertEqual((summary["gate_number"], summary["gate_state"]), (199, "Not started"))
            self.assertEqual(len(queue["history"]), 1)

            gate.write_text(gate.read_text(encoding="utf-8").replace("Not started", "In review"), encoding="utf-8")
            self.assertEqual(self.run_generator(tickets_dir).returncode, 0)
            self.assertEqual(len(history_path.read_text(encoding="utf-8").splitlines()), 2)


class CompletedSiblingLinkCheckTest(unittest.TestCase):
    def run_checker(self, completed_dir):
        return subprocess.run(
            [sys.executable, str(COMPLETED_LINK_CHECK), "--completed", str(completed_dir)],
            text=True,
            capture_output=True,
            check=False,
        )

    def test_detects_only_missing_parent_links_with_completed_siblings(self):
        with tempfile.TemporaryDirectory() as tmp:
            tickets_dir = pathlib.Path(tmp) / "tickets"
            completed_dir = tickets_dir / "completed"
            completed_dir.mkdir(parents=True)
            (completed_dir / "101-sibling.md").write_text("# 101\n", encoding="utf-8")
            (tickets_dir / "301-live.md").write_text("# 301\n", encoding="utf-8")
            source = completed_dir / "201-source.md"
            source.write_text(
                "[stale](../101-sibling.md#notes)\n"
                "[live](../301-live.md)\n"
                "[missing](../401-missing.md)\n",
                encoding="utf-8",
            )

            stale = self.run_checker(completed_dir)
            self.assertEqual(stale.returncode, 1, stale.stdout + stale.stderr)
            self.assertIn("201-source.md: ../101-sibling.md", stale.stdout)
            self.assertNotIn("301-live.md resolves missing", stale.stdout)
            self.assertNotIn("401-missing.md", stale.stdout)

            source.write_text(source.read_text(encoding="utf-8").replace(
                "../101-sibling.md#notes", "./101-sibling.md#notes"
            ), encoding="utf-8")
            fixed = self.run_checker(completed_dir)
            self.assertEqual(fixed.returncode, 0, fixed.stdout + fixed.stderr)


if __name__ == "__main__":
    unittest.main()
