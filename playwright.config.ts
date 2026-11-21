import os from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const appEnv = {
  CONSOLE_AUTH_TOKEN: "e2e-admin-token",
  CONSOLE_VIEWER_TOKEN: "e2e-viewer-token",
  CONSOLE_SESSION_SECRET: "e2e-session-secret",
  CONSOLE_ORIGIN: "http://127.0.0.1:3101",
  CONSOLE_COOKIE_SECURE: "false",
  CONSOLE_DATA_DIR: path.join(os.tmpdir(), "ops-console-e2e-data"),
  CONSOLE_LOG_LEVEL: "warn",
  GOGATE_ADMIN_URL: "http://127.0.0.1:9910/gogate",
  GOGATE_ADMIN_TOKEN: "e2e-gogate-admin",
  GOGATE_PUBLIC_URL: "http://127.0.0.1:9910/gogate",
  GOGATE_PLAYGROUND_API_KEY: "e2e-playground-key",
  GOGATE_JAEGER_URL: "http://127.0.0.1:9910/jaeger",
  GOGATE_JAEGER_SERVICE: "gogate",
  PROMETHEUS_URL: "http://127.0.0.1:9910/prometheus",
  LMLOG_API_URL: "http://127.0.0.1:9910/lmlog",
  LMLOG_API_TOKEN: "e2e-lmlog-token",
  LMLOG_MAX_UPLOAD_MB: "50",
  NEXT_TELEMETRY_DISABLED: "1",
};

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "test-results",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3101",
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "node scripts/mock-upstreams.mjs",
      url: "http://127.0.0.1:9910/healthz",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: {
        MOCK_PORT: "9910",
        MOCK_ADMIN_TOKEN: "e2e-gogate-admin",
        MOCK_PLAYGROUND_KEY: "e2e-playground-key",
        MOCK_LMLOG_TOKEN: "e2e-lmlog-token",
      },
    },
    {
      command: "npx next start -p 3101",
      url: "http://127.0.0.1:3101/login",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: appEnv,
    },
  ],
});
