# Ticket 401: GTFS-Realtime Service Alerts Ingest

**Sprint:** 4 — Service Alerts and Disruptions
**Status:** Planned
**Owner:** unassigned
**Estimate:** M

---

## Context

Sprints 1 and 2 ingest VehiclePositions and TripUpdates; the third GTFS-Realtime feed type, ServiceAlerts, is the one that carries "the 42 is diverted", "Market Street stop is closed", and "no service after 18:00 due to flooding". `features.md` section 5 requires planned service changes, real-time delays, cancellations and diversions, stop closures and temporary replacement stops, route-specific notices, and explicit date and time ranges for each disruption. Crucially the sprint exit criteria require alerts to be *authored by staff* as well as ingested from the feed — most operators publish planned roadworks and diversions by hand long before any automated system knows about them, and controllers need to post an incident notice in seconds without waiting for a feed round-trip. This ticket builds the store and both write paths; 402 and 403 consume it.

## Goal

Service alerts from the GTFS-Realtime ServiceAlerts feed and from staff authoring land in one normalised, queryable store with explicit affected entities and active time ranges.

## Acceptance criteria

- [ ] A worker polls the operator's GTFS-RT ServiceAlerts feed on a configurable interval (default 60 s), decodes the protobuf, and writes a stable alert record plus immutable material revisions keyed by `(feed_name, entity_id, alert_version)`, reusing the poller/retry/backoff infrastructure from 104; reuse of an entity ID after resolution cannot overwrite the archive.
- [ ] The schema stores GTFS-RT `cause`, `effect`, `severity_level`, `header_text`, `description_text`, `url`, and one row per `active_period` with explicit `starts_at`/`ends_at` timestamps (a null `ends_at` meaning open-ended and rendered as "until further notice", never as "no end date" or a blank).
- [ ] Affected entities are normalised into an `alert_informed_entities` table resolving GTFS-RT `informed_entity` selectors — `route_id`, `stop_id`, `trip_id`, `agency_id`, and `direction_id` — to local IDs, with unresolvable selectors recorded and surfaced as a data-quality warning through the 105 channel instead of being dropped silently.
- [ ] `GET /api/alerts?route=<id>&stop=<id>&at=<ISO8601>&severity=<level>` returns currently-or-then-active alerts for the given filters as JSON `{ alerts: [{ id, source, cause, effect, severity, header, description, url, activePeriods, affects: { routes, stops, trips }, updatedAt }] }`, defaulting `at` to now, validated against a committed JSON Schema.
- [ ] Staff-authored alerts are written through the same tables with `source = "staff"`, carry an author identity, explicit revision, created/updated timestamps, optional structured closed-stop/replacement-stop relationship, and a `is_major` flag; a staff alert covering the same entity as a feed alert remains separate after the next poll.
- [ ] Alerts absent from two consecutive successful feed polls are marked `resolved_at` rather than deleted, and a resolved alert stops being returned by the active query but remains retrievable by ID, preserving the notice archive `features.md` asks for.
- [ ] Feed decode failures, schema-invalid entities, and poll failures are logged with the feed timestamp and entity ID and increment a counter; a totally failing alerts feed leaves previously ingested alerts intact and marks the feed stale rather than clearing the table.
- [ ] An integration test replays a captured protobuf fixture containing route-level, stop-level, trip-level, and multi-period alerts and asserts the resulting rows and the `/api/alerts` responses at three different `at` timestamps (before, during, and after an active period).

## Out of scope

- Any display of alerts on customer-facing surfaces — that is 402.
- Subscriptions and outbound notification delivery — 403.
- The staff authoring UI and approval workflow — 406 consumes this ticket's authenticated API and 400's identity/audit foundation.
- Predictive or automated disruption detection from vehicle positions — explicitly out of scope for this sprint.

## Dependencies

- **Blocks:** 402, 403, 406, 499
- **Blocked by:** 102, 399, 400
- **External:** operator GTFS-RT ServiceAlerts feed URL and credentials, plus a captured sample containing real alerts (a feed that is empty in testing proves nothing); confirmation of whether the operator currently publishes planned works through the feed or only manually.

## Approach (optional)

Reuse the 104 poller shape: fetch, decode, validate, upsert in a transaction, record feed timestamp. The one genuinely tricky part is entity resolution — GTFS-RT selectors are sparse and a route-only selector means "all trips on this route", which must expand at *query* time, not ingest time, or the join table explodes and goes stale as trips change. Keep `alert_informed_entities` as the sparse selector and resolve at query time with an index-friendly OR over route/stop/trip. Model staff alerts as first-class rows in the same table with a `source` discriminator rather than a parallel table, so 402 has exactly one thing to query.

## Notes / decisions log

- 2026-07-19 — Ticket written during initial roadmap population. No implementation decisions yet.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
