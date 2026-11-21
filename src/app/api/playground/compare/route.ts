import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp } from "@/lib/server/auth";
import { AppError } from "@/lib/server/app-error";
import { apiRoute } from "@/lib/server/errors";
import { assertJsonBodySize } from "@/lib/server/http";
import { runNonStreaming } from "@/lib/server/playground";
import { checkRateLimit } from "@/lib/server/rate-limit";

const compareSchema = z.object({
  models: z.array(z.string().min(1).max(128)).min(2).max(3),
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
});

export const POST = apiRoute(
  async (request) => {
    const limit = checkRateLimit(`compare:${clientIp(request)}`, 10, 60_000);
    if (!limit.allowed) {
      throw new AppError(
        429,
        "compare_rate_limited",
        `Слишком много сравнений. Повторите через ${limit.retryAfter} с.`,
      );
    }
    assertJsonBodySize(request);
    const body = compareSchema.parse(await request.json());
    const uniqueModels = Array.from(new Set(body.models));
    const results = await Promise.allSettled(
      uniqueModels.map((model) => runNonStreaming(body, model, randomUUID())),
    );
    return NextResponse.json({
      results: results.map((result, index) => {
        const model = uniqueModels[index]!;
        if (result.status === "fulfilled") {
          return { model, ok: true, ...result.value };
        }
        return {
          model,
          ok: false,
          error:
            result.reason instanceof Error
              ? result.reason.message
              : "Запрос не выполнен",
        };
      }),
    });
  },
  { auth: ["admin"] },
);
