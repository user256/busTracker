# Ticket 303: Timetable Rendering and Service Calendars

**Sprint:** 3 — Routes, Stops, and Timetables
**Status:** Planned
**Owner:** unassigned
**Estimate:** M

---

## Context

Both the route page (301) and the stop page (302) need to show a timetable, and the journey planner (304) needs to answer "does this trip run on the date the passenger asked about". All three depend on correctly resolving GTFS service calendars, which is the single most common source of wrong-answer bugs in transport sites: `calendar.txt` gives weekday patterns, `calendar_dates.txt` adds and removes individual dates, bank holidays typically run a Sunday service, and `stop_times.txt` uses times past `24:00:00` for journeys that cross midnight. Getting this wrong does not produce an error — it produces a confidently displayed departure that does not exist. This ticket owns that logic once, as a tested library plus a rendering component, so 301/302/304 consume it instead of each reimplementing it.

## Goal

A single tested service-calendar library resolves which trips run on any given date, and a shared timetable component renders those trips as an accessible departure grid across weekday, weekend, and holiday calendars.

## Acceptance criteria

- [ ] A `lib/calendar` module exposes `activeServiceIds(date)` resolving `calendar.txt` day-of-week flags and start/end dates, then applying `calendar_dates.txt` exceptions (`exception_type=1` add, `=2` remove), with removals winning over additions.
- [ ] GTFS times past midnight are handled correctly: a `stop_times.departure_time` of `25:15:00` on service day D resolves to 01:15 local on D+1, is included in D's timetable, and is excluded from D+1's — covered by an explicit unit test.
- [ ] All timetable times are computed in the operator's local timezone from `agency.txt` `agency_timezone`, and a test asserts correct behaviour across both the spring-forward and autumn-back DST boundaries (including the duplicated local hour).
- [ ] A `<Timetable>` component renders a stop-sequence-by-trip grid for a route and direction, with rows as stops and columns as trips, non-serving stops rendered as an em dash with an `aria-label` of "does not stop", and horizontal overflow scrollable within its own container without the page scrolling horizontally.
- [ ] The timetable is a semantic `<table>` with `<caption>`, `<th scope="col">` on trip columns and `<th scope="row">` on stop rows, keyboard-scrollable, and verified against a screen reader in table navigation mode (WCAG 2.2 AA 1.3.1).
- [ ] `GET /routes/[slug]/timetable?date=YYYY-MM-DD&direction=0|1` renders the timetable for that service date; omitting `date` uses today, an invalid date returns HTTP 400, and a date with no active service renders an explicit "No service on this date" message naming the next date the route does run.
- [ ] A calendar selector offers the named service patterns present in the feed (e.g. Monday–Friday, Saturday, Sunday and bank holidays) derived from the distinct active-day signatures in `calendar.txt`, not hardcoded, and each selection is a distinct linkable URL.
- [ ] A golden-file test renders the timetable for a fixture feed across 14 consecutive days including at least one bank holiday and one `calendar_dates.txt` exception, and the output matches a committed snapshot.

## Out of scope

- Real-time adjustment of timetable times from TripUpdates — timetables here are scheduled data; live times belong to the departure boards on 302.
- Printable and PDF timetable downloads, and operator-uploaded timetable documents (703).
- Frequency-based `frequencies.txt` trip expansion beyond rendering the headway text 301 needs, unless the operator's feed uses it — if it does, file a follow-up ticket rather than absorbing it.
- Journey planning across routes — 304.

## Dependencies

- **Blocks:** 301, 302, 304
- **Blocked by:** 102
- **External:** GTFS static feed with `calendar.txt` and/or `calendar_dates.txt`; the operator's bank-holiday service policy confirmed in writing, and the national holiday list for the operating region.

## Approach (optional)

Resolve active service IDs in SQL as a reusable view or set-returning function so the planner in 304 can join against it rather than round-tripping through JS. Store `stop_times` arrival/departure as integer seconds-since-service-day-start at import time (102) rather than parsing `HH:MM:SS` at query time — that makes the past-midnight case fall out naturally and keeps the planner's queries index-friendly. Timezone conversion happens exactly once, at the presentation boundary. Distinct active-day signatures can be derived by hashing the weekday flag tuple plus exception set per `service_id`.

## Notes / decisions log

- 2026-07-19 — Ticket written during initial roadmap population. No implementation decisions yet.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
