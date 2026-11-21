import { NextResponse } from "next/server";
import { clearSessionCookies } from "@/lib/server/auth";
import { apiRoute } from "@/lib/server/errors";

export const POST = apiRoute(async () => {
  const response = NextResponse.json({ ok: true });
  clearSessionCookies(response);
  return response;
});
