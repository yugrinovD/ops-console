import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/errors";
import { getKeyUsage } from "@/lib/server/gogate";
import { dateRange } from "@/lib/server/http";

export const GET = apiRoute(async (request, _context, { requestId }) => {
  const params = request.nextUrl.searchParams;
  const fallback = dateRange(30);
  const from = params.get("from") || fallback.from;
  const to = params.get("to") || fallback.to;
  const tenantId = params.get("tenantId") || undefined;
  return NextResponse.json(await getKeyUsage(from, to, tenantId, requestId));
});
