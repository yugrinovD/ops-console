import { NextResponse } from "next/server";
import { alertRuleInputSchema } from "@/lib/schemas/alerts";
import { createAlertRule, listAlertRules } from "@/lib/server/alerts";
import { apiRoute } from "@/lib/server/errors";

export const GET = apiRoute(async () => {
  return NextResponse.json({ rules: await listAlertRules() });
});

export const POST = apiRoute(
  async (request) => {
    const body = alertRuleInputSchema.parse(await request.json());
    return NextResponse.json(await createAlertRule(body), { status: 201 });
  },
  { auth: ["admin"] },
);
