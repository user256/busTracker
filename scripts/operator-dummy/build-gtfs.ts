/**
 * Build a dummy Stagecoach-style GTFS static feed from the Perth–Kinross–Tillicoultry
 * timetable (routes 55 + 23). Approximate stop coordinates; times from the published board.
 *
 * Usage: npx tsx scripts/operator-dummy/build-gtfs.ts
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const OUT = path.join(process.cwd(), "fixtures", "operator-dummy", "gtfs");
const ZIP = path.join(
  process.cwd(),
  "fixtures",
  "operator-dummy",
  "gtfs-static.zip",
);

type Stop = {
  id: string;
  code: string;
  name: string;
  lat: number;
  lon: number;
  prebook?: boolean;
};

/** Approximate WGS84 positions along the corridor. */
const STOPS: Stop[] = [
  { id: "perth_bs", code: "PERTH1", name: "Perth Bus Station (stance 1)", lat: 56.3956, lon: -3.4305 },
  { id: "perth_edin", code: "EDINZM", name: "Perth, Edinburgh Road (stop ZM)", lat: 56.3865, lon: -3.426 },
  { id: "perth_tesco", code: "FRIART", name: "Perth, Friarton Tesco", lat: 56.375, lon: -3.42 },
  { id: "boe", code: "BOEARN", name: "Bridge of Earn", lat: 56.348, lon: -3.405 },
  { id: "glenfarg", code: "GLENFG", name: "Glenfarg, Ladeside", lat: 56.28, lon: -3.4 },
  { id: "cuthill", code: "CUTHIL", name: "Cuthill Towers / Duncrieve / Drunzie", lat: 56.255, lon: -3.405, prebook: true },
  { id: "milnathort", code: "MILNAT", name: "Milnathort", lat: 56.227, lon: -3.421 },
  { id: "campus", code: "CAMPUS", name: "Campus", lat: 56.212, lon: -3.425, prebook: true },
  { id: "kinross", code: "KINROS", name: "Kinross", lat: 56.205, lon: -3.422 },
  { id: "crook", code: "CROOKD", name: "Crook of Devon", lat: 56.185, lon: -3.505 },
  { id: "rumbling", code: "RUMBLB", name: "Rumbling Bridge", lat: 56.175, lon: -3.515, prebook: true },
  { id: "powmill", code: "POWMIL", name: "Powmill", lat: 56.165, lon: -3.55 },
  { id: "blairingone", code: "BLAIRI", name: "Blairingone", lat: 56.155, lon: -3.58 },
  { id: "dollar", code: "DOLLAR", name: "Dollar", lat: 56.162, lon: -3.674 },
  { id: "tilli_murray", code: "TILMUR", name: "Tillicoultry, Murray Square", lat: 56.153, lon: -3.742 },
  { id: "tilli_moss", code: "TILMOS", name: "Tillicoultry, Moss Road", lat: 56.155, lon: -3.748 },
  { id: "tilli_mills", code: "TILMIL", name: "Tillicoultry, Sterling Mills", lat: 56.157, lon: -3.755 },
  { id: "boe_side", code: "BOESID", name: "Bridge of Earn, Side Street", lat: 56.349, lon: -3.406 },
  { id: "perth_princes", code: "PRINCE", name: "Perth, Princes Street", lat: 56.3935, lon: -3.4315 },
  { id: "perth_scott", code: "SCOTTW", name: "Perth, 59 Scott Street (stop W)", lat: 56.3945, lon: -3.4325 },
  { id: "perth_kinnoull", code: "KINNST", name: "Perth, Kinnoull Street (stop T)", lat: 56.3952, lon: -3.4318 },
];

