# busTracker

A bus operator's public website: real-time vehicle tracking, journey planning,
timetables, and ticket sales — plus the staff tooling behind them.

**Start here:** [`tickets/overview.md`](./tickets/overview.md) is the roadmap.
[`features.md`](./features.md) is the original functional brief. Sprint 0 is
complete (Conditional-Go). The live tracker (Sprints 1–2) is the implementation
priority.

**Stack:** Next.js (App Router, TypeScript) · MapLibre GL JS + Stadia Maps ·
Postgres 16 + PostGIS · GTFS / GTFS-Realtime · Stripe. ADRs under `docs/adr/`.

---

## Local bring-up (Ticket 101)

```bash
cp .env.example .env          # DATABASE_URL already points at local Compose
docker compose up -d db       # Postgres 16 + PostGIS on localhost:55432
npm install
npm run db:migrate            # apply db/migrations/*.sql
npm run gtfs:import -- --source fixtures/gtfs-static-mini.zip
npm run dev                   # http://localhost:3000
```

GTFS static re-import (idempotent by SHA; `--force` to reload):

```bash
npm run gtfs:import -- --source /path/or/url/to/gtfs.zip
```

Check health:

```bash
curl -s http://localhost:3000/api/health
# {"status":"ok","db":"ok","migrations":"001_schema_migrations"}
```

Worker (no-op until Ticket 104):

```bash
npm run worker:dev
```

### Useful commands

| Command | Purpose |
|---------|---------|
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run lint` | ESLint |
| `npm test` | Node test runner (`test/**/*.test.ts`) |
| `npm run db:migrate` | Apply SQL migrations (idempotent) |
| `npm run gtfs:import -- --source PATH` | Load a GTFS static zip |
| `npm run seed:positions -- --vehicles 5000 --hours 24` | Synthetic positions for bench/tests |
| `npm run bench:viewport` | Viewport p50/p95 (fails if p95 > 25ms) |
| `npm run db:retention` | Drop position partitions older than 14 days |
| `docker compose exec db psql -U bustracker -c "SELECT postgis_version();"` | Confirm PostGIS |

`private.md` is gitignored. Treat it as your local scratchpad. Secrets go in `.env`.

---

## What's in here

```
.
├── app/                    ← Next.js App Router (pages + /api/health)
├── lib/env.ts              ← validated env (fail-fast)
├── lib/db/                 ← shared pg pool
├── workers/                ← long-lived processes (noop until 104)
├── db/migrations/          ← lexical SQL migrations
├── scripts/db-migrate.ts   ← migration runner
├── docs/adr/               ← architecture decision records
├── docs/readiness/         ← Sprint 0 decision docs
├── tickets/                ← roadmap + live tickets
├── docker-compose.yml      ← PostGIS 16
└── features.md             ← operator brief
```

---

## Ticket workflow

1. Read `tickets/overview.md` / `tickets/queue.json`.
2. Implement the ticket; append notes to its decisions log.
3. Mark the overview bullet `- [x]` and run `python3 process_tickets.py --apply`.
4. Regenerate the dashboard: `python3 build_dashboard.py`.

```bash
pytest test_build_dashboard.py
python3 build_dashboard.py --check --check-artifacts
```

---

## Repository safety

Public repo. Never commit `.env`, `private.md`, `data/` feeds, contracts, or
customer data. See `SECURITY.md` and `docs/readiness/integrations.md`.
