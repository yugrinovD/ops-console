#!/usr/bin/env node
/**
 * A small dependency-free upstream fixture server used by Playwright.
 *
 * It exposes gogate admin/public, Prometheus, Jaeger and lmlog under path
 * prefixes on one port, so the BFF can be exercised end to end without Docker.
 */

import http from "node:http";

const PORT = Number(process.env.MOCK_PORT ?? 9910);
const ADMIN_TOKEN = process.env.MOCK_ADMIN_TOKEN ?? "e2e-gogate-admin";
const PLAYGROUND_KEY = process.env.MOCK_PLAYGROUND_KEY ?? "e2e-playground-key";
const LMLOG_TOKEN = process.env.MOCK_LMLOG_TOKEN ?? "e2e-lmlog-token";
const NOW = Date.now();

const tenantId = "11111111-1111-4111-8111-111111111111";
const secondaryTenantId = "22222222-2222-4222-8222-222222222222";
const keyId = "33333333-3333-4333-8333-333333333333";
const quotaId = "44444444-4444-4444-8444-444444444444";
const snapshotId = "55555555-5555-4555-8555-555555555555";
const traceId = "a".repeat(32);
const today = new Date().toISOString().slice(0, 10);
const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

const tenants = [
  {
    id: tenantId,
    name: "demo",
    created_at: "2026-01-01T10:00:00Z",
  },
  {
    id: secondaryTenantId,
    name: "loadtest",
    created_at: "2026-01-02T10:00:00Z",
  },
];

const keys = [
  {
    id: keyId,
    tenant_id: tenantId,
    name: "demo",
    key_prefix: "gk_dev_e2e0a1b2c3d",
    enabled: true,
    expires_at: null,
    last_used_at: new Date(NOW - 60_000).toISOString(),
    created_at: "2026-01-01T10:05:00Z",
  },
  {
    id: "66666666-6666-4666-8666-666666666666",
    tenant_id: tenantId,
    name: "console-playground",
    key_prefix: "gk_dev_e2e9f8e7d6c5",
    enabled: true,
    expires_at: null,
    last_used_at: new Date(NOW - 3_600_000).toISOString(),
    created_at: "2026-01-01T10:06:00Z",
  },
];

const quotas = [
  {
    id: quotaId,
    tenant_id: tenantId,
    api_key_id: null,
    rpm: 120,
    tpm: 120_000,
    daily_requests: 5000,
    daily_tokens: 2_000_000,
    monthly_cost_usd: 25,
    created_at: "2026-01-01T10:07:00Z",
    updated_at: "2026-01-01T10:07:00Z",
  },
  {
    id: "77777777-7777-4777-8777-777777777777",
    tenant_id: tenantId,
    api_key_id: keyId,
    rpm: 30,
    tpm: 30_000,
    daily_requests: 1000,
    daily_tokens: 500_000,
    monthly_cost_usd: 5,
    created_at: "2026-01-01T10:08:00Z",
    updated_at: "2026-01-01T10:08:00Z",
  },
];

const providers = [
  {
    id: "88888888-8888-4888-8888-888888888888",
    name: "mock",
    kind: "mock",
    base_url: "http://internal.mock:8081",
    api_key_env: "GOGATE_UPSTREAM_MOCK",
    models: ["mock", "mock-fast"],
    priority: 100,
    enabled: true,
    timeout_ms: 30000,
    max_retries: 1,
    config: { internal: true },
    created_at: "2026-01-01T10:00:00Z",
    updated_at: "2026-01-01T10:00:00Z",
  },
  {
    id: "99999999-9999-4999-8999-999999999999",
    name: "ollama",
    kind: "ollama",
    base_url: "http://ollama:11434",
    api_key_env: "",
    models: ["qwen2.5:3b"],
    priority: 10,
    enabled: true,
    timeout_ms: 30000,
    max_retries: 1,
    config: {},
    created_at: "2026-01-01T10:00:00Z",
    updated_at: "2026-01-01T10:00:00Z",
  },
];

const prices = [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    provider: "mock",
    model: "mock",
    input_usd_per_1m: 0.1,
    output_usd_per_1m: 0.2,
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    provider: "mock",
    model: "mock-fast",
    input_usd_per_1m: 0.05,
    output_usd_per_1m: 0.1,
  },
];

