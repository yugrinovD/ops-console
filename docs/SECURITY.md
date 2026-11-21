# Security

## Threat model

Assets:

- gogate admin token and playground API key;
- lmlog API token;
- tenant API key material (plaintext is shown once, hashes live in gogate);
- provider configuration and upstream URLs;
- log samples, prompts and responses displayed by the console;
- the console session.

Trust boundaries:

1. Browser → Next.js BFF (same-origin).
2. Next.js BFF → gogate/Prometheus/Jaeger/lmlog (server-to-server).
3. Console filesystem → alert rules.

Primary threats and mitigations:

| Threat | Mitigation |
| --- | --- |
| Admin token stolen from browser storage | Tokens are never sent to the browser; session is an httpOnly cookie. |
| CSRF on mutations | `Origin` + `Sec-Fetch-Site` checks and double-submit CSRF token. |
| XSS via model/log output | React escaping; Markdown sanitised with `rehype-sanitize`; CSP nonce. |
| Secret leakage in logs/errors | Server-only env module, pino redaction, upstream auth errors mapped to generic 502. |
| SSRF by user-supplied upstream URL | Browser cannot set upstream URLs; admin API is server-only. |
| Path traversal on log upload | Filename sanitisation and generated storage names live in lmlog; the BFF never writes uploads to disk. |
| Oversized upload / DoS | 50 MiB limit, extension allowlist, streaming BFF proxy, lmlog size checks. |
| Prompt injection from logs | Log data is wrapped as untrusted data; the model has no tools and its output is sanitised. |
| Broken access control | RBAC enforced in each route handler, not only in the UI. |
| Brute-force login | In-memory fixed-window login throttling. |
| Clickjacking | `frame-ancestors 'none'` and `X-Frame-Options: DENY`. |
| CDN/proxy caching of API data | `Cache-Control: no-store` on BFF responses. |

## Authentication

- `CONSOLE_AUTH_TOKEN` maps to `admin`.
- `CONSOLE_VIEWER_TOKEN` is optional and maps to `viewer`.
- Tokens are compared in constant time after SHA-256 hashing.
- Five failed attempts per IP within five minutes are throttled.
- The session payload is `{ role, iat, exp, v:1 }`, HMAC-SHA256 signed.
- The session secret is `CONSOLE_SESSION_SECRET` or a deterministic derivative
  of the auth token. Rotating the auth token invalidates sessions when no
  explicit secret is configured.
- Session TTL is 12 hours. There is no refresh token.
- Logout clears both session and CSRF cookies.

## CSRF

For every mutation:

1. `Origin` must equal `CONSOLE_ORIGIN` (or the direct request origin).
2. `Sec-Fetch-Site`, when present, must be `same-origin` or `none`.
3. The `console_csrf` cookie must equal the `X-CSRF-Token` header.

Login checks the origin but does not require a CSRF token because no session
exists yet. Login CSRF is prevented by the origin check.

## Headers

The proxy generates a fresh nonce per document request and sets:

```
default-src 'self';
script-src 'self' 'nonce-…' 'strict-dynamic';
style-src 'self' 'unsafe-inline';
img-src 'self' blob: data:;
font-src 'self';
connect-src 'self';
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
upgrade-insecure-requests (production only)
```

Additional headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy` and HSTS.

`style-src` keeps `'unsafe-inline'` because React/Recharts emit inline style
attributes; scripts remain nonce-based.

## Secrets

Server-only modules import `server-only`, so an accidental client import fails
the build. Cookie names and the public session shape live in
`src/lib/session-constants.ts` (client-safe); HMAC signing and secret handling
stay in the server-only `src/lib/session.ts`. Secrets are read from
`process.env` by `src/lib/server/env.ts`, which validates them with Zod. They
are not returned by any BFF endpoint, not embedded in RSC payloads and not
logged. Pino redacts authorization/cookie headers and common secret fields.

The playground key is a dedicated server-side gogate key. The browser only sees
model names, provider names/kinds, prices and metadata; provider `base_url`,
`api_key_env` and `config` are stripped by `sanitizeProvider`.

## Uploads

- The BFF checks `Content-Length` and streams the body to lmlog.
- lmlog enforces the authoritative size limit, extension allowlist and
  generated storage names.
- lmlog stores jobs under UUID directories and validates IDs as UUIDs.
- Error responses never include filesystem paths.

## LLM output and prompt injection

Logs and model output are untrusted.

- Chat prompts tell the model to treat `<log_data>` as data, not instructions.
- The model has no tools and cannot execute code.
- Responses are rendered as sanitised Markdown; raw HTML is not enabled.
- The console never executes model output.

## Logging

Structured JSON logs include request IDs, route, status, latency and upstream
service names. They do not include tokens, cookies, prompts, responses or raw log
lines. Upstream contract errors log only the first few Zod issues.

## Known limitations

- Login throttling and playground rate limits are process-local.
- Alert rules are stored in a local file; the console is intended for one instance.
- There is no MFA, password rotation or external IdP.
- The CSP relies on dynamic rendering for nonce injection.
- Jaeger and Prometheus may be unauthenticated in local demo deployments; bearer
  tokens are supported for hardened setups.
- The console trusts `CONSOLE_ORIGIN`; a misconfigured reverse proxy can break
  CSRF checks or cookie security flags.

## Reporting

Please report suspected vulnerabilities privately to the repository owner rather
than opening a public issue with exploit details.
