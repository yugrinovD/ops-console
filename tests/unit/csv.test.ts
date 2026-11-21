import { describe, expect, it } from "vitest";
import { downloadName, toCsv } from "@/lib/server/csv";

describe("CSV export", () => {
  it("writes a BOM, header and rows", () => {
    const csv = toCsv(
      [
        { key: "id", label: "id" },
        { key: "name", label: "name" },
      ],
      [{ id: 1, name: "demo" }],
    );
    expect(csv.startsWith("\ufeff")).toBe(true);
    expect(csv).toContain("id,name");
    expect(csv).toContain("1,demo");
  });

  it("escapes quotes, commas and newlines", () => {
    const csv = toCsv(
      [{ key: "value", label: "value" }],
      [{ value: 'a,"b"\nline' }],
    );
    expect(csv).toContain('"a,""b""\nline"');
  });

  it("neutralises spreadsheet formulas", () => {
    const csv = toCsv(
      [{ key: "value", label: "value" }],
      [{ value: "=HYPERLINK(\"x\")" }],
    );
    expect(csv).toContain("'=HYPERLINK");
  });

  it("creates safe download names", () => {
    const name = downloadName("dashboard 24h!");
    expect(name.startsWith("dashboard 24h!-")).toBe(true);
    expect(name.endsWith(".csv")).toBe(true);
  });
});
