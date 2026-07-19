-- Ticket 105: quality stats + servable view

CREATE TABLE feed_quality_stats (
  hour_bucket   TIMESTAMPTZ NOT NULL,
  feed_name     TEXT NOT NULL,
  flag          TEXT NOT NULL,
  count         BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (hour_bucket, feed_name, flag)
);

CREATE TABLE vehicle_off_route_streak (
  feed_name     TEXT NOT NULL,
  vehicle_id    TEXT NOT NULL,
  streak        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (feed_name, vehicle_id)
);

-- Servable = current rows that are not missing position / implausible jump.
-- STALE/VERY_STALE are derived at read time; VERY_STALE filtered in API via age.
CREATE OR REPLACE VIEW vehicle_positions_servable AS
SELECT
  c.*,
  CASE
    WHEN (c.quality_flags & 2) <> 0 THEN TRUE
    ELSE FALSE
  END AS has_implausible_jump,
  CASE
    WHEN (c.quality_flags & 64) <> 0 THEN TRUE
    ELSE FALSE
  END AS has_missing_position
FROM vehicle_positions_current c
WHERE (c.quality_flags & 2) = 0   -- IMPLAUSIBLE_JUMP
  AND (c.quality_flags & 64) = 0; -- MISSING_POSITION

COMMENT ON VIEW vehicle_positions_servable IS
  'Only positions safe for passenger APIs. VERY_STALE filtered at read time by age. Consumers must not SELECT vehicle_positions_current directly.';
