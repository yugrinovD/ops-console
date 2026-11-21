import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/errors";
import { getAudit } from "@/lib/server/gogate";

export const GET = apiRoute(async (request, _context, { requestId }) => {
  const params = request.nextUrl.searchParams;
  const status = params.get("status");
  const limit = Number(params.get("limit") ?? 100);
  const offset = Number(params.get("offset") ?? 0);
  const items = await getAudit(
    {
      tenantId: params.get("tenantId") || undefined,
      model: params.get("model") || undefined,
      status: status ? Number(status) : undefined,
      cache: params.get("cache") || undefined,
      q: params.get("q") || undefined,
      from: params.get("from") || undefined,
      to: params.get("to") || undefined,
      limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 500) : 100,
      offset: Number.isFinite(offset) ? Math.max(offset, 0) : 0,
    },
    requestId,
  );
  return NextResponse.json({ items, limit, offset });
});
