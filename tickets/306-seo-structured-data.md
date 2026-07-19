# Ticket 306: SEO, URLs, and Structured Data

**Sprint:** 3 — Routes, Stops, and Timetables
**Status:** Planned
**Owner:** unassigned
**Estimate:** S

---

## Context

`features.md` "Search and discoverability" asks for search-engine-friendly route and stop pages, structured page titles and metadata, human-readable URLs, indexable service information, structured data, redirect management when routes change, and social-sharing previews. For a bus operator this is not a marketing nicety: the overwhelming majority of passengers reach a transport site by searching "42 bus times" or a stop name, landing directly on a deep page. The sprint exit criteria require every route and stop to have a stable, human-readable, indexable URL — and *stable* is the hard part, because routes get renumbered, rerouted and withdrawn every timetable change, and GTFS `route_id`/`stop_id` values are not guaranteed stable across feed versions. Without deliberate slug and redirect management, every timetable change silently 404s the site's best-ranking pages. This ticket owns the slug table that 301 and 302 consume.

## Goal

Routes and stops have stable human-readable URLs backed by a slug registry with automatic redirect management, and every public page emits correct metadata and schema.org structured data.

## Acceptance criteria

- [ ] A `url_slugs` table (`entity_type`, `entity_id`, `slug`, `is_canonical`, `created_at`, `superseded_by`) is the single resolver for route and stop URLs; slugs are generated from human-readable fields (e.g. `42-city-centre-to-hospital`, `hospital-main-entrance-stop-a`), ASCII-transliterated, lowercase, hyphenated, and uniqueness collisions are resolved by appending the stop code or route ID.
- [ ] When a GTFS import changes a route's or stop's name, the existing slug row is marked non-canonical with `superseded_by` set to the new one, and requests to the old slug return HTTP 301 to the canonical URL; a test imports two feed versions and asserts the old URL still resolves via redirect.
- [ ] Feed-version reconciliation defines how an entity survives a changed GTFS ID using operator-maintained aliases and conservative matching signals; ambiguous matches are queued for review rather than guessed, and a fixture proves a stop ID change preserves its canonical URL.
- [ ] Withdrawn routes and removed stops return HTTP 410 Gone with an explanatory page listing replacement or nearby alternatives, rather than 404 or a redirect to the homepage; the entity is retained in `url_slugs` and excluded from the sitemap.
- [ ] Every route page emits schema.org `BusTrip` JSON-LD including `provider` (`Organization`), `departureBusStop` and `arrivalBusStop` as `BusStop` objects, and `busName`/`busNumber`; every stop page emits `BusStop` JSON-LD including `name`, `identifier` (the public stop code), and `geo` as `GeoCoordinates`.
- [ ] All emitted JSON-LD validates against the Schema.org Validator with zero errors, and a CI test asserts the JSON-LD block on a route page and a stop page parses and matches a committed schema fixture.
- [ ] Each page type has a distinct templated `<title>` and `<meta name="description">` (e.g. `Route 42 — City Centre to Hospital | Bus Times & Live Map`), a self-referencing `<link rel="canonical">`, and Open Graph plus `twitter:card` tags producing a valid preview for route, stop, and journey-plan pages.
- [ ] `GET /sitemap.xml` is generated from the canonical slug set with `<lastmod>` from the GTFS import timestamp, splits into indexed child sitemaps above 45,000 URLs, and `GET /robots.txt` references it, allows route/stop/timetable pages, and disallows `/api/`, `/plan` result URLs with query strings, and any account or admin path.
- [ ] Journey-planner result URLs (`/plan?...`) carry `<meta name="robots" content="noindex,follow">` so the crawler is not fed an unbounded query-parameter space, while `/plan` itself is indexable.

## Out of scope

- Internal whole-site search — 706 indexes the public content after help and CMS exist.
- Staff-editable SEO titles and descriptions — 703 owns the CMS field; this ticket ships the generated defaults and the interface for overriding them.
- Analytics, Search Console integration, and ranking measurement (705).
- Multilingual URLs and `hreflang` — explicitly a later enhancement in `features.md`.

## Dependencies

- **Blocks:** 301, 302, 304, 399
- **Blocked by:** 102, 300
- **External:** confirmed public domain and canonical host; operator's registered business name, logo, and contact details for the `Organization` structured data and local-business accuracy.

## Approach (optional)

Slug generation runs as a step of the 102 GTFS import, not at request time, so slugs are deterministic and diffable per feed version and a bad rename is visible in a migration rather than discovered by a crawler. Resolution is a single indexed lookup on `slug`, returning canonical/superseded/gone so the page component can branch to 200/301/410 in one place — build it as one `resolveSlug()` helper both 301 and 302 call. Keep the JSON-LD builders as pure functions over the same data the page already fetched, so structured data cannot drift from visible content (which is also what Google requires).

## Notes / decisions log

- 2026-07-19 — Ticket written during initial roadmap population. No implementation decisions yet.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
