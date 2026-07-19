"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import {
  useMapInstance,
  useSelectedStop,
  useSelectedVehicle,
  useVehicleFeedTick,
} from "./MapContext";
import { formatDepartureTime, secondsSince } from "@/lib/arrivals/formatDepartureTime";
import styles from "./StopDeparturesPanel.module.css";

type DepartureRow = {
  trip_id: string;
  route_short_name: string | null;
  headsign: string | null;
  scheduled_time: string | null;
  estimated_time: string | null;
  provenance: "live" | "delayed" | "scheduled";
  provenance_label: string;
  vehicle_id: string | null;
  confidence_note: string;
};

type DeparturesPayload = {
  stop_id: string;
  stop_name: string | null;
  departures: DepartureRow[];
  empty_reason: "no_departures_today" | "no_live_data" | null;
  feed_status: string;
  generated_at: string;
};

function ProvenanceBadge({
  provenance,
  label,
}: {
  provenance: DepartureRow["provenance"];
  label: string;
}) {
  const glyph = provenance === "live" ? "●" : provenance === "delayed" ? "▲" : "○";
  return (
    <span className={styles.prov} data-kind={provenance} title={label}>
      <span className={styles.provIcon} aria-hidden>
        {glyph}
      </span>
      <span className={styles.provLabel}>{label}</span>
    </span>
  );
}

function emptyMessage(reason: DeparturesPayload["empty_reason"]): string {
  if (reason === "no_live_data") return "No live data for this stop";
  return "No more departures today";
}

/**
 * Stop departure board (Ticket 205). Refreshes on feedTick — no per-row timer.
 */
export function StopDeparturesPanel() {
  const map = useMapInstance();
  const { selectedStop, clearSelectedStop } = useSelectedStop();
  const { setSelectedVehicleId } = useSelectedVehicle();
  const { feedTick } = useVehicleFeedTick();
  const [payload, setPayload] = useState<DeparturesPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const dragStartY = useRef<number | null>(null);

  const close = useCallback(() => {
    clearSelectedStop();
    setPayload(null);
    setError(null);
  }, [clearSelectedStop]);

  useEffect(() => {
    if (!selectedStop) {
      setPayload(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch(
          `/api/v1/stops/${encodeURIComponent(selectedStop.id)}/departures?limit=10`,
        );
        if (!res.ok) {
          throw new Error(`departures HTTP ${res.status}`);
        }
        const body = (await res.json()) as DeparturesPayload;
        if (cancelled) return;
        setPayload(body);
        setError(null);
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
  }, [selectedStop, feedTick]);

  useEffect(() => {
    if (!map || !selectedStop) return;
    const wide =
      typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;
    const padding = wide
      ? { top: 40, bottom: 40, left: 40, right: 360 }
      : { top: 40, bottom: Math.round(window.innerHeight * 0.45), left: 20, right: 20 };
    map.easeTo({
      center: [selectedStop.lon, selectedStop.lat],
      padding,
      duration: 400,
    });
  }, [map, selectedStop]);

  useEffect(() => {
    if (!selectedStop) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedStop, close]);

  if (!selectedStop) return null;

  const stopTitle = payload?.stop_name ?? selectedStop.name;
  const nowMs = Date.now();
  const updatedSec = payload ? secondsSince(payload.generated_at, nowMs) : null;
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

  const onVehicleActivate = (vehicleId: string) => {
    clearSelectedStop();
    setSelectedVehicleId(vehicleId);
  };

  return (
    <aside
      className={styles.panel}
      role={isMobileDialog ? "dialog" : "complementary"}
      aria-modal={isMobileDialog ? true : undefined}
      aria-label="Stop departures"
      data-stop={selectedStop.id}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <div className={styles.handle} aria-hidden />
      <header className={styles.header}>
        <div>
          <p className={styles.stopName}>{stopTitle}</p>
          {updatedSec != null ? (
            <p className={styles.updated} aria-live="polite">
              Updated {updatedSec}s ago
            </p>
          ) : null}
        </div>
        <button
          type="button"
          className={styles.close}
          aria-label="Close stop departures"
          onClick={close}
        >
          ×
        </button>
      </header>

      {error ? <p className={styles.error}>{error}</p> : null}
      {loading && !payload ? <p className={styles.loading}>Loading departures…</p> : null}

      {payload?.empty_reason ? (
        <p className={styles.empty} role="status">
          {emptyMessage(payload.empty_reason)}
        </p>
      ) : null}

      <ul className={styles.list}>
        {(payload?.departures ?? []).map((d) => {
          const when = d.estimated_time ?? d.scheduled_time;
          const scheduled = d.provenance === "scheduled";
          return (
            <li
              key={`${d.trip_id}-${when}`}
              className={scheduled ? `${styles.row} ${styles.rowScheduled}` : styles.row}
            >
              <div className={styles.meta}>
                <span className={styles.route}>
                  {d.route_short_name ?? "—"}
                </span>
                <span className={styles.headsign}>
                  {d.headsign ?? "Destination unknown"}
                </span>
                <ProvenanceBadge
                  provenance={d.provenance}
                  label={d.provenance_label}
                />
              </div>
              <div className={styles.timeCol}>
                <time
                  className={styles.time}
                  dateTime={when ?? undefined}
                  title={d.confidence_note}
                >
                  {formatDepartureTime(when, nowMs)}
                </time>
                {d.vehicle_id ? (
                  <button
                    type="button"
                    className={styles.vehicleLink}
                    onClick={() => onVehicleActivate(d.vehicle_id!)}
                  >
                    Bus {d.vehicle_id}
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
