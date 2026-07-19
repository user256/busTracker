import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyStyleOverrides,
  isAllowedStadiaUrl,
  prepareClientStyle,
  toProxyPath,
} from "../lib/map/stadiaStyle";

describe("stadiaStyle proxy rewrite", () => {
  it("allows only Stadia tile hosts", () => {
    assert.equal(
      isAllowedStadiaUrl(
        "https://tiles.stadiamaps.com/styles/alidade_smooth.json",
      ),
      true,
    );
    assert.equal(
      isAllowedStadiaUrl("https://evil.example/tiles.stadiamaps.com/x"),
      false,
    );
  });

  it("rewrites tile URLs to same-origin proxy without api_key", () => {
    const path = toProxyPath(
      "https://tiles.stadiamaps.com/data/openmaptiles/{z}/{x}/{y}.pbf?api_key=SECRET",
    );
    assert.equal(
      path,
      "/api/map/stadia/data/openmaptiles/{z}/{x}/{y}.pbf",
    );
    assert.equal(path.includes("api_key"), false);
    assert.equal(path.includes("SECRET"), false);
  });

  it("prepareClientStyle strips keys and applies water desaturation", () => {
    const style = {
      version: 8,
      sources: {
        openmaptiles: {
          type: "vector",
          tiles: [
            "https://tiles.stadiamaps.com/data/openmaptiles/{z}/{x}/{y}.pbf?api_key=SECRET",
          ],
        },
      },
      layers: [
        {
          id: "water",
          type: "fill",
          paint: { "fill-color": "#0000ff" },
        },
      ],
    };
    const out = prepareClientStyle(style, [
      { match: "water", paint: { "fill-color": "#c5d4de" } },
    ]);
    const json = JSON.stringify(out);
    assert.equal(json.includes("SECRET"), false);
    assert.equal(json.includes("api_key"), false);
    assert.match(
      json,
      /\/api\/map\/stadia\/data\/openmaptiles\/\{z\}\/\{x\}\/\{y\}\.pbf/,
    );
    const water = (out.layers as Array<{ paint: { "fill-color": string } }>)[0]!;
    assert.equal(water.paint["fill-color"], "#c5d4de");
  });

  it("applyStyleOverrides matches layer id substrings", () => {
    const style = {
      layers: [
        { id: "waterway-river", type: "line", paint: { "line-color": "#00f" } },
      ],
    };
    const out = applyStyleOverrides(style, [
      { match: "waterway", paint: { "line-color": "#c5d4de" } },
    ]);
    const layer = (out.layers as Array<{ paint: { "line-color": string } }>)[0]!;
    assert.equal(layer.paint["line-color"], "#c5d4de");
  });
});
