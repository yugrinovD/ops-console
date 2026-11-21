import "server-only";
import pino from "pino";

let logger: pino.Logger | null = null;

export function getLogger() {
  if (logger) return logger;
  const level = process.env.CONSOLE_LOG_LEVEL ?? "info";
  logger = pino({
    level,
    base: { service: "ops-console" },
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "res.headers['set-cookie']",
        "*.token",
        "*.secret",
        "*.password",
        "*.apiKey",
        "*.authorization",
      ],
      censor: "[redacted]",
    },
    formatters: {
      level: (label) => ({ level: label }),
    },
  });
  return logger;
}

export function logUpstreamError(
  service: string,
  error: unknown,
  context: Record<string, unknown> = {},
) {
  getLogger().warn(
    {
      event: "upstream_error",
      service,
      error: error instanceof Error ? error.message : String(error),
      ...context,
    },
    "upstream request failed",
  );
}
