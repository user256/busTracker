# Ticket 804: Security Testing, Rate Limiting, and Bot Protection

**Sprint:** 8 — Reliability, Security, and Scale
**Status:** Planned
**Owner:** unassigned
**Estimate:** L

---

## Context

The programme has accumulated every category of thing attackers want: a payment flow, signed ticket credentials worth real money, customer PII, and an admin console that can issue refunds. Security has been handled per-ticket and has never been tested adversarially by anyone who was not also the author. `features.md` calls for rate limiting and bot protection, secure payment and tracking APIs, regular security testing, and dependency management; the Sprint 8 exit criteria single out the tracking and validation endpoints, and for good reason — the positions API is unauthenticated and cheap to scrape, and the 504 validation endpoint is the one an attacker probes to find a ticket code that works. This ticket is the adversarial pass over everything before real passenger traffic arrives.

## Goal

The service is rate-limited, bot-protected, and independently penetration-tested, with all high-severity findings remediated and a dependency-vulnerability process running continuously.

## Acceptance criteria

- [ ] One versioned endpoint-abuse registry is authoritative and preserves or deliberately revises earlier contracts with owner sign-off: validation defaults to 60/min per validator credential, 10/min per ticket and 300/min per IP (504); positions 120/min per IP; planner 30/min per IP; passenger login 10 failures/15 min per account and 100/hour per IP (601); checkout 10/hour per account or normalized guest identity. Shared-state tests prove the same figures across autoscaled instances and prevent a later ticket silently contradicting an earlier one.
- [ ] Bot protection covers account registration, login, password reset, contact/support forms, and checkout using a privacy-respecting challenge (e.g. Turnstile/hCaptcha) that never blocks a keyboard-only or screen-reader user, plus server-side detection of credential-stuffing patterns that triggers step-up challenge rather than a silent block.
- [ ] An external penetration test is commissioned against a production-equivalent staging environment covering the public site, payment/ticketing, tracking/validation APIs, and admin surfaces protected by 400 and assured by 801; the private report is stored outside this public repository, a redacted remediation index is filed in `docs/security/`, every critical/high is fixed and retested, and every medium is fixed or accepted with owner/date.
- [ ] Automated security scanning runs in CI on every push and blocks merge on new critical/high issues: SAST (CodeQL or Semgrep), dependency scanning (`npm audit` plus Dependabot/Renovate), container image scanning (Trivy), and secret scanning (gitleaks) across full history; a documented SLA commits to patching critical dependency vulnerabilities within 7 days and high within 30.
- [ ] A ZAP baseline scan runs against staging in CI and passes with no medium-or-above alerts; security headers are verified by test on every response — HSTS with `max-age` ≥ 31536000 and `includeSubDomains`, a CSP with no `unsafe-inline` in `script-src`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and a restrictive `Permissions-Policy`. HTTPS is enforced service-wide with plain HTTP redirected and no mixed content.
- [ ] The OWASP Top 10 is covered by explicit regression tests rather than assertion — parameterised-query enforcement, output encoding/XSS, CSRF tokens on all state-changing form posts, IDOR probes attempting to read another customer's order and ticket by ID (must return `404`/`403`, never the object), SSRF protection on any user-supplied URL, and file-upload validation on 604 evidence uploads (type allowlist, size cap, out-of-webroot storage, no execution).
- [ ] Ticket-fraud controls hold under adversarial load: replayed, tampered, and expired QR payloads are rejected by 504; a brute-force campaign against the validation endpoint is rate-limited and alerted within 60 seconds; and validation attempts are logged with enough context to reconstruct an attack, without logging the signing key or full ticket payload.
- [ ] Secrets management is verified: no secret is present in git history or in client-side bundles, all secrets come from the platform secret store, a documented rotation procedure exists for the ticket signing key, payment provider keys, and database credentials, and the ticket signing key rotation is performed once without invalidating in-flight valid tickets.

## Out of scope

- Formal compliance certification (PCI DSS attestation beyond SAQ-A, ISO 27001, SOC 2) — explicitly out of scope at the sprint level.
- Building staff identity, MFA, RBAC, and audit — 400; staff-specific assurance is 801.
- WAF rule tuning beyond an initial managed ruleset, and DDoS mitigation beyond what the CDN provides by default.
- Remediating low-severity pen-test findings, which may be ticketed forward.

## Dependencies

- **Blocks:** 899
- **Blocked by:** 106, 400, 504, 601, 801
- **External:** penetration-testing firm engaged and scheduled with a written scope and rules of engagement (lead time is typically weeks — book early); bot-protection vendor account; a production-equivalent staging environment with realistic seeded data and no production PII; hosting provider's WAF/DDoS tier.

## Approach (optional)

Implement rate limiting at the edge/CDN for coarse IP-level protection and in the application for per-account and per-device limits, since the interesting abuse cases are authenticated and will not be caught by an IP counter. Keep the counters in shared storage (Redis or the platform's equivalent) — per-instance limits are effectively no limits once 802's autoscaling is on. Book the pen test at sprint start, not sprint end; the remediation window is the part that overruns. When rate-limiting the tracking API, be careful not to break the legitimate 10s refresh loops in 203 and 701 — derive the limits from real client behaviour rather than picking round numbers, and have the load test from 802 run with limits enabled to catch it.

## Notes / decisions log

- 2026-07-19 — Ticket written during initial roadmap population. No implementation decisions yet.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
