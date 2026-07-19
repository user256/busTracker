-- Ticket 107: TripUpdates store

CREATE TABLE trip_updates_current (
  feed_name              TEXT NOT NULL,
  trip_instance_key      TEXT NOT NULL,
  feed_version_id        BIGINT REFERENCES feed_versions(id),
  trip_id                TEXT NOT NULL,
  start_date             DATE,
  start_time             TEXT,
  route_id               TEXT,
  direction_id           INTEGER,
  schedule_relationship  TEXT,
  entity_timestamp       TIMESTAMPTZ,
  header_timestamp       TIMESTAMPTZ,
  observed_at            TIMESTAMPTZ NOT NULL,
  recorded_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  quality_reason         TEXT,
  PRIMARY KEY (feed_name, trip_instance_key)
);

CREATE TABLE stop_time_updates_current (
  feed_name              TEXT NOT NULL,
  trip_instance_key      TEXT NOT NULL,
  stop_sequence          INTEGER NOT NULL,
  stop_id                TEXT,
  arrival_time           TIMESTAMPTZ,
  arrival_delay          INTEGER,
  arrival_uncertainty    INTEGER,
  departure_time         TIMESTAMPTZ,
  departure_delay        INTEGER,
  departure_uncertainty  INTEGER,
  schedule_relationship  TEXT,
  PRIMARY KEY (feed_name, trip_instance_key, stop_sequence),
  FOREIGN KEY (feed_name, trip_instance_key)
    REFERENCES trip_updates_current (feed_name, trip_instance_key) ON DELETE CASCADE
);

CREATE INDEX stop_time_updates_stop_idx
  ON stop_time_updates_current (feed_name, stop_id);

COMMENT ON TABLE trip_updates_current IS
  'Latest TripUpdate per trip-instance key. Estimates are never guarantees.';
COMMENT ON COLUMN trip_updates_current.trip_instance_key IS
  'Canonical key: trip_id|start_date|start_time (or route/direction/start when trip_id alone is ambiguous).';
