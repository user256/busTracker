import { getEnv } from "../env";
import { query } from "../db";
import { getActiveFeedVersionIdOrNull } from "../gtfs/activeFeed";
import { QualityFlag } from "../quality/flags";

export type ArrivalSource = "realtime" | "scheduled";

export type Arrival = {
  trip_instance_key: string;
  trip_id: string;
  route_id: string | null;
  stop_id: string;
  source: ArrivalSource;
  scheduled_time: string | null;
  estimated_time: string | null;
  delay_seconds: number | null;
  uncertainty_seconds: number | null;
  age_seconds: number | null;
  confidence_note: string;
  schedule_relationship: string | null;
};

/**
 * Next N arrivals for a stop. Provenance is always explicit — never an unmarked estimate.
 */
export async function arrivalsForStop(
  stopId: string,
  limit = 10,
  feedName = "default",
): Promise<Arrival[]> {
  const env = getEnv();
  const feedVersionId = await getActiveFeedVersionIdOrNull();
  const now = Date.now();
  const out: Arrival[] = [];

  // Realtime stop updates
  const rt = await query<{
    trip_instance_key: string;
    trip_id: string;
    route_id: string | null;
    arrival_time: Date | null;
    arrival_delay: number | null;
    arrival_uncertainty: number | null;
    schedule_relationship: string | null;
    observed_at: Date;
    parent_sr: string | null;
    quality_flags: number | null;
  }>(
    `SELECT
       s.trip_instance_key, t.trip_id, t.route_id,
       s.arrival_time, s.arrival_delay, s.arrival_uncertainty,
       s.schedule_relationship, t.observed_at, t.schedule_relationship AS parent_sr,
       v.quality_flags
     FROM stop_time_updates_current s
     JOIN trip_updates_current t
       ON t.feed_name = s.feed_name AND t.trip_instance_key = s.trip_instance_key
     LEFT JOIN vehicle_positions_current v
       ON v.feed_name = t.feed_name AND v.trip_id = t.trip_id
     WHERE s.feed_name = $1 AND s.stop_id = $2
     ORDER BY COALESCE(s.arrival_time, now()) ASC
     LIMIT $3`,
    [feedName, stopId, limit * 2],
  );

  for (const row of rt.rows) {
    if (row.parent_sr === "CANCELED" || row.schedule_relationship === "SKIPPED") {
      out.push({
        trip_instance_key: row.trip_instance_key,
        trip_id: row.trip_id,
        route_id: row.route_id,
        stop_id: stopId,
        source: "realtime",
        scheduled_time: null,
        estimated_time: null,
        delay_seconds: row.arrival_delay,
        uncertainty_seconds: row.arrival_uncertainty,
        age_seconds: Math.floor((now - row.observed_at.getTime()) / 1000),
        confidence_note:
          row.parent_sr === "CANCELED"
            ? "Trip canceled in TripUpdates feed"
            : "Stop skipped in TripUpdates feed",
        schedule_relationship: row.parent_sr ?? row.schedule_relationship,
      });
      continue;
    }

    const age = Math.floor((now - row.observed_at.getTime()) / 1000);
    const vehicleBad =
      row.quality_flags != null &&
      (row.quality_flags &
        (QualityFlag.IMPLAUSIBLE_JUMP | QualityFlag.MISSING_POSITION)) !==
        0;

    if (age > env.ARRIVAL_STALE_SECONDS || vehicleBad || !row.arrival_time) {
      // fall through to scheduled below — skip adding realtime
      continue;
    }

    out.push({
      trip_instance_key: row.trip_instance_key,
      trip_id: row.trip_id,
      route_id: row.route_id,
      stop_id: stopId,
      source: "realtime",
      scheduled_time: null,
      estimated_time: row.arrival_time.toISOString(),
      delay_seconds: row.arrival_delay,
      uncertainty_seconds: row.arrival_uncertainty,
      age_seconds: age,
      confidence_note:
        "Realtime estimate from TripUpdates — not a guarantee",
      schedule_relationship: row.schedule_relationship,
    });
  }

  // Scheduled fallback from active GTFS
  if (feedVersionId && out.filter((a) => a.source === "realtime").length < limit) {
    const sched = await query<{
      trip_id: string;
      route_id: string;
      arrival_time: number;
      trip_headsign: string | null;
    }>(
      `SELECT st.trip_id, tr.route_id, st.arrival_time, tr.trip_headsign
       FROM stop_times st
       JOIN trips tr ON tr.feed_version_id = st.feed_version_id AND tr.trip_id = st.trip_id
       WHERE st.feed_version_id = $1 AND st.stop_id = $2
       ORDER BY st.arrival_time ASC
       LIMIT $3`,
      [feedVersionId, stopId, limit],
    );

    const today = new Date().toISOString().slice(0, 10);
    for (const row of sched.rows) {
      if (out.length >= limit) break;
      const key = `${row.trip_id}|${today}|`;
      if (out.some((a) => a.trip_id === row.trip_id && a.source === "realtime")) {
        continue;
      }
      const base = new Date(`${today}T00:00:00Z`);
      const scheduled = new Date(base.getTime() + row.arrival_time * 1000);
      out.push({
        trip_instance_key: key,
        trip_id: row.trip_id,
        route_id: row.route_id,
        stop_id: stopId,
        source: "scheduled",
        scheduled_time: scheduled.toISOString(),
        estimated_time: null,
        delay_seconds: null,
        uncertainty_seconds: null,
        age_seconds: null,
        confidence_note:
          "Timetable only — no usable realtime estimate for this trip",
        schedule_relationship: null,
      });
    }
  }

  return out.slice(0, limit);
}
