# Ticket 604: Help Centre and Support Case Handling

**Sprint:** 6 — Accounts and Support
**Status:** Planned
**Owner:** unassigned
**Estimate:** M

---

## Context

Once we are selling tickets, passengers will have problems we cannot anticipate: a payment that failed but showed as taken, a QR that would not scan, a bag left on the 42, a driver who did not deploy the ramp. `features.md` §7 asks for a searchable help centre, categorised contact forms, lost property, refund and complaint forms, accessibility assistance, file uploads for evidence, and case reference numbers. Without this, support lands in a shared inbox and nothing is traceable — which is exactly what the 505 refund flow and 504 fraud alerts need to hand off into. A case reference is also the thing that makes a complaint auditable, which matters when a passenger escalates to a regulator.

## Goal

Passengers can find answers themselves, and when they cannot, raise a categorised support case with evidence attached that produces a reference number and a tracked, SLA-measured response.

## Acceptance criteria

- [ ] A help centre exists at `/help` with articles stored as structured content, full-text searchable via Postgres `tsvector` with a GIN index, returning ranked results in under 200ms p95; articles have stable human-readable URLs, are server-rendered and indexable, and record helpful/not-helpful feedback per article.
- [ ] `/help/contact` displays the operator's current customer-service channels, accessibility contact, postal/company details, opening hours, expected response times, and out-of-hours/emergency guidance from one editable configuration source; closed-hours messaging uses the operator timezone and handles holidays.
- [ ] `POST /api/support/cases` creates a case with a required category from a fixed enum — `ticket_purchase`, `refund`, `complaint`, `lost_property`, `accessibility_assistance`, `service_feedback`, `other` — returning a reference in the format `BT-YYYYMM-XXXXXX` (checksummed, non-sequential so references are not enumerable), and immediately emails an acknowledgement stating the target response time for that category.
- [ ] Category-specific fields are enforced server-side: a refund case requires an order reference and validates ownership or guest email match; lost property requires route, date, and vehicle where known; accessibility assistance captures the assistance needed and a contact preference and is routed to a priority queue with a shorter SLA.
- [ ] File uploads work and are hostile-input-safe: max 5 files, 10MB each, allowlist of `image/jpeg`, `image/png`, `image/heic`, `application/pdf` verified by magic bytes rather than extension or client content-type, stored outside the web root in object storage with randomised keys, served only through an authorised signed URL, and scanned for malware before a staff member can open one.
- [ ] Cases raised while logged in are visible at `GET /api/account/cases` with full message thread and status (`open`, `awaiting_customer`, `resolved`, `closed`); guest cases are viewable through a signed, expiring link emailed to the address, with no case accessible by guessing a reference — asserted by a test attempting reference enumeration.
- [ ] Support requests are abuse-resistant: 5 cases/hour per email and 20/hour per IP, a bot-protection challenge on the guest form, and server-side validation that rejects HTML/script in free-text fields, with all output escaped in both the passenger view and the staff view.
- [ ] Cases carry an SLA clock per category with first-response and resolution targets, `support_cases` records every status transition with actor and timestamp in an append-only history, and a breach report query lists cases past target; 505's refund requests and 504's fraud alerts create cases through this same API rather than a parallel mechanism.
- [ ] `npm test -- support` passes, covering reference format and non-enumerability, category field validation, magic-byte upload rejection (a `.png`-named PDF and a polyglot file), rate limits, guest-link expiry, and SLA clock transitions.

## Out of scope

- The staff-facing customer-service console, internal notes, escalation workflow, and staff audit trail — 704. This ticket delivers the passenger side and the case data model 704 builds on.
- Live chat or chatbot — the sprint explicitly excludes live chat staffing; `features.md` marks it conditional.
- Help-article authoring and publishing workflow for staff — 703.
- Telephony, call-centre integration, or third-party helpdesk software migration.
- Automated refund decisions — 505 owns the refund rules; this ticket only creates the case.

## Dependencies

- **Blocks:** 699
- **Blocked by:** 601
- **External:** operator sign-off on support categories, response-time targets, and opening hours; malware-scanning service for uploads; object storage bucket with lifecycle rules matching 603's retention policy; complaints-procedure wording approved legally.

## Approach (optional)

Model the case as a small, boring state machine with an append-only transition history — that history is what makes a complaint defensible months later and is the same shape 704 needs. Put the help centre's search on Postgres full-text rather than adding a search service; the corpus is a few hundred articles and an extra dependency here is not worth its failure modes. Treat every upload as hostile: verify by content, store off-origin, never serve from our domain. Route refund and fraud-originated cases through the public API so there is exactly one case pipeline to monitor.

## Notes / decisions log

- 2026-07-19 — Ticket written during initial roadmap population. No implementation decisions yet.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
