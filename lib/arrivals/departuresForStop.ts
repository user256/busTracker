import { getEnv } from "../env";
import { query } from "../db";
import { getActiveFeedVersionIdOrNull } from "../gtfs/activeFeed";
import { arrivalsForStop, type Arrival } from "./forStop";
import {
  classifyArrivalProvenance,
  type ArrivalProvenanceKind,
} from "./provenance";

export type StopEmptyReason = "no_departures_today" | "no_live_data";

export type StopDeparture = {
  trip_id: string;
  route_short_name: string | null;
  headsign: string | null;
  scheduled_time: string | null;
  estimated_time: string | null;
  provenance: ArrivalProvenanceKind;
  provenance_label: string;
  vehicle_id: string | null;
  confidence_note: string;
};

export type StopDeparturesPayload = {
  stop_id: string;
  stop_name: string | null;
  departures: StopDeparture[];
  empty_reason: StopEmptyReason | null;
  feed_status: "live" | "degraded" | "down";
  generated_at: string;
};

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

function departureInstant(a: Arrival): Date | null {
  const iso = a.estimated_time ?? a.scheduled_time;
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function secondsSinceMidnightUtc(now: Date): number {
  return (
    now.getUTCHours() * 3600 +
    now.getUTCMinutes() * 60 +
    now.getUTCSeconds()
  );
}

async function feedStatus(feedName: string): Promise<"live" | "degraded" | "down"> {
  const h = await query<{ last_success_at: Date | null }>(
    `SELECT last_success_at FROM feed_health WHERE feed_name = $1`,
    [feedName],
  );
  const row = h.rows[0];
  if (!row?.last_success_at) return "down";
  const age = (Date.now() - row.last_success_at.getTime()) / 1000;
  if (age > 300) return "down";
  if (age > 60) return "degraded";
  return "live";
}

async function stopName(
  stopId: string,
  feedVersionId: number | null,
): Promise<string | null> {
  if (!feedVersionId) return null;
  const r = await query<{ stop_name: string }>(
    `SELECT stop_name FROM stops
     WHERE feed_version_id = $1 AND stop_id = $2`,
    [feedVersionId, stopId],
  );
  return r.rows[0]?.stop_name ?? null;
}

async function remainingDeparturesToday(
  stopId: string,
  feedVersionId: number | null,
): Promise<number> {
  if (!feedVersionId) return 0;
  const nowSec = secondsSinceMidnightUtc(new Date());
  const r = await query<{ n: string }>(
    `SELECT COUNT(*)::text AS n
     FROM stop_times
     WHERE feed_version_id = $1 AND stop_id = $2 AND departure_time >= $3`,
    [feedVersionId, stopId, nowSec],
  );
  return Number(r.rows[0]?.n ?? 0);
}

async function enrichDeparture(
  arrival: Arrival,
  feedVersionId: number | null,
  feedName: string,
): Promise<StopDeparture> {
  let routeShort: string | null = null;
  let headsign: string | null = null;
  let vehicleId: string | null = null;

  if (feedVersionId && arrival.route_id) {
    const r = await query<{ route_short_name: string | null }>(
      `SELECT route_short_name FROM routes
       WHERE feed_version_id = $1 AND route_id = $2`,
      [feedVersionId, arrival.route_id],
    );
    routeShort = r.rows[0]?.route_short_name ?? null;
  }

  if (feedVersionId && arrival.trip_id) {
    const t = await query<{ trip_headsign: string | null }>(
      `SELECT trip_headsign FROM trips
       WHERE feed_version_id = $1 AND trip_id = $2`,
      [feedVersionId, arrival.trip_id],
    );
    headsign = t.rows[0]?.trip_headsign ?? null;
  }

  if (arrival.source === "realtime" && arrival.trip_id) {
    const v = await query<{ vehicle_id: string }>(
      `SELECT vehicle_id FROM vehicle_positions_current
       WHERE feed_name = $1 AND trip_id = $2
       ORDER BY observed_at DESC
       LIMIT 1`,
      [feedName, arrival.trip_id],
    );
    vehicleId = v.rows[0]?.vehicle_id ?? null;
  }

  const provenance = classifyArrivalProvenance({
    source: arrival.source,
    delaySeconds: arrival.delay_seconds,
  });

  return {
    trip_id: arrival.trip_id,
    route_short_name: routeShort,
    headsign,
    scheduled_time: arrival.scheduled_time,
    estimated_time: arrival.estimated_time,
    provenance: provenance.kind,
    provenance_label: provenance.label,
    vehicle_id: vehicleId,
    confidence_note: arrival.confidence_note,
  };
}

/**
 * Next departures for a stop with route labels, provenance, and vehicle linkage (Ticket 205).
 */
export async function departuresForStop(
  stopId: string,
  limit = 10,
  feedName = getEnv().GTFS_RT_FEED_NAME,
): Promise<StopDeparturesPayload> {
  const feedVersionId = await getActiveFeedVersionIdOrNull();
  const status = await feedStatus(feedName);
  const name = await stopName(stopId, feedVersionId);
  const now = Date.now();
  const windowEnd = now + TWO_HOURS_MS;

  const arrivals = await arrivalsForStop(stopId, limit * 3, feedName);
  const inWindow = arrivals.filter((a) => {
    const at = departureInstant(a);
    if (!at) return false;
    const t = at.getTime();
    return t >= now - 60_000 && t <= windowEnd;
  });

  const slice = inWindow.slice(0, limit);
  const departures: StopDeparture[] = [];
  for (const a of slice) {
    departures.push(await enrichDeparture(a, feedVersionId, feedName));
  }

  let empty_reason: StopEmptyReason | null = null;
  if (departures.length === 0) {
    const remaining = await remainingDeparturesToday(stopId, feedVersionId);
    if (remaining === 0) {
      empty_reason = "no_departures_today";
    } else if (status === "down" || !name) {
      empty_reason = "no_live_data";
    } else {
      empty_reason = "no_departures_today";
    }
  }

  return {
    stop_id: stopId,
    stop_name: name,
    departures,
    empty_reason,
    feed_status: status,
    generated_at: new Date().toISOString(),
  };
}
