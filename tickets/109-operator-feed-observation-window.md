# Ticket 109: Operator Feed Observation Window

**Sprint:** 1 — Tracker Data Foundation (follow-up from 199)
**Status:** Not started
**Owner:** John Fegan
**Estimate:** M

---

## Context

Ticket 199 recorded Conditional-Go because the 7-day unattended observation against the operator's live GTFS-RT feeds could not run without Sprint 0 R1 access.

## Goal

Complete ≥ 7 consecutive days of 104+107 ingest on the operator feed and re-score the Sprint 1 thresholds with real `quality:report` output.

## Acceptance criteria

- [ ] Operator VehiclePositions and TripUpdates URLs are configured in the staging secret store.
- [ ] Pollers run unattended ≥ 168 hours; `npm run quality:report -- --hours 168` is pasted into `docs/reviews/sprint-1.md`.
- [ ] Thresholds in the review are evaluated; verdict upgraded to Go or No-Go with named decision-maker.

## Dependencies

- **Blocked by:** Sprint 0 R1 (operator feed access)
- **Blocks:** Stage C public tracker beta (Ticket 001)

## Interim (does not close this ticket)

A **dummy** Perth–Kinross–Tillicoultry feed (`fixtures/operator-dummy/`, routes 55 + 23)
exists for local soak practice and Sprint 2 map work. See that README for
`npm run dummy:gtfs` / `dummy:rt`. Running quality reports against the dummy
**does not** satisfy the acceptance criteria above — operator AVL still required.
