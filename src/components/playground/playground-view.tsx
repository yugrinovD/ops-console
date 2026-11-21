"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUp,
  Bot,
  Braces,
  CircleStop,
  Cpu,
  Eraser,
  Info,
  Play,
  RotateCcw,
  Sparkles,
  TerminalSquare,
  UserRound,
  Zap,
} from "lucide-react";
import type { ChatCompletion, PublicProvider } from "@/lib/schemas/gogate";
import {
  modelCatalogSchema,
  playgroundResponseSchema,
} from "@/lib/schemas/gogate";
import type { Role } from "@/lib/session";
import { apiFetch, apiStream, errorMessage } from "@/lib/client/api";
import { readSse } from "@/lib/client/sse";
import {
  cn,
  formatCurrency,
  formatDuration,
  formatNumber,
  generateId,
  shortId,
} from "@/lib/utils";
import { PageHeader } from "@/components/common/page-header";
import { CopyButton } from "@/components/common/copy-button";
import { Markdown } from "@/components/common/markdown";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

interface PlaygroundMeta {
  requestId: string;
  provider: string;
  cache: string;
  fallback: boolean;
  chain: string[];
  model: string;
}

interface PlaygroundUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number | null;
  latencyMs: number;
  finishReason: string | null;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  meta?: PlaygroundMeta;
  usage?: PlaygroundUsage;
  error?: string;
  streaming?: boolean;
}

const suggestions = [
  "Объясни, что делает этот шлюз, в трёх пунктах.",
  "Сгенерируй JSON с полями model, provider и cache.",
  "Напиши короткий чек-лист для проверки latency p95.",
];

function cacheVariant(cache: string) {
  switch (cache) {
    case "HIT":
    case "SEMANTIC":
      return "success" as const;
    case "BYPASS":
      return "warning" as const;
    default:
      return "muted" as const;
  }
}

function providerChain(model: string, providers: PublicProvider[]) {
  return providers
    .filter((provider) => provider.enabled && provider.models.includes(model))
    .sort((left, right) => left.priority - right.priority);
}

function extractContent(response: ChatCompletion) {
  return response.choices[0]?.message.content ?? "";
}

