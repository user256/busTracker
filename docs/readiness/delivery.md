# Delivery and Operating Model

**Ticket:** 003  
**Status:** Decided  
**Decided:** 2026-07-19  
**Accountable:** John Fegan  

Companion ADR: [`docs/adr/0001-hosting-platform.md`](../adr/0001-hosting-platform.md).

---

## 1. Platform summary

Self-hosted **Docker Compose** (dev / staging / production projects), Postgres 16 + PostGIS, long-lived worker containers for GTFS-RT ingest, TLS at the existing VPS edge, origin on NAS/private network. Full rationale in ADR 0001.

| Concern | Development | Staging | Production |
|---------|-------------|---------|------------|
| Web | Compose `web`, localhost | Compose `web`, staging hostname | Compose `web`, public hostname |
| Workers | Compose `worker` | same, supervised | same, supervised + alert on restart loop |
| DB | Compose `db` + volume | Compose `db` + volume + daily dump | Compose `db` + volume + daily dump + off-box copy |
| Object storage | local volume | volume or MinIO | S3-compatible or MinIO with backup |
| CDN | none | optional Cloudflare (grey-cloud OK) | Cloudflare proxy before Stage C exit |
| Secrets | `.env` (gitignored) | host env file / secret store outside git | same; never in image layers |
| Domains / TLS | localhost | staging FQDN + TLS | production FQDN + TLS |

Exact hostnames are chosen when DNS is cut (Ticket 108); placeholders: `staging.bustracker.<domain>`, `track.<domain>` or operator brand domain.

---

## 2. Environment isolation

- Separate Compose project names and Docker volumes per environment — **no shared Postgres** between staging and production.
- Separate Stripe keys, feed credentials, and `APP_URL` values.
- Staging may use operator feeds or fixtures; production uses only licensed operator feeds.
- Admin (Stage F) on a distinct hostname; staff MFA required (Ticket 400).

---

## 3. Migrations, deploy, rollback, workers

| Topic | Policy |
|-------|--------|
| Migration ownership | App repo `db/migrations/*.sql`; applied by `npm run db:migrate` (Ticket 101) as a release step **before** new web/worker containers take traffic |
| Deploy approval | Programme owner (John Fegan) for production until a second reviewer is named; payments/security/privacy/migration PRs require explicit review (see CI) |
| Release path | PR → checks → merge to `main` → build images → staging deploy → smoke → production deploy |
| Rollback | Re-deploy previous image tag; DB migrations must be forward-only with expand/contract discipline — destructive downs are not the rollback path |
| Worker supervision | Compose `restart: unless-stopped`; healthcheck or liveness log metric; alert if no successful poll within N× expected cadence (Ticket 108) |
| Fast vs durable tier | Hot/rsync into a running container is **ephemeral**; any restart requires a baked image that includes the change (see `CLAUDE.md`) |

---

## 4. Backup, restore, observability

| Topic | Provisional target | Evidence to revise |
|-------|--------------------|--------------------|
| DB backup | Daily `pg_dump` retained 7 days on-box + weekly off-box copy | Restore drill in staging before Stage C |
| RPO | **Provisional 24 h** for static/ticketing data; realtime positions are regenerable from the feed | Restore drill |
| RTO | **Provisional 4 h** to restore staging-sized DB | Restore drill |
| Log retention | 14 days application logs; 90 days auth/audit when Ticket 400 lands | Disk pressure review |
| Metrics | Container health + poll success/fail counters + HTTP 5xx rate (Ticket 108) | |
| Alert destinations | Email/nnotify to John Fegan until an on-call rota exists | |
| Status page | Out of scope until Ticket 803 | |

Public launch must not treat the Sprint 8 snow-day test as the first operational test — staging soak under Stages B/C is mandatory.

---

## 5. CI policy (initial)

Agreed for this repository:

| Control | Policy |
|---------|--------|
| Default branch | `main`, protected once GitHub branch protection is enabled |
| PR checks | `build_dashboard.py --check --check-artifacts`; `pytest test_build_dashboard.py`; after 101: `typecheck`, `lint`, app tests |
| Secret scanning | GitHub secret scanning / push protection when available; never commit `.env` |
| Dependency updates | Dependabot or equivalent after 101 lockfiles exist |
| Ticket dashboard freshness | Required (existing workflow `.github/workflows/ticket-dashboard.yml`) |
| Required reviewers | **Payments, security, privacy, and database migration** PRs: programme owner must approve; second reviewer when a second human joins |

---

## 6. Repository visibility and publishable boundary

| Decision | **Public repository** |
|----------|----------------------|

**Allowlist (publishable):** application source, tests, tickets, ADRs, readiness docs without secrets, `.env.example`, CI workflows, public fixtures under `fixtures/` if added later (synthetic only).

**Denylist (never commit):** `.env`, `private.md`, `data/` raw feeds, contracts, security/pen-test reports, customer data, production compose env files, signing keys, Stripe live keys, operator feed credentials, private GTFS captures.

Reinforced by `SECURITY.md` and Ticket 002 scan.

---

## 7. Cost owners and budget alerts

| Cost centre | Owner | Alert trigger (provisional) |
|-------------|-------|----------------------------|
| VPS / NAS power & disk | John Fegan | Disk > 80%; unexpected egress |
| Stadia Maps | John Fegan | Monthly usage > free-tier headroom |
| Geocoding | John Fegan | Same |
| Stripe | John Fegan / finance TBC | Live mode only after Stage E; dispute email watched |
| Email / SMS | John Fegan | Hard monthly cap in provider dashboard when accounts exist |
| Object storage | John Fegan | Growth > 20% month-over-month |
| Monitoring SaaS | John Fegan | Plan upgrade prompt |
| Load testing | John Fegan | Per-run cost approval before Sprint 8 |

---

## 8. Baseline availability (provisional)

Aligned with Ticket 001 service goals. Revise only with staging evidence.

| Service | Availability | Notes |
|---------|--------------|-------|
| Tracker read API | 99.5% monthly | Positions regenerable; honesty about staleness > raw uptime |
| Journey planner / tickets / alerts | 99.9% monthly | Highest priority per brief |

---

## Approval

| Role | Name | Date | Result |
|------|------|------|--------|
| Programme owner | John Fegan | 2026-07-19 | Approved — Ticket 101 may assume Compose + long-lived workers + PostGIS |
