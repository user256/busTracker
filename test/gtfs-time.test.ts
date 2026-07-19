import assert from "node:assert/strict";
import test from "node:test";
import { parseGtfsTime, formatGtfsTime } from "../lib/gtfs/time";

test("GTFS overnight time 25:10:00 round-trips to 90600", () => {
  assert.equal(parseGtfsTime("25:10:00"), 90600);
  assert.equal(formatGtfsTime(90600), "25:10:00");
});

test("parseGtfsTime rejects garbage", () => {
  assert.equal(parseGtfsTime("not-a-time"), null);
  assert.equal(parseGtfsTime("8:00"), null);
});
