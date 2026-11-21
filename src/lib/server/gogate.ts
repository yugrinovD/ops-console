import "server-only";
import { z } from "zod";
import {
  auditRecordSchema,
  chatCompletionSchema,
  gogateHealthSchema,
  keyUsageSummarySchema,
  modelPriceSchema,
  providerSchema,
  publicModelsSchema,
  publicProviderSchema,
  quotaSchema,
  tenantSchema,
  usageSummarySchema,
  apiKeyCreatedSchema,
  apiKeySchema,
  type AuditRecord,
  type ChatCompletion,
  type GogateHealth,
  type KeyUsageSummary,
  type ModelPrice,
  type PublicProvider,
  type Quota,
  type Tenant,
  type UsageSummary,
} from "@/lib/schemas/gogate";
import { AppError } from "./app-error";
import { isGogateAdminConfigured, getEnv } from "./env";
import { buildQuery, dateRange, fetchJson, fetchStream } from "./http";

function adminBase() {
  const env = getEnv();
  if (!env.GOGATE_ADMIN_URL || !env.GOGATE_ADMIN_TOKEN) {
    throw new AppError(
      503,
      "gogate_not_configured",
      "gogate admin API не настроен: задайте GOGATE_ADMIN_URL и GOGATE_ADMIN_TOKEN",
    );
  }
  return {
    url: env.GOGATE_ADMIN_URL,
    headers: { Authorization: `Bearer ${env.GOGATE_ADMIN_TOKEN}` },
  };
}

function publicBase() {
  const env = getEnv();
  if (!env.GOGATE_PUBLIC_URL || !env.GOGATE_PLAYGROUND_API_KEY) {
    throw new AppError(
      503,
      "playground_not_configured",
      "Playground не настроен: задайте GOGATE_PUBLIC_URL и GOGATE_PLAYGROUND_API_KEY",
    );
  }
  return {
    url: env.GOGATE_PUBLIC_URL,
    headers: {
      Authorization: `Bearer ${env.GOGATE_PLAYGROUND_API_KEY}`,
      "Content-Type": "application/json",
    },
  };
}

async function adminJson<T>(
  schema: z.ZodType<T>,
  path: string,
  init: RequestInit = {},
  requestId?: string,
) {
  const base = adminBase();
  return fetchJson(
    schema,
    "gogate",
    `${base.url}${path}`,
    { ...init, headers: { ...base.headers, ...init.headers } },
    { service: "gogate", requestId, timeoutMs: 12_000 },
  );
}

async function adminNoContent(
  path: string,
  init: RequestInit,
  requestId?: string,
) {
  const base = adminBase();
  const response = await fetch(`${base.url}${path}`, {
    ...init,
    headers: { ...base.headers, ...init.headers },
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });
  if (!response.ok) {
    const text = await response.text();
    if (response.status === 401 || response.status === 403) {
      throw new AppError(
        502,
        "upstream_gogate_auth_failed",
        "gogate отклонил admin-токен",
      );
    }
    if (response.status === 404) {
      throw new AppError(404, "gogate_not_found", "Объект не найден");
    }
    throw new AppError(
      response.status >= 500 ? 502 : response.status,
      "gogate_error",
      text || `gogate вернул ${response.status}`,
    );
  }
  return response;
}

export async function listTenants(requestId?: string): Promise<Tenant[]> {
  return adminJson(z.array(tenantSchema), "/admin/v1/tenants", {}, requestId);
}

export async function createTenant(
  name: string,
  requestId?: string,
): Promise<Tenant> {
  return adminJson(
    tenantSchema,
    "/admin/v1/tenants",
    { method: "POST", body: JSON.stringify({ name }) },
    requestId,
  );
}

export async function listKeys(tenantId?: string, requestId?: string) {
  return adminJson(
    z.array(apiKeySchema),
    `/admin/v1/keys${buildQuery({ tenant_id: tenantId })}`,
    {},
    requestId,
  );
}

