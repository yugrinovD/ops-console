"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import {
  Building2,
  Coins,
  KeyRound,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  ShieldOff,
  Trash2,
  Gauge,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  apiKeyCreatedSchema,
  apiKeySchema,
  keyUsageSummarySchema,
  quotaSchema,
  tenantSchema,
  type ApiKey,
  type KeyUsageSummary,
  type Quota,
  type Tenant,
} from "@/lib/schemas/gogate";
import type { Role } from "@/lib/session";
import {
  apiFetch,
  apiJson,
  errorMessage,
} from "@/lib/client/api";
import {
  cn,
  formatCurrency,
  formatDateTime,
  formatNumber,
  percentOf,
} from "@/lib/utils";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { CopyButton } from "@/components/common/copy-button";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Switch } from "@/components/ui/switch";

const tenantsSchema = z.array(tenantSchema);
const keysSchema = z.array(apiKeySchema);
const quotasSchema = z.array(quotaSchema);
const usageSchema = z.array(keyUsageSummarySchema);

function monthStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

interface QuotaTarget {
  tenantId: string;
  keyId?: string;
  keyName?: string;
  existing?: Quota;
}

function effectiveQuota(key: ApiKey, quotas: Quota[]) {
  const keyQuota = quotas.find((quota) => quota.api_key_id === key.id);
  const tenantQuota = quotas.find(
    (quota) => !quota.api_key_id && quota.tenant_id === key.tenant_id,
  );
  return {
    quota: keyQuota ?? tenantQuota,
    keySpecific: Boolean(keyQuota),
  };
}

function keyStatus(key: ApiKey) {
  if (!key.enabled) return { label: "отключён", variant: "muted" as const };
  if (key.expires_at && new Date(key.expires_at).getTime() < Date.now()) {
    return { label: "истёк", variant: "danger" as const };
  }
  return { label: "активен", variant: "success" as const };
}

const createKeySchema = z.object({
  tenantId: z.string().min(1, "Выберите тенант"),
  name: z.string().min(1, "Введите название").max(120),
  expiresAt: z.string().optional(),
});

type CreateKeyValues = z.infer<typeof createKeySchema>;

const tenantFormSchema = z.object({
  name: z.string().min(1, "Введите название").max(120),
});

const quotaFormSchema = z.object({
  rpm: z.string().optional(),
  tpm: z.string().optional(),
  dailyRequests: z.string().optional(),
  dailyTokens: z.string().optional(),
  monthlyCostUsd: z.string().optional(),
});

type QuotaFormValues = z.infer<typeof quotaFormSchema>;

