import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/errors";
import { deleteQuota } from "@/lib/server/gogate";

export const DELETE = apiRoute(
  async (_request, context, { requestId }) => {
    const { id } = await context.params;
    await deleteQuota(id!, requestId);
    return NextResponse.json({ ok: true });
  },
  { auth: ["admin"] },
);
