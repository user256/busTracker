"use client";

import styles from "./LiveBadge.module.css";

export type LiveBadgeState = "live" | "delayed" | "timetable" | "offline";

const LABELS: Record<LiveBadgeState, string> = {
  live: "LIVE",
  delayed: "DELAYED",
  timetable: "TIMETABLE",
  offline: "OFFLINE",
};

type Props = {
  state?: LiveBadgeState;
  className?: string;
};

/**
 * Honesty badge slot (Ticket 201). Real freshness wiring is Ticket 206;
 * non-live states are reachable via `state` prop for demos.
 */
export function LiveBadge({ state = "live", className }: Props) {
  return (
    <div
      className={[styles.badge, styles[state], className].filter(Boolean).join(" ")}
      data-state={state}
      role="status"
      aria-live="polite"
    >
      <span className={styles.dot} aria-hidden />
      <span className={styles.label}>{LABELS[state]}</span>
    </div>
  );
}
