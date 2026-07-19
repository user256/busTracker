"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent } from "maplibre-gl";
import {
  useMapInstance,
  useSelectedVehicle,
  useVehicleFeedTick,
  useFreshnessContext,
} from "./MapContext";
import { useVehicleFeed } from "./useVehicleFeed";
import { useFreshnessFromFeed } from "./useFreshnessFromFeed";
import { SLOT_SOURCE_PREFIX } from "./layerOrder";
import {
  applyFeedSnapshot,
  prefersReducedMotion,
  sampleTweens,
  type VehicleTween,
} from "@/lib/map/vehicleTween";
import {
  isVehicleDegraded,
  markerOpacityForFreshness,
  shouldInterpolateMarkers,
} from "@/lib/freshness";

const SOURCE_ID = `${SLOT_SOURCE_PREFIX}vehicles-marker`;
const LAYER_ID = "vehicles-marker";
const BADGE_IMAGE = "bt-vehicle-badge";
const BADGE_SELECTED = "bt-vehicle-badge-selected";

function drawBadge(
  selected: boolean,
): ImageData | null {
  const w = 56;
  const h = 32;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const r = 8;
  if (selected) {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(r, 2);
    ctx.arcTo(w - 2, 2, w - 2, h - 2, r);
    ctx.arcTo(w - 2, h - 2, 2, h - 2, r);
    ctx.arcTo(2, h - 2, 2, 2, r);
    ctx.arcTo(2, 2, w - 2, 2, r);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.fillStyle = "#1f2933";
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.arcTo(w, 0, w, h, r);
  ctx.arcTo(w, h, 0, h, r);
  ctx.arcTo(0, h, 0, 0, r);
  ctx.arcTo(0, 0, w, 0, r);
  ctx.closePath();
  ctx.fill();
  // Direction notch — pattern (triangle), not colour alone for selection
  ctx.fillStyle = selected ? "#f8fafc" : "#3b82f6";
  ctx.beginPath();
  ctx.moveTo(w / 2, 2);
  ctx.lineTo(w / 2 + 5, 9);
  ctx.lineTo(w / 2 - 5, 9);
  ctx.closePath();
  ctx.fill();
  if (selected) {
    // Plus mark in corner — non-colour selection cue
    ctx.strokeStyle = "#f8fafc";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w - 12, 8);
    ctx.lineTo(w - 12, 14);
    ctx.moveTo(w - 15, 11);
    ctx.lineTo(w - 9, 11);
    ctx.stroke();
  }
  return ctx.getImageData(0, 0, w, h);
}

function ensureBadgeImages(map: MapLibreMap): void {
  if (!map.hasImage(BADGE_IMAGE)) {
    const img = drawBadge(false);
    if (img) map.addImage(BADGE_IMAGE, img, { pixelRatio: 2 });
  }
  if (!map.hasImage(BADGE_SELECTED)) {
    const img = drawBadge(true);
    if (img) map.addImage(BADGE_SELECTED, img, { pixelRatio: 2 });
  }
}

