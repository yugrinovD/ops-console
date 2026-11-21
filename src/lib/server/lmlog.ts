import "server-only";
import { z } from "zod";
import {
  chatResponseSchema,
  explainResponseSchema,
  lmlogJobSchema,
  signaturePageSchema,
  summarySchema,
  trendSchema,
} from "@/lib/schemas/lmlog";
import { AppError } from "./app-error";
import { getEnv, isLmlogConfigured } from "./env";
import { buildQuery, fetchJson, fetchStream, joinUrl } from "./http";

function base() {
  const env = getEnv();
  if (!env.LMLOG_API_URL || !env.LMLOG_API_TOKEN) {
    throw new AppError(
      503,
      "lmlog_not_configured",
      "lmlog API не настроен: задайте LMLOG_API_URL и LMLOG_API_TOKEN",
    );
  }
  return {
    url: env.LMLOG_API_URL.replace(/\/+$/, ""),
    headers: { Authorization: `Bearer ${env.LMLOG_API_TOKEN}` },
  };
}

async function lmlogJson<T>(
  schema: z.ZodType<T>,
  path: string,
  init: RequestInit = {},
  requestId?: string,
  timeoutMs = 30_000,
) {
  const endpoint = base();
  return fetchJson(
    schema,
    "lmlog",
    `${endpoint.url}${path}`,
    { ...init, headers: { ...endpoint.headers, ...init.headers } },
    { service: "lmlog", requestId, timeoutMs },
  );
}

export async function listJobs(limit = 20, requestId?: string) {
  return lmlogJson(
    z.array(lmlogJobSchema),
    `/api/v1/jobs${buildQuery({ limit })}`,
    {},
    requestId,
  );
}

export async function getJob(jobId: string, requestId?: string) {
  return lmlogJson(
    lmlogJobSchema,
    `/api/v1/jobs/${encodeURIComponent(jobId)}`,
    {},
    requestId,
  );
}

export async function getSummary(snapshotId: string, requestId?: string) {
  return lmlogJson(
    summarySchema,
    `/api/v1/snapshots/${encodeURIComponent(snapshotId)}/summary`,
    {},
    requestId,
  );
}

export async function getSignatures(
  snapshotId: string,
  params: {
    q?: string;
    level?: string;
    hasErrors?: boolean;
    sort?: string;
    order?: string;
    limit?: number;
    offset?: number;
  } = {},
  requestId?: string,
) {
  return lmlogJson(
    signaturePageSchema,
    `/api/v1/snapshots/${encodeURIComponent(snapshotId)}/signatures${buildQuery(
      {
        q: params.q,
        level: params.level,
        has_errors: params.hasErrors,
        sort: params.sort,
        order: params.order,
        limit: params.limit ?? 50,
        offset: params.offset ?? 0,
      },
    )}`,
    {},
    requestId,
  );
}

export async function getErrors(
  snapshotId: string,
  params: { limit?: number; offset?: number } = {},
  requestId?: string,
) {
  return lmlogJson(
    signaturePageSchema,
    `/api/v1/snapshots/${encodeURIComponent(snapshotId)}/errors${buildQuery({
      limit: params.limit ?? 50,
      offset: params.offset ?? 0,
    })}`,
    {},
    requestId,
  );
}

export async function getTrends(
  snapshotId: string,
  params: { days?: number; spike?: number; limit?: number } = {},
  requestId?: string,
) {
  return lmlogJson(
    z.array(trendSchema),
    `/api/v1/snapshots/${encodeURIComponent(snapshotId)}/trends${buildQuery({
      days: params.days ?? 7,
      spike: params.spike ?? 3,
      limit: params.limit ?? 20,
    })}`,
    {},
    requestId,
  );
}

export async function explain(
  input: {
    snapshotId: string;
    signature: string;
    useLlm?: boolean;
    refresh?: boolean;
  },
  requestId?: string,
) {
  return lmlogJson(
    explainResponseSchema,
    "/api/v1/explain",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshot_id: input.snapshotId,
        signature: input.signature,
        use_llm: input.useLlm ?? true,
        refresh: input.refresh ?? false,
      }),
    },
    requestId,
    150_000,
  );
}

export async function chat(
  input: {
    snapshotId: string;
    question: string;
    signature?: string;
    topN?: number;
    history?: Array<{ role: "user" | "assistant"; content: string }>;
    useLlm?: boolean;
  },
  requestId?: string,
) {
  return lmlogJson(
    chatResponseSchema,
    "/api/v1/chat",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        snapshot_id: input.snapshotId,
        question: input.question,
        signature: input.signature,
        top_n: input.topN ?? 8,
        history: input.history ?? [],
        use_llm: input.useLlm ?? true,
      }),
    },
    requestId,
    150_000,
  );
}

export async function createJobStream(request: Request, requestId: string) {
  const endpoint = base();
  const contentType = request.headers.get("content-type");
  if (!contentType?.startsWith("multipart/form-data")) {
    throw new AppError(400, "invalid_upload", "Ожидается multipart/form-data");
  }
  const contentLength = request.headers.get("content-length");
  return fetchStream(
    "lmlog",
    joinUrl(endpoint.url, "/api/v1/jobs"),
    {
      method: "POST",
      headers: {
        ...endpoint.headers,
        "Content-Type": contentType,
        ...(contentLength ? { "Content-Length": contentLength } : {}),
        "X-Request-ID": requestId,
      },
      body: request.body,
      signal: request.signal,
      // Node's fetch requires half-duplex for a streaming request body.
      duplex: "half",
    } as RequestInit & { duplex: "half" },
    { service: "lmlog", requestId, timeoutMs: 300_000 },
  );
}

export async function openJobEvents(
  jobId: string,
  lastEventId: string | null,
  signal: AbortSignal,
  requestId: string,
) {
  const endpoint = base();
  return fetchStream(
    "lmlog",
    `${endpoint.url}/api/v1/jobs/${encodeURIComponent(jobId)}/events`,
    {
      headers: {
        ...endpoint.headers,
        Accept: "text/event-stream",
        ...(lastEventId ? { "Last-Event-ID": lastEventId } : {}),
        "X-Request-ID": requestId,
      },
      signal,
    },
    // SSE connections are long-lived: rely on request aborts and lmlog
    // heartbeats instead of an absolute timeout that would force reconnects.
    { service: "lmlog", requestId, timeoutMs: 0 },
  );
}

const lmlogHealthSchema = z
  .object({
    status: z.string(),
    llm: z
      .object({
        enabled: z.boolean().optional(),
        available: z.boolean().optional(),
      })
      .optional(),
  })
  .passthrough();

export async function lmlogHealth() {
  if (!isLmlogConfigured()) {
    return { ok: false, llmEnabled: undefined, llmAvailable: undefined };
  }
  try {
    const endpoint = base();
    const response = await fetch(joinUrl(endpoint.url, "/healthz"), {
      headers: endpoint.headers,
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null);
    const parsed = lmlogHealthSchema.safeParse(payload);
    return {
      ok: response.ok,
      llmEnabled: parsed.success ? parsed.data.llm?.enabled : undefined,
      llmAvailable: parsed.success ? parsed.data.llm?.available : undefined,
    };
  } catch {
    return { ok: false, llmEnabled: undefined, llmAvailable: undefined };
  }
}

export async function lmlogHealthy() {
  return (await lmlogHealth()).ok;
}

export function lmlogConfigured() {
  return isLmlogConfigured();
}
