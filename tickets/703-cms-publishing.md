# Ticket 703: Content Management and Publishing Workflow

**Sprint:** 7 — Admin and Operations
**Status:** Planned
**Owner:** unassigned
**Estimate:** L

---

## Context

Everything the site says outside of generated route and timetable data — the homepage, news, help articles, promotional banners, service notices, and the legal pages — is currently hardcoded in the repo. That makes every copy change a deploy, which in practice means marketing queues changes behind engineering and the site's non-generated content goes stale. It is also the wrong risk profile in the other direction: the legal and policy pages 805 has to publish must not be editable by whoever happens to have repo access, and must have a reviewable history. A draft/review/publish workflow solves both problems at once.

## Goal

Non-technical staff can draft, review, schedule, and publish site content — including SEO metadata — through the admin, with an approval step and a revertible version history.

## Acceptance criteria

- [ ] The CMS manages at least these content types with distinct schemas: homepage blocks, news/announcement posts, help-centre articles, promotional banners, non-operational service notices, timetable documents, stop-facility records, and legal/policy pages; page-like types have URL/body/SEO fields, timetable files carry route/effective-date/accessibility metadata, and facilities use the 302 schema rather than free text.
- [ ] Every content item moves through the states `draft → in_review → scheduled → published → archived`, and the state machine rejects illegal transitions (e.g. `draft → published`) with a `409`, verified by a state-machine unit test covering each invalid transition.
- [ ] Publishing requires two people: an author with `content_editor` cannot approve their own item, and only `content_approver` can move an item to `scheduled`/`published`; a self-approval attempt returns `403` and is logged to the 704 audit trail.
- [ ] Legal and policy pages are additionally restricted — only `legal_approver` can publish a content item of type `legal`, and the published version records the approver, approval timestamp, and a free-text sign-off reference.
- [ ] Every save creates an immutable revision; the admin shows a field-level diff between any two revisions of an item, and a one-click revert publishes a prior revision as a new revision (never by mutating history), covered by an end-to-end test.
- [ ] Authors can preview any draft at a signed, expiring preview URL (default TTL 24h) that renders the item in the real page template and returns `404` to an unauthenticated visitor once the token expires.
- [ ] Scheduled items publish automatically within 60 seconds of their scheduled time, and published content is served from the ISR/CDN layer such that a publish or revert invalidates the affected paths within 60 seconds — asserted by publishing a change and polling the public URL.
- [ ] Editing SEO fields on a route or stop page overrides the 306 generated defaults for that page only, and changing a slug automatically creates a `301` redirect from the old path; a test confirms the old URL redirects rather than 404s.
- [ ] Staff can upload, supersede, and withdraw timetable documents without orphaning old links, and edit stop facilities with an unknown/yes/no value plus evidence date; both operations invalidate affected public pages and write 400 audit entries.

## Out of scope

- Authoring the actual legal and policy copy — 805 writes the content; this ticket builds the machinery it is published through.
- Managing route, stop, and timetable *data* — that comes from the GTFS ingest in 102, not from editors typing it in. The CMS may only override presentational and SEO fields on those pages.
- Ingesting or authoring GTFS-RT service alerts — 401/402 own the alert pipeline; the "service notice" content type here is for staff-written notices that are not feed-backed.
- Multilingual content and translation workflow — deferred with the rest of internationalisation.
- Media transcoding, DAM features, and rich asset management beyond image upload with alt text.

## Dependencies

- **Blocks:** 799, 805
- **Blocked by:** 306, 400, 402, 604
- **External:** decision on whether to adopt a headless CMS or build on the existing Postgres schema (affects hosting and licensing cost); marketing sign-off on the approval matrix; object storage for uploaded media.

## Approach (optional)

Prefer storing content in the existing Postgres instance over adopting a third-party headless CMS — the schemas are small, the workflow requirements are specific enough that we would fight a generic tool's permissions model, and 802 has to reason about one cache story rather than two. Model revisions as append-only rows keyed by `(item_id, revision_no)` with a `published_revision_no` pointer on the item; publish and revert then both become a pointer move plus a cache invalidation, which is cheap and trivially auditable. Every publish must fire a targeted revalidation of the affected paths — a blanket cache purge on every copy edit will not survive Sprint 8's traffic assumptions.

## Notes / decisions log

- 2026-07-19 — Ticket written during initial roadmap population. No implementation decisions yet.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
