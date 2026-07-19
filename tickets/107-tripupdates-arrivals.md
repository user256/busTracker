# Ticket 107: TripUpdates Ingest and Arrival Estimates

**Sprint:** 1 — Tracker Data Foundation
**Status:** Not started
**Owner:** unassigned
**Estimate:** L

---

## Context

A dot moving on a map answers "where is my bus"; passengers actually want "when will it get here". That answer comes from the GTFS-Realtime TripUpdates feed, which carries per-stop arrival and departure predictions and delay values. `features.md` asks for estimated arrival times, live journey progress, upcoming stops, delay indicators and revised arrival times — and the roadmap closes with the rule that we must never present an estimate as a guarantee. So this ticket has two jobs of equal weight: ingest the predictions, and make it structurally impossible for a consumer to render an estimate without knowing it is one. Every arrival we return must state whether it came from the feed or from the timetable, and how old it is.

## Goal

TripUpdates ingest continuously into a queryable store, and an arrival lookup returns per-stop times that are always explicitly labelled as realtime estimate or scheduled timetable.

## Acceptance criteria

- [ ] A migration creates revisioned `trip_updates` and `stop_time_updates` bound to `feed_version_id` and a canonical trip-instance key containing `trip_id`, `start_date`, and `start_time` where supplied/required (or the GTFS-permitted alternative route/direction/start tuple); stop updates reference their parent revision and include stop sequence, stop id, arrival/departure event, delay, uncertainty, schedule relationship, header/entity timestamps, and receipt time.
- [ ] Trip matching follows the GTFS-Realtime TripDescriptor rules: repeated/frequency trips cannot key on `trip_id` alone, late cross-service-day trips remain distinct, unsupported or ambiguous descriptors are quarantined with a quality reason, and tests cover the same `trip_id` on consecutive dates plus two frequency instances on one date.
- [ ] `npm run worker:tripupdates` polls `GTFS_RT_TRIP_UPDATES_URL` on the same cadence and with the same backoff, `304` handling, frozen-feed detection, and `feed_health` reporting as the 104 poller, reusing that ticket's polling primitives rather than duplicating them.
- [ ] GTFS-RT delay propagation is implemented correctly: a `StopTimeUpdate` carrying only `delay` is resolved against the scheduled `stop_times` from the active 102 feed version, and a delay given at one stop propagates to subsequent stops on the trip until superseded, per the GTFS-RT specification — asserted by a fixture test.
- [ ] `lib/arrivals/forStop.ts` returns the next N arrivals for a `stop_id`, each carrying the canonical trip-instance key, `source: "realtime" | "scheduled"`, `scheduled_time`, `estimated_time | null`, `delay_seconds | null`, `uncertainty_seconds | null`, `age_seconds | null`, and `confidence_note`; the type system makes provenance non-optional.
- [ ] Fallback to timetable is automatic and explicit: when no TripUpdate exists for a trip, or the newest one is older than `ARRIVAL_STALE_SECONDS` (default 180), or the vehicle serving it is flagged `VERY_STALE`/`IMPLAUSIBLE_JUMP` by 105, the arrival is returned with `source: "scheduled"` and `estimated_time: null` — never a stale estimate presented as current.
- [ ] Cancellations and short-running are honoured, not hidden: trips with `schedule_relationship = CANCELED` and stops with `SKIPPED` are surfaced with that status rather than dropped from the list, so a passenger can be told their bus is not coming rather than watching it silently disappear.
- [ ] `GET /api/v1/stops/{stop_id}/arrivals?limit=10` returns the above with the same `generated_at` / `feed_status` envelope as 106, responds in under 200 ms p95, and is documented at `docs/api/arrivals.md`.
- [ ] `npm test -- arrivals` passes fixture-driven tests covering: a trip with explicit per-stop predictions, a trip with a single propagating `delay`, a trip with no TripUpdate (falls back to `scheduled`), a TripUpdate 10 minutes old (falls back to `scheduled`), a `CANCELED` trip, a `SKIPPED` stop, and a trip whose vehicle is flagged implausible by 105 (falls back to `scheduled`).
- [ ] `docs/data-quality.md` gains a section stating the product rule in words — arrival times are estimates, are never presented as guaranteed, and always ship with their source and age — and the API docs repeat it, so Sprint 2 and Sprint 3 inherit the rule rather than reinventing it.

## Out of scope

- Building our own prediction model. We surface the operator's predictions and the timetable; we do not compute arrival times from vehicle positions ourselves. If the feed's predictions turn out to be unusable, 199 records that and a modelling ticket is filed for a later sprint.
- Rendering departure boards, countdown timers, or delay chips — Sprint 2 (205, 206) and Sprint 3.
- ServiceAlerts ingest — Sprint 4 (401).
- Push notifications about delays to subscribers — Sprint 4 (403).
- Journey planning across multiple legs using these estimates — Sprint 3 (304).

## Dependencies

- **Blocks:** 199
- **Blocked by:** 102, 104
- **External:** the operator's GTFS-Realtime TripUpdates URL and credentials; confirmation of whether the feed publishes absolute times, delays, or a mix, and whether it covers the whole fleet or only some routes; operator agreement on the wording used to caveat estimates.

## Approach (optional)

Store what the feed says and resolve against the timetable at read time rather than materialising a full predicted timetable on every poll — the feed can revise, and a stored derived table goes stale in ways that are hard to notice. Keep only the latest TripUpdate per trip in a `current` shape for reads, with history retained under the same partitioning/retention approach as 103 so 199 can measure prediction accuracy after the fact. Compare predictions against subsequently observed vehicle positions during the observation window; that comparison is a direct input to the Go/No-Go, and it is far easier if the raw updates were kept.

## Notes / decisions log

- 2026-07-19 — Ticket written during initial roadmap population. No implementation decisions yet.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
