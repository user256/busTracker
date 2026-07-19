# Ticket 603: Privacy, Consent, and Data Rights

**Sprint:** 6 — Accounts and Support
**Status:** Planned
**Owner:** unassigned
**Estimate:** M

---

## Context

By the end of Sprint 5 we hold purchase records, device bindings, validation histories with vehicle and route context, and IP addresses; Sprint 6 adds accounts, saved passengers, and concession references. That is a detailed picture of where individual people travel and when. `features.md` §4 requires personal-data download and account deletion, and the security-and-privacy section requires data-retention policies, consent and cookie management, and procedures for data-access and deletion requests — closing with the instruction to *collect only the location and personal information genuinely required*. Ticket 001's jurisdiction determines statutory deadlines and lawful retention, so this cannot be a manual process a developer performs with psql or a hard-coded UK/EU assumption.

## Goal

Passengers can see, export, and delete their personal data through self-service flows that respect statutory deadlines, with consent captured properly and a documented, enforced retention policy covering every table that holds personal data.

## Acceptance criteria

- [ ] A data inventory at `docs/data-inventory.md` lists every table and field holding personal data with purpose, lawful basis, retention period, and source ticket; a CI check fails the build if a migration adds a table matching a personal-data heuristic (columns named `email`, `phone`, `ip`, `device`, `lat`/`lon`, `name`) without a corresponding inventory entry.
- [ ] Data minimisation is applied and evidenced, not asserted: the review removes or truncates anything not genuinely required — precise passenger location is never stored for tracker use (viewport queries from 106 are not logged against an identity), IP addresses in analytics are truncated to /24 (IPv4) and /48 (IPv6), and 504's validation audit retains route/vehicle context but no passenger location trail beyond the validation event.
- [ ] `POST /api/account/data-export` produces a machine-readable JSON bundle plus human-readable summary covering account, orders, tickets, validation history, support cases, preferences, and consent records; it is generated asynchronously, delivered via an expiring signed download link (7 days, single account, re-authentication required), and completes within 72 hours with a test asserting the bundle contains a row for every table listed in the data inventory.
- [ ] `POST /api/account/delete` runs a two-step confirmed deletion with a 14-day grace period during which login cancels it; on execution it deletes or irreversibly anonymises account, credentials, sessions, saved passengers, favourites, preferences, and support cases, and revokes active tickets — a test asserts that after deletion no query by the original email returns a row in any inventoried table.
- [ ] Records under a legal retention obligation are retained rather than deleted, and this is stated to the passenger before they confirm: financial transaction records (orders, payments, refunds, invoices) are retained for the statutory period with personal identifiers replaced by a pseudonymous key, and the deletion confirmation screen names exactly what survives and for how long.
- [ ] A retention job (`npm run retention:apply`, scheduled daily) enforces every period in the inventory — validation audit rows, session records, webhook event payloads, support attachments, and analytics — deleting or anonymising on schedule, writing a `retention_runs` summary of rows affected per table, and running dry (`--dry-run`) in CI against seeded fixtures to assert it neither over- nor under-deletes.
- [ ] Cookie and consent management is real: no non-essential cookie or third-party script (analytics, marketing) loads before explicit opt-in, consent is granular by category with reject-all as prominent as accept-all, choices are versioned and stored with timestamp and policy version in a `consent_records` table, and a test asserts a fresh session sets no non-essential cookie until consent is given. A privacy notice, cookie notice, and documented subject-request procedure (covering requests arriving by email or post, and identity verification for them) are published, linked from the footer and checkout, and name the responsible owner and statutory deadline.
- [ ] `npm test -- privacy` passes, covering export completeness against the inventory, deletion completeness and the financial-retention exception, grace-period cancellation, retention job boundaries at `retention_days ± 1`, and the pre-consent no-cookie assertion.

## Out of scope

- Staff-side data-request tooling and audit trails — 704.
- Formal compliance certification, DPIA authoring, or appointing a DPO. This ticket delivers the mechanisms and the documentation; formal governance is the operator's.
- Legal and accessibility policy pages as site content — 805 (this ticket supplies the privacy and cookie notice text; 805 owns the publishing surface).
- Data-residency changes, encryption-at-rest infrastructure, or backup handling of deleted records beyond documenting the backup retention window.
- Consent for staff or admin users.

## Dependencies

- **Blocks:** 699
- **Blocked by:** 601
- **External:** legal sign-off on the privacy notice, cookie notice, lawful-basis mapping, and every retention period; the operator's statutory record-keeping requirements from finance; confirmation of which analytics platform (if any) will be used, since it determines the consent categories.

## Approach (optional)

Build the inventory first and derive everything from it — export, deletion, and retention should all iterate the same registry so a new table cannot be quietly forgotten by one of the three. Prefer anonymisation over deletion where a foreign key must survive: replacing an account id with a pseudonymous key keeps the financial ledger and the 505 reconciliation intact without keeping a person. The CI guard on new personal-data tables is the control that stops this decaying six months after the ticket closes.

## Notes / decisions log

- 2026-07-19 — Ticket written during initial roadmap population. No implementation decisions yet.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
