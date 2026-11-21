"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownToLine,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  FileWarning,
  MessageSquareText,
  RefreshCw,
  ScrollText,
  Search,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import {
  lmlogJobSchema,
  signaturePageSchema,
  summarySchema,
  trendSchema,
  type LmlogJob,
  type Signature,
  type SnapshotSummary,
  type Trend,
} from "@/lib/schemas/lmlog";
import { apiFetch, errorMessage } from "@/lib/client/api";
import {
  formatDateTime,
  formatNumber,
  formatPercent,
  truncate,
} from "@/lib/utils";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Sparkline } from "@/components/common/sparkline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChatPanel } from "./chat-panel";
import { ExplainPanel } from "./explain-panel";
import { SignatureSheet } from "./signature-sheet";

function levelVariant(level: string) {
  if (["ERROR", "CRITICAL", "ALERT", "EMERGENCY"].includes(level)) return "danger" as const;
  if (["WARNING", "WARN"].includes(level)) return "warning" as const;
  if (level === "INFO") return "info" as const;
  return "muted" as const;
}

function severityVariant(severity: string) {
  if (severity === "high") return "danger" as const;
  if (severity === "medium") return "warning" as const;
  if (severity === "low") return "info" as const;
  return "muted" as const;
}

function dailyValues(daily: Record<string, number>) {
  return Object.entries(daily)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, value]) => value);
}

function TrendCard({
  trend,
  snapshotId,
  onAsk,
}: {
  trend: Trend;
  snapshotId: string;
  onAsk: (signature: string) => void;
}) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={severityVariant(trend.severity)}>{trend.severity}</Badge>
          <Badge variant="outline">{trend.kind}</Badge>
          <span className="ml-auto text-[10px] text-muted-foreground">
            {formatNumber(trend.count)} строк · {formatNumber(trend.errors)} errors
          </span>
        </div>
        <div className="font-mono text-[11px] leading-relaxed">
          {truncate(trend.sample, 220)}
        </div>
        <div className="rounded-lg border border-border/70 bg-secondary/10 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
          {trend.note}
        </div>
        <Sparkline data={dailyValues(trend.daily)} height={36} color="var(--chart-3)" />
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAsk(trend.signature)}
          >
            <MessageSquareText className="size-3.5" />
            Спросить
          </Button>
          <ExplainPanel snapshotId={snapshotId} signature={trend.signature} compact />
        </div>
      </CardContent>
    </Card>
  );
}

