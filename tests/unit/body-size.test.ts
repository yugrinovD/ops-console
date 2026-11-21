import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/server/app-error";
import { assertJsonBodySize, MAX_JSON_BODY_BYTES } from "@/lib/server/http";

function requestWithLength(value?: string) {
  return {
    headers: new Headers(
      value === undefined ? {} : { "content-length": value },
    ),
  } as Request;
}

describe("JSON body size guard", () => {
  it("accepts requests without a declared length and within the limit", () => {
    expect(() => assertJsonBodySize(requestWithLength())).not.toThrow();
    expect(() =>
      assertJsonBodySize(requestWithLength(String(MAX_JSON_BODY_BYTES))),
    ).not.toThrow();
  });

  it("rejects oversized and malformed lengths", () => {
    expect(() =>
      assertJsonBodySize(requestWithLength(String(MAX_JSON_BODY_BYTES + 1))),
    ).toThrow(AppError);
    expect(() => assertJsonBodySize(requestWithLength("nope"))).toThrow(
      AppError,
    );
  });
});
