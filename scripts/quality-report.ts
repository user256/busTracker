import { pathToFileURL } from "node:url";
import { config as loadDotenv } from "dotenv";
import { query } from "../lib/db";
import { resetEnvCache } from "../lib/env";

loadDotenv({ quiet: true });

function parseArgs(argv: string[]) {
  let hours = 24;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--hours") hours = Number(argv[++i]);
    else if (argv[i]?.startsWith("--hours=")) hours = Number(argv[i].slice(8));
  }
  return { hours };
}

async function main(): Promise<void> {
  resetEnvCache();
  const { hours } = parseArgs(process.argv.slice(2));
  const since = new Date(Date.now() - hours * 3600 * 1000);

  const totals = await query<{ positions: string; vehicles: string }>(
    `SELECT COUNT(*)::text AS positions,
            COUNT(DISTINCT vehicle_id)::text AS vehicles
     FROM vehicle_positions
     WHERE recorded_at >= $1`,
    [since.toISOString()],
  );

  const flags = await query<{ flag: string; count: string }>(
    `SELECT flag, SUM(count)::text AS count
     FROM feed_quality_stats
     WHERE hour_bucket >= $1
     GROUP BY flag
     ORDER BY flag`,
    [since.toISOString()],
  );

  const pos = Number(totals.rows[0]?.positions ?? 0);
  console.log(`Quality report — last ${hours}h`);
  console.log(`positions=${pos} distinct_vehicles=${totals.rows[0]?.vehicles ?? 0}`);
  console.log("flag\tcount\tpct");
  for (const row of flags.rows) {
    const c = Number(row.count);
    const pct = pos > 0 ? ((c / pos) * 100).toFixed(2) : "0.00";
    console.log(`${row.flag}\t${c}\t${pct}%`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
