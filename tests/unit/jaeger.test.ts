import { beforeEach, describe, expect, it } from "vitest";
import { resetEnvForTests } from "@/lib/server/env";
import { jaegerSearchUrl, jaegerUiUrl } from "@/lib/server/jaeger";

const traceId = "0123456789abcdef0123456789abcdef";

beforeEach(() => {
  process.env.CONSOLE_AUTH_TOKEN = "test-admin-token";
  process.env.GOGATE_JAEGER_URL = "http://jaeger:16686";
  process.env.GOGATE_JAEGER_SERVICE = "gogate";
  delete process.env.GOGATE_JAEGER_PUBLIC_URL;
  resetEnvForTests();
});

describe("Jaeger links", () => {
  it("uses the public URL for browser links", () => {
    process.env.GOGATE_JAEGER_PUBLIC_URL = "http://localhost:16686";
    resetEnvForTests();

    expect(jaegerUiUrl(traceId)).toBe(`http://localhost:16686/trace/${traceId}`);
    expect(jaegerSearchUrl(new Date(0), new Date(1000))).toBe(
      "http://localhost:16686/search?service=gogate&start=0&end=1&limit=20",
    );
  });

  it("falls back to the server URL when no public URL is configured", () => {
    expect(jaegerUiUrl(traceId)).toBe(`http://jaeger:16686/trace/${traceId}`);
  });
});
