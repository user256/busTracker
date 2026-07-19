import { NextRequest, NextResponse } from "next/server";
import { arrivalsForStop } from "@/lib/arrivals/forStop";
import { query } from "@/lib/db";
import { getEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

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

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ stop_id: string }> },
) {
  const { stop_id: stopId } = await ctx.params;
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "10");
  const env = getEnv();
  const arrivals = await arrivalsForStop(
    stopId,
    Number.isFinite(limit) ? limit : 10,
    env.GTFS_RT_FEED_NAME,
  );

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    feed_status: await feedStatus(env.GTFS_RT_FEED_NAME),
    stop_id: stopId,
    arrivals,
    note: "Arrival times are estimates when source=realtime and never guarantees.",
  });
}
