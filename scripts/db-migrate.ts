import { pathToFileURL } from "node:url";
import fs from "node:fs";
import path from "node:path";
import { config as loadDotenv } from "dotenv";
import { Pool } from "pg";
import { getEnv, resetEnvCache } from "../lib/env";

loadDotenv({ quiet: true });

export type MigrateResult = {
  applied: string[];
  skipped: string[];
};

export async function migrate(
  migrationsDir = path.join(process.cwd(), "db", "migrations"),
  connectionString?: string,
): Promise<MigrateResult> {
  const url = connectionString ?? getEnv().DATABASE_URL;
  const pool = new Pool({ connectionString: url });
  const applied: string[] = [];
  const skipped: string[] = [];

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const version = file.replace(/\.sql$/, "");
      const existing = await pool.query(
        `SELECT 1 FROM schema_migrations WHERE version = $1`,
        [version],
      );
      if (existing.rowCount && existing.rowCount > 0) {
        skipped.push(version);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query(
          `INSERT INTO schema_migrations (version) VALUES ($1)`,
          [version],
        );
        await client.query("COMMIT");
        applied.push(version);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    }

    return { applied, skipped };
  } finally {
    await pool.end();
  }
}

async function main(): Promise<void> {
  resetEnvCache();
  const result = await migrate();
  console.log(
    JSON.stringify({
      ok: true,
      applied: result.applied,
      skipped: result.skipped,
    }),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
