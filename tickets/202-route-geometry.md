# Ticket 202: Route Network Geometry Rendering

**Sprint:** 2 — Live Map Surface
**Status:** Not started
**Owner:** unassigned
**Estimate:** M

---

## Context

On the reference tracker the route network is the thing that makes the map read as *a bus map* rather than a generic basemap with dots on it: connected green polylines with small white-cored circular stop nodes threaded along them. Ticket 102 loads `shapes.txt` into PostGIS, so the geometry exists — this ticket turns it into a rendered network that stays cheap at every zoom level. Raw GTFS shapes are heavy (tens of thousands of points across a network, with near-total duplication where routes share corridors), so naive `GeoJSONSource` loading will blow the frame budget on mobile. Deciding the simplification and delivery strategy here, before vehicles are added on top, is the point.

## Goal

The full route network renders as green connected polylines with stop nodes, at every zoom level, within a fixed geometry payload and frame budget.

## Acceptance criteria

- [ ] `GET /api/routes/geometry` returns route shapes as GeoJSON `FeatureCollection` of `LineString`s, each feature carrying `route_id`, `route_short_name`, and `route_colour`, derived from the `shapes` table loaded by Ticket 102.
- [ ] Geometry is simplified server-side with Douglas–Peucker (PostGIS `ST_SimplifyPreserveTopology`) at a documented per-zoom tolerance; the simplified network payload is ≤ 300 KB gzipped for the full network, and the chosen tolerance ladder is recorded in the decisions log.
- [ ] Duplicate corridor segments are de-duplicated so a corridor served by four routes is drawn once, not four times overprinted (verify by inspecting rendered line opacity on a shared trunk section — no visible darkening).
- [ ] Two line layers render in the order defined by `layerOrder.ts`: `routes-line-casing` (wider, white/pale, ~6 px) beneath `routes-line` (green, ~3 px), both with `line-join: round` and `line-cap: round`, giving the connected-network look from the reference.
- [ ] `stops-circle` renders stop nodes as circles with a white fill and green stroke, radius interpolated by zoom (smaller when zoomed out), and stop nodes are hidden below zoom 11 so the network reads as clean lines at regional zoom.
- [ ] Panning and zooming the full network sustains ≥ 50 fps (frame time ≤ 20 ms p95) on a mid-range Android reference device; measured with the MapLibre frame timing or Chrome performance trace and the number recorded in the decisions log.
- [ ] The geometry response is cached with `Cache-Control: public, max-age=3600, stale-while-revalidate=86400` and is invalidated when a GTFS static import completes.
- [ ] Route colour comes from GTFS `routes.txt` `route_color` when present, falling back to the brand green; a route with a missing or unreadably-light colour does not render invisible against the pale basemap.

## Out of scope

- Per-route filtering, highlighting, or "show only route X" interactions — deferred to Sprint 3 route pages (301).
- Live vehicles on the line — 203.
- Stop click behaviour and departure boards — 205.
- Serving geometry as real vector tiles from a tile server; if the simplified GeoJSON meets the payload and frame budgets, we do not build tiling in this sprint.

## Dependencies

- **Blocks:** 205, 299
- **Blocked by:** 102, 201
- **External:** Confirmation from the operator that `shapes.txt` is populated for all in-service routes; agreement on the brand green hex used for route lines.

## Approach (optional)

Start with the simplest thing that can meet budget: precompute a simplified `FeatureCollection` at GTFS import time, store it as a materialised artefact, and serve it as one cached response. Only escalate to `tippecanoe`-generated vector tiles if the payload or frame budget fails — record that decision explicitly rather than reaching for tiles by default. Corridor de-duplication is easiest done at import time by segmenting shapes and hashing coordinate runs.

## Notes / decisions log

- 2026-07-19 — Ticket written during initial roadmap population. No implementation decisions yet.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
