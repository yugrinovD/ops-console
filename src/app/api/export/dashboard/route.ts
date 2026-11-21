import { dashboardRangeSchema } from "@/lib/schemas/dashboard";
import { csvResponse, downloadName, toCsv } from "@/lib/server/csv";
import { loadDashboard } from "@/lib/server/dashboard";
import { apiRoute } from "@/lib/server/errors";

export const GET = apiRoute(async (request, _context, { requestId }) => {
  const raw = request.nextUrl.searchParams.get("range") ?? "24h";
  const parsed = dashboardRangeSchema.safeParse(raw);
  const data = await loadDashboard(parsed.success ? parsed.data : "24h", requestId);
  const rows = data.series.map((point) => ({
    time: new Date(point.ts).toISOString(),
    rps: point.rps,
    p50_ms: point.p50 === null ? null : point.p50 * 1000,
    p95_ms: point.p95 === null ? null : point.p95 * 1000,
    p99_ms: point.p99 === null ? null : point.p99 * 1000,
    error_rate: point.errorRate,
    prompt_tokens_per_second: point.promptTokens,
    completion_tokens_per_second: point.completionTokens,
    cost_usd_per_second: point.costUsd,
    cache_hit_share: point.cacheHitShare,
    rate_limited_per_second: point.rateLimited,
  }));
  return csvResponse(
    downloadName(`dashboard-${data.range}`),
    toCsv(
      [
        { key: "time", label: "time" },
        { key: "rps", label: "rps" },
        { key: "p50_ms", label: "p50_ms" },
        { key: "p95_ms", label: "p95_ms" },
        { key: "p99_ms", label: "p99_ms" },
        { key: "error_rate", label: "error_rate" },
        { key: "prompt_tokens_per_second", label: "prompt_tokens_per_second" },
        { key: "completion_tokens_per_second", label: "completion_tokens_per_second" },
        { key: "cost_usd_per_second", label: "cost_usd_per_second" },
        { key: "cache_hit_share", label: "cache_hit_share" },
        { key: "rate_limited_per_second", label: "rate_limited_per_second" },
      ],
      rows,
    ),
  );
});
