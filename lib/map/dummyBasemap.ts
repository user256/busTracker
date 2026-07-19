import type { StyleSpecification } from "maplibre-gl";

/**
 * No-key demo basemap (Ticket 201 follow-up).
 * Raster tiles are fetched via same-origin `/api/map/raster/...` so ad-blockers /
 * CSP cannot blank the map the way third-party Carto URLs sometimes do.
 */
export function buildDummyBasemapStyle(): StyleSpecification {
  return {
    version: 8,
    name: "busTracker-dummy-basemap",
    metadata: {
      "bustracker:basemap": "dummy",
      "bustracker:note":
        "Demo raster basemap (OSM via origin proxy). Replace with Stadia when STADIA_API_KEY is set.",
    },
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: {
      "dummy-raster": {
        type: "raster",
        tiles: ["/api/map/raster/{z}/{x}/{y}"],
        tileSize: 256,
        attribution: "© OpenStreetMap contributors",
        maxzoom: 19,
      },
    },
    layers: [
      {
        id: "dummy-background",
        type: "background",
        paint: { "background-color": "#e8ebe6" },
      },
      {
        id: "dummy-raster",
        type: "raster",
        source: "dummy-raster",
        paint: {
          "raster-saturation": -0.25,
          "raster-contrast": -0.1,
          "raster-opacity": 1,
        },
      },
    ],
  };
}

export const DUMMY_BASEMAP_ATTRIBUTION =
  "© OpenStreetMap contributors (demo basemap)";
export const STADIA_BASEMAP_ATTRIBUTION =
  "© Stadia Maps © OpenMapTiles © OpenStreetMap";
