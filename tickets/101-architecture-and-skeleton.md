# Ticket 101: Architecture Decision Record and Project Skeleton

**Sprint:** 1 — Tracker Data Foundation
**Status:** Not started
**Owner:** unassigned
**Estimate:** M

---

## Context

busTracker is greenfield: there is no repository structure, no database, no build, and no deployment path. Every ticket in Sprint 1 writes code that has to live somewhere and talk to Postgres, so the shape of that "somewhere" has to be settled first — and settled in writing, because the same decisions will be re-litigated in Sprint 5 when ticketing arrives and in Sprint 7 when staff tooling does. The stack is already decided (Next.js App Router + TypeScript, Node, Postgres 16 + PostGIS, MapLibre GL JS, Stadia Maps tiles, Stripe later); what is not decided is how the realtime ingest workers relate to the web app, how migrations are run, and how the whole thing boots on a developer laptop. This ticket produces the skeleton and the ADRs, not features.

## Goal

A developer can clone the repo, run one command, and get a working Next.js app plus a migrated Postgres 16 + PostGIS database, with the architectural decisions behind that layout recorded as ADRs.

## Acceptance criteria

- [ ] `docker compose up` from the repo root starts a `db` service on Postgres 16 with the PostGIS extension available, and `docker compose exec db psql -U bustracker -c "SELECT postgis_version();"` returns a version string.
- [ ] `npm run dev` starts the Next.js App Router app on `http://localhost:3000` and `GET /api/health` returns `200` with JSON `{"status":"ok","db":"ok","migrations":"<latest applied version>"}`; the endpoint returns `503` with `"db":"error"` when Postgres is stopped.
- [ ] A migration runner exists: `npm run db:migrate` applies every file in `db/migrations/*.sql` in lexical order and records applied versions in a `schema_migrations` table; running it twice is a no-op and exits `0`.
- [ ] The repo contains the agreed directory layout with at least `app/`, `lib/db/`, `workers/`, `db/migrations/`, and `tickets/`, and `workers/` contains a runnable no-op worker entrypoint invoked by `npm run worker:dev` that connects to Postgres and logs a structured startup line.
- [ ] `npm run typecheck` (`tsc --noEmit`, `strict: true`) and `npm run lint` both exit `0` on a clean checkout.
- [ ] At least four ADRs exist under `docs/adr/` numbered `0001`–`000N`, covering: (a) Next.js App Router + Node runtime boundary and why ingest runs as a separate long-lived worker process rather than in a route handler or serverless function, (b) Postgres 16 + PostGIS as the single store for both GTFS static and realtime positions, (c) the migration tooling choice, (d) the tile provider (Stadia Maps) and the API-key handling that implies.
- [ ] Configuration is read from environment only via a single validated module (`lib/env.ts`) that fails fast at startup with a named list of missing variables; `.env.example` lists every required variable and no secret values are tracked in git.
- [ ] `README.md` documents the one-command local bring-up, the migration command, and how to run the worker, and a reviewer following it on a clean machine reaches a green `/api/health`.

## Out of scope

- Any GTFS parsing, schema, or realtime ingest logic — that is 102, 103, and 104.
- Any map, page, or customer-facing UI — that is Sprint 2.
- Production hosting, CI pipeline hardening, CDN, and autoscaling — Sprint 8. A minimal CI workflow running typecheck/lint is welcome but not required here.
- Stripe integration or any payments scaffolding — Sprint 5.

## Dependencies

- **Blocks:** 102, 103, 104, 105, 106, 107, 199
- **Blocked by:** 099
- **External:** Stadia Maps account and API key (needed for ADR (d), not for code here); confirmation of the deployment target so the worker-process ADR is grounded in something real; Postgres 16 + PostGIS image availability.

## Approach (optional)

Start with `create-next-app --typescript --app`, then strip it back to a shell. Add `docker-compose.yml` with a single `postgis/postgis:16-*` service and a named volume. Keep the migration runner boring — a small script over `node-postgres` reading `db/migrations/*.sql` inside a transaction per file, with a `schema_migrations` table — rather than adopting a heavyweight ORM this early; the ADR should record that choice and its exit path. The worker entrypoint is deliberately a plain Node process, not a Next.js route, because 104 needs a poll loop that outlives a request. Share the DB pool and env module between `app/` and `workers/` via `lib/` so there is exactly one place that knows connection settings.

## Notes / decisions log

- 2026-07-19 — Ticket written during initial roadmap population. No implementation decisions yet.

---

## Definition of done

This ticket is closeable when:

1. All acceptance criteria above are checked.
2. Changes are merged to the main branch (or the sprint's working branch).
3. The corresponding bullet in `tickets/overview.md` is changed from `- [ ]` to `- [x]`.
4. Any follow-up work discovered during implementation is filed as a new ticket — not silently absorbed.
