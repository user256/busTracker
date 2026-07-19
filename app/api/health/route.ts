import { NextResponse } from "next/server";
import { checkDb, latestMigrationVersion, query } from "@/lib/db";
import { getEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const dbOk = await checkDb();
  const migrations = dbOk ? await latestMigrationVersion() : null;

  let vehicleFeed: {
    status: string;
    last_success_at: string | null;
    consecutive_failures: number;
    stale: boolean;
  } | null = null;

  if (dbOk) {
    try {
      const env = getEnv();
      const h = await query<{
        last_success_at: Date | null;
        consecutive_failures: number;
        stale: boolean;
      }>(
        `SELECT last_success_at, consecutive_failures, stale
         FROM feed_health WHERE feed_name = $1`,
        [env.GTFS_RT_FEED_NAME],
      );
      const row = h.rows[0];
      if (!row?.last_success_at) {
        vehicleFeed = {
          status: "down",
          last_success_at: null,
          consecutive_failures: row?.consecutive_failures ?? 0,
          stale: row?.stale ?? false,
        };
      } else {
        const age = (Date.now() - row.last_success_at.getTime()) / 1000;
        let status = "live";
        if (
          row.consecutive_failures >= env.FEED_FAILURE_ALERT_THRESHOLD ||
          age > 300
        ) {
          status = "degraded";
        }
        if (age > 300 && row.consecutive_failures > 0) status = "down";
        if (row.stale) status = status === "live" ? "degraded" : status;
        vehicleFeed = {
          status,
          last_success_at: row.last_success_at.toISOString(),
          consecutive_failures: row.consecutive_failures,
          stale: row.stale,
        };
      }
    } catch {
      vehicleFeed = {
        status: "unknown",
        last_success_at: null,
        consecutive_failures: 0,
        stale: false,
      };
    }
  }

  if (!dbOk) {
    return NextResponse.json(
      { status: "error", db: "error", migrations: null, vehicle_feed: null },
      { status: 503 },
    );
  }

  return NextResponse.json({
    status: "ok",
    db: "ok",
    migrations: migrations ?? "none",
    vehicle_feed: vehicleFeed,
  });
}
