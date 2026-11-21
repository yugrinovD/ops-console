export interface SseMessage<T = unknown> {
  event: string;
  data: T;
  id?: string;
}

export function parseSseFrame(frame: string): SseMessage | null {
  let event = "message";
  let id: string | undefined;
  const data: string[] = [];
  for (const line of frame.split("\n")) {
    if (!line || line.startsWith(":")) continue;
    const colon = line.indexOf(":");
    const field = colon >= 0 ? line.slice(0, colon) : line;
    const value = colon >= 0 ? line.slice(colon + 1).replace(/^ /, "") : "";
    if (field === "event") event = value;
    else if (field === "id") id = value;
    else if (field === "data") data.push(value);
  }
  if (!data.length) return null;
  const raw = data.join("\n");
  try {
    return { event, id, data: JSON.parse(raw) as unknown };
  } catch {
    return { event, id, data: raw };
  }
}

export async function readSse(
  response: Response,
  onMessage: (message: SseMessage<Record<string, unknown>>) => void,
  signal?: AbortSignal,
) {
  if (!response.body) throw new Error("Поток не поддерживается");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      if (signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const message = parseSseFrame(frame);
        if (message) onMessage(message as SseMessage<Record<string, unknown>>);
      }
    }
    if (buffer.trim()) {
      const message = parseSseFrame(buffer);
      if (message) onMessage(message as SseMessage<Record<string, unknown>>);
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
  }
}

export function eventSourceUrl(path: string) {
  return path;
}
