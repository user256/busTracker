import assert from "node:assert/strict";
import test from "node:test";
import { getEnv, resetEnvCache } from "../lib/env";

test("getEnv fails with named missing DATABASE_URL", () => {
  resetEnvCache();
  assert.throws(
    () => getEnv({ NODE_ENV: "test" } as NodeJS.ProcessEnv),
    /DATABASE_URL/,
  );
});

test("getEnv accepts a valid DATABASE_URL", () => {
  resetEnvCache();
  const env = getEnv({
    DATABASE_URL: "postgres://bustracker:bustracker@localhost:55432/bustracker",
    NODE_ENV: "test",
  } as NodeJS.ProcessEnv);
  assert.equal(env.DATABASE_URL.includes("bustracker"), true);
  assert.equal(env.NODE_ENV, "test");
});
