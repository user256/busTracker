import type { StyleSpecification } from "maplibre-gl";

/**
 * No-key demo basemap (Ticket 201 follow-up).
 * Used when STADIA_API_KEY is unset so /track keeps working while awaiting Stadia access.
 * Not for production Stage C — swap in Stadia via the origin proxy once the key lands.
 */
export function buildDummyBasemapStyle(): StyleSpecification {
  return {
    version: 8,
    name: "busTracker-dummy-basemap",
    metadata: {
      "bustracker:basemap": "dummy",
      "bustracker:note":
        "Demo raster basemap (Carto Positron). Replace with Stadia when STADIA_API_KEY is set.",
    },
    sources: {
      "dummy-raster": {
        type: "raster",
        tiles: [
          "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
          "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
          "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
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
          // Soften contrast so route green stays salient (ember.to-ish)
          "raster-saturation": -0.35,
          "raster-contrast": -0.15,
          "raster-opacity": 0.92,
        },
      },
    ],
  };
}

export const DUMMY_BASEMAP_ATTRIBUTION = "© OpenStreetMap © CARTO (demo basemap)";
export const STADIA_BASEMAP_ATTRIBUTION =
  "© Stadia Maps © OpenMapTiles © OpenStreetMap";
