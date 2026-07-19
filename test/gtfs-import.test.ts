import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { config as loadDotenv } from "dotenv";
import { getPool } from "../lib/db";
import { resetEnvCache } from "../lib/env";
import { getActiveFeedVersionId } from "../lib/gtfs/activeFeed";
import { migrate } from "../scripts/db-migrate";
import { importGtfs } from "../scripts/gtfs-import";

loadDotenv({ quiet: true });

const fixture = path.join(process.cwd(), "fixtures", "gtfs-static-mini.zip");

test("gtfs-import loads mini fixture with geometry and lookups", async (t) => {
  process.env.DATABASE_URL ??=
    "postgres://bustracker:bustracker@localhost:55432/bustracker";
  resetEnvCache();

  try {
    await migrate();
  } catch (err) {
    t.skip(`Postgres not reachable: ${err instanceof Error ? err.message : err}`);
    return;
  }

  const first = await importGtfs({ source: fixture, force: true });
  assert.equal(first.skipped, false);
  assert.ok(first.feedVersionId > 0);
  assert.equal(first.stats["stops.txt"]?.loaded, 3);
  assert.equal(first.stats["routes.txt"]?.loaded, 2);
  assert.equal(first.stats["trips.txt"]?.loaded, 2);
  assert.equal(first.stats["stop_times.txt"]?.loaded, 5);
  assert.equal(first.capabilities.transfers, true);
  assert.equal(first.capabilities.frequencies, true);

  const pool = getPool();

  const nullGeoms = await pool.query(
    `SELECT COUNT(*)::int AS c FROM shape_geometries WHERE geom IS NULL`,
  );
  assert.equal(nullGeoms.rows[0].c, 0);

  const overnight = await pool.query<{ arrival_time: number }>(
    `SELECT arrival_time FROM stop_times
     WHERE trip_id = 'T2' AND stop_sequence = 1
     ORDER BY feed_version_id DESC LIMIT 1`,
  );
  assert.equal(overnight.rows[0].arrival_time, 90600);

  const transfer = await pool.query<{ min_transfer_time: number }>(
    `SELECT min_transfer_time FROM transfers
     WHERE from_stop_id = 'S2' AND to_stop_id = 'S3'
     ORDER BY feed_version_id DESC LIMIT 1`,
  );
  assert.equal(transfer.rows[0].min_transfer_time, 180);

  const freq = await pool.query<{ headway_secs: number; start_time: number }>(
    `SELECT headway_secs, start_time FROM frequencies
     WHERE trip_id = 'T1'
     ORDER BY feed_version_id DESC LIMIT 1`,
  );
  assert.equal(freq.rows[0].headway_secs, 600);
  assert.equal(freq.rows[0].start_time, 8 * 3600);

  const activeId = await getActiveFeedVersionId();
  assert.equal(activeId, first.feedVersionId);

  const second = await importGtfs({ source: fixture });
  assert.equal(second.skipped, true);

  const forced = await importGtfs({ source: fixture, force: true });
  assert.equal(forced.skipped, false);
  assert.notEqual(forced.feedVersionId, first.feedVersionId);

  const activeCount = await pool.query(
    `SELECT COUNT(*)::int AS c FROM feed_versions WHERE status = 'active'`,
  );
  assert.equal(activeCount.rows[0].c, 1);
});
