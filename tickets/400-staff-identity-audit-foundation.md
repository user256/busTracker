# Ticket 400: Staff Identity, MFA, RBAC, and Audit Foundation

**Sprint:** 4 — Service Alerts and Disruptions
**Status:** Planned
**Owner:** unassigned
**Estimate:** L

---

## Context

Staff-authored alerts are required in Sprint 4, while later admin tickets move money and expose customer data. The original roadmap built those surfaces against ad-hoc role checks, added their shared audit store in the last customer-service ticket, and postponed real staff authentication until Sprint 8. Security and attribution must exist before the first staff write path.

## Goal

Every staff session is MFA-authenticated, every staff route is authorised through one deny-by-default permission model, and every staff read or write can be recorded in a shared append-only audit store.

## Acceptance criteria

- [ ] Staff identity is separate from passenger identity, with a distinct store and cookie scope; TOTP MFA is mandatory, recovery codes are single-use and hashed, and an unenrolled user can reach only enrolment.
- [ ] A single permission registry defines the roles needed by alerts, operations, fares, finance, content, legal approval, and customer service; every `/admin/*` and `/api/admin/*` route declares a permission and an undeclared route fails closed.
- [ ] Staff sessions have a 12-hour absolute and 30-minute idle lifetime, terminate on deactivation or role change within 60 seconds, and require MFA re-authentication for high-value refunds and legal publication.
- [ ] An append-only `staff_audit` store records staff ID, role, action, target, before/after mutation values, source IP, and UTC timestamp; the application role cannot update or delete rows, and a separate retention/export role is documented.
- [ ] Authentication, role changes, customer-record reads, content publication, alert changes, refunds, exports, and ticket actions all have a shared audit API with contract tests.
- [ ] Staff routes use a separate hostname or an operator-approved private-access boundary, set `no-store`, use a dedicated CSP/session cookie, and return `401` unauthenticated and `403` unauthorized.
- [ ] Brute-force protection, account recovery, account deactivation, break-glass access, quarterly access review, and audit-retention procedures are documented and tested at least once.

## Out of scope

- The staff feature screens themselves — 406 and Sprint 7.
- Full adversarial assurance and penetration testing — 801 and 804.
- Corporate SAML/OIDC federation unless selected in Ticket 003.

## Dependencies

- **Blocks:** 401, 406, 701, 702, 703, 704, 705, 799, 801
- **Blocked by:** 399
- **External:** operator identity owner, role/approval matrix, second hostname or private-access boundary, and MFA recovery process.

## Notes / decisions log

- 2026-07-19 — Moved the staff security and audit foundation ahead of the first staff write path.

---

## Definition of done

This ticket is closeable when all acceptance criteria pass and no staff endpoint can exist without permission and audit declarations.
