# Ticket 801: Staff Access Security Assurance

**Sprint:** 8 — Reliability, Security, and Scale
**Status:** Planned
**Owner:** unassigned
**Estimate:** M

---

## Context

Ticket 400 establishes staff identity, MFA, RBAC, network separation, and append-only audit before the first staff write path. By Sprint 8 those controls protect alerts, refunds, content, customer data, and reporting and need independent end-to-end assurance against the complete admin surface rather than another implementation rewrite.

## Goal

The deployed staff-access and audit controls are proven complete, fail-closed, recoverable, and appropriate for every admin action before final launch.

## Acceptance criteria

- [ ] An automated inventory enumerates every `/admin/*`, `/api/admin/*`, background admin action, and export; each has one declared 400 permission, an audit classification, `no-store`, and tests for unauthenticated, wrong-role, and correct-role access.
- [ ] MFA enrolment, login, idle/absolute expiry, role-change revocation, account deactivation, recovery-code use, break-glass access, and high-value re-authentication are exercised end to end in the production-equivalent environment.
- [ ] Authorization fails closed when session, permission, or audit persistence is unavailable; a fault-injection test proves no read, write, refund, publish, or export proceeds through a dependency failure.
- [ ] Staff identity remains separate from passengers and from public caching: cookie scope, hostname, CSP, HSTS, CDN bypass, and a passenger-session probe are verified at the deployed edge.
- [ ] The role/permission matrix is reviewed with real staff for least privilege, dormant and excessive access is removed, no routine user holds blanket `admin`, and the review evidence records approvers and date.
- [ ] The append-only audit trail is complete for a representative action from 401/406 and 701–706, protected from application mutation, exportable only with permission, retained according to approved policy, and included in restore verification.
- [ ] Recovery and incident procedures are rehearsed for a lost MFA device, compromised staff account, emergency deactivation, permission-store outage, and suspected audit tampering.

## Out of scope

- Building the identity/RBAC/audit foundation — 400.
- General public-app penetration testing and rate limiting — 804.
- Corporate IdP federation unless separately approved.

## Dependencies

- **Blocks:** 899
- **Blocked by:** 400, 704, 799
- **External:** staff identity owner, security reviewer, real representatives of each role, and production-equivalent admin hostname/network controls.

## Notes / decisions log

- 2026-07-19 — Reframed from late implementation to final assurance after moving the baseline controls to Ticket 400.

---

## Definition of done

This ticket is closeable when every acceptance criterion has deploy-level evidence and unresolved high-risk access findings block 899.
