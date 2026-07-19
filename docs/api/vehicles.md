# Vehicles API

`GET /api/v1/vehicles`

## Query

| Param | Required | Description |
|-------|----------|-------------|
| `bbox` | one of bbox/route_id | `minLon,minLat,maxLon,maxLat` |
| `route_id` | one of bbox/route_id | GTFS route id; intersected with bbox if both set |

## Response

```json
{
  "generated_at": "<ISO8601>",
  "feed_timestamp": "<ISO8601|null>",
  "feed_status": "live|degraded|down",
  "vehicles": [
    {
      "vehicle_id": "string",
      "route_id": "string|null",
      "trip_id": "string|null",
      "lat": 0,
      "lon": 0,
      "bearing": 0,
      "speed_mps": 0,
      "occupancy_status": "string|null",
      "headsign": "string|null",
      "feed_timestamp": "<ISO8601>",
      "age_seconds": 0,
      "quality": ["FRESH"]
    }
  ]
}
```

Coordinates are rounded to **5 decimal places (~1 m)** deliberately (payload size + privacy).

`age_seconds` is always present. `STALE` vehicles may appear; `VERY_STALE` / implausible / missing-position never do.

Cache: `Cache-Control: public, max-age=5, stale-while-revalidate=10` + `ETag`.
