import { config as loadDotenv } from "dotenv";
import { getEnv, logQualityThresholds, resetEnvCache } from "../lib/env";
import { backoffMs, fetchFeed, newPollId, upsertFeedHealth } from "../lib/rt/poll";
import { processTripUpdatesBuffer } from "../lib/rt/processTripUpdates";

loadDotenv({ quiet: true });

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  resetEnvCache();
  const env = getEnv();
  if (!env.GTFS_RT_TRIP_UPDATES_URL) {
    console.error(
      JSON.stringify({
        error: "GTFS_RT_TRIP_UPDATES_URL is required for worker:tripupdates",
      }),
    );
    process.exit(1);
  }

  logQualityThresholds(env);
  const feedName = `${env.GTFS_RT_FEED_NAME}:tripupdates`;
  console.log(
    JSON.stringify({
      service: "worker",
      role: "tripupdates",
      status: "started",
      feed_name: feedName,
    }),
  );

  let state: { etag?: string; lastModified?: string } = {};
  let failures = 0;

  for (;;) {
    const pollId = newPollId();
    try {
      const fetched = await fetchFeed(env.GTFS_RT_TRIP_UPDATES_URL, state);
      if (fetched.kind === "not_modified") {
        await upsertFeedHealth({
          feedName,
          success: true,
          httpStatus: 304,
        });
        state = {
          etag: fetched.etag ?? state.etag,
          lastModified: fetched.lastModified ?? state.lastModified,
        };
        failures = 0;
      } else if (fetched.kind === "error") {
        throw new Error(fetched.error);
      } else {
        const started = Date.now();
        const result = await processTripUpdatesBuffer(fetched.body, env.GTFS_RT_FEED_NAME);
        await upsertFeedHealth({
          feedName,
          success: true,
          httpStatus: fetched.status,
          entityCount: result.trips,
        });
        console.log(
          JSON.stringify({
            feed_name: feedName,
            poll_id: pollId,
            http_status: fetched.status,
            trips: result.trips,
            stops: result.stops,
            duration_ms: Date.now() - started,
          }),
        );
        state = { etag: fetched.etag, lastModified: fetched.lastModified };
        failures = 0;
      }
    } catch (err) {
      failures += 1;
      await upsertFeedHealth({
        feedName,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
      const wait = backoffMs(failures);
      console.error(
        JSON.stringify({
          level: "error",
          event: "tripupdates_poll_failed",
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
