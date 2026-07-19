import type { PoolClient } from "pg";
import { getPool, withClient } from "../db";
import { flagsToNames } from "../quality/flags";
import { recordQualityStats, validatePosition } from "../quality/validate";
import {
  normalizePosition,
  type NormalizedPosition,
  type PositionInput,
} from "./normalize";

export type WritePositionsResult = {
  historyInserted: number;
  historySkipped: number;
  currentUpserted: number;
  currentUnchanged: number;
  currentSkippedQuality: number;
};

async function ensurePartitionsFor(client: PoolClient, dates: Date[]): Promise<void> {
  const days = new Set(dates.map((d) => d.toISOString().slice(0, 10)));
  for (const day of days) {
    await client.query(`SELECT ensure_vehicle_positions_partition($1::date)`, [day]);
  }
}

/**
 * Idempotent batch write with Ticket 105 validation.
 * History always accepts (idempotent); current only when newer AND promotable.
 */
export async function writePositions(
  inputs: PositionInput[],
  client?: PoolClient,
): Promise<WritePositionsResult> {
  if (inputs.length === 0) {
    return {
      historyInserted: 0,
      historySkipped: 0,
      currentUpserted: 0,
      currentUnchanged: 0,
      currentSkippedQuality: 0,
    };
  }

  if (client) {
    return writeWithClient(client, inputs);
  }

  return withClient(async (c) => {
    await c.query("BEGIN");
    try {
      const result = await writeWithClient(c, inputs);
      await c.query("COMMIT");
      return result;
    } catch (err) {
      await c.query("ROLLBACK");
      throw err;
    }
  });
}

