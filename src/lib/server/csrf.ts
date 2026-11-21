import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { CSRF_COOKIE } from "@/lib/session-constants";
import { getEnv } from "./env";
import { AppError } from "./app-error";

function normalized(value: string) {
  return value.replace(/\/$/, "");
}

function sameValue(left: string, right: string) {
  if (!left || !right) return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function assertSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) {
    throw new AppError(403, "origin_required", "Запрос должен содержать Origin");
  }
  const configured = normalized(getEnv().CONSOLE_ORIGIN);
  const direct = normalized(request.nextUrl.origin);
  if (normalized(origin) !== configured && normalized(origin) !== direct) {
    throw new AppError(403, "origin_not_allowed", "Origin не разрешён");
  }
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    throw new AppError(403, "cross_site_request", "Кросс-сайтовые запросы запрещены");
  }
}

export function assertCsrf(request: NextRequest) {
  assertSameOrigin(request);
  const cookie = request.cookies.get(CSRF_COOKIE)?.value ?? "";
  const header = request.headers.get("x-csrf-token") ?? "";
  if (!sameValue(cookie, header)) {
    throw new AppError(403, "csrf_failed", "CSRF-токен отсутствует или неверен");
  }
}
