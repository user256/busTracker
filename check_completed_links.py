#!/usr/bin/env python3
"""Detect archive-relative ticket links that should target completed siblings.

When process_tickets.py moves a ticket into tickets/completed/, any link inside
another completed ticket that still points at the ticket's old live location
(../NNN-*.md) silently rots — the target is now a sibling (./NNN-*.md).

This is intentionally advisory: it is not part of build_dashboard.py --check.
Run it after archiving tickets to catch links that need rebasing.
"""

import argparse
import os
import pathlib
import re
import sys


MARKDOWN_LINK_RE = re.compile(r"\]\((?P<destination><[^>]+>|[^\s)]+)(?:\s+[^)]*)?\)")
PARENT_TICKET_RE = re.compile(r"^\.\./(?P<filename>\d{2,6}-[^/]+\.md)(?:[?#].*)?$")


def destinations(text):
    """Yield Markdown-link destinations without fragments or optional brackets."""
    for match in MARKDOWN_LINK_RE.finditer(text):
        destination = match.group("destination").strip("<>")
        yield destination.split("#", 1)[0].split("?", 1)[0]


def find_rot(completed_dir):
    """Return links still aimed at the pre-archive ticket-root location."""
    completed_dir = pathlib.Path(completed_dir)
    findings = []
    for source in sorted(completed_dir.glob("*.md")):
        for destination in destinations(source.read_text(encoding="utf-8")):
            match = PARENT_TICKET_RE.match(destination)
            if not match:
                continue

            resolved = pathlib.Path(os.path.normpath(source.parent / destination))
            sibling = source.parent / match.group("filename")
            if not resolved.exists() and sibling.exists():
                findings.append((source, destination, sibling))
    return findings


def main():
    script_dir = pathlib.Path(__file__).resolve().parent
    default_completed = script_dir / "tickets" / "completed"
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--completed", default=default_completed,
                        help="completed ticket directory (default: tickets/completed)")
    args = parser.parse_args()

    completed_dir = pathlib.Path(args.completed)
    findings = find_rot(completed_dir)
    if findings:
        for source, destination, sibling in findings:
            print(f"{source}: {destination} resolves missing; use ./{sibling.name}")
        print(f"\n{len(findings)} completed-sibling link(s) need rebasing.")
        return 1

    print(f"OK: no stale completed-sibling ticket links in {completed_dir}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
