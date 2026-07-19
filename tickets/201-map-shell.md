# Ticket 201: Map Shell, Tiles, and Controls

**Sprint:** 2 — Live Map Surface
**Status:** Done
**Owner:** Cursor
**Estimate:** M

---

## Context

Sprint 1 produces trustworthy vehicle and timetable data but no customer-facing surface at all. This ticket lands the container everything else in Sprint 2 mounts into: a MapLibre GL JS instance, a Stadia Maps basemap tuned so that route lines and vehicles are the most salient things on screen, and the chrome around it. We are explicitly replicating [ember.to](https://www.ember.to) — full-bleed rounded-corner map panel, muted blue-grey water and pale low-saturation land, a black `● LIVE` pill top-left, and a vertical control stack top-right (geolocate, zoom in, zoom out, compass reset). Getting the map instance, style contract, and layer-id conventions right once here is what stops 202–208 each inventing their own.

## Goal

A `<MapShell>` component renders a full-bleed, correctly-attributed Stadia basemap with the ember.to control stack and a `LIVE` badge slot, exposing a stable map instance and layer-ordering contract that later tickets attach sources and layers to.

## Acceptance criteria

- [x] `components/map/MapShell.tsx` mounts a MapLibre GL JS map into a container that fills its parent, has `border-radius: 12px` and `overflow: hidden`, and resizes correctly via `ResizeObserver` (no stale canvas after a window or panel resize).
- [x] The basemap style is fetched from Stadia Maps with the API key injected server-side — the key is read from `STADIA_API_KEY` and never appears in client bundle source; verified by `grep -r "$STADIA_API_KEY" .next/static` returning nothing.
- [x] The style is `alidade_smooth` (or a documented equivalent) with a committed style-override JSON that desaturates land/water fills; the diff is recorded in this ticket's decisions log with the reason.
- [x] Empty layer slots exist and are documented in `components/map/layerOrder.ts` in bottom-to-top order: `basemap` → `routes-line-casing` → `routes-line` → `stops-circle` → `vehicles-marker` → `overlay-ui`. Later tickets insert using `map.addLayer(spec, beforeId)` against these ids, never bare `addLayer`.
- [x] The control stack renders top-right as a single vertical group with 44×44 CSS px hit targets: geolocate/crosshair, zoom in (`+`), zoom out (`−`), compass/bearing reset. The compass control rotates to reflect bearing and resets bearing and pitch to 0 on activation.
- [x] `components/map/LiveBadge.tsx` renders a black pill, top-left, with a blue status dot and the text `LIVE`; it accepts a `state` prop (`live | delayed | timetable | offline`) and its non-live states are stubbed but reachable via Storybook or a prop override — the honest-degradation behaviour itself is Ticket 206.
- [x] Attribution renders bottom-right reading `© Stadia Maps © OpenMapTiles © OpenStreetMap`, is present on first paint (not injected after tile load), and is not clipped or overlapped at the 375 px breakpoint.
- [x] The map reaches first interactive paint in under 2.5 s on a simulated Fast 3G / 4× CPU throttle profile, and MapLibre is code-split so it is not in the initial document JS payload.

## Out of scope

- Any route, stop, or vehicle data rendering — that is 202, 203, and 205.
- The real freshness state machine driving the badge — 206.
- Marketing copy page ("Track your bus in real-time", "View the live map ›") — copy lives with the marketing surface, not the map component.
- Offline/service-worker tile caching.

## Dependencies

- **Blocks:** 202, 203, 299
- **Blocked by:** 101, 199
- **External:** Stadia Maps account, API key, and domain allowlist configured for both preview and production origins; sign-off on the desaturated basemap palette against the ember.to reference screenshot.

## Approach (optional)

Server component fetches/proxies the style JSON so the key stays server-side; a thin client component owns the MapLibre instance in a ref and exposes it through a `MapContext`. Build our own control components rather than using MapLibre's default `NavigationControl`/`GeolocateControl` CSS — the ember.to stack is a single rounded group and restyling the defaults fights their DOM. Keep the controls calling `map.zoomIn()`, `map.easeTo({bearing:0,pitch:0})`, and the Geolocation API directly.

## Notes / decisions log

- 2026-07-19 — Ticket written during initial roadmap population. No implementation decisions yet.
- 2026-07-19 — **Key strategy (ADR 0005 option b):** origin proxy. Browser loads `/api/map/style` and `/api/map/stadia/*` only; `STADIA_API_KEY` stays server-side (never `NEXT_PUBLIC_`).
- 2026-07-19 — **Basemap:** Stadia `alidade_smooth` with paint overrides in `components/map/styleOverrides.json` (muted blue-grey water `#c5d4de`, pale desaturated land) so routes/vehicles stay salient — ember.to-inspired, not a pixel clone.
- 2026-07-19 — **Storybook:** not in repo; non-live badge states via `/track?badge=delayed|timetable|offline`.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
