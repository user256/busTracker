import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { config as loadDotenv } from "dotenv";
import { departuresForStop } from "../lib/arrivals/departuresForStop";
import { resetEnvCache } from "../lib/env";
import { processTripUpdatesBuffer } from "../lib/rt/processTripUpdates";
import { importGtfs } from "../scripts/gtfs-import";
import { migrate } from "../scripts/db-migrate";

loadDotenv({ quiet: true });

test("stop departures payload shape and provenance", async (t) => {
  process.env.DATABASE_URL ??=
    "postgres://bustracker:bustracker@localhost:55432/bustracker";
  process.env.GTFS_RT_FEED_NAME = "default";
  resetEnvCache();
  try {
    await migrate();
    await importGtfs({
      source: path.join(process.cwd(), "fixtures", "gtfs-static-mini.zip"),
      force: true,
    });
  } catch (err) {
    t.skip(`Postgres not reachable: ${err instanceof Error ? err.message : err}`);
    return;
  }

  await processTripUpdatesBuffer(
    fs.readFileSync(
      path.join(process.cwd(), "fixtures", "gtfs-rt", "tripupdates-normal.pb"),
    ),
    "default",
  );

  const payload = await departuresForStop("S1", 10, "default");
  assert.equal(payload.stop_id, "S1");
  assert.ok(typeof payload.generated_at === "string");
  assert.ok(["live", "degraded", "down"].includes(payload.feed_status));

  for (const d of payload.departures) {
    assert.ok(typeof d.trip_id === "string");
    assert.ok(["live", "delayed", "scheduled"].includes(d.provenance));
    assert.ok(typeof d.provenance_label === "string");
    assert.ok(d.scheduled_time || d.estimated_time);
    if (d.provenance === "scheduled") {
      assert.equal(d.provenance_label, "Scheduled");
      assert.equal(d.vehicle_id, null);
    }
  }
});
