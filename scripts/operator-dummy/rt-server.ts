/**
 * Local dummy GTFS-Realtime server for the Perth–Kinross–Tillicoultry feed.
 * Serves VehiclePositions + TripUpdates that advance along active trips.
 *
 *   npx tsx scripts/operator-dummy/rt-server.ts
 *   → http://127.0.0.1:8099/gtfs-rt/vehicle-positions.pb
 *   → http://127.0.0.1:8099/gtfs-rt/trip-updates.pb
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { parse } from "csv-parse/sync";
import GtfsRealtimeBindings from "gtfs-realtime-bindings";

const PORT = Number(process.env.DUMMY_RT_PORT ?? 8099);
const GTFS_DIR = path.join(process.cwd(), "fixtures", "operator-dummy", "gtfs");

const {
  FeedMessage,
  FeedHeader,
  FeedEntity,
  VehiclePosition,
  Position,
  TripDescriptor,
  VehicleDescriptor,
  TripUpdate,
} = GtfsRealtimeBindings.transit_realtime;
const StopTimeUpdate = TripUpdate.StopTimeUpdate;
const StopTimeEvent = TripUpdate.StopTimeEvent;

type StopTime = {
  trip_id: string;
  arrival_time: string;
  departure_time: string;
  stop_id: string;
  stop_sequence: number;
};
type Trip = {
  trip_id: string;
  route_id: string;
  service_id: string;
  trip_headsign: string;
  shape_id: string;
};
type Stop = { stop_id: string; stop_lat: number; stop_lon: number };
type ShapePt = {
  shape_id: string;
  shape_pt_lat: number;
  shape_pt_lon: number;
  shape_pt_sequence: number;
};

function readCsv<T>(file: string): T[] {
  const text = fs.readFileSync(path.join(GTFS_DIR, file), "utf8");
  return parse(text, { columns: true, skip_empty_lines: true, trim: true }) as T[];
}

function parseTime(t: string): number {
  const [h, m, s] = t.split(":").map(Number);
  return h * 3600 + m * 60 + (s || 0);
}

function todayYmd(d = new Date()): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}${mo}${da}`;
}

function serviceForToday(d = new Date()): Set<string> {
  // Dummy feed: run weekday+Sat patterns every day (including Sunday) so local
  // soak always has vehicles. Real operator calendars would exclude Sunday.
  if (process.env.DUMMY_RT_STRICT_CALENDAR === "1") {
    const day = d.getDay();
    if (day === 0) return new Set();
    if (day === 6) return new Set(["SA", "MS"]);
    return new Set(["WD", "MS"]);
  }
  return new Set(["WD", "SA", "MS"]);
}

function interpolate(
  shapes: ShapePt[],
  shapeId: string,
  frac: number,
): { lat: number; lon: number; bearing: number } {
  const pts = shapes
    .filter((p) => p.shape_id === shapeId)
    .sort((a, b) => a.shape_pt_sequence - b.shape_pt_sequence);
  if (pts.length < 2) return { lat: 56.2, lon: -3.42, bearing: 0 };
  const f = Math.min(1, Math.max(0, frac));
  const idx = f * (pts.length - 1);
  const i = Math.floor(idx);
  const j = Math.min(pts.length - 1, i + 1);
  const t = idx - i;
  const a = pts[i]!;
  const b = pts[j]!;
  const lat = a.shape_pt_lat + (b.shape_pt_lat - a.shape_pt_lat) * t;
  const lon = a.shape_pt_lon + (b.shape_pt_lon - a.shape_pt_lon) * t;
  const bearing =
    (Math.atan2(b.shape_pt_lon - a.shape_pt_lon, b.shape_pt_lat - a.shape_pt_lat) *
      180) /
      Math.PI;
  return { lat, lon, bearing: (bearing + 360) % 360 };
}

function loadBundle() {
  if (!fs.existsSync(path.join(GTFS_DIR, "trips.txt"))) {
    throw new Error("Run: npx tsx scripts/operator-dummy/build-gtfs.ts first");
  }
  return {
    trips: readCsv<Trip>("trips.txt"),
    stopTimes: readCsv<StopTime>("stop_times.txt"),
    stops: readCsv<Stop>("stops.txt").map((s) => ({
      ...s,
      stop_lat: Number(s.stop_lat),
      stop_lon: Number(s.stop_lon),
    })),
    shapes: readCsv<ShapePt>("shapes.txt").map((s) => ({
      ...s,
      shape_pt_lat: Number(s.shape_pt_lat),
      shape_pt_lon: Number(s.shape_pt_lon),
      shape_pt_sequence: Number(s.shape_pt_sequence),
    })),
  };
}

const bundle = loadBundle();
const stopById = new Map(bundle.stops.map((s) => [s.stop_id, s]));

/** Wall clock used for trip selection. Override hour with DUMMY_RT_SIMULATE_HOUR=0-23 for denser demos. */
function clockForSelection(now = new Date()): Date {
  const raw = process.env.DUMMY_RT_SIMULATE_HOUR;
  if (raw === undefined || raw === "") return now;
  const hour = Number(raw);
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return now;
  const d = new Date(now);
  d.setHours(hour, now.getMinutes(), now.getSeconds(), 0);
  return d;
}