export async function createKey(
  input: { tenantId: string; name: string; expiresAt?: string | null },
  requestId?: string,
) {
  return adminJson(
    apiKeyCreatedSchema,
    "/admin/v1/keys",
    {
      method: "POST",
      body: JSON.stringify({
        tenant_id: input.tenantId,
        name: input.name,
        expires_at: input.expiresAt || undefined,
      }),
    },
    requestId,
  );
}

export async function updateKey(
  id: string,
  enabled: boolean,
  requestId?: string,
) {
  await adminNoContent(
    `/admin/v1/keys/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    },
    requestId,
  );
}

export async function deleteKey(id: string, requestId?: string) {
  await adminNoContent(
    `/admin/v1/keys/${encodeURIComponent(id)}`,
    { method: "DELETE" },
    requestId,
  );
}

export async function listQuotas(tenantId?: string, requestId?: string) {
  return adminJson(
    z.array(quotaSchema),
    `/admin/v1/quotas${buildQuery({ tenant_id: tenantId })}`,
    {},
    requestId,
  );
}

export async function upsertQuota(
  input: Omit<Quota, "id" | "created_at" | "updated_at">,
  requestId?: string,
) {
  return adminJson(
    quotaSchema,
    "/admin/v1/quotas",
    { method: "POST", body: JSON.stringify(input) },
    requestId,
  );
}

export async function deleteQuota(id: string, requestId?: string) {
  await adminNoContent(
    `/admin/v1/quotas/${encodeURIComponent(id)}`,
    { method: "DELETE" },
    requestId,
  );
}

export async function listProviders(requestId?: string) {
  const providers = await adminJson(
    z.array(providerSchema),
    "/admin/v1/providers",
    {},
    requestId,
  );
  return providers.map(sanitizeProvider);
}

export function sanitizeProvider(
  provider: z.infer<typeof providerSchema>,
): PublicProvider {
  return {
    id: provider.id,
    name: provider.name,
    kind: provider.kind,
    models: provider.models,
    priority: provider.priority,
    enabled: provider.enabled,
    timeout_ms: provider.timeout_ms,
    max_retries: provider.max_retries,
  };
}

export async function listPrices(requestId?: string): Promise<ModelPrice[]> {
  return adminJson(
    z.array(modelPriceSchema),
    "/admin/v1/prices",
    {},
    requestId,
  );
}

export async function getHealth(requestId?: string): Promise<GogateHealth> {
  const base = adminBase();
  return fetchJson(
    gogateHealthSchema,
    "gogate",
    `${base.url}/admin/v1/health`,
    { headers: base.headers },
    { service: "gogate", requestId, timeoutMs: 5_000, retries: 0 },
  );
}

export async function getUsage(
  from: string,
  to: string,
  tenantId?: string,
  requestId?: string,
): Promise<UsageSummary[]> {
  return adminJson(
    z.array(usageSummarySchema),
    `/admin/v1/usage${buildQuery({ from, to, tenant_id: tenantId })}`,
    {},
    requestId,
  );
}

export async function getKeyUsage(
  from: string,
  to: string,
  tenantId?: string,
  requestId?: string,
): Promise<KeyUsageSummary[]> {
  return adminJson(
    z.array(keyUsageSummarySchema),
    `/admin/v1/usage/keys${buildQuery({ from, to, tenant_id: tenantId })}`,
    {},
    requestId,
  );
}

export async function getDailyUsageForRange(days = 7, requestId?: string) {
  const range = dateRange(days);
  return getUsage(range.from, range.to, undefined, requestId);
}

export async function getAudit(
  filters: {
    tenantId?: string;
    model?: string;
    status?: number;
    cache?: string;
    q?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  },
  requestId?: string,
): Promise<AuditRecord[]> {
  return adminJson(
    z.array(auditRecordSchema),
    `/admin/v1/audit${buildQuery({
      tenant_id: filters.tenantId,
      model: filters.model,
      status: filters.status,
      cache: filters.cache,
      q: filters.q,
      from: filters.from,
      to: filters.to,
      limit: filters.limit ?? 100,
      offset: filters.offset ?? 0,
    })}`,
    {},
    requestId,
  );
}

// --- public API -----------------------------------------------------------

export async function listPublicModels(requestId?: string) {
  const base = publicBase();
  return fetchJson(
    publicModelsSchema,
    "gogate",
    `${base.url}/v1/models`,
    { headers: base.headers },
    { service: "gogate", requestId, timeoutMs: 8000 },
  );
}

export async function chatCompletion(
  body: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
    max_tokens?: number;
  },
  requestId: string,
): Promise<{ data: ChatCompletion; headers: Headers }> {
  const base = publicBase();
  const response = await fetchStream(
    "gogate",
    `${base.url}/v1/chat/completions`,
    {
      method: "POST",
      headers: { ...base.headers, "X-Request-ID": requestId },
      body: JSON.stringify(body),
    },
    { service: "gogate", requestId, timeoutMs: 120_000 },
  );
  const text = await response.text();
  const parsed = chatCompletionSchema.safeParse(JSON.parse(text) as unknown);
  if (!parsed.success) {
    throw new AppError(
      502,
      "gogate_contract",
      "gogate вернул неожиданный ответ",
    );
  }
  return { data: parsed.data, headers: response.headers };
}

export async function openChatStream(
  body: Record<string, unknown>,
  requestId: string,
  signal: AbortSignal,
) {
  const base = publicBase();
  return fetchStream(
    "gogate",
    `${base.url}/v1/chat/completions`,
    {
      method: "POST",
      headers: { ...base.headers, "X-Request-ID": requestId },
      body: JSON.stringify(body),
      signal,
    },
    { service: "gogate", requestId, timeoutMs: 150_000 },
  );
}

export function calculateCost(
  prices: ModelPrice[],
  provider: string,
  model: string,
  promptTokens: number,
  completionTokens: number,
) {
  const price =
    prices.find((item) => item.provider === provider && item.model === model) ??
    prices.find((item) => item.model === model);
  if (!price) return null;
  return (
    (promptTokens / 1_000_000) * price.input_usd_per_1m +
    (completionTokens / 1_000_000) * price.output_usd_per_1m
  );
}

export function providerChain(model: string, providers: PublicProvider[]) {
  return providers
    .filter((provider) => provider.enabled && provider.models.includes(model))
    .sort((left, right) => left.priority - right.priority);
}

export async function getModelCatalog(requestId?: string) {
  const warnings: string[] = [];
  let providers: PublicProvider[] = [];
  let prices: ModelPrice[] = [];
  let breakers: Record<string, number | string> = {};
  let models: string[] = [];

  try {
    providers = await listProviders(requestId);
  } catch (error) {
    warnings.push(
      error instanceof AppError
        ? error.message
        : "Не удалось загрузить провайдеров",
    );
  }
  try {
    prices = await listPrices(requestId);
  } catch {
    warnings.push("Цены моделей недоступны");
  }
  try {
    const health = await getHealth(requestId);
    breakers = health.breakers ?? {};
  } catch {
    // Health is optional context for the UI.
  }
  try {
    const publicModels = await listPublicModels(requestId);
    models = publicModels.data.map((model) => model.id);
  } catch (error) {
    warnings.push(
      error instanceof AppError
        ? error.message
        : "Не удалось загрузить список моделей gogate",
    );
  }
  if (!models.length) {
    models = Array.from(
      new Set(providers.flatMap((provider) => provider.models)),
    ).sort();
  }
  return {
    models,
    providers: providers.map((provider) => ({
      ...provider,
      breaker: breakers[provider.name],
    })),
    prices,
    warnings,
  };
}

export function adminConfigured() {
  return isGogateAdminConfigured();
}
