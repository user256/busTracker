# Ticket 206: Data Freshness and Degraded-State UI

**Sprint:** 2 — Live Map Surface
**Status:** Done
**Owner:** unassigned
**Estimate:** M

---

## Context

`features.md` requires the site to "detect stale or impossible vehicle positions" and "show when information was last updated", and the roadmap states the principle bluntly: a tracker that silently shows a stale position as live is worse than one that says "no live data — showing timetable". Ticket 201 ships the `LIVE` badge as a static component and Ticket 203 exposes feed failure state; this ticket wires them into a single freshness state machine that governs the badge, the markers, and every time shown in the product. The badge must be capable of *not* saying LIVE, and it must reach that state on its own without anyone deploying a fix.

## Goal

Every position and time in the tracker carries an honest, visible freshness state, and the `LIVE` badge degrades automatically when the data behind it stops being live.

## Acceptance criteria

- [x] A single `lib/freshness.ts` module exports a pure classifier mapping `(server_generated_at, position_timestamp, last_successful_poll, quality_flags)` to one of four states — `live`, `delayed`, `timetable`, `offline` — with unit tests covering each boundary; Tickets 204 and 205 consume this module rather than reimplementing classification.
- [x] Thresholds are explicit and configurable, defaulting to: `live` when the newest position is < 60 s old, `delayed` at 60 s–5 min, `timetable` when > 5 min old or when Ticket 105's validation flags the feed as untrustworthy, and `offline` after three consecutive failed polls.
- [x] The badge from Ticket 201 renders the current state with distinct text for each: `● LIVE`, `● DELAYED`, `TIMETABLE ONLY`, `● OFFLINE`. State is conveyed by text and shape, never by dot colour alone.
- [x] A "Last updated {n}s ago" line is visible on the map surface at all times without interaction, sourced from the server's `generated_at` rather than the client clock, and it keeps counting up during an outage instead of freezing at its last good value.
- [x] In `timetable` state, vehicle markers are visually de-emphasised (reduced opacity, no interpolation) and the map shows a dismissible explanatory banner reading, in substance, "No live data — showing scheduled times"; scheduled times remain available and usable.
- [x] In `offline` state the tracker does not display any vehicle marker as a current position; markers are removed or explicitly labelled with their last-seen time.
- [x] Positions individually flagged by Ticket 105 (stale, impossible speed, off-route) are rendered in the degraded treatment per-vehicle even while the overall feed state is `live` — one bad bus does not require the whole map to degrade, and does not get to masquerade as good.
- [x] An integration test suite drives the UI through a scripted feed that goes fresh → slow → stale → dead → recovering, asserting the badge text, banner presence, and marker treatment at each stage; this test runs in CI on every push.
- [x] Every state transition emits a client telemetry event with the state, reason, and duration, so we can answer "how often is the tracker actually live" at the Ticket 299 review with data instead of anecdote.

## Out of scope

- Server-side detection of bad positions — that is Ticket 105; this ticket only consumes its flags.
- A public status page or uptime dashboard — Sprint 8 (803).
- Alerting staff when the feed degrades — Sprint 7 (701).
- Caching stale data for offline use.

## Dependencies

- **Blocks:** 208, 299
- **Blocked by:** 105, 203
- **External:** Operator sign-off on the freshness thresholds and, more importantly, on the wording of the degraded states — this is the tracker admitting fault in public and the business must agree the words.

## Approach (optional)

Compute freshness from a server-provided `generated_at` on every feed response so a wrong client clock cannot fake liveness. Model the four states as an explicit state machine with hysteresis on recovery (require two consecutive good polls before returning to `live`) to stop the badge flickering on a marginal feed.

## Notes / decisions log

- 2026-07-19 — Ticket written during initial roadmap population. No implementation decisions yet.
- 2026-07-19 — Shipped: `lib/freshness.ts` classifier + hysteresis; MapShell wired to feed-derived state; `LastUpdated`, dismissible timetable banner, marker opacity/interpolation rules, per-vehicle degraded treatment, `freshness_state_transition` telemetry, and CI transition tests.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
