# Ticket 207: Shareable Tracking Links

**Sprint:** 2 — Live Map Surface
**Status:** Not started
**Owner:** unassigned
**Estimate:** S

---

## Context

`features.md` calls for "shareable tracking links for specific buses or journeys", and the sprint exit criteria require that a shared link "opens on the right vehicle or journey". The real-world use is someone texting "I'm on this one" to whoever is collecting them — which means the link must survive being pasted into a messaging app, must render a useful preview card there, and must not break when the vehicle it points at has finished its trip an hour later. Vehicle ids are ephemeral; a link keyed only on a live `vehicle_id` is a link that 404s by dinner time. Choosing the durable identifier is the substance of this ticket.

## Goal

Map state — selected vehicle, selected stop, and viewport — is encoded in a shareable URL that reopens the same view, degrades gracefully when the target is no longer live, and renders a rich preview when shared.

## Acceptance criteria

- [ ] Map state is reflected in the URL via `history.replaceState` (not a router navigation, so it never remounts the map): `/map?vehicle={id}&stop={id}&z={zoom}&c={lat},{lng}`, with coordinates rounded to 5 decimal places to keep URLs short.
- [ ] Selecting or dismissing a vehicle or stop updates the URL within 200 ms; viewport changes are debounced to 500 ms so a pan does not spam history.
- [ ] Loading `/map?vehicle={id}` selects that vehicle, opens the Ticket 204 panel, and eases the map to it before the first feed tick resolves — the shared link must not require the visitor to wait a poll interval to see anything.
- [ ] Vehicle links are keyed on `trip_id` (plus `service_date`) rather than the raw realtime `vehicle_id`, so the link identifies a journey that outlives a single feed session; the mapping is documented in the decisions log.
- [ ] A link whose target trip has ended or is not in the feed shows an explicit non-error state — "This journey has finished" or "This bus isn't currently being tracked" — with the route's other live vehicles offered, rather than a blank map, a spinner, or a 404 page.
- [ ] A "Share" affordance in the vehicle panel copies the URL via the Web Share API where available and falls back to clipboard copy with a confirmation toast; the copied URL is absolute and includes the production origin.
- [ ] `/map` generates per-target Open Graph and Twitter card metadata server-side — title including route number and destination, description including the destination and scheduled arrival — verified by pasting a link into a link-preview debugger.
- [ ] Shared URLs contain no personal data: no geolocation of the sharer, no session identifier, no account reference; asserted by a test over the generated URL parameters.

## Out of scope

- Short-link generation or a redirect service.
- Live-updating shared views for third parties beyond what the public map already offers ("follow my journey" with live ETA push is Sprint 4 territory).
- QR codes or printed links at stops.
- Deep links into native apps.

## Dependencies

- **Blocks:** 299
- **Blocked by:** 203, 204
- **External:** Production origin/domain confirmed so absolute share URLs and OG metadata point at the right host; decision on whether `trip_id` is stable across the operator's GTFS static republishes.

## Approach (optional)

Keep a small bidirectional serializer between map state and search params, applied once on mount and on every state change, with the map as the single source of truth — reading state back out of the URL continuously creates loops. Server-render the OG tags from the trip lookup so preview crawlers, which do not execute JS, still get a meaningful card.

## Notes / decisions log

- 2026-07-19 — Ticket written during initial roadmap population. No implementation decisions yet.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
