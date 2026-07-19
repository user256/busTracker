import assert from "node:assert/strict";
import test from "node:test";
import {
  formatDepartureTime,
  secondsSince,
} from "../lib/arrivals/formatDepartureTime";

test("formatDepartureTime countdown under 60 minutes", () => {
  const now = Date.parse("2026-07-19T12:00:00.000Z");
  assert.equal(
    formatDepartureTime("2026-07-19T12:04:00.000Z", now),
    "in 4 min",
  );
  assert.equal(formatDepartureTime("2026-07-19T11:59:00.000Z", now), "Due");
});

test("formatDepartureTime clock at 60+ minutes", () => {
  const now = Date.parse("2026-07-19T12:00:00.000Z");
  const label = formatDepartureTime("2026-07-19T14:30:00.000Z", now);
  assert.match(label, /\d{1,2}:\d{2}/);
  assert.doesNotMatch(label, /^in /);
});

test("secondsSince", () => {
  const now = Date.parse("2026-07-19T12:00:15.000Z");
  assert.equal(secondsSince("2026-07-19T12:00:00.000Z", now), 15);
});
