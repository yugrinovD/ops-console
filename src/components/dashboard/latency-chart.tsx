"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MetricPoint } from "@/lib/schemas/dashboard";
import { formatDuration } from "@/lib/utils";
import { ChartTooltip } from "./chart-tooltip";

function timeLabel(ts: number) {
  return new Date(ts).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function LatencyChart({ data }: { data: MetricPoint[] }) {
  const chart = data.map((point) => ({
    ts: point.ts,
    p50: point.p50 === null ? 0 : point.p50 * 1000,
    p95: point.p95 === null ? 0 : point.p95 * 1000,
    p99: point.p99 === null ? 0 : point.p99 * 1000,
  }));
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chart} margin={{ top: 8, right: 4, bottom: 0, left: -18 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="ts"
            tickFormatter={timeLabel}
            tickLine={false}
            axisLine={false}
            minTickGap={32}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${Math.round(value)}`}
          />
          <Tooltip
            content={
              <ChartTooltip
                labelFormatter={(value) =>
                  new Date(Number(value)).toLocaleString("ru-RU")
                }
                formatter={(value) => formatDuration(value)}
              />
            }
          />
          <Line
            type="monotone"
            dataKey="p50"
            name="p50"
            stroke="var(--chart-1)"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="p95"
            name="p95"
            stroke="var(--chart-3)"
            strokeWidth={1.8}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="p99"
            name="p99"
            stroke="var(--chart-5)"
            strokeWidth={1.8}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
