import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRoute } from "@/lib/server/errors";
import { chat } from "@/lib/server/lmlog";

export const runtime = "nodejs";

const chatSchema = z.object({
  snapshotId: z.string().min(1).max(64),
  question: z.string().min(1).max(2000),
  signature: z.string().max(2000).optional(),
  topN: z.number().int().min(1).max(20).default(8),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .max(6)
    .default([]),
  useLlm: z.boolean().default(true),
});

export const POST = apiRoute(async (request, _context, { requestId }) => {
  const body = chatSchema.parse(await request.json());
  return NextResponse.json(
    await chat(
      {
        snapshotId: body.snapshotId,
        question: body.question,
        signature: body.signature,
        topN: body.topN,
        history: body.history,
        useLlm: body.useLlm,
      },
      requestId,
    ),
  );
});
