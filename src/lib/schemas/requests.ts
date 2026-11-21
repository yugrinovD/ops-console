import { z } from "zod";
import { auditRecordSchema } from "./gogate";

export const auditListSchema = z.object({
  items: z.array(auditRecordSchema),
  limit: z.number(),
  offset: z.number(),
});

export const traceSpanSchema = z.object({
  id: z.string(),
  name: z.string(),
  service: z.string(),
  startMs: z.number(),
  durationMs: z.number(),
  depth: z.number(),
  tags: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
});

export const traceViewSchema = z.object({
  traceId: z.string(),
  durationMs: z.number(),
  spans: z.array(traceSpanSchema),
  uiUrl: z.string(),
});

export const traceResponseSchema = z.object({
  trace: traceViewSchema.nullable(),
});

export const traceLinkSchema = z.object({
  url: z.string().nullable(),
});

export type AuditList = z.infer<typeof auditListSchema>;
export type TraceView = z.infer<typeof traceViewSchema>;
