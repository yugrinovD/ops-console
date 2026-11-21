import { AlertTriangle, BellRing, Info } from "lucide-react";
import type { Incident } from "@/lib/schemas/dashboard";
import { cn, formatNumber, formatPercent } from "@/lib/utils";

function metricLabel(metric: string) {
  switch (metric) {
    case "errorRate":
      return "5xx rate";
    case "p95":
      return "p95";
    case "p99":
      return "p99";
    case "rps":
      return "RPS";
    case "cacheHitShare":
      return "cache hit";
    case "rateLimited":
      return "rate limited";
    default:
      return metric;
  }
}

function formatValue(metric: string, value: number | null) {
  if (value === null) return "—";
  if (metric === "errorRate" || metric === "cacheHitShare") return formatPercent(value);
  if (metric === "p95" || metric === "p99") return `${Math.round(value)} ms`;
  return formatNumber(value);
}

export function IncidentBanner({ incidents }: { incidents: Incident[] }) {
  if (!incidents.length) return null;
  const critical = incidents.some((incident) => incident.severity === "critical");
  return (
    <div
      className={cn(
        "mb-5 flex flex-col gap-2 rounded-xl border px-4 py-3 sm:flex-row sm:items-center",
        critical
          ? "border-destructive/25 bg-destructive/8"
          : "border-warning/25 bg-warning/8",
      )}
    >
      <BellRing
        className={cn(
          "size-4 shrink-0",
          critical ? "text-destructive" : "text-warning",
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium">
          Активны алерты: {incidents.length}
        </div>
        <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {incidents
            .slice(0, 3)
            .map(
              (incident) =>
                `${incident.name}: ${metricLabel(incident.metric)} = ${formatValue(incident.metric, incident.value)}`,
            )
            .join(" · ")}
        </div>
      </div>
    </div>
  );
}

export function WarningNotices({ warnings }: { warnings: string[] }) {
  if (!warnings.length) return null;
  return (
    <div className="mb-5 space-y-2">
      {warnings.map((warning) => (
        <div
          key={warning}
          className="flex items-start gap-2 rounded-xl border border-warning/20 bg-warning/5 px-3.5 py-2.5 text-[11px] text-muted-foreground"
        >
          {warning.includes("не настроен") ? (
            <Info className="mt-0.5 size-3.5 shrink-0 text-info" />
          ) : (
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
          )}
          <span>{warning}</span>
        </div>
      ))}
    </div>
  );
}
