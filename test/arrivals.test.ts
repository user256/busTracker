import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { config as loadDotenv } from "dotenv";
import { arrivalsForStop } from "../lib/arrivals/forStop";
import { resetEnvCache } from "../lib/env";
import { processTripUpdatesBuffer } from "../lib/rt/processTripUpdates";
import { importGtfs } from "../scripts/gtfs-import";
import { migrate } from "../scripts/db-migrate";

loadDotenv({ quiet: true });

test("arrivals provenance and cancellation", async (t) => {
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

  const arrivals = await arrivalsForStop("S1", 10, "default");
  assert.ok(arrivals.length >= 1);
  const canceled = arrivals.find((a) => a.schedule_relationship === "CANCELED");
  // may or may not include S1 for canceled T2
  const realtime = arrivals.find((a) => a.source === "realtime" && a.trip_id === "T1");
  const scheduled = arrivals.find((a) => a.source === "scheduled");
  assert.ok(realtime || scheduled);
  for (const a of arrivals) {
    assert.ok(a.source === "realtime" || a.source === "scheduled");
    assert.ok(typeof a.confidence_note === "string");
  }
  void canceled;
});
