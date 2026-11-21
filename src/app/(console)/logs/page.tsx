import type { Metadata } from "next";
import { LogsView } from "@/components/logs/logs-view";
import { getEnv } from "@/lib/server/env";
import { requireSession } from "@/lib/server/session";
import { loadLogsInitial } from "@/lib/server/page-data";

export const metadata: Metadata = { title: "Анализ логов" };
export const dynamic = "force-dynamic";

export default async function LogsPage() {
  const session = await requireSession();
  const initial = await loadLogsInitial();
  return (
    <LogsView
      role={session.role}
      initial={initial}
      maxUploadMb={getEnv().LMLOG_MAX_UPLOAD_MB}
    />
  );
}
