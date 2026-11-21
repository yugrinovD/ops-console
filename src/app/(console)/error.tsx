"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ConsoleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-md rounded-xl border border-destructive/25 bg-destructive/5 p-6 text-center">
        <AlertTriangle className="mx-auto mb-3 size-6 text-destructive" />
        <h1 className="text-base font-semibold">Что-то пошло не так</h1>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {error.message || "Не удалось загрузить раздел консоли."}
          {error.digest ? ` · ${error.digest}` : ""}
        </p>
        <Button variant="outline" size="sm" className="mt-4" onClick={reset}>
          <RefreshCw className="size-3.5" />
          Попробовать снова
        </Button>
      </div>
    </div>
  );
}
