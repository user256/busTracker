"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import {
  useMapInstance,
  useSelectedVehicle,
  useVehicleFeedTick,
  useFreshnessContext,
} from "./MapContext";
import styles from "./VehicleDetailPanel.module.css";

type TripStop = {
  stop_id: string;
  stop_name: string;
  stop_sequence: number;
  scheduled_time: string | null;
  estimated_time: string | null;
  source: "realtime" | "scheduled";
  provenance: { kind: string; label: string; icon: string };
  confidence_note: string;
};

type TripPayload = {
  vehicle_id: string;
  trip_id: string | null;
  route_id: string | null;
  route_short_name: string | null;
  route_long_name: string | null;
  headsign: string | null;
  lat: number | null;
  lon: number | null;
  observed_at: string | null;
  tracking_live: boolean;
  stops: TripStop[];
  note: string;
};

function formatClock(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function relativeTime(iso: string | null): string {
  if (!iso) return "unknown time";
  const sec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}

function ProvenanceBadge({
  provenance,
}: {
  provenance: { kind: string; label: string; icon: string };
}) {
  const glyph =
    provenance.icon === "live"
      ? "●"
      : provenance.icon === "delayed"
        ? "▲"
        : "○";
  return (
    <span
      className={styles.prov}
      data-kind={provenance.kind}
      title={provenance.label}
    >
      <span className={styles.provIcon} aria-hidden>
        {glyph}
      </span>
      <span className={styles.provLabel}>{provenance.label}</span>
    </span>
  );
}

/**
 * Vehicle selection panel (Ticket 204). Refreshes on feedTick — no own timer.
 */
export function VehicleDetailPanel() {
  const map = useMapInstance();
  const { selectedVehicleId, setSelectedVehicleId } = useSelectedVehicle();
  const { feedTick, feedVehicles } = useVehicleFeedTick();
  const { freshness } = useFreshnessContext();
  const [trip, setTrip] = useState<TripPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const scrollTopRef = useRef(0);
  const dragStartY = useRef<number | null>(null);

  const inFeed = feedVehicles.some((v) => v.vehicle_id === selectedVehicleId);

  const close = useCallback(() => {
    setSelectedVehicleId(null);
    setTrip(null);
    setError(null);
  }, [setSelectedVehicleId]);

  // Fetch on selection + feed tick
  useEffect(() => {
    if (!selectedVehicleId) {
      setTrip(null);
      setError(null);
      return;
    }
    let cancelled = false;
    if (listRef.current) scrollTopRef.current = listRef.current.scrollTop;

    setLoading(true);
    void (async () => {
      try {
        const res = await fetch(
          `/api/v1/vehicles/${encodeURIComponent(selectedVehicleId)}/trip`,
        );
        if (!res.ok) {
          throw new Error(
            res.status === 404
              ? "No trip data for this vehicle"
              : `trip HTTP ${res.status}`,
          );
        }
        const body = (await res.json()) as TripPayload;
        if (cancelled) return;
        setTrip(body);
        setError(null);
        requestAnimationFrame(() => {
          if (listRef.current) listRef.current.scrollTop = scrollTopRef.current;
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedVehicleId, feedTick]);

  // Map padding + ease selected vehicle into view
  useEffect(() => {
    if (!map) return;
    const wide =
      typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;
    if (!selectedVehicleId) {
      map.easeTo({ padding: { top: 0, bottom: 0, left: 0, right: 0 }, duration: 300 });
      return;
    }
    const padding = wide
      ? { top: 40, bottom: 40, left: 40, right: 360 }
      : { top: 40, bottom: Math.round(window.innerHeight * 0.45), left: 20, right: 20 };

    const fromFeed = feedVehicles.find((v) => v.vehicle_id === selectedVehicleId);
    const lon = fromFeed?.lon ?? trip?.lon;
    const lat = fromFeed?.lat ?? trip?.lat;
    if (lon != null && lat != null) {
      map.easeTo({
        center: [lon, lat],
        padding,
        duration: 400,
      });
    } else {
      map.easeTo({ padding, duration: 300 });
    }
  }, [map, selectedVehicleId, trip?.lat, trip?.lon, feedVehicles]);

  // Escape to close
  useEffect(() => {
    if (!selectedVehicleId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedVehicleId, close]);

  if (!selectedVehicleId) return null;

  const trackingLost = Boolean(
    trip &&
      (freshness?.state === "offline" ||
        freshness?.state === "timetable" ||
        !trip.tracking_live ||
        !inFeed),
  );
  const nextStop = trip?.stops[0] ?? null;
  const isMobileDialog =
    typeof window !== "undefined" &&
    !window.matchMedia("(min-width: 1024px)").matches;

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    if (!isMobileDialog) return;
    dragStartY.current = e.clientY;
  };
  const onPointerUp = (e: PointerEvent<HTMLElement>) => {
    if (dragStartY.current == null) return;
    const dy = e.clientY - dragStartY.current;
    dragStartY.current = null;
    if (dy > 80) close();
  };

  const routeTitle =
    trip?.route_short_name ||
    trip?.route_id ||
    selectedVehicleId;

  return (
    <aside
      className={styles.panel}
      role={isMobileDialog ? "dialog" : "complementary"}
      aria-modal={isMobileDialog ? true : undefined}
      aria-label="Vehicle details"
      data-vehicle={selectedVehicleId}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <div className={styles.handle} aria-hidden />
      <header className={styles.header}>
        <div>
          <p className={styles.route}>{routeTitle}</p>
          <p className={styles.headsign}>
            {trip?.headsign || trip?.route_long_name || "Destination unknown"}
          </p>
        </div>
        <button
          type="button"
          className={styles.close}
          aria-label="Close vehicle details"
          onClick={close}
        >
          ×
        </button>
      </header>

      {trackingLost ? (
        <p className={styles.lost} role="status">
          Live tracking lost for this bus — last seen{" "}
          {relativeTime(trip?.observed_at ?? null)}
        </p>
      ) : null}

      {nextStop ? (
        <p className={styles.next} aria-live="polite">
          Next: {nextStop.stop_name}{" "}
          <ProvenanceBadge provenance={nextStop.provenance} />{" "}
          {formatClock(nextStop.estimated_time ?? nextStop.scheduled_time)}
        </p>
      ) : null}

      {error ? <p className={styles.error}>{error}</p> : null}
      {loading && !trip ? <p className={styles.loading}>Loading trip…</p> : null}

      <ul className={styles.list} ref={listRef}>
        {(trip?.stops ?? []).map((s) => (
          <li key={`${s.stop_id}-${s.stop_sequence}`} className={styles.row}>
            <div className={styles.stopMeta}>
              <span className={styles.stopName}>{s.stop_name}</span>
              <ProvenanceBadge provenance={s.provenance} />
            </div>
            <time
              className={styles.time}
              dateTime={s.estimated_time ?? s.scheduled_time ?? undefined}
              title={s.confidence_note}
            >
              {formatClock(s.estimated_time ?? s.scheduled_time)}
            </time>
          </li>
        ))}
      </ul>

      {trip?.note ? <p className={styles.note}>{trip.note}</p> : null}
    </aside>
  );
}
