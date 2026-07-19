"use client";

import { showFreshnessBanner } from "@/lib/freshness";
import { useFreshnessContext } from "./MapContext";
import styles from "./FreshnessBanner.module.css";

/** Dismissible timetable-only banner (Ticket 206). */
export function FreshnessBanner() {
  const { freshness, bannerDismissed, setBannerDismissed } =
    useFreshnessContext();

  if (!freshness || !showFreshnessBanner(freshness.state, bannerDismissed)) {
    return null;
  }

  return (
    <div className={styles.banner} role="status">
      <p className={styles.text}>No live data — showing scheduled times</p>
      <button
        type="button"
        className={styles.dismiss}
        aria-label="Dismiss banner"
        onClick={() => setBannerDismissed(true)}
      >
        ×
      </button>
    </div>
  );
}
