# Data quality rules

## Live positions

Never present an estimate as a guarantee, and never show stale data as live.

- Ingest flags (`IMPLAUSIBLE_JUMP`, `OFF_ROUTE`, …) are stored on each observation.
- `FRESH` / `STALE` / `VERY_STALE` are derived **at read time** from observation age.
- Passenger APIs read only `vehicle_positions_servable` (plus age filter for `VERY_STALE`).

## Arrivals

Arrival times from TripUpdates are **estimates**. When the update is too old, missing, or the vehicle is quality-failed, the API returns `source: "scheduled"` with `estimated_time: null` — never a stale prediction dressed as live.
