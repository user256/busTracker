# Ticket 403: Alert Subscriptions and Notification Delivery

**Sprint:** 4 — Service Alerts and Disruptions
**Status:** Planned
**Owner:** unassigned
**Estimate:** L

---

## Context

402 makes disruptions visible to passengers who are already on the site. The passenger who most needs to know that the 07:40 is cancelled is the one still at home, not looking at anything. `features.md` section 5 requires subscription to route or stop alerts delivered by email, SMS, push or browser notification. This is the first outbound-messaging capability in the programme, which brings a set of problems none of the previous tickets have: consent and unsubscribe compliance, per-channel delivery failure and retry, cost (SMS is billed per message and a major incident fans out to every subscriber at once), and the reputational risk of a bug that sends a thousand duplicate messages at 5 a.m. Accounts do not exist until Sprint 6, so subscriptions must work for anonymous passengers keyed on a verified contact address.

## Goal

A passenger can subscribe to a route or stop and reliably receive alerts affecting it by email, SMS, web push, or browser notification, with verified opt-in and one-click unsubscribe.

## Acceptance criteria

- [ ] `POST /api/subscriptions` with `{ channel: "email"|"sms"|"push", target: <address|E.164|pushSubscription>, scope: { type: "route"|"stop", id }, quietHours?: { from, to, timeZone } }` creates a pending subscription and returns `202`; IANA timezone is required with quiet hours, activation follows verified opt-in, and unconfirmed subscriptions expire after 48 hours.
- [ ] Manual `GET /unsubscribe/[token]` renders a safe confirmation/result page and never mutates state merely because a mail scanner fetched it; RFC 8058 one-click uses a signed opaque HTTPS URI plus `List-Unsubscribe-Post: List-Unsubscribe=One-Click` and an unauthenticated `POST` that takes effect before the next dispatch cycle, with DKIM covering both headers.
- [ ] A dispatcher fans out an alert created or materially updated in 401 to all active matching subscriptions — matching route-scoped subscriptions to route alerts and stop-scoped subscriptions to both stop alerts and alerts on routes serving that stop — asserted by an integration test over a fixture alert and a mixed subscription set.
- [ ] Delivery is idempotent: a `notification_deliveries` table with a unique constraint on `(subscription_id, alert_id, alert_version)` guarantees a given alert version is delivered at most once per subscription, and a test that runs the dispatcher three times over the same alert asserts exactly one send per subscription.
- [ ] Failed sends retry with exponential backoff up to 3 attempts, permanent failures (hard bounce, invalid number, expired push subscription returning HTTP 404/410) deactivate the subscription rather than retrying forever, and every attempt records provider, status, and provider message ID.
- [ ] Web push uses the Web Push protocol with VAPID keys, browser permission is requested only from an explicit user gesture, and permission denial is handled with a named fallback message offering the email channel — never a silent failure or a repeated prompt.
- [ ] Rate and volume controls exist: a per-subscription cap (default 10 messages per hour), optional quiet hours suppressing non-severe alerts, and a global dispatch-rate limit with a configurable cap that halts and alerts operators if a single incident would exceed it — asserted by a test that a 5,000-subscriber fan-out respects the cap and does not send unbounded.
- [ ] Subscription records store the minimum data required (contact address, scope, consent timestamp, consent source IP), are deleted on unsubscribe after a documented retention window, and a `GET /subscriptions/[token]` self-service page lets a passenger view and remove their subscriptions without an account.
- [ ] Consent wording, lawful basis, retention, contact-field encryption, timezone/DST behaviour, and channel-specific sender identity are reviewed for the operating jurisdiction before any real recipient can be enabled.

## Out of scope

- Account-linked notification preferences and a preferences UI — Sprint 6 (602); this ticket is anonymous, token-based subscriptions only.
- Marketing or promotional messaging of any kind — this channel carries service alerts exclusively, and that restriction is enforced in the schema, not by convention.
- Native mobile push to an app (no app exists; `features.md` lists native apps as a later enhancement).
- Personalised alerts derived from a passenger's saved or booked journeys — explicitly a later enhancement.

## Dependencies

- **Blocks:** 499
- **Blocked by:** 301, 302, 401
- **External:** transactional email provider (e.g. Postmark/SES) with a verified sending domain, SPF/DKIM/DMARC configured; SMS provider account, sender ID registration, and a per-message cost budget agreed with the operator; VAPID key pair generated and stored; legal review of the consent wording and retention period for the operating region.

## Approach (optional)

Dispatch belongs in the worker process from 101, not a route handler — a fan-out to thousands of recipients cannot run inside a request. Model it as a durable queue table polled by the worker (`notification_outbox`) rather than reaching for a broker this early; Postgres `SELECT ... FOR UPDATE SKIP LOCKED` is sufficient at this scale and keeps the deployment simple. Alert versioning is what makes idempotency tractable — hash the alert's header, description, and active periods at ingest in 401 so "materially updated" is a comparable value rather than a judgement call, and a cosmetic feed re-publish does not re-notify everyone. Build email first and prove the whole pipeline on it before adding SMS, which is the expensive channel and the one where a bug costs real money.

## Notes / decisions log

- 2026-07-19 — Ticket written during initial roadmap population. No implementation decisions yet.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
