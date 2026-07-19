-- Ticket 103: vehicle position history + current snapshot

-- Quality flag bits (written by 105; column reserved here):
--   bit 0 = MISSING_SOURCE_TIMESTAMP (set by write path when entity/header ts absent)

CREATE TABLE vehicle_positions (
  id                BIGSERIAL,
  feed_version_id   BIGINT REFERENCES feed_versions(id),
  feed_name         TEXT NOT NULL,
  entity_id         TEXT NOT NULL,
  vehicle_id        TEXT NOT NULL,
  trip_id           TEXT,
  trip_start_date   DATE,
  trip_start_time   TEXT,
  route_id          TEXT,
  geom              geography(Point, 4326) NOT NULL,
  bearing           DOUBLE PRECISION,
  speed_mps         DOUBLE PRECISION,
  occupancy_status  TEXT,
  current_status    TEXT,
  stop_id           TEXT,
  entity_timestamp  TIMESTAMPTZ,
  header_timestamp  TIMESTAMPTZ,
  observed_at       TIMESTAMPTZ NOT NULL,
  recorded_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  observation_id    TEXT NOT NULL,
  quality_flags     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (id, recorded_at)
) PARTITION BY RANGE (recorded_at);

-- Idempotency ledger (non-partitioned): partitioned UNIQUE cannot omit recorded_at.
CREATE TABLE vehicle_position_observation_keys (
  feed_name      TEXT NOT NULL,
  observation_id TEXT NOT NULL,
  recorded_at    TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (feed_name, observation_id)
);

CREATE INDEX vehicle_positions_vehicle_recorded_idx
  ON vehicle_positions (feed_name, vehicle_id, recorded_at DESC);

CREATE INDEX vehicle_positions_geom_gix
  ON vehicle_positions USING GIST (geom);

CREATE TABLE vehicle_positions_current (
  feed_name         TEXT NOT NULL,
  vehicle_id        TEXT NOT NULL,
  feed_version_id   BIGINT REFERENCES feed_versions(id),
  entity_id         TEXT NOT NULL,
  trip_id           TEXT,
  trip_start_date   DATE,
  trip_start_time   TEXT,
  route_id          TEXT,
  geom              geography(Point, 4326) NOT NULL,
  bearing           DOUBLE PRECISION,
  speed_mps         DOUBLE PRECISION,
  occupancy_status  TEXT,
  current_status    TEXT,
  stop_id           TEXT,
  entity_timestamp  TIMESTAMPTZ,
  header_timestamp  TIMESTAMPTZ,
  observed_at       TIMESTAMPTZ NOT NULL,
  recorded_at       TIMESTAMPTZ NOT NULL,
  observation_id    TEXT NOT NULL,
  quality_flags     INTEGER NOT NULL DEFAULT 0,
  history_id        BIGINT,
  PRIMARY KEY (feed_name, vehicle_id)
);

CREATE INDEX vehicle_positions_current_geom_gix
  ON vehicle_positions_current USING GIST (geom);

CREATE INDEX vehicle_positions_current_observed_idx
  ON vehicle_positions_current (observed_at DESC);

CREATE INDEX vehicle_positions_current_trip_idx
  ON vehicle_positions_current (feed_name, trip_id, trip_start_date, trip_start_time);

-- Partition helpers ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION ensure_vehicle_positions_partition(p_day date)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  part_name text := format('vehicle_positions_%s', to_char(p_day, 'YYYYMMDD'));
  start_ts  timestamptz := p_day::timestamptz;
  end_ts    timestamptz := (p_day + 1)::timestamptz;
BEGIN
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF vehicle_positions
       FOR VALUES FROM (%L) TO (%L)',
    part_name, start_ts, end_ts
  );
END;
$$;

