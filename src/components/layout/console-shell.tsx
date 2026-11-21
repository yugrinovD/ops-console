"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BellRing,
  Command,
  GitCompareArrows,
  KeyRound,
  LayoutDashboard,
  ListTree,
  Menu,
  ScrollText,
  TerminalSquare,
  X,
} from "lucide-react";
import type { Role } from "@/lib/session";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CommandPalette } from "./command-palette";
import { ServiceStatus } from "./service-status";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

const navigation = [
  {
    label: "Мониторинг",
    items: [
      { href: "/dashboard", label: "Обзор", icon: LayoutDashboard },
      { href: "/requests", label: "Запросы", icon: ListTree },
    ],
  },
  {
    label: "AI",
    items: [
      { href: "/playground", label: "Playground", icon: TerminalSquare },
      { href: "/compare", label: "Сравнение", icon: GitCompareArrows },
    ],
  },
  {
    label: "Управление",
    items: [
      { href: "/keys", label: "Ключи и квоты", icon: KeyRound },
      { href: "/logs", label: "Логи", icon: ScrollText },
      { href: "/alerts", label: "Алерты", icon: BellRing },
    ],
  },
];

function active(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function breadcrumb(pathname: string) {
  if (pathname.startsWith("/logs/")) return ["Логи", "Снимок"];
  for (const group of navigation) {
    const item = group.items.find((entry) => active(pathname, entry.href));
    if (item) return [item.label];
  }
  return ["Ops Console"];
}

function SidebarContent({
  pathname,
  role,
  onNavigate,
}: {
  pathname: string;
  role: Role;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-3 px-5">
        <Link href="/dashboard" className="flex items-center gap-3" onClick={onNavigate}>
          <div className="flex size-9 items-center justify-center rounded-xl border border-primary/30 bg-primary/12 text-primary shadow-[0_0_30px_-12px_var(--primary)]">
            <Activity className="size-5" />
          </div>
          <div>
            <div className="text-sm font-semibold leading-none tracking-tight">
              Ops Console
            </div>
            <div className="mt-1 text-[10px] leading-none text-muted-foreground">
              gogate · lmlog
            </div>
          </div>
        </Link>
      </div>
      <Separator />
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5">
        {navigation.map((group) => (
          <div key={group.label}>
            <div className="px-2 pb-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/70">
              {group.label}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = active(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground",
                      isActive &&
                        "bg-secondary text-foreground shadow-[inset_0_0_0_1px_var(--border)]",
                    )}
                  >
                    {isActive ? (
                      <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary" />
                    ) : null}
                    <item.icon
                      className={cn(
                        "size-4",
                        isActive ? "text-primary" : "text-muted-foreground",
                      )}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-border p-3">
        <div className="rounded-lg border border-border/70 bg-card/50 p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Роль
            </span>
            <Badge variant={role === "admin" ? "default" : "secondary"}>
              {role}
            </Badge>
          </div>
          <div className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
            {role === "admin"
              ? "Полный доступ к мутациям и playground."
              : "Только просмотр и анализ. Мутации скрыты."}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ConsoleShell({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const crumbs = breadcrumb(pathname);

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-card/40 backdrop-blur-xl lg:block">
        <SidebarContent pathname={pathname} role={role} />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-label="Закрыть меню"
          />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-border bg-card shadow-2xl animate-slide-up">
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute right-2 top-3 z-10"
              onClick={() => setMobileOpen(false)}
              aria-label="Закрыть меню"
            >
              <X className="size-4" />
            </Button>
            <SidebarContent
              pathname={pathname}
              role={role}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl sm:px-6">
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Открыть меню"
          >
            <Menu className="size-4" />
          </Button>
          <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <span className="hidden sm:inline">Ops Console</span>
            {crumbs.map((crumb, index) => (
              <React.Fragment key={`${crumb}-${index}`}>
                {index > 0 || true ? (
                  <span className="text-muted-foreground/40">/</span>
                ) : null}
                <span
                  className={cn(
                    "truncate",
                    index === crumbs.length - 1 && "text-foreground",
                  )}
                >
                  {crumb}
                </span>
              </React.Fragment>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="hidden h-8 gap-2 border-border/80 bg-card/50 text-[11px] text-muted-foreground md:flex"
              onClick={() => {
                window.dispatchEvent(
                  new KeyboardEvent("keydown", { key: "k", metaKey: true }),
                );
              }}
            >
              <Command className="size-3.5" />
              Поиск
              <kbd className="ml-2 rounded border border-border bg-muted px-1 py-0.5 font-mono text-[9px]">
                ⌘K
              </kbd>
            </Button>
            <ServiceStatus />
            <ThemeToggle />
            <UserMenu role={role} />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
