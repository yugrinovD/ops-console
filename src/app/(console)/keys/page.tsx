import type { Metadata } from "next";
import { KeysView } from "@/components/keys/keys-view";
import { requireSession } from "@/lib/server/session";
import { loadKeysInitial } from "@/lib/server/page-data";

export const metadata: Metadata = { title: "Ключи и квоты" };
export const dynamic = "force-dynamic";

export default async function KeysPage() {
  const session = await requireSession();
  const initial = await loadKeysInitial();
  return <KeysView role={session.role} initial={initial} />;
}
