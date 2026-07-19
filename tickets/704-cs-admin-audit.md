# Ticket 704: Customer-Service Administration and Audit Trail

**Sprint:** 7 — Admin and Operations
**Status:** Planned
**Owner:** unassigned
**Estimate:** L

---

## Context

Sprint 6 gave passengers an account (602) and a way to raise a support case (604), but gave staff no way to answer one. Today a "my ticket didn't arrive" enquiry has no resolution path that does not involve a developer querying the database and manually re-triggering an email. That is slow, unlogged, and — because it runs as an engineer with unrestricted database access — a genuine privacy and fraud risk. This ticket builds the agent-facing side of support, and with it the audit trail that every other staff tool in Sprint 7 writes to. The audit store defined here is a shared dependency, not a feature of the CS tool alone.

## Goal

A customer-service agent can find a customer or order and resolve common enquiries within enforced limits, using the shared audit foundation for every read and action.

## Acceptance criteria

- [ ] Agents with `cs_agent` can search customers and orders by email, order reference, ticket reference, last four digits of the payment method, or date range, and results return in p95 under 500ms against a seeded dataset of 1,000,000 orders.
- [ ] An order view shows purchase history, per-ticket status (unactivated, active, expired, refunded, voided), activation and validation events from 504, receipt/invoice links, and the payment and webhook state from 505 — including the failure reason on a failed payment.
- [ ] An agent can resend a ticket or receipt to the account's verified email address only; the destination address is never free-text editable from this screen, resends are rate-limited to 5 per order per hour, and each resend writes an audit entry.
- [ ] Refunds initiated here route through the 702 limit and approval logic — an agent over the per-order ceiling or outside the refund window gets a blocked action with a stated reason and an "escalate for approval" path, rather than a `500` or a silent partial refund.
- [ ] Cases support internal notes (staff-only, never rendered to the customer), customer-visible replies, a complaint outcome field, and escalation to an `ops` or `engineering` queue that appears in that queue's view within 60 seconds; case state transitions and the case reference from 604 are preserved end to end.
- [ ] The shared 400 audit entries are searchable by staff member, target customer, action type, and date range, and exportable under an `audit_export` permission; an "everything touching customer X" query returns entries written by 701, 702, 703, and this ticket alike.
- [ ] Customer PII visible to agents is minimised and logged: full card numbers are never available (only the provider's last-four), and opening a customer record writes a read-access audit entry, so a subject-access or misuse investigation under 603 can reconstruct who looked at what.

## Out of scope

- The passenger-facing help centre, contact forms, and case creation — 604 owns those.
- Live chat, chatbots, and staffing models for real-time support.
- Integrating a third-party helpdesk (Zendesk/Freshdesk) as the system of record — noted as a possible future migration, not built here.
- Support-volume reporting and SLA dashboards — 705.
- Automated fraud decisioning; agents can void a ticket, but the fraud rules themselves stay in 504.

## Dependencies

- **Blocks:** 705, 799
- **Blocked by:** 400, 502, 505, 602, 604
- **External:** legal/DPO sign-off on the audit-log retention period and on what PII agents may see; transactional email provider quota for resends; agreement with the operator on complaint outcome categories used in regulatory reporting.

## Approach (optional)

Consume 400's audit API rather than creating another store. Search performance is the real engineering problem here — index for the five supported lookups deliberately and reject open-ended free-text search over the order table, which will not hold the latency budget at a million rows.

## Notes / decisions log

- 2026-07-19 — Ticket written during initial roadmap population. No implementation decisions yet.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
