import { beforeEach, describe, expect, it, vi } from "vitest";
import { openChatStream } from "@/lib/server/gogate";
import { runStreaming } from "@/lib/server/playground";

vi.mock("@/lib/server/gogate", () => ({
  calculateCost: vi.fn(() => null),
  chatCompletion: vi.fn(),
  listPrices: vi.fn(async () => []),
  listProviders: vi.fn(async () => []),
  openChatStream: vi.fn(),
  providerChain: vi.fn(() => []),
}));

function streamResponse(frames: string[]) {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const frame of frames) controller.enqueue(encoder.encode(frame));
        controller.close();
      },
    }),
    { status: 200, headers: { "content-type": "text/event-stream" } },
  );
}

describe("runStreaming", () => {
  beforeEach(() => {
    vi.mocked(openChatStream).mockReset();
  });

  it("turns a gogate error frame into an error event and never emits done", async () => {
    vi.mocked(openChatStream).mockResolvedValue(
      streamResponse([
        'data: {"choices":[{"delta":{"content":"partial"}}]}\n\n',
        'data: {"error":{"message":"request timeout","code":"request_timeout"}}\n\n',
        "data: [DONE]\n\n",
      ]),
    );

    const response = await runStreaming(
      { messages: [{ role: "user", content: "hello" }] },
      "mock",
      "req-1",
      new AbortController().signal,
    );
    const text = await response.text();

    expect(text).toContain("event: delta");
    expect(text).toContain("event: error");
    expect(text).toContain('"code":"request_timeout"');
    expect(text).not.toContain("event: usage");
    expect(text).not.toContain("event: done");
  });

  it("emits usage and done for a normal stream", async () => {
    vi.mocked(openChatStream).mockResolvedValue(
      streamResponse([
        'data: {"choices":[{"delta":{"content":"hello"}}]}\n\n',
        'data: {"choices":[],"usage":{"prompt_tokens":2,"completion_tokens":1,"total_tokens":3}}\n\n',
        "data: [DONE]\n\n",
      ]),
    );

    const response = await runStreaming(
      { messages: [{ role: "user", content: "hello" }] },
      "mock",
      "req-2",
      new AbortController().signal,
    );
    const text = await response.text();

    expect(text).toContain("event: usage");
    expect(text).toContain("event: done");
    expect(text).not.toContain("event: error");
  });
});
