import { config as loadDotenv } from "dotenv";
import { getEnv, logQualityThresholds, resetEnvCache } from "../lib/env";
import { backoffMs } from "../lib/rt/poll";
import { pollVehiclePositionsOnce } from "../lib/rt/processVehicles";

loadDotenv({ quiet: true });

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  resetEnvCache();
  const env = getEnv();
  if (!env.GTFS_RT_VEHICLE_POSITIONS_URL) {
    console.error(
      JSON.stringify({
        error: "GTFS_RT_VEHICLE_POSITIONS_URL is required for worker:positions",
      }),
    );
    process.exit(1);
  }

  logQualityThresholds(env);
  console.log(
    JSON.stringify({
      service: "worker",
      role: "positions",
      status: "started",
      feed_name: env.GTFS_RT_FEED_NAME,
      poll_interval_ms: env.POLL_INTERVAL_MS,
    }),
  );

  let state: { etag?: string; lastModified?: string } = {};
  let failures = 0;

  for (;;) {
    try {
      const out = await pollVehiclePositionsOnce(state);
      state = out.state;
      failures = 0;
    } catch (err) {
      failures += 1;
      const wait = backoffMs(failures);
      console.error(
        JSON.stringify({
          level: "error",
          event: "poll_failed",
          attempt: failures,
          backoff_ms: wait,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
      await sleep(wait);
      continue;
    }
    await sleep(env.POLL_INTERVAL_MS);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