const usage = [
  {
    tenant_id: tenantId,
    provider: "mock",
    model: "mock",
    day: today,
    requests: 1200,
    prompt_tokens: 12_000,
    completion_tokens: 24_000,
    cost_usd: 0.006,
  },
  {
    tenant_id: tenantId,
    provider: "mock",
    model: "mock-fast",
    day: today,
    requests: 300,
    prompt_tokens: 3000,
    completion_tokens: 6000,
    cost_usd: 0.001,
  },
  {
    tenant_id: secondaryTenantId,
    provider: "mock",
    model: "mock",
    day: yesterday,
    requests: 8000,
    prompt_tokens: 80_000,
    completion_tokens: 160_000,
    cost_usd: 0.04,
  },
];

const keyUsage = [
  {
    api_key_id: keyId,
    tenant_id: tenantId,
    requests: 42,
    prompt_tokens: 420,
    completion_tokens: 840,
    cost_usd: 0.0002,
  },
  {
    api_key_id: "66666666-6666-4666-8666-666666666666",
    tenant_id: tenantId,
    requests: 12,
    prompt_tokens: 120,
    completion_tokens: 240,
    cost_usd: 0.0001,
  },
];

const audit = [
  {
    request_id: "e2e-request-0001",
    tenant_id: tenantId,
    key_prefix: "gk_dev_e2e0a1b2c3d",
    trace_id: traceId,
    model: "mock",
    provider: "mock",
    stream: true,
    status: 200,
    cache: "BYPASS",
    prompt_tokens: 14,
    completion_tokens: 24,
    cost_usd: 0.000006,
    latency_ms: 42,
    error_code: "",
    pii_redacted: false,
    created_at: new Date(NOW - 30_000).toISOString(),
  },
  {
    request_id: "e2e-request-0002",
    tenant_id: tenantId,
    key_prefix: "gk_dev_e2e0a1b2c3d",
    trace_id: "",
    model: "mock",
    provider: "mock",
    stream: false,
    status: 429,
    cache: "MISS",
    prompt_tokens: 3,
    completion_tokens: 0,
    cost_usd: 0,
    latency_ms: 2,
    error_code: "rate_limit_exceeded",
    pii_redacted: false,
    created_at: new Date(NOW - 120_000).toISOString(),
  },
  {
    request_id: "e2e-request-0003",
    tenant_id: secondaryTenantId,
    key_prefix: "gk_dev_e2e9f8e7d6c5",
    trace_id: "",
    model: "mock-fast",
    provider: "mock",
    stream: false,
    status: 502,
    cache: "MISS",
    prompt_tokens: 5,
    completion_tokens: 0,
    cost_usd: 0,
    latency_ms: 310,
    error_code: "upstream_error",
    pii_redacted: true,
    created_at: new Date(NOW - 300_000).toISOString(),
  },
];

const signatureItems = [
  {
    signature:
      "Failed request to Storage PARAM PARAM PARAM @App\\Infrastructure\\Storage\\SampleStorageClient",
    count: 120,
    errors: 120,
    levels: { ERROR: 120 },
    classes: { "App\\Infrastructure\\Storage\\SampleStorageClient": 120 },
    first_ts: "2026-08-25T00:00:01.479726+00:00",
    last_ts: "2026-08-25T23:59:01.479726+00:00",
    sample_message: "Failed request to Storage {method} {url} {statusCode}",
    sample_raw:
      '[2026-08-25T00:00:01.479726+00:00] app.ERROR: Failed request to Storage {method} {url} {statusCode} {"class":"App\\\\Infrastructure\\\\Storage\\\\SampleStorageClient"}',
    sample_context: {
      class: "App\\Infrastructure\\Storage\\SampleStorageClient",
      method: "GET",
      statusCode: 404,
    },
    daily: { [yesterday]: 40, [today]: 80 },
  },
  {
    signature: "Consumer failed to process message, retrying",
    count: 60,
    errors: 60,
    levels: { ERROR: 60 },
    classes: { "App\\Infrastructure\\Messaging\\SampleEventConsumer": 60 },
    first_ts: "2026-08-25T00:02:32+00:00",
    last_ts: "2026-08-25T23:55:38+00:00",
    sample_message: "Consumer failed to process message, retrying",
    sample_raw:
      '[2026-08-25T00:02:32+00:00] app.ERROR: Consumer failed to process message, retrying',
    sample_context: {
      class: "App\\Infrastructure\\Messaging\\SampleEventConsumer",
    },
    daily: { [yesterday]: 20, [today]: 40 },
  },
  {
    signature: "Start the process of auto stopping sample jobs",
    count: 900,
    errors: 0,
    levels: { INFO: 900 },
    classes: { "App\\UseCase\\Sample\\StopSample\\StopSampleHandler": 900 },
    first_ts: "2026-08-25T00:00:00+00:00",
    last_ts: "2026-08-25T23:59:59+00:00",
    sample_message: "Start the process of auto stopping sample jobs",
    sample_raw:
      '[2026-08-25T00:00:00+00:00] app.INFO: Start the process of auto stopping sample jobs',
    sample_context: {
      class: "App\\UseCase\\Sample\\StopSample\\StopSampleHandler",
    },
    daily: { [yesterday]: 300, [today]: 600 },
  },
  {
    signature: "Some user event occurred",
    count: 42,
    errors: 0,
    levels: { INFO: 42 },
    classes: { "App\\Domain\\User\\SampleUserService": 42 },
    first_ts: "2026-08-25T10:00:00+00:00",
    last_ts: "2026-08-25T22:00:00+00:00",
    sample_message: "Some user event occurred",
    sample_raw: '[2026-08-25T10:00:00+00:00] app.INFO: Some user event occurred',
    sample_context: { class: "App\\Domain\\User\\SampleUserService" },
    daily: { [today]: 42 },
  },
];

