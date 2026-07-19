# Ticket 104: GTFS-Realtime VehiclePositions Poller

**Sprint:** 1 — Tracker Data Foundation
**Status:** Done
**Owner:** John Fegan
**Estimate:** M

---

## Context

This is the ticket that turns busTracker from a static timetable database into a live tracker: a long-running process that polls the operator's GTFS-Realtime VehiclePositions endpoint and writes what it sees into the store built in 103. It has to run unattended for days without a human restarting it, because the sprint exit criteria require continuous ingest without operator intervention. It also has to be honest when it fails — a poller that silently stops and leaves the last known positions in place would make the map show ghost buses, which is precisely the failure mode the whole programme is trying to avoid. Feed quality is unknown at the time of writing; this poller is also the instrument we use to measure it in 199.

## Goal

A supervised worker process polls the VehiclePositions feed on a fixed cadence, writes every position to the store, and records its own health so downstream code can tell whether ingest is currently working.

## Acceptance criteria

- [x] `npm run worker:positions` starts a long-lived process that polls the URL in `GTFS_RT_VEHICLE_POSITIONS_URL` every `POLL_INTERVAL_MS` (default 10000), decodes the protobuf with a maintained GTFS-RT binding, and writes each entity through 103's batch upsert.
- [x] Feed fetches send `If-Modified-Since`/`If-None-Match` when the server offers them and treat `304 Not Modified` as a successful no-op poll, not as an error or an empty feed.
- [x] Transient failures are survived: HTTP 5xx, timeouts, connection resets, and protobuf decode errors are retried with exponential backoff (base 1s, cap 60s, jittered) without exiting the process, and consecutive failures are logged with attempt count; the process only exits non-zero on a config/startup error.
- [x] A `feed_health` table (or equivalent) is updated on every poll with `feed_name`, `last_attempt_at`, `last_success_at`, `last_feed_timestamp`, `consecutive_failures`, `entity_count`, and `last_error`; `GET /api/health` from 101 is extended to include vehicle-feed freshness derived from it.
- [x] Sustained failure is loud, not silent: after `FEED_FAILURE_ALERT_THRESHOLD` consecutive failed polls (default 6) the worker emits an `error`-level structured log with `feed_name` and elapsed outage duration, and `/api/health` reports the vehicle feed as `degraded`; nothing in the system continues to present the last known positions as current.
- [x] Feed-level staleness is detected independently of HTTP success: if the feed responds `200` but its `header.timestamp` has not advanced for more than `FEED_STALE_SECONDS` (default 120), the poll is recorded as stale in `feed_health` and logged at `warn`, because a frozen feed returning 200 is the most dangerous failure mode we have.
- [x] Each poll logs one structured JSON line containing `feed_name`, `poll_id`, `http_status`, `feed_timestamp`, `entity_count`, `written_count`, `skipped_older_count`, and `duration_ms`.
- [x] A single poll cycle for a full feed completes in under 2 seconds end to end (fetch excluded) at 5,000 entities, and running two poller instances concurrently against the same database produces no duplicate rows and no lost updates.
- [x] `npm test -- rt-poller` passes against checked-in binary fixtures under `fixtures/gtfs-rt/` covering: a normal feed, an empty feed, a feed with a frozen header timestamp, a truncated/corrupt protobuf, and entities missing `position` — each asserted to produce the documented outcome rather than a crash.

## Out of scope

- Judging whether a position is plausible — staleness of an individual *vehicle*, impossible jumps, and off-route detection are 105. This ticket only detects that the *feed* itself is failing or frozen.
- TripUpdates and ServiceAlerts feeds — 107 and Sprint 4.
- Serving positions over HTTP — 106.
- Production process supervision, alerting integrations, and paging — Sprint 8. Structured logs and `/api/health` are the interface here.

## Dependencies

- **Blocks:** 105, 106, 107, 199
- **Blocked by:** 101, 103
- **External:** the operator's GTFS-Realtime VehiclePositions URL plus any API key or IP allowlisting; the feed's documented (and, more importantly, actual) update cadence; permission on request rate so polling every 10s is acceptable to the provider.

## Approach (optional)

Keep the loop dumb and the writer smart: fetch, decode, map entities to the 103 write shape, hand off a batch, sleep. Do not use `setInterval` — schedule the next poll after the previous one settles so a slow fetch cannot stack up overlapping requests. Store the raw protobuf body of every Nth poll (or every poll during the 199 observation window) to a `fixtures/captures/` directory or object store; 105 and 199 will both want real captured feed data to test against, and it is far cheaper to capture it from day one than to reconstruct it later. Treat every field in the feed as optional — real-world GTFS-RT omits `bearing`, `speed`, `trip_id`, and occasionally `position` itself.

## Notes / decisions log

- 2026-07-19 — Ticket written during initial roadmap population. No implementation decisions yet.
- 2026-07-19 — Shipped: `worker:positions` poller with conditional GET/304, exponential backoff, `feed_health` updates, `/api/health` vehicle-feed freshness, structured poll logs, and `fixtures/gtfs-rt/` test coverage.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
