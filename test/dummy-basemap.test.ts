import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDummyBasemapStyle } from "../lib/map/dummyBasemap";

describe("dummyBasemap", () => {
  it("builds a raster style without Stadia URLs", () => {
    const style = buildDummyBasemapStyle();
    assert.equal(style.version, 8);
    const json = JSON.stringify(style);
    assert.equal(json.includes("stadiamaps"), false);
    assert.equal(json.includes("api_key"), false);
    assert.match(json, /basemaps\.cartocdn\.com\/light_all/);
    assert.equal(
      (style.metadata as { "bustracker:basemap"?: string })?.[
        "bustracker:basemap"
      ],
      "dummy",
    );
  });
});
