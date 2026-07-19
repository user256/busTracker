# Ticket 599: Sprint 5 Review and Go/No-Go

**Sprint:** 5 — Ticketing and Payments
**Status:** Planned
**Owner:** unassigned
**Estimate:** S

---

## Context

Sprint 5 is the first time this system touches real money and real fraud exposure. Every other sprint gate asks "is this good enough to build on?"; this one also asks "is this good enough to be liable for?" If fare rules are wrong we overcharge passengers; if validation is weak we lose revenue quietly for months; if reconciliation drifts we cannot answer a finance or regulator question. Sprint 6 is scoped to depend on this sprint for ticket ownership, so passing this gate commits us to accounts built on top of it. This ticket forces an explicit, recorded decision — and "no" is a legitimate answer that has real consequences.

## Goal

A recorded Go/No-Go decision on whether ticketing and payments are safe to take real passenger money, with evidence attached and the consequences of a "no" spelled out.

## Acceptance criteria

- [ ] Every Sprint 5 exit criterion in `tickets/overview.md` is walked one by one and marked met / partially met / not met with evidence, including guest purchase (account checkout is explicitly Sprint 6), policy/version consent, public fare integration, disruption checks, secure guest recovery, SCA, signed rotating server-validated codes, duplicate-use controls, and refund/payment recovery.
- [ ] An end-to-end demo is recorded on a real mobile handset covering: quote → guest checkout with 3DS challenge → receipt → ticket activation → rotating QR → successful validation → attempted replay of a screenshot (must fail) → partial refund → ticket revoked and validation now rejected.
- [ ] A payments assurance pack is attached: proof of zero card data in our systems (CSP and network trace), the idempotency concurrency test results from 502, the replay concurrency test from 504, and one clean reconciliation run from 505 with a deliberately seeded discrepancy detected.
- [ ] Security review of the money, guest-access, and credential paths is complete across 502–505 and 508; every critical/high launch finding is fixed before Go, while lower findings may be accepted or filed with owner and date.
- [ ] Open defects and known gaps are listed with severity, and each is explicitly classified as launch-blocking or accepted-for-now; accepted risks name the person accepting them.
- [ ] The gate decision is recorded as one of **Go** (proceed to Sprint 6), **Conditional Go** (proceed with a named list of must-fix items and their deadline), or **No-Go**, with reasoning and the date, written into this ticket's notes log and reflected in `tickets/overview.md`.
- [ ] The consequences of **No-Go** are written down before the decision is taken, not after: Sprint 6 does not start, 602's dependency on ticket ownership is unmet, remediation tickets are filed in the 5xx block at the next free numbers (`506`, `507`, …), and a re-review date is set. If the failure is that fare/ticketing complexity exceeds commercial value, "stop selling tickets on this platform" is recorded as a valid programme outcome per the roadmap's stop-here principle.
- [ ] Follow-up work discovered during the sprint is filed as new tickets rather than carried informally, and any resequencing of Sprints 6–8 arising from this review is written into `tickets/overview.md`.

## Out of scope

- Fixing the defects found. This ticket surfaces and classifies them; remediation is separate tickets.
- Load and stress testing at full peak scale — 802 and 803.
- Commercial pricing decisions (what fares should actually be). The gate reviews the machinery, not the fare table.
- Sprint 6 planning detail beyond the go/no-go and any resequencing it forces.

## Dependencies

- **Blocks:** 601, 602, 603, 604, 699
- **Blocked by:** 500, 501, 502, 503, 504, 505, 506, 507, 508
- **External:** the operator's commercial owner and a finance representative must attend the gate; Ticket 500's conditions of carriage, refund policy, eligibility and fraud policy must be signed off. Missing binding policy is a No-Go, not a deferred launch condition.

## Approach (optional)

Run it as a single scheduled session with the demo played live, not as an async document nobody reads. Prepare the evidence pack first so the meeting spends its time on judgement rather than screen-sharing test output. Write the decision down in this file the same day — an undocumented gate is an ungated sprint.

## Notes / decisions log

- 2026-07-19 — Ticket written during initial roadmap population. No implementation decisions yet.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