const trends = [
  {
    signature: signatureItems[1].signature,
    kind: "trend",
    severity: "high",
    count: 40,
    errors: 40,
    classes: signatureItems[1].classes ? Object.keys(signatureItems[1].classes) : [],
    sample: signatureItems[1].sample_message,
    note: "anomalous growth: 40 vs median 20 (x2.0)",
    detail: signatureItems[1].sample_raw,
    daily: signatureItems[1].daily,
  },
  {
    signature: signatureItems[3].signature,
    kind: "new_trend",
    severity: "low",
    count: 42,
    errors: 0,
    classes: ["App\\Domain\\User\\SampleUserService"],
    sample: signatureItems[3].sample_message,
    note: "new pattern during the observation window (first seen 2026-08-25)",
    detail: signatureItems[3].sample_raw,
    daily: signatureItems[3].daily,
  },
];

const sampleLogLines = `[2026-08-25T00:00:01.479726+00:00] app.ERROR: Failed request to Storage {method} {url} {statusCode} {"class":"App\\\\Infrastructure\\\\Storage\\\\SampleStorageClient"} {"method":"GET","url":"https://storage.example.internal/diskSpace","statusCode":404}
[2026-08-25T00:02:32.000000+00:00] app.ERROR: Consumer failed to process message, retrying {"class":"App\\\\Infrastructure\\\\Messaging\\\\SampleEventConsumer"}
[2026-08-25T10:00:00.000000+00:00] app.INFO: Some user event occurred {"class":"Domain\\\\User\\\\UserService"}
`;

function json(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

function error(res, status, code, message) {
  json(res, status, { error: { code, message } });
}

function requireBearer(req, res, token) {
  const header = req.headers.authorization ?? "";
  if (header !== `Bearer ${token}`) {
    error(res, 401, "unauthorized", "invalid or missing bearer token");
    return false;
  }
  return true;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function readJson(req) {
  const buffer = await readBody(req);
  if (!buffer.length) return {};
  try {
    return JSON.parse(buffer.toString("utf8"));
  } catch {
    return {};
  }
}

function prometheusValue(query) {
  if (query.includes("histogram_quantile")) {
    if (query.includes("0.99")) return 0.024;
    if (query.includes("0.95")) return 0.012;
    return 0.004;
  }
  if (query.includes("gogate_tokens_total")) return 1200;
  if (query.includes("gogate_cost_usd_total")) return 0.0002;
  if (query.includes("gogate_cache_hits_total")) return 0.25;
  if (query.includes("gogate_rate_limited_total")) return 2;
  if (query.includes("status=~")) return 0.013;
  return 12.5;
}

function prometheusSeries(query, step, points = 12) {
  const start = Math.floor(NOW / 1000) - step * points;
  return Array.from({ length: points }, (_, index) => {
    const base = prometheusValue(query);
    const wobble = 1 + Math.sin(index / 2) * 0.12;
    return [start + index * step, String(base * wobble)];
  });
}

function chatJson(model = "mock", content = "Mock response from gogate.") {
  return {
    id: "chatcmpl-e2e",
    object: "chat.completion",
    created: Math.floor(NOW / 1000),
    model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content },
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 14, completion_tokens: 24, total_tokens: 38 },
  };
}

