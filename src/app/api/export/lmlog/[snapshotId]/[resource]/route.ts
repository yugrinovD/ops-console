import { AppError } from "@/lib/server/app-error";
import { csvResponse, downloadName, toCsv } from "@/lib/server/csv";
import { apiRoute } from "@/lib/server/errors";
import { getErrors, getSignatures, getTrends } from "@/lib/server/lmlog";

export const runtime = "nodejs";

export const GET = apiRoute(async (_request, context, { requestId }) => {
  const { snapshotId, resource } = await context.params;
  const id = snapshotId!;
  if (resource === "trends") {
    const trends = await getTrends(id, { limit: 100 }, requestId);
    return csvResponse(
      downloadName(`lmlog-${id.slice(0, 8)}-trends`),
      toCsv(
        [
          { key: "severity", label: "severity" },
          { key: "kind", label: "kind" },
          { key: "signature", label: "signature" },
          { key: "count", label: "count" },
          { key: "errors", label: "errors" },
          { key: "sample", label: "sample" },
          { key: "note", label: "note" },
        ],
        trends,
      ),
    );
  }
  if (resource !== "signatures" && resource !== "errors") {
    throw new AppError(404, "not_found", "Неизвестный ресурс");
  }
  const page =
    resource === "errors"
      ? await getErrors(id, { limit: 200 }, requestId)
      : await getSignatures(id, { limit: 200 }, requestId);
  return csvResponse(
    downloadName(`lmlog-${id.slice(0, 8)}-${resource}`),
    toCsv(
      [
        { key: "signature", label: "signature" },
        { key: "count", label: "count" },
        { key: "errors", label: "errors" },
        { key: "levels", label: "levels" },
        { key: "classes", label: "classes" },
        { key: "first_ts", label: "first_ts" },
        { key: "last_ts", label: "last_ts" },
        { key: "sample_message", label: "sample_message" },
      ],
      page.items,
    ),
  );
});
