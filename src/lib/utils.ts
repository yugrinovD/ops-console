import { clsx, type ClassValue } from "clsx";
import {
  format as formatDateFns,
  formatDistanceToNow,
  formatDistanceToNowStrict,
  parseISO,
} from "date-fns";
import { ru } from "date-fns/locale";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(
  value: number | null | undefined,
  options: { compact?: boolean; maximumFractionDigits?: number } = {},
) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("ru-RU", {
    notation: options.compact ? "compact" : "standard",
    maximumFractionDigits:
      options.maximumFractionDigits ??
      (options.compact ? 1 : Math.abs(value) < 10 ? 2 : 0),
  }).format(value);
}

export function formatCurrency(
  value: number | null | undefined,
  options: { compact?: boolean } = {},
) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const small = Math.abs(value) > 0 && Math.abs(value) < 0.01;
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "USD",
    notation: options.compact ? "compact" : "standard",
    maximumFractionDigits: small ? 6 : options.compact ? 1 : 4,
  }).format(value);
}

export function formatPercent(
  value: number | null | undefined,
  digits = 1,
) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const percent = Math.abs(value) <= 1 ? value * 100 : value;
  return `${new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: digits,
  }).format(percent)}%`;
}

export function formatDuration(ms: number | null | undefined) {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return "—";
  if (ms < 1) return "<1 ms";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)} s`;
  return `${(ms / 60_000).toFixed(1)} min`;
}

export function formatLatencySeconds(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return "—";
  return formatDuration(seconds * 1000);
}

export function formatBytes(bytes: number | null | undefined) {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

export function formatDateTime(value: string | number | Date | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? parseISO(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return formatDateFns(date, "dd.MM.yyyy HH:mm:ss", { locale: ru });
}

export function formatDate(value: string | number | Date | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? parseISO(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return formatDateFns(date, "dd.MM.yyyy", { locale: ru });
}

export function formatRelative(value: string | number | Date | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? parseISO(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return formatDistanceToNowStrict(date, { addSuffix: true, locale: ru });
}

export function formatRelativeLong(value: string | number | Date | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? parseISO(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return formatDistanceToNow(date, { addSuffix: true, locale: ru });
}

export function truncate(value: string | null | undefined, length = 120) {
  if (!value) return "";
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

export function shortId(value: string | null | undefined, length = 8) {
  if (!value) return "—";
  return value.length > length ? `${value.slice(0, length)}…` : value;
}

export function safeJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function statusTone(status: number | null | undefined) {
  if (status === null || status === undefined) return "muted";
  if (status >= 500) return "danger";
  if (status >= 400) return "warning";
  if (status >= 300) return "info";
  return "success";
}

export function cacheTone(cache: string | null | undefined) {
  switch ((cache ?? "").toUpperCase()) {
    case "HIT":
    case "SEMANTIC":
      return "success";
    case "MISS":
      return "muted";
    case "BYPASS":
      return "warning";
    default:
      return "muted";
  }
}

export function generateId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

export async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const area = document.createElement("textarea");
  area.value = value;
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  document.execCommand("copy");
  area.remove();
}

export function getCookie(name: string) {
  if (typeof document === "undefined") return "";
  const match = document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
}

export function percentOf(value: number | null | undefined, total: number | null | undefined) {
  if (!value || !total) return 0;
  return Math.min(100, Math.max(0, (value / total) * 100));
}
