import "server-only";
import type { DashboardData, DashboardRange, MetricPoint, TopModel } from "@/lib/schemas/dashboard";
import { evaluateAlertRules } from "./alerts";
import { AppError } from "./app-error";
import { isGogateAdminConfigured, isPrometheusConfigured } from "./env";
import {
  adminConfigured,
  getUsage,
  listTenants,
} from "./gogate";
import {
  numberValue,
  queryInstant,
  queryRange,
  seriesPoints,
  type PrometheusSample,
} from "./prometheus";

interface RangeConfig {
  seconds: number;
  step: number;
  window: string;
  days: number;
}

export const RANGE_CONFIG: Record<DashboardRange, RangeConfig> = {
  "15m": { seconds: 15 * 60, step: 15, window: "1m", days: 1 },
  "1h": { seconds: 60 * 60, step: 30, window: "5m", days: 1 },
  "6h": { seconds: 6 * 60 * 60, step: 120, window: "15m", days: 1 },
  "24h": { seconds: 24 * 60 * 60, step: 300, window: "30m", days: 2 },
  "7d": { seconds: 7 * 24 * 60 * 60, step: 1800, window: "2h", days: 8 },
};

function expressions(window: string, seconds: number) {
  const range = `${seconds}s`;
  return {
    rps: `sum(rate(gogate_requests_total[${window}]))`,
    p50: `histogram_quantile(0.50, sum by (le) (rate(gogate_request_duration_seconds_bucket[${window}])))`,
    p95: `histogram_quantile(0.95, sum by (le) (rate(gogate_request_duration_seconds_bucket[${window}])))`,
    p99: `histogram_quantile(0.99, sum by (le) (rate(gogate_request_duration_seconds_bucket[${window}])))`,
    errorRate: `sum(rate(gogate_requests_total{status=~"5.."}[${window}])) / clamp_min(sum(rate(gogate_requests_total[${window}])), 1e-9)`,
    promptTokens: `sum(rate(gogate_tokens_total{direction="prompt"}[${window}]))`,
    completionTokens: `sum(rate(gogate_tokens_total{direction="completion"}[${window}]))`,
    cost: `sum(rate(gogate_cost_usd_total[${window}]))`,
    cacheHitShare: `sum(rate(gogate_cache_hits_total[${window}])) / clamp_min(sum(rate(gogate_requests_total[${window}])), 1e-9)`,
    rateLimited: `sum(rate(gogate_rate_limited_total[${window}]))`,
    requestsTotal: `sum(increase(gogate_requests_total[${range}]))`,
    tokensPromptTotal: `sum(increase(gogate_tokens_total{direction="prompt"}[${range}]))`,
    tokensCompletionTotal: `sum(increase(gogate_tokens_total{direction="completion"}[${range}]))`,
    costTotal: `sum(increase(gogate_cost_usd_total[${range}]))`,
    rateLimitedTotal: `sum(increase(gogate_rate_limited_total[${range}]))`,
    errorRateTotal: `sum(increase(gogate_requests_total{status=~"5.."}[${range}])) / clamp_min(sum(increase(gogate_requests_total[${range}])), 1e-9)`,
    cacheHitShareTotal: `sum(increase(gogate_cache_hits_total[${range}])) / clamp_min(sum(increase(gogate_requests_total[${range}])), 1e-9)`,
    p95Total: `histogram_quantile(0.95, sum by (le) (rate(gogate_request_duration_seconds_bucket[${range}])))`,
    p99Total: `histogram_quantile(0.99, sum by (le) (rate(gogate_request_duration_seconds_bucket[${range}])))`,
    p50Total: `histogram_quantile(0.50, sum by (le) (rate(gogate_request_duration_seconds_bucket[${range}])))`,
    topModels: `topk(8, sum by (model) (increase(gogate_requests_total[${range}])))`,
  };
}

function mergeSeries(
  values: Partial<Record<keyof MetricPoint, Array<{ ts: number; value: number | null }>>>,
) {
  const points = new Map<number, MetricPoint>();
  const keys = Object.keys(values) as Array<keyof MetricPoint>;
  for (const key of keys) {
    for (const item of values[key] ?? []) {
      const existing =
        points.get(item.ts) ??
        ({
          ts: item.ts,
          rps: null,
          p50: null,
          p95: null,
          p99: null,
          errorRate: null,
          promptTokens: null,
          completionTokens: null,
          costUsd: null,
          cacheHitShare: null,
          rateLimited: null,
        } satisfies MetricPoint);
      existing[key] = item.value as never;
      points.set(item.ts, existing);
    }
  }
  return Array.from(points.values()).sort((left, right) => left.ts - right.ts);
}

