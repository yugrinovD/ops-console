"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import {
  Activity,
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
} from "lucide-react";
import { apiFetch, ApiClientError } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const loginResponse = z.object({
  role: z.enum(["admin", "viewer"]),
});

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [token, setToken] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!token.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      await apiFetch(loginResponse, "/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ token: token.trim() }),
      });
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Не удалось войти. Проверьте соединение.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 grid-backdrop opacity-60" />
      <div className="pointer-events-none absolute -left-40 top-[-20%] size-[36rem] rounded-full bg-primary/10 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-[-30%] right-[-10%] size-[32rem] rounded-full bg-info/10 blur-[120px]" />

      <section className="relative hidden w-[54%] flex-col justify-between border-r border-border/70 p-10 lg:flex xl:p-14">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl border border-primary/30 bg-primary/15 text-primary glow-primary">
            <Activity className="size-5" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">Ops Console</div>
            <div className="text-[11px] text-muted-foreground">
              gogate · lmlog control plane
            </div>
          </div>
        </div>

        <div className="max-w-xl space-y-7">
          <Badge variant="outline" className="gap-1.5">
            <Sparkles className="size-3" />
            AI-first operations workspace
          </Badge>
          <h1 className="text-balance text-4xl font-semibold leading-[1.08] tracking-tight xl:text-5xl">
            Пульт управления{" "}
            <span className="gradient-text">AI-инфраструктурой</span>
          </h1>
          <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
            Живые метрики, streaming playground, ключи и квоты, разбор логов и
            grounded-чат по снимкам. Все admin-токены остаются на сервере.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                icon: Activity,
                title: "Метрики",
                text: "RPS, p95/p99, ошибки, токены и стоимость",
              },
              {
                icon: TerminalSquare,
                title: "Playground",
                text: "SSE-стриминг, provider и fallback",
              },
              {
                icon: ShieldCheck,
                title: "BFF-only",
                text: "Браузер не видит admin API",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-border/80 bg-card/50 p-3 backdrop-blur"
              >
                <item.icon className="mb-2 size-4 text-primary" />
                <div className="text-xs font-medium">{item.title}</div>
                <div className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  {item.text}
                </div>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-xl border border-border/80 bg-[#0b0d10] shadow-2xl">
            <div className="flex items-center gap-1.5 border-b border-white/5 px-4 py-2.5">
              <span className="size-2 rounded-full bg-[#ff5f57]" />
              <span className="size-2 rounded-full bg-[#febc2e]" />
              <span className="size-2 rounded-full bg-[#28c840]" />
              <span className="ml-3 text-[11px] text-white/40">ops-console</span>
            </div>
            <pre className="overflow-x-auto p-4 font-mono text-[11.5px] leading-6 text-white/70">
              <span className="text-primary">$</span> curl -s $GOGATE/v1/chat/completions \{"\n"}
              {"  "}-H <span className="text-[#a5d6ff]">&quot;Authorization: Bearer $KEY&quot;</span> \{"\n"}
              {"  "}-d <span className="text-[#a5d6ff]">&apos;{`{"model":"mock","stream":true}`}&apos;</span>{"\n"}
              <span className="text-white/35">→</span> 200 OK · provider=
              <span className="text-primary">mock</span> · cache=
              <span className="text-warning">MISS</span>{"\n"}
              <span className="text-white/35">→</span> 128 tokens · $0.00042 ·{" "}
              <span className="text-white/40">request_id=5f3c…</span>
            </pre>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <LockKeyhole className="size-3.5" />
          HMAC-сессия · SameSite=Lax · Origin/CSRF защита
        </div>
      </section>

      <section className="relative flex flex-1 items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md space-y-8">
          <div className="flex items-center gap-3 lg:hidden">
            <div className="flex size-9 items-center justify-center rounded-xl border border-primary/30 bg-primary/15 text-primary">
              <Activity className="size-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">Ops Console</div>
              <div className="text-[11px] text-muted-foreground">
                gogate · lmlog
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex size-11 items-center justify-center rounded-xl border border-border bg-card">
              <KeyRound className="size-5 text-primary" />
            </div>
            <h2 className="pt-2 text-2xl font-semibold tracking-tight">
              Вход в консоль
            </h2>
            <p className="text-sm text-muted-foreground">
              Введите токен доступа, который выдал администратор.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="token">Токен доступа</Label>
              <div className="relative">
                <Input
                  id="token"
                  name="token"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  autoFocus
                  spellCheck={false}
                  placeholder="••••••••••••••••••••"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  className="h-11 pr-11 font-mono text-sm"
                  aria-invalid={Boolean(error)}
                />
                <button
                  type="button"
                  onClick={() => setShow((value) => !value)}
                  className="absolute right-1 top-1 flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  aria-label={show ? "Скрыть токен" : "Показать токен"}
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {error ? (
                <p
                  role="alert"
                  className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-xs text-destructive"
                >
                  {error}
                </p>
              ) : null}
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={!token.trim() || loading}
            >
              {loading ? "Проверяем…" : "Войти"}
              {!loading && <ArrowRight className="size-4" />}
            </Button>
          </form>

          <div className="space-y-3 rounded-xl border border-border/70 bg-card/40 p-4">
            <div className="flex items-center gap-2 text-xs font-medium">
              <ShieldCheck className="size-4 text-primary" />
              Как устроена сессия
            </div>
            <ul className="space-y-1.5 text-[11px] leading-relaxed text-muted-foreground">
              <li>Токен проверяется на сервере и не сохраняется в браузере.</li>
              <li>Сессия — подписанная httpOnly-cookie с ограниченным сроком.</li>
              <li>Мутации защищены проверкой Origin и CSRF-токеном.</li>
            </ul>
          </div>

          <p className="text-center text-[11px] text-muted-foreground">
            Доступ только для операторов. Все действия попадают в серверные логи.
          </p>
        </div>
      </section>
    </main>
  );
}
