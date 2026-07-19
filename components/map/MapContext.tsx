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
import type { FeedVehicle } from "@/lib/map/vehicleTween";

type MapContextValue = {
  map: MapLibreMap | null;
  setMap: (map: MapLibreMap | null) => void;
  selectedVehicleId: string | null;
  setSelectedVehicleId: (id: string | null) => void;
  /** Bumps on each successful vehicle feed poll (Ticket 203/204 shared tick). */
  feedTick: number;
  bumpFeedTick: () => void;
  feedVehicles: FeedVehicle[];
  setFeedVehicles: (vehicles: FeedVehicle[]) => void;
};

const MapContext = createContext<MapContextValue | null>(null);

function syncVehicleQueryParam(id: string | null) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("vehicle", id);
  else url.searchParams.delete("vehicle");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

export function MapProvider({ children }: { children: ReactNode }) {
  const [map, setMapState] = useState<MapLibreMap | null>(null);
  const [selectedVehicleId, setSelectedState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URL(window.location.href).searchParams.get("vehicle");
  });
  const [feedTick, setFeedTick] = useState(0);
  const [feedVehicles, setFeedVehicles] = useState<FeedVehicle[]>([]);

  const setMap = useCallback((m: MapLibreMap | null) => setMapState(m), []);
  const setSelectedVehicleId = useCallback((id: string | null) => {
    setSelectedState(id);
    syncVehicleQueryParam(id);
  }, []);
  const bumpFeedTick = useCallback(() => setFeedTick((n) => n + 1), []);

  const value = useMemo(
    () => ({
      map,
      setMap,
      selectedVehicleId,
      setSelectedVehicleId,
      feedTick,
      bumpFeedTick,
      feedVehicles,
      setFeedVehicles,
    }),
    [
      map,
      setMap,
      selectedVehicleId,
      setSelectedVehicleId,
      feedTick,
      bumpFeedTick,
      feedVehicles,
    ],
  );
  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
}

function useMapContext(): MapContextValue {
  const ctx = useContext(MapContext);
  if (!ctx) throw new Error("Map hooks must be used within MapProvider");
  return ctx;
}

export function useMapInstance(): MapLibreMap | null {
  return useMapContext().map;
}

export function useMapSetter(): (map: MapLibreMap | null) => void {
  return useMapContext().setMap;
}

export function useSelectedVehicle(): {
  selectedVehicleId: string | null;
  setSelectedVehicleId: (id: string | null) => void;
} {
  const ctx = useMapContext();
  return {
    selectedVehicleId: ctx.selectedVehicleId,
    setSelectedVehicleId: ctx.setSelectedVehicleId,
  };
}

export function useVehicleFeedTick(): {
  feedTick: number;
  bumpFeedTick: () => void;
  feedVehicles: FeedVehicle[];
  setFeedVehicles: (v: FeedVehicle[]) => void;
} {
  const ctx = useMapContext();
  return {
    feedTick: ctx.feedTick,
    bumpFeedTick: ctx.bumpFeedTick,
    feedVehicles: ctx.feedVehicles,
    setFeedVehicles: ctx.setFeedVehicles,
  };
}
