"use client";

import { useEffect, useRef, useState } from "react";
import {
  classifyFreshness,
  newestPositionAgeSeconds,
  type FreshnessResult,
} from "@/lib/freshness";
import { emitFreshnessTransition } from "@/lib/freshnessTelemetry";
import type { VehicleFeedHookState } from "./useVehicleFeed";

/**
 * Derives map freshness from the vehicle feed and publishes transitions (Ticket 206).
 */
export function useFreshnessFromFeed(
  feed: VehicleFeedHookState,
  setFreshness: (result: FreshnessResult) => void,
  setBannerDismissed: (dismissed: boolean) => void,
): FreshnessResult | null {
  const snapshotRef = useRef<FreshnessResult | null>(null);
  const enteredAtRef = useRef<number>(Date.now());
  const [result, setResult] = useState<FreshnessResult | null>(null);

  useEffect(() => {
    const previous = snapshotRef.current;
    const next = classifyFreshness({
      serverGeneratedAt: feed.generatedAt,
      newestPositionAgeSeconds: newestPositionAgeSeconds(
        feed.vehicles.map((v) => v.age_seconds),
      ),
      consecutiveFailures: feed.consecutiveFailures,
      quality: { feedStatus: feed.feedStatus },
      previous: previous
        ? {
            state: previous.state,
            consecutiveGoodPolls: previous.consecutiveGoodPolls,
            reason: previous.reason,
            anchorGeneratedAt: previous.anchorGeneratedAt,
          }
        : null,
    });

    if (!previous || previous.state !== next.state) {
      emitFreshnessTransition({
        state: next.state,
        previousState: previous?.state ?? null,
        reason: next.reason,
        durationMs: Date.now() - enteredAtRef.current,
      });
      enteredAtRef.current = Date.now();
      if (next.state !== "timetable") {
        setBannerDismissed(false);
      }
    }

    snapshotRef.current = next;
    setResult(next);
    setFreshness(next);
  }, [
    feed.consecutiveFailures,
    feed.feedStatus,
    feed.generatedAt,
    feed.lastSuccessAt,
    feed.vehicles,
    setFreshness,
    setBannerDismissed,
  ]);

  return result;
}
