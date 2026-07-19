import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { readQualityLabels } from "@/lib/quality/isServable";
import { getActiveFeedVersionIdOrNull } from "@/lib/gtfs/activeFeed";

export const dynamic = "force-dynamic";

function bboxAreaKm2(
  minLon: number,
  minLat: number,
  maxLon: number,
  maxLat: number,
): number {
  const meanLat = ((minLat + maxLat) / 2) * (Math.PI / 180);
  const kmPerDegLat = 110.574;
  const kmPerDegLon = 111.32 * Math.cos(meanLat);
  return Math.abs(maxLon - minLon) * kmPerDegLon * Math.abs(maxLat - minLat) * kmPerDegLat;
}

async function feedStatus(feedName: string): Promise<"live" | "degraded" | "down"> {
  const h = await query<{
    last_success_at: Date | null;
    consecutive_failures: number;
    stale: boolean;
  }>(
    `SELECT last_success_at, consecutive_failures, stale FROM feed_health WHERE feed_name = $1`,
    [feedName],
  );
  const row = h.rows[0];
  if (!row?.last_success_at) return "down";
  const age = (Date.now() - row.last_success_at.getTime()) / 1000;
  if (age > 300) return "down";
  if (age > 60 || row.stale || row.consecutive_failures > 0) return "degraded";
  return "live";
}

export async function GET(req: NextRequest) {
  const env = getEnv();
  const url = req.nextUrl;
  const bbox = url.searchParams.get("bbox");
  const routeId = url.searchParams.get("route_id");

  if (!bbox && !routeId) {
    return NextResponse.json(
      { error: { code: "MISSING_FILTER", message: "bbox or route_id required" } },
      { status: 400 },
    );
  }

  let minLon = -180,
    minLat = -90,
    maxLon = 180,
    maxLat = 90;

  if (bbox) {
    const parts = bbox.split(",").map(Number);
    if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
      return NextResponse.json(
        { error: { code: "INVALID_BBOX", message: "bbox must be minLon,minLat,maxLon,maxLat" } },
        { status: 400 },
      );
    }
    [minLon, minLat, maxLon, maxLat] = parts as [number, number, number, number];
    if (bboxAreaKm2(minLon, minLat, maxLon, maxLat) > env.MAX_BBOX_SQ_KM) {
      return NextResponse.json(
        { error: { code: "BBOX_TOO_LARGE", message: "bbox exceeds MAX_BBOX_SQ_KM" } },
        { status: 400 },
      );
    }
  }

  const feedName = env.GTFS_RT_FEED_NAME;
  const feedVersionId = await getActiveFeedVersionIdOrNull();
  const status = await feedStatus(feedName);

  const fh = await query<{ last_feed_timestamp: Date | null }>(
    `SELECT last_feed_timestamp FROM feed_health WHERE feed_name = $1`,
    [feedName],
  );

  // Read through servable view only — never vehicle_positions_current in API.
  const rows = await query<{
    vehicle_id: string;
    route_id: string | null;
    route_short_name: string | null;
    trip_id: string | null;
    lat: number;
    lon: number;
    bearing: number | null;
    speed_mps: number | null;
    occupancy_status: string | null;
    observed_at: Date;
    quality_flags: number;
    trip_headsign: string | null;
  }>(
    `SELECT
       s.vehicle_id, s.route_id, r.route_short_name, s.trip_id,
       ST_Y(s.geom::geometry) AS lat, ST_X(s.geom::geometry) AS lon,
       s.bearing, s.speed_mps, s.occupancy_status, s.observed_at, s.quality_flags,
       tr.trip_headsign
     FROM vehicle_positions_servable s
     LEFT JOIN trips tr
       ON tr.feed_version_id = $5 AND tr.trip_id = s.trip_id
     LEFT JOIN routes r
       ON r.feed_version_id = $5 AND r.route_id = s.route_id
     WHERE s.feed_name = $1
       AND ($2::text IS NULL OR s.route_id = $2)
       AND (
         $6::boolean = FALSE
         OR s.geom::geometry && ST_MakeEnvelope($3,$4,$7,$8,4326)
       )
       AND EXTRACT(EPOCH FROM (now() - s.observed_at)) <= $9
     `,
    [
      feedName,
      routeId,
      minLon,
      minLat,
      feedVersionId,
      Boolean(bbox),
      maxLon,
      maxLat,
      env.QUALITY_VERY_STALE_SECONDS,
    ],
  );

  const vehicles = rows.rows.map((r) => {
    const age = Math.floor((Date.now() - r.observed_at.getTime()) / 1000);
    return {
      vehicle_id: r.vehicle_id,
      route_id: r.route_id,
      route_short_name: r.route_short_name,
      trip_id: r.trip_id,
      // Rounded to 5 dp (~1 m) — deliberate payload/privacy choice, not a precision bug.
      lat: Number(Number(r.lat).toFixed(5)),
      lon: Number(Number(r.lon).toFixed(5)),
      bearing: r.bearing,
      speed_mps: r.speed_mps,
      occupancy_status: r.occupancy_status,
      headsign: r.trip_headsign,
      feed_timestamp: r.observed_at.toISOString(),
      age_seconds: age,
      quality: readQualityLabels({
        qualityFlags: r.quality_flags,
        ageSeconds: age,
      }),
    };
  });

  const body = {
    generated_at: new Date().toISOString(),
    feed_timestamp: fh.rows[0]?.last_feed_timestamp?.toISOString() ?? null,
    feed_status: status,
    vehicles,
  };

  const etag = `"${createHash("sha1").update(JSON.stringify(body)).digest("hex")}"`;
  if (req.headers.get("if-none-match") === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: etag,
        "Cache-Control": "public, max-age=5, stale-while-revalidate=10",
      },
    });
  }

  return NextResponse.json(body, {
    headers: {
      ETag: etag,
      "Cache-Control": "public, max-age=5, stale-while-revalidate=10",
    },
  });
}
