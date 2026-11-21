"use client";

import * as React from "react";
import {
  ArrowUp,
  Bot,
  Info,
  MessageSquareText,
  Sparkles,
  UserRound,
} from "lucide-react";
import { chatResponseSchema, type Citation } from "@/lib/schemas/lmlog";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { cn, generateId, shortId, truncate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/common/markdown";
import { Textarea } from "@/components/ui/textarea";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  source?: "llm" | "heuristic";
  citations?: Citation[];
  note?: string | null;
}

const suggestions = [
  "Какие ошибки самые частые и что проверить первым?",
  "Есть ли аномальный рост или «замолчавшие» паттерны?",
  "С чего начать разбор этого снимка?",
];

export function ChatPanel({
  snapshotId,
  signature,
  onClearSignature,
  onOpenSignature,
}: {
  snapshotId: string;
  signature?: string;
  onClearSignature: () => void;
  onOpenSignature: (signature: string) => void;
}) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const container = scrollRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages, loading]);

  async function send(text?: string) {
    const question = (text ?? input).trim();
    if (!question || loading) return;
    const userMessage: ChatMessage = {
      id: generateId(),
      role: "user",
      content: question,
    };
    const history = messages.map((message) => ({
      role: message.role,
      content: message.content,
    }));
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setLoading(true);
    try {
      const response = await apiFetch(chatResponseSchema, "/api/lmlog/chat", {
        method: "POST",
        body: JSON.stringify({
          snapshotId,
          question,
          signature: signature || undefined,
          history,
          useLlm: true,
        }),
      });
      setMessages((current) => [
        ...current,
        {
          id: generateId(),
          role: "assistant",
          content: response.answer,
          source: response.source,
          citations: response.citations,
          note: response.note,
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: generateId(),
          role: "assistant",
          content: errorMessage(error),
          source: "heuristic",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-[620px] flex-col rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 text-xs font-medium">
          <MessageSquareText className="size-4 text-primary" />
          Чат по снимку
        </div>
        <div className="flex items-center gap-2">
          {signature ? (
            <button
              onClick={onClearSignature}
              className="max-w-52 truncate rounded-md border border-primary/25 bg-primary/10 px-2 py-1 text-[10px] text-primary"
              title={signature}
            >
              cluster: {truncate(signature, 42)} ×
            </button>
          ) : null}
          <Badge variant="outline" className="text-[9px]">
            без RAG
          </Badge>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {!messages.length && !loading ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="flex size-11 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
              <Sparkles className="size-5" />
            </div>
            <div className="mt-3 text-sm font-medium">Спросите о снимке</div>
            <div className="mt-1 max-w-md text-[11px] leading-relaxed text-muted-foreground">
              Модель видит только сводку, top-N сигнатур, выбранный кластер и
              последние тренды. Это не RAG и не поиск по всем строкам.
            </div>
            <div className="mt-4 flex flex-col gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="rounded-lg border border-border bg-secondary/20 px-3 py-2 text-[11px] text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-2.5",
                  message.role === "user" && "flex-row-reverse",
                )}
              >
                <div
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-lg border",
                    message.role === "assistant"
                      ? "border-primary/25 bg-primary/10 text-primary"
                      : "border-border bg-secondary text-muted-foreground",
                  )}
                >
                  {message.role === "assistant" ? (
                    <Bot className="size-3.5" />
                  ) : (
                    <UserRound className="size-3.5" />
                  )}
                </div>
                <div
                  className={cn(
                    "min-w-0 max-w-[88%] space-y-1.5",
                    message.role === "user" && "text-right",
                  )}
                >
                  <div
                    className={cn(
                      "rounded-xl border px-3.5 py-2.5 text-sm",
                      message.role === "assistant"
                        ? "border-border bg-background/40"
                        : "border-primary/20 bg-primary/10",
                    )}
                  >
                    {message.role === "assistant" ? (
                      <Markdown>{message.content}</Markdown>
                    ) : (
                      <div className="whitespace-pre-wrap">{message.content}</div>
                    )}
                  </div>
                  {message.role === "assistant" && message.source ? (
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                      <Badge
                        variant={message.source === "llm" ? "success" : "warning"}
                      >
                        {message.source === "llm" ? "LLM" : "heuristic"}
                      </Badge>
                      {message.citations?.slice(0, 3).map((citation) => (
                        <button
                          key={citation.signature}
                          onClick={() => onOpenSignature(citation.signature)}
                          className="max-w-56 truncate rounded border border-border bg-secondary/30 px-1.5 py-0.5 text-left font-mono text-[9px] hover:border-primary/30"
                          title={citation.signature}
                        >
                          {shortId(citation.signature, 36)} · {citation.errors} err
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {message.note ? (
                    <div className="flex items-start gap-1 text-[9px] text-muted-foreground">
                      <Info className="mt-0.5 size-2.5 shrink-0" />
                      {message.note}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            {loading ? (
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <div className="flex size-7 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
                  <Bot className="size-3.5" />
                </div>
                <span className="inline-flex items-center gap-1">
                  Анализируем снимок
                  <span className="animate-pulse">…</span>
                </span>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                void send();
              }
            }}
            placeholder="Вопрос по снимку… ⌘↩ отправить"
            className="min-h-16 flex-1 resize-none text-sm"
            maxLength={2000}
            disabled={loading}
          />
          <Button
            size="icon"
            onClick={() => void send()}
            disabled={!input.trim() || loading}
            aria-label="Отправить вопрос"
          >
            <ArrowUp className="size-4" />
          </Button>
        </div>
        <div className="mt-2 flex items-center justify-between text-[9px] text-muted-foreground">
          <span>top-N сигнатур + выбранный кластер</span>
          <span>{signature ? "cluster context on" : "snapshot context"}</span>
        </div>
      </div>
    </div>
  );
}
