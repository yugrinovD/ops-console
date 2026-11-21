"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Check,
  Clock3,
  Coins,
  Crown,
  GitCompareArrows,
  Info,
  Loader2,
  Play,
  Sparkles,
  Zap,
} from "lucide-react";
import { compareResponseSchema, modelCatalogSchema } from "@/lib/schemas/gogate";
import type { Role } from "@/lib/session";
import { apiFetch, errorMessage } from "@/lib/client/api";
import {
  cn,
  formatCurrency,
  formatDuration,
  formatNumber,
  shortId,
} from "@/lib/utils";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Markdown } from "@/components/common/markdown";
import { CopyButton } from "@/components/common/copy-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

type CompareResult = ReturnType<typeof compareResponseSchema.parse>["results"][number];

export function CompareView({ role }: { role: Role }) {
  const catalog = useQuery({
    queryKey: ["model-catalog"],
    queryFn: () => apiFetch(modelCatalogSchema, "/api/models"),
  });
  const [selected, setSelected] = React.useState<string[]>([]);
  const [touched, setTouched] = React.useState(false);
  const [systemPrompt, setSystemPrompt] = React.useState("");
  const [prompt, setPrompt] = React.useState("");
  const [temperature, setTemperature] = React.useState(0.2);
  const [maxTokens, setMaxTokens] = React.useState(256);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<CompareResult[] | null>(null);
  const isAdmin = role === "admin";

  const defaultSelected = catalog.data?.models.slice(0, 2) ?? [];
  const effectiveSelected = touched ? selected : defaultSelected;

  function toggleModel(model: string) {
    setTouched(true);
    setSelected((current) => {
      const base = touched ? current : defaultSelected;
      if (base.includes(model)) return base.filter((item) => item !== model);
      if (base.length >= 3) return base;
      return [...base, model];
    });
  }

  async function run() {
    if (loading || effectiveSelected.length < 2 || !prompt.trim()) return;
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const response = await apiFetch(compareResponseSchema, "/api/playground/compare", {
        method: "POST",
        body: JSON.stringify({
          models: effectiveSelected,
          messages: [
            ...(systemPrompt.trim()
              ? [{ role: "system" as const, content: systemPrompt.trim() }]
              : []),
            { role: "user" as const, content: prompt.trim() },
          ],
          temperature,
          maxTokens,
        }),
      });
      setResults(response.results);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const successful = (results ?? []).filter((result) => result.ok);
  const fastest = successful.length
    ? Math.min(...successful.map((result) => (result.ok ? result.usage.latencyMs : Infinity)))
    : null;
  const cheapest = successful.length
    ? Math.min(
        ...successful.map((result) =>
          result.ok && result.usage.costUsd !== null ? result.usage.costUsd : Infinity,
        ),
      )
    : null;
  const fewest = successful.length
    ? Math.min(...successful.map((result) => (result.ok ? result.usage.totalTokens : Infinity)))
    : null;

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="AI / evaluation"
        title="Сравнение провайдеров"
        description="Один prompt — несколько моделей. Сравните latency, токены, стоимость и фактический provider. Победители подсвечиваются по каждой метрике."
        actions={
          <Badge variant="outline" className="h-7">
            {catalog.data?.models.length ?? 0} моделей
          </Badge>
        }
      />

      {!isAdmin ? (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-warning/25 bg-warning/5 px-4 py-3 text-[11px] text-muted-foreground">
          <Info className="size-3.5 text-warning" />
          Роль viewer не может запускать сравнение.
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitCompareArrows className="size-4 text-primary" />
              Условия эксперимента
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {catalog.isError ? (
              <ErrorState
                title="Каталог моделей недоступен"
                message={errorMessage(catalog.error)}
                onRetry={() => catalog.refetch()}
              />
            ) : catalog.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-20" />
                <Skeleton className="h-24" />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Модели</Label>
                    <span className="text-[10px] text-muted-foreground">
                      выберите 2–3
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(catalog.data?.models ?? []).map((model) => {
                      const active = effectiveSelected.includes(model);
                      return (
                        <button
                          key={model}
                          onClick={() => toggleModel(model)}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-[10px] transition-colors",
                            active
                              ? "border-primary/40 bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {active ? <Check className="size-2.5" /> : null}
                          {model}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="system">System prompt</Label>
                  <Textarea
                    id="system"
                    value={systemPrompt}
                    onChange={(event) => setSystemPrompt(event.target.value)}
                    placeholder="Необязательно"
                    className="min-h-16 text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Temperature</Label>
                    <Input
                      type="number"
                      min={0}
                      max={2}
                      step={0.1}
                      value={temperature}
                      onChange={(event) =>
                        setTemperature(
                          Math.min(2, Math.max(0, Number(event.target.value) || 0)),
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max tokens</Label>
                    <Input
                      type="number"
                      min={1}
                      max={4096}
                      value={maxTokens}
                      onChange={(event) =>
                        setMaxTokens(
                          Math.min(4096, Math.max(1, Number(event.target.value) || 1)),
                        )
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prompt">Prompt</Label>
                  <Textarea
                    id="prompt"
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder="Один и тот же запрос для всех моделей…"
                    className="min-h-28 text-sm"
                    maxLength={20_000}
                  />
                </div>

                <Button
                  className="w-full"
                  onClick={() => void run()}
                  disabled={
                    loading ||
                    !isAdmin ||
                    effectiveSelected.length < 2 ||
                    !prompt.trim()
                  }
                >
                  {loading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Play className="size-4" />
                  )}
                  {loading ? "Сравниваем…" : `Запустить (${effectiveSelected.length})`}
                </Button>
                {error ? (
                  <div className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-[11px] text-destructive">
                    {error}
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        <div>
          {loading ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {effectiveSelected.map((model) => (
                <Card key={model}>
                  <CardContent className="space-y-3 p-4">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-40" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : results?.length ? (
            <div className={cn("grid gap-4", results.length > 2 ? "lg:grid-cols-3" : "lg:grid-cols-2")}>
              {results.map((result) => {
                if (!result.ok) {
                  return (
                    <Card key={result.model} className="border-destructive/30">
                      <CardContent className="space-y-2 p-4">
                        <div className="font-mono text-xs">{result.model}</div>
                        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-[11px] text-destructive">
                          {result.error}
                        </div>
                      </CardContent>
                    </Card>
                  );
                }
                const content = result.response.choices[0]?.message.content ?? "";
                const isFastest = result.usage.latencyMs === fastest;
                const isCheapest =
                  result.usage.costUsd !== null && result.usage.costUsd === cheapest;
                const isFewest = result.usage.totalTokens === fewest;
                return (
                  <Card key={result.model} className="flex flex-col">
                    <CardHeader className="space-y-2 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-mono text-xs">{result.model}</span>
                        <Badge variant="outline" className="ml-auto">
                          {result.meta.provider}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {isFastest ? (
                          <Badge variant="success">
                            <Clock3 className="size-2.5" />
                            fastest
                          </Badge>
                        ) : null}
                        {isCheapest ? (
                          <Badge variant="warning">
                            <Coins className="size-2.5" />
                            cheapest
                          </Badge>
                        ) : null}
                        {isFewest ? (
                          <Badge variant="info">
                            <Zap className="size-2.5" />
                            fewest tokens
                          </Badge>
                        ) : null}
                        {isFastest && isCheapest && isFewest ? (
                          <Badge variant="default">
                            <Crown className="size-2.5" />
                            winner
                          </Badge>
                        ) : null}
                        {result.meta.cache ? (
                          <Badge variant="muted">cache {result.meta.cache}</Badge>
                        ) : null}
                        {result.meta.fallback ? (
                          <Badge variant="warning">fallback</Badge>
                        ) : null}
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 space-y-3">
                      <div className="max-h-72 overflow-y-auto rounded-lg border border-border bg-background/40 p-3">
                        <Markdown>{content || "—"}</Markdown>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-lg border border-border/70 p-2">
                          <div className="text-[9px] uppercase text-muted-foreground">
                            latency
                          </div>
                          <div className="mt-1 font-mono text-xs">
                            {formatDuration(result.usage.latencyMs)}
                          </div>
                        </div>
                        <div className="rounded-lg border border-border/70 p-2">
                          <div className="text-[9px] uppercase text-muted-foreground">
                            tokens
                          </div>
                          <div className="mt-1 font-mono text-xs">
                            {formatNumber(result.usage.totalTokens)}
                          </div>
                        </div>
                        <div className="rounded-lg border border-border/70 p-2">
                          <div className="text-[9px] uppercase text-muted-foreground">
                            cost
                          </div>
                          <div className="mt-1 font-mono text-xs">
                            {result.usage.costUsd === null
                              ? "n/a"
                              : formatCurrency(result.usage.costUsd)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          request {shortId(result.meta.requestId, 10)}
                          <CopyButton value={result.meta.requestId} />
                        </span>
                        <span>{result.usage.finishReason ?? ""}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="p-6">
                <EmptyState
                  icon={Sparkles}
                  title="Запустите сравнение"
                  description="Выберите 2–3 модели, введите prompt и сравните ответы по latency, токенам и стоимости."
                  className="border-0"
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
