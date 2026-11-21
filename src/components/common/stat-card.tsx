import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

type Tone = "default" | "success" | "warning" | "danger" | "info";

const toneClass: Record<Tone, string> = {
  default: "text-foreground",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
  info: "text-info",
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  trend,
  footer,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  trend?: { value: number; label?: string; invert?: boolean } | null;
  footer?: React.ReactNode;
  className?: string;
}) {
  const trendPositive = trend
    ? trend.invert
      ? trend.value < 0
      : trend.value > 0
    : false;
  const trendNegative = trend
    ? trend.invert
      ? trend.value > 0
      : trend.value < 0
    : false;
  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <div className="absolute right-0 top-0 size-24 rounded-full bg-primary/5 blur-2xl" />
      <div className="relative p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          {Icon ? (
            <span className="flex size-7 items-center justify-center rounded-lg border border-border/70 bg-secondary/50">
              <Icon className={cn("size-3.5", toneClass[tone])} />
            </span>
          ) : null}
        </div>
        <div className={cn("mt-2 text-2xl font-semibold tracking-tight tabular", toneClass[tone])}>
          {value}
        </div>
        <div className="mt-1 flex min-h-4 items-center gap-2 text-[11px] text-muted-foreground">
          {trend ? (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-medium",
                trendPositive
                  ? "text-success"
                  : trendNegative
                    ? "text-destructive"
                    : "text-muted-foreground",
              )}
            >
              {trend.value > 0 ? (
                <ArrowUpRight className="size-3" />
              ) : trend.value < 0 ? (
                <ArrowDownRight className="size-3" />
              ) : (
                <Minus className="size-3" />
              )}
              {Math.abs(trend.value).toFixed(1)}%
            </span>
          ) : null}
          {hint ? <span className="truncate">{hint}</span> : null}
          {trend?.label ? <span>{trend.label}</span> : null}
        </div>
        {footer ? <div className="mt-3">{footer}</div> : null}
      </div>
    </Card>
  );
}
