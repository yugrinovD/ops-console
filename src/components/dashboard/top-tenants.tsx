import { Building2 } from "lucide-react";
import type { TopTenant } from "@/lib/schemas/dashboard";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/common/empty-state";

export function TopTenants({ tenants }: { tenants: TopTenant[] }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Топ тенантов</CardTitle>
        <span className="text-[10px] text-muted-foreground">usage</span>
      </CardHeader>
      <CardContent>
        {tenants.length ? (
          <div className="space-y-3">
            {tenants.map((tenant) => (
              <div
                key={tenant.tenantId}
                className="rounded-lg border border-border/60 p-2.5"
              >
                <div className="flex items-center gap-2">
                  <Building2 className="size-3.5 text-muted-foreground" />
                  <span className="truncate text-xs font-medium">
                    {tenant.tenantName}
                  </span>
                  <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                    {formatPercent(tenant.share)}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span>{formatNumber(tenant.requests)} запр.</span>
                  <span>{formatNumber(tenant.tokens, { compact: true })} токенов</span>
                  <span className="ml-auto font-mono">{formatCurrency(tenant.costUsd)}</span>
                </div>
                <Progress value={tenant.share * 100} className="mt-2 h-1" />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Building2}
            title="Пока нет usage по тенантам"
            description="Проверьте, что gogate admin API доступен и включён audit/usage."
            className="border-0 py-8"
          />
        )}
      </CardContent>
    </Card>
  );
}
