"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn, copyText } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function CopyButton({
  value,
  label = "Копировать",
  className,
  size = "icon-sm",
}: {
  value: string;
  label?: string;
  className?: string;
  size?: "icon" | "icon-sm" | "sm";
}) {
  const [copied, setCopied] = React.useState(false);
  async function copy() {
    try {
      await copyText(value);
      setCopied(true);
      toast.success("Скопировано");
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      toast.error("Не удалось скопировать");
    }
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size={size}
          className={cn("text-muted-foreground", className)}
          onClick={copy}
          aria-label={label}
        >
          {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
          {size === "sm" ? <span>{label}</span> : null}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
