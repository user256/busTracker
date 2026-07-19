# Ticket 805: Legal, Accessibility, and Policy Content

**Sprint:** 8 — Reliability, Security, and Scale
**Status:** Planned
**Owner:** unassigned
**Estimate:** M

---

## Context

Ticket 500 publishes the versioned commerce policies required before taking money. This ticket completes the full legal/accessibility set, migrates baseline policy into the controlled CMS without changing effective versions, and verifies that policy, consent, configuration, and product behaviour still agree before final launch.

## Goal

Every required legal, policy, and accessibility document is published through the CMS workflow, legally signed off, versioned, and linked from the places in the product where it applies.

## Acceptance criteria

- [ ] The following are published as `legal`-type CMS pages under stable URLs: terms and conditions, ticket conditions of carriage, refund and cancellation policy, privacy notice, cookie notice, accessibility statement, complaints procedure, passenger eligibility rules, acceptable-use and fraud policy, and contact and company information.
- [ ] Every published page carries a version number, an effective date, and a "last updated" date; superseded versions remain retrievable at a permanent URL through the 703 revision history, so a dispute about a purchase made last March can be settled against the terms in force then.
- [ ] Each document is approved by legal counsel before publication via the `legal_approver` gate in 703, with the approver, date, and sign-off reference recorded; an unapproved legal page cannot reach `published` state.
- [ ] Policies are enforced consistently with the code that implements them — the refund window and ceilings in the published refund policy match 702's configured values, the eligibility rules match the passenger classes configured in 501, and a reconciliation check between the published values and the live configuration is documented and run as part of this ticket.
- [ ] Terms and conditions of carriage are surfaced at the point of purchase: checkout requires explicit acceptance (an unticked, non-preselected control) with the accepted document version recorded against the order, and the recorded version is asserted in a test.
- [ ] The cookie notice is backed by a working consent mechanism aligned with 603 — non-essential cookies and analytics do not load before consent, consent is granular by category, refusing is exactly as easy as accepting (equal prominence, one click), and the choice is revocable from a persistent control; verified by loading the site with a clean profile and confirming no non-essential cookie or third-party request fires pre-consent.
- [ ] The accessibility statement is evidence-based, not boilerplate: it states conformance against **WCAG 2.2 Level AA**, lists known non-conformances with target fix dates, describes the testing performed (automated axe-core scan plus manual keyboard and screen-reader testing per 208), and gives a contact route for accessibility problems and a route to escalate.
- [ ] An automated axe-core scan across the site's key templates (homepage, route page, stop page, journey planner, checkout, active ticket, help centre, and every legal page) reports zero critical or serious violations in CI, and every legal page is readable at 200% zoom and navigable by keyboard alone.
- [ ] Policy pages are linked from where they bind: footer sitewide, checkout (terms, carriage, refunds), account settings and registration (privacy), the help centre (complaints), and fare pages (eligibility) — a link-coverage test asserts each required link is present.

## Out of scope

- Legal drafting itself. Engineering produces structure, publication, versioning, enforcement, and evidence; counsel supplies the wording and bears the sign-off.
- Formal accessibility certification or a third-party audit statement, and remediating accessibility defects found outside the legal pages — those are ticketed against the surface that owns them.
- Multilingual versions of policy documents.
- Building the CMS publishing workflow — 703.
- Data-subject-request tooling and consent record-keeping mechanics — 603.

## Dependencies

- **Blocks:** 899
- **Blocked by:** 500, 603, 703
- **External:** **legal counsel in the operating jurisdiction** — the binding dependency for this whole ticket, since required documents and mandatory wording vary by country and region; confirmation of the operating region(s) and applicable passenger-transport regulations; company registration and contact details; DPO or privacy adviser review of the privacy and cookie notices; the operator's existing conditions of carriage, if any exist in print, to reconcile against.

## Approach (optional)

Treat the published policy as the specification and the code as the thing that must match it, not the other way round — where they disagree today, escalate rather than quietly editing the document to describe whatever was built. Get counsel engaged at the start of the sprint; legal review is slow, serialised, and the most likely thing to push this past the 899 gate. Structure each document with stable heading anchors so the product can deep-link to a specific clause (checkout → the refund clause, for instance) and so a future revision does not break inbound links.

## Notes / decisions log

- 2026-07-19 — Ticket written during initial roadmap population. No implementation decisions yet.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