export function SnapshotView({
  snapshotId,
  initial,
}: {
  snapshotId: string;
  initial?: { job?: LmlogJob; summary?: SnapshotSummary };
}) {
  const [tab, setTab] = React.useState("signatures");
  const [search, setSearch] = React.useState("");
  const [deferredSearch, setDeferredSearch] = React.useState("");
  const [level, setLevel] = React.useState("all");
  const [hasErrors, setHasErrors] = React.useState(false);
  const [sort, setSort] = React.useState("count");
  const [order, setOrder] = React.useState("desc");
  const [offset, setOffset] = React.useState(0);
  const [selected, setSelected] = React.useState<Signature | null>(null);
  const [chatSignature, setChatSignature] = React.useState("");
  const pageSize = 50;

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setDeferredSearch(search.trim());
      setOffset(0);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const jobQuery = useQuery({
    queryKey: ["lmlog-job", snapshotId],
    queryFn: () => apiFetch(lmlogJobSchema, `/api/lmlog/jobs/${snapshotId}`),
    initialData: initial?.job,
  });
  const summaryQuery = useQuery({
    queryKey: ["lmlog-summary", snapshotId],
    queryFn: () => apiFetch(summarySchema, `/api/lmlog/snapshots/${snapshotId}/summary`),
    initialData: initial?.summary,
  });

  const signatureParams = new URLSearchParams({
    limit: String(pageSize),
    offset: String(offset),
    sort,
    order,
  });
  if (deferredSearch) signatureParams.set("q", deferredSearch);
  if (level !== "all") signatureParams.set("level", level);
  if (hasErrors) signatureParams.set("hasErrors", "true");

  const signaturesQuery = useQuery({
    queryKey: ["lmlog-signatures", snapshotId, signatureParams.toString()],
    queryFn: () =>
      apiFetch(
        signaturePageSchema,
        `/api/lmlog/snapshots/${snapshotId}/signatures?${signatureParams.toString()}`,
      ),
    placeholderData: (previous) => previous,
  });
  const errorsQuery = useQuery({
    queryKey: ["lmlog-errors", snapshotId],
    queryFn: () =>
      apiFetch(
        signaturePageSchema,
        `/api/lmlog/snapshots/${snapshotId}/errors?limit=100`,
      ),
  });
  const trendsQuery = useQuery({
    queryKey: ["lmlog-trends", snapshotId],
    queryFn: () =>
      apiFetch(
        trendSchema.array(),
        `/api/lmlog/snapshots/${snapshotId}/trends?days=7&limit=30`,
      ),
    enabled: tab === "trends" || tab === "chat",
  });

  function ask(signature: string) {
    setChatSignature(signature);
    setTab("chat");
  }

  const summary = summaryQuery.data;
  const signatures = signaturesQuery.data?.items ?? [];
  const errorRate =
    summary && summary.entries > 0 ? summary.errors / summary.entries : 0;

  if (summaryQuery.isError) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/logs">
            <ArrowLeft className="size-3.5" />
            К логам
          </Link>
        </Button>
        <ErrorState
          title="Не удалось открыть снимок"
          message={errorMessage(summaryQuery.error)}
          onRetry={() => summaryQuery.refetch()}
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <Button variant="ghost" size="sm" className="mb-3 -ml-2" asChild>
        <Link href="/logs">
          <ArrowLeft className="size-3.5" />
          К списку снимков
        </Link>
      </Button>

      <PageHeader
        eyebrow="Snapshot / analysis"
        title={jobQuery.data?.filename ?? "Снимок логов"}
        description={
          summary
            ? `Создан ${formatDateTime(summary.created)} · ${formatNumber(summary.entries)} записей · ${formatNumber(summary.signatures)} сигнатур`
            : "Структурный снимок: сигнатуры, ERROR-кластеры, тренды и grounded-чат."
        }
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => {
              void summaryQuery.refetch();
              void signaturesQuery.refetch();
              void errorsQuery.refetch();
              void trendsQuery.refetch();
            }}>
              <RefreshCw className="size-3.5" />
              Обновить
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={`/api/export/lmlog/${snapshotId}/signatures`}>
                <ArrowDownToLine className="size-3.5" />
                Signatures CSV
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={`/api/export/lmlog/${snapshotId}/errors`}>
                <ArrowDownToLine className="size-3.5" />
                Errors CSV
              </a>
            </Button>
          </>
        }
      />

      {summaryQuery.isLoading || !summary ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-28" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Строк / записей"
              value={formatNumber(summary.entries)}
              hint={`${formatNumber(summary.lines)} физических строк`}
              icon={ScrollText}
              tone="info"
            />
            <StatCard
              label="Сигнатур"
              value={formatNumber(summary.signatures)}
              hint="уникальные шаблоны"
              icon={Sparkles}
              tone="success"
            />
            <StatCard
              label="Ошибки"
              value={formatNumber(summary.errors)}
              hint={`${formatPercent(errorRate, 2)} от записей`}
              icon={FileWarning}
              tone={summary.errors ? "danger" : "success"}
            />
            <StatCard
              label="Уровни"
              value={
                <span className="flex flex-wrap gap-1">
                  {Object.entries(summary.levels)
                    .sort(([, left], [, right]) => right - left)
                    .slice(0, 3)
                    .map(([name, count]) => (
                      <Badge key={name} variant={levelVariant(name)}>
                        {name} {formatNumber(count, { compact: true })}
                      </Badge>
                    ))}
                </span>
              }
              hint={`${summary.top_classes.length} классов`}
              icon={TrendingUp}
              tone="warning"
            />
          </div>

          <Tabs value={tab} onValueChange={setTab} className="mt-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <TabsList>
                <TabsTrigger value="signatures">
                  Сигнатуры
                  <Badge variant="muted" className="ml-1 px-1 py-0 text-[9px]">
                    {summary.signatures}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="errors">
                  Ошибки
                  <Badge
                    variant={summary.errors ? "danger" : "muted"}
                    className="ml-1 px-1 py-0 text-[9px]"
                  >
                    {errorsQuery.data?.total ?? summary.errors}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="trends">Тренды</TabsTrigger>
                <TabsTrigger value="chat">Чат</TabsTrigger>
              </TabsList>
              {tab === "signatures" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Поиск по сигнатуре…"
                      className="h-8 w-48 pl-8 text-xs"
                    />
                  </div>
                  <Select
                    value={level}
                    onValueChange={(value) => {
                      setLevel(value);
                      setOffset(0);
                    }}
                  >
                    <SelectTrigger className="h-8 w-32 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все уровни</SelectItem>
                      {["ERROR", "WARNING", "INFO", "DEBUG"].map((value) => (
                        <SelectItem key={value} value={value}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <label className="flex h-8 items-center gap-1.5 rounded-lg border border-border px-2 text-[10px] text-muted-foreground">
                    <Switch
                      checked={hasErrors}
                      onCheckedChange={(value) => {
                        setHasErrors(value);
                        setOffset(0);
                      }}
                      className="scale-75"
                    />
                    errors
                  </label>
                  <Select
                    value={`${sort}:${order}`}
                    onValueChange={(value) => {
                      const [nextSort, nextOrder] = value.split(":");
                      setSort(nextSort ?? "count");
                      setOrder(nextOrder ?? "desc");
                      setOffset(0);
                    }}
                  >
                    <SelectTrigger className="h-8 w-32 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="count:desc">Частота ↓</SelectItem>
                      <SelectItem value="count:asc">Частота ↑</SelectItem>
                      <SelectItem value="errors:desc">Ошибки ↓</SelectItem>
                      <SelectItem value="last_ts:desc">Последние ↓</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>

            <TabsContent value="signatures">
              <Card>
                <CardContent className="px-0 pt-4">
                  {signaturesQuery.isLoading ? (
                    <div className="space-y-2 px-5">
                      {Array.from({ length: 8 }).map((_, index) => (
                        <Skeleton key={index} className="h-12" />
                      ))}
                    </div>
                  ) : signaturesQuery.isError ? (
                    <div className="px-5 pb-4">
                      <ErrorState
                        message={errorMessage(signaturesQuery.error)}
                        onRetry={() => signaturesQuery.refetch()}
                      />
                    </div>
                  ) : signatures.length ? (
                    <>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Сообщение</TableHead>
                            <TableHead>Уровни</TableHead>
                            <TableHead>Строк</TableHead>
                            <TableHead>Ошибок</TableHead>
                            <TableHead>Классы</TableHead>
                            <TableHead>Последний</TableHead>
                            <TableHead>История</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {signatures.map((signature) => (
                            <TableRow
                              key={signature.signature}
                              className="cursor-pointer"
                              onClick={() => setSelected(signature)}
                            >
                              <TableCell className="max-w-[320px]">
                                <div className="truncate font-mono text-[11px]">
                                  {truncate(signature.sample_message, 120)}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {Object.entries(signature.levels).map(([name, count]) => (
                                    <Badge key={name} variant={levelVariant(name)}>
                                      {name} {formatNumber(count)}
                                    </Badge>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell className="font-mono text-[11px]">
                                {formatNumber(signature.count)}
                              </TableCell>
                              <TableCell className="font-mono text-[11px]">
                                {signature.errors ? (
                                  <span className="text-destructive">
                                    {formatNumber(signature.errors)}
                                  </span>
                                ) : (
                                  "—"
                                )}
                              </TableCell>
                              <TableCell className="max-w-[200px]">
                                <div className="truncate text-[10px] text-muted-foreground">
                                  {Object.keys(signature.classes).slice(0, 2).join(", ") || "—"}
                                </div>
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-[10px] text-muted-foreground">
                                {formatDateTime(signature.last_ts)}
                              </TableCell>
                              <TableCell className="w-24">
                                <Sparkline
                                  data={dailyValues(signature.daily)}
                                  height={28}
                                  color={signature.errors ? "var(--chart-5)" : "var(--chart-1)"}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <div className="flex items-center justify-between border-t border-border px-5 py-3">
                        <div className="text-[10px] text-muted-foreground">
                          {signaturesQuery.data
                            ? `${signaturesQuery.data.offset + 1}–${
                                signaturesQuery.data.offset + signatures.length
                              } из ${signaturesQuery.data.total}`
                            : "—"}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={offset === 0}
                            onClick={() => setOffset(Math.max(0, offset - pageSize))}
                          >
                            <ChevronLeft className="size-3.5" />
                            Назад
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={
                              (signaturesQuery.data?.total ?? 0) <= offset + pageSize
                            }
                            onClick={() => setOffset(offset + pageSize)}
                          >
                            Вперёд
                            <ChevronRight className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="px-5 pb-5">
                      <EmptyState
                        icon={ScrollText}
                        title="Сигнатуры не найдены"
                        description="Измените фильтры или поисковый запрос."
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="errors">
              {errorsQuery.isLoading ? (
                <div className="grid gap-3 lg:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-44" />
                  ))}
                </div>
              ) : errorsQuery.data?.items.length ? (
                <div className="grid gap-3 lg:grid-cols-2">
                  {errorsQuery.data.items.map((signature) => (
                    <Card key={signature.signature}>
                      <CardContent className="space-y-3 p-4">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="danger">{signature.errors} errors</Badge>
                          <Badge variant="secondary">{formatNumber(signature.count)} строк</Badge>
                          <span className="ml-auto text-[10px] text-muted-foreground">
                            {formatDateTime(signature.last_ts)}
                          </span>
                        </div>
                        <button
                          className="text-left font-mono text-[11px] leading-relaxed hover:text-primary"
                          onClick={() => setSelected(signature)}
                        >
                          {truncate(signature.sample_message, 220)}
                        </button>
                        {Object.keys(signature.classes).length ? (
                          <div className="flex flex-wrap gap-1">
                            {Object.keys(signature.classes)
                              .slice(0, 4)
                              .map((name) => (
                                <Badge key={name} variant="outline" className="font-mono text-[9px]">
                                  {name}
                                </Badge>
                              ))}
                          </div>
                        ) : null}
                        <Sparkline
                          data={dailyValues(signature.daily)}
                          height={32}
                          color="var(--chart-5)"
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <ExplainPanel
                            snapshotId={snapshotId}
                            signature={signature.signature}
                            compact
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => ask(signature.signature)}
                          >
                            <MessageSquareText className="size-3.5" />
                            Спросить
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={FileWarning}
                  title="ERROR-кластеров нет"
                  description="В этом снимке нет строк уровня ERROR/CRITICAL/ALERT/EMERGENCY."
                />
              )}
            </TabsContent>

            <TabsContent value="trends">
              {trendsQuery.isLoading ? (
                <div className="grid gap-3 lg:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-44" />
                  ))}
                </div>
              ) : trendsQuery.data?.length ? (
                <div className="grid gap-3 lg:grid-cols-2">
                  {trendsQuery.data.map((trend) => (
                    <TrendCard
                      key={`${trend.signature}-${trend.kind}-${trend.note}`}
                      trend={trend}
                      snapshotId={snapshotId}
                      onAsk={ask}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={TrendingUp}
                  title="Аномалий не найдено"
                  description="Для трендов нужна история по дням. Загрузите лог, покрывающий несколько дней."
                />
              )}
            </TabsContent>

            <TabsContent value="chat">
              <ChatPanel
                snapshotId={snapshotId}
                signature={chatSignature || undefined}
                onClearSignature={() => setChatSignature("")}
                onOpenSignature={(signature) => {
                  const found = signatures.find((item) => item.signature === signature);
                  if (found) setSelected(found);
                }}
              />
            </TabsContent>
          </Tabs>
        </>
      )}

      <SignatureSheet
        signature={selected}
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
        snapshotId={snapshotId}
        onAsk={ask}
      />
    </div>
  );
}
