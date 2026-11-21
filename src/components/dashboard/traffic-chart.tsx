"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatNumber } from "@/lib/utils";
import type { MetricPoint } from "@/lib/schemas/dashboard";
import { ChartTooltip } from "./chart-tooltip";

function timeLabel(ts: number) {
  return new Date(ts).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TrafficChart({ data }: { data: MetricPoint[] }) {
  const chart = data.map((point) => ({
    ts: point.ts,
    rps: point.rps ?? 0,
    errorPct: point.errorRate === null ? 0 : point.errorRate * 100,
  }));
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chart} margin={{ top: 8, right: 4, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id="traffic-rps" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="ts"
            tickFormatter={timeLabel}
            tickLine={false}
            axisLine={false}
            minTickGap={32}
          />
          <YAxis
            yAxisId="left"
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => formatNumber(value, { compact: true })}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${value}%`}
            width={36}
          />
          <Tooltip
            content={
              <ChartTooltip
                labelFormatter={(value) =>
                  new Date(Number(value)).toLocaleString("ru-RU")
                }
                formatter={(value, name) =>
                  name === "Ошибки 5xx"
                    ? `${(value ?? 0).toFixed(2)}%`
                    : formatNumber(value, { maximumFractionDigits: 2 })
                }
              />
            }
          />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="rps"
            name="RPS"
            stroke="var(--chart-1)"
            strokeWidth={2}
            fill="url(#traffic-rps)"
            isAnimationActive={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="errorPct"
            name="Ошибки 5xx"
            stroke="var(--chart-5)"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
