# Ticket 299: Sprint 2 Review and Go/No-Go

**Sprint:** 2 — Live Map Surface
**Status:** Not started
**Owner:** unassigned
**Estimate:** S

---

## Context

Sprint 2 ships the feature the business actually wants to see, which is precisely why it needs a gate rather than a launch party. Sprint 1's review asked "is the feed good enough to build on"; this one asks the harder, more public question: **is the tracker ready for real passenger traffic?** A tracker that is beautiful but wrong damages trust in the operator more than having no tracker at all, and unlike the data foundation, this failure mode is visible to every customer. Per the roadmap, "stop here" and "hold the launch" are valid, expected outcomes of this ticket — the gate is not a formality.

## Goal

The team makes and records an explicit, evidence-backed Go/No-Go decision on releasing the live tracker to public traffic.

## Acceptance criteria

- [ ] Every Sprint 2 acceptance criterion in tickets 201–208 is checked, or is explicitly listed in this ticket as knowingly deferred with a named owner and a follow-up ticket number.
- [ ] Each Sprint 2 exit criterion in `tickets/overview.md` is assessed individually and marked met / partially met / not met, with the evidence (test run, recording, or measurement) linked — not asserted from memory.
- [ ] Freshness telemetry from Ticket 206 is reported over a minimum 7-day observation window: percentage of time the tracker was in `live`, `delayed`, `timetable`, and `offline` states, and the longest single degraded episode. A tracker that is live less than an agreed threshold of the service day is a No-Go input.
- [ ] Performance is reported against the sprint's stated budgets on a mid-range Android reference device over a throttled connection: time to interactive map, sustained frame rate with the full route network plus ≥ 100 live vehicles, and the geometry payload size from Ticket 202.
- [ ] Accessibility status is reported: the CI `axe-core` result for `/map` and `/map/nearby`, plus the outcome of the manual VoiceOver and NVDA passes from Ticket 208. Unresolved serious or critical violations are an explicit No-Go input.
- [ ] A live cross-device smoke test is run and recorded on at least iOS Safari, Android Chrome, and desktop Chrome/Firefox, covering: map loads, vehicles move, tap a bus and read its next stops, tap a stop and read departures, share a link and reopen it on another device.
- [ ] The degraded-state behaviour is verified by deliberately breaking the upstream feed in a staging environment and confirming the UI reaches `timetable` and then `offline` honestly, with no stale position ever labelled live.
- [ ] A written Go / No-Go / Conditional-Go decision is recorded in this ticket's decisions log, naming the decision maker, the date, the top three residual risks, and — if Conditional-Go — the exact conditions and their ticket numbers.
- [ ] If the decision is Go, the launch conditions are documented: rollout approach, the metric that would trigger a rollback, and who is on call for the first week.

## Out of scope

- Building any of the remediation work identified by this review — that is filed as new tickets.
- Sprint 3 planning or any work in `3xx`.
- Marketing launch activity, press, or announcement copy.
- Load testing beyond ordinary expected traffic — peak/snow-day scaling is Sprint 8 (802).

## Dependencies

- **Blocks:** 300
- **Blocked by:** 108, 201, 202, 203, 204, 205, 206, 207, 208
- **External:** Operator/business stakeholder available to co-sign the decision; a minimum 7-day window of production-like freshness telemetry, which must be started well before this ticket opens.

## Approach (optional)

Run it as a single timeboxed session against a written agenda, with the evidence gathered *before* the meeting rather than assembled in it. Explicitly invite the No-Go case: ask one person to argue against launching. The most likely genuine No-Go here is feed liveness — the tracker technically working while the buses on it are frequently untracked.

## Notes / decisions log

- 2026-07-19 — Ticket written during initial roadmap population. No implementation decisions yet.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
