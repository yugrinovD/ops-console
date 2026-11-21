import "server-only";
import { z } from "zod";

const booleanish = z
  .union([z.boolean(), z.string()])
  .transform((value) => value === true || value === "true" || value === "1");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  CONSOLE_AUTH_TOKEN: z.string().min(1),
  CONSOLE_VIEWER_TOKEN: z.string().optional(),
  CONSOLE_SESSION_SECRET: z.string().optional(),
  CONSOLE_ORIGIN: z.string().url().default("http://localhost:3100"),
  CONSOLE_COOKIE_SECURE: booleanish.default(false),
  CONSOLE_DATA_DIR: z.string().default("./data"),
  CONSOLE_LOG_LEVEL: z.string().default("info"),
  GOGATE_ADMIN_URL: z.string().url().optional(),
  GOGATE_ADMIN_TOKEN: z.string().optional(),
  GOGATE_PUBLIC_URL: z.string().url().optional(),
  GOGATE_PLAYGROUND_API_KEY: z.string().optional(),
  GOGATE_JAEGER_URL: z.string().url().optional(),
  GOGATE_JAEGER_PUBLIC_URL: z.string().url().optional(),
  GOGATE_JAEGER_SERVICE: z.string().default("gogate"),
  PROMETHEUS_URL: z.string().url().optional(),
  PROMETHEUS_BEARER_TOKEN: z.string().optional(),
  JAEGER_BEARER_TOKEN: z.string().optional(),
  LMLOG_API_URL: z.string().url().optional(),
  LMLOG_API_TOKEN: z.string().optional(),
  LMLOG_MAX_UPLOAD_MB: z.coerce.number().positive().default(50),
});

export type ServerEnv = z.infer<typeof envSchema>;

let cached: ServerEnv | null = null;

export function getEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid server environment: ${details}`);
  }
  cached = parsed.data;
  return cached;
}

export function resetEnvForTests() {
  cached = null;
}

export function isGogateAdminConfigured() {
  const env = getEnv();
  return Boolean(env.GOGATE_ADMIN_URL && env.GOGATE_ADMIN_TOKEN);
}

export function isGogatePublicConfigured() {
  const env = getEnv();
  return Boolean(env.GOGATE_PUBLIC_URL && env.GOGATE_PLAYGROUND_API_KEY);
}

export function isPrometheusConfigured() {
  return Boolean(getEnv().PROMETHEUS_URL);
}

export function isLmlogConfigured() {
  const env = getEnv();
  return Boolean(env.LMLOG_API_URL && env.LMLOG_API_TOKEN);
}

export function isJaegerConfigured() {
  return Boolean(getEnv().GOGATE_JAEGER_URL);
}

export function cookieSecure() {
  const env = getEnv();
  return env.CONSOLE_COOKIE_SECURE || env.CONSOLE_ORIGIN.startsWith("https://");
}
