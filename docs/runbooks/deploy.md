# Deploy runbook (Ticket 108)

**Owner:** John Fegan

## Environments

| Env | Compose | Secrets | Notes |
|-----|---------|---------|-------|
| development | `docker compose up -d db` + local npm | `.env` | Default |
| staging | `docker compose --profile stack up -d --build` | host env / secret store | Isolated volumes |
| production | same profile on prod host | secret store only | Explicit promotion |

## Deploy steps

1. Merge to `main` after CI green.
2. On the target host: `git pull && docker compose --profile stack build`.
3. Migrations run once via web container command (`npm run db:migrate`) before `next start`.
4. Smoke: `curl -sf https://$HOST/api/health` and `/api/v1/vehicles?bbox=...`.
5. Rollback application: redeploy previous image tag. Database is forward-fix only — restore from `pg_dump` if a migration must be undone.

## Migration lock

`npm run db:migrate` records versions in `schema_migrations`. Re-runs are no-ops. On failure the deploy must stop (Compose `command` exits non-zero).
