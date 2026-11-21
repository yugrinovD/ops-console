"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Clock,
  FileText,
  Loader2,
  RefreshCw,
  ScrollText,
  Upload,
  WifiOff,
} from "lucide-react";
import { z } from "zod";
import {
  jobCreatedSchema,
  lmlogJobSchema,
  type LmlogJob,
} from "@/lib/schemas/lmlog";
import type { Role } from "@/lib/session";
import { apiFetch, ApiClientError, errorMessage } from "@/lib/client/api";
import {
  cn,
  formatBytes,
  formatDateTime,
  formatNumber,
  formatRelative,
  getCookie,
} from "@/lib/utils";
import { CSRF_COOKIE } from "@/lib/session-constants";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const jobsSchema = z.array(lmlogJobSchema);
const ALLOWED = [".log", ".txt", ".jsonl"];

interface JobProgress {
  phase?: string;
  percent?: number;
  lines?: number;
  entries?: number;
  bytes?: number;
  total_bytes?: number;
}

interface ActiveJob {
  id: string;
  filename: string;
  status: "queued" | "running" | "completed" | "failed";
  progress: JobProgress;
  stats?: Record<string, unknown> | null;
  error?: string | null;
  reconnecting?: boolean;
}

function statusBadge(status: LmlogJob["status"]) {
  switch (status) {
    case "completed":
      return { variant: "success" as const, label: "готово" };
    case "failed":
      return { variant: "danger" as const, label: "ошибка" };
    case "running":
      return { variant: "info" as const, label: "обработка" };
    default:
      return { variant: "muted" as const, label: "в очереди" };
  }
}

function statsValue(stats: LmlogJob["stats"], key: string) {
  const value = stats?.[key];
  return typeof value === "number" ? value : null;
}

