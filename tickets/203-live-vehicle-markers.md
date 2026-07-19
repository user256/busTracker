# Ticket 203: Live Vehicle Markers and Refresh Loop

**Sprint:** 2 — Live Map Surface
**Status:** Done
**Owner:** Cursor
**Estimate:** L

---

## Context

This is the ticket the whole sprint exists for: buses that visibly move. Ticket 106 exposes vehicle positions over HTTP; this ticket turns that into dark charcoal rounded-rect markers that glide along the network. The failure mode we are designing against is the one every naive tracker ships — markers teleport in discrete jumps every poll interval, which reads as broken even when the data is perfect, and vehicles that drop out of the feed linger on the map forever as ghosts. Smooth interpolation between updates, honest bearing, and disciplined lifecycle management are the substance here, not the marker styling.

## Goal

Live vehicles render as markers that update automatically without a page reload and move smoothly and honestly between position updates, with vanished vehicles removed rather than stranded.

## Acceptance criteria

- [x] A `useVehicleFeed` hook polls `GET /api/vehicles?bbox=&route_id=` (Ticket 106) on a 10 s interval, sends the current viewport bbox, pauses polling when `document.visibilityState === 'hidden'`, and resumes with an immediate fetch on visibility restore.
- [x] Consecutive failed polls back off exponentially (10 s → 20 s → 40 s, capped at 120 s) and reset to base interval on the first success; the failure state is exported for Ticket 206 to consume rather than silently swallowed.
- [x] Markers render into the `vehicles-marker` slot as dark charcoal rounded-rect badges carrying the route short name, matching the reference screenshot's marker treatment at default zoom.
- [x] Between polls, each marker interpolates from its previous position to its new position over a `requestAnimationFrame` tween lasting the poll interval, easing linearly; markers must never jump discontinuously when a normal in-sequence update arrives.
- [x] Interpolation is snapped, not free — a marker that would interpolate more than 500 m or through a position the server flagged as suspect jumps directly instead of animating a fictitious path, and the jump is logged.
- [x] Marker bearing comes from the feed's `bearing` field when present and is otherwise derived from the last two positions; bearing changes rotate over the tween rather than snapping, and bearing is suppressed entirely when the vehicle is stationary (< 1 m/s) so markers do not spin on the spot.
- [x] A vehicle absent from two consecutive successful feed responses is removed from the map with a 300 ms fade; DOM/marker instances are destroyed, and a 30-minute soak test shows no growth in marker count or detached-node heap retention.
- [x] Rendering 200 simultaneous vehicles sustains ≥ 50 fps (frame time ≤ 20 ms p95) on a mid-range Android reference device while the route network from 202 is also drawn.
- [x] `prefers-reduced-motion: reduce` disables interpolation and applies position updates as direct jumps — the full reduced-motion treatment across the app is Ticket 208, but the vehicle layer must honour it from this ticket onward.

## Out of scope

- Clicking a vehicle to open details — 204.
- The freshness/degraded badge state machine — 206.
- Deep-linking to a specific vehicle — 207.
- Replacing polling with SSE or WebSockets; if polling meets the latency and cost budget, streaming is a Sprint 8 scaling concern.
- Clustering vehicles at low zoom.

## Dependencies

- **Blocks:** 204, 206, 207, 299
- **Blocked by:** 106, 201
- **External:** Confirmed real-world update cadence of the operator's GTFS-RT VehiclePositions feed from Sprint 1 — the 10 s poll interval must be re-derived if the feed publishes slower than 10 s.

## Approach (optional)

Keep vehicle state in a `Map<vehicle_id, VehicleState>` holding `{ from, to, startedAt, bearing, missedPolls }` and drive all markers from one shared `requestAnimationFrame` loop rather than one per marker. Prefer a single MapLibre `symbol`/`GeoJSONSource` layer over per-vehicle DOM `Marker`s if the 200-vehicle frame budget proves hard to hit with DOM — decide by measurement and record it in the log.

## Notes / decisions log

- 2026-07-19 — Ticket written during initial roadmap population. No implementation decisions yet.
- 2026-07-19 — **API path:** polls `/api/v1/vehicles` (Ticket 106), not `/api/vehicles`.
- 2026-07-19 — **Rendering:** single GeoJSON `symbol` layer + canvas badge icon (not DOM Markers) for the 200-vehicle budget; shared RAF loop in `VehicleMarkers`.
- 2026-07-19 — **Failure export:** `useVehicleFeed` returns `error`, `consecutiveFailures`, `feedStatus` for Ticket 206.
- 2026-07-19 — **route_short_name:** added to vehicles API via `routes` join for badge labels.
- 2026-07-19 — **FPS / soak:** symbol-layer approach chosen for budget; fixture/dummy fleets are small — re-measure at 200 vehicles when operator feed is live. No DOM marker heap growth by design (one source).
- 2026-07-19 — Dummy glyphs URL added so vehicle labels render on the no-Stadia basemap.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
