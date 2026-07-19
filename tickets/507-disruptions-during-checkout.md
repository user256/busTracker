# Ticket 507: Disruptions During Fare Selection and Checkout

**Sprint:** 5 — Ticketing and Payments
**Status:** Planned
**Owner:** unassigned
**Estimate:** S

---

## Context

Ticket 402 explicitly deferred disruption warnings during ticket purchase to 502, but 502 contained no corresponding criterion. Passengers must not buy against a journey or route that the same site already knows is cancelled or materially disrupted.

## Goal

Relevant active disruptions are shown before payment and rechecked before order creation without silently changing the quoted product or price.

## Acceptance criteria

- [ ] Fare-product and checkout surfaces resolve alerts through 402's shared matcher using the quote's route, stop, trip, and travel-time context.
- [ ] A severe `NO_SERVICE`, stop closure, or materially invalidating alert requires explicit acknowledgement before payment and provides a route back to re-plan; informational alerts do not block checkout.
- [ ] `POST /api/checkout/session` rechecks alert state server-side and returns a typed `409 journey_disrupted` when policy requires blocking, including the alert version and safe next action.
- [ ] An alert appearing after quote creation but before payment is tested end to end, including accessible announcement and no duplicate PaymentIntent.

## Out of scope

- Automatic compensation or live-aware replanning.
- Alert ingest, display primitives, or payment implementation — 401, 402, and 502.

## Dependencies

- **Blocks:** 599
- **Blocked by:** 402, 500, 502
- **External:** operator policy on which effects block purchase versus require acknowledgement.

## Notes / decisions log

- 2026-07-19 — Added to close Ticket 402's unowned checkout deferral.

---

## Definition of done

This ticket is closeable when the alert race test and accessible checkout behaviour pass.
