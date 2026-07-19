"use client";

import { useEffect, useRef } from "react";
import type { GeoJSONSource } from "maplibre-gl";
import { useMapInstance } from "./MapContext";
import { SLOT_SOURCE_PREFIX } from "./layerOrder";
import { BRAND_ROUTE_GREEN } from "@/lib/map/routeColour";

const ROUTES_LINE_SOURCE = `${SLOT_SOURCE_PREFIX}routes-line`;
const ROUTES_CASING_SOURCE = `${SLOT_SOURCE_PREFIX}routes-line-casing`;
const STOPS_SOURCE = `${SLOT_SOURCE_PREFIX}stops-circle`;

function zoomBucket(z: number): number {
  if (z <= 8) return 8;
  if (z <= 10) return 10;
  if (z <= 12) return 12;
  if (z <= 14) return 14;
  return 16;
}

function paintNetworkLayers(map: NonNullable<ReturnType<typeof useMapInstance>>) {
  if (map.getLayer("routes-line-casing")) {
    map.setLayoutProperty("routes-line-casing", "visibility", "visible");
    map.setLayoutProperty("routes-line-casing", "line-join", "round");
    map.setLayoutProperty("routes-line-casing", "line-cap", "round");
    map.setPaintProperty("routes-line-casing", "line-color", "#F5F7F4");
    map.setPaintProperty("routes-line-casing", "line-width", 6);
    map.setPaintProperty("routes-line-casing", "line-opacity", 1);
  }
  if (map.getLayer("routes-line")) {
    map.setLayoutProperty("routes-line", "visibility", "visible");
    map.setLayoutProperty("routes-line", "line-join", "round");
    map.setLayoutProperty("routes-line", "line-cap", "round");
    map.setPaintProperty("routes-line", "line-color", [
      "coalesce",
      ["get", "route_colour"],
      BRAND_ROUTE_GREEN,
    ]);
    map.setPaintProperty("routes-line", "line-width", 3);
    map.setPaintProperty("routes-line", "line-opacity", 1);
  }
  if (map.getLayer("stops-circle")) {
    map.setLayoutProperty("stops-circle", "visibility", "visible");
    map.setLayerZoomRange("stops-circle", 11, 24);
    map.setPaintProperty("stops-circle", "circle-color", "#FFFFFF");
    map.setPaintProperty("stops-circle", "circle-stroke-color", BRAND_ROUTE_GREEN);
    map.setPaintProperty("stops-circle", "circle-stroke-width", 2);
    map.setPaintProperty("stops-circle", "circle-opacity", 1);
    // Smaller radius at z13–15 keeps paired stops (~15 m) separately clickable.
    map.setPaintProperty("stops-circle", "circle-radius", [
      "interpolate",
      ["linear"],
      ["zoom"],
      11,
      2,
      13,
      2.5,
      14,
      3,
      16,
      7,
    ]);
  }
}

/**
 * Loads route/stop geometry into the MapShell slot layers (Ticket 202).
 */
export function RouteNetwork() {
  const map = useMapInstance();
  const loadedBucket = useRef<number | null>(null);
  const inflight = useRef<AbortController | null>(null);
  const didFit = useRef(false);

  useEffect(() => {
    if (!map) return;

    const loadForZoom = async (z: number) => {
      const bucket = zoomBucket(z);
      if (loadedBucket.current === bucket) return;
      inflight.current?.abort();
      const ac = new AbortController();
      inflight.current = ac;
      try {
        const res = await fetch(`/api/routes/geometry?z=${bucket}`, {
          signal: ac.signal,
        });
        if (!res.ok) throw new Error(`geometry HTTP ${res.status}`);
        const fc = (await res.json()) as GeoJSON.FeatureCollection;
        if (ac.signal.aborted) return;

        const lines: GeoJSON.FeatureCollection = {
          type: "FeatureCollection",
          features: fc.features.filter(
            (f) =>
              f.geometry?.type === "LineString" &&
              (f.properties as { kind?: string } | null)?.kind === "route",
          ),
        };
        const stops: GeoJSON.FeatureCollection = {
          type: "FeatureCollection",
          features: fc.features.filter(
            (f) =>
              f.geometry?.type === "Point" &&
              (f.properties as { kind?: string } | null)?.kind === "stop",
          ),
        };

        const lineSrc = map.getSource(ROUTES_LINE_SOURCE) as GeoJSONSource | undefined;
        const casingSrc = map.getSource(ROUTES_CASING_SOURCE) as
          | GeoJSONSource
          | undefined;
        const stopSrc = map.getSource(STOPS_SOURCE) as GeoJSONSource | undefined;
        lineSrc?.setData(lines);
        casingSrc?.setData(lines);
        stopSrc?.setData(stops);
        paintNetworkLayers(map);
        loadedBucket.current = bucket;

        // First successful load: frame the network so the default Kinross
        // camera isn't empty when the active feed is elsewhere (or vice versa).
        if (!didFit.current && lines.features.length > 0) {
          didFit.current = true;
          let minLon = 180;
          let minLat = 90;
          let maxLon = -180;
          let maxLat = -90;
          for (const f of lines.features) {
            if (f.geometry?.type !== "LineString") continue;
            for (const c of f.geometry.coordinates) {
              const [lon, lat] = c as [number, number];
              minLon = Math.min(minLon, lon);
              minLat = Math.min(minLat, lat);
              maxLon = Math.max(maxLon, lon);
              maxLat = Math.max(maxLat, lat);
            }
          }
          if (minLon <= maxLon && minLat <= maxLat) {
            map.fitBounds(
              [
                [minLon, minLat],
                [maxLon, maxLat],
              ],
              { padding: 48, maxZoom: 12, duration: 600 },
            );
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        console.error("RouteNetwork load failed", err);
      }
    };

    const onReady = () => {
      paintNetworkLayers(map);
      void loadForZoom(map.getZoom());
    };

    if (map.isStyleLoaded()) onReady();
    else map.once("load", onReady);

    const onZoomEnd = () => void loadForZoom(map.getZoom());
    map.on("zoomend", onZoomEnd);

    return () => {
      inflight.current?.abort();
      map.off("zoomend", onZoomEnd);
    };
  }, [map]);

  return null;
}
