import type { z } from "zod";
import { CSRF_COOKIE } from "@/lib/session-constants";
import { getCookie } from "@/lib/utils";

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;
  readonly details?: unknown;

  constructor(
    message: string,
    status: number,
    code: string,
    requestId?: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.details = details;
  }
}

function mutation(method?: string) {
  return ["POST", "PUT", "PATCH", "DELETE"].includes((method ?? "GET").toUpperCase());
}

export async function apiFetch<T>(
  schema: z.ZodType<T>,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (mutation(init.method)) {
    const token = getCookie(CSRF_COOKIE);
    if (token) headers.set("X-CSRF-Token", token);
  }
  const response = await fetch(path, {
    ...init,
    headers,
    credentials: "same-origin",
    cache: "no-store",
  });
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!response.ok) {
    const envelope = body as {
      error?: {
        code?: string;
        message?: string;
        requestId?: string;
        details?: unknown;
      };
    };
    throw new ApiClientError(
      envelope?.error?.message ?? `Ошибка запроса (${response.status})`,
      response.status,
      envelope?.error?.code ?? "request_failed",
      envelope?.error?.requestId,
      envelope?.error?.details,
    );
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiClientError(
      "Сервер вернул неожиданный ответ",
      500,
      "client_contract_error",
      undefined,
      parsed.error.issues,
    );
  }
  return parsed.data;
}

export async function apiJson<T>(
  schema: z.ZodType<T>,
  path: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown,
) {
  return apiFetch(schema, path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function apiStream(
  path: string,
  body: unknown,
  signal?: AbortSignal,
) {
  const headers = new Headers({
    Accept: "text/event-stream",
    "Content-Type": "application/json",
  });
  const token = getCookie(CSRF_COOKIE);
  if (token) headers.set("X-CSRF-Token", token);
  const response = await fetch(path, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  if (!response.ok) {
    const text = await response.text();
    let payload: {
      error?: { code?: string; message?: string; requestId?: string; details?: unknown };
    } = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = {};
    }
    throw new ApiClientError(
      payload.error?.message ?? `Ошибка запроса (${response.status})`,
      response.status,
      payload.error?.code ?? "request_failed",
      payload.error?.requestId,
      payload.error?.details,
    );
  }
  return response;
}

export function errorMessage(error: unknown) {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return "Неизвестная ошибка";
}
