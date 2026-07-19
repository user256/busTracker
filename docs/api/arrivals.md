# Arrivals API

`GET /api/v1/stops/{stop_id}/arrivals?limit=10`

## Product rule

**Arrival times are estimates, never guarantees.** Every row includes `source: "realtime" | "scheduled"` and a `confidence_note`. Stale or quality-failed realtime falls back to timetable with `estimated_time: null`.

## Response envelope

Same `generated_at` / `feed_status` pattern as the vehicles API, plus `arrivals[]` with:

- `trip_instance_key`, `trip_id`, `route_id`, `stop_id`
- `source`, `scheduled_time`, `estimated_time`
- `delay_seconds`, `uncertainty_seconds`, `age_seconds`
- `confidence_note`, `schedule_relationship` (e.g. `CANCELED`, `SKIPPED`)
