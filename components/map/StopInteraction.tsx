"use client";

import { useEffect, useRef } from "react";
import type {
  MapGeoJSONFeature,
  Map as MapLibreMap,
  MapLayerMouseEvent,
  Popup,
} from "maplibre-gl";
import { useMapInstance, useSelectedStop } from "./MapContext";

const STOPS_LAYER = "stops-circle";
const MIN_INTERACTIVE_ZOOM = 13;

type StopProps = {
  kind?: string;
  stop_id?: string;
  stop_name?: string;
};

function isStopFeature(f: MapGeoJSONFeature | undefined): f is MapGeoJSONFeature {
  if (!f?.properties) return false;
  const p = f.properties as StopProps;
  return p.kind === "stop" && typeof p.stop_id === "string";
}

/** Pick the stop feature closest to the click/hover point (paired-stop safe). */
function pickNearestStop(
  map: MapLibreMap,
  point: { x: number; y: number },
): MapGeoJSONFeature | undefined {
  const features = map.queryRenderedFeatures([point.x, point.y], {
    layers: [STOPS_LAYER],
  });
  const stops = features.filter(isStopFeature);
  if (stops.length === 0) return undefined;
  if (stops.length === 1) return stops[0];

  let best = stops[0];
  let bestDist = Infinity;
  for (const f of stops) {
    if (f.geometry?.type !== "Point") continue;
    const [lon, lat] = f.geometry.coordinates;
    const p = map.project([lon, lat]);
    const dx = p.x - point.x;
    const dy = p.y - point.y;
    const d = dx * dx + dy * dy;
    if (d < bestDist) {
      bestDist = d;
      best = f;
    }
  }
  return best;
}

/**
 * Stop hover + click against stops-circle (Ticket 205). Inactive below zoom 13.
 */
export function StopInteraction() {
  const map = useMapInstance();
  const { setSelectedStop } = useSelectedStop();
  const popupRef = useRef<Popup | null>(null);
  const hoveredIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!map) return;

    let popup: Popup | null = null;

    const zoomOk = () => map.getZoom() > MIN_INTERACTIVE_ZOOM;

    const showHover = (e: MapLayerMouseEvent) => {
      if (!zoomOk()) return;
      const f = pickNearestStop(map, e.point);
      if (!isStopFeature(f)) return;
      const p = f.properties as StopProps;
      const name = p.stop_name ?? p.stop_id ?? "Stop";
      hoveredIdRef.current = p.stop_id ?? null;
      map.getCanvas().style.cursor = "pointer";
      void import("maplibre-gl").then(({ Popup: PopupCtor }) => {
        if (!popup) {
          popup = new PopupCtor({
            closeButton: false,
            closeOnClick: false,
            className: "bt-stop-hover",
            offset: 12,
          });
          popupRef.current = popup;
        }
        popup.setLngLat(e.lngLat).setHTML(`<span>${name}</span>`).addTo(map);
      });
    };

    const clearHover = () => {
      hoveredIdRef.current = null;
      map.getCanvas().style.cursor = "";
      popup?.remove();
    };

    const onClick = (e: MapLayerMouseEvent) => {
      if (!zoomOk()) return;
      const f = pickNearestStop(map, e.point);
      if (!isStopFeature(f) || f.geometry?.type !== "Point") return;
      const p = f.properties as StopProps;
      const [lon, lat] = f.geometry.coordinates;
      setSelectedStop({
        id: p.stop_id!,
        name: p.stop_name ?? p.stop_id ?? "Stop",
        lon,
        lat,
      });
    };

    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key !== "Enter" && ev.key !== " ") return;
      if (!zoomOk() || !hoveredIdRef.current) return;
      const features = map.queryRenderedFeatures({ layers: [STOPS_LAYER] });
      const match = features.find(
        (f) =>
          isStopFeature(f) &&
          (f.properties as StopProps).stop_id === hoveredIdRef.current,
      );
      if (!match?.geometry || match.geometry.type !== "Point") return;
      const p = match.properties as StopProps;
      const [lon, lat] = match.geometry.coordinates;
      ev.preventDefault();
      setSelectedStop({
        id: p.stop_id!,
        name: p.stop_name ?? p.stop_id ?? "Stop",
        lon,
        lat,
      });
    };

    const onZoom = () => {
      if (!zoomOk()) clearHover();
    };

    map.on("mousemove", STOPS_LAYER, showHover);
    map.on("mouseleave", STOPS_LAYER, clearHover);
    map.on("click", STOPS_LAYER, onClick);
    map.on("zoom", onZoom);
    map.getCanvas().addEventListener("keydown", onKeyDown);

    return () => {
      map.off("mousemove", STOPS_LAYER, showHover);
      map.off("mouseleave", STOPS_LAYER, clearHover);
      map.off("click", STOPS_LAYER, onClick);
      map.off("zoom", onZoom);
      map.getCanvas().removeEventListener("keydown", onKeyDown);
      popup?.remove();
      popupRef.current = null;
    };
  }, [map, setSelectedStop]);

  return null;
}
