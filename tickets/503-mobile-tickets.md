# Ticket 503: Mobile Tickets — Signed QR and Activation

**Sprint:** 5 — Ticketing and Payments
**Status:** Planned
**Owner:** unassigned
**Estimate:** L

---

## Context

A paid order is not a ticket. `features.md` §3 requires mobile tickets as QR/barcode with activation, expiry and usage status; the Ticket security section requires signed or encrypted codes, short-lived or rotating codes, protection against screenshots and copying, activation rules, and device-transfer policies. The threat is specific and well understood in bus ticketing: a passenger buys one day ticket, screenshots the QR, and messages it to four friends. A static QR containing an order id defeats nothing. This ticket defines the credential format and its lifecycle so that 504 has something cryptographically meaningful to validate, and so that a screenshot is worthless within seconds of being taken.

## Goal

Every paid order issues a ticket whose on-screen code is a short-lived, rotating, Ed25519-signed token bound to one device and one ticket instance, with explicit activation, expiry and transfer rules visible to the passenger.

## Acceptance criteria

- [ ] Migrations create `tickets` (id, order_id, fare_product_version_id, passenger_class, status, `activates_at`, `expires_at`, `device_binding_id`, `transfer_count`) and `ticket_devices` (device id, public key or install id, first-seen, last-seen); ticket `status` is one of `issued | active | expired | refunded | revoked` and is enforced by a CHECK constraint.
- [ ] The QR payload is a compact Ed25519-signed token — `v1.<base64url(payload)>.<base64url(sig)>` — whose payload is CBOR-encoded `{tid, did, cls, iat, exp, nonce, ver}` and stays under 300 bytes so it scans reliably at QR error-correction level M on a cracked phone screen in daylight.
- [ ] Tokens are short-lived and rotate: `exp - iat = 30s`, the authorized ticket view refreshes every 15s, and the endpoint is rate-limited to 12 requests/minute per ticket. Documentation states accurately that a copied current token may remain usable until expiry or first successful validation; rotation shortens exposure but does not make screenshots impossible.
- [ ] Signing keys live in a KMS/secret store, never in the repo or the database; the token carries a `ver` key-id so keys can be rotated with a documented overlap window, and a test asserts a token signed with a retired key validates during the overlap and fails after it.
- [ ] Activation rules are enforced server-side and match the 501 product validity: a purchase-basis product activates at payment, an activation-basis product stays `issued` until `POST /api/tickets/{id}/activate` is called, activation is irreversible and one-way, and `expires_at` is computed from the product's duration at activation time — a test covers a day ticket activated at 23:50 expiring per the configured rule (service day, not calendar midnight, if that is what the product says).
- [ ] Device binding: activation registers a client-generated public key held in secure storage, and every activation, code, and transfer request proves possession by signing a server nonce; codes requested through a different device fail. The threat model states that possession protects API access but a displayed QR remains a bearer credential during its short validity unless a future scanner challenge protocol is added.
- [ ] Account owners and 508 guest sessions authorize every ticket endpoint at the database query boundary; order/ticket IDs alone never authorize access, and cross-owner tests cover view, activation, transfer, and code generation.
- [ ] The initial release is online-only: no future-dated tokens are pre-issued, loss of connectivity produces an explicit `Live code unavailable` state, and cached static screenshots are never presented as valid. Offline issuance/validation requires a separately approved threat model and ticket.
- [ ] `npm test -- tickets` passes, covering signature verification, expiry boundaries at `exp ± 1s`, tampering (flipping one payload byte fails verification), device-binding rejection, transfer limits, and activation state-machine violations.

## Out of scope

- The validation/scanning endpoint, replay defence, and fraud monitoring — 504. This ticket issues credentials; 504 defends them.
- Driver/inspector scanning hardware, apps, offline issuance, and offline validation devices.
- Barcode formats other than QR (Aztec/PDF417) unless the operator's existing readers require one.
- Apple Wallet / Google Wallet passes.
- Account-side ticket listing and re-download UI — 602.
- Refund-driven revocation mechanics — 505 (this ticket only exposes the `revoked` status it will set).

## Dependencies

- **Blocks:** 504, 599, 602
- **Blocked by:** 500, 501, 502
- **External:** operator decision on the device-transfer policy (how many transfers, what cooldown) and its wording in conditions of carriage; KMS or secret-manager provisioning for signing keys; confirmation of which scanning hardware inspectors use and its QR capabilities.

## Approach (optional)

Ed25519 over JWT-with-RS256 deliberately: signatures are 64 bytes, keys are 32, verification is fast enough to do inline on a validator, and the compact CBOR payload keeps the QR low-density and therefore scannable. Do not encrypt the payload — it contains no personal data, only opaque ids, and a signed-but-readable token is far easier to debug in the field. Rotation is the anti-screenshot control; watermarks and "no screenshot" flags are theatre by comparison and are included only as a secondary visual cue. Bind to a device keypair rather than a fingerprint — fingerprints are both privacy-hostile and easy to spoof, and `features.md` tells us to collect only what is genuinely required.

## Notes / decisions log

- 2026-07-19 — Ticket written during initial roadmap population. No implementation decisions yet.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
