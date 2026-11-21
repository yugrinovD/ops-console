"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, LogOut, Shield, UserRound } from "lucide-react";
import type { Role } from "@/lib/session";
import { apiFetch } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { z } from "zod";

export function UserMenu({ role }: { role: Role }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  async function logout() {
    if (loading) return;
    setLoading(true);
    try {
      await apiFetch(z.object({ ok: z.boolean() }), "/api/auth/logout", {
        method: "POST",
      });
      router.replace("/login");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 gap-2 px-2 text-xs">
          <span className="flex size-6 items-center justify-center rounded-full border border-border bg-secondary">
            {role === "admin" ? (
              <Shield className="size-3.5 text-primary" />
            ) : (
              <UserRound className="size-3.5 text-muted-foreground" />
            )}
          </span>
          <span className="hidden text-left md:block">
            <span className="block leading-none">
              {role === "admin" ? "Администратор" : "Наблюдатель"}
            </span>
            <span className="mt-0.5 block text-[10px] leading-none text-muted-foreground">
              {role === "admin" ? "полный доступ" : "только чтение"}
            </span>
          </span>
          <ChevronsUpDown className="size-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Сессия</DropdownMenuLabel>
        <div className="px-2 pb-2">
          <Badge variant={role === "admin" ? "default" : "secondary"}>
            {role}
          </Badge>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={logout} disabled={loading}>
          <LogOut className="size-4" />
          {loading ? "Выходим…" : "Выйти"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