function hm(h: number, m: number): string {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

function addMin(h: number, m: number, add: number): [number, number] {
  const t = h * 60 + m + add;
  return [Math.floor(t / 60) % 24, t % 60];
}

function writeCsv(name: string, header: string, rows: string[]): void {
  fs.writeFileSync(path.join(OUT, name), [header, ...rows, ""].join("\n"));
}

function shapePts(ids: string[], shapeId: string): string[] {
  const rows: string[] = [];
  let seq = 1;
  for (const id of ids) {
    const s = STOPS.find((x) => x.id === id)!;
    rows.push(`${shapeId},${s.lat},${s.lon},${seq}`);
    seq++;
  }
  return rows;
}

fs.mkdirSync(OUT, { recursive: true });

writeCsv(
  "agency.txt",
  "agency_id,agency_name,agency_url,agency_timezone,agency_lang,agency_phone",
  [
    "STAGECOACH,Stagecoach (dummy Perth/Kinross),https://example.invalid/dummy,Europe/London,en,08456055955",
  ],
);

writeCsv(
  "feed_info.txt",
  "feed_publisher_name,feed_publisher_url,feed_lang,feed_start_date,feed_end_date,feed_version",
  [
    "busTracker dummy operator,https://example.invalid/dummy,en,20260101,20261231,perth-kinross-55-23-v1",
  ],
);

writeCsv(
  "stops.txt",
  "stop_id,stop_code,stop_name,stop_desc,stop_lat,stop_lon,location_type,wheelchair_boarding",
  STOPS.map((s) => {
    const desc = s.prebook
      ? "Pre-book only (Ride Pingo / 0845 605 5955)"
      : "";
    return `${s.id},${s.code},"${s.name}","${desc}",${s.lat},${s.lon},0,1`;
  }),
);

writeCsv(
  "routes.txt",
  "route_id,agency_id,route_short_name,route_long_name,route_type,route_color,route_text_color",
  [
    "55,STAGECOACH,55,Perth - Glenfarg - Kinross,3,E30613,FFFFFF",
    "23,STAGECOACH,23,Kinross - Dollar - Tillicoultry,3,E30613,FFFFFF",
  ],
);

writeCsv(
  "calendar.txt",
  "service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date",
  [
    "WD,1,1,1,1,1,0,0,20260101,20261231",
    "SA,0,0,0,0,0,1,0,20260101,20261231",
    "MS,1,1,1,1,1,1,0,20260101,20261231",
  ],
);

// Shapes
const shape55Out = [
  "perth_bs",
  "perth_edin",
  "perth_tesco",
  "boe",
  "glenfarg",
  "cuthill",
  "milnathort",
  "campus",
  "kinross",
];
const shape23 = [
  "kinross",
  "crook",
  "rumbling",
  "powmill",
  "blairingone",
  "dollar",
  "tilli_murray",
  "tilli_moss",
  "tilli_mills",
  "tilli_moss",
  "tilli_murray",
  "dollar",
  "blairingone",
  "powmill",
  "rumbling",
  "crook",
  "kinross",
];
const shape55Ret = [
  "kinross",
  "campus",
  "milnathort",
  "cuthill",
  "glenfarg",
  "boe_side",
  "perth_tesco",
  "perth_princes",
  "perth_scott",
  "perth_kinnoull",
  "perth_bs",
];

const shapeRows = [
  ...shapePts(shape55Out, "SH55_OUT"),
  ...shapePts(shape23, "SH23"),
  ...shapePts(shape55Ret, "SH55_RET"),
];
writeCsv(
  "shapes.txt",
  "shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence",
  shapeRows,
);

type TripDef = {
  tripId: string;
  routeId: string;
  serviceId: string;
  headsign: string;
  shapeId: string;
  directionId: number;
  /** stop_id + arrival/departure as [h,m] */
  times: Array<{ stopId: string; h: number; m: number; pickup?: number; dropoff?: number }>;
};

const trips: TripDef[] = [];

/** Route 55 Perth→Kinross: hourly 09:30–16:30 MS, plus SO 17:30, early Glenfarg-origin WD. */
function trip55Out(
  tripId: string,
  serviceId: string,
  perthDep: [number, number] | null,
  glenfargDep: [number, number],
): void {
  const times: TripDef["times"] = [];
  let [h, m] = glenfargDep;
  if (perthDep) {
    const [ph, pm] = perthDep;
    times.push({ stopId: "perth_bs", h: ph, m: pm });
    let t = addMin(ph, pm, 5);
    times.push({ stopId: "perth_edin", h: t[0], m: t[1] });
    t = addMin(ph, pm, 10);
    times.push({ stopId: "perth_tesco", h: t[0], m: t[1] });
    t = addMin(ph, pm, 18);
    times.push({ stopId: "boe", h: t[0], m: t[1] });
    // Glenfarg aligns with published
    h = glenfargDep[0];
    m = glenfargDep[1];
  }
  times.push({ stopId: "glenfarg", h, m });
  let t = addMin(h, m, 6);
  times.push({ stopId: "cuthill", h: t[0], m: t[1] });
  t = addMin(h, m, 12);
  times.push({ stopId: "milnathort", h: t[0], m: t[1] });
  t = addMin(h, m, 15);
  times.push({ stopId: "campus", h: t[0], m: t[1] });
  t = addMin(h, m, 18);
  times.push({ stopId: "kinross", h: t[0], m: t[1] });

  trips.push({
    tripId,
    routeId: "55",
    serviceId,
    headsign: "Kinross",
    shapeId: "SH55_OUT",
    directionId: 0,
    times,
  });
}

/** Route 23 Kinross loop via Tillicoultry. Kinross dep :15 → Mills arr :47 / dep :02 → Kinross :34. */
function trip23(tripId: string, serviceId: string, kinrossDep: [number, number]): void {
  const [h0, m0] = kinrossDep;
  const times: TripDef["times"] = [];

  const outbound: Array<[string, number, number?, number?]> = [
    ["kinross", 0],
    ["crook", 8],
    ["rumbling", 12],
    ["powmill", 18],
    ["blairingone", 22],
    ["dollar", 28],
    ["tilli_murray", 32, 1, 1], // *S set-down only outbound
    ["tilli_moss", 34],
    ["tilli_mills", 32], // :15+32 = :47
  ];
  for (const [id, add, pickup, dropoff] of outbound) {
    const t = addMin(h0, m0, add);
    times.push({
      stopId: id,
      h: t[0],
      m: t[1],
      pickup: pickup ?? 0,
      dropoff: dropoff ?? 0,
    });
  }

  const millsDep = addMin(h0, m0, 47); // :02 next hour
  const inbound: Array<[string, number]> = [
    ["tilli_mills", 0],
    ["tilli_moss", 3],
    ["tilli_murray", 5],
    ["dollar", 12],
    ["blairingone", 18],
    ["powmill", 22],
    ["rumbling", 28],
    ["crook", 32],
    ["kinross", 32], // :02+32 = :34
  ];
  for (const [id, add] of inbound) {
    const t = addMin(millsDep[0], millsDep[1], add);
    times.push({ stopId: id, h: t[0], m: t[1] });
  }

  trips.push({
    tripId,
    routeId: "23",
    serviceId,
    headsign: "Tillicoultry",
    shapeId: "SH23",
    directionId: 0,
    times,
  });
}

/** Route 55 Kinross→Perth. Kinross dep :35 → Perth arr ~:25 next hour (+50). */
function trip55Ret(tripId: string, serviceId: string, kinrossDep: [number, number]): void {
  const [h0, m0] = kinrossDep;
  const offsets: Array<[string, number]> = [
    ["kinross", 0],
    ["campus", 3],
    ["milnathort", 6],
    ["cuthill", 10],
    ["glenfarg", 16],
    ["boe_side", 28],
    ["perth_tesco", 35],
    ["perth_princes", 42],
    ["perth_scott", 45],
    ["perth_kinnoull", 47],
    ["perth_bs", 50],
  ];
  const times = offsets.map(([stopId, add]) => {
    const t = addMin(h0, m0, add);
    return { stopId, h: t[0], m: t[1] };
  });
  trips.push({
    tripId,
    routeId: "55",
    serviceId,
    headsign: "Perth",
    shapeId: "SH55_RET",
    directionId: 1,
    times,
  });
}

// Early WD Glenfarg-only style
trip55Out("55_WD_0700", "WD", null, [7, 0]);
trip55Out("55_WD_0755", "WD", null, [7, 55]);
trip55Out("55_WD_0855", "WD", null, [8, 55]);

// Main Perth→Kinross MS 09:30–16:30
for (let h = 9; h <= 16; h++) {
  trip55Out(`55_MS_${h}30`, "MS", [h, 30], [h + 1, 0]); // approx Glenfarg ~+30 from Perth
}
trip55Out("55_SO_1730", "SA", [17, 30], [18, 0]);

// Route 23 WD early + MS :15
trip23("23_WD_0715", "WD", [7, 15]);
for (let h = 8; h <= 17; h++) {
  trip23(`23_MS_${h}15`, "MS", [h, 15]);
}

// Route 55 return MS 08:35–18:35
for (let h = 8; h <= 18; h++) {
  trip55Ret(`55_RET_${h}35`, "MS", [h, 35]);
}

const tripRows: string[] = [];
const stopTimeRows: string[] = [];

for (const t of trips) {
  tripRows.push(
    `${t.routeId},${t.serviceId},${t.tripId},"${t.headsign}",${t.directionId},${t.shapeId}`,
  );
  let seq = 1;
  for (const st of t.times) {
    const time = hm(st.h, st.m);
    const pickup = st.pickup ?? 0;
    const dropoff = st.dropoff ?? 0;
    stopTimeRows.push(
      `${t.tripId},${time},${time},${st.stopId},${seq},${pickup},${dropoff}`,
    );
    seq++;
  }
}

writeCsv(
  "trips.txt",
  "route_id,service_id,trip_id,trip_headsign,direction_id,shape_id",
  tripRows,
);
writeCsv(
  "stop_times.txt",
  "trip_id,arrival_time,departure_time,stop_id,stop_sequence,pickup_type,drop_off_type",
  stopTimeRows,
);

writeCsv(
  "transfers.txt",
  "from_stop_id,to_stop_id,transfer_type,min_transfer_time",
  ["kinross,kinross,2,120"],
);

// Zip
if (fs.existsSync(ZIP)) fs.unlinkSync(ZIP);
execFileSync("zip", ["-qj", ZIP, ...fs.readdirSync(OUT).map((f) => path.join(OUT, f))]);
console.log(
  JSON.stringify(
    {
      ok: true,
      zip: ZIP,
      stops: STOPS.length,
      trips: trips.length,
      stop_times: stopTimeRows.length,
    },
    null,
    2,
  ),
);
