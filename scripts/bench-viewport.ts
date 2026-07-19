import { pathToFileURL } from "node:url";
import { config as loadDotenv } from "dotenv";
import { getPool } from "../lib/db";
import { resetEnvCache } from "../lib/env";

loadDotenv({ quiet: true });

const P95_BUDGET_MS = 25;
const ITERATIONS = 40;
const WARMUP = 5;

/** Greater London-ish envelope. */
const ENVELOPE = { west: -0.5, south: 51.3, east: 0.3, north: 51.7 };

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[idx]!;
}

export async function benchViewport(options?: {
  iterations?: number;
  budgetMs?: number;
}): Promise<{ p50: number; p95: number; rows: number; ok: boolean }> {
  resetEnvCache();
  const iterations = options?.iterations ?? ITERATIONS;
  const budgetMs = options?.budgetMs ?? P95_BUDGET_MS;
  const pool = getPool();

  const count = await pool.query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM vehicle_positions_current`,
  );
  const rows = count.rows[0]?.c ?? 0;

  const sql = `
    SELECT vehicle_id, ST_Y(geom::geometry) AS lat, ST_X(geom::geometry) AS lon
    FROM vehicle_positions_current
    WHERE geom::geometry && ST_MakeEnvelope($1, $2, $3, $4, 4326)
      AND ST_Intersects(geom::geometry, ST_MakeEnvelope($1, $2, $3, $4, 4326))
  `;
  const params = [ENVELOPE.west, ENVELOPE.south, ENVELOPE.east, ENVELOPE.north];

  for (let i = 0; i < WARMUP; i++) {
    await pool.query(sql, params);
  }

  const samples: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    await pool.query(sql, params);
    samples.push(performance.now() - t0);
  }
  samples.sort((a, b) => a - b);
  const p50 = percentile(samples, 50);
  const p95 = percentile(samples, 95);
  return { p50, p95, rows, ok: p95 <= budgetMs };
}

async function main(): Promise<void> {
  const result = await benchViewport();
  console.log(
    JSON.stringify(
      {
        ok: result.ok,
        currentVehicles: result.rows,
        p50_ms: Number(result.p50.toFixed(3)),
        p95_ms: Number(result.p95.toFixed(3)),
        budget_ms: P95_BUDGET_MS,
      },
      null,
      2,
    ),
  );
  if (!result.ok) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
