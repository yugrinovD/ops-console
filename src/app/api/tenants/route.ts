import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRoute } from "@/lib/server/errors";
import { createTenant, listTenants } from "@/lib/server/gogate";

const createTenantSchema = z.object({
  name: z.string().min(1).max(120),
});

export const GET = apiRoute(async (_request, _context, { requestId }) => {
  return NextResponse.json(await listTenants(requestId));
});

export const POST = apiRoute(
  async (request, _context, { requestId }) => {
    const body = createTenantSchema.parse(await request.json());
    return NextResponse.json(await createTenant(body.name, requestId), {
      status: 201,
    });
  },
  { auth: ["admin"] },
);
