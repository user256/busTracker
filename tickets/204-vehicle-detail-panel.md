# Ticket 204: Vehicle Detail Panel

**Sprint:** 2 — Live Map Surface
**Status:** Not started
**Owner:** unassigned
**Estimate:** M

---

## Context

A dot on a map answers "where is a bus"; passengers need "is that *my* bus, and when does it reach *my* stop". This ticket adds the panel that opens when a vehicle is selected: route, destination, and the upcoming stop sequence with arrival estimates from Ticket 107. It is directly named in the sprint exit criteria ("a passenger can tap a bus and see its route, destination, and next stops"). The rule from `features.md` that matters most here is that estimates must never be dressed up as certainties — a predicted arrival and a scheduled departure must be visibly different things in the panel, not two rows of identical-looking times.

## Goal

Selecting a vehicle opens a panel showing its route, destination, live position context, and remaining stops with clearly-labelled predicted or scheduled times.

## Acceptance criteria

- [ ] Clicking or tapping a vehicle marker, or activating it via keyboard, opens `components/map/VehicleDetailPanel.tsx` and sets `selectedVehicleId` in map state; the marker renders a visible selected treatment distinguishable without relying on colour alone.
- [ ] The panel fetches `GET /api/vehicles/{vehicle_id}/trip` returning route short/long name, headsign/destination, `trip_id`, and the ordered remaining `stop_times` with arrival estimates sourced from Ticket 107.
- [ ] Each upcoming stop row shows the stop name and a time labelled with its provenance: `Live` (real-time estimate), `Delayed +Nm` where the estimate exceeds schedule by ≥ 2 minutes, or `Scheduled` (timetable only, no real-time data). Provenance is text plus icon, never colour alone.
- [ ] The panel refreshes on the same feed tick as Ticket 203's poll loop — no independent timer — and updates in place without collapsing or re-scrolling the stop list.
- [ ] Selecting a vehicle eases the map so the vehicle sits in the visible map area not occluded by the panel: on ≥ 1024 px the panel is a right-hand sidebar and the map applies a matching right `padding`; below 1024 px it is a bottom sheet at 45vh with a matching bottom `padding`.
- [ ] The panel is dismissible by an explicit close button, the `Escape` key, and (on the bottom sheet) a downward drag; dismissing clears `selectedVehicleId` and removes the deep-link parameter without a full navigation.
- [ ] If the selected vehicle disappears from the feed while the panel is open, the panel does not close silently — it shows "Live tracking lost for this bus — last seen {relative time}" and keeps the timetable view of remaining stops available.
- [ ] Panel content is a landmark region with `role="dialog"` on mobile and `aria-live="polite"` on the next-stop line, so a screen-reader user hears the next stop change without the whole list re-announcing.

## Out of scope

- Vehicle occupancy, accessibility features, or amenity data unless already present in the feed.
- Full route pages and complete timetables — Sprint 3 (301, 303).
- Journey planning from the selected vehicle — 304.
- Sharing the panel's state as a URL — 207.

## Dependencies

- **Blocks:** 207, 208, 299
- **Blocked by:** 107, 203
- **External:** Decision on the delay threshold that flips a stop from `Live` to `Delayed` (proposed: 2 minutes) — needs operator sign-off, as it sets passenger expectations.

## Approach (optional)

Treat the panel as a pure function of `(selectedVehicleId, feedTick)` so it has no fetch loop of its own. The `Live`/`Delayed`/`Scheduled` classifier should live in a shared, unit-tested module — Ticket 206 needs exactly the same classification for the global badge, and two implementations will drift.

## Notes / decisions log

- 2026-07-19 — Ticket written during initial roadmap population. No implementation decisions yet.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
