# Ticket 799: Sprint 7 Review and Go/No-Go

**Sprint:** 7 — Admin and Operations
**Status:** Planned
**Owner:** unassigned
**Estimate:** S

---

## Context

Sprint 7's premise is that staff can run the service without a developer in the loop. That is a claim about people and workflows, not just about code shipping — a fare admin screen that technically works but that the commercial team will not use has not removed the developer from the loop. This gate tests the premise with the actual staff who will use the tools, before Sprint 8 spends its budget hardening surfaces that may need to change. It is also the last point at which we can cheaply decide that some of this tooling is not worth maintaining.

## Goal

The team decides, on evidence from real staff performing real tasks, whether the admin tooling genuinely removes developers from routine operations and whether to proceed to Sprint 8.

## Acceptance criteria

- [ ] Every Sprint 7 ticket (701–706) is Done, or explicitly deferred with a written reason and a new ticket number recorded in this ticket's decisions log.
- [ ] Each sprint exit criterion in `overview.md` is assessed against a demonstration, not an assertion: a controller identifies a delayed and an off-route vehicle live; a commercial user creates a fare product and schedules a price change; a marketer takes a page from draft to published; an agent finds an order and resends a ticket; a finance user exports a sales report; and an auditor retrieves the trail for all five actions.
- [ ] A usability session is run with at least one real staff member per role (`ops_controller`, `fares_editor`, `content_editor`, `cs_agent`, `finance`); task completion rate and unaided-completion notes are recorded, and any task that no participant completes unaided is filed as a follow-up ticket.
- [ ] A "developer in the loop" audit is completed: the routine operational tasks from the last notional month are listed, and each is marked as staff-doable, staff-doable-with-training, or still developer-only — with the developer-only list explicitly accepted or ticketed.
- [ ] The audit trail from 400 is spot-checked for completeness across all four writing surfaces (701, 702, 703, 704) and confirmed append-only under attempted mutation; any surface not writing audit entries blocks a Go.
- [ ] Staff MFA/RBAC from 400 is demonstrated fail-closed and admin exposure matches its approved network boundary; Sprint 8 assurance and penetration testing remain outstanding under 801 and 804, but no known missing baseline control is accepted merely because a later test exists.
- [ ] A recorded Go / No-Go / Go-with-conditions decision is written into this ticket's decisions log with the date, the attendees, and the reasoning. **"No" is a valid outcome**: No-Go means Sprint 8 does not start, the failing exit criteria are re-ticketed into Sprint 7, and the admin tooling stays behind a VPN or an allowlist until it passes. Go-with-conditions must name each condition, its owner, and the date by which it is met.

## Out of scope

- Implementing any fix discovered during the review — findings become tickets, not commits on this one.
- Security testing and load testing of the admin surfaces — 804 and 802 own those; this gate only records that they are outstanding.
- Re-litigating the Sprint 1–6 gates.

## Dependencies

- **Blocks:** 801, 802, 803, 804, 805
- **Blocked by:** 400, 701, 702, 703, 704, 705, 706
- **External:** availability of real staff from operations, commercial, marketing, finance, and customer service for the usability sessions; the operator's decision-maker present for the Go/No-Go.

## Approach (optional)

Run the demonstration against a staging environment seeded with realistic volumes, not a five-row fixture — most admin usability failures only appear once a search returns 400 results. Have the staff drive; if an engineer's hands are on the keyboard, the test has told you nothing.

## Notes / decisions log

- 2026-07-19 — Ticket written during initial roadmap population. No implementation decisions yet.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
