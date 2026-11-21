import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/errors";
import { getModelCatalog } from "@/lib/server/gogate";

export const GET = apiRoute(async (_request, _context, { requestId }) => {
  return NextResponse.json(await getModelCatalog(requestId));
});
