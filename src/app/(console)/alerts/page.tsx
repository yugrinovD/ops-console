import type { Metadata } from "next";
import { AlertsView } from "@/components/alerts/alerts-view";
import { requireSession } from "@/lib/server/session";

export const metadata: Metadata = { title: "Алерты" };
export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const session = await requireSession();
  return <AlertsView role={session.role} />;
}
