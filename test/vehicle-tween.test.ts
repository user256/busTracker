import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyFeedSnapshot,
  MAX_INTERP_METRES,
  MISS_BEFORE_REMOVE,
  nextBackoffMs,
  sampleTweens,
  vehicleLabel,
  type FeedVehicle,
} from "../lib/map/vehicleTween";
import { haversineMetres } from "../lib/map/geo";

function v(
  partial: Partial<FeedVehicle> & Pick<FeedVehicle, "vehicle_id" | "lat" | "lon">,
): FeedVehicle {
  return {
    route_id: "55",
    route_short_name: "55",
    bearing: 90,
    speed_mps: 10,
    quality: ["FRESH"],
    ...partial,
  };
}

describe("vehicleTween", () => {
  it("labels prefer route_short_name", () => {
    assert.equal(
      vehicleLabel(
        v({ vehicle_id: "1", lat: 0, lon: 0, route_short_name: "23" }),
      ),
      "23",
    );
    assert.equal(
      vehicleLabel(
        v({
          vehicle_id: "1",
          lat: 0,
          lon: 0,
          route_short_name: null,
          route_id: "X",
        }),
      ),
      "X",
    );
  });

  it("backs off 10→20→40… capped at 120s", () => {
    assert.equal(nextBackoffMs(1), 10_000);
    assert.equal(nextBackoffMs(2), 20_000);
    assert.equal(nextBackoffMs(3), 40_000);
    assert.equal(nextBackoffMs(8), 120_000);
  });

  it("interpolates normally under 500m", () => {
    const t0 = applyFeedSnapshot(
      new Map(),
      [v({ vehicle_id: "a", lat: 56.2, lon: -3.42 })],
      0,
      { reducedMotion: false, pollIntervalMs: 10_000 },
    );
    // ~111m north
    const t1 = applyFeedSnapshot(
      t0,
      [v({ vehicle_id: "a", lat: 56.201, lon: -3.42 })],
      1_000,
      { reducedMotion: false, pollIntervalMs: 10_000 },
    );
    const tw = t1.get("a")!;
    assert.equal(tw.snap, false);
    assert.ok(tw.durationMs === 10_000);
    const mid = sampleTweens(t1, 1_000 + 5_000).rendered[0]!;
    assert.ok(mid.lat > 56.2 && mid.lat < 56.201);
  });

  it("snaps when move exceeds 500m", () => {
    const t0 = applyFeedSnapshot(
      new Map(),
      [v({ vehicle_id: "a", lat: 56.2, lon: -3.42 })],
      0,
      { reducedMotion: false },
    );
    const farLat = 56.21; // ~1.1 km
    assert.ok(
      haversineMetres(-3.42, 56.2, -3.42, farLat) > MAX_INTERP_METRES,
    );
    const t1 = applyFeedSnapshot(
      t0,
      [v({ vehicle_id: "a", lat: farLat, lon: -3.42 })],
      100,
      { reducedMotion: false },
    );
    assert.equal(t1.get("a")!.snap, true);
    assert.equal(t1.get("a")!.durationMs, 0);
  });

  it("snaps under prefers-reduced-motion", () => {
    const t0 = applyFeedSnapshot(
      new Map(),
      [v({ vehicle_id: "a", lat: 56.2, lon: -3.42 })],
      0,
      { reducedMotion: true },
    );
    const t1 = applyFeedSnapshot(
      t0,
      [v({ vehicle_id: "a", lat: 56.2005, lon: -3.42 })],
      50,
      { reducedMotion: true },
    );
    assert.equal(t1.get("a")!.snap, true);
  });

  it("removes after two missed successful polls with fade", () => {
    let m = applyFeedSnapshot(
      new Map(),
      [v({ vehicle_id: "a", lat: 56.2, lon: -3.42 })],
      0,
      { reducedMotion: false },
    );
    m = applyFeedSnapshot(m, [], 10, { reducedMotion: false });
    assert.equal(m.get("a")!.missedPolls, 1);
    assert.equal(m.get("a")!.removing, false);
    m = applyFeedSnapshot(m, [], 20, { reducedMotion: false });
    assert.equal(m.get("a")!.missedPolls, MISS_BEFORE_REMOVE);
    assert.equal(m.get("a")!.removing, true);

    const fading = sampleTweens(m, 20 + 150);
    assert.equal(fading.rendered.length, 1);
    assert.ok(fading.rendered[0]!.opacity < 1);

    const gone = sampleTweens(m, 20 + 400);
    assert.equal(gone.rendered.length, 0);
    assert.equal(gone.alive.size, 0);
  });

  it("suppresses bearing spin when stationary", () => {
    const t0 = applyFeedSnapshot(
      new Map(),
      [v({ vehicle_id: "a", lat: 56.2, lon: -3.42, bearing: 10, speed_mps: 0.2 })],
      0,
      { reducedMotion: false },
    );
    assert.equal(t0.get("a")!.showBearing, false);
  });
});
