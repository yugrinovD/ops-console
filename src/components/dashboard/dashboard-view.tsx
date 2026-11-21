"use client";

import * as React from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  CircleDollarSign,
  Cpu,
  DatabaseZap,
  Gauge,
  RefreshCw,
  ShieldAlert,
  Timer,
} from "lucide-react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { DashboardData, DashboardRange } from "@/lib/schemas/dashboard";
import { dashboardSchema } from "@/lib/schemas/dashboard";
import { apiFetch } from "@/lib/client/api";
import {
  formatCurrency,
  formatLatencySeconds,
  formatNumber,
  formatPercent,
} from "@/lib/utils";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { ErrorState } from "@/components/common/error-state";
import { Sparkline } from "@/components/common/sparkline";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { IncidentBanner, WarningNotices } from "./notices";
import { TrafficChart } from "./traffic-chart";
import { LatencyChart } from "./latency-chart";
import { TokensChart } from "./tokens-chart";
import { TopModels } from "./top-models";
import { TopTenants } from "./top-tenants";

const ranges: Array<{ value: DashboardRange; label: string }> = [
  { value: "15m", label: "15м" },
  { value: "1h", label: "1ч" },
  { value: "6h", label: "6ч" },
  { value: "24h", label: "24ч" },
  { value: "7d", label: "7д" },
];

