# Ticket 508: Guest Ticket Access and Recovery

**Sprint:** 5 — Ticketing and Payments
**Status:** Planned
**Owner:** unassigned
**Estimate:** M

---

## Context

Guest checkout is required before passenger accounts exist, but the original tickets never defined how a guest securely opens, activates, reopens, or recovers a ticket without an enumerable order URL. Email delivery alone is not an authorization model and fails exactly when a passenger closes a tab or changes device.

## Goal

A guest purchaser can securely access and recover their order, receipt, and tickets without an account or guessable identifier.

## Acceptance criteria

- [ ] A paid guest order issues a single-purpose, hashed-at-rest access token through the verified checkout email; the token establishes a scoped guest session and is never accepted as a bare order reference.
- [ ] Guest sessions can view order state, receipt, issued tickets, activation state, and code endpoint only for that order; cross-order and token-enumeration tests return `404` without leaking existence.
- [ ] Recovery sends a fresh link with an enumeration-safe response, rate limits by email and IP, invalidates older recovery links, and records a security event without logging the token.
- [ ] Device transfer follows 503's policy with re-verification of the purchase email and does not allow possession of an old link alone to take over an active ticket.
- [ ] Registration under 601 claims the order only after email verification, revokes outstanding guest sessions, and preserves ticket state and audit history.

## Out of scope

- Passenger accounts — 601 and 602.
- Offline ticket display or validator applications.

## Dependencies

- **Blocks:** 599, 601
- **Blocked by:** 500, 502, 503
- **External:** transactional email provider and operator-approved guest recovery wording.

## Notes / decisions log

- 2026-07-19 — Added because guest purchase existed without a secure post-checkout access path.

---

## Definition of done

This ticket is closeable when guest access, recovery, takeover resistance, and later account claim pass end to end.
