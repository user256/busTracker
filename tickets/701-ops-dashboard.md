# Ticket 701: Real-Time Operations Dashboard

**Sprint:** 7 — Admin and Operations
**Status:** Planned
**Owner:** unassigned
**Estimate:** L

---

## Context

By the end of Sprint 4 the public site tells passengers where the buses are, but nobody inside the company has a view of the fleet that is any better than the passenger one. Controllers currently find out that a vehicle has dropped off the feed when a passenger complains. Sprint 1 already computes exactly the signals a controller needs — 105 flags stale, impossible, and off-route positions, 106 serves positions with their freshness, and 107 produces arrival estimates distinguishable from scheduled times — but those flags are currently used only to *suppress* bad data from the public map. This ticket surfaces them to the people who can act on them, and is the first staff-facing surface in the programme.

## Goal

A controller can open one page, see every active vehicle on a map with its data-quality state, and drill into any single vehicle's journey to compare scheduled against actual performance.

## Acceptance criteria

- [ ] `/admin/ops` renders a MapLibre map of all vehicles active in the last 30 minutes, refreshing every 10s without a page reload, and holds a p95 client-visible refresh latency under 1500ms with 400 concurrent vehicles in the viewport.
- [ ] Every vehicle marker carries an explicit, colour-independent data-quality state derived from the 105 flags — `live`, `stale` (no position for >120s), `off-route` (>150m from trip shape), `implausible` (speed or jump outside validation bounds), and `no-feed` (scheduled trip in progress with zero positions ever received) — rendered as a text label plus icon, never colour alone.
- [ ] A "Feed health" panel lists every trip that is scheduled to be running now but has no position in the last 120s, with block/trip ID, route, scheduled start, and time since last contact, sorted by staleness descending; the count matches a direct SQL query against the position store.
- [ ] A delay table lists vehicles whose current schedule deviation exceeds a configurable threshold (default +5 minutes), showing route, headsign, deviation in minutes, and the stop the deviation was measured at; entries update on the same 10s cycle.
- [ ] Clicking a vehicle opens a journey inspector showing that vehicle's ping trail for the current trip on the map, plus a stop-by-stop table of scheduled time, actual/estimated time, and deviation, with estimates explicitly labelled as estimates.
- [ ] The whole `/admin/*` tree is role-restricted: a session without the `ops_controller` or `ops_admin` role receives `403` from both the page and its APIs, and an unauthenticated request receives `401` — verified by an integration test hitting each ops endpoint with no role, a wrong role (`cs_agent`), and the correct role.
- [ ] Ops read APIs are served from a separate route namespace (`/api/admin/ops/*`) that is excluded from public caching and returns `Cache-Control: no-store`, so controllers never see a CDN-cached fleet state.
- [ ] Every dashboard view logs an access event (staff ID, view, filter parameters, timestamp) through the audit API defined in 400.

## Out of scope

- Authoring or publishing disruption notices from this dashboard — the ops surface links to the 402/703 publishing tools rather than duplicating them.
- Historical on-time-performance reporting and exports — that is 705. This dashboard is *now*, not *last month*.
- Vehicle scheduling, block reassignment, driver rostering, or any write-back to the operator's scheduling system.
- Staff identity, MFA, RBAC, and the audit contract — 400; this ticket must not invent replacements.

## Dependencies

- **Blocks:** 705, 799
- **Blocked by:** 105, 106, 107, 400, 402
- **External:** operator sign-off on the controller role definitions and on the delay threshold that counts as "actionable"; confirmation of how many vehicles are in the peak-hour fleet, to size the refresh loop.

## Approach (optional)

Reuse 106's viewport query rather than writing a second position reader; add an `include_flags=true` mode that returns the 105 quality flags instead of filtering the bad rows out. The "no-feed" list is the one genuinely new query — it is a left join from currently-active trips (GTFS calendar plus stop_times window) against latest positions, and it belongs in the database, not in the client. Poll on an interval rather than reaching for websockets; 10s over a small JSON payload is well inside budget and avoids a stateful tier before 802 has decided how the app scales.

## Notes / decisions log

- 2026-07-19 — Ticket written during initial roadmap population. No implementation decisions yet.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
