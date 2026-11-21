"use client";

import * as React from "react";
import { RefreshCw, Sparkles, Wand2 } from "lucide-react";
import { explainResponseSchema } from "@/lib/schemas/lmlog";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/common/markdown";
import { Skeleton } from "@/components/ui/skeleton";

export function ExplainPanel({
  snapshotId,
  signature,
  compact = false,
}: {
  snapshotId: string;
  signature: string;
  compact?: boolean;
}) {
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<{
    text: string;
    source: string;
    cached: boolean;
  } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function explain(refresh = false) {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(explainResponseSchema, "/api/lmlog/explain", {
        method: "POST",
        body: JSON.stringify({
          snapshotId,
          signature,
          useLlm: true,
          refresh,
        }),
      });
      setResult({
        text: response.text,
        source: response.source,
        cached: response.cached,
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          variant={compact ? "outline" : "subtle"}
          size="sm"
          onClick={() => explain(false)}
          disabled={loading}
        >
          {loading ? (
            <Sparkles className="size-3.5 animate-pulse" />
          ) : (
            <Wand2 className="size-3.5" />
          )}
          {loading ? "Объясняем…" : "Объяснить"}
        </Button>
        {result ? (
          <>
            <Badge variant={result.source === "llm" ? "success" : "warning"}>
              {result.source === "llm"
                ? "LLM"
                : result.source === "cache"
                  ? "cache"
                  : "heuristic"}
            </Badge>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => explain(true)}
              disabled={loading}
              aria-label="Обновить объяснение"
            >
              <RefreshCw className="size-3.5" />
            </Button>
          </>
        ) : null}
      </div>
      {loading && !result ? <Skeleton className="h-24" /> : null}
      {error ? <div className="text-[11px] text-destructive">{error}</div> : null}
      {result ? (
        <div className="rounded-lg border border-border bg-background/40 p-3">
          <Markdown>{result.text}</Markdown>
        </div>
      ) : null}
    </div>
  );
}
