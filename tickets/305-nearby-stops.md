# Ticket 305: Nearby Stops, Geolocation, and Postcode Search

**Sprint:** 3 — Routes, Stops, and Timetables
**Status:** Planned
**Owner:** unassigned
**Estimate:** M

---

## Context

`features.md` section 1 requires passengers to find nearby stops using location permission or postcode. This is the entry point to everything else in the sprint: most passengers do not know their stop's name or code, they know where they are standing. It is also the input layer the journey planner depends on — 304 accepts `from`/`to` as a stop ID, a coordinate pair, or a postcode, and something has to turn the latter two into stops. Doing this well means being careful about two things: geolocation permission must be requested only in response to a user action and the site must stay fully usable when it is denied, and postcode geocoding is a paid third-party dependency that must be cached and must fail visibly rather than silently returning nothing.

## Goal

A passenger can find the stops nearest to them by granting location permission, entering a postcode, or typing a place name, and reach a stop page or a planner search from the result.

## Acceptance criteria

- [ ] `GET /nearby` renders a stop-finder page with a location button, a postcode/place text input, and a results list; the page is fully usable with JavaScript disabled via a form-submitted postcode search, and renders no results-shaped placeholder before a query is made.
- [ ] `GET /api/stops/nearby?lat=<float>&lon=<float>&radius=<metres>&limit=<int>` returns stops ordered by true distance using a PostGIS `ST_DWithin` + `ST_Distance` query on a `geography(Point,4326)` column with a GiST index, defaulting to `radius=800` and `limit=10`, clamping `radius` to 2000 and `limit` to 50, and returning HTTP 400 on out-of-range or non-numeric coordinates.
- [ ] Each result shows stop name, stop code, straight-line distance in metres, compass bearing, and the route numbers serving it, and links to the 302 stop page.
- [ ] The browser Geolocation API is invoked only from an explicit user gesture; permission denial, timeout, and unavailability each render a distinct, named message with the postcode input focused as the fallback path, and no error is written to the console as the only user-visible signal.
- [ ] `GET /api/geocode?q=<string>` resolves postcodes and place names to coordinates via the chosen provider, restricted to the operator's region by a configured bounding box, returning `{ query, lat, lon, label, source: "cache"|"provider" }` or HTTP 404 with `{ error: "not_found" }` for an unresolvable query.
- [ ] Geocode results are cached in Postgres with a configurable TTL (default 30 days) keyed on the normalised query string, and a test asserts a repeated identical query issues exactly one upstream provider call.
- [ ] Provider failure (timeout, 5xx, quota exhaustion) surfaces as an explicit "Postcode lookup is temporarily unavailable — search for a stop by name instead" message with a working stop-name search fallback, and never returns a silently empty result list.
- [ ] The results list is keyboard-navigable, updates are announced via `aria-live="polite"`, distance is exposed as text and not by icon alone, and the page passes axe-core with zero serious or critical violations.

## Out of scope

- Reverse geocoding a coordinate to a human-readable address for display beyond the stop name.
- Storing or logging a passenger's location beyond the request that used it — collect only what is needed (`features.md` privacy line); persistent location history is explicitly not built.
- Map-based stop browsing — that already exists as 201/205 on the tracker.
- Saved or favourite stops (accounts, Sprint 6) and turn-by-turn walking directions to the stop.

## Dependencies

- **Blocks:** 304, 399
- **Blocked by:** 102, 201, 300
- **External:** geocoding provider account, API key, and quota (candidate: the OS/national postcode service for the operating region, or the tile provider's geocoding API) — the provider choice must be recorded as an ADR before implementation; regional bounding box confirmed with the operator.

## Approach (optional)

Keep geocoding server-side only so the provider key is never shipped to the browser and the cache is shared across all users. Normalise postcodes (uppercase, single internal space) before cache lookup so `sw1a1aa` and `SW1A 1AA` hit the same row. Nearby-stop search should reuse the same PostGIS query the 302 nearby-stops block uses — one query, two call sites. Progressive enhancement is the design constraint that decides the layout here: build the no-JS postcode form first, then layer the geolocation button and live results onto it.

## Notes / decisions log

- 2026-07-19 — Ticket written during initial roadmap population. No implementation decisions yet.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
