import type { StyleSpecification } from "maplibre-gl";

/**
 * No-key demo basemap. Loads Carto tiles **directly in the browser** (CORS OK).
 * Do not proxy through Next — under load the origin proxy starves the event loop
 * and takes down /api/v1/vehicles + geometry with it.
 */
export function buildDummyBasemapStyle(): StyleSpecification {
  return {
    version: 8,
    name: "busTracker-dummy-basemap",
    metadata: {
      "bustracker:basemap": "dummy",
      "bustracker:note":
        "Demo Carto Positron basemap (browser-direct). Replace with Stadia when STADIA_API_KEY is set.",
    },
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: {
      "dummy-raster": {
        type: "raster",
        tiles: [
          "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
          "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
          "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        ],
        tileSize: 256,
        attribution: "© OpenStreetMap © CARTO",
        maxzoom: 20,
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
  "© OpenStreetMap © CARTO (demo basemap)";
export const STADIA_BASEMAP_ATTRIBUTION =
  "© Stadia Maps © OpenMapTiles © OpenStreetMap";
