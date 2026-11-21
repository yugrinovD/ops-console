"use client";

import { MessageSquareText, TrendingUp } from "lucide-react";
import type { Signature } from "@/lib/schemas/lmlog";
import { formatDateTime, formatNumber, truncate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { JsonView } from "@/components/common/json-view";
import { CopyButton } from "@/components/common/copy-button";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ExplainPanel } from "./explain-panel";

function DailyBars({ daily }: { daily: Record<string, number> }) {
  const entries = Object.entries(daily).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  const max = Math.max(1, ...entries.map(([, value]) => value));
  return (
    <div className="space-y-2">
      <div className="flex h-24 items-end gap-1 rounded-lg border border-border bg-secondary/10 p-2">
        {entries.length ? (
          entries.map(([date, value]) => (
            <div
              key={date}
              className="group relative flex-1 rounded-sm bg-primary/25 transition-colors hover:bg-primary/50"
              style={{ height: `${Math.max((value / max) * 100, 2)}%` }}
              title={`${date}: ${formatNumber(value)}`}
            />
          ))
        ) : (
          <div className="flex w-full items-center justify-center text-[11px] text-muted-foreground">
            Нет дневной истории
          </div>
        )}
      </div>
      <div className="flex justify-between text-[9px] text-muted-foreground">
        <span>{entries[0]?.[0] ?? "—"}</span>
        <span>{entries.at(-1)?.[0] ?? "—"}</span>
      </div>
    </div>
  );
}

function levelVariant(level: string) {
  if (["ERROR", "CRITICAL", "ALERT", "EMERGENCY"].includes(level)) return "danger" as const;
  if (["WARNING", "WARN"].includes(level)) return "warning" as const;
  if (level === "INFO") return "info" as const;
  return "muted" as const;
}

export function SignatureSheet({
  signature,
  open,
  onOpenChange,
  snapshotId,
  onAsk,
}: {
  signature: Signature | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapshotId: string;
  onAsk: (signature: string) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 pr-6">
            <span className="truncate">{truncate(signature?.sample_message || "Сигнатура", 72)}</span>
            {signature ? <CopyButton value={signature.signature} label="Копировать сигнатуру" /> : null}
          </SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-1.5">
            {signature ? (
              <>
                <Badge variant="secondary">{formatNumber(signature.count)} строк</Badge>
                {signature.errors ? (
                  <Badge variant="danger">{signature.errors} errors</Badge>
                ) : null}
                {Object.entries(signature.levels).map(([level, count]) => (
                  <Badge key={level} variant={levelVariant(level)}>
                    {level} {formatNumber(count)}
                  </Badge>
                ))}
              </>
            ) : null}
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-5">
          {signature ? (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-border/70 bg-secondary/10 p-2.5">
                  <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
                    First seen
                  </div>
                  <div className="mt-1 text-xs">{formatDateTime(signature.first_ts)}</div>
                </div>
                <div className="rounded-lg border border-border/70 bg-secondary/10 p-2.5">
                  <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
                    Last seen
                  </div>
                  <div className="mt-1 text-xs">{formatDateTime(signature.last_ts)}</div>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-medium">
                  <TrendingUp className="size-3.5 text-primary" />
                  Daily history
                </div>
                <DailyBars daily={signature.daily} />
              </div>

              <div>
                <div className="mb-2 text-xs font-medium">Message</div>
                <div className="rounded-lg border border-border bg-background/40 p-3 font-mono text-[11px] leading-relaxed">
                  {signature.sample_message}
                </div>
              </div>

              {Object.keys(signature.classes).length ? (
                <div>
                  <div className="mb-2 text-xs font-medium">Classes</div>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(signature.classes)
                      .sort(([, left], [, right]) => right - left)
                      .slice(0, 8)
                      .map(([name, count]) => (
                        <Badge key={name} variant="outline" className="font-mono text-[9px]">
                          {name} · {formatNumber(count)}
                        </Badge>
                      ))}
                  </div>
                </div>
              ) : null}

              <div>
                <div className="mb-2 text-xs font-medium">Raw sample</div>
                <pre className="max-h-40 overflow-auto rounded-lg border border-border bg-[#0b0d10] p-3 font-mono text-[10px] leading-relaxed text-white/70">
                  {signature.sample_raw || "—"}
                </pre>
              </div>

              <div>
                <div className="mb-2 text-xs font-medium">Context</div>
                <JsonView value={signature.sample_context} maxHeight="16rem" />
              </div>

              <div className="rounded-lg border border-border p-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-medium">
                  <MessageSquareText className="size-3.5 text-primary" />
                  AI explanation
                </div>
                <ExplainPanel snapshotId={snapshotId} signature={signature.signature} />
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  onAsk(signature.signature);
                  onOpenChange(false);
                }}
              >
                <MessageSquareText className="size-3.5" />
                Спросить об этом кластере
              </Button>
            </>
          ) : null}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
