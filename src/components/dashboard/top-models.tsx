import Link from "next/link";
import { Boxes, ChevronRight } from "lucide-react";
import type { TopModel } from "@/lib/schemas/dashboard";
import { formatCurrency, formatNumber, formatPercent, truncate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/common/empty-state";

export function TopModels({ models }: { models: TopModel[] }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Топ моделей</CardTitle>
        <span className="text-[10px] text-muted-foreground">за диапазон</span>
      </CardHeader>
      <CardContent>
        {models.length ? (
          <div className="space-y-3">
            {models.map((model) => (
              <Link
                key={`${model.model}-${model.provider ?? ""}`}
                href={`/playground?model=${encodeURIComponent(model.model)}`}
                className="group block rounded-lg border border-border/60 p-2.5 transition-colors hover:border-primary/30 hover:bg-secondary/20"
              >
                <div className="flex items-center gap-2">
                  <Boxes className="size-3.5 text-muted-foreground" />
                  <span className="truncate font-mono text-xs">{model.model}</span>
                  {model.provider ? (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
                      {model.provider}
                    </span>
                  ) : null}
                  <ChevronRight className="ml-auto size-3.5 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" />
                </div>
                <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span>{formatNumber(model.requests)} запр.</span>
                  <span>{formatPercent(model.share)}</span>
                  <span className="ml-auto font-mono">{formatCurrency(model.costUsd)}</span>
                </div>
                <Progress value={model.share * 100} className="mt-2 h-1" />
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Boxes}
            title="Пока нет данных по моделям"
            description="Данные появятся после запросов через gogate."
            className="border-0 py-8"
          />
        )}
      </CardContent>
    </Card>
  );
}
