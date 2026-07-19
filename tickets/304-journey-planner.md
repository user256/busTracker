# Ticket 304: Journey Planner Search

**Sprint:** 3 — Routes, Stops, and Timetables
**Status:** Planned
**Owner:** unassigned
**Estimate:** L

---

## Context

The journey planner is the feature `features.md` section 1 leads with and the one Sprint 8 names as highest-availability alongside active tickets and service alerts. It is also the hardest thing in this sprint: answering "how do I get from A to B leaving at 09:00 on Tuesday" over a GTFS feed is a real routing problem, not a database query. Naive approaches (find a route serving both stops; brute-force trip enumeration) fall over the moment a transfer is required or the passenger asks for a departure window rather than a single time. The exit criteria for this sprint require direct *and* transfer journeys, and require accessibility information to be visible during planning rather than on a separate page — which means accessibility has to be a first-class filter in the routing engine, not a post-hoc annotation on results.

## Goal

A passenger can enter an origin, destination, date and time and receive ranked, viable journeys — direct and with transfers — filtered by accessibility, number of changes, and departure window.

## Acceptance criteria

- [ ] `GET /plan?from=<stop_id|lat,lon|postcode>&to=<...>&date=YYYY-MM-DD&time=HH:MM&arriveBy=true|false` returns a server-rendered results page; every result is also linkable and shareable as that exact URL, and malformed or unresolvable `from`/`to` returns HTTP 400 with a named field error rather than an empty result set.
- [ ] `GET /api/plan` returns JSON `{ query, journeys: [{ id, departure, arrival, durationSeconds, transfers, legs: [{ type: "walk"|"bus", from, to, departure, arrival, routeId?, tripId?, headsign?, distanceMetres?, wheelchairAccessible: true|false|null }], accessible: true|false|null, walkingDistanceMetres }], diagnostics }` validated against a committed JSON Schema in CI.
- [ ] A RAPTOR round-based algorithm over the GTFS timetable returns journeys with 0, 1, 2, and 3 transfers when allowed, with the boarding/round relationship documented and the maximum configurable; fixture tests assert exact journeys requiring two and three transfers so `maxTransfers=3` is not an unsupported UI value.
- [ ] Results are Pareto-optimal on (arrival time, number of transfers) — no returned journey is both later-arriving and no fewer transfers than another — and at least 3 departure options are returned across the search window where they exist, with the window defaulting to 90 minutes from the requested time.
- [ ] Filters `maxTransfers=0|1|2|3`, `accessible=true`, and `maxWalkMetres=<int>` are applied as query params and reflected in the UI; strict `accessible=true` includes only legs positively marked accessible, offers a separate explicit "include unknown" choice, and states how many journeys were excluded so unknown data is never silently treated as accessible.
- [ ] Each returned leg shows accessibility status inline on the results page using the same three text-labelled, colour-independent states as 302 (`Step-free`, `Not step-free`, `Not known`), with unknown never rendered as accessible.
- [ ] Transfers respect a minimum transfer time: GTFS `transfers.txt` `min_transfer_time` where present, otherwise a configurable default (120 s same-stop, walking time at 1.3 m/s plus 60 s buffer between distinct stops within 400 m); a test asserts an impossible 30-second interchange is not offered.
- [ ] `p95` response time for `GET /api/plan` is under 800 ms on the full operator feed, measured by a committed load-test script over at least 200 realistic origin/destination pairs, with the measured figure recorded in this ticket's notes log.

## Out of scope

- Fares or prices shown at planning time — explicitly out of scope for Sprint 3; 506 extends the result contract from 501's authoritative quote rather than planner code computing a price.
- Multi-operator and multi-modal journeys (rail, tram, other operators' buses).
- Real-time-aware planning that reroutes around live delays — this ticket plans on the timetable; 402 surfaces disruptions against the planned journey, and live-aware replanning is a follow-up ticket if the review wants it.
- Saving or favouriting journeys — 602 stores the query/filter intent after accounts exist — and door-to-door street routing beyond straight-line walk legs to and from stops.

## Dependencies

- **Blocks:** 399, 402, 506
- **Blocked by:** 102, 300, 301, 302, 303, 305, 306
- **External:** geocoding provider for postcode and place-name resolution (shared with 305); confirmation from the operator of the default maximum walking distance and interchange buffer policy.

## Approach (optional)

Build RAPTOR over an in-memory timetable index loaded from Postgres at worker/app start and rebuilt on GTFS import — routes-by-stop, trips-by-route sorted by departure, and a footpath table from PostGIS `ST_DWithin`. RAPTOR is preferred over pgRouting here because it is natively time-dependent and multi-criteria on transfers, whereas a graph-expansion approach needs a time-expanded graph that grows with the number of trips and makes the transfer-count criterion awkward. Keep the index immutable and versioned so a feed reload swaps it atomically without serving half-old data. Accessibility should be a *filter on the label set during the round*, not a filter on final results, or the algorithm will discard accessible-but-slower journeys before they can be returned. If the p95 budget is missed, the escape hatch is precomputed transfer patterns, not micro-optimisation — record that decision if it is taken.

## Notes / decisions log

- 2026-07-19 — Ticket written during initial roadmap population. No implementation decisions yet.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
