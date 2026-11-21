import { z } from "zod";

export const jobStatusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "failed",
]);

export const lmlogJobSchema = z.object({
  id: z.string(),
  filename: z.string(),
  size_bytes: z.number(),
  status: jobStatusSchema,
  created_at: z.string(),
  started_at: z.string().nullable().optional(),
  finished_at: z.string().nullable().optional(),
  progress: z.record(z.string(), z.unknown()).default({}),
  stats: z.record(z.string(), z.unknown()).nullable().optional(),
  error: z.string().nullable().optional(),
});

export const jobCreatedSchema = z.object({
  job_id: z.string(),
  status: z.string(),
  filename: z.string(),
  size_bytes: z.number(),
});

export const jobStatsSchema = z.object({
  lines: z.number().optional(),
  entries: z.number().optional(),
  signatures: z.number().optional(),
  errors: z.number().optional(),
  findings: z.number().optional(),
  trends: z.number().optional(),
  elapsed_seconds: z.number().optional(),
  lines_per_second: z.number().optional(),
  levels: z.record(z.string(), z.number()).optional(),
});

export const signatureSchema = z.object({
  signature: z.string(),
  count: z.number(),
  errors: z.number(),
  levels: z.record(z.string(), z.number()),
  classes: z.record(z.string(), z.number()),
  first_ts: z.string(),
  last_ts: z.string(),
  sample_message: z.string(),
  sample_raw: z.string(),
  sample_context: z.record(z.string(), z.unknown()),
  daily: z.record(z.string(), z.number()),
});

export const signaturePageSchema = z.object({
  items: z.array(signatureSchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
  snapshot: z.record(z.string(), z.unknown()),
});

export const trendSchema = z.object({
  signature: z.string(),
  kind: z.string(),
  severity: z.string(),
  count: z.number(),
  errors: z.number(),
  classes: z.array(z.string()),
  sample: z.string(),
  note: z.string(),
  detail: z.string(),
  daily: z.record(z.string(), z.number()),
});

export const summarySchema = z.object({
  snapshot_id: z.string(),
  created: z.string().nullable(),
  period_hours: z.string().nullable(),
  files: z.number(),
  lines: z.number(),
  entries: z.number(),
  signatures: z.number(),
  errors: z.number(),
  levels: z.record(z.string(), z.number()),
  top_classes: z.array(
    z.object({
      name: z.string(),
      count: z.number(),
    }),
  ),
  daily_totals: z.record(z.string(), z.number()),
  stats: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const explainResponseSchema = z.object({
  signature: z.string(),
  text: z.string(),
  source: z.enum(["llm", "heuristic", "cache"]),
  cached: z.boolean().optional().default(false),
  model: z.string().nullable().optional(),
});

export const citationSchema = z.object({
  signature: z.string(),
  count: z.number(),
  errors: z.number(),
  sample: z.string(),
});

export const chatResponseSchema = z.object({
  answer: z.string(),
  source: z.enum(["llm", "heuristic"]),
  citations: z.array(citationSchema).default([]),
  model: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});

export const lmlogErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    request_id: z.string().optional(),
  }),
});

export type LmlogJob = z.infer<typeof lmlogJobSchema>;
export type JobStats = z.infer<typeof jobStatsSchema>;
export type Signature = z.infer<typeof signatureSchema>;
export type SignaturePage = z.infer<typeof signaturePageSchema>;
export type Trend = z.infer<typeof trendSchema>;
export type SnapshotSummary = z.infer<typeof summarySchema>;
export type ExplainResponse = z.infer<typeof explainResponseSchema>;
export type Citation = z.infer<typeof citationSchema>;
export type ChatResponse = z.infer<typeof chatResponseSchema>;