async function writeWithClient(
  client: PoolClient,
  inputs: PositionInput[],
): Promise<WritePositionsResult> {
  const prepared: Array<{
    row: NormalizedPosition;
    promote: boolean;
    input: PositionInput;
  }> = [];

  const flagCounts: Record<string, number> = {};

  for (const input of inputs) {
    const prevRes = await client.query<{
      lon: number;
      lat: number;
      observed_at: Date;
      trip_id: string | null;
      trip_start_date: string | null;
      trip_start_time: string | null;
      quality_flags: number;
    }>(
      `SELECT ST_X(geom::geometry) AS lon, ST_Y(geom::geometry) AS lat,
              observed_at, trip_id, trip_start_date::text, trip_start_time, quality_flags
       FROM vehicle_positions_current
       WHERE feed_name = $1 AND vehicle_id = $2`,
      [input.feedName, input.vehicleId],
    );
    const prev = prevRes.rows[0]
      ? {
          lon: Number(prevRes.rows[0].lon),
          lat: Number(prevRes.rows[0].lat),
          observedAt: prevRes.rows[0].observed_at,
          tripId: prevRes.rows[0].trip_id,
          tripStartDate: prevRes.rows[0].trip_start_date,
          tripStartTime: prevRes.rows[0].trip_start_time,
          qualityFlags: prevRes.rows[0].quality_flags,
        }
      : null;

    const validation = await validatePosition(input, prev, {
      feedVersionId: input.feedVersionId,
    });
    const merged: PositionInput = {
      ...input,
      qualityFlags: (input.qualityFlags ?? 0) | validation.flags,
    };
    // Missing lat/lon: still normalize with sentinel for history? Skip normalize crash —
    // use 0,0 only when MISSING_POSITION and don't promote.
    if (!Number.isFinite(merged.lat) || !Number.isFinite(merged.lon)) {
      merged.lat = 0;
      merged.lon = 0;
    }
    const row = normalizePosition(merged);
    row.qualityFlags = merged.qualityFlags ?? row.qualityFlags;

    for (const name of flagsToNames(row.qualityFlags)) {
      flagCounts[name] = (flagCounts[name] ?? 0) + 1;
    }

    prepared.push({ row, promote: validation.promote, input: merged });
  }

  await ensurePartitionsFor(
    client,
    prepared.map((p) => p.row.recordedAt),
  );

  let historyInserted = 0;
  let historySkipped = 0;
  let currentUpserted = 0;
  let currentUnchanged = 0;
  let currentSkippedQuality = 0;

  for (const { row, promote } of prepared) {
    const key = await client.query(
      `INSERT INTO vehicle_position_observation_keys (feed_name, observation_id, recorded_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (feed_name, observation_id) DO NOTHING
       RETURNING observation_id`,
      [row.feedName, row.observationId, row.recordedAt],
    );

    let historyId: number | null = null;

    if ((key.rowCount ?? 0) === 0) {
      historySkipped++;
      const existing = await client.query<{ id: string }>(
        `SELECT id FROM vehicle_positions
         WHERE feed_name = $1 AND observation_id = $2
         ORDER BY recorded_at DESC LIMIT 1`,
        [row.feedName, row.observationId],
      );
      historyId = existing.rows[0] ? Number(existing.rows[0].id) : null;
    } else {
      const hist = await client.query<{ id: string }>(
        `INSERT INTO vehicle_positions (
           feed_version_id, feed_name, entity_id, vehicle_id, trip_id,
           trip_start_date, trip_start_time, route_id, geom, bearing, speed_mps,
           occupancy_status, current_status, stop_id, entity_timestamp,
           header_timestamp, observed_at, recorded_at, observation_id, quality_flags
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,
           ST_SetSRID(ST_MakePoint($9,$10),4326)::geography,
           $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21
         )
         RETURNING id`,
        [
          row.feedVersionId,
          row.feedName,
          row.entityId,
          row.vehicleId,
          row.tripId,
          row.tripStartDate,
          row.tripStartTime,
          row.routeId,
          row.lon,
          row.lat,
          row.bearing,
          row.speedMps,
          row.occupancyStatus,
          row.currentStatus,
          row.stopId,
          row.entityTimestamp,
          row.headerTimestamp,
          row.observedAt,
          row.recordedAt,
          row.observationId,
          row.qualityFlags,
        ],
      );
      historyInserted++;
      historyId = Number(hist.rows[0].id);
    }

    if (!promote) {
      currentSkippedQuality++;
      continue;
    }

    const cur = await client.query(
      `INSERT INTO vehicle_positions_current (
         feed_name, vehicle_id, feed_version_id, entity_id, trip_id,
         trip_start_date, trip_start_time, route_id, geom, bearing, speed_mps,
         occupancy_status, current_status, stop_id, entity_timestamp,
         header_timestamp, observed_at, recorded_at, observation_id,
         quality_flags, history_id
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,
         ST_SetSRID(ST_MakePoint($9,$10),4326)::geography,
         $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22
       )
       ON CONFLICT (feed_name, vehicle_id) DO UPDATE SET
         feed_version_id = EXCLUDED.feed_version_id,
         entity_id = EXCLUDED.entity_id,
         trip_id = EXCLUDED.trip_id,
         trip_start_date = EXCLUDED.trip_start_date,
         trip_start_time = EXCLUDED.trip_start_time,
         route_id = EXCLUDED.route_id,
         geom = EXCLUDED.geom,
         bearing = EXCLUDED.bearing,
         speed_mps = EXCLUDED.speed_mps,
         occupancy_status = EXCLUDED.occupancy_status,
         current_status = EXCLUDED.current_status,
         stop_id = EXCLUDED.stop_id,
         entity_timestamp = EXCLUDED.entity_timestamp,
         header_timestamp = EXCLUDED.header_timestamp,
         observed_at = EXCLUDED.observed_at,
         recorded_at = EXCLUDED.recorded_at,
         observation_id = EXCLUDED.observation_id,
         quality_flags = EXCLUDED.quality_flags,
         history_id = EXCLUDED.history_id
       WHERE
         EXCLUDED.observed_at > vehicle_positions_current.observed_at
         OR (
           EXCLUDED.observed_at = vehicle_positions_current.observed_at
           AND EXCLUDED.recorded_at > vehicle_positions_current.recorded_at
         )
       RETURNING 1`,
      [
        row.feedName,
        row.vehicleId,
        row.feedVersionId,
        row.entityId,
        row.tripId,
        row.tripStartDate,
        row.tripStartTime,
        row.routeId,
        row.lon,
        row.lat,
        row.bearing,
        row.speedMps,
        row.occupancyStatus,
        row.currentStatus,
        row.stopId,
        row.entityTimestamp,
        row.headerTimestamp,
        row.observedAt,
        row.recordedAt,
        row.observationId,
        row.qualityFlags,
        historyId,
      ],
    );

    if ((cur.rowCount ?? 0) > 0) currentUpserted++;
    else currentUnchanged++;
  }

  if (inputs[0]) {
    await recordQualityStats(inputs[0].feedName, flagCounts);
  }

  return {
    historyInserted,
    historySkipped,
    currentUpserted,
    currentUnchanged,
    currentSkippedQuality,
  };
}

export async function ensureNearTermPartitions(
  daysBack = 1,
  daysForward = 3,
): Promise<void> {
  await getPool().query(`SELECT ensure_vehicle_positions_partitions($1, $2)`, [
    daysBack,
    daysForward,
  ]);
}
