"use client";

interface TooltipItem {
  dataKey?: string | number;
  name?: string;
  value?: number | string;
  color?: string;
}

export function ChartTooltip({
  active,
  payload,
  label,
  formatter,
  labelFormatter,
}: {
  active?: boolean;
  payload?: TooltipItem[];
  label?: string | number;
  formatter?: (value: number, name: string) => string;
  labelFormatter?: (label: string | number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover/95 px-3 py-2 shadow-2xl backdrop-blur">
      <div className="mb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        {labelFormatter ? labelFormatter(label ?? "") : label}
      </div>
      <div className="space-y-1">
        {payload.map((item) => (
          <div key={item.dataKey} className="flex items-center gap-2 text-xs">
            <span
              className="size-1.5 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-muted-foreground">{item.name}</span>
            <span className="ml-auto font-mono tabular">
              {typeof item.value === "number" && formatter
                ? formatter(item.value, String(item.name))
                : String(item.value ?? "")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
