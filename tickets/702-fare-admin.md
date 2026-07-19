# Ticket 702: Fare and Ticket Administration

**Sprint:** 7 — Admin and Operations
**Status:** Planned
**Owner:** unassigned
**Estimate:** L

---

## Context

Sprint 5 built the fare model (501) and the checkout on top of it (502), but the only way to change a price, launch a promotion, or pull a broken ticket type off sale is a developer running SQL against production. That is unacceptable for a commercial surface: fare changes are routine, are usually scheduled in advance by people who are not engineers, and are exactly the kind of change where a mistake costs real money. This ticket gives the commercial team a supervised way to do it, with the safety rails a money-touching admin surface needs — preview before publish, effective dates, and an audit trail.

## Goal

Commercial staff can create, price, schedule, and suspend fare products and discount codes without a developer, and finance staff can review transactions and issue refunds within enforced limits.

## Acceptance criteria

- [ ] Staff with the `fares_editor` role can create a fare product specifying type (single, return, day, weekly, monthly), passenger class (adult, child, student, senior, concession), zone- or route-based scope, validity period, and sales availability window, and the created product validates against the 501 fare schema before it can be saved.
- [ ] Price changes are scheduled, not immediate: every price row carries `effective_from`/`effective_to`, a future-dated change is visible in the admin as "scheduled" and does not affect checkout until its start time, and a checkout completed at time T is priced from the row valid at T — covered by a test that books either side of a scheduled change boundary.
- [ ] Discount and promotional codes support a percentage or fixed amount, a total redemption cap, a per-customer cap, and start/end dates; a code that is exhausted, expired, or not yet live is rejected at checkout with a distinct error code, verified by four integration tests (valid, exhausted, expired, not-yet-live).
- [ ] Suspending a ticket type takes it off sale within 60 seconds across all surfaces (checkout, route pages, fare pages) and does **not** invalidate tickets already sold under it — asserted by a test that suspends a product with a live ticket outstanding and confirms the ticket still validates via the 504 endpoint.
- [ ] A transaction browser lets `finance` role staff search orders by date range, route, product, payment status, and customer email, and export the result set as CSV with order ID, timestamp, product, gross, discount, net, payment status, and provider reference.
- [ ] Refunds are limit-enforced: a `cs_agent` may refund up to a configured per-order ceiling (default £25) and only within the refund window from the published policy; anything above the ceiling, outside the window, or partial-on-a-partially-used ticket requires `finance` approval, and an attempt without the role returns `403` and is logged. Refunds execute through the 505 refund path — this ticket never calls the payment provider directly.
- [ ] Failed and disputed payments are listed with the provider failure reason and the 505 recovery state, filterable to "unresolved", so finance can work a queue rather than reading webhook logs.
- [ ] Every create, edit, schedule, suspend, refund, and export action writes a 400 audit entry recording staff ID, entity, before/after values for changed fields, and timestamp; the audit entry for a price change is asserted in a test.

## Out of scope

- Building the underlying fare calculation or checkout — 501 and 502 own those; this is administration over them.
- Payment-provider configuration, new payment methods, or reconciliation against the accounting system.
- Subscriptions, auto-renewal, and loyalty pricing — explicitly deferred at the Sprint 5 gate.
- Revenue dashboards and trend reporting — 705.

## Dependencies

- **Blocks:** 705, 799
- **Blocked by:** 400, 500, 501, 502, 505
- **External:** finance sign-off on refund ceilings and the approval matrix; Ticket 500's published refund policy (the window enforced here must match its machine-readable values); Stripe account permissions for refund operations.

## Approach (optional)

Model prices as immutable effective-dated rows rather than mutable fields — scheduling, audit, and "what did this cost last Tuesday" all fall out of that for free, and it avoids a class of bug where a retroactive edit silently rewrites history on issued receipts. Treat the refund ceiling and window as configuration read at request time, not constants, so finance can move them without a deploy. Keep the admin write path behind the same server-side validation the public checkout uses; do not add a second, looser code path just because the caller is staff.

## Notes / decisions log

- 2026-07-19 — Ticket written during initial roadmap population. No implementation decisions yet.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
