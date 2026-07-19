import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { gzipSync } from "node:zlib";
import { config as loadDotenv } from "dotenv";
import { resetEnvCache } from "../lib/env";
import { buildRouteNetworkGeometry } from "../lib/map/routeGeometry";
import { migrate } from "../scripts/db-migrate";
import { importGtfs } from "../scripts/gtfs-import";

loadDotenv({ quiet: true });

const fixture = path.join(process.cwd(), "fixtures", "gtfs-static-mini.zip");

test("route geometry: deduped lines + stops under 300KB gzip", async (t) => {
  process.env.DATABASE_URL ??=
    "postgres://bustracker:bustracker@localhost:55432/bustracker";
  resetEnvCache();

  try {
    await migrate();
  } catch (err) {
    t.skip(`Postgres not reachable: ${err instanceof Error ? err.message : err}`);
    return;
  }

  await importGtfs({ source: fixture, force: true });

  const built = await buildRouteNetworkGeometry(11);
  assert.ok(built.lineCount > 0, "expected route line segments");
  assert.ok(built.stopCount > 0, "expected stops");

  const routeFeatures = built.collection.features.filter(
    (f) => f.properties.kind === "route",
  );
  assert.equal(routeFeatures.length, built.lineCount);
  for (const f of routeFeatures) {
    assert.equal(f.geometry.type, "LineString");
    assert.equal(f.properties.kind, "route");
    if (f.properties.kind !== "route") continue;
    assert.ok(f.properties.route_id);
    assert.ok(f.properties.route_colour.startsWith("#"));
  }

  const body = JSON.stringify(built.collection);
  const gz = gzipSync(Buffer.from(body, "utf8"));
  assert.ok(
    gz.byteLength <= 300_000,
    `gzipped payload ${gz.byteLength} exceeds 300KB budget`,
  );
});
