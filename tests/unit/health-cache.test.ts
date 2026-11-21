import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnvForTests } from "@/lib/server/env";
import {
  getHealthSnapshot,
  resetHealthCacheForTests,
} from "@/lib/server/health";
import { getHealth } from "@/lib/server/gogate";
import { lmlogHealth } from "@/lib/server/lmlog";

vi.mock("@/lib/server/gogate", () => ({
  getHealth: vi.fn(async () => ({ version: "dev", providers: [] })),
}));
vi.mock("@/lib/server/lmlog", () => ({
  lmlogHealth: vi.fn(async () => ({
    ok: true,
    llmEnabled: true,
    llmAvailable: true,
  })),
}));
vi.mock("@/lib/server/prometheus", () => ({
  prometheusHealthy: vi.fn(async () => true),
}));
vi.mock("@/lib/server/jaeger", () => ({
  jaegerHealthy: vi.fn(async () => true),
}));

beforeEach(() => {
  process.env.CONSOLE_AUTH_TOKEN = "test-admin-token";
  process.env.GOGATE_ADMIN_URL = "http://gogate:9090";
  process.env.GOGATE_ADMIN_TOKEN = "admin";
  process.env.LMLOG_API_URL = "http://lmlog:8090";
  process.env.LMLOG_API_TOKEN = "lmlog";
  process.env.PROMETHEUS_URL = "http://prometheus:9090";
  process.env.GOGATE_JAEGER_URL = "http://jaeger:16686";
  resetEnvForTests();
  resetHealthCacheForTests();
  vi.clearAllMocks();
});

describe("health snapshot", () => {
  it("caches the snapshot for a short period", async () => {
    const first = await getHealthSnapshot("req-1");
    const second = await getHealthSnapshot("req-2");

    expect(first).toEqual(second);
    expect(getHealth).toHaveBeenCalledTimes(1);
    expect(lmlogHealth).toHaveBeenCalledTimes(1);
  });

  it("reports lmlog AI degradation without marking lmlog down", async () => {
    vi.mocked(lmlogHealth).mockResolvedValueOnce({
      ok: true,
      llmEnabled: true,
      llmAvailable: false,
    });

    const snapshot = await getHealthSnapshot();
    const lmlog = snapshot.services.find((service) => service.name === "lmlog");

    expect(snapshot.status).toBe("ok");
    expect(lmlog?.state).toBe("ok");
    expect(lmlog?.detail).toMatch(/heuristic/);
  });
});
