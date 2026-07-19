import assert from "node:assert/strict";
import test from "node:test";
import { config as loadDotenv } from "dotenv";
import { resetEnvCache } from "../lib/env";
import { writePositions } from "../lib/positions/write";
import { migrate } from "../scripts/db-migrate";
import { query } from "../lib/db";

loadDotenv({ quiet: true });

test("positions-api contract against seeded DB", async (t) => {
  process.env.DATABASE_URL ??=
    "postgres://bustracker:bustracker@localhost:55432/bustracker";
  process.env.GTFS_RT_FEED_NAME = "api-test";
  resetEnvCache();
  try {
    await migrate();
  } catch (err) {
    t.skip(`Postgres not reachable: ${err instanceof Error ? err.message : err}`);
    return;
  }

  const feedName = "api-test";
  await writePositions([
    {
      feedName,
      entityId: "1",
      vehicleId: "API1",
      lat: 51.5,
      lon: -0.12,
      routeId: "R1",
      tripId: "T1",
      entityTimestamp: new Date(),
    },
  ]);
  await query(
    `INSERT INTO feed_health (feed_name, last_attempt_at, last_success_at, consecutive_failures, stale)
     VALUES ($1, now(), now(), 0, false)
     ON CONFLICT (feed_name) DO UPDATE SET last_success_at = now(), consecutive_failures = 0`,
    [feedName],
  );

  // Import route handler logic via HTTP would need server; assert servable view instead
  const rows = await query(
    `SELECT vehicle_id FROM vehicle_positions_servable WHERE feed_name = $1`,
    [feedName],
  );
  assert.ok(rows.rows.some((r) => r.vehicle_id === "API1"));
});
