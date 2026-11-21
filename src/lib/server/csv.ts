import "server-only";
import { NextResponse } from "next/server";

export interface CsvColumn {
  key: string;
  label: string;
}

function cell(value: unknown) {
  if (value === null || value === undefined) return "";
  let text =
    typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(
  columns: CsvColumn[],
  rows: Array<Record<string, unknown>>,
) {
  const header = columns.map((column) => cell(column.label)).join(",");
  const body = rows
    .map((row) => columns.map((column) => cell(row[column.key])).join(","))
    .join("\n");
  return `\ufeff${header}\n${body}\n`;
}

export function csvResponse(filename: string, content: string) {
  const safe = filename.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safe || "export.csv"}"`,
      "Cache-Control": "no-store",
    },
  });
}

export function downloadName(prefix: string, extension = "csv") {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${prefix}-${stamp}.${extension}`;
}
