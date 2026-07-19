# Ticket 601: Registration, Login, and Credential Recovery

**Sprint:** 6 — Accounts and Support
**Status:** Planned
**Owner:** unassigned
**Estimate:** M

---

## Context

Sprint 5 sells tickets to email addresses. That works for a single journey and falls apart the moment a passenger changes phone, loses a ticket, or wants a receipt from three months ago. `features.md` §4 asks for registration, secure login, email verification and password reset. This is also the point where we start holding personal data properly, so the identity layer has to be right before 602 hangs ticket ownership off it and 603 has to export and delete it. Account takeover here is not a nuisance — it hands an attacker someone's travel history and their saved payment methods at the provider.

## Goal

Passengers can register, verify their email, log in securely, recover access when they lose their credentials, and claim guest orders made with the same email — with session and credential handling that stands up to a hostile review.

## Acceptance criteria

- [ ] Migrations create `accounts`, `account_credentials`, `sessions`, `email_verification_tokens`, and `password_reset_tokens`; passwords are hashed with Argon2id (memory ≥ 64MiB, iterations ≥ 3, parallelism 1) with a per-user salt, and a test asserts no code path logs, returns, or stores a plaintext password.
- [ ] `POST /api/auth/register` requires email + password, enforces a minimum length of 12 characters with no composition rules, checks the password against a breached-password list (k-anonymity range query against HIBP or a local bloom filter), and always returns the same `202` response whether or not the email already exists — enumeration is closed at registration, login, and reset alike.
- [ ] Email verification is mandatory before an account can hold tickets: `POST /api/auth/verify` consumes a single-use, 32-byte random token, hashed at rest, expiring in 24h; unverified accounts can log in but cannot claim orders, and a resend endpoint is rate-limited to 3/hour per address.
- [ ] Sessions are server-side records referenced by an opaque cookie — `HttpOnly`, `Secure`, `SameSite=Lax`, `__Host-` prefixed — with 30-day absolute and 14-day idle expiry, rotated on privilege change; `GET /api/account/sessions` lists active sessions with device and last-used, and `DELETE` revokes one or all. Logout invalidates server-side, not just the cookie.
- [ ] Password reset issues a single-use, 32-byte, hashed, 30-minute token, invalidates all existing sessions and outstanding reset tokens on success, emails a "your password was changed" notification, and returns an identical response for known and unknown addresses; reset requests are rate-limited to 5/hour per address and 20/hour per IP.
- [ ] Brute-force defence is layered and tested: 10 failed logins per account per 15 minutes triggers exponential backoff, 100 failed logins per IP per hour returns `429`, and credential-stuffing patterns (many distinct accounts from one IP) alert; lockout never permanently locks a passenger out of their own account without a recovery path.
- [ ] Guest-order claiming works: registering or verifying an email that matches prior 502 guest orders links those orders to the account after email verification only — never before — and a test asserts an unverified account cannot claim orders belonging to that address.
- [ ] `npm test -- auth` passes and covers: Argon2 parameters, enumeration-response equality across all three endpoints, token single-use and expiry boundaries, session rotation and revocation, rate-limit thresholds, and the unverified-claim rejection.

## Out of scope

- Social login and passwordless/magic-link login — `features.md` marks these optional and the sprint excludes social login explicitly. File as a later ticket if the operator wants them.
- Two-factor authentication for passengers. Staff MFA is established in 400 and assured in 801.
- Linked family or dependent accounts — explicitly out of scope for Sprint 6.
- Account-area screens (tickets, history, preferences) — 602.
- Data export and deletion — 603.
- Staff/admin authentication and RBAC — 400.

## Dependencies

- **Blocks:** 602, 603, 604, 699
- **Blocked by:** 508, 599
- **External:** transactional email provider (verification, reset, security notifications) with a verified sending domain, SPF/DKIM/DMARC configured; breached-password service access or a local dataset; legal sign-off on the account terms shown at registration.

## Approach (optional)

Build sessions as opaque server-side records rather than JWTs — passengers need "log out everywhere" after a lost phone, and stateless tokens make that a lie. Keep the identity layer boring and standard; there is nothing to invent here and every invention is a vulnerability. Treat email as the recovery channel and therefore as a security boundary: verification before any ticket ownership transfer is the control that stops "register as their email, inherit their tickets".

## Notes / decisions log

- 2026-07-19 — Ticket written during initial roadmap population. No implementation decisions yet.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
