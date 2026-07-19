# Ticket 706: Global Site Search

**Sprint:** 7 — Admin and Operations
**Status:** Planned
**Owner:** unassigned
**Estimate:** M

---

## Context

The feature brief requires internal site search, but 306 defers it to the help centre and CMS while those tickets only search help articles or author content. Passengers need one search entry point across routes, stops, service updates, news, fare products, help, and policy content.

## Goal

The public site has an accessible, typo-tolerant search that returns permission-safe, current results across all public content types.

## Acceptance criteria

- [ ] `/search?q=` and a global shell search control return grouped results for routes, stops, service updates, fare products, news, help articles, and policy pages with stable public URLs and highlighted matching text.
- [ ] Search indexes only published/public records, removes withdrawn or expired content on schedule, and updates within 60 seconds of GTFS import, alert resolution, fare suspension, or CMS publish.
- [ ] Stop codes and route numbers rank exact matches first; common stop/place spelling mistakes return useful suggestions without exposing admin drafts or customer data.
- [ ] Empty, no-result, provider/index failure, keyboard, screen-reader, and 320px mobile states are tested, and search remains usable without client-side JavaScript.
- [ ] A representative corpus meets a documented relevance bar and p95 latency under 300ms without introducing a separate search service unless measurement requires it.

## Out of scope

- Personalized recommendations, journey routing, or searching customer/admin records.
- Multilingual stemming until internationalisation is separately approved.

## Dependencies

- **Blocks:** 799
- **Blocked by:** 300, 301, 302, 402, 501, 604, 699, 703
- **External:** operator-approved synonyms, common stop/place spellings, and search analytics consent decision.

## Notes / decisions log

- 2026-07-19 — Added because global search was explicitly deferred but had no later owner.

---

## Definition of done

This ticket is closeable when all public content types are indexed, protected content is excluded, and relevance/accessibility tests pass.
