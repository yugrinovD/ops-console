import { NextResponse } from "next/server";
import { clientIp } from "@/lib/server/auth";
import { AppError, apiRoute } from "@/lib/server/errors";
import { getHealthSnapshot } from "@/lib/server/health";
import { checkRateLimit } from "@/lib/server/rate-limit";

export const GET = apiRoute(
  async (request, _context, { requestId }) => {
    const limit = checkRateLimit(`health:${clientIp(request)}`, 120, 60_000);
    if (!limit.allowed) {
      throw new AppError(
        429,
        "health_rate_limited",
        `Слишком много проверок. Повторите через ${limit.retryAfter} с.`,
      );
    }
    return NextResponse.json(await getHealthSnapshot(requestId));
  },
  { auth: false, csrf: false },
);
