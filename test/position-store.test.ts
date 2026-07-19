import assert from "node:assert/strict";
import test from "node:test";
import { config as loadDotenv } from "dotenv";
import { getPool } from "../lib/db";
import { resetEnvCache } from "../lib/env";
import { QUALITY_MISSING_SOURCE_TIMESTAMP } from "../lib/positions/normalize";
import { writePositions } from "../lib/positions/write";
import { migrate } from "../scripts/db-migrate";
import { runRetention } from "../scripts/db-retention";

loadDotenv({ quiet: true });

test("position-store: duplicate batch is idempotent and does not move current backwards", async (t) => {
  process.env.DATABASE_URL ??=
    "postgres://bustracker:bustracker@localhost:55432/bustracker";
  resetEnvCache();

  try {
    await migrate();
  } catch (err) {
    t.skip(`Postgres not reachable: ${err instanceof Error ? err.message : err}`);
    return;
  }

  const pool = getPool();
  const feedName = `test-pos-${Date.now()}`;
  const observed = new Date("2026-07-19T12:00:00.000Z");

  const batch = [
    {
      feedName,
      entityId: "E1",
      vehicleId: "BUS1",
      lat: 51.5,
      lon: -0.12,
      bearing: 90,
      speedMps: 10,
      entityTimestamp: observed,
      recordedAt: observed,
      tripId: "T9",
      tripStartDate: "2026-07-19",
      tripStartTime: "12:00:00",
      routeId: "R1",
    },
  ];

  const first = await writePositions(batch);
  assert.equal(first.historyInserted, 1);
  assert.equal(first.currentUpserted, 1);

  const second = await writePositions(batch);
  assert.equal(second.historyInserted, 0);
  assert.equal(second.historySkipped, 1);
  assert.equal(second.currentUnchanged, 1);

  const hist = await pool.query(
    `SELECT COUNT(*)::int AS c FROM vehicle_positions WHERE feed_name = $1`,
    [feedName],
  );
  assert.equal(hist.rows[0].c, 1);

  const cur = await pool.query<{ observation_id: string; speed_mps: number }>(
    `SELECT observation_id, speed_mps FROM vehicle_positions_current
     WHERE feed_name = $1 AND vehicle_id = 'BUS1'`,
    [feedName],
  );
  assert.equal(cur.rows.length, 1);
  assert.equal(cur.rows[0].speed_mps, 10);

  // Older observation must not overwrite current
  const older = await writePositions([
    {
      ...batch[0]!,
      entityId: "E1-old",
      speedMps: 1,
      entityTimestamp: new Date("2026-07-19T11:00:00.000Z"),
      recordedAt: new Date("2026-07-19T11:00:00.000Z"),
    },
  ]);
  assert.equal(older.historyInserted, 1);
  assert.equal(older.currentUnchanged, 1);

  const still = await pool.query<{ speed_mps: number }>(
    `SELECT speed_mps FROM vehicle_positions_current
     WHERE feed_name = $1 AND vehicle_id = 'BUS1'`,
    [feedName],
  );
  assert.equal(still.rows[0].speed_mps, 10);

  // Missing timestamps: content-hash idempotency + quality flag
  const noTs = {
    feedName,
    entityId: "E2",
    vehicleId: "BUS2",
    lat: 51.51,
    lon: -0.11,
    recordedAt: new Date("2026-07-19T12:30:00.000Z"),
  };
  const a = await writePositions([noTs]);
  const b = await writePositions([noTs]);
  assert.equal(a.historyInserted, 1);
  assert.equal(b.historySkipped, 1);

  const flags = await pool.query<{ quality_flags: number }>(
    `SELECT quality_flags FROM vehicle_positions_current
     WHERE feed_name = $1 AND vehicle_id = 'BUS2'`,
    [feedName],
  );
  assert.equal(
    flags.rows[0].quality_flags & QUALITY_MISSING_SOURCE_TIMESTAMP,
    QUALITY_MISSING_SOURCE_TIMESTAMP,
  );

  // Retention job is runnable (may drop nothing)
  const dropped = await runRetention(14);
  assert.ok(Array.isArray(dropped));
});
