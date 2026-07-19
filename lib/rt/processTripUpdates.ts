import { getActiveFeedVersionIdOrNull } from "../gtfs/activeFeed";
import { query } from "../db";
import { decodeFeedMessage } from "../rt/decode";
import { getEnv } from "../env";

export type TripInstanceKeyParts = {
  tripId: string;
  startDate: string | null;
  startTime: string | null;
  routeId: string | null;
  directionId: number | null;
};

export function tripInstanceKey(parts: TripInstanceKeyParts): string {
  if (parts.tripId && parts.startDate) {
    return `${parts.tripId}|${parts.startDate}|${parts.startTime ?? ""}`;
  }
  if (parts.routeId != null && parts.directionId != null && parts.startDate) {
    return `r:${parts.routeId}|d:${parts.directionId}|${parts.startDate}|${parts.startTime ?? ""}`;
  }
  return `ambiguous:${parts.tripId}|${parts.startDate}|${parts.startTime}`;
}

function formatStartDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (/^\d{8}$/.test(raw)) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  return raw;
}

const SR: Record<number, string> = {
  0: "SCHEDULED",
  1: "ADDED",
  2: "UNSCHEDULED",
  3: "CANCELED",
};

export async function processTripUpdatesBuffer(
  body: Buffer,
  feedName: string,
): Promise<{ trips: number; stops: number }> {
  const feed = decodeFeedMessage(body);
  const feedVersionId = await getActiveFeedVersionIdOrNull();
  let trips = 0;
  let stops = 0;

  for (const entity of feed.entities) {
    const tu = entity.tripUpdate;
    if (!tu?.trip) continue;

    const startDate = formatStartDate(tu.trip.startDate);
    const startTime = tu.trip.startTime ?? null;
    const tripId = tu.trip.tripId ?? "";
    const routeId = tu.trip.routeId ?? null;
    const directionId =
      tu.trip.directionId != null ? Number(tu.trip.directionId) : null;

    let qualityReason: string | null = null;
    if (!tripId && (routeId == null || startDate == null)) {
      qualityReason = "ambiguous_trip_descriptor";
    }

    const key = tripInstanceKey({
      tripId: tripId || "unknown",
      startDate,
      startTime,
      routeId,
      directionId,
    });

    const scheduleRelationship =
      tu.trip.scheduleRelationship != null
        ? SR[tu.trip.scheduleRelationship] ?? String(tu.trip.scheduleRelationship)
        : null;

    const observedAt = tu.timestamp
      ? new Date(Number(tu.timestamp) * 1000)
      : feed.headerTimestamp ?? new Date();

    await query(
      `INSERT INTO trip_updates_current (
         feed_name, trip_instance_key, feed_version_id, trip_id, start_date,
         start_time, route_id, direction_id, schedule_relationship,
         entity_timestamp, header_timestamp, observed_at, recorded_at, quality_reason
       ) VALUES ($1,$2,$3,$4,$5::date,$6,$7,$8,$9,$10,$11,$12,now(),$13)
       ON CONFLICT (feed_name, trip_instance_key) DO UPDATE SET
         feed_version_id = EXCLUDED.feed_version_id,
         trip_id = EXCLUDED.trip_id,
         start_date = EXCLUDED.start_date,
         start_time = EXCLUDED.start_time,
         route_id = EXCLUDED.route_id,
         direction_id = EXCLUDED.direction_id,
         schedule_relationship = EXCLUDED.schedule_relationship,
         entity_timestamp = EXCLUDED.entity_timestamp,
         header_timestamp = EXCLUDED.header_timestamp,
         observed_at = EXCLUDED.observed_at,
         recorded_at = now(),
         quality_reason = EXCLUDED.quality_reason`,
      [
        feedName,
        key,
        feedVersionId,
        tripId || "unknown",
        startDate,
        startTime,
        routeId,
        directionId,
        scheduleRelationship,
        tu.timestamp ? new Date(Number(tu.timestamp) * 1000) : null,
        feed.headerTimestamp,
        observedAt,
        qualityReason,
      ],
    );
    trips++;

    await query(
      `DELETE FROM stop_time_updates_current
       WHERE feed_name = $1 AND trip_instance_key = $2`,
      [feedName, key],
    );

    // Propagate delay across stops
    let propagatingDelay: number | null = null;
    const updates = [...(tu.stopTimeUpdate ?? [])].sort(
      (a, b) => (a.stopSequence ?? 0) - (b.stopSequence ?? 0),
    );

    for (const stu of updates) {
      const seq = stu.stopSequence ?? 0;
      let arrivalTime: Date | null = null;
      let arrivalDelay: number | null =
        stu.arrival?.delay != null ? Number(stu.arrival.delay) : null;
      let departureTime: Date | null = null;
      let departureDelay: number | null =
        stu.departure?.delay != null ? Number(stu.departure.delay) : null;

      if (stu.arrival?.time != null) {
        arrivalTime = new Date(Number(stu.arrival.time) * 1000);
      }
      if (stu.departure?.time != null) {
        departureTime = new Date(Number(stu.departure.time) * 1000);
      }

      if (arrivalDelay != null) propagatingDelay = arrivalDelay;
      else if (departureDelay != null) propagatingDelay = departureDelay;
      else if (propagatingDelay != null && arrivalTime == null) {
        arrivalDelay = propagatingDelay;
        departureDelay = departureDelay ?? propagatingDelay;
      }

      // Resolve delay-only against schedule when we have feed version + trip + stop
      if (
        arrivalTime == null &&
        arrivalDelay != null &&
        feedVersionId &&
        tripId &&
        stu.stopId
      ) {
        const sched = await query<{ arrival_time: number }>(
          `SELECT arrival_time FROM stop_times
           WHERE feed_version_id = $1 AND trip_id = $2 AND stop_id = $3
           LIMIT 1`,
          [feedVersionId, tripId, stu.stopId],
        );
        if (sched.rows[0] && startDate) {
          const base = new Date(`${startDate}T00:00:00Z`);
          arrivalTime = new Date(
            base.getTime() + (sched.rows[0].arrival_time + arrivalDelay) * 1000,
          );
        }
      }

      const stopSr =
        stu.scheduleRelationship != null
          ? SR[stu.scheduleRelationship] ?? String(stu.scheduleRelationship)
          : null;

      await query(
        `INSERT INTO stop_time_updates_current (
           feed_name, trip_instance_key, stop_sequence, stop_id,
           arrival_time, arrival_delay, arrival_uncertainty,
           departure_time, departure_delay, departure_uncertainty,
           schedule_relationship
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          feedName,
          key,
          seq,
          stu.stopId ?? null,
          arrivalTime,
          arrivalDelay,
          stu.arrival?.uncertainty != null
            ? Number(stu.arrival.uncertainty)
            : null,
          departureTime,
          departureDelay,
          stu.departure?.uncertainty != null
            ? Number(stu.departure.uncertainty)
            : null,
          stopSr,
        ],
      );
      stops++;
    }
  }

  return { trips, stops };
}

export { getEnv };
