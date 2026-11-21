import { apiRoute } from "@/lib/server/errors";
import { openJobEvents } from "@/lib/server/lmlog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiRoute(async (request, context, { requestId }) => {
  const { id } = await context.params;
  const lastEventId = request.headers.get("last-event-id");
  // Long ingest jobs can stream for more than ten minutes. Abort the upstream
  // only when the browser disconnects; lmlog sends heartbeats to keep the
  // connection alive.
  const upstream = await openJobEvents(
    id!,
    lastEventId,
    request.signal,
    requestId,
  );
  if (upstream.status === 204) {
    return new Response(null, { status: 204 });
  }
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});
