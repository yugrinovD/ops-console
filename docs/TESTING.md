# Testing

## Test pyramid

| Layer | Tool | What it covers |
| --- | --- | --- |
| Unit | Vitest | session/HMAC, CSRF, schemas, CSV, SSE parsing, alerts, provider sanitisation, formatting |
| Component | React Testing Library + MSW | metric cards, sanitised Markdown, clipboard, service status, login form |
| E2E | Playwright | auth/RBAC, dashboard, playground streaming, keys, logs/SSE/chat, traces, alerts, compare, theme |
| Backend | pytest | lmlog serve auth, upload lifecycle, size/extension limits, traversal, explain/chat, SSE |
| Backend | Go test | gogate handlers, audit filters, trace id, usage by key |

## Commands

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

`npm run test:e2e` expects a production build in `.next`. In CI the build runs
before Playwright.

## Unit and component tests

`vitest.config.mts` uses jsdom and aliases `server-only` to an empty module so
server utilities can be imported in Node tests.

`src/test/setup.ts`:

- installs jest-dom matchers;
- polyfills `ResizeObserver`, `matchMedia`, `scrollIntoView`;
- resolves relative `fetch('/api/...')` URLs to `http://localhost/...` so MSW can
  intercept them;
- starts the MSW node server with `onUnhandledRequest: "error"`.

Coverage highlights:

- `tests/unit/session.test.ts` — sign/verify, tampering, expiry, wrong secret,
  unknown role.
- `tests/unit/csrf.test.ts` — same-origin, foreign origin, cross-site metadata,
  double-submit mismatch.
- `tests/unit/alerts.test.ts` — atomic create/update/delete, threshold evaluation,
  disabled rules, temp data directory.
- `tests/unit/api-client.test.tsx` — Zod validation, error envelope, service
  health through MSW and TanStack Query.
- `tests/unit/login-form.test.tsx` — successful redirect and invalid-token error.
- `tests/unit/components.test.tsx` — progress accessibility, sanitised Markdown,
  clipboard interaction.

## E2E harness

`playwright.config.ts` starts two processes:

1. `node scripts/mock-upstreams.mjs` on `:9910`:
   - gogate admin under `/gogate/admin/v1`
   - gogate public under `/gogate/v1`
   - Prometheus under `/prometheus`
   - Jaeger under `/jaeger`
   - lmlog under `/lmlog`
2. `npx next start -p 3101` with test-only env pointing at the mock server.

This exercises the real Next.js app, route handlers, SSR, cookies, CSRF, SSE
parsing and UI. No Docker is required.

Tests create their own cookies by logging in through the UI. Viewer tests open a
separate browser context. The alert test writes into
`$TMPDIR/ops-console-e2e-data`.

## Screenshots

`tests/e2e/screenshots.spec.ts` captures the images used in the README:

- `docs/screenshots/login.jpg`
- `docs/screenshots/dashboard.jpg`
- `docs/screenshots/playground.jpg`
- `docs/screenshots/keys.jpg`
- `docs/screenshots/logs.jpg`
- `docs/screenshots/requests.jpg`
- `docs/screenshots/alerts.jpg`
- `docs/screenshots/compare.jpg`

They are generated at a 1440×900 viewport against deterministic mock data.

## CI

`.github/workflows/ci.yml` runs:

- `quality`: npm ci, lint, typecheck, unit tests, production build;
- `e2e`: build, Playwright with Chromium, upload Playwright report and failures;
- `docker`: multi-stage image build with Buildx cache.

## Backend tests

lmlog:

```bash
cd ../lmlog
pip install -e ".[dev,serve]"
pytest
ruff check .
```

gogate:

```bash
cd ../gogate
go test ./...
go build ./...
```

The gogate audit/usage changes are additive; existing integration tests continue
to cover the original request path.

## Manual smoke

Before a release, with real services:

1. Sign in as admin and viewer.
2. Check dashboard with Prometheus stopped: usage cards remain, a warning appears.
3. Send streaming and non-streaming playground requests; verify provider, cache,
   request id, tokens and cost.
4. Upload a log; verify SSE progress and all snapshot tabs.
5. Open a request with `trace_id`; verify the Jaeger waterfall.
6. Create a key, copy plaintext once, disable it, delete it.
7. Create a quota and verify utilization bars.
8. Create an alert, trigger it by lowering the threshold.
9. Export CSV from dashboard, requests and logs.
