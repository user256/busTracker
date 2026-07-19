# Ticket 803: Graceful Degradation and Status Monitoring

**Sprint:** 8 — Reliability, Security, and Scale
**Status:** Planned
**Owner:** unassigned
**Estimate:** L

---

## Context

The product depends on a long list of things it does not control: the vehicle-location feed, the payment provider, the map tile provider, geocoding, email and SMS delivery. `features.md` requires that each integration has monitoring, retry handling, and a documented fallback — and today none of them do. Worse, the failure modes are coupled to the worst possible moment: the tile provider timing out matters most during a disruption, when everyone opens the map. The programme has held one principle since Sprint 1 — a system that silently presents stale data as live is worse than one that admits it has no data — and this ticket generalises that principle from the tracker to every integration, then adds the monitoring to know when it fires. `features.md` is explicit that the journey planner, active tickets, and service alerts receive the highest availability priority; those three get the strictest targets here.

## Goal

Every external integration has a defined, tested fallback that degrades the site visibly rather than breaking it, and the team is alerted on availability targets before passengers notice.

## Acceptance criteria

- [ ] Availability targets are defined, published in the repo, and instrumented as SLOs with error budgets: **tier 1 — journey planner, active-ticket display, and service alerts at 99.9% monthly**; tier 2 — live tracking, timetables, and checkout at 99.5%; tier 3 — admin, help centre, and reporting at 99.0%. Each SLO has a specific measuring probe, and burn-rate alerts fire at 2% and 5% budget consumption.
- [ ] Each external integration (vehicle-location feed, payment provider, tile provider, geocoder, email, SMS) has a documented fallback in `docs/runbooks/` and an implemented circuit breaker with a stated failure threshold, open duration, and half-open probe; breaker state changes emit a metric and an alert.
- [ ] Degradation is user-visible and specific, never a blank component or a spinner that never resolves: tile provider down → map falls back to a static route diagram with an explicit notice; location feed down → tracker falls back to timetable data labelled "no live data — showing timetable" (reusing 206); geocoder down → postcode search disabled with an explanatory message while stop-name search keeps working; email down → purchase completes and the ticket is retrievable in-account with the delivery queued and the customer told.
- [ ] Tier-1 surfaces survive their dependencies failing: **active tickets render and validate with the payment provider unreachable**, service alerts render with the GTFS-RT feed unreachable (from last-known state, with the staleness stated), and the journey planner returns timetable-based results with the realtime feed unreachable — each proven by a chaos test that blocks the dependency at the network level in staging and asserts the surface still returns `200` with correct degraded content.
- [ ] Health endpoints distinguish liveness from readiness and report per-dependency status; `GET /api/health` returns overall state plus a per-integration breakdown, and a degraded dependency yields `200` with `"status":"degraded"` rather than a `503` that would pull a still-useful instance out of the load balancer.
- [ ] A public status page shows current state per customer-facing capability (tracking, journey planner, ticket purchase, active tickets, alerts) and is hosted independently of the main application, so it stays up when the application does not — verified by taking the app down in staging and loading the status page.
- [ ] Alerting routes to an on-call destination with severity mapped to tier (tier-1 outage pages immediately; tier-3 raises a ticket), every alert links to its runbook, and an incident runbook covering detection, escalation, communication, and recovery is exercised in one rehearsal with the result recorded here.
- [ ] Retries on all outbound integrations use exponential backoff with jitter and a request cap, all writes to the payment provider are idempotency-keyed, and a test asserts that a retried checkout call cannot double-charge.

## Out of scope

- Building the caching, CDN, and autoscaling that this ticket's SLOs are measured against — 802.
- Multi-region failover and DR beyond the single-region replica/restore path in 802.
- Security incident response and vulnerability handling — 804 owns the security side; this ticket covers availability incidents.
- Replacing any integration; the fallback must work with the vendors currently chosen.

## Dependencies

- **Blocks:** 899
- **Blocked by:** 105, 304, 402, 503
- **External:** monitoring/alerting vendor selection and account; an independently hosted status-page service; on-call rota agreement with the operator, including who is paged out of hours; vendor SLAs for the tile, geocoding, email, and SMS providers to sanity-check our targets against theirs.

## Approach (optional)

Write the failure path as a first-class rendering state for each surface, not as a `catch` that returns null — the degraded view is a designed thing with words in it, and it should be reachable in development behind a flag so it can be reviewed like any other UI. Set SLO targets from what the architecture can actually deliver, not from aspiration: publishing 99.9% for the journey planner commits us to roughly 43 minutes of downtime a month across every dependency it touches, and that number should be argued about before it is published. Chaos tests belong in CI against staging, blocking the dependency at the network layer rather than mocking a client error, because the interesting failures are timeouts and half-open connections rather than clean exceptions.

## Notes / decisions log

- 2026-07-19 — Ticket written during initial roadmap population. No implementation decisions yet.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
