/**
 * Pure helpers for vehicle marker interpolation (Ticket 203).
 * Kept free of React/MapLibre so unit tests stay cheap.
 */

import {
  bearingDegrees,
  haversineMetres,
  lerp,
  lerpBearing,
} from "./geo";

export const POLL_INTERVAL_MS = 10_000;
export const MAX_INTERP_METRES = 500;
export const STATIONARY_SPEED_MPS = 1;
export const MISS_BEFORE_REMOVE = 2;
export const FADE_OUT_MS = 300;
export const BASE_BACKOFF_MS = 10_000;
export const MAX_BACKOFF_MS = 120_000;

export type FeedVehicle = {
  vehicle_id: string;
  route_id: string | null;
  route_short_name: string | null;
  lat: number;
  lon: number;
  bearing: number | null;
  speed_mps: number | null;
  quality: string[];
};

export type VehicleTween = {
  vehicleId: string;
  label: string;
  fromLon: number;
  fromLat: number;
  toLon: number;
  toLat: number;
  fromBearing: number;
  toBearing: number;
  startedAt: number;
  durationMs: number;
  snap: boolean;
  showBearing: boolean;
  missedPolls: number;
  removing: boolean;
  removeStartedAt: number | null;
  opacity: number;
};

export function isSuspectQuality(quality: string[]): boolean {
  return quality.some(
    (q) =>
      q === "IMPLAUSIBLE_JUMP" ||
      q === "IMPLAUSIBLE_SPEED" ||
      q === "OFF_ROUTE",
  );
}

export function nextBackoffMs(consecutiveFailures: number): number {
  const exp = Math.max(0, consecutiveFailures - 1);
  return Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** exp);
}

export function vehicleLabel(v: FeedVehicle): string {
  const name = v.route_short_name?.trim() || v.route_id?.trim();
  return name && name.length > 0 ? name.slice(0, 4) : "?";
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Apply a successful poll snapshot onto the tween map.
 * Vehicles missing for MISS_BEFORE_REMOVE successful polls begin fade-out.
 */
export function applyFeedSnapshot(
  prev: Map<string, VehicleTween>,
  vehicles: FeedVehicle[],
  now: number,
  opts: { reducedMotion: boolean; pollIntervalMs?: number },
): Map<string, VehicleTween> {
  const duration = opts.pollIntervalMs ?? POLL_INTERVAL_MS;
  const next = new Map<string, VehicleTween>();
  const seen = new Set<string>();

  for (const v of vehicles) {
    seen.add(v.vehicle_id);
    const label = vehicleLabel(v);
    const existing = prev.get(v.vehicle_id);
    const fromLon = existing ? existing.toLon : v.lon;
    const fromLat = existing ? existing.toLat : v.lat;
    const dist = existing
      ? haversineMetres(fromLon, fromLat, v.lon, v.lat)
      : 0;
    const suspect = isSuspectQuality(v.quality);
    const snap =
      opts.reducedMotion ||
      !existing ||
      suspect ||
      dist > MAX_INTERP_METRES;

    if (snap && existing && dist > MAX_INTERP_METRES) {
      console.info(
        JSON.stringify({
          event: "vehicle_interp_snap",
          vehicle_id: v.vehicle_id,
          metres: Math.round(dist),
          reason: suspect ? "suspect_quality" : "over_500m",
        }),
      );
    }

    let toBearing =
      v.bearing != null && Number.isFinite(v.bearing)
        ? ((v.bearing % 360) + 360) % 360
        : existing
          ? bearingDegrees(fromLon, fromLat, v.lon, v.lat)
          : 0;
    const fromBearing = existing?.toBearing ?? toBearing;
    const speed = v.speed_mps ?? 0;
    const showBearing = speed >= STATIONARY_SPEED_MPS;

    next.set(v.vehicle_id, {
      vehicleId: v.vehicle_id,
      label,
      fromLon: snap ? v.lon : fromLon,
      fromLat: snap ? v.lat : fromLat,
      toLon: v.lon,
      toLat: v.lat,
      fromBearing: snap ? toBearing : fromBearing,
      toBearing: showBearing ? toBearing : fromBearing,
      startedAt: now,
      durationMs: snap ? 0 : duration,
      snap,
      showBearing,
      missedPolls: 0,
      removing: false,
      removeStartedAt: null,
      opacity: 1,
    });
  }

  for (const [id, tw] of prev) {
    if (seen.has(id)) continue;
    const missed = tw.missedPolls + 1;
    if (missed >= MISS_BEFORE_REMOVE) {
      if (tw.removing) {
        next.set(id, { ...tw, missedPolls: missed });
      } else {
        next.set(id, {
          ...tw,
          missedPolls: missed,
          removing: true,
          removeStartedAt: now,
          // freeze at current interpolated end
          fromLon: tw.toLon,
          fromLat: tw.toLat,
          durationMs: 0,
        });
      }
    } else {
      next.set(id, { ...tw, missedPolls: missed });
    }
  }

  return next;
}

export type RenderedVehicle = {
  vehicleId: string;
  lon: number;
  lat: number;
  bearing: number;
  label: string;
  opacity: number;
  showBearing: boolean;
};

/** Sample all tweens at `now`; drop finished fade-outs. */
export function sampleTweens(
  tweens: Map<string, VehicleTween>,
  now: number,
): { rendered: RenderedVehicle[]; alive: Map<string, VehicleTween> } {
  const alive = new Map<string, VehicleTween>();
  const rendered: RenderedVehicle[] = [];

  for (const [id, tw] of tweens) {
    if (tw.removing && tw.removeStartedAt != null) {
      const fadeT = Math.min(1, (now - tw.removeStartedAt) / FADE_OUT_MS);
      const opacity = 1 - fadeT;
      if (opacity <= 0.01) continue;
      alive.set(id, { ...tw, opacity });
      rendered.push({
        vehicleId: id,
        lon: tw.toLon,
        lat: tw.toLat,
        bearing: tw.toBearing,
        label: tw.label,
        opacity,
        showBearing: tw.showBearing,
      });
      continue;
    }

    const t =
      tw.durationMs <= 0
        ? 1
        : Math.min(1, Math.max(0, (now - tw.startedAt) / tw.durationMs));
    const lon = lerp(tw.fromLon, tw.toLon, t);
    const lat = lerp(tw.fromLat, tw.toLat, t);
    const bearing = tw.showBearing
      ? lerpBearing(tw.fromBearing, tw.toBearing, t)
      : tw.fromBearing;

    alive.set(id, tw);
    rendered.push({
      vehicleId: id,
      lon,
      lat,
      bearing,
      label: tw.label,
      opacity: tw.opacity,
      showBearing: tw.showBearing,
    });
  }

  return { rendered, alive };
}
