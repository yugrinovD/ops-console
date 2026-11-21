# Operations

## Prerequisites

- Node.js 24+
- npm 11+
- gogate with admin API enabled
- Prometheus scraping gogate (for live metrics)
- optional: Jaeger with OTel tracing enabled in gogate
- optional: `lmlog serve` (Python 3.10+ with the `serve` extra)

The console itself needs no database and no `OLLAMA_*` variables. In the full
stack `lmlog` calls `gogate`, and `gogate` is the only service that talks to
Ollama. If LLM calls fail, `lmlog` falls back to deterministic heuristics; the
console shows `source=heuristic`.

## Ports

| Service | Default | Note |
| --- | --- | --- |
| ops-console | `3100` | chosen to avoid Grafana on `3000` |
| gogate public | `8080` | `/v1` |
| gogate admin | `9090` | `/admin/v1` |
| Prometheus | `9092` | gogate compose mapping |
| Jaeger | `16686` | UI and query API |
| lmlog serve | `8090` | `/api/v1` |

## Local process

```bash
npm ci
cp .env.example .env.local
# edit tokens and URLs
npm run dev
```

Production build:

```bash
npm run build
npm run start
```

## Docker

```bash
cp .env.example .env
docker compose up -d --build
```

Inside the container, `127.0.0.1` points at the container itself. Use
`host.docker.internal` for services running on the host:

```dotenv
GOGATE_ADMIN_URL=http://host.docker.internal:9090
GOGATE_PUBLIC_URL=http://host.docker.internal:8080
PROMETHEUS_URL=http://host.docker.internal:9092
GOGATE_JAEGER_URL=http://host.docker.internal:16686
# The browser cannot resolve host.docker.internal; links must use the host URL.
GOGATE_JAEGER_PUBLIC_URL=http://localhost:16686
LMLOG_API_URL=http://host.docker.internal:8090
CONSOLE_ORIGIN=http://localhost:3100
```

The image runs as a non-root user and stores alerts in `/data`.

## Reverse proxy and TLS

Set `CONSOLE_ORIGIN` to the public HTTPS origin, for example
`https://ops.example.com`. Cookies become `Secure` automatically when the origin
is HTTPS. Keep the original `Origin` header when proxying; do not rewrite it to a
different host, otherwise CSRF checks will reject mutations.

Example nginx location:

```nginx
location / {
    proxy_pass http://127.0.0.1:3100;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_read_timeout 300s;
    proxy_buffering off; # SSE
}
```

## Health

`GET /api/health` checks gogate admin, lmlog, Prometheus and Jaeger and returns a
sanitised snapshot:

```json
{
  "status": "ok",
  "checkedAt": "2026-11-21T09:30:00.000Z",
  "services": [
    { "name": "gogate", "state": "ok", "detail": "vdev" },
    { "name": "lmlog", "state": "ok" },
    { "name": "prometheus", "state": "ok" },
    { "name": "jaeger", "state": "ok" }
  ]
}
```

`status=degraded` means at least one configured service is down. The topbar shows
the same snapshot every 30 seconds.

## Dashboard dependencies

- RPS, latency, errors, tokens, cost and cache hit come from Prometheus.
- Top models/tenants and daily usage come from gogate admin `/usage`.
- If Prometheus is not configured, the console shows usage aggregates and a
  warning instead of inventing metrics.
- If gogate admin is not configured, usage tables are empty but live metrics
  remain available.

Fixed queries include:

```promql
sum(rate(gogate_requests_total[5m]))
histogram_quantile(0.95, sum by (le) (rate(gogate_request_duration_seconds_bucket[5m])))
sum(rate(gogate_requests_total{status=~"5.."}[5m])) / clamp_min(sum(rate(gogate_requests_total[5m])), 1e-9)
sum(rate(gogate_cache_hits_total[5m])) / clamp_min(sum(rate(gogate_requests_total[5m])), 1e-9)
```

## Traces

For exact Jaeger links, gogate must persist `trace_id` in audit. The additive
gogate migration `0006_audit_trace.sql` adds this column. gogate must also have:

```dotenv
GOGATE_TRACING_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318
GOGATE_TRACE_SAMPLE_RATIO=1
```

If a request was created before tracing was enabled or the trace was not sampled,
the request sheet shows “trace unavailable” and links to a time-scoped Jaeger
search instead.

## lmlog serve

```bash
export LMLOG_API_TOKEN="$(openssl rand -hex 32)"
LMLOG_SERVE_DATA_DIR=/var/lib/lmlog-serve lmlog serve --host 0.0.0.0 --port 8090
```

Run one uvicorn worker: jobs and SSE subscribers live in process memory. Uploads
and snapshots are stored on disk. Set a persistent volume for
`LMLOG_SERVE_DATA_DIR`.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `gogate_not_configured` | `GOGATE_ADMIN_URL`, `GOGATE_ADMIN_TOKEN` |
| `upstream_gogate_auth_failed` | admin token matches gogate `.env` |
| Playground disabled | `GOGATE_PUBLIC_URL`, `GOGATE_PLAYGROUND_API_KEY` |
| Dashboard says Prometheus unavailable | `PROMETHEUS_URL`, scrape target, `/-/healthy` |
| Top models empty | `GOGATE_AUDIT_ENABLED=true`, usage has been flushed |
| No trace_id | tracing/sampling, gogate migration version 6 |
| `lmlog_not_configured` | `LMLOG_API_URL`, `LMLOG_API_TOKEN` |
| Upload 413 | `LMLOG_MAX_UPLOAD_MB` and lmlog `LMLOG_SERVE_MAX_UPLOAD_MB` |
| Login loops | `CONSOLE_ORIGIN`, proxy `Origin`, cookie `Secure` |
| CSRF failures | proxy rewrites origin or strips cookies |
| SSE stalls behind proxy | disable proxy buffering, allow long read timeout |

## Logs

Set `CONSOLE_LOG_LEVEL=debug` for verbose server logs. Logs are JSON and include
`requestId`; never include tokens, cookies, prompts or log lines.

## Backup

Only `CONSOLE_DATA_DIR/alerts.json` is persistent state. Back up the Docker volume
or the directory. All other data lives in gogate/lmlog.
