-- Ticket 102: GTFS static schema (versioned by feed_versions)

CREATE TABLE feed_versions (
  id              BIGSERIAL PRIMARY KEY,
  source          TEXT NOT NULL,
  sha256          TEXT NOT NULL,
  feed_start_date DATE,
  feed_end_date   DATE,
  row_counts      JSONB NOT NULL DEFAULT '{}'::jsonb,
  capabilities    JSONB NOT NULL DEFAULT '{}'::jsonb,
  load_duration_ms INTEGER,
  status          TEXT NOT NULL DEFAULT 'loading'
                  CHECK (status IN ('loading', 'active', 'failed', 'superseded')),
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at    TIMESTAMPTZ
);

CREATE UNIQUE INDEX feed_versions_one_active
  ON feed_versions ((status))
  WHERE status = 'active';

CREATE TABLE gtfs_import_rejects (
  id              BIGSERIAL PRIMARY KEY,
  feed_version_id BIGINT NOT NULL REFERENCES feed_versions(id) ON DELETE CASCADE,
  file_name       TEXT NOT NULL,
  line_number     INTEGER,
  reason          TEXT NOT NULL,
  raw_row         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX gtfs_import_rejects_feed_idx ON gtfs_import_rejects (feed_version_id);

CREATE TABLE agency (
  feed_version_id BIGINT NOT NULL REFERENCES feed_versions(id) ON DELETE CASCADE,
  agency_id       TEXT NOT NULL,
  agency_name     TEXT NOT NULL,
  agency_url      TEXT,
  agency_timezone TEXT NOT NULL,
  agency_lang     TEXT,
  agency_phone    TEXT,
  PRIMARY KEY (feed_version_id, agency_id)
);

CREATE TABLE routes (
  feed_version_id   BIGINT NOT NULL REFERENCES feed_versions(id) ON DELETE CASCADE,
  route_id          TEXT NOT NULL,
  agency_id         TEXT,
  route_short_name  TEXT,
  route_long_name   TEXT,
  route_desc        TEXT,
  route_type        INTEGER NOT NULL,
  route_url         TEXT,
  route_color       TEXT,
  route_text_color  TEXT,
  PRIMARY KEY (feed_version_id, route_id),
  FOREIGN KEY (feed_version_id, agency_id)
    REFERENCES agency (feed_version_id, agency_id)
);

CREATE TABLE stops (
  feed_version_id      BIGINT NOT NULL REFERENCES feed_versions(id) ON DELETE CASCADE,
  stop_id              TEXT NOT NULL,
  stop_code            TEXT,
  stop_name            TEXT NOT NULL,
  stop_desc            TEXT,
  stop_lat             DOUBLE PRECISION NOT NULL,
  stop_lon             DOUBLE PRECISION NOT NULL,
  zone_id              TEXT,
  stop_url             TEXT,
  location_type        INTEGER,
  parent_station       TEXT,
  wheelchair_boarding  INTEGER,
  geom                 geography(Point, 4326) NOT NULL,
  PRIMARY KEY (feed_version_id, stop_id)
);

CREATE INDEX stops_geom_gix ON stops USING GIST (geom);

CREATE TABLE calendar (
  feed_version_id BIGINT NOT NULL REFERENCES feed_versions(id) ON DELETE CASCADE,
  service_id      TEXT NOT NULL,
  monday          BOOLEAN NOT NULL,
  tuesday         BOOLEAN NOT NULL,
  wednesday       BOOLEAN NOT NULL,
  thursday        BOOLEAN NOT NULL,
  friday          BOOLEAN NOT NULL,
  saturday        BOOLEAN NOT NULL,
  sunday          BOOLEAN NOT NULL,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  PRIMARY KEY (feed_version_id, service_id)
);

CREATE TABLE calendar_dates (
  feed_version_id BIGINT NOT NULL REFERENCES feed_versions(id) ON DELETE CASCADE,
  service_id      TEXT NOT NULL,
  date            DATE NOT NULL,
  exception_type  INTEGER NOT NULL,
  PRIMARY KEY (feed_version_id, service_id, date)
);

CREATE TABLE shapes (
  feed_version_id    BIGINT NOT NULL REFERENCES feed_versions(id) ON DELETE CASCADE,
  shape_id           TEXT NOT NULL,
  shape_pt_lat       DOUBLE PRECISION NOT NULL,
  shape_pt_lon       DOUBLE PRECISION NOT NULL,
  shape_pt_sequence  INTEGER NOT NULL,
  shape_dist_traveled DOUBLE PRECISION,
  PRIMARY KEY (feed_version_id, shape_id, shape_pt_sequence)
);

CREATE TABLE shape_geometries (
  feed_version_id BIGINT NOT NULL REFERENCES feed_versions(id) ON DELETE CASCADE,
  shape_id        TEXT NOT NULL,
  geom            geography(LineString, 4326) NOT NULL,
  PRIMARY KEY (feed_version_id, shape_id)
);

CREATE INDEX shape_geometries_geom_gix ON shape_geometries USING GIST (geom);

CREATE TABLE trips (
  feed_version_id BIGINT NOT NULL REFERENCES feed_versions(id) ON DELETE CASCADE,
  route_id        TEXT NOT NULL,
  service_id      TEXT NOT NULL,
  trip_id         TEXT NOT NULL,
  trip_headsign   TEXT,
  trip_short_name TEXT,
  direction_id    INTEGER,
  block_id        TEXT,
  shape_id        TEXT,
  wheelchair_accessible INTEGER,
  bikes_allowed   INTEGER,
  PRIMARY KEY (feed_version_id, trip_id),
  FOREIGN KEY (feed_version_id, route_id)
    REFERENCES routes (feed_version_id, route_id)
);

CREATE INDEX trips_route_idx ON trips (feed_version_id, route_id);
CREATE INDEX trips_shape_idx ON trips (feed_version_id, shape_id);

CREATE TABLE stop_times (
  feed_version_id BIGINT NOT NULL REFERENCES feed_versions(id) ON DELETE CASCADE,
  trip_id         TEXT NOT NULL,
  arrival_time    INTEGER NOT NULL,
  departure_time  INTEGER NOT NULL,
  stop_id         TEXT NOT NULL,
  stop_sequence   INTEGER NOT NULL,
  stop_headsign   TEXT,
  pickup_type     INTEGER,
  drop_off_type   INTEGER,
  shape_dist_traveled DOUBLE PRECISION,
  timepoint       INTEGER,
  PRIMARY KEY (feed_version_id, trip_id, stop_sequence),
  FOREIGN KEY (feed_version_id, trip_id)
    REFERENCES trips (feed_version_id, trip_id),
  FOREIGN KEY (feed_version_id, stop_id)
    REFERENCES stops (feed_version_id, stop_id)
);

CREATE INDEX stop_times_stop_idx ON stop_times (feed_version_id, stop_id);

CREATE TABLE transfers (
  feed_version_id   BIGINT NOT NULL REFERENCES feed_versions(id) ON DELETE CASCADE,
  from_stop_id      TEXT NOT NULL,
  to_stop_id        TEXT NOT NULL,
  transfer_type     INTEGER NOT NULL,
  min_transfer_time INTEGER,
  PRIMARY KEY (feed_version_id, from_stop_id, to_stop_id, transfer_type),
  FOREIGN KEY (feed_version_id, from_stop_id)
    REFERENCES stops (feed_version_id, stop_id),
  FOREIGN KEY (feed_version_id, to_stop_id)
    REFERENCES stops (feed_version_id, stop_id)
);

CREATE TABLE frequencies (
  feed_version_id BIGINT NOT NULL REFERENCES feed_versions(id) ON DELETE CASCADE,
  trip_id         TEXT NOT NULL,
  start_time      INTEGER NOT NULL,
  end_time        INTEGER NOT NULL,
  headway_secs    INTEGER NOT NULL,
  exact_times     INTEGER,
  PRIMARY KEY (feed_version_id, trip_id, start_time),
  FOREIGN KEY (feed_version_id, trip_id)
    REFERENCES trips (feed_version_id, trip_id)
);
