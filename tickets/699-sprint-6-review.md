# Ticket 699: Sprint 6 Review and Go/No-Go

**Sprint:** 6 — Accounts and Support
**Status:** Planned
**Owner:** unassigned
**Estimate:** S

---

## Context

Sprint 6 turned us into a data controller with a real support obligation. Where 599 asked whether we could safely take money, this gate asks whether we can safely hold people's identities, travel histories, and complaints — and whether a passenger who wants out can actually get out. Sprint 7 builds staff tooling on top of all of it, which means a "go" here also commits us to exposing this data to staff accounts. The failure modes are quiet ones: an export that misses a table, a deletion that leaves rows behind, a support queue with no one watching the SLA. This gate exists to find them before the operator's first subject-access request does.

## Goal

A recorded Go/No-Go decision on whether accounts, privacy mechanisms, and support handling are fit to operate with real passengers, with evidence attached and the consequences of a "no" spelled out.

## Acceptance criteria

- [ ] Every Sprint 6 exit criterion in `tickets/overview.md` is walked one by one and marked met / partially met / not met with linked evidence: register, verify, log in, recover access; active and expired tickets manageable from an account; receipts and invoices downloadable; data download and account deletion working end to end; support enquiries producing a case reference and a tracked response.
- [ ] An end-to-end demo is recorded covering: guest purchase from Sprint 5 → register with that email → verify → guest order claimed → active ticket shown from the account in one tap → receipt and invoice downloaded → support case raised with an attachment and a reference issued → data export requested and inspected → account deleted and the survival of financial records verified.
- [ ] A privacy assurance pack is attached: the `docs/data-inventory.md` review signed off by legal, a data export diffed against the inventory showing full coverage, a deletion run proving no inventoried table retains the passenger, and one `npm run retention:apply --dry-run` output reviewed for correctness.
- [ ] Security review of the identity and support paths is complete: authentication, session handling, ownership authorisation on every account endpoint, and file-upload handling reviewed, with each finding either fixed or filed in the 8xx block with an owner and a date.
- [ ] Operational readiness is confirmed, not assumed: someone is named as owner of the support queue, SLA targets are agreed and monitored, and the subject-request procedure has a named responsible person and a tested path for requests arriving outside the account.
- [ ] Open defects and known gaps are listed with severity and each classified as launch-blocking or accepted-for-now, with accepted risks naming the person accepting them.
- [ ] The gate decision is recorded as one of **Go** (proceed to Sprint 7), **Conditional Go** (proceed with a named must-fix list and deadline), or **No-Go**, with reasoning and date, written into this ticket's notes log and reflected in `tickets/overview.md`.
- [ ] The consequences of **No-Go** are written down before the decision is taken: Sprint 7 does not start, staff tooling is not built over an identity layer we do not trust, remediation tickets are filed in the 6xx block at the next free numbers (`605`, `606`, …), a re-review date is set, and — if the gap is privacy or data-rights rather than polish — public launch of ticketing is paused until it is closed, which is recorded as a valid outcome per the roadmap's stop-here principle.

## Out of scope

- Fixing the defects found. This ticket surfaces and classifies them; remediation is separate tickets.
- Staff-side administration, audit trails, and the customer-service console — Sprint 7.
- Load, availability, and scale testing of the account and ticket surfaces — 802 and 803.
- Formal compliance certification or external audit.

## Dependencies

- **Blocks:** 701, 702, 703, 704, 705, 799
- **Blocked by:** 601, 602, 603, 604
- **External:** legal sign-off on the privacy notice, retention periods, and complaints procedure must be in hand or explicitly deferred with a date; the operator must name the support-queue owner and the subject-request responsible person before the gate can pass.

## Approach (optional)

Run it as a live session with the demo played end to end, including the deletion — watching a real account disappear is the only convincing evidence that deletion works. Prepare the privacy pack before the meeting so legal can review asynchronously and attend only to decide. Record the decision the same day in this file and in `tickets/overview.md`.

## Notes / decisions log

- 2026-07-19 — Ticket written during initial roadmap population. No implementation decisions yet.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
