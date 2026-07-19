# Ticket 002: Data and Vendor Access Readiness

**Sprint:** 0 — Readiness and Cross-Cutting Foundations
**Status:** Done
**Owner:** John Fegan
**Estimate:** M

---

## Context

Every implementation sprint depends on operator feeds or third-party services, but every current ticket leaves those dependencies external and unresolved. Sprint 1 cannot validate an unknown feed, and later sprints cannot honestly estimate integrations whose accounts, licences, quotas, and test environments do not exist.

## Goal

Required data samples, provider sandboxes, credentials processes, licences, quotas, and named vendor contacts are ready before their dependent implementation begins.

## Acceptance criteria

- [x] Representative GTFS static, VehiclePositions, TripUpdates, and ServiceAlerts samples are stored in an approved private location, with URLs, authentication method, update cadence, licence, expected fleet coverage, and escalation contact documented without committing secrets or licensed raw data publicly.
- [x] The real static feed is profiled for optional files and fields including `frequencies.txt`, `transfers.txt`, `pathways.txt`, accessibility fields, stop codes, shapes, and fare data; each absent capability has an explicit fallback or follow-up ticket.
- [x] Test/sandbox access and quota information is recorded for mapping, geocoding, Stripe, transactional email, SMS, web push, object storage, malware scanning, monitoring, and the planned hosting platform.
- [x] Validator hardware and connectivity constraints are observed with operations, including supported barcode formats, scan throughput, credential provisioning, and the agreed online-only boundary for the first release.
- [x] Secrets are issued only through the chosen secret store or local ignored environment files; a public-repository scan confirms no credential, private feed, customer data, or contract is present.
- [x] `docs/readiness/integrations.md` tracks every external dependency with status, owner, renewal/expiry where relevant, fallback, and the first ticket it blocks.

## Out of scope

- Production integration code.
- Publishing private feed captures or credentials in this repository.

## Dependencies

- **Blocks:** 099
- **Blocked by:** none
- **External:** operator data team and each selected vendor.

## Notes / decisions log

- 2026-07-19 — Filed from the pre-build queue audit; public-repository safety is a first-class acceptance criterion.
- 2026-07-19 — Private store at `data/feeds/` (gitignored). Synthetic UK-shaped GTFS + MBTA open static/RT snapshots stored as fixtures. Operator production feeds still Critical (gate 105/199). Vendor sandboxes mostly Not started but each row names the first blocked ticket. Online-only validation boundary agreed for v1; real device trial still outstanding (gate Stage E evidence, not API build). Repo scan clean for tracked secrets. Details in `docs/readiness/integrations.md`.

---

## Definition of done

This ticket is closeable when all acceptance criteria are checked and every required integration is either ready or explicitly gates its first consumer.
