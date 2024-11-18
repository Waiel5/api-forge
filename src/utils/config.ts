import { z } from "zod";

// ---------- Schema for env-based config ----------

const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  JWT_SECRET: z.string().min(16).optional(),
  JWT_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  CORS_ORIGIN: z.string().default("*"),
  TRUST_PROXY: z.coerce.boolean().default(false),
});

export type EnvConfig = z.infer<typeof EnvSchema>;

// ---------- Loader ----------

let _config: EnvConfig | null = null;

/**
 * Load and validate environment variables once, then cache.
 * Pass an explicit record for testing or override purposes.
 */
export function loadConfig(
  env: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >
): EnvConfig {
  if (_config) return _config;

  const result = EnvSchema.safeParse(env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${formatted}`);
  }

  _config = result.data;
  return _config;
}

/**
 * Return cached config or load from process.env.
 */
export function getConfig(): EnvConfig {
  return _config ?? loadConfig();
}

/**
 * Reset cached config (useful in tests).
 */
export function resetConfig(): void {
  _config = null;
}
