import { randomUUID } from "node:crypto";
import { getEnv } from "../env";
import { query } from "../db";
import { decodeFeedMessage } from "./decode";

export type PollFetchResult =
  | { kind: "ok"; status: number; body: Buffer; etag?: string; lastModified?: string }
  | { kind: "not_modified"; status: 304; etag?: string; lastModified?: string }
  | { kind: "error"; status?: number; error: string };

export type FeedHealthRow = {
  last_feed_timestamp: Date | null;
  consecutive_failures: number;
};

export async function fetchFeed(
  url: string,
  state: { etag?: string; lastModified?: string },
): Promise<PollFetchResult> {
  const env = getEnv();
  const headers: Record<string, string> = {
    Accept: "application/x-protobuf, application/octet-stream, */*",
  };
  if (env.GTFS_FEED_AUTH_HEADER) {
    headers.Authorization = env.GTFS_FEED_AUTH_HEADER;
  }
  if (state.etag) headers["If-None-Match"] = state.etag;
  if (state.lastModified) headers["If-Modified-Since"] = state.lastModified;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timer);
    const etag = res.headers.get("etag") ?? undefined;
    const lastModified = res.headers.get("last-modified") ?? undefined;
    if (res.status === 304) {
      return { kind: "not_modified", status: 304, etag, lastModified };
    }
    if (!res.ok) {
      return {
        kind: "error",
        status: res.status,
        error: `HTTP ${res.status}`,
      };
    }
    const body = Buffer.from(await res.arrayBuffer());
    return { kind: "ok", status: res.status, body, etag, lastModified };
  } catch (err) {
    return {
      kind: "error",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function backoffMs(attempt: number): number {
  const base = Math.min(60_000, 1000 * 2 ** Math.max(0, attempt - 1));
  const jitter = Math.floor(Math.random() * 250);
  return base + jitter;
}

export async function upsertFeedHealth(row: {
  feedName: string;
  success: boolean;
  feedTimestamp?: Date | null;
  entityCount?: number | null;
  error?: string | null;
  httpStatus?: number | null;
  stale?: boolean;
}): Promise<void> {
  await query(
    `INSERT INTO feed_health AS fh (
       feed_name, last_attempt_at, last_success_at, last_feed_timestamp,
       consecutive_failures, entity_count, last_error, last_http_status, stale, updated_at
     ) VALUES (
       $1, now(),
       CASE WHEN $2 THEN now() ELSE NULL END,
       $3,
       CASE WHEN $2 THEN 0 ELSE 1 END,
       $4, $5, $6, COALESCE($7, FALSE), now()
     )
     ON CONFLICT (feed_name) DO UPDATE SET
       last_attempt_at = now(),
       last_success_at = CASE WHEN $2 THEN now() ELSE fh.last_success_at END,
       last_feed_timestamp = COALESCE($3, fh.last_feed_timestamp),
       consecutive_failures = CASE WHEN $2 THEN 0 ELSE fh.consecutive_failures + 1 END,
       entity_count = COALESCE($4, fh.entity_count),
       last_error = $5,
       last_http_status = $6,
       stale = COALESCE($7, FALSE),
       updated_at = now()`,
    [
      row.feedName,
      row.success,
      row.feedTimestamp ?? null,
      row.entityCount ?? null,
      row.error ?? null,
      row.httpStatus ?? null,
      row.stale ?? false,
    ],
  );
}

export async function getFeedHealth(
  feedName: string,
): Promise<FeedHealthRow | null> {
  const r = await query<FeedHealthRow>(
    `SELECT last_feed_timestamp, consecutive_failures FROM feed_health WHERE feed_name = $1`,
    [feedName],
  );
  return r.rows[0] ?? null;
}

export function newPollId(): string {
  return randomUUID();
}

export { decodeFeedMessage };
