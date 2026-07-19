"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FeedVehicle } from "@/lib/map/vehicleTween";
import { nextBackoffMs, POLL_INTERVAL_MS } from "@/lib/map/vehicleTween";

export type VehicleFeedResponse = {
  generated_at: string;
  feed_timestamp: string | null;
  feed_status: "live" | "degraded" | "down";
  vehicles: FeedVehicle[];
};

export type VehicleFeedHookState = {
  vehicles: FeedVehicle[];
  feedStatus: "live" | "degraded" | "down" | null;
  /** Server envelope timestamp — preserved through poll failures (Ticket 206). */
  generatedAt: string | null;
  error: string | null;
  consecutiveFailures: number;
  lastSuccessAt: number | null;
  polling: boolean;
};

type Options = {
  /** Current viewport bbox: minLon,minLat,maxLon,maxLat */
  getBbox: () => string | null;
  enabled?: boolean;
  pollIntervalMs?: number;
  /** Bump when the map viewport settles to trigger an immediate poll. */
  bboxRevision?: number;
};

/**
 * Polls Ticket 106 vehicles API (`/api/v1/vehicles`) for the current viewport.
 * Pauses when the document is hidden; backs off on consecutive failures.
 */
export function useVehicleFeed(options: Options): VehicleFeedHookState {
  const {
    getBbox,
    enabled = true,
    pollIntervalMs = POLL_INTERVAL_MS,
    bboxRevision = 0,
  } = options;

  const [state, setState] = useState<VehicleFeedHookState>({
    vehicles: [],
    feedStatus: null,
    generatedAt: null,
    error: null,
    consecutiveFailures: 0,
    lastSuccessAt: null,
    polling: false,
  });

  const failuresRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const getBboxRef = useRef(getBbox);
  getBboxRef.current = getBbox;
  const etagRef = useRef<string | null>(null);
  const pollIntervalRef = useRef(pollIntervalMs);
  pollIntervalRef.current = pollIntervalMs;

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const poll = useCallback(async () => {
    if (!enabled) return;
    if (
      typeof document !== "undefined" &&
      document.visibilityState === "hidden"
    ) {
      return;
    }

    const bbox = getBboxRef.current();
    if (!bbox) return;

    setState((s) => ({ ...s, polling: true }));

    try {
      const headers: Record<string, string> = {
        Accept: "application/json",
      };
      if (etagRef.current) headers["If-None-Match"] = etagRef.current;

      const res = await fetch(
        `/api/v1/vehicles?bbox=${encodeURIComponent(bbox)}`,
        { headers },
      );

      if (res.status === 304) {
        failuresRef.current = 0;
        setState((s) => ({
          ...s,
          polling: false,
          error: null,
          consecutiveFailures: 0,
          lastSuccessAt: Date.now(),
          // Keep vehicles, generatedAt, lastSuccessAt — avoid resetting mid-tween.
        }));
        return;
      }

      if (!res.ok) {
        throw new Error(`vehicles HTTP ${res.status}`);
      }

      const etag = res.headers.get("etag");
      if (etag) etagRef.current = etag;

      const body = (await res.json()) as VehicleFeedResponse;
      failuresRef.current = 0;
      setState((s) => ({
        vehicles: body.vehicles ?? [],
        feedStatus: body.feed_status,
        generatedAt: body.generated_at ?? s.generatedAt,
        error: null,
        consecutiveFailures: 0,
        lastSuccessAt: Date.now(),
        polling: false,
      }));
    } catch (err) {
      failuresRef.current += 1;
      setState((s) => ({
        ...s,
        polling: false,
        error: err instanceof Error ? err.message : String(err),
        consecutiveFailures: failuresRef.current,
        // Preserve vehicles + generatedAt so "last updated" keeps counting.
      }));
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      clearTimer();
      return;
    }

    let cancelled = false;

    const schedule = (delay: number) => {
      clearTimer();
      timerRef.current = setTimeout(async () => {
        if (cancelled) return;
        await poll();
        if (cancelled) return;
        const fail = failuresRef.current;
        const next =
          fail > 0 ? nextBackoffMs(fail) : pollIntervalRef.current;
        schedule(next);
      }, delay);
    };

    void (async () => {
      await poll();
      if (!cancelled) {
        const fail = failuresRef.current;
        schedule(fail > 0 ? nextBackoffMs(fail) : pollIntervalRef.current);
      }
    })();

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        clearTimer();
        void (async () => {
          await poll();
          if (!cancelled) {
            const fail = failuresRef.current;
            schedule(fail > 0 ? nextBackoffMs(fail) : pollIntervalRef.current);
          }
        })();
      } else {
        clearTimer();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      clearTimer();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, poll]);

  // Viewport settled → immediate poll (new bbox).
  useEffect(() => {
    if (!enabled || bboxRevision === 0) return;
    void poll();
  }, [bboxRevision, enabled, poll]);

  return state;
}
