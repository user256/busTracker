import { pathToFileURL } from "node:url";
import { config as loadDotenv } from "dotenv";
import { resetEnvCache } from "../lib/env";
import { validatePosition } from "../lib/quality/validate";
import type { PositionInput } from "../lib/positions/normalize";

loadDotenv({ quiet: true });

async function main(): Promise<void> {
  resetEnvCache();
  const n = 5000;
  const samples: number[] = [];
  const base: PositionInput = {
    feedName: "bench",
    entityId: "e",
    vehicleId: "v0",
    lat: 51.5,
    lon: -0.12,
    entityTimestamp: new Date(),
    tripId: "T1",
  };

  for (let i = 0; i < 30; i++) {
    const batch: PositionInput[] = [];
    for (let v = 0; v < n; v++) {
      batch.push({
        ...base,
        vehicleId: `V${v}`,
        entityId: `E${v}`,
        lat: 51.5 + (v % 100) * 0.0001,
        lon: -0.12 + Math.floor(v / 100) * 0.0001,
      });
    }
    const t0 = performance.now();
    for (const p of batch) {
      await validatePosition(p, null);
    }
    samples.push(performance.now() - t0);
  }
  samples.sort((a, b) => a - b);
  const p95 = samples[Math.ceil(samples.length * 0.95) - 1]!;
  console.log(JSON.stringify({ p95_ms: Number(p95.toFixed(2)), budget_ms: 500, ok: p95 <= 500 }));
  if (p95 > 500) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
