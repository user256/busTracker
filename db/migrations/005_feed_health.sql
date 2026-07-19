-- Ticket 104: feed health for realtime pollers

CREATE TABLE feed_health (
  feed_name              TEXT PRIMARY KEY,
  last_attempt_at        TIMESTAMPTZ,
  last_success_at        TIMESTAMPTZ,
  last_feed_timestamp    TIMESTAMPTZ,
  consecutive_failures   INTEGER NOT NULL DEFAULT 0,
  entity_count           INTEGER,
  last_error             TEXT,
  last_http_status       INTEGER,
  stale                  BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE feed_health IS
  'Per-feed poller health. last_feed_timestamp is the GTFS-RT header timestamp when known.';
COMMENT ON COLUMN feed_health.stale IS
  'True when HTTP succeeded but header.timestamp has not advanced beyond FEED_STALE_SECONDS.';
