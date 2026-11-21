import type { ChatCompletion, ModelPrice, PublicProvider } from "@/lib/schemas/gogate";
import type { DashboardData } from "@/lib/schemas/dashboard";
import type { HealthSnapshot } from "@/lib/schemas/health";

export const providers: PublicProvider[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "mock",
    kind: "mock",
    models: ["mock", "mock-fast"],
    priority: 100,
    enabled: true,
    timeout_ms: 30000,
    max_retries: 1,
    breaker: "closed",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "ollama",
    kind: "ollama",
    models: ["qwen2.5:3b"],
    priority: 10,
    enabled: true,
    timeout_ms: 30000,
    max_retries: 1,
    breaker: "closed",
  },
];

export const prices: ModelPrice[] = [
  {
    id: "33333333-3333-4333-8333-333333333333",
    provider: "mock",
    model: "mock",
    input_usd_per_1m: 0.1,
    output_usd_per_1m: 0.2,
  },
];

export const modelCatalog = {
  models: ["mock", "mock-fast", "qwen2.5:3b"],
  providers,
  prices,
  warnings: [],
};

export const health: HealthSnapshot = {
  status: "ok",
  checkedAt: new Date("2026-01-01T00:00:00Z").toISOString(),
  services: [
    { name: "gogate", label: "gogate", state: "ok", detail: "vdev" },
    { name: "lmlog", label: "lmlog", state: "ok" },
    { name: "prometheus", label: "Prometheus", state: "ok" },
    { name: "jaeger", label: "Jaeger", state: "ok" },
  ],
};

export const chatCompletion: ChatCompletion = {
  id: "chatcmpl-test",
  object: "chat.completion",
  created: 1767225600,
  model: "mock",
  choices: [
    {
      index: 0,
      message: { role: "assistant", content: "Mock response" },
      finish_reason: "stop",
    },
  ],
  usage: { prompt_tokens: 5, completion_tokens: 7, total_tokens: 12 },
};

export const dashboard: DashboardData = {
  range: "24h",
  generatedAt: new Date("2026-01-01T12:00:00Z").toISOString(),
  metricsAvailable: true,
  adminAvailable: true,
  series: [
    {
      ts: 1767268800000,
      rps: 12.5,
      p50: 0.001,
      p95: 0.012,
      p99: 0.02,
      errorRate: 0.01,
      promptTokens: 100,
      completionTokens: 200,
      costUsd: 0.0001,
      cacheHitShare: 0.25,
      rateLimited: 0,
    },
  ],
  totals: {
    requests: 1200,
    rps: 12.5,
    p50: 0.001,
    p95: 0.012,
    p99: 0.02,
    errorRate: 0.01,
    promptTokens: 10_000,
    completionTokens: 20_000,
    costUsd: 0.12,
    cacheHitShare: 0.25,
    rateLimited: 2,
  },
  topModels: [
    {
      model: "mock",
      requests: 1200,
      promptTokens: 10_000,
      completionTokens: 20_000,
      costUsd: 0.12,
      share: 1,
    },
  ],
  topTenants: [
    {
      tenantId: "11111111-1111-4111-8111-111111111111",
      tenantName: "demo",
      requests: 1200,
      tokens: 30_000,
      costUsd: 0.12,
      share: 1,
    },
  ],
  incidents: [],
  warnings: [],
};
