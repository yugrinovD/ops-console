import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRoute } from "@/lib/server/errors";
import { listQuotas, upsertQuota } from "@/lib/server/gogate";

const quotaInput = z.object({
  tenantId: z.string().uuid(),
  apiKeyId: z.string().uuid().nullable().optional(),
  rpm: z.number().int().positive().nullable().optional(),
  tpm: z.number().int().positive().nullable().optional(),
  dailyRequests: z.number().int().positive().nullable().optional(),
  dailyTokens: z.number().int().positive().nullable().optional(),
  monthlyCostUsd: z.number().positive().nullable().optional(),
});

export const GET = apiRoute(async (request, _context, { requestId }) => {
  const tenantId = request.nextUrl.searchParams.get("tenantId") ?? undefined;
  return NextResponse.json(await listQuotas(tenantId, requestId));
});

export const POST = apiRoute(
  async (request, _context, { requestId }) => {
    const body = quotaInput.parse(await request.json());
    return NextResponse.json(
      await upsertQuota(
        {
          tenant_id: body.tenantId,
          api_key_id: body.apiKeyId ?? null,
          rpm: body.rpm ?? null,
          tpm: body.tpm ?? null,
          daily_requests: body.dailyRequests ?? null,
          daily_tokens: body.dailyTokens ?? null,
          monthly_cost_usd: body.monthlyCostUsd ?? null,
        },
        requestId,
      ),
    );
  },
  { auth: ["admin"] },
);
