import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { tripForVehicle } from "@/lib/arrivals/tripForVehicle";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ vehicle_id: string }> },
) {
  const { vehicle_id: vehicleId } = await ctx.params;
  if (!vehicleId) {
    return NextResponse.json(
      { error: { code: "MISSING_ID", message: "vehicle_id required" } },
      { status: 400 },
    );
  }

  const env = getEnv();
  const trip = await tripForVehicle(vehicleId, env.GTFS_RT_FEED_NAME);
  if (!trip) {
    return NextResponse.json(
      {
        error: {
          code: "NOT_FOUND",
          message: "No current position for this vehicle_id",
        },
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    ...trip,
  });
}
