"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownToLine,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ListTree,
  RefreshCw,
  Search,
  Timer,
  TriangleAlert,
} from "lucide-react";
import { z } from "zod";
import type { AuditRecord, Tenant } from "@/lib/schemas/gogate";
import { tenantSchema } from "@/lib/schemas/gogate";
import {
  traceLinkSchema,
  traceResponseSchema,
  auditListSchema,
  type AuditList,
} from "@/lib/schemas/requests";
import { apiFetch, errorMessage } from "@/lib/client/api";
import {
  cn,
  formatCurrency,
  formatDateTime,
  formatDuration,
  formatNumber,
  formatRelative,
  shortId,
} from "@/lib/utils";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { CopyButton } from "@/components/common/copy-button";
import { JsonView } from "@/components/common/json-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TraceWaterfall } from "./trace-waterfall";

type Range = "1h" | "24h" | "7d";
const rangeMs: Record<Range, number> = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};
const pageSize = 50;

function statusVariant(status: number) {
  if (status >= 500) return "danger" as const;
  if (status >= 400) return "warning" as const;
  if (status >= 300) return "info" as const;
  return "success" as const;
}

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/70 bg-secondary/10 p-2.5">
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 break-words text-xs">{children}</div>
    </div>
  );
}

export function RequestsView({
  initial,
}: {
  initial?: { audit?: AuditList; tenants?: Tenant[] };
}) {
  const [range, setRange] = React.useState<Range>("24h");
  const [tenantId, setTenantId] = React.useState("all");
  const [model, setModel] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [cache, setCache] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [deferredSearch, setDeferredSearch] = React.useState("");
  const [offset, setOffset] = React.useState(0);
  const [auto, setAuto] = React.useState(true);
  const [selected, setSelected] = React.useState<AuditRecord | null>(null);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setDeferredSearch(search.trim());
      setOffset(0);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const tenantsQuery = useQuery({
    queryKey: ["tenants"],
    queryFn: () => apiFetch(z.array(tenantSchema), "/api/tenants"),
    staleTime: 60_000,
    initialData: initial?.tenants,
  });
  const tenantsById = new Map(
    (tenantsQuery.data ?? []).map((tenant: Tenant) => [tenant.id, tenant.name]),
  );

  function buildParams() {
    const params = new URLSearchParams();
    params.set("from", new Date(Date.now() - rangeMs[range]).toISOString());
    params.set("limit", String(pageSize));
    params.set("offset", String(offset));
    if (tenantId !== "all") params.set("tenantId", tenantId);
    if (model.trim()) params.set("model", model.trim());
    if (status !== "all") params.set("status", status);
    if (cache !== "all") params.set("cache", cache);
    if (deferredSearch) params.set("q", deferredSearch);
    return params;
  }

  const isDefaultQuery =
    range === "24h" &&
    tenantId === "all" &&
    !model.trim() &&
    status === "all" &&
    cache === "all" &&
    !deferredSearch &&
    offset === 0;
  const auditQuery = useQuery({
    queryKey: [
      "requests",
      range,
      tenantId,
      model,
      status,
      cache,
      deferredSearch,
      offset,
    ],
    queryFn: () =>
      apiFetch(auditListSchema, `/api/requests?${buildParams().toString()}`),
    refetchInterval: auto ? 10_000 : false,
    refetchIntervalInBackground: false,
    placeholderData: (previous) => previous,
    initialData: isDefaultQuery ? initial?.audit : undefined,
  });
  const items = auditQuery.data?.items ?? [];
  const errorCount = items.filter((item) => item.status >= 400).length;
  const cost = items.reduce((sum, item) => sum + item.cost_usd, 0);

  const traceQuery = useQuery({
    queryKey: ["trace", selected?.trace_id],
    queryFn: () =>
      apiFetch(traceResponseSchema, `/api/traces/${selected?.trace_id}`),
    enabled: Boolean(selected?.trace_id),
  });
  const linkQuery = useQuery({
    queryKey: ["trace-link", selected?.created_at],
    queryFn: () =>
      apiFetch(
        traceLinkSchema,
        `/api/traces/link?at=${encodeURIComponent(selected?.created_at ?? "")}`,
      ),
    enabled: Boolean(selected && !selected.trace_id),
  });

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Audit / traces"
        title="Запросы и трейсы"
        description="Метаданные запросов из gogate audit: статусы, провайдеры, cache, токены и стоимость. Для сохранённых trace_id открывается реальный span waterfall в Jaeger."
        actions={
          <>
            <div className="flex items-center rounded-lg border border-border bg-card/60 p-0.5">
              {(["1h", "24h", "7d"] as Range[]).map((value) => (
                <button
                  key={value}
                  onClick={() => { setRange(value); setOffset(0); }}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 text-[11px] transition-colors",
                    range === value
                      ? "bg-secondary text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
            <label className="flex h-8 items-center gap-2 rounded-lg border border-border bg-card/60 px-2.5 text-[11px] text-muted-foreground">
              <Switch checked={auto} onCheckedChange={setAuto} className="scale-75" />
              Авто
            </label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => auditQuery.refetch()}
              disabled={auditQuery.isFetching}
            >
              <RefreshCw className={cn("size-3.5", auditQuery.isFetching && "animate-spin")} />
              Обновить
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const link = document.createElement("a");
                link.href = `/api/export/requests?${buildParams().toString()}`;
                link.click();
              }}
            >
              <ArrowDownToLine className="size-3.5" />
              CSV
            </Button>
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card/60 px-4 py-3">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
            <ListTree className="size-3.5" />
            На странице
          </div>
          <div className="mt-1 text-xl font-semibold tabular">{formatNumber(items.length)}</div>
        </div>
        <div className="rounded-xl border border-border bg-card/60 px-4 py-3">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
            <TriangleAlert className="size-3.5" />
            С ошибками
          </div>
          <div className="mt-1 text-xl font-semibold tabular text-warning">
            {formatNumber(errorCount)}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card/60 px-4 py-3">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
            <Timer className="size-3.5" />
            Стоимость страницы
          </div>
          <div className="mt-1 text-xl font-semibold tabular">{formatCurrency(cost)}</div>
        </div>
      </div>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="request_id или key_prefix…"
                className="h-8 pl-8 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Select value={tenantId} onValueChange={(value) => { setTenantId(value); setOffset(0); }}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Тенант" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все тенанты</SelectItem>
                  {(tenantsQuery.data ?? []).map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={model}
                onChange={(event) => { setModel(event.target.value); setOffset(0); }}
                placeholder="model"
                className="h-8 font-mono text-xs"
              />
              <Select value={status} onValueChange={(value) => { setStatus(value); setOffset(0); }}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Статус" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Любой статус</SelectItem>
                  {[200, 400, 401, 404, 429, 500, 502, 503, 504].map((code) => (
                    <SelectItem key={code} value={String(code)}>
                      {code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={cache} onValueChange={(value) => { setCache(value); setOffset(0); }}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Cache" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Любой cache</SelectItem>
                  {["HIT", "MISS", "SEMANTIC", "BYPASS"].map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>
              {auditQuery.data
                ? `offset ${auditQuery.data.offset} · limit ${auditQuery.data.limit}`
                : "—"}
              {auditQuery.isFetching ? " · обновляем…" : ""}
            </span>
            <span>Данные из /admin/v1/audit</span>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {auditQuery.isLoading ? (
            <div className="space-y-2 px-5 pb-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-11" />
              ))}
            </div>
          ) : auditQuery.isError ? (
            <div className="px-5 pb-5">
              <ErrorState
                title="Не удалось загрузить audit"
                message={errorMessage(auditQuery.error)}
                onRetry={() => auditQuery.refetch()}
              />
            </div>
          ) : items.length ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Время</TableHead>
                    <TableHead>Request ID</TableHead>
                    <TableHead>Тенант</TableHead>
                    <TableHead>Модель / provider</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Cache</TableHead>
                    <TableHead>Токены</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Latency</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((record) => (
                    <TableRow
                      key={`${record.request_id}-${record.created_at}`}
                      className="cursor-pointer"
                      onClick={() => setSelected(record)}
                    >
                      <TableCell className="whitespace-nowrap text-[11px] text-muted-foreground">
                        <div>{formatDateTime(record.created_at)}</div>
                        <div className="text-[9px]">{formatRelative(record.created_at)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 font-mono text-[10px]">
                          {shortId(record.request_id, 18)}
                          <CopyButton value={record.request_id} />
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {tenantsById.get(record.tenant_id) ?? shortId(record.tenant_id)}
                      </TableCell>
                      <TableCell>
                        <div className="font-mono text-[11px]">{record.model}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {record.provider || "—"}
                          {record.stream ? " · stream" : ""}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(record.status)}>{record.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={record.cache ? cacheVariant(record.cache) : "muted"}>
                          {record.cache || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-[10px]">
                        {formatNumber(record.prompt_tokens)} /{" "}
                        {formatNumber(record.completion_tokens)}
                      </TableCell>
                      <TableCell className="font-mono text-[10px]">
                        {formatCurrency(record.cost_usd)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "font-mono text-[10px]",
                            record.latency_ms > 2000
                              ? "text-destructive"
                              : record.latency_ms > 500
                                ? "text-warning"
                                : "text-muted-foreground",
                          )}
                        >
                          {formatDuration(record.latency_ms)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {record.trace_id ? (
                          <Badge variant="info" className="text-[9px]">
                            trace
                          </Badge>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between border-t border-border px-5 py-3">
                <div className="text-[10px] text-muted-foreground">
                  {items.length ? `${offset + 1}–${offset + items.length}` : "0"}
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
                    disabled={items.length < pageSize}
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
                icon={ListTree}
                title="Запросов не найдено"
                description="Измените фильтры или диапазон. Audit включается флагом GOGATE_AUDIT_ENABLED."
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              Request {selected ? shortId(selected.request_id, 20) : ""}
            </SheetTitle>
            <SheetDescription>
              {selected ? formatDateTime(selected.created_at) : ""} ·{" "}
              {selected?.model} / {selected?.provider || "—"}
            </SheetDescription>
          </SheetHeader>
          <SheetBody className="space-y-5">
            {selected ? (
              <>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant={statusVariant(selected.status)}>
                    HTTP {selected.status}
                  </Badge>
                  <Badge variant={cacheVariant(selected.cache || "MISS")}>
                    cache {selected.cache || "—"}
                  </Badge>
                  {selected.stream ? <Badge variant="info">stream</Badge> : null}
                  {selected.pii_redacted ? (
                    <Badge variant="warning">PII redacted</Badge>
                  ) : null}
                  {selected.error_code ? (
                    <Badge variant="danger">{selected.error_code}</Badge>
                  ) : null}
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Tenant">
                    {tenantsById.get(selected.tenant_id) ?? selected.tenant_id}
                  </Field>
                  <Field label="Key prefix">
                    <span className="font-mono">{selected.key_prefix || "—"}</span>
                  </Field>
                  <Field label="Latency">
                    <span className="font-mono">{formatDuration(selected.latency_ms)}</span>
                  </Field>
                  <Field label="Cost">
                    <span className="font-mono">{formatCurrency(selected.cost_usd)}</span>
                  </Field>
                  <Field label="Tokens (prompt / completion)">
                    <span className="font-mono">
                      {formatNumber(selected.prompt_tokens)} /{" "}
                      {formatNumber(selected.completion_tokens)}
                    </span>
                  </Field>
                  <Field label="Request ID">
                    <span className="flex items-center gap-1 font-mono text-[11px]">
                      {selected.request_id}
                      <CopyButton value={selected.request_id} />
                    </span>
                  </Field>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-xs font-medium">Trace</div>
                    {selected.trace_id ? (
                      <div className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                        {selected.trace_id}
                        <CopyButton value={selected.trace_id} />
                      </div>
                    ) : null}
                  </div>
                  {selected.trace_id ? (
                    traceQuery.isLoading ? (
                      <Skeleton className="h-40" />
                    ) : traceQuery.data?.trace ? (
                      <TraceWaterfall trace={traceQuery.data.trace} />
                    ) : (
                      <div className="rounded-lg border border-warning/25 bg-warning/5 p-3 text-[11px] text-muted-foreground">
                        Trace не найден в Jaeger. Возможно, tracing выключен или
                        сэмпл не сохранён.
                      </div>
                    )
                  ) : (
                    <div className="space-y-2 rounded-lg border border-border bg-secondary/10 p-3 text-[11px] text-muted-foreground">
                      <div>
                        У запроса нет trace_id: tracing выключен либо запись
                        создана до включения корреляции.
                      </div>
                      {linkQuery.data?.url ? (
                        <Button variant="outline" size="sm" asChild>
                          <a href={linkQuery.data.url} target="_blank" rel="noreferrer">
                            <ExternalLink className="size-3.5" />
                            Найти в Jaeger по времени
                          </a>
                        </Button>
                      ) : null}
                    </div>
                  )}
                </div>

                <div>
                  <div className="mb-2 text-xs font-medium">Audit record</div>
                  <JsonView value={selected} maxHeight="22rem" />
                </div>
              </>
            ) : null}
          </SheetBody>
        </SheetContent>
      </Sheet>
    </div>
  );
}