function numberOrNull(value?: string) {
  if (!value || !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function quotaDefaults(quota?: Quota): QuotaFormValues {
  return {
    rpm: quota?.rpm?.toString() ?? "",
    tpm: quota?.tpm?.toString() ?? "",
    dailyRequests: quota?.daily_requests?.toString() ?? "",
    dailyTokens: quota?.daily_tokens?.toString() ?? "",
    monthlyCostUsd: quota?.monthly_cost_usd?.toString() ?? "",
  };
}

function CreateKeyDialog({
  open,
  onOpenChange,
  tenants,
  defaultTenantId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenants: Tenant[];
  defaultTenantId?: string;
  onCreated: (key: z.infer<typeof apiKeyCreatedSchema>) => void;
}) {
  const form = useForm<CreateKeyValues>({
    resolver: zodResolver(createKeySchema),
    defaultValues: { tenantId: defaultTenantId ?? "", name: "", expiresAt: "" },
  });
  const [loading, setLoading] = React.useState(false);
  const tenantId = useWatch({ control: form.control, name: "tenantId" });

  React.useEffect(() => {
    if (open) {
      form.reset({
        tenantId: defaultTenantId ?? tenants[0]?.id ?? "",
        name: "",
        expiresAt: "",
      });
    }
  }, [open, defaultTenantId, tenants, form]);

  async function submit(values: CreateKeyValues) {
    setLoading(true);
    try {
      const created = await apiJson(
        apiKeyCreatedSchema,
        "/api/keys",
        "POST",
        {
          tenantId: values.tenantId,
          name: values.name,
          expiresAt: values.expiresAt
            ? new Date(values.expiresAt).toISOString()
            : null,
        },
      );
      onCreated(created);
      onOpenChange(false);
      toast.success("Ключ создан");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Новый API-ключ</DialogTitle>
          <DialogDescription>
            Plaintext ключа будет показан один раз. Сохраните его в защищённом
            месте.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Тенант</Label>
            <Select
              value={tenantId}
              onValueChange={(value) => form.setValue("tenantId", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Выберите тенант" />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((tenant) => (
                  <SelectItem key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.tenantId ? (
              <p className="text-[11px] text-destructive">
                {form.formState.errors.tenantId.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="key-name">Название</Label>
            <Input
              id="key-name"
              placeholder="console-playground"
              {...form.register("name")}
            />
            {form.formState.errors.name ? (
              <p className="text-[11px] text-destructive">
                {form.formState.errors.name.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="key-expires">Истекает (необязательно)</Label>
            <Input id="key-expires" type="datetime-local" {...form.register("expiresAt")} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={loading || !tenants.length}>
              {loading ? "Создаём…" : "Создать ключ"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreatedKeyDialog({
  created,
  onClose,
}: {
  created: z.infer<typeof apiKeyCreatedSchema> | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={Boolean(created)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-success" />
            Ключ создан
          </DialogTitle>
          <DialogDescription>
            Это единственный раз, когда plaintext ключа доступен. Скопируйте его
            сейчас.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border border-warning/25 bg-warning/5 p-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            API key
          </div>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-md bg-background/60 p-2 font-mono text-xs">
              {created?.key}
            </code>
            {created?.key ? <CopyButton value={created.key} label="Копировать ключ" /> : null}
          </div>
        </div>
        <div className="grid gap-2 text-[11px] text-muted-foreground sm:grid-cols-2">
          <div className="rounded-lg border border-border/70 p-2.5">
            name: <span className="font-mono text-foreground">{created?.name}</span>
          </div>
          <div className="rounded-lg border border-border/70 p-2.5">
            prefix: <span className="font-mono text-foreground">{created?.key_prefix}</span>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Я сохранил ключ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateTenantDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const form = useForm<z.infer<typeof tenantFormSchema>>({
    resolver: zodResolver(tenantFormSchema),
    defaultValues: { name: "" },
  });
  const [loading, setLoading] = React.useState(false);
  async function submit(values: { name: string }) {
    setLoading(true);
    try {
      await apiJson(tenantSchema, "/api/tenants", "POST", values);
      toast.success("Тенант создан");
      form.reset();
      onCreated();
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Новый тенант</DialogTitle>
          <DialogDescription>
            Тенант — граница изоляции ключей, квот и usage.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tenant-name">Название</Label>
            <Input id="tenant-name" placeholder="demo-team" {...form.register("name")} />
            {form.formState.errors.name ? (
              <p className="text-[11px] text-destructive">
                {form.formState.errors.name.message}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Создаём…" : "Создать"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function QuotaDialog({
  target,
  onOpenChange,
  onSaved,
}: {
  target: QuotaTarget | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const form = useForm<QuotaFormValues>({
    resolver: zodResolver(quotaFormSchema),
    defaultValues: quotaDefaults(),
  });
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (target) form.reset(quotaDefaults(target.existing));
  }, [target, form]);

  async function submit(values: QuotaFormValues) {
    if (!target) return;
    setLoading(true);
    try {
      await apiJson(quotaSchema, "/api/quotas", "POST", {
        tenantId: target.tenantId,
        apiKeyId: target.keyId ?? null,
        rpm: numberOrNull(values.rpm),
        tpm: numberOrNull(values.tpm),
        dailyRequests: numberOrNull(values.dailyRequests),
        dailyTokens: numberOrNull(values.dailyTokens),
        monthlyCostUsd: numberOrNull(values.monthlyCostUsd),
      });
      toast.success("Квота сохранена");
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    if (!target?.existing) return;
    setLoading(true);
    try {
      await apiFetch(z.object({ ok: z.boolean() }), `/api/quotas/${target.existing.id}`, {
        method: "DELETE",
      });
      toast.success("Квота удалена");
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={Boolean(target)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gauge className="size-4 text-primary" />
            Квота
          </DialogTitle>
          <DialogDescription>
            {target?.keyName
              ? `Ключ ${target.keyName}`
              : "Тенант"} · пустое поле означает отсутствие лимита.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { key: "rpm" as const, label: "RPM", placeholder: "60" },
              { key: "tpm" as const, label: "TPM", placeholder: "100000" },
              { key: "dailyRequests" as const, label: "Requests / день", placeholder: "10000" },
              { key: "dailyTokens" as const, label: "Tokens / день", placeholder: "1000000" },
            ].map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={`quota-${field.key}`}>{field.label}</Label>
                <Input
                  id={`quota-${field.key}`}
                  type="number"
                  min={1}
                  placeholder={field.placeholder}
                  {...form.register(field.key)}
                />
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="quota-cost">Monthly cost budget, USD</Label>
            <Input
              id="quota-cost"
              type="number"
              min={0.01}
              step="0.01"
              placeholder="100"
              {...form.register("monthlyCostUsd")}
            />
          </div>
          <DialogFooter className="sm:justify-between">
            {target?.existing ? (
              <Button
                type="button"
                variant="destructive"
                onClick={remove}
                disabled={loading}
              >
                <Trash2 className="size-3.5" />
                Удалить квоту
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Сохраняем…" : "Сохранить"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function KeysView({
  role,
  initial,
}: {
  role: Role;
  initial?: {
    tenants?: Tenant[];
    keys?: ApiKey[];
    quotas?: Quota[];
    monthUsage?: KeyUsageSummary[];
    todayUsage?: KeyUsageSummary[];
  };
}) {
  const queryClient = useQueryClient();
  const [tenantFilter, setTenantFilter] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [tenantOpen, setTenantOpen] = React.useState(false);
  const [createdKey, setCreatedKey] = React.useState<z.infer<typeof apiKeyCreatedSchema> | null>(
    null,
  );
  const [quotaTarget, setQuotaTarget] = React.useState<QuotaTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<ApiKey | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const isAdmin = role === "admin";

  const tenantsQuery = useQuery({
    queryKey: ["tenants"],
    queryFn: () => apiFetch(tenantsSchema, "/api/tenants"),
    initialData: initial?.tenants,
  });
  const keysQuery = useQuery({
    queryKey: ["keys"],
    queryFn: () => apiFetch(keysSchema, "/api/keys"),
    initialData: initial?.keys,
  });
  const quotasQuery = useQuery({
    queryKey: ["quotas"],
    queryFn: () => apiFetch(quotasSchema, "/api/quotas"),
    initialData: initial?.quotas,
  });
  const monthUsage = useQuery({
    queryKey: ["key-usage", "month"],
    queryFn: () =>
      apiFetch(
        usageSchema,
        `/api/usage/keys?from=${monthStart()}&to=${today()}`,
      ),
    initialData: initial?.monthUsage,
  });
  const todayUsage = useQuery({
    queryKey: ["key-usage", "today"],
    queryFn: () =>
      apiFetch(usageSchema, `/api/usage/keys?from=${today()}&to=${today()}`),
    initialData: initial?.todayUsage,
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["keys"] });
    void queryClient.invalidateQueries({ queryKey: ["quotas"] });
    void queryClient.invalidateQueries({ queryKey: ["tenants"] });
    void queryClient.invalidateQueries({ queryKey: ["key-usage"] });
  }

  const tenants = tenantsQuery.data ?? [];
  const keys = keysQuery.data ?? [];
  const quotas = quotasQuery.data ?? [];
  const usageMonth = new Map<string, KeyUsageSummary>(
    (monthUsage.data ?? []).map((item) => [item.api_key_id, item]),
  );
  const usageToday = new Map<string, KeyUsageSummary>(
    (todayUsage.data ?? []).map((item) => [item.api_key_id, item]),
  );
  const tenantNames = new Map(tenants.map((tenant) => [tenant.id, tenant.name]));
  const tenantUsage = new Map<
    string,
    { requests: number; tokens: number; cost: number }
  >();
  for (const item of monthUsage.data ?? []) {
    const current = tenantUsage.get(item.tenant_id) ?? {
      requests: 0,
      tokens: 0,
      cost: 0,
    };
    current.requests += item.requests;
    current.tokens += item.prompt_tokens + item.completion_tokens;
    current.cost += item.cost_usd;
    tenantUsage.set(item.tenant_id, current);
  }

  const filtered = keys.filter((key) => {
    if (tenantFilter !== "all" && key.tenant_id !== tenantFilter) return false;
    if (!search.trim()) return true;
    const needle = search.toLowerCase();
    return (
      key.name.toLowerCase().includes(needle) ||
      key.key_prefix.toLowerCase().includes(needle) ||
      (tenantNames.get(key.tenant_id) ?? "").toLowerCase().includes(needle)
    );
  });

  const active = keys.filter((key) => keyStatus(key).variant === "success").length;
  const monthCost = (monthUsage.data ?? []).reduce(
    (sum, item) => sum + item.cost_usd,
    0,
  );
  const monthRequests = (monthUsage.data ?? []).reduce(
    (sum, item) => sum + item.requests,
    0,
  );

  async function toggleKey(key: ApiKey) {
    try {
      await apiFetch(z.object({ ok: z.boolean() }), `/api/keys/${key.id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: !key.enabled }),
      });
      toast.success(key.enabled ? "Ключ отключён" : "Ключ включён");
      refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function removeKey() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(z.object({ ok: z.boolean() }), `/api/keys/${deleteTarget.id}`, {
        method: "DELETE",
      });
      toast.success("Ключ удалён");
      setDeleteTarget(null);
      refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setDeleting(false);
    }
  }

  const loading =
    tenantsQuery.isLoading || keysQuery.isLoading || quotasQuery.isLoading;

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Control plane"
        title="Ключи и квоты"
        description="Создавайте ключи, отзывайте доступ и управляйте RPM/TPM, дневными и месячными лимитами. Plaintext ключа показывается только один раз."
        actions={
          isAdmin ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setTenantOpen(true)}>
                <Users className="size-3.5" />
                Новый тенант
              </Button>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="size-3.5" />
                Создать ключ
              </Button>
            </>
          ) : (
            <Badge variant="secondary">Только чтение</Badge>
          )
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Ключей"
          value={formatNumber(keys.length)}
          hint={`${active} активных`}
          icon={KeyRound}
          tone="info"
        />
        <StatCard
          label="Тенантов"
          value={formatNumber(tenants.length)}
          hint="изоляция usage"
          icon={Building2}
        />
        <StatCard
          label="Запросов за месяц"
          value={formatNumber(monthRequests, { compact: true })}
          hint="по всем ключам"
          icon={Gauge}
          tone="success"
        />
        <StatCard
          label="Стоимость за месяц"
          value={formatCurrency(monthCost)}
          hint="usage_daily"
          icon={Coins}
          tone="warning"
        />
      </div>

      <Card>
        <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <CardTitle>API-ключи</CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Имя, префикс, тенант…"
                className="h-8 w-full pl-8 text-xs sm:w-56"
              />
            </div>
            <Select value={tenantFilter} onValueChange={setTenantFilter}>
              <SelectTrigger className="h-8 w-full text-xs sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все тенанты</SelectItem>
                {tenants.map((tenant) => (
                  <SelectItem key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {loading ? (
            <div className="space-y-2 px-5 pb-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-14" />
              ))}
            </div>
          ) : keysQuery.isError ? (
            <div className="px-5 pb-5">
              <ErrorState
                title="Не удалось загрузить ключи"
                message={errorMessage(keysQuery.error)}
                onRetry={() => keysQuery.refetch()}
              />
            </div>
          ) : filtered.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ключ</TableHead>
                  <TableHead>Тенант</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Лимиты</TableHead>
                  <TableHead>Сегодня</TableHead>
                  <TableHead>За месяц</TableHead>
                  <TableHead>Last used</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((key) => {
                  const status = keyStatus(key);
                  const { quota, keySpecific } = effectiveQuota(key, quotas);
                  const usedToday = usageToday.get(key.id);
                  const usedMonth = usageMonth.get(key.id);
                  const dailyRequests = quota?.daily_requests ?? null;
                  const monthlyCost = quota?.monthly_cost_usd ?? null;
                  return (
                    <TableRow key={key.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex size-7 items-center justify-center rounded-md border border-border bg-secondary/40">
                            <KeyRound className="size-3.5 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-xs font-medium">{key.name}</div>
                            <div className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                              {key.key_prefix}…
                              <CopyButton value={key.key_prefix} label="Копировать префикс" />
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs">
                          {tenantNames.get(key.tenant_id) ?? key.tenant_id.slice(0, 8)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="outline" className="text-[9px]">
                            RPM {quota?.rpm ? formatNumber(quota.rpm) : "∞"}
                          </Badge>
                          <Badge variant="outline" className="text-[9px]">
                            TPM {quota?.tpm ? formatNumber(quota.tpm, { compact: true }) : "∞"}
                          </Badge>
                          {keySpecific ? (
                            <Badge variant="info" className="text-[9px]">
                              key
                            </Badge>
                          ) : quota ? (
                            <Badge variant="muted" className="text-[9px]">
                              tenant
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="w-28">
                          <div className="flex justify-between text-[10px]">
                            <span>{formatNumber(usedToday?.requests ?? 0)}</span>
                            <span className="text-muted-foreground">
                              {dailyRequests ? formatNumber(dailyRequests) : "∞"}
                            </span>
                          </div>
                          <Progress
                            className="mt-1 h-1"
                            value={percentOf(usedToday?.requests ?? 0, dailyRequests ?? 0)}
                            tone={
                              percentOf(usedToday?.requests ?? 0, dailyRequests ?? 0) > 90
                                ? "danger"
                                : "primary"
                            }
                          />
                          <div className="mt-1 text-[9px] text-muted-foreground">
                            {formatNumber(
                              (usedToday?.prompt_tokens ?? 0) +
                                (usedToday?.completion_tokens ?? 0),
                              { compact: true },
                            )}{" "}
                            токенов
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="w-32">
                          <div className="flex justify-between text-[10px]">
                            <span>{formatCurrency(usedMonth?.cost_usd ?? 0)}</span>
                            <span className="text-muted-foreground">
                              {monthlyCost ? formatCurrency(monthlyCost) : "∞"}
                            </span>
                          </div>
                          <Progress
                            className="mt-1 h-1"
                            value={percentOf(usedMonth?.cost_usd ?? 0, monthlyCost ?? 0)}
                            tone={
                              percentOf(usedMonth?.cost_usd ?? 0, monthlyCost ?? 0) > 90
                                ? "danger"
                                : "warning"
                            }
                          />
                          <div className="mt-1 text-[9px] text-muted-foreground">
                            {formatNumber(usedMonth?.requests ?? 0, { compact: true })} запр.
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-[10px] text-muted-foreground">
                        {key.last_used_at ? formatDateTime(key.last_used_at) : "—"}
                      </TableCell>
                      <TableCell>
                        {isAdmin ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm" aria-label="Действия">
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuLabel>{key.name}</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onSelect={() => setQuotaTarget({
                                tenantId: key.tenant_id,
                                keyId: key.id,
                                keyName: key.name,
                                existing: quotas.find(
                                  (quota) => quota.api_key_id === key.id,
                                ),
                              })}>
                                <Gauge className="size-4" />
                                Настроить квоту ключа
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => toggleKey(key)}>
                                {key.enabled ? (
                                  <>
                                    <ShieldOff className="size-4" />
                                    Отключить
                                  </>
                                ) : (
                                  <>
                                    <ShieldCheck className="size-4" />
                                    Включить
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem destructive onSelect={() => setDeleteTarget(key)}>
                                <Trash2 className="size-4" />
                                Удалить ключ
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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
                icon={KeyRound}
                title={keys.length ? "Ничего не найдено" : "Ключей пока нет"}
                description={
                  keys.length
                    ? "Измените фильтр или поисковый запрос."
                    : isAdmin
                      ? "Создайте первый ключ и настройте квоты."
                      : "Администратор ещё не создал ключи."
                }
                action={
                  isAdmin && !keys.length ? (
                    <Button size="sm" onClick={() => setCreateOpen(true)}>
                      <Plus className="size-3.5" />
                      Создать ключ
                    </Button>
                  ) : null
                }
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Квоты тенантов</CardTitle>
          <span className="text-[10px] text-muted-foreground">
            базовые лимиты для всех ключей
          </span>
        </CardHeader>
        <CardContent className="px-0">
          {tenants.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Тенант</TableHead>
                  <TableHead>RPM / TPM</TableHead>
                  <TableHead>Дневные лимиты</TableHead>
                  <TableHead>За месяц</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((tenant) => {
                  const tenantQuota = quotas.find(
                    (quota) => !quota.api_key_id && quota.tenant_id === tenant.id,
                  );
                  const usage = tenantUsage.get(tenant.id);
                  return (
                    <TableRow key={tenant.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="size-3.5 text-muted-foreground" />
                          <span className="text-xs font-medium">{tenant.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="outline">
                            RPM {tenantQuota?.rpm ? formatNumber(tenantQuota.rpm) : "∞"}
                          </Badge>
                          <Badge variant="outline">
                            TPM{" "}
                            {tenantQuota?.tpm
                              ? formatNumber(tenantQuota.tpm, { compact: true })
                              : "∞"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                          <span>
                            {tenantQuota?.daily_requests
                              ? `${formatNumber(tenantQuota.daily_requests)} запр.`
                              : "∞ запр."}
                          </span>
                          <span>·</span>
                          <span>
                            {tenantQuota?.daily_tokens
                              ? `${formatNumber(tenantQuota.daily_tokens, { compact: true })} токенов`
                              : "∞ токенов"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-[10px]">
                          {formatNumber(usage?.requests ?? 0)} запр. ·{" "}
                          {formatCurrency(usage?.cost ?? 0)}
                        </div>
                        <div className="mt-1 text-[9px] text-muted-foreground">
                          {tenantQuota?.monthly_cost_usd
                            ? `бюджет ${formatCurrency(tenantQuota.monthly_cost_usd)}`
                            : "бюджет не задан"}
                        </div>
                      </TableCell>
                      <TableCell>
                        {isAdmin ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setQuotaTarget({
                                tenantId: tenant.id,
                                existing: tenantQuota,
                              })
                            }
                          >
                            <Gauge className="size-3.5" />
                            Настроить
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
                icon={Building2}
                title="Нет тенантов"
                description="Создайте тенант, чтобы задать базовые квоты."
              />
            </div>
          )}
        </CardContent>
      </Card>

      <CreateKeyDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        tenants={tenants}
        defaultTenantId={tenantFilter !== "all" ? tenantFilter : undefined}
        onCreated={(created) => {
          setCreatedKey(created);
          refresh();
        }}
      />
      <CreatedKeyDialog created={createdKey} onClose={() => setCreatedKey(null)} />
      <CreateTenantDialog
        open={tenantOpen}
        onOpenChange={setTenantOpen}
        onCreated={refresh}
      />
      <QuotaDialog
        target={quotaTarget}
        onOpenChange={(open) => !open && setQuotaTarget(null)}
        onSaved={refresh}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Удалить ключ?"
        description={`Ключ ${deleteTarget?.name ?? ""} перестанет работать. Это действие необратимо.`}
        confirmLabel="Удалить"
        destructive
        loading={deleting}
        onConfirm={removeKey}
      />
    </div>
  );
}
