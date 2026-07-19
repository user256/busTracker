import assert from "node:assert/strict";
import test from "node:test";
import { freshnessFromAge, QualityFlag } from "../lib/quality/flags";
import { isServableAtRead, isServableFlags } from "../lib/quality/isServable";
import { resetEnvCache } from "../lib/env";

test("quality freshness derivation", () => {
  resetEnvCache();
  process.env.DATABASE_URL ??=
    "postgres://bustracker:bustracker@localhost:55432/bustracker";
  assert.equal(freshnessFromAge(10, 60, 300), "FRESH");
  assert.equal(freshnessFromAge(90, 60, 300), "STALE");
  assert.equal(freshnessFromAge(400, 60, 300), "VERY_STALE");
});

test("quality servable rules", () => {
  assert.equal(isServableFlags(0), true);
  assert.equal(isServableFlags(QualityFlag.IMPLAUSIBLE_JUMP), false);
  assert.equal(isServableFlags(QualityFlag.MISSING_POSITION), false);
  assert.equal(isServableFlags(QualityFlag.OFF_ROUTE), true);
  assert.equal(
    isServableAtRead({ qualityFlags: 0, ageSeconds: 400 }),
    false,
  );
});

test("quality jump detection unit", async () => {
  process.env.DATABASE_URL ??=
    "postgres://bustracker:bustracker@localhost:55432/bustracker";
  resetEnvCache();
  const { validatePosition } = await import("../lib/quality/validate");
  const now = new Date("2026-07-19T12:00:20.000Z");
  const prev = {
    lon: -0.12,
    lat: 51.5,
    observedAt: new Date("2026-07-19T12:00:00.000Z"),
    tripId: "T1",
    tripStartDate: "2026-07-19",
    tripStartTime: null,
    qualityFlags: 0,
  };
  // ~5km east in 20s
  const result = await validatePosition(
    {
      feedName: "qtest",
      entityId: "e",
      vehicleId: "v",
      lat: 51.5,
      lon: -0.05,
      entityTimestamp: now,
    },
    prev,
  );
  assert.ok(result.flags & QualityFlag.IMPLAUSIBLE_JUMP);
  assert.equal(result.promote, false);
});
