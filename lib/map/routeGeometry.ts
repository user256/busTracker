import { query } from "../db";
import { getActiveFeed } from "../gtfs/activeFeed";
import {
  BRAND_ROUTE_GREEN,
  resolveRouteColour,
  simplifyToleranceMetres,
} from "./routeColour";

export type RouteLineProps = {
  kind: "route";
  route_id: string;
  route_short_name: string | null;
  route_colour: string;
  shape_id: string;
};

export type StopPointProps = {
  kind: "stop";
  stop_id: string;
  stop_name: string;
  stop_code: string | null;
};

export type GeometryFeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: RouteLineProps | StopPointProps;
    geometry: GeoJSON.LineString | GeoJSON.Point;
  }>;
};

/**
 * Build simplified, corridor-deduped route lines + stop points for the active feed.
 * Corridor segments are unique undirected edges so shared trunks are not overprinted.
 */
export async function buildRouteNetworkGeometry(zoom: number): Promise<{
  collection: GeometryFeatureCollection;
  feedVersionId: number;
  feedSha256: string;
  toleranceMetres: number;
  lineCount: number;
  stopCount: number;
}> {
  const feed = await getActiveFeed();
  const tolerance = simplifyToleranceMetres(zoom);

  // One representative route per shape, then explode to undirected segments and dedupe.
  const lines = await query<{
    route_id: string;
    route_short_name: string | null;
    route_color: string | null;
    shape_id: string;
    geojson: string;
  }>(
    `WITH shape_routes AS (
       SELECT DISTINCT ON (sg.shape_id)
         sg.shape_id,
         r.route_id,
         r.route_short_name,
         r.route_color,
         ST_Transform(
           ST_SimplifyPreserveTopology(
             ST_Transform(sg.geom::geometry, 3857),
             $2
           ),
           4326
         ) AS geom
       FROM shape_geometries sg
       JOIN trips t
         ON t.feed_version_id = sg.feed_version_id
        AND t.shape_id = sg.shape_id
       JOIN routes r
         ON r.feed_version_id = t.feed_version_id
        AND r.route_id = t.route_id
       WHERE sg.feed_version_id = $1
         AND ST_NPoints(sg.geom::geometry) >= 2
       ORDER BY sg.shape_id, r.route_id
     ),
     segments AS (
       SELECT
         sr.route_id,
         sr.route_short_name,
         sr.route_color,
         sr.shape_id,
         ST_MakeLine(
           ST_PointN(sr.geom, i),
           ST_PointN(sr.geom, i + 1)
         ) AS seg
       FROM shape_routes sr
       CROSS JOIN LATERAL generate_series(1, GREATEST(ST_NPoints(sr.geom) - 1, 0)) AS i
       WHERE sr.geom IS NOT NULL
         AND ST_GeometryType(sr.geom) = 'ST_LineString'
     ),
     deduped AS (
       SELECT DISTINCT ON (edge_key)
         route_id,
         route_short_name,
         route_color,
         shape_id,
         seg
       FROM (
         SELECT
           route_id,
           route_short_name,
           route_color,
           shape_id,
           seg,
           md5(
             ST_AsBinary(
               CASE
                 WHEN ST_X(ST_StartPoint(seg)) < ST_X(ST_EndPoint(seg))
                   OR (
                     ST_X(ST_StartPoint(seg)) = ST_X(ST_EndPoint(seg))
                     AND ST_Y(ST_StartPoint(seg)) <= ST_Y(ST_EndPoint(seg))
                   )
                 THEN seg
                 ELSE ST_Reverse(seg)
               END
             )
           ) AS edge_key
         FROM segments
         WHERE seg IS NOT NULL
           AND NOT ST_IsEmpty(seg)
           AND ST_Length(seg::geography) > 0.5
       ) keyed
       ORDER BY edge_key, route_id
     )
     SELECT
       route_id,
       route_short_name,
       route_color,
       shape_id,
       ST_AsGeoJSON(seg)::text AS geojson
     FROM deduped`,
    [feed.feedVersionId, tolerance],
  );

  const stops = await query<{
    stop_id: string;
    stop_name: string;
    stop_code: string | null;
    lon: number;
    lat: number;
  }>(
    `SELECT stop_id, stop_name, stop_code,
            ST_X(geom::geometry) AS lon,
            ST_Y(geom::geometry) AS lat
     FROM stops
     WHERE feed_version_id = $1
       AND COALESCE(location_type, 0) IN (0, 1)`,
    [feed.feedVersionId],
  );

  const features: GeometryFeatureCollection["features"] = [];

  for (const row of lines.rows) {
    const geometry = JSON.parse(row.geojson) as GeoJSON.LineString;
    if (geometry.type !== "LineString") continue;
    features.push({
      type: "Feature",
      properties: {
        kind: "route",
        route_id: row.route_id,
        route_short_name: row.route_short_name,
        route_colour: resolveRouteColour(row.route_color),
        shape_id: row.shape_id,
      },
      geometry,
    });
  }

  for (const row of stops.rows) {
    features.push({
      type: "Feature",
      properties: {
        kind: "stop",
        stop_id: row.stop_id,
        stop_name: row.stop_name,
        stop_code: row.stop_code,
      },
      geometry: {
        type: "Point",
        coordinates: [Number(row.lon), Number(row.lat)],
      },
    });
  }

  return {
    collection: { type: "FeatureCollection", features },
    feedVersionId: feed.feedVersionId,
    feedSha256: feed.sha256,
    toleranceMetres: tolerance,
    lineCount: lines.rows.length,
    stopCount: stops.rows.length,
  };
}

export { BRAND_ROUTE_GREEN };
