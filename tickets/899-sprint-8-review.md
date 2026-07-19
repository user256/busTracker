# Ticket 899: Sprint 8 Review and Go/No-Go

**Sprint:** 8 — Reliability, Security, and Scale
**Status:** Planned
**Owner:** unassigned
**Estimate:** S

---

## Context

This is the last gate in the roadmap, and it carries two decisions rather than one. The narrow decision is whether Sprint 8 met its assurance criteria — staff access proven fail-closed, CDN-served timetables, graceful degradation, rate limiting, security testing, and completed legal/accessibility content. The broader decision is whether the full programme may move from any earlier controlled or capability-limited releases to unrestricted passenger traffic and payment at the intended scale. Every prior gate could constrain a release; this one decides whether those constraints can be removed.

## Goal

The team decides whether the service is fit to carry public passenger traffic and payment, assessed against both the Sprint 8 exit criteria and the Programme Exit Criteria.

## Acceptance criteria

- [ ] Every Sprint 8 ticket (801–805) is Done, or explicitly deferred with a written reason and a new ticket number recorded in this ticket's decisions log.
- [ ] Each Sprint 8 exit criterion in `overview.md` is evidenced by an artefact, not an opinion: the fail-closed authorisation test output (801), edge cache-hit ratios and the load-test report (802), the chaos-test results and SLO dashboards (803), the penetration-test report with its remediation status (804), and the published, legally signed-off policy pages (805).
- [ ] The tier-1 availability claim is verified end to end: journey planner, active tickets, and service alerts each hold their 99.9% target under the 802 peak load test **with 804's rate limits enabled**, and each still serves correct degraded content with its dependencies blocked. Failure of any of the three is an automatic No-Go.
- [ ] All critical and high penetration-test findings are closed and retested, with evidence attached; any open medium finding has a named owner, an accepted-risk statement, and a date. An unremediated critical or high finding is an automatic No-Go.
- [ ] Each of the six **Programme Exit Criteria** in `overview.md` is assessed individually and marked met / partially met / not met with supporting evidence, including the two that no single sprint owns — that integrations fail safely and visibly, and that the service stays up on its busiest, worst day.
- [ ] Operational readiness is confirmed: on-call rota staffed and agreed, incident runbooks rehearsed at least once (803), the database restore actually performed and verified (802), a documented rollback path for a bad deploy, and a named decision-maker for taking the site down.
- [ ] A launch-risk register is produced listing every known open risk with severity, owner, and mitigation, and is reviewed with the operator; deferred programme scope (multi-region, formal certification, subscriptions, family accounts, occupancy, multi-operator ticketing) is restated so nobody launches believing it is present.
- [ ] A recorded Go / No-Go / Go-with-conditions decision is written into this ticket's decisions log with the date, attendees, and reasoning. **"No" is a valid and expected outcome.** No-Go means the service does not open to public traffic: failing criteria are re-ticketed with owners, a remediation sprint is scheduled, and this gate is re-run against the same evidence bar. Go-with-conditions must name each condition, its owner, its date, and the specific limitation accepted at launch (for example a soft launch on a subset of routes, or ticket sales held back while tracking goes live) — and if a condition is that some capability stays disabled, that must be enforced in configuration, not by intention.

## Out of scope

- Implementing fixes found during the review — findings become tickets.
- Launch marketing, comms, and cutover scheduling, which follow this decision rather than form part of it.
- Post-launch operations, iteration, and the roadmap beyond this programme.

## Dependencies

- **Blocks:** none
- **Blocked by:** 801, 802, 803, 804, 805
- **External:** the operator's accountable decision-maker present and empowered to say no; legal counsel's confirmation that 805 sign-off is complete; the penetration-testing firm's retest report; sign-off from whoever owns commercial risk on taking live payments.

## Approach (optional)

Assemble the evidence pack before the meeting and circulate it in advance — a gate where the evidence is presented for the first time in the room is a gate that approves whatever it is shown. Assess the Programme Exit Criteria against the passenger's experience rather than the system's internals: "passengers can trust what the map tells them" is answered by whether the freshness labelling holds when the feed degrades, not by whether the positions API returns `200`. Write the decision down, including the dissent.

## Notes / decisions log

- 2026-07-19 — Ticket written during initial roadmap population. No implementation decisions yet.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