async function safeRange(
  expression: string,
  start: number,
  end: number,
  step: number,
  requestId?: string,
) {
  try {
    const result = await queryRange(expression, start, end, step, requestId);
    return seriesPoints(result).map((point) => ({
      ts: point.ts,
      value: Number.isFinite(point.value) ? point.value : null,
    }));
  } catch {
    return null;
  }
}

async function safeInstant(expression: string, requestId?: string) {
  try {
    return await queryInstant(expression, requestId);
  } catch {
    return null;
  }
}

function promoValue(samples: PrometheusSample[] | null, index = 0) {
  if (!samples) return null;
  return numberValue(samples[index]);
}

export async function loadDashboard(
  range: DashboardRange,
  requestId?: string,
): Promise<DashboardData> {
  const config = RANGE_CONFIG[range];
  const now = Math.floor(Date.now() / 1000);
  const start = now - config.seconds;
  const expr = expressions(config.window, config.seconds);
  const warnings: string[] = [];
  const metricsConfigured = isPrometheusConfigured();
  const adminAvailable = isGogateAdminConfigured() && adminConfigured();

  let metricsAvailable = false;
  let series: MetricPoint[] = [];
  let requestSamples: PrometheusSample[] | null = null;
  let promptTotal: PrometheusSample[] | null = null;
  let completionTotal: PrometheusSample[] | null = null;
  let costTotal: PrometheusSample[] | null = null;
  let rateLimitedTotal: PrometheusSample[] | null = null;
  let errorTotal: PrometheusSample[] | null = null;
  let cacheTotal: PrometheusSample[] | null = null;
  let p50Total: PrometheusSample[] | null = null;
  let p95Total: PrometheusSample[] | null = null;
  let p99Total: PrometheusSample[] | null = null;
  let activeRps: PrometheusSample[] | null = null;
  let topModelSamples: PrometheusSample[] | null = null;

  if (metricsConfigured) {
    const rangeExpressions: Array<[keyof MetricPoint, string]> = [
      ["rps", expr.rps],
      ["p50", expr.p50],
      ["p95", expr.p95],
      ["p99", expr.p99],
      ["errorRate", expr.errorRate],
      ["promptTokens", expr.promptTokens],
      ["completionTokens", expr.completionTokens],
      ["costUsd", expr.cost],
      ["cacheHitShare", expr.cacheHitShare],
      ["rateLimited", expr.rateLimited],
    ];
    const results = await Promise.allSettled(
      rangeExpressions.map(([, expression]) =>
        safeRange(expression, start, now, config.step, requestId),
      ),
    );
    const values: Partial<Record<keyof MetricPoint, Array<{ ts: number; value: number | null }>>> =
      {};
    results.forEach((result, index) => {
      const entry = rangeExpressions[index];
      if (!entry) return;
      if (result.status === "fulfilled" && result.value) {
        metricsAvailable = true;
        values[entry[0]] = result.value;
      }
    });
    series = mergeSeries(values);

    const instant = await Promise.all([
      safeInstant(expr.requestsTotal, requestId),
      safeInstant(expr.tokensPromptTotal, requestId),
      safeInstant(expr.tokensCompletionTotal, requestId),
      safeInstant(expr.costTotal, requestId),
      safeInstant(expr.rateLimitedTotal, requestId),
      safeInstant(expr.errorRateTotal, requestId),
      safeInstant(expr.cacheHitShareTotal, requestId),
      safeInstant(expr.p50Total, requestId),
      safeInstant(expr.p95Total, requestId),
      safeInstant(expr.p99Total, requestId),
      safeInstant(expr.rps, requestId),
      safeInstant(expr.topModels, requestId),
    ]);
    [
      requestSamples,
      promptTotal,
      completionTotal,
      costTotal,
      rateLimitedTotal,
      errorTotal,
      cacheTotal,
      p50Total,
      p95Total,
      p99Total,
      activeRps,
      topModelSamples,
    ] = instant;
  } else {
    warnings.push(
      "Prometheus не настроен — live-метрики, latency и cache hit недоступны.",
    );
  }

  if (metricsConfigured && !metricsAvailable) {
    warnings.push(
      "Prometheus недоступен — показаны только агрегаты usage из gogate admin API.",
    );
  }

  // --- usage aggregates (daily granularity) --------------------------------
  let usageRequests = 0;
  let usagePromptTokens = 0;
  let usageCompletionTokens = 0;
  let usageCost = 0;
  const modelMap = new Map<
    string,
    { requests: number; promptTokens: number; completionTokens: number; cost: number }
  >();
  const tenantMap = new Map<
    string,
    { requests: number; tokens: number; cost: number }
  >();
  let tenantNames = new Map<string, string>();

  if (adminAvailable) {
    const today = new Date();
    const from = new Date(today.getTime() - config.days * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const to = today.toISOString().slice(0, 10);
    try {
      const [usage, tenants] = await Promise.all([
        getUsage(from, to, undefined, requestId),
        listTenants(requestId),
      ]);
      tenantNames = new Map(tenants.map((tenant) => [tenant.id, tenant.name]));
      for (const row of usage) {
        usageRequests += row.requests;
        usagePromptTokens += row.prompt_tokens;
        usageCompletionTokens += row.completion_tokens;
        usageCost += row.cost_usd;
        const model = modelMap.get(row.model) ?? {
          requests: 0,
          promptTokens: 0,
          completionTokens: 0,
          cost: 0,
        };
        model.requests += row.requests;
        model.promptTokens += row.prompt_tokens;
        model.completionTokens += row.completion_tokens;
        model.cost += row.cost_usd;
        modelMap.set(row.model, model);
        const tenant = tenantMap.get(row.tenant_id) ?? {
          requests: 0,
          tokens: 0,
          cost: 0,
        };
        tenant.requests += row.requests;
        tenant.tokens += row.prompt_tokens + row.completion_tokens;
        tenant.cost += row.cost_usd;
        tenantMap.set(row.tenant_id, tenant);
      }
    } catch (error) {
      warnings.push(
        error instanceof AppError
          ? error.message
          : "Не удалось загрузить usage из gogate admin API.",
      );
    }
  } else if (!isGogateAdminConfigured()) {
    warnings.push(
      "gogate admin API не настроен — top models/tenants и usage недоступны.",
    );
  }

  const totalsRequests = promoValue(requestSamples) ?? usageRequests;
  const promptTokens = promoValue(promptTotal) ?? usagePromptTokens;
  const completionTokens = promoValue(completionTotal) ?? usageCompletionTokens;
  const costUsd = promoValue(costTotal) ?? usageCost;
  const lastPoint = series.at(-1);
  const p95 = promoValue(p95Total) ?? lastPoint?.p95 ?? null;
  const p99 = promoValue(p99Total) ?? lastPoint?.p99 ?? null;
  const p50 = promoValue(p50Total) ?? lastPoint?.p50 ?? null;
  const errorRate =
    promoValue(errorTotal) ??
    lastPoint?.errorRate ??
    (metricsAvailable && totalsRequests > 0 ? 0 : null);
  const cacheHitShare =
    promoValue(cacheTotal) ??
    lastPoint?.cacheHitShare ??
    (metricsAvailable && totalsRequests > 0 ? 0 : null);
  const rateLimited =
    promoValue(rateLimitedTotal) ??
    lastPoint?.rateLimited ??
    (metricsAvailable && totalsRequests > 0 ? 0 : null);
  const rps = promoValue(activeRps) ?? lastPoint?.rps ?? null;

  const topModels: TopModel[] = Array.from(modelMap.entries())
    .map(([model, value]) => ({
      model,
      requests: value.requests,
      promptTokens: value.promptTokens,
      completionTokens: value.completionTokens,
      costUsd: value.cost,
      share: usageRequests > 0 ? value.requests / usageRequests : 0,
    }))
    .sort((left, right) => right.requests - left.requests)
    .slice(0, 8);

  if (!topModels.length && topModelSamples) {
    for (const sample of topModelSamples.slice(0, 8)) {
      const requests = numberValue(sample) ?? 0;
      topModels.push({
        model: sample.metric.model ?? "unknown",
        provider: sample.metric.provider || undefined,
        requests,
        promptTokens: 0,
        completionTokens: 0,
        costUsd: 0,
        share: 0,
      });
    }
    const max = topModels.reduce((sum, item) => sum + item.requests, 0) || 1;
    for (const item of topModels) item.share = item.requests / max;
  }

  const topTenants = Array.from(tenantMap.entries())
    .map(([tenantId, value]) => ({
      tenantId,
      tenantName: tenantNames.get(tenantId) ?? tenantId.slice(0, 8),
      requests: value.requests,
      tokens: value.tokens,
      costUsd: value.cost,
      share: usageRequests > 0 ? value.requests / usageRequests : 0,
    }))
    .sort((left, right) => right.requests - left.requests)
    .slice(0, 8);

  const data: DashboardData = {
    range,
    generatedAt: new Date().toISOString(),
    metricsAvailable,
    adminAvailable,
    series,
    totals: {
      requests: totalsRequests,
      rps,
      p50,
      p95,
      p99,
      errorRate,
      promptTokens,
      completionTokens,
      costUsd,
      cacheHitShare,
      rateLimited,
    },
    topModels,
    topTenants,
    incidents: [],
    warnings: Array.from(new Set(warnings)),
  };
  data.incidents = await evaluateAlertRules(data);
  return data;
}
