import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRoute } from "@/lib/server/errors";
import { explain } from "@/lib/server/lmlog";

export const runtime = "nodejs";

const explainSchema = z.object({
  snapshotId: z.string().min(1).max(64),
  signature: z.string().min(1).max(2000),
  useLlm: z.boolean().default(true),
  refresh: z.boolean().default(false),
});

export const POST = apiRoute(async (request, _context, { requestId }) => {
  const body = explainSchema.parse(await request.json());
  return NextResponse.json(
    await explain(
      {
        snapshotId: body.snapshotId,
        signature: body.signature,
        useLlm: body.useLlm,
        refresh: body.refresh,
      },
      requestId,
    ),
  );
});
