import { NextResponse } from "next/server";
import { AppError } from "@/lib/server/app-error";
import { apiRoute } from "@/lib/server/errors";
import { jaegerSearchUrl } from "@/lib/server/jaeger";

export const GET = apiRoute(async (request) => {
  const at = request.nextUrl.searchParams.get("at");
  if (!at) throw new AppError(400, "invalid_request", "Параметр at обязателен");
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, "invalid_request", "Некорректная дата at");
  }
  const from = new Date(date.getTime() - 5000);
  const to = new Date(date.getTime() + 5000);
  return NextResponse.json({ url: jaegerSearchUrl(from, to) });
});