function activeTrips(now = new Date()) {
  const clock = clockForSelection(now);
  const services = serviceForToday(clock);
  const sec =
    clock.getHours() * 3600 + clock.getMinutes() * 60 + clock.getSeconds();
  const out: Array<{
    trip: Trip;
    times: StopTime[];
    startSec: number;
    endSec: number;
    progress: number;
  }> = [];

  for (const trip of bundle.trips) {
    if (!services.has(trip.service_id)) continue;
    const times = bundle.stopTimes
      .filter((st) => st.trip_id === trip.trip_id)
      .sort((a, b) => Number(a.stop_sequence) - Number(b.stop_sequence));
    if (!times.length) continue;
    const startSec = parseTime(times[0]!.departure_time);
    const endSec = parseTime(times[times.length - 1]!.arrival_time);
    if (sec < startSec - 120 || sec > endSec + 180) continue;
    const progress =
      endSec === startSec
        ? 0
        : Math.min(1, Math.max(0, (sec - startSec) / (endSec - startSec)));
    out.push({ trip, times, startSec, endSec, progress });
  }
  return out;
}

function buildVehicleFeed(now = new Date()) {
  const ts = Math.floor(now.getTime() / 1000);
  const entities = activeTrips(now).map((a, i) => {
    const pos = interpolate(bundle.shapes, a.trip.shape_id, a.progress);
    // Up to ~3 min late for pre-book stops (timetable note)
    const delayJitter = (i % 3) * 20;
    return FeedEntity.create({
      id: `veh-${a.trip.trip_id}`,
      vehicle: VehiclePosition.create({
        trip: TripDescriptor.create({
          tripId: a.trip.trip_id,
          routeId: a.trip.route_id,
          startDate: todayYmd(now),
          startTime: a.times[0]!.departure_time,
        }),
        vehicle: VehicleDescriptor.create({
          id: `BUS-${a.trip.route_id}-${i + 1}`,
          label: a.trip.route_id,
        }),
        position: Position.create({
          latitude: pos.lat,
          longitude: pos.lon,
          bearing: pos.bearing,
          speed: 8 + (i % 4),
        }),
        timestamp: ts - delayJitter,
        currentStatus: 2,
      }),
    });
  });

  return FeedMessage.encode(
    FeedMessage.create({
      header: FeedHeader.create({
        gtfsRealtimeVersion: "2.0",
        timestamp: ts,
        incrementality: 0,
      }),
      entity: entities,
    }),
  ).finish();
}

function buildTripUpdates(now = new Date()) {
  const ts = Math.floor(now.getTime() / 1000);
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const midnightSec = Math.floor(midnight.getTime() / 1000);

  const entities = activeTrips(now).map((a, i) => {
    const delay = (i % 4) * 60; // 0–3 min delay (timetable: may be up to 3 min late)
    const updates = a.times.map((st) => {
      const sched = parseTime(st.arrival_time);
      return StopTimeUpdate.create({
        stopSequence: Number(st.stop_sequence),
        stopId: st.stop_id,
        arrival: StopTimeEvent.create({
          delay,
          time: midnightSec + sched + delay,
        }),
        departure: StopTimeEvent.create({ delay }),
      });
    });
    return FeedEntity.create({
      id: `tu-${a.trip.trip_id}`,
      tripUpdate: TripUpdate.create({
        trip: TripDescriptor.create({
          tripId: a.trip.trip_id,
          routeId: a.trip.route_id,
          startDate: todayYmd(now),
          startTime: a.times[0]!.departure_time,
        }),
        stopTimeUpdate: updates,
        timestamp: ts,
        delay,
      }),
    });
  });

  return FeedMessage.encode(
    FeedMessage.create({
      header: FeedHeader.create({
        gtfsRealtimeVersion: "2.0",
        timestamp: ts,
        incrementality: 0,
      }),
      entity: entities,
    }),
  ).finish();
}

const server = http.createServer((req, res) => {
  const url = req.url ?? "/";
  if (url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, activeTrips: activeTrips().length }));
    return;
  }
  if (url.startsWith("/gtfs-rt/vehicle-positions")) {
    const body = Buffer.from(buildVehicleFeed());
    res.writeHead(200, {
      "Content-Type": "application/x-protobuf",
      ETag: `"vp-${Math.floor(Date.now() / 10000)}"`,
    });
    res.end(body);
    return;
  }
  if (url.startsWith("/gtfs-rt/trip-updates")) {
    const body = Buffer.from(buildTripUpdates());
    res.writeHead(200, {
      "Content-Type": "application/x-protobuf",
      ETag: `"tu-${Math.floor(Date.now() / 10000)}"`,
    });
    res.end(body);
    return;
  }
  res.writeHead(404);
  res.end("not found");
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(
    JSON.stringify({
      service: "dummy-rt-server",
      port: PORT,
      vehicle_positions: `http://127.0.0.1:${PORT}/gtfs-rt/vehicle-positions.pb`,
      trip_updates: `http://127.0.0.1:${PORT}/gtfs-rt/trip-updates.pb`,
      health: `http://127.0.0.1:${PORT}/health`,
      active_trips_now: activeTrips().length,
    }),
  );
});
