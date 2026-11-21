"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ErrorState({
  title = "Не удалось загрузить данные",
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-destructive/20 bg-destructive/5 px-6 py-10 text-center">
      <AlertTriangle className="mb-2 size-5 text-destructive" />
      <div className="text-sm font-medium">{title}</div>
      {message ? (
        <div className="mt-1 max-w-md text-xs text-muted-foreground">{message}</div>
      ) : null}
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          <RefreshCw className="size-3.5" />
          Повторить
        </Button>
      ) : null}
    </div>
  );
}
