# Ticket 205: Stop Markers and Live Departures

**Sprint:** 2 — Live Map Surface
**Status:** Not started
**Owner:** unassigned
**Estimate:** M

---

## Context

Ticket 202 draws stop nodes as decoration on the route lines; this ticket makes them answer the question passengers actually arrive with — "when is the next bus from *here*". It is the other half of the tracker's utility: 203/204 serve someone waiting for a known bus, 205 serves someone standing at a stop. It also produces the departure-board data structure that Ticket 208 reuses as the accessible non-map view, and that Sprint 3's stop pages (302) will render server-side, so the shape of the departures response is a contract worth getting right now rather than reshaping twice.

## Goal

Selecting a stop on the map shows a live departure board for that stop with clearly-labelled real-time and scheduled times.

## Acceptance criteria

- [ ] Stop nodes in the `stops-circle` layer are interactive above zoom 13: hover shows the stop name, click/tap or keyboard activation selects the stop and opens `components/map/StopDeparturesPanel.tsx`.
- [ ] `GET /api/stops/{stop_id}/departures?limit=10` returns the next departures with `route_short_name`, `headsign`, `scheduled_time`, `estimated_time`, `provenance` (`live | delayed | scheduled`), and `vehicle_id` where a real-time vehicle is matched.
- [ ] Each departure row shows a countdown ("in 4 min") for departures under 60 minutes away and a clock time beyond that; countdowns recompute on the shared feed tick, not on a per-row timer.
- [ ] Departures with `provenance: scheduled` are visibly and textually distinguished from live ones — the row carries the word `Scheduled`, uses the same classifier module as Ticket 204, and no departure is ever presented as live without a real-time source behind it.
- [ ] A departure with a matched `vehicle_id` links to that vehicle: activating it selects the vehicle, opens the panel from Ticket 204, and pans the map to it.
- [ ] Stops within ~15 m of each other (paired stops on opposite sides of a road) render as separate selectable nodes and do not overlap into an unclickable blob at zoom 13–15; verify at a known paired-stop location.
- [ ] A stop with no departures in the next 2 hours shows an explicit empty state naming the reason ("No more departures today" vs "No live data for this stop") rather than an empty list.
- [ ] The departures response is cached at the edge for no more than 20 s and carries a `generated_at` timestamp that the panel renders as "Updated {n}s ago".

## Out of scope

- Full stop pages with complete timetables and accessibility info — Sprint 3 (302, 303).
- Nearby-stops search by geolocation or postcode — 305.
- Departure alerts or notifications — Sprint 4 (403).
- Stop clustering at low zoom.

## Dependencies

- **Blocks:** 208, 299
- **Blocked by:** 107, 202
- **External:** Confirmation that GTFS `stops.txt` carries usable public-facing stop names (not internal codes) for the whole network.

## Approach (optional)

Build the departures endpoint over the arrival-estimate view from Ticket 107 rather than re-joining `stop_times` in the UI layer. Query interaction should use `map.queryRenderedFeatures` against `stops-circle` rather than DOM markers, so stop interactivity costs nothing when the layer is hidden below zoom 13.

## Notes / decisions log

- 2026-07-19 — Ticket written during initial roadmap population. No implementation decisions yet.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
