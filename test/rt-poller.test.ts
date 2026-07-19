import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { config as loadDotenv } from "dotenv";
import { resetEnvCache } from "../lib/env";
import { decodeFeedMessage } from "../lib/rt/decode";
import { processVehiclePositionsBuffer } from "../lib/rt/processVehicles";
import { migrate } from "../scripts/db-migrate";

loadDotenv({ quiet: true });

const dir = path.join(process.cwd(), "fixtures", "gtfs-rt");

test("rt-poller fixtures", async (t) => {
  process.env.DATABASE_URL ??=
    "postgres://bustracker:bustracker@localhost:55432/bustracker";
  resetEnvCache();
  try {
    await migrate();
  } catch (err) {
    t.skip(`Postgres not reachable: ${err instanceof Error ? err.message : err}`);
    return;
  }

  // Refresh fixtures so header timestamps are current
  await import("../scripts/generate-rt-fixtures");

  const suffix = `${Date.now()}`;

  const normal = await processVehiclePositionsBuffer(
    fs.readFileSync(path.join(dir, "normal.pb")),
    { feedName: `rt-normal-${suffix}`, httpStatus: 200 },
  );
  assert.ok(normal.entityCount >= 2);
  assert.ok(normal.writtenCount >= 1);
  assert.equal(normal.stale, false);

  const empty = await processVehiclePositionsBuffer(
    fs.readFileSync(path.join(dir, "empty.pb")),
    { feedName: `rt-empty-${suffix}`, httpStatus: 200 },
  );
  assert.equal(empty.entityCount, 0);

  const frozen = await processVehiclePositionsBuffer(
    fs.readFileSync(path.join(dir, "frozen-header.pb")),
    { feedName: `rt-frozen-${suffix}`, httpStatus: 200 },
  );
  assert.equal(frozen.stale, true);

  const missing = await processVehiclePositionsBuffer(
    fs.readFileSync(path.join(dir, "missing-position.pb")),
    { feedName: `rt-missing-${suffix}`, httpStatus: 200 },
  );
  assert.ok(missing.entityCount >= 1);

  assert.throws(() =>
    decodeFeedMessage(fs.readFileSync(path.join(dir, "corrupt.pb"))),
  );
});
