import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getEnv, cookieSecure } from "./env";
import {
  CSRF_COOKIE,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSession,
  randomToken,
  verifySession,
  type Role,
  type SessionPayload,
} from "@/lib/session";

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

function safeEqual(left: string, right: string) {
  if (!left || !right) return false;
  return timingSafeEqual(digest(left), digest(right));
}

export function verifyConsoleToken(input: string): Role | null {
  const env = getEnv();
  if (safeEqual(input, env.CONSOLE_AUTH_TOKEN)) return "admin";
  if (env.CONSOLE_VIEWER_TOKEN && safeEqual(input, env.CONSOLE_VIEWER_TOKEN)) {
    return "viewer";
  }
  return null;
}

export async function getSessionFromCookies(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

export async function getSessionFromRequest(
  request: NextRequest,
): Promise<SessionPayload | null> {
  return verifySession(request.cookies.get(SESSION_COOKIE)?.value);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: cookieSecure(),
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

export function csrfCookieOptions() {
  return {
    httpOnly: false,
    sameSite: "lax" as const,
    secure: cookieSecure(),
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

export async function applySessionCookies(response: NextResponse, role: Role) {
  const { token } = await createSession(role);
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  response.cookies.set(CSRF_COOKIE, randomToken(), csrfCookieOptions());
  return response;
}

export function clearSessionCookies(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  response.cookies.set(CSRF_COOKIE, "", { ...csrfCookieOptions(), maxAge: 0 });
  return response;
}

// --- login throttling ------------------------------------------------------

const WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const attempts = new Map<string, { count: number; resetAt: number }>();

export function clientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}

export function loginRateLimit(ip: string) {
  const now = Date.now();
  if (attempts.size > 1000) {
    for (const [key, value] of attempts) {
      if (value.resetAt <= now) attempts.delete(key);
    }
  }
  const entry = attempts.get(ip);
  if (!entry || entry.resetAt <= now) {
    attempts.set(ip, { count: 0, resetAt: now + WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }
  if (entry.count >= MAX_ATTEMPTS) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }
  return { allowed: true, retryAfter: 0 };
}

export function recordLoginFailure(ip: string) {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || entry.resetAt <= now) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  entry.count += 1;
}

export function clearLoginFailures(ip: string) {
  attempts.delete(ip);
}

export function resetLoginRateLimitForTests() {
  attempts.clear();
}
