import assert from "node:assert/strict";
import test from "node:test";
import { resetEnvCache } from "../lib/env";
import { migrate } from "../scripts/db-migrate";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://bustracker:bustracker@localhost:55432/bustracker";

test("db migrate applies then no-ops", async (t) => {
  process.env.DATABASE_URL = databaseUrl;
  resetEnvCache();

  let first;
  try {
    first = await migrate();
  } catch (err) {
    t.skip(
      `Postgres not reachable (${databaseUrl}): ${err instanceof Error ? err.message : err}`,
    );
    return;
  }

  assert.ok(Array.isArray(first.applied));
  assert.ok(Array.isArray(first.skipped));

  const second = await migrate();
  assert.equal(second.applied.length, 0);
  assert.ok(second.skipped.length >= 1);
});
