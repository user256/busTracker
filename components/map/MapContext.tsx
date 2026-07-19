"use client";

import {
  createContext,
  useContext,
  type ReactNode,
  useMemo,
  useState,
  useCallback,
} from "react";
import type { Map as MapLibreMap } from "maplibre-gl";

type MapContextValue = {
  map: MapLibreMap | null;
  setMap: (map: MapLibreMap | null) => void;
};

const MapContext = createContext<MapContextValue | null>(null);

export function MapProvider({ children }: { children: ReactNode }) {
  const [map, setMapState] = useState<MapLibreMap | null>(null);
  const setMap = useCallback((m: MapLibreMap | null) => setMapState(m), []);
  const value = useMemo(() => ({ map, setMap }), [map, setMap]);
  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
}

export function useMapInstance(): MapLibreMap | null {
  const ctx = useContext(MapContext);
  if (!ctx) {
    throw new Error("useMapInstance must be used within MapProvider");
  }
  return ctx.map;
}

export function useMapSetter(): (map: MapLibreMap | null) => void {
  const ctx = useContext(MapContext);
  if (!ctx) {
    throw new Error("useMapSetter must be used within MapProvider");
  }
  return ctx.setMap;
}
