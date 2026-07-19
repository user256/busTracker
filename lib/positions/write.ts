import type { PoolClient } from "pg";
import { getPool, withClient } from "../db";
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
};

async function ensurePartitionsFor(client: PoolClient, dates: Date[]): Promise<void> {
  const days = new Set(dates.map((d) => d.toISOString().slice(0, 10)));
  for (const day of days) {
    await client.query(`SELECT ensure_vehicle_positions_partition($1::date)`, [day]);
  }
}

/**
 * Idempotent batch write: append history (skip duplicates by observation_id)
 * and upsert current only when the incoming observation is strictly newer.
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
    };
  }

  const rows = inputs.map(normalizePosition);

  if (client) {
    return writeWithClient(client, rows);
  }

  return withClient(async (c) => {
    await c.query("BEGIN");
    try {
      const result = await writeWithClient(c, rows);
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
  rows: NormalizedPosition[],
): Promise<WritePositionsResult> {
  await ensurePartitionsFor(
    client,
    rows.map((r) => r.recordedAt),
  );

  let historyInserted = 0;
  let historySkipped = 0;
  let currentUpserted = 0;
  let currentUnchanged = 0;

  for (const row of rows) {
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

    if ((cur.rowCount ?? 0) > 0) {
      currentUpserted++;
    } else {
      currentUnchanged++;
    }
  }

  return {
    historyInserted,
    historySkipped,
    currentUpserted,
    currentUnchanged,
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
