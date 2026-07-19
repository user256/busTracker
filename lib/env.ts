import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  LOG_LEVEL: z
    .enum(["DEBUG", "INFO", "WARNING", "ERROR"])
    .default("INFO"),
  STADIA_API_KEY: z.string().optional().default(""),
  GTFS_RT_VEHICLE_POSITIONS_URL: z.string().optional().default(""),
  GTFS_RT_TRIP_UPDATES_URL: z.string().optional().default(""),
  GTFS_FEED_AUTH_HEADER: z.string().optional().default(""),
  GTFS_RT_FEED_NAME: z.string().optional().default("default"),
  POLL_INTERVAL_MS: z.coerce.number().int().positive().default(10_000),
  FEED_FAILURE_ALERT_THRESHOLD: z.coerce.number().int().positive().default(6),
  FEED_STALE_SECONDS: z.coerce.number().int().positive().default(120),
  QUALITY_STALE_SECONDS: z.coerce.number().int().positive().default(60),
  QUALITY_VERY_STALE_SECONDS: z.coerce.number().int().positive().default(300),
  QUALITY_OFF_ROUTE_METRES: z.coerce.number().positive().default(150),
  QUALITY_OFF_ROUTE_CONSECUTIVE: z.coerce.number().int().positive().default(3),
  QUALITY_TRIP_ENDED_MINUTES: z.coerce.number().int().positive().default(30),
  QUALITY_MAX_SPEED_MPS: z.coerce.number().positive().default(40),
  QUALITY_JUMP_METRES: z.coerce.number().positive().default(2000),
  QUALITY_JUMP_SECONDS: z.coerce.number().positive().default(30),
  QUALITY_BASELINE_GAP_SECONDS: z.coerce.number().positive().default(600),
  ARRIVAL_STALE_SECONDS: z.coerce.number().int().positive().default(180),
  MAX_BBOX_SQ_KM: z.coerce.number().positive().default(50_000),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/** Fail fast with a named list of missing/invalid variables. */
export function getEnv(env: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;

  const result = envSchema.safeParse(env);
  if (!result.success) {
    const issues = result.error.issues.map(
      (i) => `${i.path.join(".") || "(root)"}: ${i.message}`,
    );
    throw new Error(
      `Invalid environment configuration:\n- ${issues.join("\n- ")}`,
    );
  }

  cached = result.data;
  return cached;
}

/** Test helper — clears the memoised env. */
export function resetEnvCache(): void {
  cached = null;
}

export function logQualityThresholds(env: Env = getEnv()): void {
  console.log(
    JSON.stringify({
      event: "quality_thresholds",
      QUALITY_STALE_SECONDS: env.QUALITY_STALE_SECONDS,
      QUALITY_VERY_STALE_SECONDS: env.QUALITY_VERY_STALE_SECONDS,
      QUALITY_OFF_ROUTE_METRES: env.QUALITY_OFF_ROUTE_METRES,
      QUALITY_OFF_ROUTE_CONSECUTIVE: env.QUALITY_OFF_ROUTE_CONSECUTIVE,
      QUALITY_TRIP_ENDED_MINUTES: env.QUALITY_TRIP_ENDED_MINUTES,
      QUALITY_MAX_SPEED_MPS: env.QUALITY_MAX_SPEED_MPS,
      QUALITY_JUMP_METRES: env.QUALITY_JUMP_METRES,
      QUALITY_JUMP_SECONDS: env.QUALITY_JUMP_SECONDS,
      QUALITY_BASELINE_GAP_SECONDS: env.QUALITY_BASELINE_GAP_SECONDS,
      ARRIVAL_STALE_SECONDS: env.ARRIVAL_STALE_SECONDS,
    }),
  );
}
