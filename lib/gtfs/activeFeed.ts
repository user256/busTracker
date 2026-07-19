import { query } from "../db";

export type ActiveFeed = {
  feedVersionId: number;
  source: string;
  sha256: string;
  activatedAt: Date | null;
};

/** Currently active GTFS static feed version. Throws if none is active. */
export async function getActiveFeedVersionId(): Promise<number> {
  const feed = await getActiveFeed();
  return feed.feedVersionId;
}

export async function getActiveFeed(): Promise<ActiveFeed> {
  const result = await query<{
    id: string;
    source: string;
    sha256: string;
    activated_at: Date | null;
  }>(
    `SELECT id, source, sha256, activated_at
     FROM feed_versions
     WHERE status = 'active'
     LIMIT 1`,
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error("No active GTFS feed_version — run npm run gtfs:import");
  }
  return {
    feedVersionId: Number(row.id),
    source: row.source,
    sha256: row.sha256,
    activatedAt: row.activated_at,
  };
}

export async function getActiveFeedVersionIdOrNull(): Promise<number | null> {
  try {
    return await getActiveFeedVersionId();
  } catch {
    return null;
  }
}
