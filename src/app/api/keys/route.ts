import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRoute } from "@/lib/server/errors";
import { createKey, listKeys } from "@/lib/server/gogate";

const createKeySchema = z.object({
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(120),
  expiresAt: z.string().datetime().nullable().optional(),
});

export const GET = apiRoute(async (request, _context, { requestId }) => {
  const tenantId = request.nextUrl.searchParams.get("tenantId") ?? undefined;
  return NextResponse.json(await listKeys(tenantId, requestId));
});

export const POST = apiRoute(
  async (request, _context, { requestId }) => {
    const body = createKeySchema.parse(await request.json());
    const created = await createKey(body, requestId);
    return NextResponse.json(created, { status: 201 });
  },
  { auth: ["admin"] },
);
