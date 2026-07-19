/**
 * Pure freshness classifier for the live map (Ticket 206).
 * Keeps React/MapLibre out so unit and transition tests stay cheap.
 */

export type FreshnessState = "live" | "delayed" | "timetable" | "offline";

export const DEFAULT_FRESHNESS_THRESHOLDS = {
  liveMaxAgeSeconds: 60,
  delayedMaxAgeSeconds: 300,
  offlineAfterFailures: 3,
  recoveryGoodPolls: 2,
} as const;

export type FreshnessThresholds = {
  liveMaxAgeSeconds: number;
  delayedMaxAgeSeconds: number;
  offlineAfterFailures: number;
  recoveryGoodPolls: number;
};

export type FreshnessQualityInput = {
  feedStatus: "live" | "degraded" | "down" | null;
  /** When true, Ticket 105 marks the feed untrustworthy for passenger display. */
  feedUntrustworthy?: boolean;
};

export type FreshnessReason =
  | "fresh_data"
  | "delayed_data"
  | "stale_data"
  | "no_positions"
  | "untrustworthy_feed"
  | "poll_failures"
  | "recovering";

export type FreshnessMachineSnapshot = {
  state: FreshnessState;
  consecutiveGoodPolls: number;
  reason: FreshnessReason;
  /** Server `generated_at` anchor — preserved through poll outages. */
  anchorGeneratedAt: string | null;
};

export type ClassifyFreshnessInput = {
  serverGeneratedAt: string | null;
  newestPositionAgeSeconds: number | null;
  consecutiveFailures: number;
  quality: FreshnessQualityInput;
  previous: FreshnessMachineSnapshot | null;
  nowMs?: number;
  thresholds?: Partial<FreshnessThresholds>;
};

export type FreshnessResult = FreshnessMachineSnapshot & {
  lastUpdatedSeconds: number | null;
};

export type VehicleQualityLabel = string;

const DEGRADED_VEHICLE_LABELS = new Set([
  "STALE",
  "VERY_STALE",
  "IMPLAUSIBLE_SPEED",
  "OFF_ROUTE",
]);

export function mergeThresholds(
  partial?: Partial<FreshnessThresholds>,
): FreshnessThresholds {
  return { ...DEFAULT_FRESHNESS_THRESHOLDS, ...partial };
}

export function isFeedUntrustworthy(quality: FreshnessQualityInput): boolean {
  if (quality.feedUntrustworthy) return true;
  return quality.feedStatus === "down";
}

export function newestPositionAgeSeconds(
  ages: Array<number | null | undefined>,
): number | null {
  let best: number | null = null;
  for (const age of ages) {
    if (typeof age !== "number" || !Number.isFinite(age)) continue;
    best = best == null ? age : Math.min(best, age);
  }
  return best;
}

export function computeLastUpdatedSeconds(
  anchorGeneratedAt: string | null,
  nowMs: number,
): number | null {
  if (!anchorGeneratedAt) return null;
  const ts = new Date(anchorGeneratedAt).getTime();
  if (Number.isNaN(ts)) return null;
  return Math.max(0, Math.floor((nowMs - ts) / 1000));
}

/** Age-only classification — ignores offline, hysteresis, and feed trust. */
export function classifyByAge(
  newestPositionAgeSeconds: number | null,
  thresholds: FreshnessThresholds = DEFAULT_FRESHNESS_THRESHOLDS,
): FreshnessState {
  if (newestPositionAgeSeconds == null) return "timetable";
  if (newestPositionAgeSeconds < thresholds.liveMaxAgeSeconds) return "live";
  if (newestPositionAgeSeconds <= thresholds.delayedMaxAgeSeconds) {
    return "delayed";
  }
  return "timetable";
}

function ageReason(
  newestPositionAgeSeconds: number | null,
  thresholds: FreshnessThresholds,
): FreshnessReason {
  if (newestPositionAgeSeconds == null) return "no_positions";
  if (newestPositionAgeSeconds < thresholds.liveMaxAgeSeconds) {
    return "fresh_data";
  }
  if (newestPositionAgeSeconds <= thresholds.delayedMaxAgeSeconds) {
    return "delayed_data";
  }
  return "stale_data";
}

/**
 * Step the freshness state machine for one feed tick.
 * `serverGeneratedAt` updates on successful polls; during failures the previous
 * anchor continues driving "Last updated Ns ago".
 */
export function classifyFreshness(
  input: ClassifyFreshnessInput,
): FreshnessResult {
  const thresholds = mergeThresholds(input.thresholds);
  const nowMs = input.nowMs ?? Date.now();
  const prev = input.previous;
  const anchorGeneratedAt =
    input.serverGeneratedAt ?? prev?.anchorGeneratedAt ?? null;
  const lastUpdatedSeconds = computeLastUpdatedSeconds(
    anchorGeneratedAt,
    nowMs,
  );

  if (input.consecutiveFailures >= thresholds.offlineAfterFailures) {
    return {
      state: "offline",
      consecutiveGoodPolls: 0,
      reason: "poll_failures",
      anchorGeneratedAt,
      lastUpdatedSeconds,
    };
  }

  if (isFeedUntrustworthy(input.quality)) {
    return {
      state: "timetable",
      consecutiveGoodPolls: 0,
      reason: "untrustworthy_feed",
      anchorGeneratedAt,
      lastUpdatedSeconds,
    };
  }

  const ageState = classifyByAge(
    input.newestPositionAgeSeconds,
    thresholds,
  );
  const pollSucceeded = input.consecutiveFailures === 0;
  const wouldBeLive = pollSucceeded && ageState === "live";
  const prevGood = prev?.consecutiveGoodPolls ?? 0;
  const consecutiveGoodPolls = wouldBeLive ? prevGood + 1 : 0;

  let state = ageState;
  let reason = ageReason(input.newestPositionAgeSeconds, thresholds);

  if (
    wouldBeLive &&
    prev &&
    prev.state !== "live" &&
    consecutiveGoodPolls < thresholds.recoveryGoodPolls
  ) {
    state = "delayed";
    reason = "recovering";
  }

  return {
    state,
    consecutiveGoodPolls,
    reason,
    anchorGeneratedAt,
    lastUpdatedSeconds,
  };
}

/** Per-vehicle degraded treatment while the overall feed may still be live. */
export function isVehicleDegraded(quality: VehicleQualityLabel[]): boolean {
  return quality.some((label) => DEGRADED_VEHICLE_LABELS.has(label));
}

export function markerOpacityForFreshness(
  mapState: FreshnessState,
  vehicleDegraded: boolean,
): number {
  if (mapState === "offline") return 0;
  if (mapState === "timetable") return 0.45;
  if (vehicleDegraded) return 0.55;
  return 1;
}

export function shouldInterpolateMarkers(mapState: FreshnessState): boolean {
  return mapState === "live" || mapState === "delayed";
}

export function showFreshnessBanner(
  mapState: FreshnessState,
  dismissed: boolean,
): boolean {
  return mapState === "timetable" && !dismissed;
}

export function liveBadgeLabel(state: FreshnessState): string {
  switch (state) {
    case "live":
      return "LIVE";
    case "delayed":
      return "DELAYED";
    case "timetable":
      return "TIMETABLE ONLY";
    case "offline":
      return "OFFLINE";
  }
}

export function liveBadgeShowsDot(state: FreshnessState): boolean {
  return state !== "timetable";
}
