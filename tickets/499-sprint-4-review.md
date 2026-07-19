# Ticket 499: Sprint 4 Review and Go/No-Go

**Sprint:** 4 — Service Alerts and Disruptions
**Status:** Planned
**Owner:** unassigned
**Estimate:** S

---

## Context

Sprint 4 completes the passenger-information product: passengers can track a bus, plan a journey, and now find out when something has gone wrong. It also introduces the programme's first outbound-messaging capability, which carries risks none of the earlier sprints did — a subscription bug does not just render a wrong page, it sends real messages to real people and costs real money per SMS. Sprint 5 turns the site commercial, and that is a step change in obligation: once money is involved, an incorrect disruption notice becomes a refund dispute. This gate asks whether the disruption layer is trustworthy enough to sell tickets in front of, and whether the notification pipeline is safe enough to leave running unattended. "No" is a permitted outcome.

## Goal

The team makes and records an explicit Go/No-Go decision on whether the disruption and notification layer is correct, safe, and cheap enough to run before Sprint 5 begins taking payments.

## Acceptance criteria

- [ ] Every Sprint 4 exit criterion in `tickets/overview.md` is assessed in a written table with a `met` / `partially met` / `not met` verdict and named evidence (URL, test name, or measurement) per row.
- [ ] A live disruption drill is run and recorded end to end: a staff-authored alert and a feed-sourced alert are each created, then verified to appear on the affected route page, stop page, map, planner results, and — for the major-severity case — the site-wide banner, with the observed latency from creation to visible on each surface.
- [ ] Notification delivery is evidenced against a test cohort covering email, SMS, and web push: delivery rate, median time from alert creation to receipt, and confirmation that no duplicate was sent for a single alert version and that one-click unsubscribe took effect before the next dispatch.
- [ ] A fan-out cost and safety assessment is recorded: measured per-alert message volume, projected SMS cost for a worst-case major incident against the operator's agreed budget, and confirmation the global dispatch cap halts rather than overspends.
- [ ] The GTFS-RT ServiceAlerts feed is assessed for real-world quality over at least 14 days of ingest — alert volume, proportion with resolvable informed entities, proportion with explicit end times, and whether the operator actually uses it or authors manually — with a stated conclusion on whether the feed can be relied on or staff authoring is the primary path.
- [ ] A written **Go / No-Go / Go-with-conditions** decision is recorded in this ticket's notes log with the date, the named decision-maker, and reasoning covering why the other two outcomes were rejected.
- [ ] The consequences of "No" are written down before the decision is taken: Sprint 5 does not start; notification dispatch is disabled at the flag rather than left running in a known-broken state; the specific surfaces or channels to be withheld from public use are named; remedial tickets are filed against Sprint 4 with a re-review date; and stopping the programme at an information-only product — with no ticket sales — is explicitly considered and its rejection justified.
- [ ] All Sprint 4 follow-up work is filed as numbered tickets, and `tickets/overview.md` bullets for 400–406 reflect true status.

## Out of scope

- Implementing any remediation identified — this ticket decides and files.
- Sprint 5 fare, checkout, or payment-provider design decisions.
- Contract negotiation with SMS or email providers beyond recording the cost finding.

## Dependencies

- **Blocks:** 500, 501
- **Blocked by:** 400, 401, 402, 403, 406
- **External:** operator sign-off that disruption wording and the banner-promotion threshold are acceptable for public use; the agreed SMS budget; a named decision-maker with authority to stop the programme.

## Approach (optional)

Run the disruption drill against the real feed on a real incident if one occurs during the sprint — a synthetic alert proves the plumbing but not the operator's actual publishing behaviour, and the feed-quality assessment is the finding most likely to change the plan. Do the fan-out cost projection with real subscriber growth assumptions before Go, not after the first snow day.

## Notes / decisions log

- 2026-07-19 — Ticket written during initial roadmap population. No implementation decisions yet.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
