# Ticket 105: Feed Validation and Data-Quality Guards

**Sprint:** 1 — Tracker Data Foundation
**Status:** Not started
**Owner:** unassigned
**Estimate:** L

---

## Context

This is the ticket the rest of the programme leans on. `features.md` asks for a "clear indication when data is delayed, unavailable or based on the timetable", and the roadmap states plainly that a tracker which silently shows a stale position as live is worse than one that says "no live data — showing timetable". Realtime transit feeds lie in specific, well-known ways: a vehicle's position freezes while the feed keeps updating; a bus teleports 40 km because of a GPS glitch or a bad unit; a vehicle is still tagged to a trip it finished an hour ago; a driver is diverted or turned short and the feed keeps asserting the original trip. If we do not classify these before the map exists, Sprint 2 will render them as fact and passengers will miss buses because of us. This ticket builds the classifier, and its output is the evidence 199 uses to decide whether this feed is fit to build on at all.

## Goal

Every vehicle position carries an explicit, queryable quality classification — fresh, stale, implausible, or off-route — computed on ingest, so that no consumer can accidentally treat a bad position as live truth.

## Acceptance criteria

- [ ] A validation module `lib/quality/validate.ts` runs inside the 104 write path and returns ingest-stable flags from a documented closed vocabulary: `IMPLAUSIBLE_JUMP`, `IMPLAUSIBLE_SPEED`, `OFF_ROUTE`, `NO_TRIP`, `TRIP_ENDED`, `MISSING_POSITION`, `MISSING_SOURCE_TIMESTAMP`, `DUPLICATE_VEHICLE_TRIP`; those flags are persisted, while mutually exclusive `FRESH`/`STALE`/`VERY_STALE` state is derived only at read/report time from the authoritative observation timestamp.
- [ ] Staleness is per-vehicle and threshold-driven, not inherited from feed health: a position is `STALE` when `now() - feed_timestamp` exceeds `QUALITY_STALE_SECONDS` (default 60) and `VERY_STALE` beyond `QUALITY_VERY_STALE_SECONDS` (default 300); staleness is recomputed at read time, not frozen at write time, so a vehicle that stops reporting degrades on its own without any new feed message arriving.
- [ ] Implausible movement is detected against the previous accepted position: speed and jump rules apply only inside a configurable comparison horizon; after a longer reporting gap the candidate is quarantined until two consecutive mutually plausible reports establish a new baseline. A bad point is written to history but not promoted, and tests prove one glitch is rejected while a vehicle legitimately reappearing kilometres away recovers instead of remaining permanently pinned to its old position.
- [ ] Off-route detection uses the 102 shape geometry: a position whose `trip_id` resolves to a shape is `OFF_ROUTE` when `ST_Distance(geom, shape_geom)` exceeds `QUALITY_OFF_ROUTE_METRES` (default 150), evaluated with a PostGIS index-assisted query; positions with no resolvable trip or shape get `NO_TRIP` instead of being silently treated as on-route.
- [ ] Vehicles running short, diverted, or re-assigned are handled without producing permanent false alarms: `OFF_ROUTE` must persist for `QUALITY_OFF_ROUTE_CONSECUTIVE` reports (default 3) before it is exposed to consumers, and a vehicle reporting a `trip_id` whose scheduled end time is more than `QUALITY_TRIP_ENDED_MINUTES` (default 30) in the past is flagged `TRIP_ENDED` rather than being drawn as an in-service bus on that route.
- [ ] There is exactly one place that decides what is servable: a helper `lib/quality/isServable.ts` (and a matching SQL view `vehicle_positions_servable`) encodes the rule that consumers must use, and 106 reads through it — a reviewer can grep for direct selects against `vehicle_positions_current` in API code and find none.
- [ ] Quality outcomes are counted, not just tagged: a `feed_quality_stats` table accumulates per-hour counts per flag, and `npm run quality:report -- --hours 24` prints a table of total positions, distinct vehicles, and the percentage carrying each flag over the window. This report is the primary input to 199.
- [ ] `npm test -- quality` passes with fixture-driven unit tests covering, at minimum: fresh/stale/very-stale read-time derivation, a 5 km jump in 20 seconds rejected, recovery after a 10-minute outage and two plausible reports, off-route hysteresis, trip-ended handling, missing position/source timestamp, and duplicate claims against the same full trip-instance key.
- [ ] Validation is cheap enough to stay inline: validating a 5,000-entity batch adds under 500 ms p95 to a poll cycle, demonstrated by `scripts/bench-validate.ts`; all thresholds above are configuration with the documented defaults, changeable without a code edit, and their current values are printed at worker startup.

## Out of scope

- Rendering any of this to a passenger — degraded-state UI, "last updated" chips, and timetable fallback presentation are 206 in Sprint 2. This ticket produces the truth; Sprint 2 displays it.
- Repairing or smoothing bad data — no map-matching, no interpolation between reports, no dead-reckoning a vehicle forward. If a position is bad we mark it bad; we do not invent a better one.
- Falling back to scheduled times as a *substitute* value — 107 provides scheduled-vs-estimated distinction, and Sprint 2 chooses when to show which.
- Alerting, paging, or dashboards over the quality stats — Sprint 8. A CLI report is enough here.
- Feed-level outage detection (frozen or failing endpoint) — that is 104.

## Dependencies

- **Blocks:** 106, 199
- **Blocked by:** 102, 103, 104
- **External:** operator input on plausible thresholds — realistic maximum vehicle speed for the fleet, and how far a bus can legitimately deviate from its shape (bus stations, layover bays, and turning circles routinely sit tens of metres off the published line); a captured multi-day sample of the live feed to tune against before defaults are frozen.

## Approach (optional)

Compute flags in two layers. Ingest-time flags (jump, speed, off-route, trip-ended, duplicates) are computed in the writer where the previous position is already in hand, and are what gates promotion into `vehicle_positions_current`. Time-relative flags (`STALE`, `VERY_STALE`) must be derived at read time from `feed_timestamp` — persisting them would produce the exact bug this ticket exists to prevent, where a vehicle stops reporting and its stored flag says `FRESH` forever. Tune thresholds against captured real feed data rather than guessing; expect the first pass at `QUALITY_OFF_ROUTE_METRES` to be wrong around termini and depots, and record the tuning in the decisions log because 199 will ask how the numbers were chosen. Resist the temptation to drop bad positions entirely — history keeps them, because 199's central question is "how bad is this feed", and you cannot answer that from data you deleted.

## Notes / decisions log

- 2026-07-19 — Ticket written during initial roadmap population. No implementation decisions yet.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