function ensureVehicleLayer(map: MapLibreMap): void {
  ensureBadgeImages(map);
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
          "icon-image": [
            "case",
            ["==", ["get", "selected"], 1],
            BADGE_SELECTED,
            BADGE_IMAGE,
          ],
          "icon-size": [
            "case",
            ["==", ["get", "selected"], 1],
            1.15,
            0.9,
          ],
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "icon-rotate": ["get", "bearing"],
          "icon-rotation-alignment": "map",
          "text-field": ["get", "label"],
          "text-size": [
            "case",
            ["==", ["get", "selected"], 1],
            12,
            11,
          ],
          "text-font": ["Noto Sans Regular"],
          "text-allow-overlap": true,
          "text-ignore-placement": true,
          "text-rotation-alignment": "viewport",
        },
        paint: {
          "text-color": "#ffffff",
          "icon-opacity": ["get", "opacity"],
          "text-opacity": ["get", "opacity"],
          // Halo on selected text — second non-colour cue
          "text-halo-color": [
            "case",
            ["==", ["get", "selected"], 1],
            "#0f172a",
            "rgba(0,0,0,0)",
          ],
          "text-halo-width": [
            "case",
            ["==", ["get", "selected"], 1],
            1.25,
            0,
          ],
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
  const { selectedVehicleId, setSelectedVehicleId } = useSelectedVehicle();
  const { bumpFeedTick, setFeedVehicles } = useVehicleFeedTick();
  const { setFreshness, setBannerDismissed } = useFreshnessContext();
  const selectedRef = useRef(selectedVehicleId);
  selectedRef.current = selectedVehicleId;

  const tweensRef = useRef<Map<string, VehicleTween>>(new Map());
  const rafRef = useRef<number | null>(null);
  const lastPayloadRef = useRef<string>("");
  const feedVehiclesRef = useRef<Map<string, { quality: string[] }>>(new Map());
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

  const freshness = useFreshnessFromFeed(feed, setFreshness, setBannerDismissed);
  const mapFreshnessState = freshness?.state ?? "offline";
  const allowInterpolation = shouldInterpolateMarkers(mapFreshnessState);

  useEffect(() => {
    feedVehiclesRef.current = new Map(
      feed.vehicles.map((v) => [v.vehicle_id, { quality: v.quality }]),
    );
  }, [feed.vehicles]);

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
      {
        reducedMotion: prefersReducedMotion(),
        allowInterpolation,
      },
    );
    setFeedVehicles(feed.vehicles);
    bumpFeedTick();
  }, [
    feed.vehicles,
    map,
    setFeedVehicles,
    bumpFeedTick,
    allowInterpolation,
  ]);

  useEffect(() => {
    if (!map) return;

    const setup = () => ensureVehicleLayer(map);
    if (map.isStyleLoaded()) setup();
    else map.once("load", setup);

    const tick = () => {
      const now = performance.now();
      const { rendered, alive } = sampleTweens(tweensRef.current, now);
      tweensRef.current = alive;
      const selected = selectedRef.current;
      const hideMarkers = mapFreshnessState === "offline";

      const fc: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: hideMarkers
          ? []
          : rendered.map((r) => {
              const quality =
                feedVehiclesRef.current.get(r.vehicleId)?.quality ?? [];
              const opacity =
                markerOpacityForFreshness(
                  mapFreshnessState,
                  isVehicleDegraded(quality),
                ) * r.opacity;
              return {
                type: "Feature",
                properties: {
                  vehicle_id: r.vehicleId,
                  label: r.label,
                  bearing: r.showBearing ? Math.round(r.bearing) : 0,
                  opacity,
                  selected: selected === r.vehicleId ? 1 : 0,
                },
                geometry: {
                  type: "Point",
                  coordinates: [r.lon, r.lat],
                },
              };
            }),
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

    const onClick = (e: MapLayerMouseEvent) => {
      const f = e.features?.[0];
      const id = f?.properties?.vehicle_id;
      if (typeof id === "string") {
        setSelectedVehicleId(id);
      }
    };
    const onEnter = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const onLeave = () => {
      map.getCanvas().style.cursor = "";
    };

    // Keyboard: Enter on focused map with nearest — map canvas isn't focusable by default;
    // add tabindex and handle Enter using selected/hovered. Minimal: click + panel Escape.
    map.on("click", LAYER_ID, onClick);
    map.on("mouseenter", LAYER_ID, onEnter);
    map.on("mouseleave", LAYER_ID, onLeave);

    const canvas = map.getCanvas();
    canvas.tabIndex = 0;
    canvas.setAttribute("role", "application");
    canvas.setAttribute("aria-label", "Live bus map");
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key !== "Enter" && ev.key !== " ") return;
      // Select first rendered vehicle if none selected (keyboard activation path)
      if (selectedRef.current) return;
      const first = tweensRef.current.keys().next().value as string | undefined;
      if (first) {
        ev.preventDefault();
        setSelectedVehicleId(first);
      }
    };
    canvas.addEventListener("keydown", onKeyDown);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      map.off("moveend", onMoveEnd);
      map.off("click", LAYER_ID, onClick);
      map.off("mouseenter", LAYER_ID, onEnter);
      map.off("mouseleave", LAYER_ID, onLeave);
      canvas.removeEventListener("keydown", onKeyDown);
      if (moveTimer) clearTimeout(moveTimer);
    };
  }, [map, setSelectedVehicleId, mapFreshnessState]);

  return null;
}
