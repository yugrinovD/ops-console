import { NextResponse } from "next/server";
import { AppError } from "@/lib/server/app-error";
import { apiRoute } from "@/lib/server/errors";
import {
  getErrors,
  getSignatures,
  getSummary,
  getTrends,
} from "@/lib/server/lmlog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request, context, { requestId }) => {
  const { id, resource } = await context.params;
  const params = request.nextUrl.searchParams;
  const snapshotId = id!;
  switch (resource) {
    case "summary":
      return NextResponse.json(await getSummary(snapshotId, requestId));
    case "signatures": {
      const limit = Number(params.get("limit") ?? 50);
      const offset = Number(params.get("offset") ?? 0);
      const hasErrors = params.get("hasErrors");
      return NextResponse.json(
        await getSignatures(
          snapshotId,
          {
            q: params.get("q") ?? undefined,
            level: params.get("level") ?? undefined,
            hasErrors:
              hasErrors === "true" ? true : hasErrors === "false" ? false : undefined,
            sort: params.get("sort") ?? undefined,
            order: params.get("order") ?? undefined,
            limit: Number.isFinite(limit) ? limit : 50,
            offset: Number.isFinite(offset) ? offset : 0,
          },
          requestId,
        ),
      );
    }
    case "errors": {
      const limit = Number(params.get("limit") ?? 50);
      const offset = Number(params.get("offset") ?? 0);
      return NextResponse.json(
        await getErrors(snapshotId, { limit, offset }, requestId),
      );
    }
    case "trends": {
      const days = Number(params.get("days") ?? 7);
      const spike = Number(params.get("spike") ?? 3);
      const limit = Number(params.get("limit") ?? 20);
      return NextResponse.json(
        await getTrends(snapshotId, { days, spike, limit }, requestId),
      );
    }
    default:
      throw new AppError(404, "not_found", "Неизвестный ресурс снимка");
  }
});
