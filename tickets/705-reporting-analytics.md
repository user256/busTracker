# Ticket 705: Reporting and Analytics

**Sprint:** 7 — Admin and Operations
**Status:** Planned
**Owner:** unassigned
**Estimate:** M

---

## Context

The operational tools built earlier in this sprint answer "what is happening right now". Nobody can yet answer "how did last month go" — which route sold, where the journey planner is failing to find results, what proportion of payments failed, or whether the tracker was actually available when passengers needed it. Those questions come from finance, from the operator's board, and increasingly from whoever has to justify the tracking feed contract. Answering them ad hoc with SQL against production is both slow and, once the audit constraints from 704 exist, the wrong access pattern. This ticket delivers a small, honest set of reports over data the earlier tickets already produce.

## Goal

Staff can view and export sales, performance, support, and availability reporting over a chosen date range without a developer writing a query.

## Acceptance criteria

- [ ] A sales report breaks ticket sales down by route, product, passenger class, date, and channel (web guest / web account), showing units and gross/discount/net revenue, and reconciles to the 702 transaction browser totals for the same range to the penny — asserted by a test comparing both figures over a seeded month.
- [ ] A revenue and refund report shows gross, refunds, chargebacks, and net by day and by product, with refunds attributed to the period of the original sale as well as the period of the refund, and both attributions clearly labelled.
- [ ] A demand report covers journey-planner searches (total, zero-result rate, top origin/destination pairs), most-viewed routes and stops, and site conversion rate (sessions → checkout started → payment completed) with each funnel stage defined in the report's own footnote.
- [ ] An operations report shows payment-failure rate by reason code, real-time tracking availability (percentage of scheduled service minutes with a live position, derived from 105/106), and on-time performance by route (percentage of stop arrivals within the operator's threshold, default −1/+5 minutes), with the threshold shown on the report.
- [ ] A support report shows case volume by category, median and p90 time to first response and to resolution, complaint outcomes, and service-alert engagement (subscription counts and notification delivery/open rates from 403).
- [ ] Every report exports to CSV with the applied date range and filters embedded in the file header, and an export over a 12-month range completes in under 60 seconds without blocking customer-facing queries — reports read from a replica or a nightly-refreshed aggregate, never from the primary under load.
- [ ] Reporting access is role-restricted (`finance` sees revenue, `ops_controller` sees performance, `cs_lead` sees support, `admin` sees all), reports contain no direct customer PII beyond an order reference, and each report run and export writes a 704 audit entry.
- [ ] Accessibility and web-performance monitoring (Core Web Vitals — LCP, INP, CLS — collected as real-user metrics, plus the latest automated accessibility scan result from 208) is visible on a dashboard tile with a 28-day trend.

## Out of scope

- Advanced operational analytics, predictive demand modelling, and cohort/retention analysis — explicitly deferred at the programme level.
- Building a general-purpose BI tool, ad-hoc query builder, or self-serve dashboard designer. Fixed reports only.
- Piping data to an external warehouse or analytics vendor; if that is wanted it is a separate ticket with its own privacy review.
- Financial reconciliation against the accounting system and tax reporting.

## Dependencies

- **Blocks:** 799
- **Blocked by:** 400, 701, 702, 704
- **External:** finance agreement on the revenue-recognition treatment of refunds spanning periods; the operator's official on-time-performance definition (it may be contractually specified); DPO review of what appears in exportable reports.

## Approach (optional)

Compute the heavy aggregates in a nightly job into summary tables keyed by date and dimension, and serve reports from those; only the current partial day is computed live. That keeps the 60-second export bound achievable and, more importantly, keeps reporting off the transaction path — a finance export must never be able to slow down checkout. Real-user Core Web Vitals need a lightweight beacon endpoint on the public site, which is new surface; keep it fire-and-forget, unauthenticated, sampled, and rate-limited, and hand it to 804 for review.

## Notes / decisions log

- 2026-07-19 — Ticket written during initial roadmap population. No implementation decisions yet.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
