import { NextRequest, NextResponse } from "next/server";
import { departuresForStop } from "@/lib/arrivals/departuresForStop";
import { getEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ stop_id: string }> },
) {
  const { stop_id: stopId } = await ctx.params;
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "10");
  const env = getEnv();
  const payload = await departuresForStop(
    stopId,
    Number.isFinite(limit) ? limit : 10,
    env.GTFS_RT_FEED_NAME,
  );

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "public, max-age=20, s-maxage=20",
    },
  });
}
