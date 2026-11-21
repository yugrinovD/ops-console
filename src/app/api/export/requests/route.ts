import { csvResponse, downloadName, toCsv } from "@/lib/server/csv";
import { apiRoute } from "@/lib/server/errors";
import { getAudit } from "@/lib/server/gogate";

export const GET = apiRoute(async (request, _context, { requestId }) => {
  const params = request.nextUrl.searchParams;
  const status = params.get("status");
  const limit = Number(params.get("limit") ?? 500);
  const records = await getAudit(
    {
      tenantId: params.get("tenantId") || undefined,
      model: params.get("model") || undefined,
      status: status ? Number(status) : undefined,
      cache: params.get("cache") || undefined,
      q: params.get("q") || undefined,
      from: params.get("from") || undefined,
      to: params.get("to") || undefined,
      limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 500) : 500,
      offset: 0,
    },
    requestId,
  );
  return csvResponse(
    downloadName("requests"),
    toCsv(
      [
        { key: "created_at", label: "created_at" },
        { key: "request_id", label: "request_id" },
        { key: "trace_id", label: "trace_id" },
        { key: "tenant_id", label: "tenant_id" },
        { key: "key_prefix", label: "key_prefix" },
        { key: "model", label: "model" },
        { key: "provider", label: "provider" },
        { key: "status", label: "status" },
        { key: "cache", label: "cache" },
        { key: "stream", label: "stream" },
        { key: "prompt_tokens", label: "prompt_tokens" },
        { key: "completion_tokens", label: "completion_tokens" },
        { key: "cost_usd", label: "cost_usd" },
        { key: "latency_ms", label: "latency_ms" },
        { key: "error_code", label: "error_code" },
      ],
      records,
    ),
  );
});
