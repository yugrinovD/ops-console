# ADR 0001: BFF-only access to admin APIs

## Status

Accepted.

## Context

The console needs gogate admin and public APIs plus lmlog's token-protected API.
Serving those tokens to the browser would expose full control-plane access to any
XSS or malicious extension and would make CSP/CSRF boundaries harder to reason
about.

## Decision

The browser only calls same-origin `/api/*`. Next.js route handlers and server
components own all upstream calls, secret storage, retries, timeouts and error
normalisation.

## Consequences

- One extra network hop and a server runtime are required.
- Secrets never enter the client bundle, RSC payloads, localStorage or logs.
- RBAC, CSRF and rate limiting have one enforcement point.
- Upstream contracts are validated centrally with Zod.
- The BFF becomes the place to add caching, aggregation and degraded states.
