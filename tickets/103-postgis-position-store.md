# Ticket 103: PostGIS Vehicle Position Store

**Sprint:** 1 — Tracker Data Foundation
**Status:** Not started
**Owner:** unassigned
**Estimate:** M

---

## Context

The poller in 104 will produce a stream of vehicle positions — potentially every vehicle in the fleet every 10–30 seconds, indefinitely. Two different questions get asked of that stream and they want opposite storage shapes: the map asks "where is every vehicle right now, inside this viewport" hundreds of times a minute and needs a single-digit-millisecond answer, while validation (105) and the review gate (199) ask "what did this vehicle do over the last hour" and need history. Getting this wrong is expensive to undo once the map is live, so the schema is designed before the writer exists. This ticket owns the tables, indexes, and retention policy; 104 owns filling them.

## Goal

A PostGIS schema exists that stores every observed vehicle position with history and exposes current positions as a fast spatial lookup, with retention bounded so the table cannot grow without limit.

## Acceptance criteria

- [ ] A migration creates `vehicle_positions` (append-only history) with at least `id`, `feed_version_id`, `feed_name`, `entity_id`, `vehicle_id`, `trip_id`, `trip_start_date`, `trip_start_time`, `route_id`, `geom geography(Point,4326)`, `bearing`, `speed_mps`, `occupancy_status`, `current_status`, `stop_id`, `entity_timestamp`, `header_timestamp`, `recorded_at timestamptz` (our receipt time), and `quality_flags` (an integer bitmask or `text[]`, written by 105).
- [ ] A migration creates `vehicle_positions_current`, one row per `(feed_name, vehicle_id)`, holding the latest accepted position plus the same identity and quality columns, with a GIST index on `geom` and btree indexes on the authoritative observation timestamp and trip-instance key.
- [ ] `vehicle_positions` is partitioned by `recorded_at` (daily or weekly range partitions) with automatic creation of future partitions, and a documented, tested retention job drops partitions older than the agreed window (default 14 days) — `npm run db:retention` removes exactly the expired partitions and exits `0`.
- [ ] `lib/positions/write.ts` exposes an idempotent batch upsert taking an array of positions in one transaction: the authoritative observation time is entity timestamp, else header timestamp, else receipt time with `MISSING_SOURCE_TIMESTAMP`; it appends history and upserts current only when the incoming ordering tuple is newer, so null timestamps, out-of-order delivery, and replay cannot move a vehicle backwards.
- [ ] A viewport query `SELECT ... FROM vehicle_positions_current WHERE ST_Intersects(geom, ST_MakeEnvelope($1,$2,$3,$4,4326)::geography)` returns in under 25 ms p95 with 5,000 current vehicles loaded, demonstrated by a checked-in benchmark script `scripts/bench-viewport.ts` that prints p50/p95 and fails if p95 exceeds the budget.
- [ ] A seed/load-test script `npm run seed:positions -- --vehicles 5000 --hours 24` generates synthetic positions so the benchmark and 105's tests can run without the live feed.
- [ ] Duplicate ingestion is proven harmless: `npm test -- position-store` asserts that writing the same batch twice produces no duplicate rows using a feed/entity/observation identity that also works when source timestamps are absent, and leaves `vehicle_positions_current` unchanged.
- [ ] Table and column comments (`COMMENT ON`) record entity vs header vs receipt timestamps, the trip-instance fields, feed-version binding, and the units of `speed_mps` and `bearing`, so a later reader cannot confuse observation time with receipt time or join realtime data to the wrong static version.

## Out of scope

- Writing the actual poller or touching the network — 104.
- Deciding *what counts as* stale, impossible, or off-route, and populating `quality_flags` — 105. This ticket only provides the column and the write path.
- Any HTTP endpoint over this data — 106.
- TripUpdates / arrival predictions storage — 107.
- Long-term analytics warehousing or archival beyond the retention window — Sprint 7 reporting.

## Dependencies

- **Blocks:** 104, 105, 106, 199
- **Blocked by:** 101
- **External:** decision on the history retention window (default 14 days, needs operator sign-off — it constrains what 199 and later incident review can look back at); expected fleet size and feed cadence, to size the partitioning.

## Approach (optional)

Keep the hot path narrow: the map only ever reads `vehicle_positions_current`, which stays small (one row per vehicle) and fully cached in shared buffers, while history lives in partitions the map never touches. Use `geography` rather than `geometry` so distance and containment maths are in metres without reprojection, and accept the small performance cost — 105's speed and off-route checks are much easier to get right in metres. Prefer `pg_partman` or a small scheduled SQL function for partition maintenance; whichever is chosen, the retention job must be a plain command a human can run, not only a background timer.

## Notes / decisions log

- 2026-07-19 — Ticket written during initial roadmap population. No implementation decisions yet.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
