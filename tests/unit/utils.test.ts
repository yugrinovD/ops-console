import { describe, expect, it } from "vitest";
import {
  cacheTone,
  formatBytes,
  formatCurrency,
  formatNumber,
  formatPercent,
  percentOf,
  shortId,
  statusTone,
  truncate,
} from "@/lib/utils";

describe("formatting helpers", () => {
  it("formats numbers, percent and currency", () => {
    expect(formatNumber(1234.4)).toContain("1");
    expect(formatPercent(0.125)).toBe("12,5%");
    expect(formatPercent(12.5)).toBe("12,5%");
    expect(formatCurrency(0.0004)).toContain("0,0004");
    expect(formatCurrency(null)).toBe("—");
  });

  it("formats bytes and durations", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(null)).toBe("—");
  });

  it("truncates and shortens ids", () => {
    expect(truncate("abcdefgh", 5)).toBe("abcd…");
    expect(shortId("1234567890", 5)).toBe("12345…");
    expect(shortId("123", 5)).toBe("123");
  });

  it("maps status and cache tones", () => {
    expect(statusTone(200)).toBe("success");
    expect(statusTone(404)).toBe("warning");
    expect(statusTone(503)).toBe("danger");
    expect(cacheTone("HIT")).toBe("success");
    expect(cacheTone("BYPASS")).toBe("warning");
  });

  it("computes clamped percentages", () => {
    expect(percentOf(50, 100)).toBe(50);
    expect(percentOf(150, 100)).toBe(100);
    expect(percentOf(10, 0)).toBe(0);
  });
});
