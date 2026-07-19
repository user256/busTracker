import { pathToFileURL } from "node:url";
import { config as loadDotenv } from "dotenv";
import { getPool } from "../lib/db";
import { resetEnvCache } from "../lib/env";

loadDotenv({ quiet: true });

/** Server-side viewport query timing (same shape as /api/v1/vehicles). */
async function main(): Promise<void> {
  resetEnvCache();
  const pool = getPool();
  const sql = `
    SELECT vehicle_id FROM vehicle_positions_servable
    WHERE geom::geometry && ST_MakeEnvelope($1,$2,$3,$4,4326)
      AND EXTRACT(EPOCH FROM (now() - observed_at)) <= 300
  `;
  const params = [-0.5, 51.3, 0.3, 51.7];
  const samples: number[] = [];
  for (let i = 0; i < 40; i++) {
    const t0 = performance.now();
    await pool.query(sql, params);
    samples.push(performance.now() - t0);
  }
  samples.sort((a, b) => a - b);
  const p50 = samples[Math.floor(samples.length * 0.5)]!;
  const p95 = samples[Math.ceil(samples.length * 0.95) - 1]!;
  const p99 = samples[Math.ceil(samples.length * 0.99) - 1]!;
  const ok = p95 <= 150;
  console.log(
    JSON.stringify({
      p50_ms: Number(p50.toFixed(2)),
      p95_ms: Number(p95.toFixed(2)),
      p99_ms: Number(p99.toFixed(2)),
      budget_ms: 150,
      ok,
    }),
  );
  if (!ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
