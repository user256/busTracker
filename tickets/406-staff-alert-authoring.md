# Ticket 406: Staff Alert Authoring Console

**Sprint:** 4 — Service Alerts and Disruptions
**Status:** Planned
**Owner:** unassigned
**Estimate:** M

---

## Context

Ticket 401 provides a write API, but 701 excludes alert authoring and 703 excludes GTFS-backed service alerts. Without a usable console, the roadmap's promise that staff can publish disruptions still requires a developer or API client.

## Goal

Authorized operations staff can create, preview, publish, update, and resolve service alerts with affected entities, replacement stops, severity, and explicit active periods.

## Acceptance criteria

- [ ] Staff with `alert_editor` can draft an alert using route, stop, trip, agency, and direction selectors, multiple active periods, cause/effect, severity, public wording, optional replacement stop, and major-banner flag.
- [ ] Preview shows the alert as it will appear on route, stop, map, planner, service-update, and banner surfaces before publication.
- [ ] Publish, material update, resolve, and scheduled activation require the configured approval permission; self-approval is rejected where the operator's matrix requires two people.
- [ ] Validation prevents empty affected scope, inverted time ranges, unknown entities, and a replacement-stop claim without a resolvable replacement; warnings explain open-ended alerts and broad agency-wide impact.
- [ ] Every state transition and field change uses 400's audit API, and published changes create the explicit alert version consumed idempotently by 403.
- [ ] An end-to-end test creates a diversion with a closed and replacement stop, publishes it, verifies all 402 surfaces, updates its wording once, and resolves it.

## Out of scope

- Feed ingest and public rendering — 401 and 402.
- Notification channel delivery — 403.

## Dependencies

- **Blocks:** 499
- **Blocked by:** 400, 401
- **External:** operator approval workflow, alert taxonomy, and public wording guidance.

## Notes / decisions log

- 2026-07-19 — Added to close the orphaned staff-authoring requirement.

---

## Definition of done

This ticket is closeable when operations staff complete the authoring drill unaided and the audit/version evidence is recorded.
