/**
 * One-shot poll of the local dummy RT server into Postgres.
 * Requires: DB up, dummy feed imported, `npm run dummy:rt` listening.
 */
import { config } from "dotenv";
config({ quiet: true });

async function main() {
  // Force dummy URLs after dotenv (empty .env keys must not win).
  process.env.GTFS_RT_VEHICLE_POSITIONS_URL =
    "http://127.0.0.1:8099/gtfs-rt/vehicle-positions.pb";
  process.env.GTFS_RT_TRIP_UPDATES_URL =
    "http://127.0.0.1:8099/gtfs-rt/trip-updates.pb";
  process.env.GTFS_RT_FEED_NAME = "dummy-perth-kinross";

  const { getEnv, resetEnvCache } = await import("../../lib/env");
  resetEnvCache();

  const { fetchFeed, upsertFeedHealth } = await import("../../lib/rt/poll");
  const { pollVehiclePositionsOnce } = await import(
    "../../lib/rt/processVehicles"
  );
  const { processTripUpdatesBuffer } = await import(
    "../../lib/rt/processTripUpdates"
  );

  const vp = await pollVehiclePositionsOnce({});
  console.log("vehicle_positions", JSON.stringify(vp.result ?? vp, null, 2));

  const env = getEnv();
  const feedName = `${env.GTFS_RT_FEED_NAME}:tripupdates`;
  const fetched = await fetchFeed(env.GTFS_RT_TRIP_UPDATES_URL!, {});
  if (fetched.kind !== "ok") {
    console.error("trip_updates fetch failed", fetched);
    process.exit(1);
  }
  const tu = await processTripUpdatesBuffer(fetched.body, feedName);
  await upsertFeedHealth({
    feedName,
    success: true,
    entityCount: tu.trips,
    feedTimestamp: new Date(),
  });
  console.log("trip_updates", JSON.stringify(tu, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
