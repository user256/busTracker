"use client";

import { useEffect, useState } from "react";
import { useFreshnessContext } from "./MapContext";
import styles from "./LastUpdated.module.css";

/** Visible "Last updated Ns ago" line sourced from server generated_at (Ticket 206). */
export function LastUpdated() {
  const { freshness } = useFreshnessContext();
  const [seconds, setSeconds] = useState<number | null>(
    freshness?.lastUpdatedSeconds ?? null,
  );

  useEffect(() => {
    const tick = () => {
      if (!freshness?.anchorGeneratedAt) {
        setSeconds(freshness?.lastUpdatedSeconds ?? null);
        return;
      }
      const ts = new Date(freshness.anchorGeneratedAt).getTime();
      if (Number.isNaN(ts)) {
        setSeconds(null);
        return;
      }
      setSeconds(Math.max(0, Math.floor((Date.now() - ts) / 1000)));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [freshness?.anchorGeneratedAt, freshness?.lastUpdatedSeconds]);

  if (seconds == null) return null;

  return (
    <p className={styles.line} role="status" aria-live="polite">
      Last updated {seconds}s ago
    </p>
  );
}
