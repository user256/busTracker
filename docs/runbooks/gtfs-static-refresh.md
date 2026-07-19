# GTFS static refresh runbook (Ticket 108)

**Owner:** John Fegan

## Schedule

Compose service `gtfs-static-refresh` runs `npm run gtfs:import -- --source $GTFS_STATIC_URL` daily.

Import skips unchanged SHA unless `--force`. Previous `feed_versions` row remains `active` until a successful load flips the pointer.

## Recovery

1. On failure, check import logs and `gtfs_import_rejects`.
2. Re-run manually: `npm run gtfs:import -- --source <url-or-path>`.
3. Confirm `lib/gtfs/activeFeed` / `SELECT * FROM feed_versions WHERE status='active'`.
