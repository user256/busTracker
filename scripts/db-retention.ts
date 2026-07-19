import { pathToFileURL } from "node:url";
import { config as loadDotenv } from "dotenv";
import { getPool } from "../lib/db";
import { resetEnvCache } from "../lib/env";
import { ensureNearTermPartitions } from "../lib/positions/write";

loadDotenv({ quiet: true });

function parseArgs(argv: string[]) {
  let retainDays = 14;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--days" && argv[i + 1]) retainDays = Number(argv[++i]);
    else if (argv[i]?.startsWith("--days=")) {
      retainDays = Number(argv[i].slice("--days=".length));
    }
  }
  if (!Number.isFinite(retainDays) || retainDays < 1) {
    throw new Error("--days must be a positive integer");
  }
  return { retainDays };
}

export async function runRetention(retainDays = 14): Promise<string[]> {
  resetEnvCache();
  await ensureNearTermPartitions(1, 3);
  const result = await getPool().query<{ dropped_partition: string }>(
    `SELECT * FROM drop_expired_vehicle_position_partitions($1)`,
    [retainDays],
  );
  return result.rows.map((r) => r.dropped_partition);
}

async function main(): Promise<void> {
  const { retainDays } = parseArgs(process.argv.slice(2));
  const dropped = await runRetention(retainDays);
  console.log(
    JSON.stringify({ ok: true, retainDays, dropped }, null, 2),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
