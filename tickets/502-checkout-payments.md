# Ticket 502: Checkout and Payment Provider Integration

**Sprint:** 5 — Ticketing and Payments
**Status:** Planned
**Owner:** unassigned
**Estimate:** L

---

## Context

501 can say what a ticket costs; this ticket takes the money. `features.md` §3 requires guest checkout, later account checkout, card payments, digital wallets, and explicit handling of failed or interrupted payments. The provider flow must enforce the authentication and payment rules confirmed for Ticket 001's jurisdiction; where SCA/3DS applies it is an end-to-end requirement, not a later enhancement. The failure mode we are engineering against is the mundane one: a passenger on a bad mobile connection taps Pay twice, backgrounds the browser during authentication, and either gets charged twice or gets charged and never receives a ticket.

## Goal

A mobile-first checkout that converts a 501 quote into a paid order through Stripe with SCA, digital wallets, and idempotency guarantees such that no passenger is ever double-charged and no successful payment fails to produce an order.

## Acceptance criteria

- [ ] `POST /api/checkout/session` accepts `{quoteId, email, passengerDetails?}` and a client-generated `Idempotency-Key` header (UUIDv4); an account ID is derived only from the authenticated server session and is never accepted from the client. The server re-prices the bound, unexpired quote, normalises the guest email, rejects client-supplied amounts, reserves the idempotency record before the provider call, and proves 50 concurrent requests create exactly one order and one PaymentIntent.
- [ ] Payment runs through Stripe Payment Elements with `automatic_payment_methods` enabled so cards, Apple Pay, and Google Pay all render; card data never touches our origin (a test asserts no request to our domain in the checkout flow carries a PAN-shaped field, and CSP `connect-src` permits only Stripe endpoints).
- [ ] SCA/3DS is handled end to end: a PaymentIntent requiring `next_action` drives the challenge in-page, returns to `/checkout/{orderId}/return`, and the order only reaches `paid` from a webhook, never from a client-side success callback — verified with Stripe test cards `4000002500003155` (authentication required) and `4000008400001629` (auth then fail).
- [ ] Order state machine is explicit and enforced in the database: `pending → requires_action → paid → fulfilled`, plus `failed` and `cancelled`, with a CHECK constraint or trigger rejecting illegal transitions; `fulfilled` is set only after 503 has issued the ticket, and a paid-but-unfulfilled order older than 2 minutes raises an alert.
- [ ] Interrupted checkouts recover: returning to `/checkout/{orderId}` after closing the tab shows current status and either resumes the intent or offers a clean retry, and a payment that fails shows the provider's decline reason mapped to plain-language guidance (`card_declined`, `insufficient_funds`, `authentication_failed`) rather than a raw error code.
- [ ] Guest checkout completes with verified email delivery and hands the order to 508's scoped guest-access flow. The order model accepts an optional server-derived owner for later account integration, but Sprint 5 does not pretend passenger accounts exist; 602 enables authenticated checkout and saved Stripe methods after 601.
- [ ] Payment confirmation and a jurisdiction-compliant digital receipt (order reference, line items, passenger class, amount, tax treatment, operator legal entity) are emailed on the `paid` webhook and available at `GET /api/orders/{id}/receipt` as PDF.
- [ ] `npm test -- checkout` passes against the Stripe test-mode API (or `stripe-mock` in CI), covering idempotent replay, 3DS challenge, decline recovery, and the paid-without-fulfilment alarm path.

## Out of scope

- Refunds, chargebacks, and webhook retry/reconciliation infrastructure — 505 (this ticket consumes webhooks; 505 makes them reliable).
- Generating or delivering the ticket artefact itself — 503.
- Saved-payment-method management UI in the account area — 602.
- Subscriptions, auto-renewal, stored-value wallets, or pay-as-you-go tap-on/tap-off.
- Finance-system export and sales reporting — 705.

## Dependencies

- **Blocks:** 505, 599, 602
- **Blocked by:** 500, 501
- **External:** live and test-mode Stripe capability for Ticket 001's region/currency, Apple Pay domain verification, Google Pay merchant registration, the operator's legal/tax identifiers and receipt wording from finance, and transactional email credentials.

## Approach (optional)

Server-authoritative throughout: the client never learns a price it can influence and never confirms an order. Create the PaymentIntent server-side from the persisted quote, pass Stripe our own idempotency key derived from the order id so a retry at our layer maps to a retry at theirs, and treat the `payment_intent.succeeded` webhook as the only source of truth for `paid`. Keep the checkout to one screen on mobile — `features.md` explicitly asks for minimal checkout steps. Log every state transition with `order_id`, `payment_intent_id`, and `idempotency_key` so a support agent in 704 can reconstruct any session.

## Notes / decisions log

- 2026-07-19 — Ticket written during initial roadmap population. No implementation decisions yet.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
