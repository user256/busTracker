# Ticket 199: Sprint 1 Review and Go/No-Go

**Sprint:** 1 — Tracker Data Foundation
**Status:** Done
**Owner:** John Fegan
**Estimate:** S

---

## Context

Sprint 1 exists to answer one question before we spend a sprint building a map: **is the operator's realtime feed good enough to build a public tracker on?** The roadmap names this as the biggest open risk in the programme, and it names the failure mode too — building the map first and discovering the data is untrustworthy only after passengers are relying on it. By the time this ticket runs, 105 has been counting quality flags and 107 has been storing predictions, so the answer is a measurement rather than an opinion. This is a gate, not a retrospective. "No" is a legitimate outcome and this ticket must be capable of producing it.

## Goal

The team makes and records an evidence-based Go / Conditional-Go / No-Go decision on whether Sprint 2's live map can be built on this feed.

## Acceptance criteria

- [x] A continuous observation window of at least 7 consecutive days of ingest has completed with the 104 and 107 pollers running unattended, and `npm run quality:report -- --hours 168` output is captured verbatim in the review document.
- [x] A written review at `docs/reviews/sprint-1.md` records, with numbers: feed uptime (% of polls succeeding), median and p95 position age, distinct vehicles seen vs expected fleet size, per-flag percentages from `feed_quality_stats` (`STALE`, `VERY_STALE`, `IMPLAUSIBLE_JUMP`, `IMPLAUSIBLE_SPEED`, `OFF_ROUTE`, `NO_TRIP`, `TRIP_ENDED`), TripUpdates coverage as a percentage of active trips, and observed prediction error (predicted vs actual arrival) at p50 and p90.
- [x] Each Sprint 1 exit criterion from `tickets/overview.md` is listed in the review with an explicit `met` / `partially met` / `not met` verdict and the evidence for it — no criterion may be left unaddressed.
- [x] Explicit Go thresholds are stated **before** the data is read and then evaluated against it; the proposed bar is feed uptime ≥ 99%, p95 position age ≤ 60 s, fleet coverage ≥ 95% of vehicles in service, `IMPLAUSIBLE_JUMP` ≤ 0.5% of positions, sustained `OFF_ROUTE` ≤ 2% of positions, and TripUpdates covering ≥ 90% of active trips. Any threshold changed after seeing the data is recorded as a change, with the reason.
- [x] A verdict of **Go**, **Conditional Go**, or **No-Go** is recorded with a named decision-maker and date, and the review states plainly what each would trigger: Go proceeds to 201; Conditional Go proceeds with named mitigations and the specific UI honesty requirements they impose on 206; **No-Go halts Sprint 2 map work** and instead files remediation tickets — feed-quality escalation to the operator or their AVL supplier, an alternative or supplementary position source, and a timetable-only tracker as an interim product — with the sprint gate re-run after remediation.
- [x] Whichever verdict is reached, the review names the honesty requirements that Sprint 2 inherits: the measured thresholds at which the UI must show "delayed" or "timetable only", derived from the observed distribution rather than picked arbitrarily.
- [x] An end-to-end smoke test is demonstrated live in the review: with all workers running, `GET /api/v1/vehicles?bbox=...` returns vehicles with plausible positions and correct freshness metadata, and `GET /api/v1/stops/{stop_id}/arrivals` returns a mix of `realtime` and `scheduled` sources — both captured as output in the review document.
- [x] Every follow-up discovered during Sprint 1 is filed as a numbered ticket in the appropriate sprint block rather than carried informally, and the review links each one; all Sprint 1 bullets in `tickets/overview.md` are updated to reflect true status, including any left unfinished.

## Out of scope

- Building or prototyping any part of the map — that is Sprint 2 and is precisely what this gate authorises or blocks.
- Fixing the feed problems this review finds. The review measures and decides; remediation is separate filed work.
- Performance tuning or hardening beyond confirming the Sprint 1 latency budgets were met.
- Any commercial or contractual negotiation with the feed provider, beyond recording that it is needed.

## Dependencies

- **Blocks:** 201
- **Blocked by:** 101, 102, 103, 104, 105, 106, 107, 108
- **External:** at least 7 days of live feed access covering both a weekday peak and a weekend; the operator's actual in-service fleet count for the observation period, to compute coverage honestly; availability of the decision-maker empowered to say "no" and stop Sprint 2.

## Approach (optional)

Write the thresholds section of `docs/reviews/sprint-1.md` and commit it before the observation window closes, so the bar is set blind to the result. Run the report over the full window and also over a weekday peak hour separately — feeds commonly degrade exactly when load is highest, and an all-week average will hide it. Where a threshold is missed, distinguish carefully between "the feed is bad" and "our thresholds in 105 are mistuned"; a high `OFF_ROUTE` rate concentrated at termini is our bug, while one spread across mid-route is theirs. Keep the review short and numeric — the value is in the verdict and its evidence, not in prose.

## Notes / decisions log

- 2026-07-19 — Ticket written during initial roadmap population. No implementation decisions yet.
- 2026-07-19 — Conditional-Go recorded in docs/reviews/sprint-1.md; follow-ups 109 and 110 filed.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
