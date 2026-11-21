import { z } from "zod";

export const dashboardRangeSchema = z.enum(["15m", "1h", "6h", "24h", "7d"]);
export type DashboardRange = z.infer<typeof dashboardRangeSchema>;

export const metricPointSchema = z.object({
  ts: z.number(),
  rps: z.number().nullable(),
  p50: z.number().nullable(),
  p95: z.number().nullable(),
  p99: z.number().nullable(),
  errorRate: z.number().nullable(),
  promptTokens: z.number().nullable(),
  completionTokens: z.number().nullable(),
  costUsd: z.number().nullable(),
  cacheHitShare: z.number().nullable(),
  rateLimited: z.number().nullable(),
});

export const dashboardTotalsSchema = z.object({
  requests: z.number(),
  rps: z.number().nullable(),
  p50: z.number().nullable(),
  p95: z.number().nullable(),
  p99: z.number().nullable(),
  errorRate: z.number().nullable(),
  promptTokens: z.number(),
  completionTokens: z.number(),
  costUsd: z.number(),
  cacheHitShare: z.number().nullable(),
  rateLimited: z.number().nullable(),
});

export const topModelSchema = z.object({
  model: z.string(),
  provider: z.string().optional(),
  requests: z.number(),
  promptTokens: z.number(),
  completionTokens: z.number(),
  costUsd: z.number(),
  share: z.number(),
});

export const topTenantSchema = z.object({
  tenantId: z.string(),
  tenantName: z.string(),
  requests: z.number(),
  tokens: z.number(),
  costUsd: z.number(),
  share: z.number(),
});

export const incidentSchema = z.object({
  id: z.string(),
  name: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  metric: z.string(),
  value: z.number().nullable(),
  threshold: z.number(),
  comparator: z.enum(["gt", "gte", "lt", "lte"]),
});

export const dashboardSchema = z.object({
  range: dashboardRangeSchema,
  generatedAt: z.string(),
  metricsAvailable: z.boolean(),
  adminAvailable: z.boolean(),
  series: z.array(metricPointSchema),
  totals: dashboardTotalsSchema,
  topModels: z.array(topModelSchema),
  topTenants: z.array(topTenantSchema),
  incidents: z.array(incidentSchema),
  warnings: z.array(z.string()),
});

export type MetricPoint = z.infer<typeof metricPointSchema>;
export type DashboardTotals = z.infer<typeof dashboardTotalsSchema>;
export type TopModel = z.infer<typeof topModelSchema>;
export type TopTenant = z.infer<typeof topTenantSchema>;
export type Incident = z.infer<typeof incidentSchema>;
export type DashboardData = z.infer<typeof dashboardSchema>;
