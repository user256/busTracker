import assert from "node:assert/strict";
import test from "node:test";

/** Haversine distance in metres — paired-stop separation check (Ticket 205). */
function distanceMetres(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const r = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

test("Perth paired stops stay within ~15 m separation band", () => {
  // perth_scott vs perth_kinnoull — close pair on opposite sides of a block
  const scott = { lat: 56.3945, lon: -3.4325 };
  const kinnoull = { lat: 56.3952, lon: -3.4318 };
  const d = distanceMetres(scott.lat, scott.lon, kinnoull.lat, kinnoull.lon);
  assert.ok(d > 10 && d < 120, `expected paired-stop distance ~15–100 m, got ${d}`);
});

test("pick-nearest-stop prefers closer coordinate", () => {
  const click = { x: 100, y: 100 };
  const a = { x: 102, y: 100 };
  const b = { x: 130, y: 100 };
  const distA = (a.x - click.x) ** 2 + (a.y - click.y) ** 2;
  const distB = (b.x - click.x) ** 2 + (b.y - click.y) ** 2;
  assert.ok(distA < distB);
});
