import "server-only";
import type { ModelPrice, PublicProvider } from "@/lib/schemas/gogate";
import {
  calculateCost,
  chatCompletion,
  listPrices,
  listProviders,
  openChatStream,
  providerChain,
} from "./gogate";

export interface PlaygroundMeta {
  requestId: string;
  provider: string;
  cache: string;
  fallback: boolean;
  chain: string[];
  model: string;
}

export interface PlaygroundUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number | null;
  latencyMs: number;
  finishReason: string | null;
}

function chainFor(model: string, providers: PublicProvider[]) {
  return providerChain(model, providers).map((provider) => provider.name);
}

async function loadPricing(model: string, requestId: string) {
  const [providers, prices] = await Promise.all([
    listProviders(requestId).catch(() => [] as PublicProvider[]),
    listPrices(requestId).catch(() => [] as ModelPrice[]),
  ]);
  return { providers, prices, chain: chainFor(model, providers) };
}

function metaFor(
  model: string,
  requestId: string,
  provider: string,
  cache: string,
  chain: string[],
): PlaygroundMeta {
  return {
    requestId,
    provider: provider || chain[0] || "unknown",
    cache,
    fallback: chain.length > 0 && provider !== "" && provider !== chain[0],
    chain,
    model,
  };
}

function costFor(
  prices: ModelPrice[],
  meta: PlaygroundMeta,
  promptTokens: number,
  completionTokens: number,
) {
  if (meta.cache === "HIT" || meta.cache === "SEMANTIC") return 0;
  return calculateCost(
    prices,
    meta.provider,
    meta.model,
    promptTokens,
    completionTokens,
  );
}

export async function runNonStreaming(
  body: Record<string, unknown>,
  model: string,
  requestId: string,
) {
  const started = Date.now();
  const pricing = loadPricing(model, requestId);
  const { data, headers } = await chatCompletion(
    {
      model,
      messages: (body.messages as Array<{ role: string; content: string }>) ?? [],
      temperature: body.temperature as number | undefined,
      max_tokens: body.maxTokens as number | undefined,
    },
    requestId,
  );
  const { prices, chain } = await pricing;
  const provider = headers.get("x-gogate-provider") ?? "";
  const cache = headers.get("x-gogate-cache") ?? "";
  const meta = metaFor(
    model,
    headers.get("x-request-id") ?? requestId,
    provider,
    cache,
    chain,
  );
  const usage = data.usage ?? {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
  };
  const finishReason = data.choices[0]?.finish_reason ?? null;
  return {
    response: data,
    meta,
    usage: {
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
      costUsd: costFor(prices, meta, usage.prompt_tokens, usage.completion_tokens),
      latencyMs: Date.now() - started,
      finishReason,
    } satisfies PlaygroundUsage,
  };
}

function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function runStreaming(
  body: Record<string, unknown>,
  model: string,
  requestId: string,
  signal: AbortSignal,
) {
  const started = Date.now();
  const pricing = loadPricing(model, requestId);
  const upstream = await openChatStream(
    {
      model,
      messages: body.messages,
      temperature: body.temperature,
      max_tokens: body.maxTokens,
      stream: true,
      stream_options: { include_usage: true },
    },
    requestId,
    signal,
  );
  const provider = upstream.headers.get("x-gogate-provider") ?? "";
  const cache = upstream.headers.get("x-gogate-cache") ?? "";
  const upstreamRequestId = upstream.headers.get("x-request-id") ?? requestId;
  const { prices, chain } = await pricing;
  const meta = metaFor(model, upstreamRequestId, provider, cache, chain);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.body?.getReader();
      if (!reader) {
        controller.enqueue(encoder.encode(sse("error", { code: "empty_stream", message: "Пустой поток" })));
        controller.close();
        return;
      }
      const decoder = new TextDecoder();
      let buffer = "";
      let content = "";
      let usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
      } | null = null;
      let finishReason: string | null = null;
      let done = false;
      let failed = false;
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(sse(event, data)));
      };
      try {
        send("meta", meta);
        while (!done) {
          const { done: finished, value } = await reader.read();
          if (finished) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";
          for (const frame of frames) {
            const dataLines = frame
              .split("\n")
              .filter((line) => line.startsWith("data:"))
              .map((line) => line.slice(5).trim());
            if (!dataLines.length) continue;
            const raw = dataLines.join("\n");
            if (raw === "[DONE]") {
              done = true;
              break;
            }
            let chunk: unknown;
            try {
              chunk = JSON.parse(raw);
            } catch {
              continue;
            }
            const parsed = chunk as {
              choices?: Array<{
                delta?: { content?: unknown };
                finish_reason?: string | null;
              }>;
              usage?: {
                prompt_tokens?: number;
                completion_tokens?: number;
                total_tokens?: number;
              };
              error?: { message?: string; code?: string };
            };
            if (parsed.error) {
              // gogate sends this frame before [DONE] when the upstream fails
              // or the request times out after the first byte. Do not turn a
              // partial response into a successful "done".
              failed = true;
              send("error", {
                code: parsed.error.code || "stream_failed",
                message: parsed.error.message || "Ошибка потока",
              });
              done = true;
              break;
            }
            const text = parsed.choices?.[0]?.delta?.content;
            if (typeof text === "string" && text) {
              content += text;
              send("delta", { text });
            }
            const reason = parsed.choices?.[0]?.finish_reason;
            if (reason) finishReason = reason;
            if (parsed.usage) {
              usage = {
                prompt_tokens: parsed.usage.prompt_tokens ?? 0,
                completion_tokens: parsed.usage.completion_tokens ?? 0,
                total_tokens: parsed.usage.total_tokens ?? 0,
              };
            }
          }
        }
        if (failed) return;
        const finalUsage = usage ?? {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
        };
        send("usage", {
          promptTokens: finalUsage.prompt_tokens,
          completionTokens: finalUsage.completion_tokens,
          totalTokens: finalUsage.total_tokens,
          costUsd: costFor(
            prices,
            meta,
            finalUsage.prompt_tokens,
            finalUsage.completion_tokens,
          ),
          latencyMs: Date.now() - started,
          finishReason,
          contentLength: content.length,
        } satisfies PlaygroundUsage & { contentLength: number });
        send("done", { ok: true });
      } catch (error) {
        if (!signal.aborted) {
          send("error", {
            code: "stream_failed",
            message:
              error instanceof Error ? error.message : "Ошибка потока",
          });
        }
      } finally {
        try {
          reader.releaseLock();
        } catch {
          // ignore
        }
        try {
          controller.close();
        } catch {
          // already closed by a cancelled client
        }
      }
    },
    cancel() {
      // The caller's abort signal is wired to the upstream request.
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
