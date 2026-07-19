# Ticket 302: Stop Pages

**Sprint:** 3 — Routes, Stops, and Timetables
**Status:** Planned
**Owner:** unassigned
**Estimate:** M

---

## Context

Sprint 2 put stop markers and a live departures popup on the map (205), but a popup is not a page: it cannot be linked to from a search engine, bookmarked as "my stop", printed, or read comfortably by a screen reader at the bus shelter. `features.md` section 6 requires each stop to expose its name and unique stop code, map location and directions, live departures, the routes serving it, accessibility information, nearby stops and interchange information, facilities, and relevant disruption notices. There are typically far more stops than routes, so this is the largest set of pages on the site and the one most exposed to GTFS data gaps — many feeds carry no `wheelchair_boarding` or facilities data at all, and the page must say "not known" rather than imply "not accessible".

## Goal

Every stop in the GTFS feed has a server-rendered page showing live departures, the routes serving it, accessibility and facility information, and nearby interchange options.

## Acceptance criteria

- [ ] `GET /stops/[slug]` renders a page for every stop in `stops.txt` with `location_type=0`; the slug resolves via 306's slug table, the stop's public `stop_code` is displayed prominently, and a legacy `GET /stops/[stop_id]` request 301-redirects to the slug URL.
- [ ] A live departures board lists the next 10 departures with route number, destination, scheduled time, and — where a TripUpdate exists from 107 — an estimated time explicitly labelled `Expected HH:MM (N min late)`; scheduled-only rows are labelled `Scheduled` and never presented as live.
- [ ] The departures board refreshes at most every 30 seconds without a full page reload, shows a `Last updated HH:MM:SS` timestamp, and switches to a `Live times unavailable — showing timetable` state when the realtime API errors or returns data older than the 206 staleness threshold.
- [ ] The page lists every route serving the stop, linking to the 301 route page, and shows the first and last departure of the day per route for the currently active service calendar.
- [ ] Accessibility information renders from GTFS `wheelchair_boarding` with three distinct, colour-independent, text-labelled states — `Step-free access`, `No step-free access`, `Accessibility not known` — where value `0` or null maps to `Accessibility not known`.
- [ ] Nearby stops are listed with walking distance in metres and bearing, computed with a PostGIS `ST_DWithin` query over a 400 m radius ordered by `ST_Distance` on `geography`, excluding the current stop and capped at 8 results.
- [ ] A facilities block (shelter, seating, lighting, real-time display) renders from an operator-editable `stop_facilities` table keyed on `stop_id`, defaulting to "no information" when no row exists; a seed migration and the table schema ship with this ticket.
- [ ] The page shows the stop on a labelled map plus a plain-text location fallback and a "Directions" link to an operator-approved mapping destination; the external hand-off includes only the stop coordinates/name, never the passenger's location, and remains usable when map tiles fail.
- [ ] The page passes axe-core with zero serious or critical violations, the departures board is announced to screen readers via `aria-live="polite"` on update, and it remains usable at 400% browser zoom on a 320 px viewport (WCAG 2.2 AA 1.4.10 reflow).

## Out of scope

- Staff UI for editing `stop_facilities` — this ticket ships the table and seed data only; 703 owns the CMS.
- Disruption notices on the page — 402 fills the slot this ticket reserves.
- Favouriting a stop or personalised default stop (needs accounts, Sprint 6).
- Postcode and geolocation entry points into stop pages — that is 305.

## Dependencies

- **Blocks:** 304, 305, 399, 402, 706
- **Blocked by:** 102, 205, 300, 303, 306
- **External:** GTFS static feed with `stop_code` populated; operator-supplied facilities data (shelter/seating/lighting) — page must ship and degrade correctly without it.

## Approach (optional)

Server Components with the departures board as a client island hitting a `GET /api/stops/[id]/departures` endpoint that joins `stop_times` for the active service day against 107's TripUpdate estimates. Do the service-day resolution in SQL, not JS, so the 24:00+ GTFS time convention is handled in one place. Pre-render the top few hundred stops by departure volume and render the long tail on demand; the whole set is too large to build eagerly. Nearby stops should be a materialised adjacency table refreshed on GTFS import rather than a live spatial query per request, if the request-time query misses the latency budget.

## Notes / decisions log

- 2026-07-19 — Ticket written during initial roadmap population. No implementation decisions yet.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
