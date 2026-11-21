"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import {
  BellRing,
  CircleAlert,
  CircleCheck,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  alertRuleInputSchema,
  alertRuleSchema,
  type AlertRule,
} from "@/lib/schemas/alerts";
import { dashboardSchema } from "@/lib/schemas/dashboard";
import type { Role } from "@/lib/session";
import { apiFetch, apiJson, errorMessage } from "@/lib/client/api";
import {
  cn,
  formatDateTime,
  formatNumber,
} from "@/lib/utils";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const rulesEnvelope = z.object({ rules: z.array(alertRuleSchema) });
const formSchema = z.object({
  name: z.string().min(1, "Введите название").max(120),
  metric: z.enum(["errorRate", "p95", "p99", "rps", "cacheHitShare", "rateLimited"]),
  comparator: z.enum(["gt", "gte", "lt", "lte"]),
  threshold: z.number().finite(),
  severity: z.enum(["info", "warning", "critical"]),
  enabled: z.boolean(),
});
type FormValues = z.infer<typeof formSchema>;

const metricLabels: Record<FormValues["metric"], string> = {
  errorRate: "5xx rate, %",
  p95: "p95 latency, ms",
  p99: "p99 latency, ms",
  rps: "RPS",
  cacheHitShare: "Cache hit, %",
  rateLimited: "Rate limited / s",
};

const comparatorLabels: Record<FormValues["comparator"], string> = {
  gt: ">",
  gte: "≥",
  lt: "<",
  lte: "≤",
};

const severityVariant = {
  info: "info" as const,
  warning: "warning" as const,
  critical: "danger" as const,
};

function formatMetric(metric: AlertRule["metric"], value: number | null) {
  if (value === null || Number.isNaN(value)) return "—";
  if (metric === "errorRate" || metric === "cacheHitShare") {
    return `${value.toFixed(2)}%`;
  }
  if (metric === "p95" || metric === "p99") return `${Math.round(value)} ms`;
  return formatNumber(value, { maximumFractionDigits: 2 });
}

function AlertDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: AlertRule | null;
  onSaved: () => void;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      metric: "errorRate",
      comparator: "gt",
      threshold: 5,
      severity: "warning",
      enabled: true,
    },
  });
  const [loading, setLoading] = React.useState(false);
  const metric = useWatch({ control: form.control, name: "metric" });
  const comparator = useWatch({ control: form.control, name: "comparator" });
  const severity = useWatch({ control: form.control, name: "severity" });
  const enabled = useWatch({ control: form.control, name: "enabled" });

  React.useEffect(() => {
    if (!open) return;
    form.reset(
      editing
        ? {
            name: editing.name,
            metric: editing.metric,
            comparator: editing.comparator,
            threshold: editing.threshold,
            severity: editing.severity,
            enabled: editing.enabled,
          }
        : {
            name: "",
            metric: "errorRate",
            comparator: "gt",
            threshold: 5,
            severity: "warning",
            enabled: true,
          },
    );
  }, [open, editing, form]);

  async function submit(values: FormValues) {
    setLoading(true);
    try {
      const payload = alertRuleInputSchema.parse(values);
      if (editing) {
        await apiJson(alertRuleSchema, `/api/alerts/${editing.id}`, "PUT", payload);
        toast.success("Правило обновлено");
      } else {
        await apiJson(alertRuleSchema, "/api/alerts", "POST", payload);
        toast.success("Правило создано");
      }
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Изменить правило" : "Новое правило"}</DialogTitle>
          <DialogDescription>
            Правило проверяется при загрузке dashboard. Внешние уведомления не
            отправляются.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="alert-name">Название</Label>
            <Input id="alert-name" placeholder="Высокий 5xx rate" {...form.register("name")} />
            {form.formState.errors.name ? (
              <p className="text-[11px] text-destructive">
                {form.formState.errors.name.message}
              </p>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Метрика</Label>
              <Select
                value={metric}
                onValueChange={(value) =>
                  form.setValue("metric", value as FormValues["metric"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(metricLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Условие</Label>
              <div className="flex gap-2">
                <Select
                  value={comparator}
                  onValueChange={(value) =>
                    form.setValue("comparator", value as FormValues["comparator"])
                  }
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(comparatorLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  step="any"
                  className="flex-1"
                  {...form.register("threshold", { valueAsNumber: true })}
                />
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Severity</Label>
              <Select
                value={severity}
                onValueChange={(value) =>
                  form.setValue("severity", value as FormValues["severity"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">info</SelectItem>
                  <SelectItem value="warning">warning</SelectItem>
                  <SelectItem value="critical">critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col justify-end">
              <label className="flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-xs">
                <Switch
                  checked={enabled}
                  onCheckedChange={(value) => form.setValue("enabled", value)}
                />
                Правило включено
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Сохраняем…" : "Сохранить"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AlertsView({ role }: { role: Role }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<AlertRule | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<AlertRule | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const isAdmin = role === "admin";

  const rulesQuery = useQuery({
    queryKey: ["alerts"],
    queryFn: () => apiFetch(rulesEnvelope, "/api/alerts"),
  });
  const dashboardQuery = useQuery({
    queryKey: ["dashboard", "24h", "alerts"],
    queryFn: () => apiFetch(dashboardSchema, "/api/dashboard?range=24h"),
    enabled: tabEnabled(rulesQuery.data?.rules.length),
  });

  function tabEnabled(count?: number) {
    return Boolean(count);
  }

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["alerts"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }

  const rules = rulesQuery.data?.rules ?? [];
  const incidents = dashboardQuery.data?.incidents ?? [];
  const firing = new Set(incidents.map((incident) => incident.id));

  function currentValue(metric: AlertRule["metric"]) {
    const totals = dashboardQuery.data?.totals;
    if (!totals) return null;
    switch (metric) {
      case "errorRate":
        return totals.errorRate === null ? null : totals.errorRate * 100;
      case "p95":
        return totals.p95 === null ? null : totals.p95 * 1000;
      case "p99":
        return totals.p99 === null ? null : totals.p99 * 1000;
      case "rps":
        return totals.rps;
      case "cacheHitShare":
        return totals.cacheHitShare === null ? null : totals.cacheHitShare * 100;
      case "rateLimited":
        return totals.rateLimited;
      default:
        return null;
    }
  }

  async function toggle(rule: AlertRule) {
    try {
      await apiJson(alertRuleSchema, `/api/alerts/${rule.id}`, "PUT", {
        name: rule.name,
        metric: rule.metric,
        comparator: rule.comparator,
        threshold: rule.threshold,
        severity: rule.severity,
        enabled: !rule.enabled,
      });
      toast.success(rule.enabled ? "Правило отключено" : "Правило включено");
      refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(z.object({ ok: z.boolean() }), `/api/alerts/${deleteTarget.id}`, {
        method: "DELETE",
      });
      toast.success("Правило удалено");
      setDeleteTarget(null);
      refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Observability / thresholds"
        title="Алерты"
        description="Пороговые правила по live-метрикам. Активные алерты показываются в обзоре и в шапке консоли. Внешние каналы уведомлений не подключены."
        actions={
          isAdmin ? (
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="size-3.5" />
              Новое правило
            </Button>
          ) : (
            <Badge variant="secondary">Только чтение</Badge>
          )
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Правил"
          value={formatNumber(rules.length)}
          hint={`${rules.filter((rule) => rule.enabled).length} включено`}
          icon={Settings2}
        />
        <StatCard
          label="Активны сейчас"
          value={formatNumber(incidents.length)}
          hint="по dashboard 24h"
          icon={BellRing}
          tone={incidents.length ? "danger" : "success"}
        />
        <StatCard
          label="Проверка"
          value="dashboard"
          hint="при загрузке обзора"
          icon={CircleCheck}
          tone="info"
        />
      </div>

      {rulesQuery.isError ? (
        <ErrorState
          title="Не удалось загрузить правила"
          message={errorMessage(rulesQuery.error)}
          onRetry={() => rulesQuery.refetch()}
        />
      ) : rulesQuery.isLoading ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-36" />
          ))}
        </div>
      ) : rules.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {rules.map((rule) => {
            const isFiring = firing.has(rule.id);
            const value = currentValue(rule.metric);
            return (
              <Card
                key={rule.id}
                className={cn(
                  isFiring && "border-destructive/40 shadow-[0_0_30px_-20px_var(--destructive)]",
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border",
                        isFiring
                          ? "border-destructive/25 bg-destructive/10 text-destructive"
                          : rule.enabled
                            ? "border-success/25 bg-success/10 text-success"
                            : "border-border bg-secondary text-muted-foreground",
                      )}
                    >
                      {isFiring ? (
                        <CircleAlert className="size-4" />
                      ) : (
                        <BellRing className="size-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-medium">{rule.name}</span>
                        <Badge variant={severityVariant[rule.severity]}>
                          {rule.severity}
                        </Badge>
                        {!rule.enabled ? <Badge variant="muted">off</Badge> : null}
                        {isFiring ? <Badge variant="danger">firing</Badge> : null}
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {metricLabels[rule.metric]} {comparatorLabels[rule.comparator]}{" "}
                        {formatNumber(rule.threshold, { maximumFractionDigits: 2 })}
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-[11px]">
                        <span className="text-muted-foreground">Сейчас:</span>
                        <span
                          className={cn(
                            "font-mono",
                            isFiring ? "text-destructive" : "text-foreground",
                          )}
                        >
                          {formatMetric(rule.metric, value)}
                        </span>
                        <span className="ml-auto text-[9px] text-muted-foreground">
                          обновлено {dashboardQuery.data ? formatDateTime(dashboardQuery.data.generatedAt) : "—"}
                        </span>
                      </div>
                    </div>
                    {isAdmin ? (
                      <div className="flex flex-col items-end gap-1">
                        <Switch
                          checked={rule.enabled}
                          onCheckedChange={() => toggle(rule)}
                          aria-label="Включить правило"
                        />
                        <div className="flex gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => {
                              setEditing(rule);
                              setDialogOpen(true);
                            }}
                            aria-label="Изменить"
                          >
                            <Settings2 className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setDeleteTarget(rule)}
                            aria-label="Удалить"
                          >
                            <Trash2 className="size-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={BellRing}
          title="Правил пока нет"
          description={
            isAdmin
              ? "Добавьте порог по 5xx rate, p95/p99, RPS, cache hit или rate limited."
              : "Администратор ещё не настроил правила."
          }
          action={
            isAdmin ? (
              <Button
                size="sm"
                onClick={() => {
                  setEditing(null);
                  setDialogOpen(true);
                }}
              >
                <Plus className="size-3.5" />
                Создать правило
              </Button>
            ) : null
          }
        />
      )}

      <AlertDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSaved={refresh}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Удалить правило?"
        description={`Правило ${deleteTarget?.name ?? ""} перестанет проверяться.`}
        confirmLabel="Удалить"
        destructive
        loading={deleting}
        onConfirm={remove}
      />
    </div>
  );
}
