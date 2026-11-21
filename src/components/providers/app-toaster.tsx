"use client";

import { Toaster } from "sonner";
import { useTheme } from "./theme-provider";

export function AppToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      theme={resolvedTheme}
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            "border border-border bg-card text-card-foreground shadow-2xl rounded-xl",
          description: "text-muted-foreground",
        },
      }}
    />
  );
}
