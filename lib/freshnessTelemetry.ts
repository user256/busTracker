import type { FreshnessReason, FreshnessState } from "./freshness";

export type FreshnessTransitionEvent = {
  event: "freshness_state_transition";
  state: FreshnessState;
  previous_state: FreshnessState | null;
  reason: FreshnessReason;
  duration_ms: number;
  at: string;
};

type TransitionSink = (payload: FreshnessTransitionEvent) => void;

let sink: TransitionSink = (payload) => {
  if (typeof console !== "undefined" && console.info) {
    console.info(JSON.stringify(payload));
  }
};

/** Test hook — replace telemetry sink. */
export function setFreshnessTelemetrySink(next: TransitionSink): void {
  sink = next;
}

export function emitFreshnessTransition(options: {
  state: FreshnessState;
  previousState: FreshnessState | null;
  reason: FreshnessReason;
  durationMs: number;
  at?: string;
}): void {
  sink({
    event: "freshness_state_transition",
    state: options.state,
    previous_state: options.previousState,
    reason: options.reason,
    duration_ms: Math.max(0, Math.round(options.durationMs)),
    at: options.at ?? new Date().toISOString(),
  });
}
