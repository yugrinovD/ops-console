import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRoute } from "@/lib/server/errors";
import { deleteKey, updateKey } from "@/lib/server/gogate";

const updateSchema = z.object({ enabled: z.boolean() });

export const PATCH = apiRoute(
  async (request, context, { requestId }) => {
    const { id } = await context.params;
    if (!id) return NextResponse.json({ ok: false }, { status: 400 });
    const body = updateSchema.parse(await request.json());
    await updateKey(id, body.enabled, requestId);
    return NextResponse.json({ ok: true });
  },
  { auth: ["admin"] },
);

export const DELETE = apiRoute(
  async (_request, context, { requestId }) => {
    const { id } = await context.params;
    if (!id) return NextResponse.json({ ok: false }, { status: 400 });
    await deleteKey(id, requestId);
    return NextResponse.json({ ok: true });
  },
  { auth: ["admin"] },
);
