"use client";

import { ExternalLink, GitBranch } from "lucide-react";
import type { TraceView } from "@/lib/schemas/requests";
import { cn, formatDuration } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const palette = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
];

export function TraceWaterfall({ trace }: { trace: TraceView }) {
  const total = Math.max(trace.durationMs, 1);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs">
          <GitBranch className="size-3.5 text-primary" />
          <span className="font-medium">Span waterfall</span>
          <Badge variant="outline">{trace.spans.length} spans</Badge>
          <Badge variant="secondary">{formatDuration(trace.durationMs)}</Badge>
        </div>
        {trace.uiUrl ? (
          <Button variant="outline" size="sm" asChild>
            <a href={trace.uiUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="size-3.5" />
              Jaeger
            </a>
          </Button>
        ) : null}
      </div>
      <div className="space-y-1 rounded-lg border border-border bg-[#0b0d10] p-3">
        {trace.spans.map((span, index) => {
          const left = (span.startMs / total) * 100;
          const width = Math.max((span.durationMs / total) * 100, 0.8);
          return (
            <div
              key={span.id}
              className="group grid grid-cols-[minmax(140px,1fr)_2fr_56px] items-center gap-2 rounded px-1 py-1 hover:bg-white/5"
            >
              <div
                className="flex min-w-0 items-center gap-1.5"
                style={{ paddingLeft: `${Math.min(span.depth, 6) * 10}px` }}
              >
                <span className="size-1.5 shrink-0 rounded-full bg-white/30" />
                <span className="truncate font-mono text-[10px] text-white/75">
                  {span.name}
                </span>
                <span className="hidden truncate text-[9px] text-white/30 sm:inline">
                  {span.service}
                </span>
              </div>
              <div className="relative h-4 rounded-sm bg-white/5">
                <div
                  className={cn(
                    "absolute top-0 h-4 rounded-sm opacity-80 transition-opacity group-hover:opacity-100",
                    palette[index % palette.length],
                  )}
                  style={{ left: `${left}%`, width: `${width}%` }}
                />
              </div>
              <div className="text-right font-mono text-[10px] tabular text-white/55">
                {formatDuration(span.durationMs)}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between font-mono text-[9px] text-muted-foreground">
        <span>0 ms</span>
        <span>{formatDuration(total)}</span>
      </div>
    </div>
  );
}