function sseStart(res, headers = {}) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-store, no-transform",
    Connection: "keep-alive",
    ...headers,
  });
}

function sse(res, event, data, id) {
  if (id !== undefined) res.write(`id: ${id}\n`);
  if (event) res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function handlePublicChat(req, res, requestUrl) {
  if (!requireBearer(req, res, PLAYGROUND_KEY)) return;
  const body = await readJson(req);
  const model = body.model ?? "mock";
  const requestId = req.headers["x-request-id"] ?? "mock-request-id";
  if (!body.stream) {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "X-Request-ID": requestId,
      "X-Gogate-Provider": "mock",
      "X-Gogate-Cache": "MISS",
    });
    res.end(
      JSON.stringify(
        chatJson(
          model,
          `Mock response from gogate. You said: ${
            body.messages?.at(-1)?.content ?? "hello"
          }`,
        ),
      ),
    );
    return;
  }
  sseStart(res, {
    "X-Request-ID": requestId,
    "X-Gogate-Provider": "mock",
    "X-Gogate-Cache": "BYPASS",
  });
  const words = ["Mock ", "streaming ", "response ", "from ", "gogate."];
  for (const word of words) {
    res.write(
      `data: ${JSON.stringify({
        id: "chatcmpl-e2e-stream",
        object: "chat.completion.chunk",
        model,
        choices: [{ index: 0, delta: { content: word }, finish_reason: null }],
      })}\n\n`,
    );
    await sleep(15);
  }
  res.write(
    `data: ${JSON.stringify({
      id: "chatcmpl-e2e-stream",
      object: "chat.completion.chunk",
      model,
      choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
      usage: { prompt_tokens: 14, completion_tokens: 24, total_tokens: 38 },
    })}\n\n`,
  );
  res.write("data: [DONE]\n\n");
  res.end();
  void requestUrl;
}

async function handleUpload(req, res) {
  // Consume the multipart body so the client sees a normal request lifecycle.
  await readBody(req);
  json(res, 202, {
    job_id: snapshotId,
    status: "queued",
    filename: "console-sample.log",
    size_bytes: Buffer.byteLength(sampleLogLines),
  });
}

function handleJobEvents(res) {
  sseStart(res);
  res.write("retry: 1000\n\n");
  sse(res, "started", { status: "running", size_bytes: 2048 }, 1);
  setTimeout(() => {
    sse(
      res,
      "progress",
      {
        phase: "ingest",
        percent: 62.5,
        lines: 5000,
        entries: 4980,
        bytes: 1280,
        total_bytes: 2048,
      },
      2,
    );
  }, 40);
  setTimeout(() => {
    sse(
      res,
      "completed",
      {
        status: "completed",
        lines: 8000,
        entries: 7980,
        signatures: 42,
        errors: 3,
        findings: 8,
        trends: 2,
        elapsed_seconds: 0.4,
        lines_per_second: 20_000,
      },
      3,
    );
    res.end();
  }, 120);
}

