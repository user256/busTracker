# Ticket 504: Ticket Validation API and Fraud Controls

**Sprint:** 5 — Ticketing and Payments
**Status:** Planned
**Owner:** unassigned
**Estimate:** M

---

## Context

This is the endpoint that gets attacked. It is internet-facing, it says yes or no to money, and the people probing it will include passengers with a screenshot, a forum thread on how to spoof it, and eventually someone scripted. `features.md`'s Ticket security section names the controls directly: server-side validation, protection against duplicate use, fraud monitoring, complete audit logs, and rate limiting around validation endpoints. 503 gives us a cryptographically sound credential; a credential is only as good as the check performed on it. It must also fail in a defined direction — an inspector on a moving bus with two bars of signal needs a verdict in well under a second, and a timeout must not become a free ride or a wrongly accused passenger.

## Goal

A hardened server-side validation endpoint that verifies a 503 token, consumes it exactly once per validation window, resists replay and brute force under load, and writes an immutable audit record for every attempt, valid or not.

## Acceptance criteria

- [ ] `POST /api/validate` accepts `{token, validatorId, routeId?, vehicleId?, scannedAt}` authenticated by a validator-scoped credential (mTLS client cert or a rotating validator API key — never a shared static secret), and returns `{result: "valid"|"invalid", reason, ticket:{productName, passengerClass, expiresAt, photoRequired}, validationId}` with p95 latency under 300ms measured at the API edge.
- [ ] Validation is strictly server-side and ordered: signature check → key-id validity → `exp`/`iat` window (reject if `now > exp` or `iat > now + 5s` clock skew) → ticket status is `active` → device binding matches → replay check. Each failure returns a distinct machine reason (`bad_signature`, `token_expired`, `ticket_revoked`, `ticket_not_activated`, `device_mismatch`, `replay_detected`) and the reason is logged even when the passenger-facing message is generic.
- [ ] Replay/duplicate-use protection: the token `nonce` is inserted into a `validation_nonces` table (or Redis set) with a unique constraint and a TTL matching token lifetime plus skew; a second presentation of the same nonce returns `replay_detected`. A test firing 100 concurrent requests with one identical token asserts exactly one `valid` and 99 `replay_detected` — no read-then-write race. Per-ticket reuse policy is configurable per fare product on top of this: a single ticket validates once per journey (later scans in the ride window return `already_validated` with the original timestamp, which is *not* a fraud signal), while a day/period ticket permits repeat validation but flags more than 8 distinct-vehicle validations per hour for review.
- [ ] Rate limiting is layered and tested: 60 requests/minute per validator credential, 10/minute per ticket id, and 300/minute per source IP, all returning `429` with `Retry-After`; limits are enforced in shared state (Redis) so they hold across instances, and a load test asserts the limiter holds at 20x normal peak without the endpoint falling over.
- [ ] Every attempt writes an append-only row to `validation_audit` (validation_id, ticket_id, nonce, validator_id, result, reason, route/vehicle, source IP, received_at, server clock, token iat/exp); the table is insert-only (no UPDATE/DELETE grant for the app role), retained per the 603 retention policy, and a documented query reconstructs the full history of any ticket.
- [ ] Fraud monitoring runs off that audit table: rules for the same ticket validating on two vehicles more than 5km apart within 10 minutes (PostGIS distance against the 106 position data), a spike in `bad_signature` or `device_mismatch` from one IP or validator, and abnormal validations-per-ticket; matches raise alerts to a staff queue with the evidence attached rather than auto-blocking a passenger mid-journey.
- [ ] Failure behaviour is defined and documented, not emergent: the initial online-only validator fails closed with `503 validation_unavailable` when authoritative ticket state, nonce consumption, or audit persistence is unavailable; the scanner contract gives staff a clear operational message and never converts an infrastructure failure into `valid` or `invalid`. Any later offline policy requires its own approved ticket and threat model.
- [ ] `npm test -- validation` and `npm run test:load -- validation` pass, covering every reason code, the concurrency race, clock-skew boundaries, rate-limit thresholds, audit completeness (an assertion that no code path returns without writing an audit row), and the degraded-mode path.

## Out of scope

- Token minting, rotation, activation, and device binding — 503.
- The inspector-facing scanning app or hardware, and all offline validation/device provisioning.
- Staff fraud-investigation UI and case handling — 704.
- Penalty fares, enforcement workflow, or anything that happens after a passenger is found without a valid ticket.
- Site-wide bot protection and WAF configuration — 804 (this ticket rate-limits itself; 804 generalises it).

## Dependencies

- **Blocks:** 599
- **Blocked by:** 500, 503
- **External:** validator device credential-provisioning process agreed with operations; confirmation of the inspector workflow (do they scan every passenger or spot-check?) since it sets the throughput target; legal sign-off on the fraud policy and what evidence may be retained about a passenger.

## Approach (optional)

Treat this endpoint as untrusted-input-only and put nothing behind it that a bad token can reach — verify the signature before any database lookup so an unauthenticated flood costs us a 64-byte Ed25519 check, not a query. Nonce consumption must be a single atomic write with a unique constraint; anything involving a SELECT before the INSERT is a race and will be exploited. Log first, decide second: the audit write is part of the request path, not a fire-and-forget. Fraud rules alert humans rather than blocking automatically — a false positive that strands a paying passenger on a dark road at 23:00 is a worse outcome than a free ride.

## Notes / decisions log

- 2026-07-19 — Ticket written during initial roadmap population. No implementation decisions yet.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
