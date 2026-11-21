import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/errors";

export const GET = apiRoute(async (_request, _context, { session }) => {
  return NextResponse.json({
    role: session?.role ?? null,
    authenticated: Boolean(session),
  });
});
