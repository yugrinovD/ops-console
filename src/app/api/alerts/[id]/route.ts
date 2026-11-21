import { NextResponse } from "next/server";
import { alertRuleInputSchema } from "@/lib/schemas/alerts";
import { deleteAlertRule, updateAlertRule } from "@/lib/server/alerts";
import { apiRoute } from "@/lib/server/errors";

export const PUT = apiRoute(
  async (request, context) => {
    const { id } = await context.params;
    const body = alertRuleInputSchema.parse(await request.json());
    return NextResponse.json(await updateAlertRule(id!, body));
  },
  { auth: ["admin"] },
);

export const DELETE = apiRoute(
  async (_request, context) => {
    const { id } = await context.params;
    await deleteAlertRule(id!);
    return NextResponse.json({ ok: true });
  },
  { auth: ["admin"] },
);
