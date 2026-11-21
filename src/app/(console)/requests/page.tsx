import type { Metadata } from "next";
import { RequestsView } from "@/components/requests/requests-view";
import { loadRequestsInitial } from "@/lib/server/page-data";
import { requireSession } from "@/lib/server/session";

export const metadata: Metadata = { title: "Запросы и трейсы" };
export const dynamic = "force-dynamic";

export default async function RequestsPage() {
  await requireSession();
  const initial = await loadRequestsInitial();
  return <RequestsView initial={initial} />;
}
