import { z } from "zod";

export const alertMetricSchema = z.enum([
  "errorRate",
  "p95",
  "p99",
  "rps",
  "cacheHitShare",
  "rateLimited",
]);

export const alertComparatorSchema = z.enum(["gt", "gte", "lt", "lte"]);
export const alertSeveritySchema = z.enum(["info", "warning", "critical"]);

export const alertRuleSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(120),
  metric: alertMetricSchema,
  comparator: alertComparatorSchema,
  threshold: z.number(),
  severity: alertSeveritySchema,
  enabled: z.boolean().default(true),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const alertRuleInputSchema = alertRuleSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    enabled: z.boolean().default(true),
  });

export type AlertMetric = z.infer<typeof alertMetricSchema>;
export type AlertComparator = z.infer<typeof alertComparatorSchema>;
export type AlertSeverity = z.infer<typeof alertSeveritySchema>;
export type AlertRule = z.infer<typeof alertRuleSchema>;
export type AlertRuleInput = z.infer<typeof alertRuleInputSchema>;
