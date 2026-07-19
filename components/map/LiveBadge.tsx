"use client";

import {
  liveBadgeLabel,
  liveBadgeShowsDot,
  type FreshnessState,
} from "@/lib/freshness";
import styles from "./LiveBadge.module.css";

export type LiveBadgeState = FreshnessState;

type Props = {
  state?: LiveBadgeState;
  className?: string;
};

/**
 * Honesty badge (Tickets 201 + 206). Text and dot shape convey state — not colour alone.
 */
export function LiveBadge({ state = "live", className }: Props) {
  const label = liveBadgeLabel(state);
  const showDot = liveBadgeShowsDot(state);

  return (
    <div
      className={[styles.badge, styles[state], className].filter(Boolean).join(" ")}
      data-state={state}
      role="status"
      aria-live="polite"
    >
      {showDot ? <span className={styles.dot} aria-hidden /> : (
        <span className={styles.square} aria-hidden />
      )}
      <span className={styles.label}>{label}</span>
    </div>
  );
}
