"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import { LiveBadge, type LiveBadgeState } from "./LiveBadge";
import { MapControls } from "./MapControls";
import { MapProvider, useMapSetter } from "./MapContext";
import { RouteNetwork } from "./RouteNetwork";
import { SLOT_LAYER_IDS, SLOT_SOURCE_PREFIX } from "./layerOrder";
import {
  DUMMY_BASEMAP_ATTRIBUTION,
  STADIA_BASEMAP_ATTRIBUTION,
} from "@/lib/map/dummyBasemap";
import styles from "./MapShell.module.css";

export type MapShellProps = {
  /** Initial center [lng, lat]. Default: Kinross area (dummy feed). */
  center?: [number, number];
  zoom?: number;
  /** Honesty badge; wire to feed health in Ticket 206. */
  liveState?: LiveBadgeState;
  className?: string;
};

const DEFAULT_CENTER: [number, number] = [-3.42, 56.205];
const DEFAULT_ZOOM = 10;

function MapShellInner({
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  liveState = "live",
}: MapShellProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const setMap = useMapSetter();
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [basemap, setBasemap] = useState<"stadia" | "dummy">("stadia");

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let cancelled = false;
    let ro: ResizeObserver | null = null;

    (async () => {
      try {
        const maplibre = await import("maplibre-gl");
        await import("maplibre-gl/dist/maplibre-gl.css");
        if (cancelled) return;

        const styleRes = await fetch("/api/map/style");
        if (!styleRes.ok) {
          const body = (await styleRes.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? `Style HTTP ${styleRes.status}`);
        }
        const provider =
          styleRes.headers.get("x-basemap-provider") === "dummy"
            ? "dummy"
            : "stadia";
        setBasemap(provider);
        const style = (await styleRes.json()) as StyleSpecification;
        if (cancelled) return;

        const map = new maplibre.Map({
          container: el,
          style,
          center,
          zoom,
          attributionControl: false,
          pitchWithRotate: false,
        });
        mapRef.current = map;
        setMap(map);

        map.on("load", () => {
          if (cancelled) return;
          for (const id of SLOT_LAYER_IDS) {
            const sourceId = `${SLOT_SOURCE_PREFIX}${id}`;
            if (!map.getSource(sourceId)) {
              map.addSource(sourceId, {
                type: "geojson",
                data: { type: "FeatureCollection", features: [] },
              });
            }
            if (!map.getLayer(id)) {
              if (id.includes("line")) {
                map.addLayer({
                  id,
                  type: "line",
                  source: sourceId,
                  layout: { visibility: "none" },
                  paint: {
                    "line-color": "#000",
                    "line-width": 1,
                    "line-opacity": 0,
                  },
                });
              } else {
                map.addLayer({
                  id,
                  type: "circle",
                  source: sourceId,
                  layout: { visibility: "none" },
                  paint: {
                    "circle-radius": 1,
                    "circle-opacity": 0,
                    "circle-color": "#000",
                  },
                });
              }
            }
          }
          setReady(true);
        });

        map.on("error", (e) => {
          console.error("maplibre error", e.error);
        });

        ro = new ResizeObserver(() => {
          map.resize();
        });
        ro.observe(el);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    })();

    return () => {
      cancelled = true;
      ro?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      setMap(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setMap]);

  return (
    <div
      className={styles.root}
      data-map-ready={ready ? "true" : "false"}
      data-basemap={basemap}
    >
      <div ref={containerRef} className={styles.canvas} />
      {error ? (
        <div className={styles.error} role="alert">
          <strong>Map unavailable</strong>
          <p>{error}</p>
        </div>
      ) : null}
      <div className={styles.topLeft}>
        <LiveBadge state={liveState} />
        {basemap === "dummy" ? (
          <div className={styles.demoNote} role="status">
            Demo basemap — awaiting Stadia key
          </div>
        ) : null}
      </div>
      <div className={styles.topRight}>
        <MapControls />
      </div>
      <RouteNetwork />
      <div className={styles.attribution}>
        {basemap === "dummy"
          ? DUMMY_BASEMAP_ATTRIBUTION
          : STADIA_BASEMAP_ATTRIBUTION}
      </div>
    </div>
  );
}

/**
 * Full-bleed MapLibre shell with ember.to chrome.
 * MapLibre is dynamically imported so it stays out of the initial document JS.
 */
export function MapShell(props: MapShellProps) {
  return (
    <MapProvider>
      <div className={[styles.shell, props.className].filter(Boolean).join(" ")}>
        <MapShellInner {...props} />
      </div>
    </MapProvider>
  );
}
