# Ticket 500: Commerce Policy and Consent Baseline

**Sprint:** 5 — Ticketing and Payments
**Status:** Planned
**Owner:** unassigned
**Estimate:** M

---

## Context

The original roadmap allowed checkout and ticket enforcement to be built before the conditions, refund policy, eligibility rules, privacy notice, and consent records that define their lawful behaviour. Ticket 805 arrived after those systems and created a backwards dependency from fare administration. Commerce policy must be versioned before the first order is accepted, even if the full CMS migration comes later.

## Goal

The legally reviewed commerce policies and consent contracts are versioned, publishable, and testable before checkout, ticket activation, validation, or refunds are implemented.

## Acceptance criteria

- [ ] Counsel-approved ticket conditions of carriage, refund/cancellation policy, passenger eligibility rules, fraud/acceptable-use policy, checkout privacy notice, and required company/contact information are stored as versioned content under stable public URLs.
- [ ] A machine-readable policy registry exposes the effective refund window, refund exceptions, eligibility identifiers, device-transfer rule, validation/fraud rule, and policy version; 501–505 consume it rather than duplicating constants.
- [ ] Checkout acceptance is an explicit unticked control, records the exact terms and carriage-policy versions against the order, and can render the versions later even after policy changes.
- [ ] Only essential checkout/payment cookies load by default; any analytics or marketing integration remains disabled until granular consent exists, and rejection is as easy as acceptance.
- [ ] Policy publication has named legal and commercial approvers, immutable version history, effective dates, and a tested emergency withdrawal/replacement path.
- [ ] Ticket-sales launch is mechanically disabled until all required policy versions and company identifiers are configured and approved.

## Out of scope

- The full CMS workflow and accessibility statement — 703 and 805.
- Fare calculation, payment, ticket issuance, and validation implementation — 501–505.

## Dependencies

- **Blocks:** 502, 503, 504, 505, 599, 702, 805
- **Blocked by:** 499
- **External:** counsel, commercial owner, finance/VAT owner, company details, and approved operating jurisdiction from 001.

## Notes / decisions log

- 2026-07-19 — Added to remove the backwards dependency where policy arrived after commerce code.

---

## Definition of done

This ticket is closeable when policy versions are approved, published, and enforced as launch configuration.
