"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { useMapInstance } from "./MapContext";
import { useVehicleFeed } from "./useVehicleFeed";
import { SLOT_SOURCE_PREFIX } from "./layerOrder";
import {
  applyFeedSnapshot,
  prefersReducedMotion,
  sampleTweens,
  type VehicleTween,
} from "@/lib/map/vehicleTween";

const SOURCE_ID = `${SLOT_SOURCE_PREFIX}vehicles-marker`;
const LAYER_ID = "vehicles-marker";
const BADGE_IMAGE = "bt-vehicle-badge";

function ensureBadgeImage(map: MapLibreMap): void {
  if (map.hasImage(BADGE_IMAGE)) return;
  const w = 56;
  const h = 32;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const r = 8;
  ctx.fillStyle = "#1f2933";
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.arcTo(w, 0, w, h, r);
  ctx.arcTo(w, h, 0, h, r);
  ctx.arcTo(0, h, 0, 0, r);
  ctx.arcTo(0, 0, w, 0, r);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#3b82f6";
  ctx.beginPath();
  ctx.moveTo(w / 2, 2);
  ctx.lineTo(w / 2 + 5, 9);
  ctx.lineTo(w / 2 - 5, 9);
  ctx.closePath();
  ctx.fill();

  const imageData = ctx.getImageData(0, 0, w, h);
  map.addImage(BADGE_IMAGE, imageData, { pixelRatio: 2 });
}

function ensureVehicleLayer(map: MapLibreMap): void {
  ensureBadgeImage(map);
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }
  if (map.getLayer(LAYER_ID)) {
    const layer = map.getLayer(LAYER_ID);
    if (layer && layer.type !== "symbol") {
      map.removeLayer(LAYER_ID);
    }
  }
  if (!map.getLayer(LAYER_ID)) {
    map.addLayer(
      {
        id: LAYER_ID,
        type: "symbol",
        source: SOURCE_ID,
        layout: {
          "icon-image": BADGE_IMAGE,
          "icon-size": 0.9,
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "icon-rotate": ["get", "bearing"],
          "icon-rotation-alignment": "map",
          "text-field": ["get", "label"],
          "text-size": 11,
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-allow-overlap": true,
          "text-ignore-placement": true,
          "text-rotation-alignment": "viewport",
        },
        paint: {
          "text-color": "#ffffff",
          "icon-opacity": ["get", "opacity"],
          "text-opacity": ["get", "opacity"],
        },
      },
      map.getLayer("overlay-ui") ? "overlay-ui" : undefined,
    );
  }
  map.setLayoutProperty(LAYER_ID, "visibility", "visible");
}

/**
 * Live vehicle markers with viewport polling + RAF interpolation (Ticket 203).
 */
export function VehicleMarkers() {
  const map = useMapInstance();
  const tweensRef = useRef<Map<string, VehicleTween>>(new Map());
  const rafRef = useRef<number | null>(null);
  const lastPayloadRef = useRef<string>("");
  const [bboxRevision, setBboxRevision] = useState(0);

  const getBbox = useCallback(() => {
    if (!map) return null;
    const b = map.getBounds();
    if (!b) return null;
    const sw = b.getSouthWest();
    const ne = b.getNorthEast();
    const padLon = (ne.lng - sw.lng) * 0.05;
    const padLat = (ne.lat - sw.lat) * 0.05;
    return `${sw.lng - padLon},${sw.lat - padLat},${ne.lng + padLon},${ne.lat + padLat}`;
  }, [map]);

  const feed = useVehicleFeed({
    getBbox,
    enabled: Boolean(map),
    bboxRevision,
  });

  useEffect(() => {
    if (!map) return;
    const payloadKey = JSON.stringify(
      feed.vehicles.map((v) => [
        v.vehicle_id,
        v.lat,
        v.lon,
        v.bearing,
        v.speed_mps,
        v.route_short_name,
        v.quality,
      ]),
    );
    if (payloadKey === lastPayloadRef.current) return;
    lastPayloadRef.current = payloadKey;

    tweensRef.current = applyFeedSnapshot(
      tweensRef.current,
      feed.vehicles,
      performance.now(),
      { reducedMotion: prefersReducedMotion() },
    );
  }, [feed.vehicles, map]);

  useEffect(() => {
    if (!map) return;

    const setup = () => ensureVehicleLayer(map);
    if (map.isStyleLoaded()) setup();
    else map.once("load", setup);

    const tick = () => {
      const now = performance.now();
      const { rendered, alive } = sampleTweens(tweensRef.current, now);
      tweensRef.current = alive;

      const fc: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: rendered.map((r) => ({
          type: "Feature",
          properties: {
            vehicle_id: r.vehicleId,
            label: r.label,
            bearing: r.showBearing ? Math.round(r.bearing) : 0,
            opacity: r.opacity,
          },
          geometry: {
            type: "Point",
            coordinates: [r.lon, r.lat],
          },
        })),
      };

      const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      src?.setData(fc);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    let moveTimer: ReturnType<typeof setTimeout> | null = null;
    const onMoveEnd = () => {
      if (moveTimer) clearTimeout(moveTimer);
      moveTimer = setTimeout(() => {
        setBboxRevision((n) => n + 1);
      }, 300);
    };
    map.on("moveend", onMoveEnd);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      map.off("moveend", onMoveEnd);
      if (moveTimer) clearTimeout(moveTimer);
    };
  }, [map]);

  return null;
}
