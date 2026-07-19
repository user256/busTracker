"use client";

import { useEffect, useState } from "react";
import { useMapInstance } from "./MapContext";
import styles from "./MapControls.module.css";

/**
 * Ember.to-style vertical control stack: geolocate, +, −, compass.
 * Hit targets are 44×44 CSS px.
 */
export function MapControls() {
  const map = useMapInstance();
  const [bearing, setBearing] = useState(0);

  useEffect(() => {
    if (!map) return;
    const sync = () => setBearing(map.getBearing());
    map.on("rotate", sync);
    map.on("pitch", sync);
    sync();
    return () => {
      map.off("rotate", sync);
      map.off("pitch", sync);
    };
  }, [map]);

  const zoomIn = () => map?.zoomIn({ duration: 200 });
  const zoomOut = () => map?.zoomOut({ duration: 200 });
  const resetBearing = () =>
    map?.easeTo({ bearing: 0, pitch: 0, duration: 300 });

  const geolocate = () => {
    if (!map || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        map.easeTo({
          center: [pos.coords.longitude, pos.coords.latitude],
          zoom: Math.max(map.getZoom(), 13),
          duration: 600,
        });
      },
      () => {
        /* permission denied — silent for shell */
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  return (
    <div className={styles.stack} role="group" aria-label="Map controls">
      <button
        type="button"
        className={styles.btn}
        aria-label="Show my location"
        onClick={geolocate}
        disabled={!map}
      >
        <CrosshairIcon />
      </button>
      <button
        type="button"
        className={styles.btn}
        aria-label="Zoom in"
        onClick={zoomIn}
        disabled={!map}
      >
        +
      </button>
      <button
        type="button"
        className={styles.btn}
        aria-label="Zoom out"
        onClick={zoomOut}
        disabled={!map}
      >
        −
      </button>
      <button
        type="button"
        className={styles.btn}
        aria-label="Reset north"
        onClick={resetBearing}
        disabled={!map}
      >
        <span
          className={styles.compass}
          style={{ transform: `rotate(${-bearing}deg)` }}
          aria-hidden
        >
          ↑
        </span>
      </button>
    </div>
  );
}

function CrosshairIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 2v4M12 18v4M2 12h4M18 12h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
