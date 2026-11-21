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
import type { MetricPoint } from "@/lib/schemas/dashboard";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { ChartTooltip } from "./chart-tooltip";

function timeLabel(ts: number) {
  return new Date(ts).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TokensChart({ data }: { data: MetricPoint[] }) {
  const chart = data.map((point) => ({
    ts: point.ts,
    prompt: point.promptTokens ?? 0,
    completion: point.completionTokens ?? 0,
    cost: (point.costUsd ?? 0) * 3600,
  }));
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chart} margin={{ top: 8, right: 4, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id="tokens-prompt" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.32} />
              <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="tokens-completion" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.32} />
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
            tickFormatter={(value) => formatCurrency(value, { compact: true })}
            width={48}
          />
          <Tooltip
            content={
              <ChartTooltip
                labelFormatter={(value) =>
                  new Date(Number(value)).toLocaleString("ru-RU")
                }
                formatter={(value, name) =>
                  name === "Стоимость / час"
                    ? formatCurrency(value)
                    : `${formatNumber(value, { maximumFractionDigits: 1 })}/с`
                }
              />
            }
          />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="prompt"
            name="Prompt tokens"
            stackId="tokens"
            stroke="var(--chart-2)"
            strokeWidth={1.5}
            fill="url(#tokens-prompt)"
            isAnimationActive={false}
          />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="completion"
            name="Completion tokens"
            stackId="tokens"
            stroke="var(--chart-1)"
            strokeWidth={1.5}
            fill="url(#tokens-completion)"
            isAnimationActive={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="cost"
            name="Стоимость / час"
            stroke="var(--chart-4)"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
