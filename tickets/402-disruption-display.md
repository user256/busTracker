# Ticket 402: Disruption Display Across Surfaces

**Sprint:** 4 — Service Alerts and Disruptions
**Status:** Planned
**Owner:** unassigned
**Estimate:** L

---

## Context

401 puts alerts in the database. That achieves nothing on its own: the failure mode this sprint exists to prevent is the one every transport site has — disruptions live on a "service updates" page that nobody visits, while the journey planner cheerfully offers a journey on a route that is suspended. `features.md` section 5 is explicit that alerts must fire *automatically during journey planning*, and the programme exit criteria state "disruption reaches passengers before they reach the stop". So this ticket is not a notices page; it is the work of pushing alerts into every surface where a passenger is making a decision: the planner results, route pages, stop pages, the live map, and — for major incidents — a site-wide banner. The hard part is relevance and restraint: an alert shown everywhere is an alert nobody reads.

## Goal

Every alert in the store surfaces automatically on the journey-planner results, route pages, stop pages, and the live map that it affects, with major incidents promotable to a site-wide banner.

## Acceptance criteria

- [ ] Journey-planner results (304) annotate each affected journey inline: any leg whose route, stop, or trip is covered by an active alert for that journey's travel time renders a disruption notice on the leg, and a journey whose leg is subject to an alert with effect `NO_SERVICE` is either excluded from results or shown with a `May not run` label — the chosen behaviour is configurable and its default recorded in the notes log.
- [ ] Alert matching against a planned journey is time-aware: an alert is applied only when its active period overlaps the leg's departure/arrival window, asserted by a test where the same journey planned for two different times yields a disrupted and an undisrupted result.
- [ ] Route pages (301) render active and upcoming alerts affecting the route in a slot above the timetable, ordered by severity then start time, each showing header, description, explicit date/time range, and cause/effect in plain language rather than raw GTFS-RT enum names (a mapping table for all `Cause` and `Effect` values ships with this ticket).
- [ ] Stop pages (302) render alerts affecting the stop, including route-level alerts for routes serving the stop, and a stop-closure alert (`effect = STOP_MOVED` or `NO_SERVICE` on the stop) replaces the live departures board with a prominent closure notice; it names and links a replacement only when 401 supplies the structured replacement relationship, otherwise it explicitly says no replacement information is available.
- [ ] The live map (201/203) shows a disruption indicator on affected route geometry and stop markers, using a text-labelled control or legend entry and not colour alone, with the alert readable via keyboard-accessible popup; the indicator disappears when the alert's active period ends without requiring a page reload.
- [ ] A site-wide banner renders on every page for alerts flagged as major (GTFS-RT `severity_level = SEVERE`, or a staff-set `is_major` flag from 401); the banner is dismissible per-session via a cookie or localStorage key, re-appears for a *different* major alert after dismissal, is announced with `role="status"`, and at most one banner shows at a time with severity then recency deciding.
- [ ] `GET /service-updates` lists all current alerts grouped by route with filters `?route=`, `?from=`, `?to=`, and `GET /service-updates/archive` lists resolved alerts from the last 90 days — satisfying the notice-archive requirement without polluting the current view.
- [ ] All disruption surfaces pass axe-core with zero serious or critical violations, convey severity by text label as well as colour, and a test asserts alert display adds no more than 100 ms to the p95 of the route page, stop page, and `/api/plan`.

## Out of scope

- Ingesting or authoring alerts — 401 owns both write paths.
- Outbound push, email, and SMS delivery of alerts — 403.
- Alerts shown during ticket purchase — 507 integrates this ticket's matcher once checkout exists.
- Predictive disruption modelling and automated compensation, per the sprint's stated exclusions.

## Dependencies

- **Blocks:** 499, 507
- **Blocked by:** 201, 301, 302, 304, 401
- **External:** operator sign-off on the plain-language wording for each GTFS-RT cause/effect value, and on the threshold and approval path for promoting an incident to the site-wide banner.

## Approach (optional)

Build one `getAlertsFor({ routeIds, stopIds, tripIds, window })` resolver over 401's tables and have all five surfaces call it — the temptation to write a bespoke query per surface is exactly how a stop page and the planner end up disagreeing about whether a route is running. Fetch alerts server-side in the same render pass as the page data so there is no flash of undisrupted content; the map is the exception and polls alongside the vehicle refresh loop. For the planner, resolve alerts once per result set over the union of all legs' entities rather than per leg, or the p95 budget from 304 will not survive. The banner should be a Server Component in the root layout with a short cache TTL rather than a client fetch on every page.

## Notes / decisions log

- 2026-07-19 — Ticket written during initial roadmap population. No implementation decisions yet.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
