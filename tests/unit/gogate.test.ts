import { describe, expect, it } from "vitest";
import { modelPriceSchema, providerSchema } from "@/lib/schemas/gogate";
import {
  calculateCost,
  providerChain,
  sanitizeProvider,
} from "@/lib/server/gogate";

const rawProvider = providerSchema.parse({
  id: "11111111-1111-4111-8111-111111111111",
  name: "internal-openai",
  kind: "openai_compatible",
  base_url: "https://secret.internal.example/v1",
  api_key_env: "GOGATE_UPSTREAM_SECRET",
  models: ["gpt-test"],
  priority: 5,
  enabled: true,
  timeout_ms: 1000,
  max_retries: 2,
  config: { secret: true },
});

describe("gogate view helpers", () => {
  it("does not leak provider URLs, env names or config", () => {
    const safe = sanitizeProvider(rawProvider);
    expect(safe).toMatchObject({
      name: "internal-openai",
      kind: "openai_compatible",
      models: ["gpt-test"],
    });
    expect("base_url" in safe).toBe(false);
    expect("api_key_env" in safe).toBe(false);
    expect("config" in safe).toBe(false);
  });

  it("orders provider chains by priority", () => {
    const chain = providerChain("gpt-test", [
      { ...sanitizeProvider(rawProvider), priority: 20 },
      {
        ...sanitizeProvider(rawProvider),
        id: "22222222-2222-4222-8222-222222222222",
        name: "first",
        priority: 1,
      },
    ]);
    expect(chain.map((provider) => provider.name)).toEqual(["first", "internal-openai"]);
  });

  it("computes cost from per-million prices", () => {
    const price = modelPriceSchema.parse({
      id: "33333333-3333-4333-8333-333333333333",
      provider: "mock",
      model: "mock",
      input_usd_per_1m: 1,
      output_usd_per_1m: 2,
    });
    const cost = calculateCost([price], "mock", "mock", 1_000_000, 500_000);
    expect(cost).toBe(2);
    expect(calculateCost([], "mock", "mock", 10, 10)).toBeNull();
  });
});
