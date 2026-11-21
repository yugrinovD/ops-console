import "server-only";
import type { AuditRecord, KeyUsageSummary, Quota, Tenant, ApiKey } from "@/lib/schemas/gogate";
import type { LmlogJob, SnapshotSummary } from "@/lib/schemas/lmlog";
import {
  getAudit,
  getKeyUsage,
  listKeys,
  listQuotas,
  listTenants,
} from "./gogate";
import { getJob, getSummary, listJobs } from "./lmlog";

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartUtc() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
}

export async function loadKeysInitial(): Promise<{
  tenants?: Tenant[];
  keys?: ApiKey[];
  quotas?: Quota[];
  monthUsage?: KeyUsageSummary[];
  todayUsage?: KeyUsageSummary[];
}> {
  const today = todayUtc();
  const monthStart = monthStartUtc();
  const [tenants, keys, quotas, monthUsage, todayUsage] = await Promise.allSettled([
    listTenants(),
    listKeys(),
    listQuotas(),
    getKeyUsage(monthStart, today),
    getKeyUsage(today, today),
  ]);
  return {
    tenants: tenants.status === "fulfilled" ? tenants.value : undefined,
    keys: keys.status === "fulfilled" ? keys.value : undefined,
    quotas: quotas.status === "fulfilled" ? quotas.value : undefined,
    monthUsage: monthUsage.status === "fulfilled" ? monthUsage.value : undefined,
    todayUsage: todayUsage.status === "fulfilled" ? todayUsage.value : undefined,
  };
}

export async function loadRequestsInitial(): Promise<{
  audit?: { items: AuditRecord[]; limit: number; offset: number };
  tenants?: Tenant[];
}> {
  const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [audit, tenants] = await Promise.allSettled([
    getAudit({ from, limit: 50, offset: 0 }),
    listTenants(),
  ]);
  return {
    audit:
      audit.status === "fulfilled"
        ? { items: audit.value, limit: 50, offset: 0 }
        : undefined,
    tenants: tenants.status === "fulfilled" ? tenants.value : undefined,
  };
}

export async function loadLogsInitial(): Promise<{
  jobs?: LmlogJob[];
}> {
  try {
    return { jobs: await listJobs(20) };
  } catch {
    return {};
  }
}

export async function loadSnapshotInitial(snapshotId: string): Promise<{
  job?: LmlogJob;
  summary?: SnapshotSummary;
}> {
  const [job, summary] = await Promise.allSettled([
    getJob(snapshotId),
    getSummary(snapshotId),
  ]);
  return {
    job: job.status === "fulfilled" ? job.value : undefined,
    summary: summary.status === "fulfilled" ? summary.value : undefined,
  };
}
