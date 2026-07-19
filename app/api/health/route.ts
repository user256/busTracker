import { NextResponse } from "next/server";
import { checkDb, latestMigrationVersion } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const dbOk = await checkDb();
  const migrations = dbOk ? await latestMigrationVersion() : null;

  if (!dbOk) {
    return NextResponse.json(
      { status: "error", db: "error", migrations: null },
      { status: 503 },
    );
  }

  return NextResponse.json({
    status: "ok",
    db: "ok",
    migrations: migrations ?? "none",
  });
}