CREATE OR REPLACE FUNCTION ensure_vehicle_positions_partitions(
  days_back integer DEFAULT 1,
  days_forward integer DEFAULT 2
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  d date;
BEGIN
  FOR d IN SELECT generate_series(
    (CURRENT_DATE - days_back)::timestamp,
    (CURRENT_DATE + days_forward)::timestamp,
    interval '1 day'
  )::date
  LOOP
    PERFORM ensure_vehicle_positions_partition(d);
  END LOOP;
END;
$$;

-- Create near-term partitions now
SELECT ensure_vehicle_positions_partitions(1, 3);

-- Retention: drop daily partitions older than p_retain_days
CREATE OR REPLACE FUNCTION drop_expired_vehicle_position_partitions(
  p_retain_days integer DEFAULT 14
)
RETURNS TABLE(dropped_partition text)
LANGUAGE plpgsql
AS $$
DECLARE
  cutoff date := CURRENT_DATE - p_retain_days;
  r record;
  day date;
BEGIN
  FOR r IN
    SELECT c.relname AS part_name
    FROM pg_inherits i
    JOIN pg_class c ON c.oid = i.inhrelid
    JOIN pg_class p ON p.oid = i.inhparent
    WHERE p.relname = 'vehicle_positions'
  LOOP
    IF r.part_name ~ '^vehicle_positions_[0-9]{8}$' THEN
      day := to_date(substring(r.part_name from 19), 'YYYYMMDD');
      IF day < cutoff THEN
        EXECUTE format('DROP TABLE IF EXISTS %I', r.part_name);
        dropped_partition := r.part_name;
        RETURN NEXT;
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- Comments ------------------------------------------------------------------------

COMMENT ON TABLE vehicle_positions IS
  'Append-only GTFS-RT vehicle position history, partitioned by recorded_at (receipt time).';

COMMENT ON COLUMN vehicle_positions.entity_timestamp IS
  'GTFS-RT VehiclePosition.timestamp (observation time from the entity). Prefer over header_timestamp.';

COMMENT ON COLUMN vehicle_positions.header_timestamp IS
  'GTFS-RT FeedHeader.timestamp. Used when entity_timestamp is absent.';

COMMENT ON COLUMN vehicle_positions.recorded_at IS
  'Server receipt time when we wrote the row. Never treat as the vehicle observation time.';

COMMENT ON COLUMN vehicle_positions.observed_at IS
  'Authoritative observation time: entity_timestamp, else header_timestamp, else recorded_at (with MISSING_SOURCE_TIMESTAMP flag).';

COMMENT ON COLUMN vehicle_positions.observation_id IS
  'Idempotency key within feed_name: entity+source-ts, or content hash when source timestamps are missing. Enforced via vehicle_position_observation_keys.';

COMMENT ON TABLE vehicle_position_observation_keys IS
  'Non-partitioned ledger guaranteeing one history row per (feed_name, observation_id).';

COMMENT ON COLUMN vehicle_positions.trip_id IS
  'GTFS trip_id; join to static trips only via feed_version_id of the active/static snapshot used at ingest.';

COMMENT ON COLUMN vehicle_positions.trip_start_date IS
  'GTFS-RT start_date (service day) for the trip instance.';

COMMENT ON COLUMN vehicle_positions.trip_start_time IS
  'GTFS-RT start_time for the trip instance (may exceed 24:00:00).';

COMMENT ON COLUMN vehicle_positions.feed_version_id IS
  'Static GTFS feed_versions.id this realtime observation was bound to at write time.';

COMMENT ON COLUMN vehicle_positions.speed_mps IS
  'Speed in metres per second (GTFS-RT speed). NULL if absent.';

COMMENT ON COLUMN vehicle_positions.bearing IS
  'Bearing in degrees (0–360), GTFS-RT bearing. NULL if absent.';

COMMENT ON COLUMN vehicle_positions.quality_flags IS
  'Bitmask; bit 0 = MISSING_SOURCE_TIMESTAMP. Further bits owned by Ticket 105.';

COMMENT ON TABLE vehicle_positions_current IS
  'Latest accepted position per (feed_name, vehicle_id). Map viewport reads this table only.';

COMMENT ON COLUMN vehicle_positions_current.observed_at IS
  'Authoritative observation time of the current row (same semantics as vehicle_positions.observed_at).';

COMMENT ON COLUMN vehicle_positions_current.recorded_at IS
  'Receipt time of the current row. Do not use for freshness labelling without also considering observed_at.';

COMMENT ON COLUMN vehicle_positions_current.speed_mps IS
  'Speed in metres per second.';

COMMENT ON COLUMN vehicle_positions_current.bearing IS
  'Bearing in degrees (0–360).';