function handleLmlog(req, res, pathname, requestUrl) {
  if (!requireBearer(req, res, LMLOG_TOKEN)) return;
  if (pathname === "/lmlog/healthz") {
    json(res, 200, { status: "ok", version: "e2e", jobs: 1 });
    return;
  }
  if (pathname === "/lmlog/api/v1/jobs" && req.method === "GET") {
    json(res, 200, [
      {
        id: snapshotId,
        filename: "console-sample.log",
        size_bytes: 2048,
        status: "completed",
        created_at: "2026-08-25T12:00:00+00:00",
        started_at: "2026-08-25T12:00:01+00:00",
        finished_at: "2026-08-25T12:00:02+00:00",
        progress: { phase: "completed", percent: 100 },
        stats: {
          lines: 8000,
          entries: 7980,
          signatures: 42,
          errors: 3,
          findings: 8,
          trends: 2,
          elapsed_seconds: 0.4,
          lines_per_second: 20_000,
        },
        error: null,
      },
    ]);
    return;
  }
  if (pathname === "/lmlog/api/v1/jobs" && req.method === "POST") {
    void handleUpload(req, res);
    return;
  }
  if (pathname.startsWith("/lmlog/api/v1/jobs/") && pathname.endsWith("/events")) {
    handleJobEvents(res);
    return;
  }
  if (pathname.startsWith("/lmlog/api/v1/jobs/")) {
    json(res, 200, {
      id: snapshotId,
      filename: "console-sample.log",
      size_bytes: 2048,
      status: "completed",
      created_at: "2026-08-25T12:00:00+00:00",
      started_at: "2026-08-25T12:00:01+00:00",
      finished_at: "2026-08-25T12:00:02+00:00",
      progress: { phase: "completed", percent: 100 },
      stats: {
        lines: 8000,
        entries: 7980,
        signatures: 42,
        errors: 3,
        findings: 8,
        trends: 2,
        elapsed_seconds: 0.4,
        lines_per_second: 20_000,
      },
      error: null,
    });
    return;
  }
  if (pathname.endsWith("/summary")) {
    json(res, 200, {
      snapshot_id: snapshotId,
      created: "2026-08-25T12:00:02",
      period_hours: "",
      files: 1,
      lines: 8000,
      entries: 7980,
      signatures: 42,
      errors: 180,
      levels: { INFO: 7700, ERROR: 180, WARNING: 100 },
      top_classes: [
        {
          name: "App\\UseCase\\Sample\\StopSample\\StopSampleHandler",
          count: 900,
        },
        { name: "App\\Domain\\User\\SampleUserService", count: 42 },
      ],
      daily_totals: { [yesterday]: 360, [today]: 7620 },
      stats: { lines: 8000, entries: 7980, signatures: 42, errors: 180 },
    });
    return;
  }
  if (pathname.endsWith("/signatures")) {
    const limit = Number(requestUrl.searchParams.get("limit") ?? 50);
    const offset = Number(requestUrl.searchParams.get("offset") ?? 0);
    json(res, 200, {
      items: signatureItems.slice(offset, offset + limit),
      total: signatureItems.length,
      limit,
      offset,
      snapshot: {
        created: "2026-08-25T12:00:02",
        period_hours: "",
        total_entries: 7980,
        signatures: 42,
      },
    });
    return;
  }
  if (pathname.endsWith("/errors")) {
    const errors = signatureItems.filter((item) => item.errors > 0);
    json(res, 200, {
      items: errors,
      total: errors.length,
      limit: 100,
      offset: 0,
      snapshot: {
        created: "2026-08-25T12:00:02",
        period_hours: "",
        total_entries: 7980,
        signatures: 42,
      },
    });
    return;
  }
  if (pathname.endsWith("/trends")) {
    json(res, 200, trends);
    return;
  }
  if (pathname === "/lmlog/api/v1/explain") {
    void readJson(req).then((body) => {
      json(res, 200, {
        signature: body.signature ?? "unknown",
        text:
          "SEVERITY: high\nWHAT IS HAPPENING: The storage service returned 404.\nLIKELY CAUSE: The route or bucket is missing.\nWHAT TO CHECK:\n- Storage health\n- Request path\n- Retry policy\n[heuristic: storage_http]",
        source: "heuristic",
        cached: false,
        model: null,
      });
    });
    return;
  }
  if (pathname === "/lmlog/api/v1/chat") {
    void readJson(req).then(() => {
      json(res, 200, {
        answer:
          "The most frequent error is the storage request 404. Check the storage route and bucket configuration first.",
        source: "heuristic",
        citations: [signatureItems[0], signatureItems[1]].map((item) => ({
          signature: item.signature,
          count: item.count,
          errors: item.errors,
          sample: item.sample_message,
        })),
        model: null,
        note: "Grounded on the snapshot's top signatures and the selected cluster. No retrieval or embeddings are used.",
      });
    });
    return;
  }
  error(res, 404, "not_found", "unknown lmlog route");
  void sampleLogLines;
}

