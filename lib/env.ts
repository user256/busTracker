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
