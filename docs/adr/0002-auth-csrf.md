# ADR 0002: Single-token auth with signed session and CSRF

## Status

Accepted.

## Context

The project needs simple operator access without introducing an IdP or database.
The requirements call for a token, an HMAC-signed httpOnly cookie with expiry,
SameSite=Lax, server-only upstream tokens and CSRF-protected mutations. P1 also
requires admin/viewer roles.

## Decision

- `CONSOLE_AUTH_TOKEN` is admin; optional `CONSOLE_VIEWER_TOKEN` is viewer.
- Login compares tokens in constant time and issues `{role, iat, exp, v}` as an
  HMAC-SHA256 signed cookie.
- The session secret is explicit or derived from the auth token.
- Mutations require an allowed Origin, same-origin fetch metadata and a
  double-submit CSRF token.
- Roles are enforced inside every route handler.

## Consequences

- Rotating the auth token invalidates sessions when no explicit session secret is set.
- No server-side session store or revocation list exists; the 12-hour expiry bounds risk.
- Login throttling is in-memory and single-instance.
- Viewer is suitable for read-only access, not for per-user audit trails.