function timeLabel(value: string) {
  return new Date(value).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function ChartCard({
  title,
  description,
  legend,
  children,
  available,
}: {
  title: string;
  description?: string;
  legend?: Array<{ label: string; color: string }>;
  children: React.ReactNode;
  available: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>{title}</CardTitle>
          {description ? (
            <div className="mt-1 text-[11px] text-muted-foreground">{description}</div>
          ) : null}
        </div>
        {legend ? (
          <div className="flex flex-wrap items-center gap-3">
            {legend.map((item) => (
              <span key={item.label} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="size-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                {item.label}
              </span>
            ))}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="relative">
        {available ? (
          children
        ) : (
          <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/10 text-center">
            <AlertTriangle className="mb-2 size-5 text-warning" />
            <div className="text-xs font-medium">Нет live-метрик</div>
            <div className="mt-1 max-w-xs text-[11px] text-muted-foreground">
              Проверьте `PROMETHEUS_URL` и доступность Prometheus.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardView({
  initialData,
  initialRange,
}: {
  initialData: DashboardData;
  initialRange: DashboardRange;
}) {
  const [range, setRange] = React.useState<DashboardRange>(initialRange);
  const [auto, setAuto] = React.useState(true);
  const query = useQuery({
    queryKey: ["dashboard", range],
    queryFn: () => apiFetch(dashboardSchema, `/api/dashboard?range=${range}`),
    initialData: range === initialRange ? initialData : undefined,
    placeholderData: keepPreviousData,
    refetchInterval: auto ? 15_000 : false,
    refetchIntervalInBackground: false,
  });
  const data = query.data ?? initialData;
  const p95Tone =
    data.totals.p95 === null
      ? "default"
      : data.totals.p95 > 2
        ? "danger"
        : data.totals.p95 > 0.5
          ? "warning"
          : "success";
  const errorTone =
    data.totals.errorRate === null
      ? "default"
      : data.totals.errorRate > 0.05
        ? "danger"
        : data.totals.errorRate > 0.01
          ? "warning"
          : "success";
  const tokenTotal = data.totals.promptTokens + data.totals.completionTokens;
  const rpsSeries = data.series.map((point) => point.rps ?? 0);

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Operations / live"
        title="Обзор инфраструктуры"
        description="Трафик, задержки, ошибки и стоимость gogate в одном экране. Данные обновляются автоматически, пока вкладка активна."
        actions={
          <>
            <div className="flex items-center rounded-lg border border-border bg-card/60 p-0.5">
              {ranges.map((item) => (
                <button
                  key={item.value}
                  onClick={() => setRange(item.value)}
                  className={`rounded-md px-2.5 py-1.5 text-[11px] transition-colors ${
                    range === item.value
                      ? "bg-secondary text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <label className="flex h-8 items-center gap-2 rounded-lg border border-border bg-card/60 px-2.5 text-[11px] text-muted-foreground">
              <Switch checked={auto} onCheckedChange={setAuto} className="scale-75" />
              Авто
            </label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => query.refetch()}
              disabled={query.isFetching}
            >
              <RefreshCw className={query.isFetching ? "size-3.5 animate-spin" : "size-3.5"} />
              Обновить
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={`/api/export/dashboard?range=${range}`}>
                <ArrowDownToLine className="size-3.5" />
                CSV
              </a>
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <Badge variant={data.metricsAvailable ? "success" : "warning"}>
          {data.metricsAvailable ? "Prometheus live" : "Prometheus unavailable"}
        </Badge>
        <Badge variant={data.adminAvailable ? "success" : "warning"}>
          {data.adminAvailable ? "gogate usage" : "admin API unavailable"}
        </Badge>
        <span>обновлено {timeLabel(data.generatedAt)}</span>
        {query.isFetching ? <span className="text-primary">обновляем…</span> : null}
      </div>

      {query.isError ? (
        <ErrorState
          message="Не удалось обновить dashboard. Показаны последние доступные данные."
          onRetry={() => query.refetch()}
        />
      ) : null}

      <IncidentBanner incidents={data.incidents} />
      <WarningNotices warnings={data.warnings} />

      {query.isLoading && !query.data ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-32" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Requests / sec"
              value={formatNumber(data.totals.rps, { maximumFractionDigits: 2 })}
              hint="текущий RPS"
              icon={Activity}
              tone="success"
              footer={<Sparkline data={rpsSeries} height={30} />}
            />
            <StatCard
              label="p95 latency"
              value={formatLatencySeconds(data.totals.p95)}
              hint={`p50 ${formatLatencySeconds(data.totals.p50)} · p99 ${formatLatencySeconds(data.totals.p99)}`}
              icon={Timer}
              tone={p95Tone}
            />
            <StatCard
              label="p99 latency"
              value={formatLatencySeconds(data.totals.p99)}
              hint="хвост задержек"
              icon={Gauge}
              tone={p95Tone === "success" ? "warning" : p95Tone}
            />
            <StatCard
              label="Ошибки 5xx"
              value={formatPercent(data.totals.errorRate, 2)}
              hint="доля от запросов"
              icon={AlertTriangle}
              tone={errorTone}
            />
            <StatCard
              label="Токены"
              value={formatNumber(tokenTotal, { compact: true })}
              hint={`${formatNumber(data.totals.promptTokens, { compact: true })} prompt · ${formatNumber(data.totals.completionTokens, { compact: true })} completion`}
              icon={Cpu}
              tone="info"
            />
            <StatCard
              label="Стоимость"
              value={formatCurrency(data.totals.costUsd)}
              hint="за выбранный диапазон"
              icon={CircleDollarSign}
              tone="warning"
            />
            <StatCard
              label="Cache hit"
              value={formatPercent(data.totals.cacheHitShare)}
              hint="доля попаданий"
              icon={DatabaseZap}
              tone="success"
            />
            <StatCard
              label="Rate limited"
              value={formatNumber(data.totals.rateLimited)}
              hint="отклонено лимитами"
              icon={ShieldAlert}
              tone="danger"
            />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <ChartCard
              title="Трафик и ошибки"
              description="RPS и доля 5xx по времени"
              available={data.metricsAvailable}
              legend={[
                { label: "RPS", color: "var(--chart-1)" },
                { label: "5xx", color: "var(--chart-5)" },
              ]}
            >
              <TrafficChart data={data.series} />
            </ChartCard>
            <ChartCard
              title="Задержки"
              description="p50 / p95 / p99, миллисекунды"
              available={data.metricsAvailable}
              legend={[
                { label: "p50", color: "var(--chart-1)" },
                { label: "p95", color: "var(--chart-3)" },
                { label: "p99", color: "var(--chart-5)" },
              ]}
            >
              <LatencyChart data={data.series} />
            </ChartCard>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
            <ChartCard
              title="Токены и стоимость"
              description="Prompt/completion в секунду и стоимость в час"
              available={data.metricsAvailable}
              legend={[
                { label: "Prompt", color: "var(--chart-2)" },
                { label: "Completion", color: "var(--chart-1)" },
                { label: "Cost", color: "var(--chart-4)" },
              ]}
            >
              <TokensChart data={data.series} />
            </ChartCard>
            <TopModels models={data.topModels} />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <TopTenants tenants={data.topTenants} />
            <Card>
              <CardHeader>
                <CardTitle>Состояние источника</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-[11px] text-muted-foreground">
                <div className="rounded-lg border border-border/70 p-3">
                  <div className="text-xs font-medium text-foreground">Метрики</div>
                  <div className="mt-1 leading-relaxed">
                    {data.metricsAvailable
                      ? "Prometheus отвечает. RPS, latency, ошибки и cache hit рассчитаны по gogate_* метрикам."
                      : "Prometheus недоступен или не настроен. Карточки usage продолжают работать по admin API."}
                  </div>
                </div>
                <div className="rounded-lg border border-border/70 p-3">
                  <div className="text-xs font-medium text-foreground">Usage</div>
                  <div className="mt-1 leading-relaxed">
                    {data.adminAvailable
                      ? "gogate admin API отвечает. Топ моделей и тенантов построены по usage_daily."
                      : "gogate admin API недоступен. Проверьте GOGATE_ADMIN_URL и GOGATE_ADMIN_TOKEN."}
                  </div>
                </div>
                <div className="rounded-lg border border-border/70 p-3">
                  <div className="text-xs font-medium text-foreground">Диапазон</div>
                  <div className="mt-1 leading-relaxed">
                    {range} · daily usage может быть крупнее окна для коротких диапазонов.
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
