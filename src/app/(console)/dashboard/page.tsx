import type { Metadata } from "next";
import { dashboardRangeSchema } from "@/lib/schemas/dashboard";
import { loadDashboard } from "@/lib/server/dashboard";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { requireSession } from "@/lib/server/session";

export const metadata: Metadata = { title: "Обзор" };
export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  await requireSession();
  const params = await searchParams;
  const parsed = dashboardRangeSchema.safeParse(params.range ?? "24h");
  const range = parsed.success ? parsed.data : "24h";
  const initialData = await loadDashboard(range);
  return <DashboardView initialData={initialData} initialRange={range} />;
}
