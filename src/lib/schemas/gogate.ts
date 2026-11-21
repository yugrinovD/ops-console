import { z } from "zod";

export const tenantSchema = z.object({
  id: z.string(),
  name: z.string(),
  created_at: z.string(),
});

export const apiKeySchema = z.object({
  id: z.string(),
  tenant_id: z.string(),
  name: z.string(),
  key_prefix: z.string(),
  enabled: z.boolean(),
  expires_at: z.string().nullable().optional(),
  last_used_at: z.string().nullable().optional(),
  created_at: z.string(),
});

export const apiKeyCreatedSchema = apiKeySchema.extend({
  key: z.string(),
  warning: z.string().optional(),
});

export const providerSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.string(),
  base_url: z.string().optional(),
  api_key_env: z.string().optional(),
  models: z.array(z.string()).default([]),
  priority: z.number().default(0),
  enabled: z.boolean().default(true),
  timeout_ms: z.number().default(30000),
  max_retries: z.number().default(0),
  config: z.unknown().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const publicProviderSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.string(),
  models: z.array(z.string()),
  priority: z.number(),
  enabled: z.boolean(),
  timeout_ms: z.number(),
  max_retries: z.number(),
  breaker: z.union([z.number(), z.string()]).optional(),
});

export const quotaSchema = z.object({
  id: z.string(),
  tenant_id: z.string(),
  api_key_id: z.string().nullable().optional(),
  rpm: z.number().nullable().optional(),
  tpm: z.number().nullable().optional(),
  daily_requests: z.number().nullable().optional(),
  daily_tokens: z.number().nullable().optional(),
  monthly_cost_usd: z.number().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const modelPriceSchema = z.object({
  id: z.string(),
  provider: z.string(),
  model: z.string(),
  input_usd_per_1m: z.number(),
  output_usd_per_1m: z.number(),
});

export const usageSummarySchema = z.object({
  tenant_id: z.string(),
  provider: z.string(),
  model: z.string(),
  day: z.string(),
  requests: z.number(),
  prompt_tokens: z.number(),
  completion_tokens: z.number(),
  cost_usd: z.number(),
});

export const keyUsageSummarySchema = z.object({
  api_key_id: z.string(),
  tenant_id: z.string(),
  requests: z.number(),
  prompt_tokens: z.number(),
  completion_tokens: z.number(),
  cost_usd: z.number(),
});

export const auditRecordSchema = z.object({
  request_id: z.string(),
  tenant_id: z.string(),
  key_prefix: z.string(),
  trace_id: z.string().optional().default(""),
  model: z.string(),
  provider: z.string(),
  stream: z.boolean(),
  status: z.number(),
  cache: z.string(),
  prompt_tokens: z.number(),
  completion_tokens: z.number(),
  cost_usd: z.number(),
  latency_ms: z.number(),
  error_code: z.string(),
  pii_redacted: z.boolean(),
  created_at: z.string(),
});

export const providerHealthSchema = z.object({
  name: z.string(),
  kind: z.string().optional(),
  models: z.array(z.string()).optional(),
  breaker: z.union([z.number(), z.string()]).optional(),
});

export const gogateHealthSchema = z.object({
  version: z.string().optional(),
  database: z.record(z.string(), z.unknown()).optional(),
  redis: z.record(z.string(), z.unknown()).optional(),
  providers: z.array(providerHealthSchema).default([]),
  breakers: z.record(z.string(), z.union([z.number(), z.string()])).optional(),
  problems: z.array(z.string()).nullable().optional(),
});

export const publicModelSchema = z.object({
  id: z.string(),
  object: z.string().optional(),
  created: z.number().optional(),
  owned_by: z.string().optional(),
});

export const publicModelsSchema = z.object({
  object: z.string().optional(),
  data: z.array(publicModelSchema),
});

export const chatUsageSchema = z.object({
  prompt_tokens: z.number(),
  completion_tokens: z.number(),
  total_tokens: z.number(),
});

export const chatCompletionSchema = z.object({
  id: z.string(),
  object: z.string().optional(),
  created: z.number().optional(),
  model: z.string(),
  choices: z.array(
    z.object({
      index: z.number().optional(),
      message: z.object({
        role: z.string(),
        content: z.string(),
      }),
      finish_reason: z.string().nullable().optional(),
    }),
  ),
  usage: chatUsageSchema.optional(),
});

export const modelCatalogSchema = z.object({
  models: z.array(z.string()),
  providers: z.array(publicProviderSchema),
  prices: z.array(modelPriceSchema),
  warnings: z.array(z.string()).default([]),
});

export const playgroundMetaSchema = z.object({
  requestId: z.string(),
  provider: z.string(),
  cache: z.string(),
  fallback: z.boolean(),
  chain: z.array(z.string()),
  model: z.string(),
});

export const playgroundUsageSchema = z.object({
  promptTokens: z.number(),
  completionTokens: z.number(),
  totalTokens: z.number(),
  costUsd: z.number().nullable(),
  latencyMs: z.number(),
  finishReason: z.string().nullable(),
});

export const playgroundResponseSchema = z.object({
  response: chatCompletionSchema,
  meta: playgroundMetaSchema,
  usage: playgroundUsageSchema,
});

export const compareResultSchema = z.union([
  z.object({
    model: z.string(),
    ok: z.literal(true),
    response: chatCompletionSchema,
    meta: playgroundMetaSchema,
    usage: playgroundUsageSchema,
  }),
  z.object({
    model: z.string(),
    ok: z.literal(false),
    error: z.string(),
  }),
]);

export const compareResponseSchema = z.object({
  results: z.array(compareResultSchema),
});

export const gogateErrorSchema = z.object({
  error: z.object({
    message: z.string(),
    type: z.string().optional(),
    code: z.string().optional(),
  }),
});

export type Tenant = z.infer<typeof tenantSchema>;
export type ApiKey = z.infer<typeof apiKeySchema>;
export type ApiKeyCreated = z.infer<typeof apiKeyCreatedSchema>;
export type Provider = z.infer<typeof providerSchema>;
export type PublicProvider = z.infer<typeof publicProviderSchema>;
export type Quota = z.infer<typeof quotaSchema>;
export type ModelPrice = z.infer<typeof modelPriceSchema>;
export type UsageSummary = z.infer<typeof usageSummarySchema>;
export type KeyUsageSummary = z.infer<typeof keyUsageSummarySchema>;
export type AuditRecord = z.infer<typeof auditRecordSchema>;
export type GogateHealth = z.infer<typeof gogateHealthSchema>;
export type PublicModel = z.infer<typeof publicModelSchema>;
export type ChatCompletion = z.infer<typeof chatCompletionSchema>;
