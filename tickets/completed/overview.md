# Sprint 0: Readiness and Cross-Cutting Foundations

**Status:** Closed

**Theme:** Resolve the assumptions, access, ownership, and operating model that would otherwise be decided accidentally in code.

**Tickets:**
- [x] [Ticket 001: Product, Jurisdiction, and Launch Readiness](./001-product-and-launch-readiness.md)
- [x] [Ticket 002: Data and Vendor Access Readiness](./002-data-and-vendor-access-readiness.md)
- [x] [Ticket 003: Delivery and Operating Model](./003-delivery-and-operating-model.md)
- [x] [Ticket 099: Sprint 0 Readiness Review and Go/No-Go](./099-sprint-0-review.md)

**Exit criteria:**
- jurisdiction, launch stages, scope, and accountable owners are recorded
- representative feeds and required vendor sandboxes are privately accessible
- hosting, environments, CI/CD, secrets, observability, and operational ownership are decided
- the public repository has an explicit publishable/private-data boundary
- Ticket 101 has no unresolved decision that changes its architecture

**Explicitly out of scope:** application implementation and production provisioning.

---

# Sprint 1: Tracker Data Foundation

**Status:** Closed

**Theme:** Get trustworthy vehicle and timetable data into a store the tracker can query fast — and know when that data is lying.

**Tickets:**
- [x] [Ticket 101: Architecture Decision Record and Project Skeleton](./101-architecture-and-skeleton.md)
- [x] [Ticket 102: GTFS Static Ingest and Schema](./102-gtfs-static-ingest.md)
- [x] [Ticket 103: PostGIS Vehicle Position Store](./103-postgis-position-store.md)
- [x] [Ticket 104: GTFS-Realtime VehiclePositions Poller](./104-gtfsrt-vehicle-poller.md)
- [x] [Ticket 105: Feed Validation and Data-Quality Guards](./105-feed-validation.md)
- [x] [Ticket 106: Vehicle Positions Read API](./106-positions-read-api.md)
- [x] [Ticket 107: TripUpdates Ingest and Arrival Estimates](./107-tripupdates-arrivals.md)
- [x] [Ticket 108: Delivery Platform and Feed Operations](./108-delivery-platform-feed-operations.md)
- [x] [Ticket 199: Sprint 1 Review and Go/No-Go](./199-sprint-1-review.md)

**Review:** [Sprint 1 Conditional-Go](../docs/reviews/sprint-1.md)

**Follow-ups (live):** [109](../109-operator-feed-observation-window.md), [110](../110-staging-host-soak.md)

**Exit criteria:**
- GTFS static data (routes, stops, trips, stop_times, shapes, calendars) loads reproducibly
- GTFS-RT vehicle positions ingest continuously without operator intervention
- stale, impossible, and off-route positions are detected and flagged, not served as truth
- the read API returns positions for a viewport or route within the latency budget
- arrival estimates exist and are explicitly distinguishable from scheduled times
- supervised workers and scheduled static-feed refresh run in staging with rollback and baseline telemetry
- team decides whether the feed is good enough to build Sprint 2 on

**Explicitly out of scope:** any customer-facing UI, ticketing, accounts, journey planning.

---

