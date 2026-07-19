# Ticket 208: Mobile and Accessibility Pass

**Sprint:** 2 — Live Map Surface
**Status:** Not started
**Owner:** unassigned
**Estimate:** L

---

## Context

Most passengers will open the tracker one-handed, on a phone, at a bus stop, possibly in bright sunlight and possibly in a hurry. Some will open it with a screen reader, and a canvas-rendered map is close to meaningless to one. This is a public-transport service — accessibility is a legal and moral obligation, not a polish task, and the sprint exit criteria require the map to be "keyboard-navigable and screen-reader usable". The honest engineering answer for a map is not to make the canvas accessible; it is to ship a parallel, equally-current, non-visual view of the same data. That view is the main deliverable here.

## Goal

The tracker is fully usable one-handed on a phone and fully usable without sight or a mouse, meeting WCAG 2.2 AA on the map surface.

## Acceptance criteria

- [ ] An accessible list view at `/map/nearby` (and reachable from the map via a persistent, keyboard-focusable "List view" control) renders nearby stops and their next departures as semantic HTML — headings, lists, and `<time>` elements — with the same data and the same freshness labelling as the map, updating on the same feed tick.
- [ ] The map container is keyboard operable: `Tab` reaches it, arrow keys pan, `+`/`−` zoom, `Tab` cycles through visible vehicle and stop features in a stable order, `Enter` activates the focused feature, and `Escape` closes any open panel and returns focus to the trigger. A visible focus indicator meets WCAG 2.2 SC 2.4.11 (Focus Not Obscured) and 2.4.13 (Focus Appearance).
- [ ] Focus management is correct across the map and both panels: no keyboard trap (SC 2.1.2), focus moves into a panel when it opens, and focus is restored to the invoking element when it closes.
- [ ] All status information is colour-independent (SC 1.4.1): live/delayed/timetable/offline states, selected markers, and delay indicators each carry text or shape in addition to colour, verified with a greyscale screenshot review of every state.
- [ ] Text and essential UI contrast meets SC 1.4.3 (4.5:1) and SC 1.4.11 (3:1) against the pale basemap — including marker labels and the attribution line, which is the usual failure — verified with an automated contrast check plus manual spot-checks over both light land and water fills.
- [ ] `prefers-reduced-motion: reduce` disables marker interpolation (Ticket 203), panel slide transitions, and map fly-to easing, substituting instant `jumpTo`; asserted by an automated test that sets the media feature.
- [ ] One-handed mobile layout at 375 × 667 px: all primary controls (LIVE badge excepted) and the bottom-sheet drag handle sit within the bottom 60% of the viewport, every interactive target is ≥ 44 × 44 CSS px with ≥ 24 px spacing (SC 2.5.8), and content reflows per SC 1.4.10 — no horizontal scroll at 320 px width, and the departure list stays readable without two-dimensional scrolling at 200% and 400% browser zoom.
- [ ] Live regions are used sparingly and correctly: the next-stop line and freshness state are `aria-live="polite"`; the vehicle position stream is **not** announced, so a screen-reader user is not interrupted every 10 seconds.
- [ ] An automated accessibility check (`axe-core` via Playwright) runs in CI against `/map` and `/map/nearby` in default, panel-open, and degraded states with zero violations at serious or critical severity, and a manual screen-reader pass (VoiceOver iOS and NVDA) is recorded in this ticket's decisions log with findings.

## Out of scope

- Site-wide accessibility beyond the map surface — Sprint 8 (805) covers the accessibility statement and remaining pages.
- Formal third-party WCAG audit or certification.
- Native app accessibility.
- Translations and internationalisation.

## Dependencies

- **Blocks:** 299
- **Blocked by:** 204, 205, 206
- **External:** Access to real screen-reader testing devices (iOS VoiceOver, Windows NVDA); decision on whether `/map/nearby` is a distinct route or a mode of `/map`, which affects Sprint 3's SEO work (306).

## Approach (optional)

Build the list view first and let the map consume the same data hook, rather than retrofitting a list onto map state — that way the two cannot drift, and the list doubles as the no-JS and slow-connection fallback. For keyboard feature traversal, maintain an ordered array of visible features from `queryRenderedFeatures` and manage `aria-activedescendant` against an off-screen listbox rather than trying to put real focus on canvas-rendered geometry.

## Notes / decisions log

- 2026-07-19 — Ticket written during initial roadmap population. No implementation decisions yet.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
