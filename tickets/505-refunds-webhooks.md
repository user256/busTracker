# Ticket 505: Refunds, Failed Payments, and Webhook Reliability

**Sprint:** 5 — Ticketing and Payments
**Status:** Planned
**Owner:** unassigned
**Estimate:** M

---

## Context

502 handles the happy path. This ticket handles every other path, and in payments the other paths are where the money actually goes missing. `features.md` §3 requires refund and cancellation requests plus clear handling of failed or interrupted payments; the Payments section adds refund and chargeback workflows, payment reconciliation, and webhook reliability. Webhooks arrive out of order, arrive twice, and occasionally do not arrive at all — a system that treats them as a reliable ordered stream will eventually mark an order paid that was refunded an hour ago, or leave a passenger who was charged staring at "payment pending". This ticket makes our ledger reconcilable against Stripe's, and makes the answer to "did this passenger get their money back?" a query rather than an investigation.

## Goal

Refunds, chargebacks, and failed payments have defined, tested, end-to-end paths, and our order/payment state is provably reconciled against the provider daily with any drift surfaced as an alert.

## Acceptance criteria

- [ ] All Stripe webhooks land on `POST /api/webhooks/stripe`, which verifies the `Stripe-Signature` header against the endpoint secret (rejecting unsigned or stale-timestamp payloads with `400`), writes the raw event to an append-only `payment_events` table with a unique index on the provider `event_id`, returns `2xx` within 5s, and processes asynchronously — a duplicate delivery of the same `event_id` is a no-op, proven by a test replaying the same event 20 times and asserting one state change.
- [ ] Event handling is order-independent: handlers are idempotent and guarded by the provider object's state rather than arrival order, so `charge.refunded` arriving before `payment_intent.succeeded` still converges to the correct final state — covered by a test that shuffles a realistic event sequence and asserts the same terminal order state every time.
- [ ] Refunds: `POST /api/orders/{id}/refund` supports full and partial (`amountMinor`) refunds with a reason code, is idempotent on an `Idempotency-Key`, refuses to refund more than the captured amount (`422 refund_exceeds_captured`), revokes the associated 503 tickets to `revoked` in the same transaction that records the refund, and refuses to refund a ticket already validated per 504 unless a staff override with a recorded justification is supplied.
- [ ] A passenger-facing cancellation/refund request flow exists at `POST /api/orders/{id}/refund-request`, applies the product's refundability rules from 501 (unactivated tickets inside the window auto-approve; everything else creates a case for staff), returns a reference number, and emails the outcome; refund status is visible on the order.
- [ ] Chargebacks/disputes: `charge.dispute.created` marks the order `disputed`, revokes tickets, opens a staff case with the order, evidence bundle (receipt, validation history from 504, IP and device metadata), and the response deadline; `charge.dispute.closed` records the outcome and the fee.
- [ ] Failed-payment recovery is concrete: `payment_intent.payment_failed` transitions the order to `failed`, retains the cart/quote for 24h, and sends one recovery email with a resume link; recovery emails are capped at one per order and suppressed if the order later succeeds — asserted by test rather than assumed.
- [ ] A daily reconciliation job (`npm run reconcile -- --date YYYY-MM-DD`) pulls Stripe balance transactions for the day and diffs them against our `orders`/`refunds` ledger, writing a `reconciliation_runs` row with counts and a list of discrepancies (in Stripe not in us, in us not in Stripe, amount mismatch); any non-empty discrepancy list alerts finance and the on-call engineer, and the job is safe to re-run. A missed-webhook backstop complements it: any order sitting in `pending`/`requires_action` for more than 30 minutes is polled directly against the Stripe API and reconciled, so a webhook outage degrades latency rather than correctness.
- [ ] `npm test -- payments-lifecycle` passes, covering signature rejection, duplicate and out-of-order delivery, partial refunds, over-refund rejection, refund-after-validation guard, dispute handling, and a reconciliation run seeded with a deliberate discrepancy.

## Out of scope

- The purchase flow, PaymentIntent creation, and SCA — 502.
- Ticket issuance and the QR credential — 503; this ticket only sets `revoked`.
- Staff refund UI, permission limits, and the case queue front end — 704 (this ticket delivers the API and the case records it writes into).
- Finance-system export, sales and revenue reporting — 705.
- Provider-agnostic payment abstraction. Stripe is the decided provider; we are not building an adapter layer speculatively.

## Dependencies

- **Blocks:** 599
- **Blocked by:** 500, 502
- **External:** Stripe webhook endpoint secrets for test and live, and dispute/evidence-submission access; the operator's refund policy (windows, fees, what is non-refundable) signed off legally and reflected in conditions of carriage; a finance contact and destination for reconciliation exceptions.

## Approach (optional)

Persist first, process second — the webhook endpoint's only job is to verify, store, and acknowledge; all business logic runs from a worker over `payment_events`, which makes replay and backfill trivial and stops a slow handler causing provider retries. Keep our own double-entry-ish ledger (`payments`, `refunds`) rather than deriving state by querying Stripe at read time, then prove it matches nightly. The reconciliation job is the thing that catches every bug this ticket did not anticipate; it is not optional polish.

## Notes / decisions log

- 2026-07-19 — Ticket written during initial roadmap population. No implementation decisions yet.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