export function PlaygroundView({ role }: { role: Role }) {
  const searchParams = useSearchParams();
  const initialModel = searchParams.get("model") ?? "";
  const [model, setModel] = React.useState(initialModel);
  const [systemPrompt, setSystemPrompt] = React.useState("");
  const [temperature, setTemperature] = React.useState(0.2);
  const [maxTokens, setMaxTokens] = React.useState(256);
  const [stream, setStream] = React.useState(true);
  const [prompt, setPrompt] = React.useState("");
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [loading, setLoading] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const catalog = useQuery({
    queryKey: ["model-catalog"],
    queryFn: () => apiFetch(modelCatalogSchema, "/api/models"),
    staleTime: 60_000,
  });

  React.useEffect(() => {
    if (!model && catalog.data?.models.length) {
      setModel(catalog.data.models[0] ?? "");
    }
  }, [catalog.data, model]);

  React.useEffect(() => {
    const container = scrollRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages]);

  const chain = React.useMemo(
    () => providerChain(model, catalog.data?.providers ?? []),
    [catalog.data?.providers, model],
  );
  const price = React.useMemo(
    () => catalog.data?.prices.find((item) => item.model === model),
    [catalog.data?.prices, model],
  );
  const readOnly = role !== "admin";

  function updateMessage(id: string, updater: (message: Message) => Message) {
    setMessages((current) =>
      current.map((message) => (message.id === id ? updater(message) : message)),
    );
  }

  async function send(text?: string) {
    const content = (text ?? prompt).trim();
    if (!content || loading || !model || readOnly) return;
    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content,
    };
    const assistantId = generateId();
    const assistantMessage: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      streaming: true,
    };
    const history = messages
      .filter((message) => !message.error)
      .map((message) => ({ role: message.role, content: message.content }));
    setMessages((current) => [...current, userMessage, assistantMessage]);
    setPrompt("");
    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const body = {
      model,
      messages: [
        ...(systemPrompt.trim()
          ? [{ role: "system" as const, content: systemPrompt.trim() }]
          : []),
        ...history,
        { role: "user" as const, content },
      ],
      temperature,
      maxTokens,
      stream,
    };
    try {
      if (stream) {
        const response = await apiStream("/api/playground", body, controller.signal);
        await readSse(
          response,
          (event) => {
            const data = event.data as Record<string, unknown>;
            if (event.event === "meta") {
              updateMessage(assistantId, (message) => ({
                ...message,
                meta: data as unknown as PlaygroundMeta,
              }));
            } else if (event.event === "delta") {
              updateMessage(assistantId, (message) => ({
                ...message,
                content: message.content + String(data.text ?? ""),
              }));
            } else if (event.event === "usage") {
              updateMessage(assistantId, (message) => ({
                ...message,
                usage: data as unknown as PlaygroundUsage,
              }));
            } else if (event.event === "error") {
              updateMessage(assistantId, (message) => ({
                ...message,
                error: String(data.message ?? "Ошибка потока"),
                streaming: false,
              }));
            } else if (event.event === "done") {
              updateMessage(assistantId, (message) => ({
                ...message,
                streaming: false,
              }));
            }
          },
          controller.signal,
        );
      } else {
        const result = await apiFetch(playgroundResponseSchema, "/api/playground", {
          method: "POST",
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        updateMessage(assistantId, (message) => ({
          ...message,
          content: extractContent(result.response),
          meta: result.meta,
          usage: result.usage,
          streaming: false,
        }));
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        updateMessage(assistantId, (message) => ({
          ...message,
          error: errorMessage(error),
          streaming: false,
        }));
      } else {
        updateMessage(assistantId, (message) => ({
          ...message,
          streaming: false,
        }));
      }
    } finally {
      updateMessage(assistantId, (message) => ({
        ...message,
        streaming: false,
      }));
      setLoading(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
    setLoading(false);
  }

  function reset() {
    stop();
    setMessages([]);
    setPrompt("");
  }

  function retryLast() {
    const lastUser = [...messages].reverse().find((message) => message.role === "user");
    if (lastUser) void send(lastUser.content);
  }

  const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant");

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="AI / streaming"
        title="Playground"
        description="Проверяйте модели, температуру, fallback-цепочку и фактическую стоимость запроса. Поток идёт через BFF: ключи не попадают в браузер."
        actions={
          <>
            {catalog.data?.providers.length ? (
              <Badge variant="outline" className="h-7 gap-1.5">
                <Zap className="size-3" />
                {catalog.data.models.length} моделей
              </Badge>
            ) : null}
            <Button variant="outline" size="sm" onClick={reset}>
              <Eraser className="size-3.5" />
              Очистить
            </Button>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <Card className="h-fit xl:sticky xl:top-20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Braces className="size-4 text-primary" />
              Параметры
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {catalog.isError ? (
              <ErrorState
                title="Каталог моделей недоступен"
                message={errorMessage(catalog.error)}
                onRetry={() => catalog.refetch()}
              />
            ) : catalog.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-9" />
                <Skeleton className="h-20" />
                <Skeleton className="h-9" />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Модель</Label>
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите модель" />
                    </SelectTrigger>
                    <SelectContent>
                      {(catalog.data?.models ?? []).map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {chain.length ? (
                    <div className="space-y-1.5 rounded-lg border border-border/70 bg-secondary/20 p-2.5">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Fallback chain
                      </div>
                      {chain.map((provider, index) => (
                        <div
                          key={provider.id}
                          className="flex items-center gap-2 text-[11px]"
                        >
                          <span className="flex size-4 items-center justify-center rounded-full bg-muted text-[9px] text-muted-foreground">
                            {index + 1}
                          </span>
                          <span className="truncate font-medium">{provider.name}</span>
                          <Badge variant="outline" className="ml-auto text-[9px]">
                            {provider.kind}
                          </Badge>
                          {provider.breaker === 2 || provider.breaker === "open" ? (
                            <Badge variant="danger" className="text-[9px]">
                              open
                            </Badge>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : model ? (
                    <div className="rounded-lg border border-warning/25 bg-warning/5 p-2 text-[11px] text-muted-foreground">
                      Для модели нет включённых провайдеров.
                    </div>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="system">System prompt</Label>
                  <Textarea
                    id="system"
                    value={systemPrompt}
                    onChange={(event) => setSystemPrompt(event.target.value)}
                    placeholder="Необязательно. Например: отвечай кратко и по делу."
                    className="min-h-20 text-xs"
                    maxLength={4000}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Temperature</Label>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {temperature.toFixed(1)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.1}
                    value={temperature}
                    onChange={(event) => setTemperature(Number(event.target.value))}
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-[var(--primary)]"
                  />
                  <div className="flex justify-between text-[9px] text-muted-foreground">
                    <span>детерминированно</span>
                    <span>креативно</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="maxTokens">Max tokens</Label>
                    <Input
                      id="maxTokens"
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
                  <div className="flex flex-col justify-end space-y-2">
                    <Label>Стриминг</Label>
                    <label className="flex h-9 items-center gap-2 rounded-lg border border-border bg-secondary/20 px-3 text-xs">
                      <Switch checked={stream} onCheckedChange={setStream} />
                      SSE
                    </label>
                  </div>
                </div>

                {price ? (
                  <div className="rounded-lg border border-border/70 p-2.5 text-[10px] text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span>Вход</span>
                      <span className="font-mono">
                        {formatCurrency(price.input_usd_per_1m)} / 1M
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span>Выход</span>
                      <span className="font-mono">
                        {formatCurrency(price.output_usd_per_1m)} / 1M
                      </span>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="flex min-h-[640px] flex-col overflow-hidden">
          <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-border">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TerminalSquare className="size-4 text-primary" />
                Диалог
              </CardTitle>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {model || "Модель не выбрана"} ·{" "}
                {stream ? "streaming" : "non-streaming"}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {lastAssistant?.meta?.requestId ? (
                <span className="hidden items-center gap-1 text-[10px] text-muted-foreground sm:flex">
                  request {shortId(lastAssistant.meta.requestId, 10)}
                  <CopyButton value={lastAssistant.meta.requestId} />
                </span>
              ) : null}
              {messages.length ? (
                <Button variant="ghost" size="sm" onClick={retryLast} disabled={loading}>
                  <RotateCcw className="size-3.5" />
                  Повторить
                </Button>
              ) : null}
            </div>
          </CardHeader>

          <CardContent ref={scrollRef} className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-5">
            {!messages.length ? (
              <div className="flex flex-1 flex-col items-center justify-center">
                <EmptyState
                  icon={Sparkles}
                  title="Отправьте первый запрос"
                  description="Выберите модель, настройте параметры и проверьте ответ. В метаданных будут provider, cache, request_id, usage и стоимость."
                  className="w-full border-0"
                  action={
                    <div className="flex flex-col gap-2 sm:flex-row">
                      {suggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          onClick={() => setPrompt(suggestion)}
                          className="max-w-56 rounded-lg border border-border bg-secondary/30 px-3 py-2 text-left text-[11px] text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  }
                />
              </div>
            ) : (
              <div className="space-y-5">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-3",
                      message.role === "user" && "flex-row-reverse",
                    )}
                  >
                    <div
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-lg border",
                        message.role === "assistant"
                          ? "border-primary/25 bg-primary/10 text-primary"
                          : "border-border bg-secondary text-muted-foreground",
                      )}
                    >
                      {message.role === "assistant" ? (
                        <Bot className="size-4" />
                      ) : (
                        <UserRound className="size-4" />
                      )}
                    </div>
                    <div
                      className={cn(
                        "min-w-0 max-w-[86%] space-y-2",
                        message.role === "user" && "items-end text-right",
                      )}
                    >
                      <div
                        className={cn(
                          "rounded-xl border px-3.5 py-2.5 text-sm",
                          message.role === "assistant"
                            ? "border-border bg-card"
                            : "border-primary/20 bg-primary/10",
                        )}
                      >
                        {message.error ? (
                          <div className="text-xs text-destructive">
                            {message.error}
                          </div>
                        ) : message.role === "assistant" ? (
                          <div className={message.streaming ? "stream-caret" : ""}>
                            <Markdown>{message.content || " "}</Markdown>
                          </div>
                        ) : (
                          <div className="whitespace-pre-wrap">{message.content}</div>
                        )}
                      </div>
                      {message.role === "assistant" && (message.meta || message.usage) ? (
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                          {message.meta ? (
                            <>
                              <Badge variant="outline" className="gap-1">
                                <Cpu className="size-2.5" />
                                {message.meta.provider || "—"}
                              </Badge>
                              {message.meta.cache ? (
                                <Badge variant={cacheVariant(message.meta.cache)}>
                                  cache {message.meta.cache}
                                </Badge>
                              ) : null}
                              {message.meta.fallback ? (
                                <Badge variant="warning">fallback</Badge>
                              ) : null}
                              <span className="inline-flex items-center gap-0.5">
                                id {shortId(message.meta.requestId, 10)}
                                <CopyButton value={message.meta.requestId} />
                              </span>
                            </>
                          ) : null}
                          {message.usage ? (
                            <>
                              <span>
                                {formatNumber(message.usage.promptTokens)} +{" "}
                                {formatNumber(message.usage.completionTokens)} токенов
                              </span>
                              <span>{formatDuration(message.usage.latencyMs)}</span>
                              <span className="font-mono">
                                {message.usage.costUsd === null
                                  ? "cost n/a"
                                  : formatCurrency(message.usage.costUsd)}
                              </span>
                              {message.usage.finishReason ? (
                                <span>finish={message.usage.finishReason}</span>
                              ) : null}
                            </>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>

          <div className="border-t border-border p-4">
            {readOnly ? (
              <div className="flex items-center gap-2 rounded-lg border border-warning/25 bg-warning/5 px-3 py-2 text-[11px] text-muted-foreground">
                <Info className="size-3.5 text-warning" />
                Роль viewer не может отправлять запросы в playground.
              </div>
            ) : (
              <>
                <div className="flex items-end gap-2">
                  <Textarea
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    onKeyDown={(event) => {
                      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                        event.preventDefault();
                        void send();
                      }
                    }}
                    placeholder="Сообщение… ⌘↩ отправить"
                    className="min-h-20 flex-1 resize-none text-sm"
                    maxLength={20_000}
                    disabled={loading}
                  />
                  {loading ? (
                    <Button variant="destructive" size="icon" onClick={stop} aria-label="Остановить">
                      <CircleStop className="size-4" />
                    </Button>
                  ) : (
                    <Button
                      size="icon"
                      onClick={() => void send()}
                      disabled={!prompt.trim() || !model}
                      aria-label="Отправить"
                    >
                      <ArrowUp className="size-4" />
                    </Button>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>
                    {model ? `модель: ${model}` : "выберите модель"} ·{" "}
                    {formatNumber(maxTokens)} max tokens
                  </span>
                  <span className="flex items-center gap-1">
                    <Play className="size-2.5" />
                    запросы идут через серверный BFF
                  </span>
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      {catalog.data?.warnings.length ? (
        <div className="mt-4 rounded-xl border border-warning/20 bg-warning/5 px-4 py-3 text-[11px] text-muted-foreground">
          {catalog.data.warnings.join(" · ")}
        </div>
      ) : null}
    </div>
  );
}
