import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BRAND_ROUTE_GREEN,
  resolveRouteColour,
  simplifyToleranceMetres,
} from "../lib/map/routeColour";

describe("routeColour", () => {
  it("falls back for missing and near-white colours", () => {
    assert.equal(resolveRouteColour(null), BRAND_ROUTE_GREEN);
    assert.equal(resolveRouteColour(""), BRAND_ROUTE_GREEN);
    assert.equal(resolveRouteColour("FFFFFF"), BRAND_ROUTE_GREEN);
    assert.equal(resolveRouteColour("#fefefe"), BRAND_ROUTE_GREEN);
  });

  it("keeps readable GTFS colours", () => {
    assert.equal(resolveRouteColour("0B5FFF"), "#0B5FFF");
    assert.equal(resolveRouteColour("#2F8F5B"), "#2F8F5B");
  });

  it("documents simplify tolerance ladder", () => {
    assert.equal(simplifyToleranceMetres(7), 200);
    assert.equal(simplifyToleranceMetres(10), 75);
    assert.equal(simplifyToleranceMetres(12), 25);
    assert.equal(simplifyToleranceMetres(14), 8);
    assert.equal(simplifyToleranceMetres(16), 2);
  });
});
