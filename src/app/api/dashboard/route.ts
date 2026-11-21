import { NextResponse } from "next/server";
import { dashboardRangeSchema } from "@/lib/schemas/dashboard";
import { loadDashboard } from "@/lib/server/dashboard";
import { apiRoute } from "@/lib/server/errors";

export const GET = apiRoute(async (request, _context, { requestId }) => {
  const raw = request.nextUrl.searchParams.get("range") ?? "24h";
  const parsed = dashboardRangeSchema.safeParse(raw);
  const range = parsed.success ? parsed.data : "24h";
  const data = await loadDashboard(range, requestId);
  return NextResponse.json(data);
});
