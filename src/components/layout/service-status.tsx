"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, CircleAlert, CircleCheck, CircleDashed } from "lucide-react";
import { apiFetch } from "@/lib/client/api";
import { healthSchema, type ServiceHealth } from "@/lib/schemas/health";
import { cn, formatRelative } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

function tone(state: ServiceHealth["state"]) {
  if (state === "ok") return "text-success";
  if (state === "down") return "text-destructive";
  return "text-muted-foreground";
}

function downLabel(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} сервис недоступен`;
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) {
    return `${count} сервиса недоступны`;
  }
  return `${count} сервисов недоступно`;
}

function Icon({ state }: { state: ServiceHealth["state"] }) {
  if (state === "ok") return <CircleCheck className="size-3.5" />;
  if (state === "down") return <CircleAlert className="size-3.5" />;
  return <CircleDashed className="size-3.5" />;
}

export function ServiceStatus() {
  const query = useQuery({
    queryKey: ["health"],
    queryFn: () => apiFetch(healthSchema, "/api/health"),
    refetchInterval: 30_000,
  });
  const down = query.data?.services.filter((service) => service.state === "down") ?? [];
  const status = query.data?.status ?? (query.isError ? "degraded" : "ok");
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-2 border-border/80 bg-card/50 text-[11px]"
        >
          <span className="relative flex size-2">
            <span
              className={cn(
                "absolute inline-flex size-full animate-ping rounded-full opacity-40",
                status === "ok" ? "bg-success" : "bg-destructive",
              )}
            />
            <span
              className={cn(
                "relative inline-flex size-2 rounded-full",
                status === "ok" ? "bg-success" : "bg-destructive",
              )}
            />
          </span>
          <span className="hidden sm:inline">
            {query.isError
              ? "Состояние неизвестно"
              : status === "ok"
                ? "Сервисы в норме"
                : downLabel(down.length || 1)}
          </span>
          <Activity className="size-3.5 text-muted-foreground sm:hidden" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-xs font-medium">Состояние сервисов</div>
          {query.data ? (
            <span className="text-[10px] text-muted-foreground">
              {formatRelative(query.data.checkedAt)}
            </span>
          ) : null}
        </div>
        <div className="space-y-2">
          {(query.data?.services ?? []).map((service) => (
            <div
              key={service.name}
              className="flex items-center justify-between rounded-lg border border-border/70 px-2.5 py-2"
            >
              <div className="flex items-center gap-2">
                <span className={tone(service.state)}>
                  <Icon state={service.state} />
                </span>
                <div>
                  <div className="text-xs font-medium">{service.label}</div>
                  {service.detail ? (
                    <div className="text-[10px] text-muted-foreground">
                      {service.detail}
                    </div>
                  ) : null}
                </div>
              </div>
              <span
                className={cn(
                  "text-[10px] uppercase tracking-wide",
                  tone(service.state),
                )}
              >
                {service.state === "ok"
                  ? "ok"
                  : service.state === "down"
                    ? "down"
                    : "n/a"}
              </span>
            </div>
          ))}
          {query.isLoading ? (
            <div className="text-xs text-muted-foreground">Проверяем…</div>
          ) : null}
          {query.isError ? (
            <div className="text-xs text-destructive">
              Не удалось получить состояние сервисов.
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
