import { getActiveFeedVersionIdOrNull } from "../gtfs/activeFeed";
import { writePositions } from "../positions/write";
import { decodeFeedMessage } from "./decode";
import { mapVehicleEntities } from "./mapVehicle";
import {
  fetchFeed,
  getFeedHealth,
  newPollId,
  upsertFeedHealth,
} from "./poll";
import { getEnv } from "../env";

export type ProcessPositionsResult = {
  pollId: string;
  httpStatus: number | null;
  feedTimestamp: string | null;
  entityCount: number;
  writtenCount: number;
  skippedOlderCount: number;
  durationMs: number;
  stale: boolean;
  error?: string;
};

/** Process one VehiclePositions payload (file or HTTP body). */
export async function processVehiclePositionsBuffer(
  body: Buffer,
  options: {
    feedName: string;
    httpStatus?: number;
    pollId?: string;
  },
): Promise<ProcessPositionsResult> {
  const started = Date.now();
  const pollId = options.pollId ?? newPollId();
  const env = getEnv();

  let feed;
  try {
    feed = decodeFeedMessage(body);
  } catch (err) {
    await upsertFeedHealth({
      feedName: options.feedName,
      success: false,
      error: err instanceof Error ? err.message : String(err),
      httpStatus: options.httpStatus ?? null,
    });
    throw err;
  }

  const prev = await getFeedHealth(options.feedName);
  let stale = false;
  if (feed.headerTimestamp && prev?.last_feed_timestamp) {
    const advanced =
      feed.headerTimestamp.getTime() > prev.last_feed_timestamp.getTime();
    const ageSec =
      (Date.now() - feed.headerTimestamp.getTime()) / 1000;
    if (!advanced && ageSec > env.FEED_STALE_SECONDS) {
      stale = true;
      console.warn(
        JSON.stringify({
          level: "warn",
          event: "feed_stale",
          feed_name: options.feedName,
          feed_timestamp: feed.headerTimestamp.toISOString(),
        }),
      );
    }
  } else if (feed.headerTimestamp) {
    const ageSec = (Date.now() - feed.headerTimestamp.getTime()) / 1000;
    if (ageSec > env.FEED_STALE_SECONDS) stale = true;
  }

  const feedVersionId = await getActiveFeedVersionIdOrNull();
  const { positions } = mapVehicleEntities(feed, {
    feedName: options.feedName,
    feedVersionId,
  });

  const writeStarted = Date.now();
  const result = await writePositions(positions);
  const writeMs = Date.now() - writeStarted;

  await upsertFeedHealth({
    feedName: options.feedName,
    success: true,
    feedTimestamp: feed.headerTimestamp,
    entityCount: positions.length,
    httpStatus: options.httpStatus ?? 200,
    stale,
    error: stale ? "feed_header_stale" : null,
  });

  const out: ProcessPositionsResult = {
    pollId,
    httpStatus: options.httpStatus ?? 200,
    feedTimestamp: feed.headerTimestamp?.toISOString() ?? null,
    entityCount: positions.length,
    writtenCount: result.historyInserted,
    skippedOlderCount: result.historySkipped + result.currentUnchanged,
    durationMs: Date.now() - started,
    stale,
  };

  console.log(
    JSON.stringify({
      feed_name: options.feedName,
      poll_id: pollId,
      http_status: out.httpStatus,
      feed_timestamp: out.feedTimestamp,
      entity_count: out.entityCount,
      written_count: out.writtenCount,
      skipped_older_count: out.skippedOlderCount,
      duration_ms: out.durationMs,
      write_ms: writeMs,
      stale,
    }),
  );

  return out;
}

export async function pollVehiclePositionsOnce(state: {
  etag?: string;
  lastModified?: string;
}): Promise<{
  result?: ProcessPositionsResult;
  state: { etag?: string; lastModified?: string };
  notModified?: boolean;
}> {
  const env = getEnv();
  const url = env.GTFS_RT_VEHICLE_POSITIONS_URL;
  if (!url) throw new Error("GTFS_RT_VEHICLE_POSITIONS_URL is required");
  const feedName = env.GTFS_RT_FEED_NAME;
  const pollId = newPollId();

  const fetched = await fetchFeed(url, state);
  if (fetched.kind === "not_modified") {
    await upsertFeedHealth({
      feedName,
      success: true,
      httpStatus: 304,
      entityCount: 0,
    });
    console.log(
      JSON.stringify({
        feed_name: feedName,
        poll_id: pollId,
        http_status: 304,
        feed_timestamp: null,
        entity_count: 0,
        written_count: 0,
        skipped_older_count: 0,
        duration_ms: 0,
      }),
    );
    return {
      notModified: true,
      state: {
        etag: fetched.etag ?? state.etag,
        lastModified: fetched.lastModified ?? state.lastModified,
      },
    };
  }

  if (fetched.kind === "error") {
    await upsertFeedHealth({
      feedName,
      success: false,
      error: fetched.error,
      httpStatus: fetched.status ?? null,
    });
    const health = await getFeedHealth(feedName);
    const failures = (health?.consecutive_failures ?? 0) + 1;
    if (failures >= env.FEED_FAILURE_ALERT_THRESHOLD) {
      console.error(
        JSON.stringify({
          level: "error",
          event: "feed_failure_threshold",
          feed_name: feedName,
          consecutive_failures: failures,
          error: fetched.error,
        }),
      );
    }
    throw new Error(fetched.error);
  }

  const result = await processVehiclePositionsBuffer(fetched.body, {
    feedName,
    httpStatus: fetched.status,
    pollId,
  });
  return {
    result,
    state: {
      etag: fetched.etag,
      lastModified: fetched.lastModified,
    },
  };
}
