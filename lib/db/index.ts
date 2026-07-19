import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";
import { getEnv } from "@/lib/env";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: getEnv().DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    // Avoid the previous 2s query_timeout that killed geometry under load.
    pool.on("connect", (client) => {
      void client.query("SET statement_timeout TO 15000");
    });
  }
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params);
}

export async function withClient<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function checkDb(): Promise<boolean> {
  try {
    await query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

export async function latestMigrationVersion(): Promise<string | null> {
  try {
    const result = await query<{ version: string }>(
      `SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1`,
    );
    return result.rows[0]?.version ?? null;
  } catch {
    return null;
  }
}
