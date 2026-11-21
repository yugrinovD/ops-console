import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/errors";
import { fetchTrace } from "@/lib/server/jaeger";

export const GET = apiRoute(async (_request, context) => {
  const { traceId } = await context.params;
  const trace = traceId ? await fetchTrace(traceId) : null;
  return NextResponse.json({ trace });
});
