# Ticket 506: Public Fare Catalogue and Journey Integration

**Sprint:** 5 — Ticketing and Payments
**Status:** Planned
**Owner:** unassigned
**Estimate:** M

---

## Context

Ticket 501 builds pricing but the original queue never replaced route-page fare stubs, added fares to journey results, or gave passengers a complete product-selection surface. A pricing engine that only checkout can call does not satisfy the public fare-information requirements.

## Goal

Passengers can browse fare products and see authoritative applicable fares on route and journey-planner surfaces before entering checkout.

## Acceptance criteria

- [ ] `/tickets` and `/tickets/[slug]` provide an accessible public catalogue of on-sale products, passenger eligibility, scope, price, validity, transfer, activation, and refund rules sourced from 501 and 500.
- [ ] Route pages replace the 301 stub with applicable route/zone products and link to a persisted quote without computing prices in page code.
- [ ] Journey-planner results show an authoritative total or clearly labelled "from"/"fare unavailable" state per journey, with a purchase action carrying the journey context into a fresh server-side quote.
- [ ] Suspended, future, expired, or ineligible products never appear purchasable, and cache invalidation makes a suspension visible across catalogue, route, planner, and checkout within 60 seconds.
- [ ] Currency, passenger class, group composition, discount outcome, and policy-version links remain consistent across quote, catalogue, route, planner, and checkout in an end-to-end test.

## Out of scope

- Pricing rules — 501.
- Taking payment — 502.
- Fare capping, subscriptions, loyalty, or multi-operator products.

## Dependencies

- **Blocks:** 599
- **Blocked by:** 301, 304, 500, 501
- **External:** approved public fare wording and product catalogue.

## Notes / decisions log

- 2026-07-19 — Added because fare display was deferred by Sprint 3 but never acquired an implementation owner.

---

## Definition of done

This ticket is closeable when public surfaces consume the authoritative pricing contract and the cross-surface test passes.
