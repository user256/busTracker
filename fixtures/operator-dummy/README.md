# Dummy operator feed — Perth / Kinross / Tillicoultry (routes 55 + 23)

Built from the Stagecoach-style timetable board (Perth Bus Station ↔ Kinross ↔
Tillicoultry). **Not** a licensed operator feed — for local soak, Sprint 2 map
work, and unblocking Ticket 109 until real GTFS-RT credentials arrive.

## What’s included

| Artefact | Path |
|----------|------|
| GTFS static zip | `fixtures/operator-dummy/gtfs-static.zip` |
| Unzipped tables | `fixtures/operator-dummy/gtfs/` |
| Builder | `scripts/operator-dummy/build-gtfs.ts` |
| Live GTFS-RT server | `scripts/operator-dummy/rt-server.ts` |

### Routes

- **55** Perth ↔ Glenfarg ↔ Kinross (incl. pre-book stops: Cuthill Towers, Campus)
- **23** Kinross ↔ Dollar ↔ Tillicoultry loop (pre-book: Rumbling Bridge)

Calendars in static GTFS: `WD` (Mon–Fri), `SA` (Saturday), `MS` (Mon–Sat).
The RT server **defaults to running all three every day** (including Sunday) so
local soak always has buses; set `DUMMY_RT_STRICT_CALENDAR=1` for real weekday rules.

Timetable note modelled in RT: delays of 0–3 minutes (board: “up to three minutes later due to servicing booking stops”).

Source board: `source-timetable.png` (Stagecoach-style 55 / 23 board).

## One-time build

```bash
npm run dummy:gtfs
npm run gtfs:import -- --source fixtures/operator-dummy/gtfs-static.zip --force
```

## Live realtime (for workers)

```bash
# terminal A — denser midday fleet for demos:
DUMMY_RT_SIMULATE_HOUR=12 npm run dummy:rt

# terminal B — .env
# GTFS_RT_VEHICLE_POSITIONS_URL=http://127.0.0.1:8099/gtfs-rt/vehicle-positions.pb
# GTFS_RT_TRIP_UPDATES_URL=http://127.0.0.1:8099/gtfs-rt/trip-updates.pb
# GTFS_RT_FEED_NAME=dummy-perth-kinross

npm run worker:positions
npm run worker:tripupdates
# or one-shot: npx tsx scripts/operator-dummy/smoke-once.ts
```

Check:

```bash
curl -s http://127.0.0.1:8099/health
curl -s 'http://localhost:3000/api/v1/vehicles?bbox=-3.8,56.14,-3.35,56.42' | jq .
curl -s 'http://localhost:3000/api/v1/stops/kinross/arrivals?limit=5' | jq .
```

Map bbox roughly covers Perth–Tillicoultry.

## Relation to Ticket 109

This **does** let you run unattended pollers and `quality:report` locally, and
unblocks Sprint 2 map work on fixtures.

It does **not** replace operator-signed licence / production AVL for Ticket 109
acceptance or Stage C public beta — those still need the real feed (Sprint 0 R1).
