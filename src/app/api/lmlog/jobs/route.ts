import { NextResponse } from "next/server";
import { AppError } from "@/lib/server/app-error";
import { apiRoute } from "@/lib/server/errors";
import { getEnv } from "@/lib/server/env";
import { createJobStream, listJobs } from "@/lib/server/lmlog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (_request, _context, { requestId }) => {
  return NextResponse.json(await listJobs(20, requestId));
});

export const POST = apiRoute(
  async (request, _context, { requestId }) => {
    const env = getEnv();
    const rawLength = request.headers.get("content-length");
    const maxBytes = env.LMLOG_MAX_UPLOAD_MB * 1024 * 1024;
    if (rawLength && Number(rawLength) > maxBytes + 2 * 1024 * 1024) {
      throw new AppError(
        413,
        "file_too_large",
        `Лимит загрузки — ${env.LMLOG_MAX_UPLOAD_MB} МБ`,
      );
    }
    const upstream = await createJobStream(request, requestId);
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type":
          upstream.headers.get("content-type") ?? "application/json",
        "Cache-Control": "no-store",
      },
    });
  },
  { auth: ["admin"] },
);
