import { getEnv } from "../env";
import { query } from "../db";
import { getActiveFeedVersionIdOrNull } from "../gtfs/activeFeed";
import { tripInstanceKey } from "../rt/processTripUpdates";
import {
  classifyArrivalProvenance,
  type ArrivalProvenance,
} from "./provenance";

export type VehicleTripStop = {
  stop_id: string;
  stop_name: string;
  stop_sequence: number;
  scheduled_time: string | null;
  estimated_time: string | null;
  delay_seconds: number | null;
  source: "realtime" | "scheduled";
  provenance: ArrivalProvenance;
  confidence_note: string;
};

export type VehicleTripPayload = {
  vehicle_id: string;
  trip_id: string | null;
  route_id: string | null;
  route_short_name: string | null;
  route_long_name: string | null;
  headsign: string | null;
  lat: number | null;
  lon: number | null;
  observed_at: string | null;
  tracking_live: boolean;
  stops: VehicleTripStop[];
  note: string;
};

function secondsToIsoOnDate(day: string, seconds: number): string {
  // Interpret GTFS seconds as Europe/London wall clock on `day` via UTC noon trick avoided —
  // use Date with local offset approximation: day as YYYY-MM-DD + seconds from midnight UTC
  // then let clients display; consistent with arrivals/forStop.
  const base = new Date(`${day}T00:00:00Z`);
  return new Date(base.getTime() + seconds * 1000).toISOString();
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Trip + remaining stop sequence for a vehicle (Ticket 204).
 * Reads current position (even if unservable) so a lost-tracking panel can still show timetable.
 */
export async function tripForVehicle(
  vehicleId: string,
  feedName = getEnv().GTFS_RT_FEED_NAME,
): Promise<VehicleTripPayload | null> {
  const env = getEnv();
  const feedVersionId = await getActiveFeedVersionIdOrNull();

  const veh = await query<{
    vehicle_id: string;
    trip_id: string | null;
    trip_start_date: Date | null;
    trip_start_time: string | null;
    route_id: string | null;
    stop_id: string | null;
    lat: number;
    lon: number;
    observed_at: Date;
    quality_flags: number;
  }>(
    `SELECT
       vehicle_id, trip_id, trip_start_date, trip_start_time, route_id, stop_id,
       ST_Y(geom::geometry) AS lat, ST_X(geom::geometry) AS lon,
       observed_at, quality_flags
     FROM vehicle_positions_current
     WHERE feed_name = $1 AND vehicle_id = $2`,
    [feedName, vehicleId],
  );

  const row = veh.rows[0];
  if (!row) return null;

  const ageSec = (Date.now() - row.observed_at.getTime()) / 1000;
  const trackingLive = ageSec <= env.QUALITY_VERY_STALE_SECONDS;

  let routeShort: string | null = null;
  let routeLong: string | null = null;
  let headsign: string | null = null;

  if (feedVersionId && row.route_id) {
    const r = await query<{
      route_short_name: string | null;
      route_long_name: string | null;
    }>(
      `SELECT route_short_name, route_long_name FROM routes
       WHERE feed_version_id = $1 AND route_id = $2`,
      [feedVersionId, row.route_id],
    );
    routeShort = r.rows[0]?.route_short_name ?? null;
    routeLong = r.rows[0]?.route_long_name ?? null;
  }

  if (feedVersionId && row.trip_id) {
    const t = await query<{ trip_headsign: string | null }>(
      `SELECT trip_headsign FROM trips
       WHERE feed_version_id = $1 AND trip_id = $2`,
      [feedVersionId, row.trip_id],
    );
    headsign = t.rows[0]?.trip_headsign ?? null;
  }

  const startDate = row.trip_start_date
    ? row.trip_start_date.toISOString().slice(0, 10)
    : todayYmd();
  const startTime = row.trip_start_time ?? null;
  const key = tripInstanceKey({
    tripId: row.trip_id ?? "unknown",
    startDate,
    startTime,
    routeId: row.route_id,
    directionId: null,
  });

  // Realtime stop updates for this trip instance
  const rtByStop = new Map<
    string,
    {
      arrival_time: Date | null;
      arrival_delay: number | null;
      schedule_relationship: string | null;
    }
  >();

  if (row.trip_id) {
    const rt = await query<{
      stop_id: string;
      arrival_time: Date | null;
      arrival_delay: number | null;
      schedule_relationship: string | null;
    }>(
      `SELECT s.stop_id, s.arrival_time, s.arrival_delay, s.schedule_relationship
       FROM stop_time_updates_current s
       JOIN trip_updates_current t
         ON t.feed_name = s.feed_name AND t.trip_instance_key = s.trip_instance_key
       WHERE s.feed_name = $1
         AND (
           s.trip_instance_key = $2
           OR t.trip_id = $3
         )`,
      [feedName, key, row.trip_id],
    );
    for (const s of rt.rows) {
      rtByStop.set(s.stop_id, s);
    }
  }

  const stops: VehicleTripStop[] = [];

  if (feedVersionId && row.trip_id) {
    const st = await query<{
      stop_id: string;
      stop_name: string;
      stop_sequence: number;
      arrival_time: number;
      departure_time: number;
    }>(
      `SELECT st.stop_id, s.stop_name, st.stop_sequence, st.arrival_time, st.departure_time
       FROM stop_times st
       JOIN stops s
         ON s.feed_version_id = st.feed_version_id AND s.stop_id = st.stop_id
       WHERE st.feed_version_id = $1 AND st.trip_id = $2
       ORDER BY st.stop_sequence ASC`,
      [feedVersionId, row.trip_id],
    );

    let minSeq = 0;
    if (row.stop_id) {
      const cur = st.rows.find((x) => x.stop_id === row.stop_id);
      if (cur) minSeq = cur.stop_sequence;
    } else {
      // Remaining = stops whose scheduled arrival is still ahead of "now" on service day
      const nowSec =
        new Date().getUTCHours() * 3600 +
        new Date().getUTCMinutes() * 60 +
        new Date().getUTCSeconds();
      const ahead = st.rows.find((x) => x.arrival_time >= nowSec - 300);
      if (ahead) minSeq = ahead.stop_sequence;
    }

    for (const s of st.rows) {
      if (s.stop_sequence < minSeq) continue;
      const scheduled = secondsToIsoOnDate(startDate, s.arrival_time);
      const rt = rtByStop.get(s.stop_id);
      const useRt = Boolean(rt?.arrival_time && rt.schedule_relationship !== "SKIPPED");

      const source: "realtime" | "scheduled" = useRt ? "realtime" : "scheduled";
      const delaySeconds = useRt ? (rt!.arrival_delay ?? null) : null;
      const estimated = useRt ? rt!.arrival_time!.toISOString() : null;
      const provenance = classifyArrivalProvenance({
        source,
        delaySeconds,
      });

      stops.push({
        stop_id: s.stop_id,
        stop_name: s.stop_name,
        stop_sequence: s.stop_sequence,
        scheduled_time: scheduled,
        estimated_time: estimated,
        delay_seconds: delaySeconds,
        source,
        provenance,
        confidence_note:
          source === "realtime"
            ? "Realtime estimate from TripUpdates — not a guarantee"
            : "Timetable only — no usable realtime estimate for this stop",
      });
    }
  }

  return {
    vehicle_id: row.vehicle_id,
    trip_id: row.trip_id,
    route_id: row.route_id,
    route_short_name: routeShort,
    route_long_name: routeLong,
    headsign,
    lat: Number(row.lat),
    lon: Number(row.lon),
    observed_at: row.observed_at.toISOString(),
    tracking_live: trackingLive,
    stops,
    note: "Arrival times are estimates when Live/Delayed and never guarantees.",
  };
}
