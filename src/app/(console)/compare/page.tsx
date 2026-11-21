import type { Metadata } from "next";
import { CompareView } from "@/components/compare/compare-view";
import { requireSession } from "@/lib/server/session";

export const metadata: Metadata = { title: "Сравнение провайдеров" };
export const dynamic = "force-dynamic";

export default async function ComparePage() {
  const session = await requireSession();
  return <CompareView role={session.role} />;
}
