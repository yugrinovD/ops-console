import "server-only";
import { z } from "zod";
import { getEnv, isJaegerConfigured } from "./env";
import { getLogger } from "./logger";

const spanSchema = z.object({
  traceID: z.string(),
  spanID: z.string(),
  operationName: z.string(),
  references: z
    .array(
      z.object({
        refType: z.string(),
        traceID: z.string(),
        spanID: z.string(),
      }),
    )
    .default([]),
  startTime: z.number(),
  duration: z.number(),
  tags: z
    .array(
      z.object({
        key: z.string(),
        type: z.string().optional(),
        value: z.unknown(),
      }),
    )
    .default([]),
  processID: z.string().optional(),
});

const traceSchema = z.object({
  data: z.array(
    z.object({
      traceID: z.string(),
      spans: z.array(spanSchema),
      processes: z
        .record(
          z.string(),
          z.object({
            serviceName: z.string(),
            tags: z.array(z.unknown()).optional(),
          }),
        )
        .optional(),
    }),
  ),
});

export interface TraceSpan {
  id: string;
  name: string;
  service: string;
  startMs: number;
  durationMs: number;
  depth: number;
  tags: Record<string, string | number | boolean>;
}

export interface TraceView {
  traceId: string;
  durationMs: number;
  spans: TraceSpan[];
  uiUrl: string;
}

function config() {
  const env = getEnv();
  if (!env.GOGATE_JAEGER_URL) return null;
  return {
    url: env.GOGATE_JAEGER_URL.replace(/\/+$/, ""),
    headers: env.JAEGER_BEARER_TOKEN
      ? { Authorization: `Bearer ${env.JAEGER_BEARER_TOKEN}` }
      : undefined,
  };
}

function publicUrl() {
  const env = getEnv();
  // Server-to-server API calls use the internal URL. Browser links may need a
  // different, publicly resolvable origin (for example localhost:16686 when
  // the console talks to jaeger:16686 inside Docker).
  const url = env.GOGATE_JAEGER_PUBLIC_URL || env.GOGATE_JAEGER_URL;
  return url ? url.replace(/\/+$/, "") : null;
}

export function jaegerUiUrl(traceId: string) {
  const base = publicUrl();
  if (!base) return null;
  return `${base}/trace/${encodeURIComponent(traceId)}`;
}

export function jaegerSearchUrl(from: Date, to: Date) {
  const base = publicUrl();
  if (!base) return null;
  const service = getEnv().GOGATE_JAEGER_SERVICE;
  const params = new URLSearchParams({
    service,
    start: String(Math.floor(from.getTime() / 1000)),
    end: String(Math.floor(to.getTime() / 1000)),
    limit: "20",
  });
  return `${base}/search?${params.toString()}`;
}

export async function fetchTrace(traceId: string): Promise<TraceView | null> {
  if (!isJaegerConfigured() || !/^[0-9a-f]{32}$/i.test(traceId)) return null;
  const endpoint = config();
  if (!endpoint) return null;
  try {
    const response = await fetch(
      `${endpoint.url}/api/traces/${encodeURIComponent(traceId)}`,
      {
        headers: endpoint.headers,
        signal: AbortSignal.timeout(6000),
        cache: "no-store",
      },
    );
    if (!response.ok) return null;
    const parsed = traceSchema.safeParse(await response.json());
    if (!parsed.success || !parsed.data.data[0]) return null;
    const trace = parsed.data.data[0];
    const processes = trace.processes ?? {};
    const byId = new Map(trace.spans.map((span) => [span.spanID, span]));
    const start = Math.min(...trace.spans.map((span) => span.startTime));
    const end = Math.max(...trace.spans.map((span) => span.startTime + span.duration));
    const depths = new Map<string, number>();
    const depthOf = (spanId: string, seen = new Set<string>()): number => {
      const cached = depths.get(spanId);
      if (cached !== undefined) return cached;
      if (seen.has(spanId)) return 0;
      seen.add(spanId);
      const span = byId.get(spanId);
      const parent = span?.references.find((ref) => ref.refType === "CHILD_OF");
      const depth = parent ? depthOf(parent.spanID, seen) + 1 : 0;
      depths.set(spanId, depth);
      return depth;
    };
    const spans: TraceSpan[] = trace.spans
      .map((span) => {
        const process = span.processID ? processes[span.processID] : undefined;
        const tags: TraceSpan["tags"] = {};
        for (const tag of span.tags.slice(0, 20)) {
          if (["string", "number", "boolean"].includes(typeof tag.value)) {
            tags[tag.key] = tag.value as string | number | boolean;
          }
        }
        return {
          id: span.spanID,
          name: span.operationName,
          service: process?.serviceName ?? "gogate",
          startMs: (span.startTime - start) / 1000,
          durationMs: span.duration / 1000,
          depth: depthOf(span.spanID),
          tags,
        };
      })
      .sort((left, right) => left.startMs - right.startMs || left.durationMs - right.durationMs);
    return {
      traceId,
      durationMs: (end - start) / 1000,
      spans,
      uiUrl: jaegerUiUrl(traceId) ?? "",
    };
  } catch (error) {
    getLogger().debug(
      { event: "jaeger_trace_failed", traceId, error: String(error) },
      "cannot load trace",
    );
    return null;
  }
}

export async function jaegerHealthy() {
  if (!isJaegerConfigured()) return false;
  const endpoint = config();
  if (!endpoint) return false;
  try {
    const response = await fetch(`${endpoint.url}/api/services`, {
      headers: endpoint.headers,
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}
