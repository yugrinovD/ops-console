import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { AppError } from "./app-error";
import type { Role, SessionPayload } from "@/lib/session";
import { getSessionFromRequest } from "./auth";
import { assertCsrf } from "./csrf";
import { getLogger } from "./logger";

export { AppError, UpstreamError } from "./app-error";

export function requestIdFrom(request: NextRequest) {
  const supplied = request.headers.get("x-request-id")?.trim() ?? "";
  if (/^[A-Za-z0-9._-]{1,128}$/.test(supplied)) return supplied;
  return randomUUID();
}

export function apiError(
  status: number,
  code: string,
  message: string,
  requestId: string,
  details?: unknown,
) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        requestId,
        ...(details === undefined ? {} : { details }),
      },
    },
    {
      status,
      headers: {
        "X-Request-ID": requestId,
        "Cache-Control": "no-store",
      },
    },
  );
}

type RouteContext = { params: Promise<Record<string, string>> };
type ApiMeta = { session: SessionPayload | null; requestId: string };
type ApiHandler = (
  request: NextRequest,
  context: RouteContext,
  meta: ApiMeta,
) => Promise<Response>;

function isMutation(method: string) {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method);
}

export function apiRoute(
  handler: ApiHandler,
  options: { auth?: Role[] | false; csrf?: boolean } = {},
) {
  return async (request: NextRequest, context: RouteContext): Promise<Response> => {
    const requestId = requestIdFrom(request);
    const logger = getLogger();
    try {
      const session =
        options.auth === false ? null : await getSessionFromRequest(request);
      if (options.auth !== false) {
        if (!session) {
          throw new AppError(401, "unauthorized", "Требуется авторизация");
        }
        const allowed = options.auth ?? (["admin", "viewer"] as Role[]);
        if (!allowed.includes(session.role)) {
          throw new AppError(403, "forbidden", "Недостаточно прав");
        }
      }
      if (options.csrf !== false && isMutation(request.method)) {
        assertCsrf(request);
      }
      const response = await handler(request, context, { session, requestId });
      response.headers.set("X-Request-ID", requestId);
      if (!response.headers.has("Cache-Control")) {
        response.headers.set("Cache-Control", "no-store");
      }
      return response;
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn({ requestId, event: "validation_error" }, "request validation failed");
        return apiError(
          422,
          "invalid_request",
          "Некорректные параметры запроса",
          requestId,
          error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        );
      }
      if (error instanceof AppError) {
        if (error.status >= 500) {
          logger.error(
            { requestId, code: error.code, event: "api_error" },
            error.message,
          );
        }
        return apiError(
          error.status,
          error.code,
          error.message,
          requestId,
          error.details,
        );
      }
      if (error instanceof DOMException && error.name === "AbortError") {
        return apiError(499, "request_aborted", "Запрос отменён", requestId);
      }
      logger.error(
        {
          requestId,
          event: "unhandled_api_error",
          error: error instanceof Error ? error.message : String(error),
        },
        "unhandled API error",
      );
      return apiError(500, "internal_error", "Внутренняя ошибка", requestId);
    }
  };
}

export function parseBody<T>(
  schema: { parse: (value: unknown) => T },
  value: unknown,
): T {
  return schema.parse(value);
}
