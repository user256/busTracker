import { pathToFileURL } from "node:url";
import { config as loadDotenv } from "dotenv";
import { resetEnvCache } from "../lib/env";
import type { PositionInput } from "../lib/positions/normalize";
import { writePositions } from "../lib/positions/write";

loadDotenv({ quiet: true });

function parseArgs(argv: string[]) {
  let vehicles = 5000;
  let hours = 24;
  let feedName = "seed";
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--vehicles") vehicles = Number(argv[++i]);
    else if (a?.startsWith("--vehicles=")) vehicles = Number(a.slice(11));
    else if (a === "--hours") hours = Number(argv[++i]);
    else if (a?.startsWith("--hours=")) hours = Number(a.slice(8));
    else if (a === "--feed") feedName = argv[++i]!;
  }
  return { vehicles, hours, feedName };
}

/** Synthetic UK-ish positions for viewport benchmarks and Ticket 105 tests. */
export async function seedPositions(options: {
  vehicles: number;
  hours: number;
  feedName?: string;
}): Promise<{ written: number; vehicles: number }> {
  resetEnvCache();
  const feedName = options.feedName ?? "seed";
  const now = Date.now();
  const samplesPerVehicle = Math.max(1, Math.floor(options.hours * 6));
  const batch: PositionInput[] = [];
  let written = 0;

  for (let v = 0; v < options.vehicles; v++) {
    const vehicleId = `V${String(v).padStart(5, "0")}`;
    const baseLat = 51.45 + (v % 100) * 0.001;
    const baseLon = -0.2 + Math.floor(v / 100) * 0.001;

    for (let s = 0; s < samplesPerVehicle; s++) {
      const ageMs = (samplesPerVehicle - 1 - s) * 10 * 60 * 1000;
      const t = new Date(now - ageMs);
      batch.push({
        feedName,
        entityId: vehicleId,
        vehicleId,
        tripId: `T${v % 50}`,
        tripStartDate: t.toISOString().slice(0, 10),
        routeId: `R${v % 20}`,
        lat: baseLat + Math.sin(s / 10) * 0.01,
        lon: baseLon + Math.cos(s / 10) * 0.01,
        bearing: (s * 15) % 360,
        speedMps: 8 + (v % 5),
        entityTimestamp: t,
        recordedAt: t,
      });
    }

    if (batch.length >= 2000) {
      const chunk = batch.splice(0, batch.length);
      await writePositions(chunk);
      written += chunk.length;
    }
  }

  if (batch.length) {
    await writePositions(batch);
    written += batch.length;
  }

  return { written, vehicles: options.vehicles };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const result = await seedPositions(args);
  console.log(JSON.stringify({ ok: true, ...args, ...result }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
