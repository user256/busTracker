# Ticket 300: Public Site Shell and Navigation

**Sprint:** 3 — Routes, Stops, and Timetables
**Status:** Planned
**Owner:** unassigned
**Estimate:** M

---

## Context

The roadmap defines deep route, stop, planner, account, help, and legal pages but no shared customer site around them. Without a shell, each feature will invent navigation, footer links, error states, layout, and responsive behaviour independently, and several later acceptance criteria refer to pages and links that have no owner.

## Goal

A mobile-first, accessible public site shell provides the homepage, global navigation, footer, common page states, and stable layout contracts used by every customer-facing surface.

## Acceptance criteria

- [ ] A server-rendered homepage exposes primary actions for live tracking, journey planning, timetables/routes, service updates, tickets, and help, with editable content slots that 703 can later connect to the CMS.
- [ ] A shared header/navigation and footer work at 320px through desktop, expose the current page, remain keyboard and screen-reader usable, and link to contact, accessibility, privacy, cookie, terms, and service-status destinations when those pages become available.
- [ ] Shared 404, 410, 500, maintenance, and no-JavaScript states use plain language, preserve navigation, carry a request/reference ID where relevant, and never expose stack traces.
- [ ] A route-level skip link, landmark structure, focus management, reduced-motion baseline, colour tokens, form-error pattern, and minimum touch-target rule are documented and tested once for all later surfaces.
- [ ] The shell defines content-width, map/full-bleed, panel, banner, toast, and modal contracts so feature tickets do not create incompatible layouts.
- [ ] Lighthouse and axe-core checks run against the homepage and shared error templates, and a 404 response has the correct HTTP status rather than a styled `200`.

## Out of scope

- Route, stop, planner, account, ticket, help, or CMS feature content.
- Whole-site search — 706.

## Dependencies

- **Blocks:** 301, 302, 304, 305, 306, 399
- **Blocked by:** 101, 299
- **External:** approved brand assets, core navigation labels, public domain, and accessibility/design owner.

## Notes / decisions log

- 2026-07-19 — Added because the original roadmap had page features but no customer-facing product shell.

---

## Definition of done

This ticket is closeable when the shared shell is merged, documented, and consumed by representative public pages.
