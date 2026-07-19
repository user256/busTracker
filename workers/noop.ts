import { config as loadDotenv } from "dotenv";
import { getEnv } from "../lib/env";
import { checkDb } from "../lib/db";

loadDotenv({ quiet: true });

async function main(): Promise<void> {
  const env = getEnv();
  const dbOk = await checkDb();

  console.log(
    JSON.stringify({
      service: "worker",
      role: "noop",
      status: "started",
      nodeEnv: env.NODE_ENV,
      db: dbOk ? "ok" : "error",
      ts: new Date().toISOString(),
    }),
  );

  if (!dbOk) {
    process.exitCode = 1;
  }

  setTimeout(() => process.exit(dbOk ? 0 : 1), 100);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
