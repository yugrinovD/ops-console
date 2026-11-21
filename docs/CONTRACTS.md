# Contracts

All runtime contracts are validated with Zod in `src/lib/schemas/*`. This document
describes the upstream endpoints and the BFF/SSE protocols.

## Error envelope

Every BFF error:

```ts
type ApiError = {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: unknown;
  };
};
```

Common codes:

- `unauthorized`, `forbidden`, `csrf_failed`, `origin_not_allowed`
- `invalid_request`, `not_found`, `conflict`
- `upstream_<service>_unavailable`
- `upstream_<service>_auth_failed`
- `upstream_<service>_contract`
- `playground_not_configured`, `gogate_not_configured`, `lmlog_not_configured`

## Auth

### `POST /api/auth/login`

```json
{ "token": "…" }
```

Response:

```json
{ "role": "admin" }
```

Sets:

- `console_session` — HMAC-signed httpOnly cookie, 12h, SameSite=Lax;
- `console_csrf` — readable double-submit token.

### Mutations

Send:

```
Origin: https://console.example
X-CSRF-Token: <console_csrf cookie value>
Content-Type: application/json
```

## gogate upstream

Used endpoints:

| Method | Path |
| --- | --- |
| GET | `/admin/v1/health` |
| GET | `/admin/v1/tenants` |
| POST | `/admin/v1/tenants` |
| GET/POST | `/admin/v1/keys` |
| PATCH/DELETE | `/admin/v1/keys/{id}` |
| GET/POST | `/admin/v1/quotas` |
| DELETE | `/admin/v1/quotas/{id}` |
| GET | `/admin/v1/providers` |
| GET | `/admin/v1/prices` |
| GET | `/admin/v1/usage` |
| GET | `/admin/v1/usage/keys` |
| GET | `/admin/v1/audit` |
| GET | `/v1/models` |
| POST | `/v1/chat/completions` |

Provider objects are sanitised before reaching the browser: `base_url`,
`api_key_env` and `config` are removed.

## Prometheus

Used endpoints:

- `GET /api/v1/query`
- `GET /api/v1/query_range`
- `GET /-/healthy`

The BFF never accepts PromQL from the browser. Range and step are derived from
`15m|1h|6h|24h|7d`.

## Jaeger

- `GET /api/traces/{traceId}` — waterfall data.
- `GET /api/services` — health.

`traceId` must match `^[0-9a-f]{32}$`. The UI link is
`${GOGATE_JAEGER_PUBLIC_URL}/trace/{traceId}`; it falls back to
`GOGATE_JAEGER_URL` when the public URL is unset. The public URL must be
reachable from the browser, while `GOGATE_JAEGER_URL` is used for server-side
API calls.

## lmlog upstream

| Method | Path |
| --- | --- |
| POST | `/api/v1/jobs` |
| GET | `/api/v1/jobs` |
| GET | `/api/v1/jobs/{id}` |
| GET | `/api/v1/jobs/{id}/events` |
| GET | `/api/v1/snapshots/{id}/summary` |
| GET | `/api/v1/snapshots/{id}/signatures` |
| GET | `/api/v1/snapshots/{id}/errors` |
| GET | `/api/v1/snapshots/{id}/trends` |
| POST | `/api/v1/explain` |
| POST | `/api/v1/chat` |
| GET | `/healthz` |

All API calls use `Authorization: Bearer ${LMLOG_API_TOKEN}`.

## Playground SSE (BFF → browser)

`POST /api/playground` with `stream: true` returns `text/event-stream`.

```text
event: meta
data: {"requestId":"…","provider":"mock","cache":"MISS","fallback":false,"chain":["mock"],"model":"mock"}

event: delta
data: {"text":"Hello"}

event: usage
data: {"promptTokens":6,"completionTokens":16,"totalTokens":22,"costUsd":0.000004,"latencyMs":42,"finishReason":"stop","contentLength":61}

event: done
data: {"ok":true}
```

Errors after the stream starts:

```text
event: error
data: {"code":"stream_failed","message":"…"}
```

`gogate` may emit an OpenAI-compatible `{"error": …}` frame followed by
`[DONE]` after a timeout or upstream failure. The BFF converts it to the
`event: error` frame above and does not send `event: done` afterwards.

Client rules:

- abort with `AbortController` when the user stops;
- do not auto-retry after partial output;
- retry only before the first token.

## lmlog job SSE (lmlog → BFF → browser)

Frames are passed through with their IDs. The browser uses native `EventSource`,
which sends `Last-Event-ID` on reconnect.

```text
id: 1
event: started
data: {"status":"running","size_bytes":2313}

id: 2
event: progress
data: {"phase":"ingest","percent":62.5,"lines":5000,"entries":4980,"bytes":1280,"total_bytes":2048}

id: 3
event: completed
data: {"status":"completed","lines":8000,"entries":7980,"signatures":42,"errors":3}
```

Also possible: `event: failed` with `{status,message}`.

When a terminal job is fully replayed, the BFF returns `204` so `EventSource`
stops reconnecting.

## Alert rules

Stored in `CONSOLE_DATA_DIR/alerts.json`:

```ts
type AlertRule = {
  id: string;
  name: string;
  metric: "errorRate" | "p95" | "p99" | "rps" | "cacheHitShare" | "rateLimited";
  comparator: "gt" | "gte" | "lt" | "lte";
  threshold: number;
  severity: "info" | "warning" | "critical";
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};
```

Evaluation units:

- `errorRate`, `cacheHitShare` — percent (`0..100`);
- `p95`, `p99` — milliseconds;
- `rps` — requests per second;
- `rateLimited` — requests per second.

## CSV exports

- UTF-8 BOM;
- RFC4180 quoting;
- formula injection neutralised with a leading `'`;
- `Content-Disposition: attachment; filename="…csv"`;
- `Cache-Control: no-store`.
