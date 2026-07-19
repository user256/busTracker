# Ticket 003: Delivery and Operating Model

**Sprint:** 0 — Readiness and Cross-Cutting Foundations
**Status:** Done
**Owner:** John Fegan
**Estimate:** M

---

## Context

Ticket 101 needs a deployment target for its worker/runtime ADR, while the first two review gates assume staging, supervised workers, telemetry, rollback, and on-call ownership that no ticket currently provides. The architecture needs an agreed operating model before the project skeleton bakes in the wrong runtime boundary.

## Goal

The team selects and documents the hosting, environment, deployment, data-recovery, observability, and operational-ownership model that Ticket 101 and the delivery platform will implement.

## Acceptance criteria

- [x] An ADR selects the hosting platform and records how the web app, long-lived workers, Postgres/PostGIS, object storage, CDN, shared rate-limit state, and scheduled jobs run in development, staging, and production.
- [x] `docs/readiness/delivery.md` defines environment isolation, domains/TLS, secrets, migration ownership, deploy approval, rollback, worker supervision, backup/restore ownership, log/metric retention, alert destinations, and the release path from main to production.
- [x] The initial CI policy is agreed: protected `main`, pull-request checks, secret scanning, dependency updates, ticket-dashboard freshness, application tests after 101, and required reviewers for payments, security, privacy, and database migrations.
- [x] The repository visibility decision is recorded as public, with an allowlist of publishable artefacts and an explicit denylist covering `.env`, `private.md`, raw private feeds, contracts, security reports, customer data, and production configuration.
- [x] Baseline availability and recovery targets are provisional but named, along with the evidence required to revise them; public launch is not allowed to rely on the later snow-day test as its first operational test.
- [x] Cost owners and budget alerts are named for hosting, maps, geocoding, messaging, storage, monitoring, and load testing.

## Out of scope

- Provisioning the platform; Ticket 108 implements this model after the app skeleton exists.
- Peak scaling and full disaster-recovery assurance; Sprint 8 owns those tests.

## Dependencies

- **Blocks:** 099
- **Blocked by:** none
- **External:** hosting/platform stakeholders, finance, security, and the operator's on-call owner.

## Notes / decisions log

- 2026-07-19 — Filed from the pre-build queue audit because production-like evidence was required before any delivery ticket owned an environment.
- 2026-07-19 — Selected self-hosted Docker Compose aligned with existing Backdoor/NAS→VPS TLS ops. ADR 0001 + `docs/readiness/delivery.md` written. Ticket 101 may assume always-on worker containers + PostGIS.

---

## Definition of done

This ticket is closeable when all acceptance criteria are checked and Ticket 101 can write its runtime ADR without an unresolved deployment target.
