import type { Metadata } from "next";
import { SnapshotView } from "@/components/logs/snapshot-view";
import { loadSnapshotInitial } from "@/lib/server/page-data";
import { requireSession } from "@/lib/server/session";

export const metadata: Metadata = { title: "Снимок логов" };
export const dynamic = "force-dynamic";

export default async function SnapshotPage({
  params,
}: {
  params: Promise<{ snapshotId: string }>;
}) {
  const { snapshotId } = await params;
  await requireSession();
  const initial = await loadSnapshotInitial(snapshotId);
  return <SnapshotView snapshotId={snapshotId} initial={initial} />;
}