export function LogsView({
  role,
  initial,
  maxUploadMb = 50,
}: {
  role: Role;
  initial?: { jobs?: LmlogJob[] };
  maxUploadMb?: number;
}) {
  const queryClient = useQueryClient();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const [activeJob, setActiveJob] = React.useState<ActiveJob | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const eventsRef = React.useRef<EventSource | null>(null);
  const isAdmin = role === "admin";

  const jobsQuery = useQuery({
    queryKey: ["lmlog-jobs"],
    queryFn: () => apiFetch(jobsSchema, "/api/lmlog/jobs"),
    initialData: initial?.jobs,
    refetchInterval: (query) => {
      const jobs = query.state.data;
      return jobs?.some((job) => job.status === "queued" || job.status === "running")
        ? 4000
        : 15_000;
    },
  });

  React.useEffect(() => {
    return () => {
      eventsRef.current?.close();
    };
  }, []);

  function subscribe(jobId: string, filename: string) {
    eventsRef.current?.close();
    setActiveJob({
      id: jobId,
      filename,
      status: "queued",
      progress: {},
    });
    const source = new EventSource(`/api/lmlog/jobs/${jobId}/events`);
    eventsRef.current = source;
    const update = (patch: Partial<ActiveJob>) =>
      setActiveJob((current) => (current ? { ...current, ...patch } : current));

    source.addEventListener("started", () => {
      update({ status: "running", reconnecting: false });
    });
    source.addEventListener("progress", (event) => {
      const data = JSON.parse((event as MessageEvent).data) as JobProgress;
      update({ status: "running", progress: data, reconnecting: false });
    });
    source.addEventListener("completed", (event) => {
      const data = JSON.parse((event as MessageEvent).data) as Record<string, unknown>;
      setActiveJob((current) =>
        current
          ? {
              ...current,
              status: "completed",
              progress: { ...current.progress, percent: 100, phase: "completed" },
              stats: data,
              reconnecting: false,
            }
          : current,
      );
      source.close();
      void queryClient.invalidateQueries({ queryKey: ["lmlog-jobs"] });
    });
    source.addEventListener("failed", (event) => {
      const data = JSON.parse((event as MessageEvent).data) as {
        message?: string;
      };
      update({
        status: "failed",
        error: data.message ?? "Ingest failed",
        reconnecting: false,
      });
      source.close();
      void queryClient.invalidateQueries({ queryKey: ["lmlog-jobs"] });
    });
    source.onerror = () => {
      if (source.readyState === EventSource.CLOSED) {
        update({ reconnecting: false });
      } else {
        update({ reconnecting: true });
      }
    };
  }

  async function upload(file: File) {
    setUploadError(null);
    const extension = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
    if (!ALLOWED.includes(extension)) {
      setUploadError("Поддерживаются только .log, .txt и .jsonl");
      return;
    }
    const maxBytes = maxUploadMb * 1024 * 1024;
    if (file.size > maxBytes) {
      setUploadError(`Файл больше ${maxUploadMb} МБ`);
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file, file.name);
      const headers = new Headers();
      const token = getCookie(CSRF_COOKIE);
      if (token) headers.set("X-CSRF-Token", token);
      const response = await fetch("/api/lmlog/jobs", {
        method: "POST",
        body: form,
        headers,
        credentials: "same-origin",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new ApiClientError(
          body?.error?.message ?? "Загрузка не удалась",
          response.status,
          "upload_failed",
        );
      }
      const created = jobCreatedSchema.parse(await response.json());
      subscribe(created.job_id, created.filename);
      void queryClient.invalidateQueries({ queryKey: ["lmlog-jobs"] });
    } catch (error) {
      setUploadError(errorMessage(error));
    } finally {
      setUploading(false);
    }
  }

  function onFiles(files: FileList | null) {
    const file = files?.[0];
    if (file) void upload(file);
  }

  const jobs = jobsQuery.data ?? [];
  const percent = Math.max(
    0,
    Math.min(100, Number(activeJob?.progress.percent ?? 0)),
  );

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Log intelligence"
        title="Анализ логов"
        description="Загрузите Monolog-лог, дождитесь структурного снимка и исследуйте сигнатуры, ERROR-кластеры, тренды и объяснения. Файл обрабатывается lmlog serve на сервере."
        actions={
          <Button variant="outline" size="sm" onClick={() => jobsQuery.refetch()}>
            <RefreshCw className={cn("size-3.5", jobsQuery.isFetching && "animate-spin")} />
            Обновить
          </Button>
        }
      />

      {isAdmin ? (
        <Card className="mb-4">
          <CardContent className="p-4">
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                onFiles(event.dataTransfer.files);
              }}
              className={cn(
                "flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 text-center transition-colors",
                dragging
                  ? "border-primary/60 bg-primary/5"
                  : "border-border bg-secondary/10",
              )}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".log,.txt,.jsonl"
                className="hidden"
                onChange={(event) => {
                  onFiles(event.target.files);
                  event.target.value = "";
                }}
              />
              <div className="flex size-11 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
                {uploading ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <Upload className="size-5" />
                )}
              </div>
              <div className="mt-3 text-sm font-medium">
                Перетащите лог сюда
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                .log, .txt или .jsonl · до 50 МБ · Symfony/Monolog
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
              >
                Выбрать файл
              </Button>
            </div>
            {uploadError ? (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-[11px] text-destructive">
                <CircleAlert className="size-3.5" />
                {uploadError}
              </div>
            ) : null}

            {activeJob ? (
              <div className="mt-4 rounded-xl border border-border p-3">
                <div className="flex items-center gap-2">
                  {activeJob.status === "completed" ? (
                    <CheckCircle2 className="size-4 text-success" />
                  ) : activeJob.status === "failed" ? (
                    <CircleAlert className="size-4 text-destructive" />
                  ) : activeJob.reconnecting ? (
                    <WifiOff className="size-4 text-warning" />
                  ) : (
                    <Loader2 className="size-4 animate-spin text-primary" />
                  )}
                  <span className="text-xs font-medium">{activeJob.filename}</span>
                  <Badge variant={statusBadge(activeJob.status).variant}>
                    {activeJob.reconnecting
                      ? "переподключение"
                      : statusBadge(activeJob.status).label}
                  </Badge>
                  <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                    {percent.toFixed(1)}%
                  </span>
                </div>
                <Progress
                  value={percent}
                  className="mt-2"
                  tone={activeJob.status === "failed" ? "danger" : "primary"}
                />
                <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
                  <span>
                    lines {formatNumber(Number(activeJob.progress.lines ?? 0))}
                  </span>
                  <span>
                    entries {formatNumber(Number(activeJob.progress.entries ?? 0))}
                  </span>
                  {activeJob.progress.bytes ? (
                    <span>
                      {formatBytes(Number(activeJob.progress.bytes))} /{" "}
                      {formatBytes(Number(activeJob.progress.total_bytes ?? 0))}
                    </span>
                  ) : null}
                  {activeJob.status === "completed" ? (
                    <Button variant="link" size="sm" className="h-auto p-0" asChild>
                      <Link href={`/logs/${activeJob.id}`}>
                        Открыть снимок
                        <ArrowRight className="size-3" />
                      </Link>
                    </Button>
                  ) : null}
                  {activeJob.error ? (
                    <span className="text-destructive">{activeJob.error}</span>
                  ) : null}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <div className="mb-4 rounded-xl border border-warning/25 bg-warning/5 px-4 py-3 text-[11px] text-muted-foreground">
          Роль viewer может открывать снимки и задавать вопросы, но не загружать
          новые файлы.
        </div>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Загруженные снимки</CardTitle>
          <span className="text-[10px] text-muted-foreground">
            {jobs.length ? `${jobs.length} последних` : "—"}
          </span>
        </CardHeader>
        <CardContent className="px-0">
          {jobsQuery.isLoading ? (
            <div className="space-y-2 px-5 pb-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-12" />
              ))}
            </div>
          ) : jobsQuery.isError ? (
            <div className="px-5 pb-5">
              <ErrorState
                title="lmlog serve недоступен"
                message={errorMessage(jobsQuery.error)}
                onRetry={() => jobsQuery.refetch()}
              />
              <div className="mt-3 rounded-lg border border-border bg-secondary/20 p-3 text-[11px] text-muted-foreground">
                Запустите API: <code className="font-mono">lmlog serve</code> и
                задайте <code className="font-mono">LMLOG_API_URL</code> /{" "}
                <code className="font-mono">LMLOG_API_TOKEN</code>.
              </div>
            </div>
          ) : jobs.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Файл</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Строки</TableHead>
                  <TableHead>Сигнатуры</TableHead>
                  <TableHead>Ошибки</TableHead>
                  <TableHead>Создан</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => {
                  const badge = statusBadge(job.status);
                  return (
                    <TableRow key={job.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex size-7 items-center justify-center rounded-md border border-border bg-secondary/40">
                            <FileText className="size-3.5 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-xs font-medium">{job.filename}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {formatBytes(job.size_bytes)}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-[11px]">
                        {formatNumber(statsValue(job.stats, "lines") ?? 0)}
                      </TableCell>
                      <TableCell className="font-mono text-[11px]">
                        {formatNumber(statsValue(job.stats, "signatures") ?? 0)}
                      </TableCell>
                      <TableCell className="font-mono text-[11px]">
                        {formatNumber(statsValue(job.stats, "errors") ?? 0)}
                      </TableCell>
                      <TableCell className="text-[10px] text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="size-3" />
                          {formatRelative(job.created_at)}
                        </div>
                        <div className="mt-0.5">{formatDateTime(job.created_at)}</div>
                      </TableCell>
                      <TableCell>
                        {job.status === "completed" ? (
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/logs/${job.id}`}>
                              Открыть
                              <ArrowRight className="size-3.5" />
                            </Link>
                          </Button>
                        ) : job.status === "running" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => subscribe(job.id, job.filename)}
                          >
                            Прогресс
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="px-5 pb-5">
              <EmptyState
                icon={ScrollText}
                title="Снимков пока нет"
                description={
                  isAdmin
                    ? "Загрузите первый лог, чтобы получить сигнатуры, ERROR-кластеры и тренды."
                    : "Администратор ещё не загрузил логи."
                }
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
