# Ticket 399: Sprint 3 Review and Go/No-Go

**Sprint:** 3 — Routes, Stops, and Timetables
**Status:** Planned
**Owner:** unassigned
**Estimate:** S

---

## Context

Sprint 3 adds the information layer — route pages, stop pages, timetables, the journey planner, stop finding, and the SEO surface that makes all of it discoverable. The journey planner in particular is the largest single piece of engineering in the programme so far and the one most likely to be *nearly* right, which in a transport product is a specific kind of dangerous: a planner that returns a journey the passenger cannot actually make is worse than no planner. Before Sprint 4 builds disruption display on top of these surfaces, and before Sprint 5 commits to selling tickets against journeys planned here, the team needs an explicit decision that the information layer is correct enough to build on. This is a gate, not a retrospective: "no" is a permitted and expected outcome.

## Goal

The team makes and records an explicit Go/No-Go decision on whether the routes, stops, timetables and journey planner are correct and trustworthy enough for Sprint 4 to build disruption surfaces on.

## Acceptance criteria

- [ ] Every Sprint 3 exit criterion in `tickets/overview.md` is assessed in a written table with a `met` / `partially met` / `not met` verdict and supporting evidence (a URL, a test name, or a measurement) per row — no unevidenced "met".
- [ ] A correctness audit of at least 20 real journeys covering direct, single-transfer, and two-transfer cases, plus at least one bank holiday and one late-night past-midnight departure, is checked against the operator's published timetable by a named reviewer, with the pass rate recorded; anything below 100% is itemised with a cause.
- [ ] Measured `p95` latency for `GET /api/plan`, the route page, and the stop page under the load-test script from 304 is recorded against the 800 ms planner budget, with the test date and dataset version stated.
- [ ] An accessibility check across a route page, a stop page, and a planner results page is recorded: axe-core results, a keyboard-only walkthrough, and a screen-reader pass on the timetable table and departures board, with each WCAG 2.2 AA failure listed as pass/fail and any failure filed as a ticket.
- [ ] Indexability is verified: the sitemap resolves, a sample of 10 route and stop URLs return HTTP 200 with valid JSON-LD, an old slug returns 301, and a withdrawn entity returns 410.
- [ ] A written **Go / No-Go / Go-with-conditions** decision is recorded in this ticket's notes log with the decision date, the named decision-maker, and the reasoning — including which of the three outcomes was chosen and why the other two were not.
- [ ] The consequences of "No" are written down before the decision is taken: Sprint 4 does not start; the planner either regresses to direct-journeys-only as a shipped subset or is withheld from public traffic entirely; the remedial tickets are filed against Sprint 3 with a re-review date; and the option of stopping the programme here is explicitly considered and its rejection justified.
- [ ] All Sprint 3 follow-up work discovered during the sprint is filed as numbered tickets rather than carried as informal debt, and `tickets/overview.md` bullets for 301–306 reflect true status.

## Out of scope

- Building any of the remediation identified — this ticket decides and files, it does not fix.
- Sprint 4 planning detail beyond the go/no-go decision itself.
- Commercial decisions about ticketing scope (Sprint 5).

## Dependencies

- **Blocks:** 400
- **Blocked by:** 300, 301, 302, 303, 304, 305, 306
- **External:** operator sign-off on journey-planner correctness against their own published timetables; a named decision-maker with authority to stop the programme.

## Approach (optional)

Run the correctness audit before the review meeting, not in it — the meeting should be spent on the decision, not on discovering the data. Pick the 20 audit journeys adversarially: the routes with the messiest calendars, the stops with missing accessibility data, and the last bus of the night. If the planner passes on easy journeys and fails on those, that is a "Go-with-conditions" at best.

## Notes / decisions log

- 2026-07-19 — Ticket written during initial roadmap population. No implementation decisions yet.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
