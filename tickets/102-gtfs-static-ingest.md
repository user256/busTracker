# Ticket 102: GTFS Static Ingest and Schema

**Sprint:** 1 — Tracker Data Foundation
**Status:** Not started
**Owner:** unassigned
**Estimate:** L

---

## Context

Everything the tracker draws that is not a moving dot comes from GTFS static: the green route network on the map, the destination shown on a vehicle marker, the stop sequence in a detail panel, and the timetable fallback we use when live data is missing. It is also the reference data that 105 validates realtime positions against — you cannot say a bus is "off route" without knowing where the route is. The operator publishes a GTFS static bundle; we have not yet loaded it, so we do not know its size, its quirks, or which optional files it includes. This ticket makes loading it a reproducible, re-runnable operation rather than a one-off import someone did on their laptop.

## Goal

A single command downloads or reads a GTFS static bundle and loads it into Postgres reproducibly, replacing the previous feed version atomically and without ever leaving the database in a half-loaded state.

## Acceptance criteria

- [ ] Migrations under `db/migrations/` create tables `agency`, `routes`, `stops`, `trips`, `stop_times`, `shapes`, `calendar`, `calendar_dates`, `transfers`, `frequencies`, and `feed_versions`; feed-owned rows use an internal key or a composite key such as `(feed_version_id, trip_id)` and every foreign key includes/resolves the feed version, so two retained versions containing the same GTFS IDs coexist without collision or cross-version joins.
- [ ] `stops` has a `geom geography(Point,4326)` column and `shapes` has a per-`shape_id` `geom geography(LineString,4326)` materialisation (table `shape_geometries`), both populated during ingest and covered by GIST indexes; `SELECT COUNT(*) FROM shape_geometries WHERE geom IS NULL;` returns `0` after a successful load.
- [ ] `npm run gtfs:import -- --source <url-or-path>` loads a complete bundle end to end, writes one row to `feed_versions` recording source URL, SHA-256 of the zip, feed start/end dates from `feed_info.txt` (or derived from `calendar`), row counts per table, and load duration, and marks it active only on success.
- [ ] The import is atomic and re-runnable: a load that fails partway leaves the previously active `feed_versions` row still active and no partially-loaded version readable through the query helpers; re-importing the same bundle SHA is detected and skipped unless `--force` is passed.
- [ ] Import of the operator's real bundle completes in under 10 minutes on the dev Docker Postgres, and the command prints a per-file summary of rows loaded and rows rejected.
- [ ] Malformed rows are rejected individually and reported rather than aborting the run: rows with unparseable times, unknown foreign keys, or missing required fields are written to an `gtfs_import_rejects` table with file name, line number, and reason, and the run exits non-zero if rejects exceed 0.5% of rows in any file.
- [ ] GTFS times beyond 24:00:00 (e.g. `25:10:00`) are preserved losslessly — `stop_times.arrival_time`/`departure_time` are stored as seconds-since-service-day integers, and a test asserts `25:10:00` round-trips to `90600`.
- [ ] `transfers.txt` and `frequencies.txt` are loaded when present with their GTFS keys, timing fields, and feed version intact; their absence is recorded in `feed_versions.capabilities`, and fixture tests prove minimum-transfer-time lookup plus frequency-trip instance lookup used by 304 and 107.
- [ ] `npm test -- gtfs-import` passes against a checked-in miniature fixture bundle at `fixtures/gtfs-static-mini.zip` (a handful of routes, trips, stops and one shape), asserting exact row counts, geometry validity, and reject handling.
- [ ] A query helper `lib/gtfs/activeFeed.ts` exposes the currently active `feed_version_id` and every read path in the codebase goes through it, so no query silently mixes versions.

## Out of scope

- GTFS-Realtime of any kind — 104 and 107.
- Automatic scheduled re-import on a cron. Manual invocation is enough for Sprint 1; scheduling is a later operational ticket.
- Timetable rendering, service-calendar UI, or route/stop pages — Sprint 3.
- Fares (`fare_attributes`/`fare_rules`) and pathways ingest, unless present and free to load — Sprint 5 owns fares properly; `transfers.txt` and `frequencies.txt` are in scope because the planner and realtime identity require them.
- Multi-operator or merged feeds.

## Dependencies

- **Blocks:** 105, 106, 107, 199
- **Blocked by:** 101
- **External:** the operator's GTFS static feed URL and any access credentials; confirmation of publish cadence (how often the bundle changes) so we know how stale a load may get; the licence/attribution terms for redistributing the data.

## Approach (optional)

Stream the zip rather than buffering it; use `COPY` into unlogged staging tables per GTFS file, validate and transform in SQL, then insert into the real tables under one `feed_version_id` inside a single transaction, flipping the active pointer at the end. Building `shape_geometries` is a `ST_MakeLine` over `shapes` ordered by `shape_pt_sequence`, grouped by `shape_id` — do it once at import time so 106 and Sprint 2 never pay for it at request time. Keep the parser tolerant: GTFS in the wild has BOMs, CRLF, quoted commas, and inconsistent optional columns.

## Notes / decisions log

- 2026-07-19 — Ticket written during initial roadmap population. No implementation decisions yet.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
