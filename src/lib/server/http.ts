import "server-only";
import { z } from "zod";
import { AppError, UpstreamError } from "./app-error";
import { getLogger } from "./logger";

export type UpstreamService = "gogate" | "lmlog" | "prometheus" | "jaeger";

export interface FetchOptions {
  service: UpstreamService;
  timeoutMs?: number;
  retries?: number;
  headers?: HeadersInit;
  requestId?: string;
}

function joinUrl(base: string, path: string) {
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

export { joinUrl };

function upstreamMessage(body: unknown, fallback: string) {
  if (body && typeof body === "object") {
    const maybe = body as {
      error?: { message?: string } | string;
      detail?: string | { message?: string };
      message?: string;
    };
    if (typeof maybe.error === "string") return maybe.error;
    if (maybe.error?.message) return maybe.error.message;
    if (typeof maybe.detail === "string") return maybe.detail;
    if (maybe.detail?.message) return maybe.detail.message;
    if (maybe.message) return maybe.message;
  }
  return fallback;
}

function parseJson(text: string) {
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

export async function fetchUpstream(
  service: UpstreamService,
  url: string,
  init: RequestInit = {},
  options: FetchOptions,
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const timeoutSignal = timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : null;
  const signal = timeoutSignal
    ? init.signal
      ? AbortSignal.any([init.signal, timeoutSignal])
      : timeoutSignal
    : init.signal;
  return fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      "User-Agent": "ops-console/1.0",
      ...(options.requestId ? { "X-Request-ID": options.requestId } : {}),
      ...init.headers,
      ...options.headers,
    },
    signal,
    cache: "no-store",
  });
}

export async function fetchJson<T>(
  schema: z.ZodType<T>,
  service: UpstreamService,
  url: string,
  init: RequestInit = {},
  options: FetchOptions,
): Promise<T> {
  const retries =
    options.retries ?? (init.method && init.method !== "GET" ? 0 : 1);
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchUpstream(service, url, init, options);
      const text = await response.text();
      const body = parseJson(text);
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new AppError(
            502,
            `upstream_${service}_auth_failed`,
            `Сервис ${service} отклонил серверный токен`,
          );
        }
        if (response.status === 404) {
          throw new AppError(404, `${service}_not_found`, "Объект не найден");
        }
        if (response.status >= 400 && response.status < 500) {
          throw new AppError(
            response.status === 422 ? 422 : response.status,
            `${service}_invalid_request`,
            upstreamMessage(body, `Запрос к ${service} отклонён`),
          );
        }
        throw new UpstreamError(
          service,
          `Сервис ${service} вернул ${response.status}`,
          {
            status: 502,
            code: `upstream_${service}_error`,
            details: { upstreamStatus: response.status },
          },
        );
      }
      const parsed = schema.safeParse(body);
      if (!parsed.success) {
        getLogger().warn(
          {
            event: "upstream_contract_error",
            service,
            issues: parsed.error.issues.slice(0, 5),
          },
          "upstream response does not match the expected schema",
        );
        throw new UpstreamError(
          service,
          `Сервис ${service} вернул неожиданный ответ`,
          { code: `upstream_${service}_contract` },
        );
      }
      return parsed.data;
    } catch (error) {
      lastError = error;
      if (error instanceof AppError) throw error;
      if (attempt < retries) continue;
      throw new UpstreamError(service, `Не удалось подключиться к ${service}`, {
        code: `upstream_${service}_unavailable`,
      });
    }
  }
  throw new UpstreamError(service, `Не удалось подключиться к ${service}`, {
    code: `upstream_${service}_unavailable`,
    details: lastError instanceof Error ? lastError.message : undefined,
  });
}

export async function fetchStream(
  service: UpstreamService,
  url: string,
  init: RequestInit,
  options: FetchOptions,
): Promise<Response> {
  const response = await fetchUpstream(service, url, init, options);
  if (response.ok) return response;
  const text = await response.text();
  const body = parseJson(text);
  if (response.status === 401 || response.status === 403) {
    throw new AppError(
      502,
      `upstream_${service}_auth_failed`,
      `Сервис ${service} отклонил серверный токен`,
    );
  }
  if (response.status >= 400 && response.status < 500) {
    throw new AppError(
      response.status,
      `${service}_invalid_request`,
      upstreamMessage(body, `Запрос к ${service} отклонён`),
    );
  }
  throw new UpstreamError(
    service,
    `Сервис ${service} вернул ${response.status}`,
    {
      status: 502,
      details: { upstreamStatus: response.status },
    },
  );
}

export const MAX_JSON_BODY_BYTES = 1_000_000;

export function assertJsonBodySize(
  request: Request,
  maxBytes = MAX_JSON_BODY_BYTES,
) {
  const raw = request.headers.get("content-length");
  if (!raw) return;
  const length = Number(raw);
  if (!Number.isFinite(length) || length < 0) {
    throw new AppError(400, "invalid_request", "Некорректный Content-Length");
  }
  if (length > maxBytes) {
    throw new AppError(
      413,
      "request_too_large",
      `Максимальный размер JSON-запроса — ${Math.floor(maxBytes / 1024)} КиБ`,
    );
  }
}

export function buildQuery(
  params: Record<string, string | number | boolean | null | undefined>,
) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export function dateRange(days: number) {
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}
