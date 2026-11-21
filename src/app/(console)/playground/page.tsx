import type { Metadata } from "next";
import { PlaygroundView } from "@/components/playground/playground-view";
import { requireSession } from "@/lib/server/session";

export const metadata: Metadata = { title: "Playground" };
export const dynamic = "force-dynamic";

export default async function PlaygroundPage() {
  const session = await requireSession();
  return <PlaygroundView role={session.role} />;
}
