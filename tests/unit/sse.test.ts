import { describe, expect, it, vi } from "vitest";
import { parseSseFrame, readSse } from "@/lib/client/sse";

describe("SSE parsing", () => {
  it("parses event, id and JSON data", () => {
    const message = parseSseFrame(
      'id: 7\nevent: delta\ndata: {"text":"hello"}',
    );
    expect(message).toEqual({ id: "7", event: "delta", data: { text: "hello" } });
  });

  it("joins multi-line data and ignores comments", () => {
    const message = parseSseFrame(
      "event: note\n: heartbeat\ndata: line one\ndata: line two",
    );
    expect(message?.event).toBe("note");
    expect(message?.data).toBe("line one\nline two");
  });

  it("returns null for frames without data", () => {
    expect(parseSseFrame(": heartbeat")).toBeNull();
  });

  it("reads a stream of frames", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode('event: meta\ndata: {"provider":"mock"}\n\n'),
        );
        controller.enqueue(
          encoder.encode('event: delta\ndata: {"text":"hi"}\n\n'),
        );
        controller.close();
      },
    });
    const onMessage = vi.fn();
    await readSse(new Response(stream), onMessage);
    expect(onMessage).toHaveBeenCalledTimes(2);
    expect(onMessage.mock.calls[0]?.[0]).toMatchObject({ event: "meta" });
    expect(onMessage.mock.calls[1]?.[0]).toMatchObject({
      event: "delta",
      data: { text: "hi" },
    });
  });
});
