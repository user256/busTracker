# Ticket 108: Delivery Platform and Feed Operations

**Sprint:** 1 — Tracker Data Foundation
**Status:** Not started
**Owner:** unassigned
**Estimate:** L

---

## Context

Sprint 1 requires seven days of unattended feed observation and Sprint 2 requires production-like telemetry, but the original roadmap deferred deployment and worker supervision until Sprint 8. This ticket implements the minimum safe delivery platform before either gate can consume operational evidence.

## Goal

The web app and feed workers deploy reproducibly to an isolated staging environment with supervised processes, scheduled static-feed refresh, safe migrations, rollback, secrets, and baseline telemetry.

## Acceptance criteria

- [ ] Infrastructure configuration creates isolated development/staging/production settings for the web process, supervised worker processes, Postgres/PostGIS, secrets, and private capture storage without committing environment-specific secrets.
- [ ] CI runs ticket lint/freshness, tests, lint, and typecheck on every pull request; protected `main` deploys to staging through a reproducible artifact, and production promotion requires an explicit approval.
- [ ] Deploys run migrations once under a lock, stop on migration failure, record the applied version, and have a documented application rollback and forward-fix database procedure exercised in staging.
- [ ] Position and TripUpdates workers restart after crash, expose liveness/readiness, and run for 24 hours in staging without manual intervention before the seven-day 199 observation begins.
- [ ] GTFS static import runs on the operator-approved schedule, detects unchanged bundles by hash, alerts on failure or excessive rejects, retains the previously active version, and proves one successful automatic version swap in staging.
- [ ] Logs and baseline metrics cover deploys, worker restarts, poll success/failure, feed age, import age, database availability, and API error/latency; actionable failures reach a named on-call destination.
- [ ] A staging smoke test and rollback test are documented, and `docs/runbooks/deploy.md`, `feed-workers.md`, and `gtfs-static-refresh.md` identify owners and exact recovery actions.

## Out of scope

- Peak/snow-day scaling, multi-region operation, and final SLO assurance — 802 and 803.
- Full penetration testing — 804.

## Dependencies

- **Blocks:** 199, 299
- **Blocked by:** 101, 102, 104, 107
- **External:** the platform and accounts selected in 003, staging DNS/TLS, alert destination, and operator-approved static-feed cadence.

## Notes / decisions log

- 2026-07-19 — Added because the original gates required production-like evidence while production delivery was unowned.

---

## Definition of done

This ticket is closeable when all acceptance criteria pass in staging and the operational owners accept the runbooks.
