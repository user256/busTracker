# Feed workers runbook (Ticket 108)

**Owner:** John Fegan

## Processes

| Command | Role |
|---------|------|
| `npm run worker:positions` | GTFS-RT VehiclePositions → 103 store |
| `npm run worker:tripupdates` | GTFS-RT TripUpdates → trip/stop update tables |

Compose services `worker-positions` / `worker-tripupdates` use `restart: unless-stopped`.

## Recovery

1. Check `/api/health` → `vehicle_feed.status`.
2. Inspect logs for `feed_failure_threshold` / `feed_stale`.
3. Restart worker container; confirm `consecutive_failures` returns to 0.
4. If feed URL/auth changed, update secrets and recreate containers — never bake secrets into images.
