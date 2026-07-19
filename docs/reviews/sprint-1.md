# Sprint 1 Review — Go / No-Go

**Date:** 2026-07-19  
**Decision-maker:** John Fegan  
**Verdict:** **Conditional-Go**

## Thresholds (set before reading operator production data)

| Metric | Bar |
|--------|-----|
| Feed uptime | ≥ 99% |
| p95 position age | ≤ 60 s |
| Fleet coverage | ≥ 95% of in-service vehicles |
| `IMPLAUSIBLE_JUMP` | ≤ 0.5% of positions |
| Sustained `OFF_ROUTE` | ≤ 2% |
| TripUpdates coverage | ≥ 90% of active trips |

These bars are **unchanged** after implementation; operator production evidence is not yet available (Sprint 0 R1).

## Observation window

| Requirement | Status |
|-------------|--------|
| ≥ 7 consecutive days unattended 104+107 ingest | **not met** — blocked on operator GTFS-RT URL/licence (R1) |
| `npm run quality:report -- --hours 168` | Runnable against whatever data exists; full 168h capture pending R1 |

### Fixture / staging smoke evidence (2026-07-19)

```
# After migrate + gtfs:import fixture + processVehiclePositionsBuffer(normal.pb)
# /api/health includes vehicle_feed
# GET /api/v1/vehicles?bbox=-0.2,51.4,0.0,51.6 returns servable vehicles with age_seconds + quality
# GET /api/v1/stops/S1/arrivals returns source realtime|scheduled with confidence_note
```

`quality:report` over local soak (when run) should be pasted here before promoting Stage C.

## Exit criteria verdicts

| Criterion | Verdict | Evidence |
|-----------|---------|----------|
| GTFS static loads reproducibly | **met** | Ticket 102 + `fixtures/gtfs-static-mini.zip` |
| GTFS-RT vehicle positions ingest continuously | **partially met** | Poller + fixtures; continuous operator ingest pending R1 / 108 staging soak |
| Stale/impossible/off-route flagged not served as truth | **met** | Ticket 105 flags + `vehicle_positions_servable` + API filters |
| Read API viewport/route within latency budget | **met** | `bench-api` / viewport GIST path; budget 150 ms |
| Arrival estimates distinguishable from scheduled | **met** | Ticket 107 + arrivals API + `docs/data-quality.md` |
| Supervised workers + static refresh in staging | **partially met** | Compose profile `stack` + runbooks; staging host soak pending |
| Feed good enough for Sprint 2 | **conditional** | Implementation ready; production feed quality unproven |

## Verdict meaning

**Conditional-Go** → Sprint 2 map work (**201+**) may proceed against fixtures and staging feeds, subject to:

1. **R1:** Operator GTFS + GTFS-RT access + licence before Ticket **199 re-score** / Stage C public beta.
2. Complete **≥ 7-day** unattended observation; paste `quality:report --hours 168` into this doc; re-evaluate thresholds.
3. Honesty requirements for **206** (interim, until observation revises them):
   - Show **delayed / STALE** when `age_seconds > 60`
   - Show **timetable only / no live** when feed_status is `down` or age `> 300` or vehicle is unservable
   - Never label `VERY_STALE` or implausible positions as LIVE

**No-Go** would halt Sprint 2 map work — not selected, because the *platform* is ready and the blocker is external access, not a failed measurement.

## Follow-up tickets filed

| Ticket | Reason |
|--------|--------|
| [109](../tickets/109-operator-feed-observation-window.md) | Run and record the 7-day operator observation + threshold re-score |
| [110](../tickets/110-staging-host-soak.md) | Provision staging host and complete 24h worker soak from 108 |

## Smoke capture

Record live outputs when staging is up:

```bash
curl -s localhost:3000/api/health | jq .
curl -s 'localhost:3000/api/v1/vehicles?bbox=-0.2,51.4,0.0,51.6' | jq .
curl -s 'localhost:3000/api/v1/stops/S1/arrivals?limit=5' | jq .
```
