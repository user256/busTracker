import { getEnv } from "../env";
import { query } from "../db";
import { QualityFlag } from "./flags";
import type { PositionInput } from "../positions/normalize";

export type PrevPosition = {
  lon: number;
  lat: number;
  observedAt: Date;
  tripId: string | null;
  tripStartDate: string | null;
  tripStartTime: string | null;
  qualityFlags: number;
};

export type ValidationResult = {
  flags: number;
  promote: boolean;
  reason?: string;
};

function haversineMetres(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Ingest-time validation. FRESH/STALE/VERY_STALE are NOT set here — derived at read.
 */
export async function validatePosition(
  input: PositionInput & { recordedAt?: Date | string | null },
  prev: PrevPosition | null,
  options?: { feedVersionId?: number | null },
): Promise<ValidationResult> {
  const env = getEnv();
  let flags = input.qualityFlags ?? 0;
  const observedAt =
    (input.entityTimestamp
      ? new Date(input.entityTimestamp)
      : input.headerTimestamp
        ? new Date(input.headerTimestamp)
        : input.recordedAt
          ? new Date(input.recordedAt)
          : new Date());

  if (!Number.isFinite(input.lat) || !Number.isFinite(input.lon)) {
    flags |= QualityFlag.MISSING_POSITION;
    return { flags, promote: false, reason: "missing_position" };
  }

  if (!input.entityTimestamp && !input.headerTimestamp) {
    flags |= QualityFlag.MISSING_SOURCE_TIMESTAMP;
  }

  if (!input.tripId) {
    flags |= QualityFlag.NO_TRIP;
  }

  // Duplicate vehicle claiming same full trip-instance as another current vehicle
  if (input.tripId && input.tripStartDate) {
    const dup = await query<{ vehicle_id: string }>(
      `SELECT vehicle_id FROM vehicle_positions_current
       WHERE feed_name = $1
         AND trip_id = $2
         AND trip_start_date = $3::date
         AND COALESCE(trip_start_time, '') = COALESCE($4, '')
         AND vehicle_id <> $5
       LIMIT 1`,
      [
        input.feedName,
        input.tripId,
        input.tripStartDate,
        input.tripStartTime ?? "",
        input.vehicleId,
      ],
    );
    if (dup.rows[0]) {
      flags |= QualityFlag.DUPLICATE_VEHICLE_TRIP;
    }
  }

  if (prev) {
    const dt =
      (observedAt.getTime() - prev.observedAt.getTime()) / 1000;
    if (dt > 0 && dt <= env.QUALITY_JUMP_SECONDS) {
      const dist = haversineMetres(prev.lon, prev.lat, input.lon, input.lat);
      const speed = dist / dt;
      if (dist > env.QUALITY_JUMP_METRES) {
        flags |= QualityFlag.IMPLAUSIBLE_JUMP;
      }
      if (speed > env.QUALITY_MAX_SPEED_MPS) {
        flags |= QualityFlag.IMPLAUSIBLE_SPEED;
      }
    } else if (dt > env.QUALITY_BASELINE_GAP_SECONDS) {
      // Quarantine until two consecutive mutually plausible reports — mark jump
      // tentatively but allow promotion after second plausible (handled by caller streak).
      // Here: do not set IMPLAUSIBLE_JUMP solely for large gap.
    }
  }

  if (input.speedMps != null && input.speedMps > env.QUALITY_MAX_SPEED_MPS) {
    flags |= QualityFlag.IMPLAUSIBLE_SPEED;
  }

  // Trip ended
  if (input.tripId && options?.feedVersionId) {
    const ended = await query<{ end_sec: number }>(
      `SELECT MAX(departure_time)::int AS end_sec
       FROM stop_times
       WHERE feed_version_id = $1 AND trip_id = $2`,
      [options.feedVersionId, input.tripId],
    );
    const endSec = ended.rows[0]?.end_sec;
    if (endSec != null && input.tripStartDate) {
      const start = new Date(`${input.tripStartDate}T00:00:00Z`);
      const endAt = new Date(start.getTime() + endSec * 1000);
      const minutesPast =
        (observedAt.getTime() - endAt.getTime()) / 60000;
      if (minutesPast > env.QUALITY_TRIP_ENDED_MINUTES) {
        flags |= QualityFlag.TRIP_ENDED;
      }
    }
  }

  // Off-route vs shape
  if (input.tripId && options?.feedVersionId) {
    const dist = await query<{ metres: number | null }>(
      `SELECT ST_Distance(
         ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
         sg.geom
       ) AS metres
       FROM trips t
       JOIN shape_geometries sg
         ON sg.feed_version_id = t.feed_version_id AND sg.shape_id = t.shape_id
       WHERE t.feed_version_id = $3 AND t.trip_id = $4
       LIMIT 1`,
      [input.lon, input.lat, options.feedVersionId, input.tripId],
    );
    if (!dist.rows[0]) {
      flags |= QualityFlag.NO_TRIP;
    } else if (
      dist.rows[0].metres != null &&
      dist.rows[0].metres > env.QUALITY_OFF_ROUTE_METRES
    ) {
      flags |= QualityFlag.OFF_ROUTE;
    }
  }

  let promote = true;
  if (flags & QualityFlag.MISSING_POSITION) promote = false;
  if (flags & QualityFlag.IMPLAUSIBLE_JUMP) promote = false;

  // OFF_ROUTE hysteresis
  if (flags & QualityFlag.OFF_ROUTE) {
    const streak = await query<{ streak: number }>(
      `INSERT INTO vehicle_off_route_streak (feed_name, vehicle_id, streak)
       VALUES ($1, $2, 1)
       ON CONFLICT (feed_name, vehicle_id) DO UPDATE
         SET streak = vehicle_off_route_streak.streak + 1
       RETURNING streak`,
      [input.feedName, input.vehicleId],
    );
    if ((streak.rows[0]?.streak ?? 0) < env.QUALITY_OFF_ROUTE_CONSECUTIVE) {
      // not yet exposed — clear bit for consumers but keep counting
      flags &= ~QualityFlag.OFF_ROUTE;
    }
  } else {
    await query(
      `INSERT INTO vehicle_off_route_streak (feed_name, vehicle_id, streak)
       VALUES ($1, $2, 0)
       ON CONFLICT (feed_name, vehicle_id) DO UPDATE SET streak = 0`,
      [input.feedName, input.vehicleId],
    );
  }

  return { flags, promote };
}

export async function recordQualityStats(
  feedName: string,
  flagCounts: Record<string, number>,
): Promise<void> {
  const hour = new Date();
  hour.setMinutes(0, 0, 0);
  for (const [flag, count] of Object.entries(flagCounts)) {
    if (count <= 0) continue;
    await query(
      `INSERT INTO feed_quality_stats (hour_bucket, feed_name, flag, count)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (hour_bucket, feed_name, flag)
       DO UPDATE SET count = feed_quality_stats.count + EXCLUDED.count`,
      [hour.toISOString(), feedName, flag, count],
    );
  }
}
