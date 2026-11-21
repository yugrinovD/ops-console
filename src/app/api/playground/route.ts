import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp } from "@/lib/server/auth";
import { AppError } from "@/lib/server/app-error";
import { apiRoute } from "@/lib/server/errors";
import { assertJsonBodySize } from "@/lib/server/http";
import { runNonStreaming, runStreaming } from "@/lib/server/playground";
import { checkRateLimit } from "@/lib/server/rate-limit";

const playgroundSchema = z.object({
  model: z.string().min(1).max(128),
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant"]),
        content: z.string().min(1).max(20_000),
      }),
    )
    .min(1)
    .max(50),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(4096).optional(),
  stream: z.boolean().default(false),
});

export const POST = apiRoute(
  async (request, _context, { requestId }) => {
    const limit = checkRateLimit(`playground:${clientIp(request)}`, 30, 60_000);
    if (!limit.allowed) {
      throw new AppError(
        429,
        "playground_rate_limited",
        `Слишком много запросов. Повторите через ${limit.retryAfter} с.`,
      );
    }
    assertJsonBodySize(request);
    const body = playgroundSchema.parse(await request.json());
    if (body.stream) {
      const signal = AbortSignal.any([
        request.signal,
        AbortSignal.timeout(150_000),
      ]);
      return runStreaming(body, body.model, requestId, signal);
    }
    return NextResponse.json(
      await runNonStreaming(body, body.model, requestId),
    );
  },
  { auth: ["admin"] },
);
