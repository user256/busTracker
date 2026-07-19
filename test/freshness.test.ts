import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classifyByAge,
  classifyFreshness,
  computeLastUpdatedSeconds,
  isFeedUntrustworthy,
  isVehicleDegraded,
  liveBadgeLabel,
  liveBadgeShowsDot,
  markerOpacityForFreshness,
  newestPositionAgeSeconds,
  shouldInterpolateMarkers,
  showFreshnessBanner,
} from "../lib/freshness";

describe("freshness classifier", () => {
  it("classifies age boundaries", () => {
    assert.equal(classifyByAge(59), "live");
    assert.equal(classifyByAge(60), "delayed");
    assert.equal(classifyByAge(300), "delayed");
    assert.equal(classifyByAge(301), "timetable");
    assert.equal(classifyByAge(null), "timetable");
  });

  it("marks feed down as untrustworthy", () => {
    assert.equal(isFeedUntrustworthy({ feedStatus: "down" }), true);
    assert.equal(isFeedUntrustworthy({ feedStatus: "degraded" }), false);
    assert.equal(isFeedUntrustworthy({ feedStatus: "live" }), false);
  });

  it("enters offline after three failed polls", () => {
    const result = classifyFreshness({
      serverGeneratedAt: "2026-07-19T12:00:00.000Z",
      newestPositionAgeSeconds: 10,
      consecutiveFailures: 3,
      quality: { feedStatus: "live" },
      previous: null,
      nowMs: Date.parse("2026-07-19T12:00:30.000Z"),
    });
    assert.equal(result.state, "offline");
    assert.equal(result.reason, "poll_failures");
  });

  it("requires two good polls before returning to live", () => {
    const base = {
      serverGeneratedAt: "2026-07-19T12:00:00.000Z",
      newestPositionAgeSeconds: 20,
      consecutiveFailures: 0,
      quality: { feedStatus: "live" as const },
      nowMs: Date.parse("2026-07-19T12:00:30.000Z"),
    };

    const fromDelayed = classifyFreshness({
      ...base,
      previous: {
        state: "delayed",
        consecutiveGoodPolls: 0,
        reason: "delayed_data",
        anchorGeneratedAt: base.serverGeneratedAt,
      },
    });
    assert.equal(fromDelayed.state, "delayed");
    assert.equal(fromDelayed.reason, "recovering");
    assert.equal(fromDelayed.consecutiveGoodPolls, 1);

    const secondGood = classifyFreshness({
      ...base,
      previous: {
        state: "delayed",
        consecutiveGoodPolls: 1,
        reason: "recovering",
        anchorGeneratedAt: base.serverGeneratedAt,
      },
    });
    assert.equal(secondGood.state, "live");
    assert.equal(secondGood.consecutiveGoodPolls, 2);
  });

  it("keeps last updated counting from the server anchor during outages", () => {
    const anchor = "2026-07-19T12:00:00.000Z";
    const first = classifyFreshness({
      serverGeneratedAt: anchor,
      newestPositionAgeSeconds: 30,
      consecutiveFailures: 0,
      quality: { feedStatus: "live" },
      previous: null,
      nowMs: Date.parse("2026-07-19T12:00:45.000Z"),
    });
    assert.equal(first.lastUpdatedSeconds, 45);

    const failing = classifyFreshness({
      serverGeneratedAt: null,
      newestPositionAgeSeconds: 30,
      consecutiveFailures: 2,
      quality: { feedStatus: "live" },
      previous: {
        state: first.state,
        consecutiveGoodPolls: first.consecutiveGoodPolls,
        reason: first.reason,
        anchorGeneratedAt: first.anchorGeneratedAt,
      },
      nowMs: Date.parse("2026-07-19T12:01:00.000Z"),
    });
    assert.equal(failing.anchorGeneratedAt, anchor);
    assert.equal(failing.lastUpdatedSeconds, 60);
  });

  it("flags degraded vehicles individually", () => {
    assert.equal(isVehicleDegraded(["FRESH"]), false);
    assert.equal(isVehicleDegraded(["STALE"]), true);
    assert.equal(isVehicleDegraded(["OFF_ROUTE"]), true);
    assert.equal(markerOpacityForFreshness("live", true), 0.55);
    assert.equal(markerOpacityForFreshness("live", false), 1);
    assert.equal(markerOpacityForFreshness("timetable", false), 0.45);
    assert.equal(markerOpacityForFreshness("offline", false), 0);
  });

  it("exposes UI helpers", () => {
    assert.equal(liveBadgeLabel("live"), "LIVE");
    assert.equal(liveBadgeLabel("timetable"), "TIMETABLE ONLY");
    assert.equal(liveBadgeShowsDot("timetable"), false);
    assert.equal(shouldInterpolateMarkers("live"), true);
    assert.equal(shouldInterpolateMarkers("delayed"), true);
    assert.equal(shouldInterpolateMarkers("timetable"), false);
    assert.equal(showFreshnessBanner("timetable", false), true);
    assert.equal(showFreshnessBanner("timetable", true), false);
  });

  it("picks the freshest vehicle age", () => {
    assert.equal(newestPositionAgeSeconds([120, 30, 80]), 30);
    assert.equal(newestPositionAgeSeconds([]), null);
  });

  it("computes last updated seconds from anchor", () => {
    assert.equal(
      computeLastUpdatedSeconds(
        "2026-07-19T12:00:00.000Z",
        Date.parse("2026-07-19T12:00:12.000Z"),
      ),
      12,
    );
  });
});
