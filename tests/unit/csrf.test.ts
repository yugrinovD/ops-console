import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { AppError } from "@/lib/server/app-error";
import { assertCsrf, assertSameOrigin } from "@/lib/server/csrf";
import { resetEnvForTests } from "@/lib/server/env";

beforeEach(() => {
  process.env.CONSOLE_AUTH_TOKEN = "test-admin-token";
  process.env.CONSOLE_ORIGIN = "http://localhost:3100";
  resetEnvForTests();
});

function request(headers: Record<string, string>, method = "POST") {
  return new NextRequest("http://localhost:3100/api/test", { method, headers });
}

describe("CSRF and origin checks", () => {
  it("accepts a same-origin mutation", () => {
    expect(() =>
      assertSameOrigin(
        request({
          origin: "http://localhost:3100",
          "sec-fetch-site": "same-origin",
        }),
      ),
    ).not.toThrow();
  });

  it("rejects missing and foreign origins", () => {
    expect(() => assertSameOrigin(request({}))).toThrow(AppError);
    expect(() =>
      assertSameOrigin(request({ origin: "https://evil.example" })),
    ).toThrow(/Origin/);
  });

  it("rejects cross-site fetch metadata", () => {
    expect(() =>
      assertSameOrigin(
        request({
          origin: "http://localhost:3100",
          "sec-fetch-site": "cross-site",
        }),
      ),
    ).toThrow(/Кросс-сайтовые/);
  });

  it("requires a matching double-submit token", () => {
    expect(() =>
      assertCsrf(
        request({
          origin: "http://localhost:3100",
          cookie: "console_csrf=abc",
          "x-csrf-token": "abc",
        }),
      ),
    ).not.toThrow();
    expect(() =>
      assertCsrf(
        request({
          origin: "http://localhost:3100",
          cookie: "console_csrf=abc",
          "x-csrf-token": "xyz",
        }),
      ),
    ).toThrow(/CSRF/);
  });
});
