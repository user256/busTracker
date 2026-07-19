# Ticket 301: Route Pages

**Sprint:** 3 — Routes, Stops, and Timetables
**Status:** Planned
**Owner:** unassigned
**Estimate:** M

---

## Context

After Sprint 2 the only customer-visible surface is the live map, which is excellent for "where is my bus right now" and useless for "what is the 42 and where does it go". `features.md` section 6 specifies exactly what a route page must contain: description and destination, full stop sequence, timetable, live vehicles, fare information, route map, service frequency, and current/upcoming disruptions. These pages are also the main organic-search entry point for the whole site — most passengers will arrive from a search engine on a route or stop page rather than the homepage — so they must be server-rendered and indexable, not a client-side shell. All the data already exists in Postgres from 102; this ticket is about turning it into a page.

## Goal

Every route in the GTFS feed has a server-rendered page showing its description, direction-aware stop sequence, timetable, service frequency, route map, and any live vehicles currently running it.

## Acceptance criteria

- [ ] `GET /routes` renders an index of all routes with `route_short_name`, `route_long_name`, and destination, grouped by `route_type`, server-rendered and readable with JavaScript disabled.
- [ ] `GET /routes/[slug]` renders a route page for every active route in `routes.txt`; the slug is stable and human-readable (e.g. `/routes/42-city-centre-to-hospital`), resolved via the slug table owned by 306, and an unknown slug returns HTTP 404 with the site 404 page, not a 500.
- [ ] The page renders the full ordered stop sequence for each direction, driven by `?direction=0|1` (default `0`), with each stop linking to its stop page from 302 and timing points visually distinguished from intermediate stops.
- [ ] The route map renders the route's GTFS `shapes.txt` geometry using the MapLibre layer built in 202, with stop markers, and degrades to the stop-sequence list (no blank container, no layout shift) when the tile provider fails to load.
- [ ] Live vehicles currently assigned to trips on this route are shown from the 106 read API, refreshing without a page reload, and are labelled `Live`, `Delayed (last seen HH:MM)`, or `No live data — showing timetable` per the freshness rules from 206.
- [ ] Service frequency is computed from `stop_times` and displayed per service period as "every N–M minutes" for headway-based periods and as an explicit departure count for sparse periods, with the calculation covered by a unit test over a fixture feed.
- [ ] The page shows a fare summary block sourced from a single `lib/fares` stub module with a documented interface, and the slot/contract is explicitly handed to 506 for authoritative Sprint 5 pricing without changing page layout code.
- [ ] Lighthouse (mobile, throttled) scores >= 90 for Performance and 100 for Accessibility on a representative route page, and the page passes axe-core with zero serious or critical violations.

## Out of scope

- Real fare data, fare rules, or prices — this ticket ships a stub block; 501 owns pricing and 506 owns public integration.
- Disruption and alert banners on the page — 402 injects those into the slot this ticket leaves for it.
- Timetable table rendering itself, including calendar handling — that is 303; this page embeds the component 303 provides.
- Favouriting a route (requires accounts, Sprint 6) and printable/PDF timetables.

## Dependencies

- **Blocks:** 304, 399, 402, 506, 706
- **Blocked by:** 102, 202, 300, 303, 306
- **External:** GTFS static feed with populated `shapes.txt` and `route_long_name`; operator sign-off on the public-facing wording of route descriptions and destinations.

## Approach (optional)

Server Components fetching directly from Postgres, with `generateStaticParams` over the route table and ISR revalidation tied to the GTFS import version from 102 so a feed reload invalidates pages. Live vehicles are the only client component on the page — a small island polling the 106 endpoint — so the page is useful before hydration. Direction handling should read GTFS `direction_id` but fall back to deriving two directions from trip headsigns when the feed leaves `direction_id` null, which real feeds frequently do; log a data-quality warning through the 105 channel when that fallback fires.

## Notes / decisions log

- 2026-07-19 — Ticket written during initial roadmap population. No implementation decisions yet.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
