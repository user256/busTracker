# Ticket 602: Account Surfaces — Tickets, History, Preferences

**Sprint:** 6 — Accounts and Support
**Status:** Planned
**Owner:** unassigned
**Estimate:** M

---

## Context

601 gives passengers an account; this ticket gives them a reason to have one. `features.md` §4 asks for active and expired ticket management, receipt and invoice downloads, saved passengers/routes/favourite stops, saved payment methods held at the provider, and notification preferences. The single most important screen in the entire product lives here: a passenger standing at a stop with the driver waiting needs their active ticket on screen in one tap, on a bad connection, with a nearly flat battery — `features.md`'s mobile-first section calls out "easy access to active tickets" specifically. Everything else in the account area can be a page load; that one cannot.

## Goal

A logged-in passenger can reach an active ticket in one tap, manage expired tickets and purchase history, download receipts and invoices, and control saved data and notification preferences.

## Acceptance criteria

- [ ] `GET /api/account/tickets?status=active|expired|all` returns the passenger's 503 tickets with product name, passenger class, activation state, expiry, and order reference, paginated at 25; the account home route-segment renders the active-ticket surface with a server-rendered shell and reaches interactive in under 2s on a simulated Slow 4G / mid-tier Android profile, asserted by a Lighthouse CI budget in `npm run test:perf`.
- [ ] The active-ticket view reuses 503's rotating-code component unchanged, works from a home-screen shortcut, reacquires a live code quickly after reconnecting, and presents the explicit online-only unavailable state when disconnected — never a cached static image presented as valid.
- [ ] Purchase history at `GET /api/account/orders` shows every order including guest orders claimed under 601, with status (paid, refunded, partially refunded, disputed) sourced from the 505 ledger, and supports ticket re-download for any unexpired, unrevoked ticket.
- [ ] Receipts and tax invoices required by the operating jurisdiction are downloadable as PDF from `GET /api/orders/{id}/receipt` and `/invoice`, authorised strictly by ownership — a test asserts a request for another account's order returns `404` and that the endpoints are not accessible by order reference alone.
- [ ] Saved payment methods are listed, added, and removed through Stripe's customer object and SetupIntents only; we store the Stripe customer id, card brand, last four, and expiry for display and nothing else — a test asserts no PAN-shaped or CVC field exists in any account table or API response.
- [ ] Checkout recognizes the authenticated server session, attaches the order to that account without accepting a client-supplied account ID, reuses permitted Stripe payment methods, and still offers guest checkout; an ownership test proves one account cannot attach an order to another.
- [ ] Saved passengers (name, passenger class, concession reference), favourite routes, favourite stops, and saved journey queries are CRUD-able and reused at 501 quote time and on the tracker/planner surfaces; a saved journey stores origin/destination/filter intent rather than a stale itinerary, and concession references are encrypted at rest and never rendered in full after entry.
- [ ] Notification preferences are granular and honoured: per-channel (email, SMS, push) and per-category (service alerts from 403, ticket expiry reminders, marketing), defaulting marketing to **off** with explicit opt-in; a test asserts a category set to off produces no send, and every marketing email carries a working one-click unsubscribe.
- [ ] `npm test -- account` passes, covering ownership authorisation on every endpoint (the cross-account `404` case for each), pagination, guest-order visibility after claiming, preference enforcement, and the payment-method storage assertion.

## Out of scope

- Authentication, sessions, and password recovery — 601.
- Data export and account deletion — 603.
- Support cases and their history in the account area — 604.
- Ticket issuance, activation rules, and the QR credential itself — 503.
- Linked family or dependent accounts, and subscription/auto-renewal management.
- Staff-side customer and order lookup — 704.

## Dependencies

- **Blocks:** 699
- **Blocked by:** 503, 601
- **External:** Stripe customer/SetupIntent access from the 502 account; SMS provider credentials for the SMS notification channel; operator sign-off on which notification categories exist and their defaults; VAT invoice layout approved by finance.

## Approach (optional)

Treat the active-ticket screen as its own performance budget with its own route, minimal JavaScript, and no dependency on the rest of the account bundle — it is the one screen where a slow page is a passenger arguing with a driver. Authorise by ownership at the query level (`WHERE account_id = $session.accountId`) rather than fetching then checking, so an authorisation bug cannot be a forgotten `if`. Preferences are read by 403's delivery pipeline, so define the contract as a shared module, not a duplicated table read.

## Notes / decisions log

- 2026-07-19 — Ticket written during initial roadmap population. No implementation decisions yet.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
