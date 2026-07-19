/**
 * Classify arrival provenance for passenger UI (Tickets 204 / 206).
 * Text + icon required — never colour alone.
 */

export type ArrivalProvenanceKind = "live" | "delayed" | "scheduled";

export type ArrivalProvenance = {
  kind: ArrivalProvenanceKind;
  /** Passenger-facing label, e.g. "Live", "Delayed +3m", "Scheduled" */
  label: string;
  /** Icon token (not a colour) */
  icon: ArrivalProvenanceKind;
};

/** Delay ≥ this many seconds flips Live → Delayed +Nm (Ticket 204 proposed default). */
export const DELAY_THRESHOLD_SECONDS = 120;

export function classifyArrivalProvenance(input: {
  source: "realtime" | "scheduled";
  delaySeconds: number | null;
  delayThresholdSeconds?: number;
}): ArrivalProvenance {
  const threshold = input.delayThresholdSeconds ?? DELAY_THRESHOLD_SECONDS;

  if (input.source !== "realtime") {
    return { kind: "scheduled", label: "Scheduled", icon: "scheduled" };
  }

  const delay = input.delaySeconds ?? 0;
  if (delay >= threshold) {
    const minutes = Math.max(1, Math.round(delay / 60));
    return {
      kind: "delayed",
      label: `Delayed +${minutes}m`,
      icon: "delayed",
    };
  }

  return { kind: "live", label: "Live", icon: "live" };
}