function handleAdmin(req, res, pathname, requestUrl) {
  if (!requireBearer(req, res, ADMIN_TOKEN)) return;
  if (pathname === "/gogate/admin/v1/health") {
    json(res, 200, {
      version: "e2e (test, now)",
      database: { ok: true },
      redis: { ok: true },
      providers: [
        { name: "mock", kind: "mock", models: ["mock", "mock-fast"], breaker: "closed" },
        { name: "ollama", kind: "ollama", models: ["qwen2.5:3b"], breaker: "closed" },
      ],
      breakers: { mock: "closed", ollama: "closed" },
      problems: null,
    });
    return;
  }
  if (pathname === "/gogate/admin/v1/tenants" && req.method === "GET") {
    json(res, 200, tenants);
    return;
  }
  if (pathname === "/gogate/admin/v1/tenants" && req.method === "POST") {
    void readJson(req).then((body) => {
      json(res, 201, {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        name: body.name ?? "new-tenant",
        created_at: new Date().toISOString(),
      });
    });
    return;
  }
  if (pathname === "/gogate/admin/v1/keys" && req.method === "GET") {
    json(res, 200, keys);
    return;
  }
  if (pathname === "/gogate/admin/v1/keys" && req.method === "POST") {
    void readJson(req).then((body) => {
      json(res, 201, {
        id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        tenant_id: body.tenant_id ?? tenantId,
        name: body.name ?? "new-key",
        key_prefix: "gk_dev_e2e_newkey",
        enabled: true,
        expires_at: body.expires_at ?? null,
        last_used_at: null,
        created_at: new Date().toISOString(),
        key: "gk_dev_e2e_newkey_plaintext_once",
        warning: "store this key now; it is not shown again",
      });
    });
    return;
  }
  if (pathname.startsWith("/gogate/admin/v1/keys/")) {
    res.writeHead(204);
    res.end();
    return;
  }
  if (pathname === "/gogate/admin/v1/quotas" && req.method === "GET") {
    json(res, 200, quotas);
    return;
  }
  if (pathname === "/gogate/admin/v1/quotas" && req.method === "POST") {
    void readJson(req).then((body) => {
      json(res, 200, {
        id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        tenant_id: body.tenant_id ?? tenantId,
        api_key_id: body.api_key_id ?? null,
        rpm: body.rpm ?? null,
        tpm: body.tpm ?? null,
        daily_requests: body.daily_requests ?? null,
        daily_tokens: body.daily_tokens ?? null,
        monthly_cost_usd: body.monthly_cost_usd ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    });
    return;
  }
  if (pathname.startsWith("/gogate/admin/v1/quotas/")) {
    res.writeHead(204);
    res.end();
    return;
  }
  if (pathname === "/gogate/admin/v1/providers") {
    json(res, 200, providers);
    return;
  }
  if (pathname === "/gogate/admin/v1/prices") {
    json(res, 200, prices);
    return;
  }
  if (pathname === "/gogate/admin/v1/usage") {
    json(res, 200, usage);
    return;
  }
  if (pathname === "/gogate/admin/v1/usage/keys") {
    json(res, 200, keyUsage);
    return;
  }
  if (pathname === "/gogate/admin/v1/audit") {
    const q = (requestUrl.searchParams.get("q") ?? "").toLowerCase();
    const status = requestUrl.searchParams.get("status");
    const cache = requestUrl.searchParams.get("cache");
    const model = requestUrl.searchParams.get("model");
    const tenant = requestUrl.searchParams.get("tenant_id");
    const filtered = audit.filter((record) => {
      if (q && !`${record.request_id} ${record.key_prefix}`.toLowerCase().includes(q)) return false;
      if (status && String(record.status) !== status) return false;
      if (cache && record.cache !== cache) return false;
      if (model && record.model !== model) return false;
      if (tenant && record.tenant_id !== tenant) return false;
      return true;
    });
    const limit = Number(requestUrl.searchParams.get("limit") ?? 100);
    const offset = Number(requestUrl.searchParams.get("offset") ?? 0);
    json(res, 200, filtered.slice(offset, offset + limit));
    return;
  }
  if (pathname === "/gogate/admin/v1/reload") {
    json(res, 200, { ok: true });
    return;
  }
  error(res, 404, "not_found", "unknown admin route");
}

function handlePrometheus(req, res, pathname, requestUrl) {
  if (pathname === "/prometheus/-/healthy") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Prometheus is Healthy.\n");
    return;
  }
  if (pathname === "/prometheus/api/v1/query") {
    const query = requestUrl.searchParams.get("query") ?? "";
    const now = Math.floor(NOW / 1000);
    if (query.includes("topk")) {
      json(res, 200, {
        status: "success",
        data: {
          resultType: "vector",
          result: [
            { metric: { model: "mock" }, value: [now, "1000"] },
            { metric: { model: "mock-fast" }, value: [now, "200"] },
          ],
        },
      });
      return;
    }
    json(res, 200, {
      status: "success",
      data: {
        resultType: "vector",
        result: [
          {
            metric: {},
            value: [now, String(prometheusValue(query))],
          },
        ],
      },
    });
    return;
  }
  if (pathname === "/prometheus/api/v1/query_range") {
    const query = requestUrl.searchParams.get("query") ?? "";
    const step = Number(requestUrl.searchParams.get("step") ?? 60);
    json(res, 200, {
      status: "success",
      data: {
        resultType: "matrix",
        result: [
          {
            metric: {},
            values: prometheusSeries(query, step),
          },
        ],
      },
    });
    return;
  }
  error(res, 404, "not_found", "unknown prometheus route");
}

function handleJaeger(req, res, pathname) {
  if (pathname === "/jaeger/api/services") {
    json(res, 200, { data: ["gogate"], total: 1, limit: 0, offset: 0 });
    return;
  }
  if (pathname.startsWith("/jaeger/api/traces/")) {
    json(res, 200, {
      data: [
        {
          traceID: traceId,
          spans: [
            {
              traceID: traceId,
              spanID: "1111111111111111",
              operationName: "http.request",
              references: [],
              startTime: NOW * 1000,
              duration: 42_000,
              tags: [{ key: "span.kind", type: "string", value: "server" }],
              processID: "p1",
            },
            {
              traceID: traceId,
              spanID: "2222222222222222",
              operationName: "gateway.chat",
              references: [
                { refType: "CHILD_OF", traceID: traceId, spanID: "1111111111111111" },
              ],
              startTime: NOW * 1000 + 1000,
              duration: 40_000,
              tags: [{ key: "model", type: "string", value: "mock" }],
              processID: "p1",
            },
            {
              traceID: traceId,
              spanID: "3333333333333333",
              operationName: "provider.open",
              references: [
                { refType: "CHILD_OF", traceID: traceId, spanID: "2222222222222222" },
              ],
              startTime: NOW * 1000 + 3000,
              duration: 35_000,
              tags: [{ key: "provider", type: "string", value: "mock" }],
              processID: "p1",
            },
          ],
          processes: { p1: { serviceName: "gogate" } },
        },
      ],
      total: 1,
      limit: 0,
      offset: 0,
    });
    return;
  }
  error(res, 404, "not_found", "unknown jaeger route");
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
  const { pathname } = requestUrl;
  try {
    if (pathname === "/healthz") {
      json(res, 200, { status: "ok", port: PORT });
      return;
    }
    if (pathname.startsWith("/gogate/admin/v1")) {
      handleAdmin(req, res, pathname, requestUrl);
      return;
    }
    if (pathname === "/gogate/v1/models") {
      if (!requireBearer(req, res, PLAYGROUND_KEY)) return;
      json(res, 200, {
        object: "list",
        data: [
          { id: "mock", object: "model", created: 1, owned_by: "mock" },
          { id: "mock-fast", object: "model", created: 1, owned_by: "mock" },
          { id: "qwen2.5:3b", object: "model", created: 1, owned_by: "ollama" },
        ],
      });
      return;
    }
    if (pathname === "/gogate/v1/chat/completions") {
      await handlePublicChat(req, res, requestUrl);
      return;
    }
    if (pathname.startsWith("/prometheus/")) {
      handlePrometheus(req, res, pathname, requestUrl);
      return;
    }
    if (pathname.startsWith("/jaeger/")) {
      handleJaeger(req, res, pathname);
      return;
    }
    if (pathname.startsWith("/lmlog/")) {
      handleLmlog(req, res, pathname, requestUrl);
      return;
    }
    error(res, 404, "not_found", `unknown path ${pathname}`);
  } catch (cause) {
    console.error("mock upstream error", cause);
    if (!res.headersSent) {
      error(res, 500, "mock_error", String(cause));
    } else {
      res.end();
    }
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`mock upstreams listening on http://127.0.0.1:${PORT}`);
});
