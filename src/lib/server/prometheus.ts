import "server-only";
import { z } from "zod";
import { AppError } from "./app-error";
import { getEnv, isPrometheusConfigured } from "./env";
import { fetchJson } from "./http";

const prometheusResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({
    resultType: z.string(),
    result: z.array(
      z.object({
        metric: z.record(z.string(), z.string()).default({}),
        value: z.tuple([z.number(), z.string()]).optional(),
        values: z.array(z.tuple([z.number(), z.string()])).optional(),
      }),
    ),
  }),
});

export type PrometheusResult = z.infer<typeof prometheusResponseSchema>["data"]["result"];
export type PrometheusSample = PrometheusResult[number];

function base() {
  const env = getEnv();
  if (!env.PROMETHEUS_URL) {
    throw new AppError(
      503,
      "prometheus_not_configured",
      "Prometheus не настроен: задайте PROMETHEUS_URL",
    );
  }
  return {
    url: env.PROMETHEUS_URL.replace(/\/+$/, ""),
    headers: env.PROMETHEUS_BEARER_TOKEN
      ? { Authorization: `Bearer ${env.PROMETHEUS_BEARER_TOKEN}` }
      : undefined,
  };
}

async function query(
  path: "query" | "query_range",
  params: Record<string, string | number>,
  requestId?: string,
) {
  const endpoint = base();
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) search.set(key, String(value));
  return fetchJson(
    prometheusResponseSchema,
    "prometheus",
    `${endpoint.url}/api/v1/${path}?${search.toString()}`,
    { headers: endpoint.headers },
    { service: "prometheus", requestId, timeoutMs: 10_000 },
  );
}

export async function queryInstant(expression: string, requestId?: string) {
  const data = await query("query", { query: expression }, requestId);
  return data.data.result;
}

export async function queryRange(
  expression: string,
  start: number,
  end: number,
  step: number,
  requestId?: string,
) {
  const data = await query(
    "query_range",
    { query: expression, start, end, step },
    requestId,
  );
  return data.data.result;
}

export async function prometheusHealthy() {
  if (!isPrometheusConfigured()) return false;
  try {
    const endpoint = base();
    const response = await fetch(`${endpoint.url}/-/healthy`, {
      headers: endpoint.headers,
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function numberValue(sample: PrometheusSample | undefined) {
  if (!sample?.value) return null;
  const value = Number(sample.value[1]);
  return Number.isFinite(value) ? value : null;
}

export function sumValues(result: PrometheusResult) {
  const values = result.map(numberValue).filter((value): value is number => value !== null);
  return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
}

export function firstValue(result: PrometheusResult) {
  return numberValue(result[0]);
}

export function seriesPoints(result: PrometheusResult) {
  return (result[0]?.values ?? []).map(([timestamp, raw]) => ({
    ts: timestamp * 1000,
    value: Number(raw),
  }));
}
