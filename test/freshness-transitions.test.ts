import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classifyFreshness,
  liveBadgeLabel,
  markerOpacityForFreshness,
  shouldInterpolateMarkers,
  showFreshnessBanner,
  type FreshnessResult,
} from "../lib/freshness";
import {
  emitFreshnessTransition,
  setFreshnessTelemetrySink,
  type FreshnessTransitionEvent,
} from "../lib/freshnessTelemetry";

type FeedTick = {
  generatedAt: string | null;
  ages: number[];
  consecutiveFailures: number;
  feedStatus: "live" | "degraded" | "down" | null;
};

function stepFeed(
  previous: FreshnessResult | null,
  tick: FeedTick,
  nowMs: number,
): FreshnessResult {
  const newestAge =
    tick.ages.length > 0 ? Math.min(...tick.ages) : null;
  return classifyFreshness({
    serverGeneratedAt: tick.generatedAt,
    newestPositionAgeSeconds: newestAge,
    consecutiveFailures: tick.consecutiveFailures,
    quality: { feedStatus: tick.feedStatus },
    previous: previous
      ? {
          state: previous.state,
          consecutiveGoodPolls: previous.consecutiveGoodPolls,
          reason: previous.reason,
          anchorGeneratedAt: previous.anchorGeneratedAt,
        }
      : null,
    nowMs,
  });
}

describe("freshness UI transitions", () => {
  it("walks fresh → slow → stale → dead → recovering", () => {
    const t0 = Date.parse("2026-07-19T08:00:00.000Z");
    const anchor = "2026-07-19T08:00:00.000Z";
    let state: FreshnessResult | null = null;
    const events: FreshnessTransitionEvent[] = [];
    setFreshnessTelemetrySink((event) => events.push(event));

    const stages: Array<{
      name: string;
      tick: FeedTick;
      offsetMs: number;
      badge: string;
      banner: boolean;
      interpolate: boolean;
      markerOpacity: number;
    }> = [
      {
        name: "fresh",
        tick: {
          generatedAt: anchor,
          ages: [20],
          consecutiveFailures: 0,
          feedStatus: "live",
        },
        offsetMs: 0,
        badge: "LIVE",
        banner: false,
        interpolate: true,
        markerOpacity: 1,
      },
      {
        name: "slow",
        tick: {
          generatedAt: anchor,
          ages: [90],
          consecutiveFailures: 0,
          feedStatus: "live",
        },
        offsetMs: 60_000,
        badge: "DELAYED",
        banner: false,
        interpolate: true,
        markerOpacity: 1,
      },
      {
        name: "stale",
        tick: {
          generatedAt: anchor,
          ages: [360],
          consecutiveFailures: 0,
          feedStatus: "live",
        },
        offsetMs: 300_000,
        badge: "TIMETABLE ONLY",
        banner: true,
        interpolate: false,
        markerOpacity: 0.45,
      },
      {
        name: "dead",
        tick: {
          generatedAt: null,
          ages: [360],
          consecutiveFailures: 3,
          feedStatus: "live",
        },
        offsetMs: 360_000,
        badge: "OFFLINE",
        banner: false,
        interpolate: false,
        markerOpacity: 0,
      },
      {
        name: "recovering-first-good",
        tick: {
          generatedAt: "2026-07-19T08:07:00.000Z",
          ages: [15],
          consecutiveFailures: 0,
          feedStatus: "live",
        },
        offsetMs: 420_000,
        badge: "DELAYED",
        banner: false,
        interpolate: true,
        markerOpacity: 1,
      },
      {
        name: "recovering-live",
        tick: {
          generatedAt: "2026-07-19T08:07:10.000Z",
          ages: [12],
          consecutiveFailures: 0,
          feedStatus: "live",
        },
        offsetMs: 430_000,
        badge: "LIVE",
        banner: false,
        interpolate: true,
        markerOpacity: 1,
      },
    ];

    let previousState: FreshnessResult | null = null;
    for (const stage of stages) {
      state = stepFeed(state, stage.tick, t0 + stage.offsetMs);
      if (!previousState || previousState.state !== state.state) {
        emitFreshnessTransition({
          state: state.state,
          previousState: previousState?.state ?? null,
          reason: state.reason,
          durationMs: stage.offsetMs,
          at: new Date(t0 + stage.offsetMs).toISOString(),
        });
      }
      previousState = state;
      assert.equal(
        liveBadgeLabel(state.state),
        stage.badge,
        `${stage.name} badge`,
      );
      assert.equal(
        showFreshnessBanner(state.state, false),
        stage.banner,
        `${stage.name} banner`,
      );
      assert.equal(
        shouldInterpolateMarkers(state.state),
        stage.interpolate,
        `${stage.name} interpolation`,
      );
      assert.equal(
        markerOpacityForFreshness(state.state, false),
        stage.markerOpacity,
        `${stage.name} marker opacity`,
      );
    }

    assert.ok(events.length >= 4, "expected telemetry on major transitions");
    assert.equal(events[0]?.state, "live");
    assert.match(JSON.stringify(events), /freshness_state_transition/);
  });
});
