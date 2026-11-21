import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/errors";
import { getJob } from "@/lib/server/lmlog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (_request, context, { requestId }) => {
  const { id } = await context.params;
  return NextResponse.json(await getJob(id!, requestId));
});
