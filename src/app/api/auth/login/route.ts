import { NextResponse } from "next/server";
import { z } from "zod";
import {
  clearLoginFailures,
  clientIp,
  loginRateLimit,
  recordLoginFailure,
  verifyConsoleToken,
  applySessionCookies,
} from "@/lib/server/auth";
import { assertSameOrigin } from "@/lib/server/csrf";
import { apiRoute } from "@/lib/server/errors";
import { AppError } from "@/lib/server/app-error";

const loginSchema = z.object({
  token: z.string().min(1).max(512),
});

export const POST = apiRoute(
  async (request) => {
    assertSameOrigin(request);
    const ip = clientIp(request);
    const limit = loginRateLimit(ip);
    if (!limit.allowed) {
      throw new AppError(
        429,
        "too_many_attempts",
        `Слишком много попыток. Повторите через ${limit.retryAfter} с.`,
      );
    }
    const body = await request.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError(400, "invalid_request", "Введите токен доступа");
    }
    const role = verifyConsoleToken(parsed.data.token);
    if (!role) {
      recordLoginFailure(ip);
      throw new AppError(401, "invalid_token", "Неверный токен доступа");
    }
    clearLoginFailures(ip);
    const response = NextResponse.json({ role });
    await applySessionCookies(response, role);
    return response;
  },
  { auth: false, csrf: false },
);
