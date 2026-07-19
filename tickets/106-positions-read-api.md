# Ticket 106: Vehicle Positions Read API

**Sprint:** 1 — Tracker Data Foundation
**Status:** Not started
**Owner:** unassigned
**Estimate:** M

---

## Context

Sprint 2's map will poll for vehicle positions every few seconds from every open browser tab, so this endpoint is the single highest-traffic path in the product and the contract that the whole map surface is written against. It is also the last line of defence for data honesty: whatever this API says is live, the map will draw as live. That makes two requirements non-negotiable — it must read through 105's servable view rather than the raw current-positions table, and every response must carry explicit freshness metadata so the client can render "updated 8 seconds ago" or "no live data" without guessing. Defining this contract now, before any UI exists, is deliberate; changing it after Sprint 2 is built on it is much more expensive.

## Goal

An HTTP endpoint returns current, quality-filtered vehicle positions for a viewport or a route, with explicit freshness metadata, inside a defined latency budget.

## Acceptance criteria

- [ ] `GET /api/v1/vehicles?bbox=minLon,minLat,maxLon,maxLat` returns servable vehicles inside the bounding box; `GET /api/v1/vehicles?route_id=<id>` returns them for one route; supplying neither returns `400` with a machine-readable error code, and supplying both is accepted and intersected.
- [ ] The response body is `{"generated_at": "<ISO8601>", "feed_timestamp": "<ISO8601|null>", "feed_status": "live|degraded|down", "vehicles": [...]}`, where each vehicle carries `vehicle_id`, `route_id`, `trip_id`, `lat`, `lon`, `bearing`, `speed_mps`, `occupancy_status`, `headsign`, `feed_timestamp`, `age_seconds`, and `quality: ["FRESH"|"STALE"|...]` — a response can never omit the age of a position.
- [ ] The endpoint reads exclusively through 105's `vehicle_positions_servable` view / `isServable` helper: positions flagged `IMPLAUSIBLE_JUMP`, `MISSING_POSITION`, or `VERY_STALE` are never returned, and `STALE` positions are returned but plainly marked so, never silently as fresh.
- [ ] `feed_status` is derived from the `feed_health` table written by 104: `live` when the last successful poll is within 60 s, `degraded` between 60 s and 300 s, `down` beyond that or when the poller has never succeeded — and it is `down`/`degraded` even when the `vehicles` array is non-empty from cached rows.
- [ ] A response schema is published at `docs/api/vehicles.md` and enforced in tests: `npm test -- positions-api` asserts every documented field's presence and type against a seeded database, plus the `400` cases and an empty-viewport `200` with `"vehicles": []`.
- [ ] Latency budget is met and measured: p95 under 150 ms server-side for a city-sized bbox with 5,000 current vehicles, verified by `scripts/bench-api.ts` which prints p50/p95/p99 and exits non-zero if p95 exceeds the budget.
- [ ] Responses set `Cache-Control: public, max-age=5, stale-while-revalidate=10` and a strong `ETag`; a conditional request with a matching `If-None-Match` returns `304`, so the Sprint 2 refresh loop is cheap.
- [ ] The bbox parameter is validated and bounded: malformed coordinates return `400`, and a bbox whose area exceeds `MAX_BBOX_SQ_KM` (default 50,000) returns `400` with code `BBOX_TOO_LARGE` rather than attempting a full-table scan.
- [ ] Coordinates are rounded to 5 decimal places (~1 m) in the response payload, and a comment or doc note records that this is a deliberate payload-size and privacy choice rather than a precision bug.

## Out of scope

- Any client, map, marker rendering, or refresh loop — Sprint 2 (201, 203).
- WebSockets, SSE, or any push transport. Sprint 1 is polling only; a push upgrade is a later ticket if measurement justifies it.
- Arrival-time and departure-board endpoints — 107 owns arrival estimates; stop departures surface in Sprint 2/3.
- Authentication, per-client rate limiting, and bot protection — Sprint 8 (804). The endpoint is public and unauthenticated for now.
- Vehicle history/replay endpoints for staff — Sprint 7.

## Dependencies

- **Blocks:** 199
- **Blocked by:** 103, 104, 105
- **External:** agreement with whoever builds Sprint 2 on the response shape before it is frozen; a decision on whether internal fleet `vehicle_id`s may be exposed publicly, or whether they need an opaque stable alias.

## Approach (optional)

One SQL query per request against `vehicle_positions_servable` with an `ST_Intersects` on the GIST index — no ORM, no N+1 join per vehicle for headsigns. Join `trips`/`routes` from the active GTFS feed version (102) for `headsign` and route metadata, and consider caching that lookup in process memory keyed by `feed_version_id` since it changes only on re-import. Compute `age_seconds` in SQL from `feed_timestamp` so the client and server never disagree about clock skew. Implement as a Next.js App Router route handler on the Node runtime, and keep it free of any request-time work that could be done at ingest time.

## Notes / decisions log

- 2026-07-19 — Ticket written during initial roadmap population. No implementation decisions yet.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
