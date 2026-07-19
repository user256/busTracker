-- Ticket 103 follow-up: geometry expression index for fast viewport bbox filters.
-- Rows remain geography(Point,4326); map reads cast to geometry for envelope tests.

CREATE INDEX IF NOT EXISTS vehicle_positions_current_geom_geometry_gix
  ON vehicle_positions_current USING GIST ((geom::geometry));
