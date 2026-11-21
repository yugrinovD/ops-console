# ADR 0004: Fixed PromQL allowlist and honest degradation

## Status

Accepted.

## Context

The dashboard needs RPS, latency quantiles, errors, tokens, cost, cache hit and
rate-limit metrics. Letting the browser send arbitrary PromQL would create an
injection and cost/DoS surface and would make the UI depend on Prometheus query
semantics.

## Decision

- The browser chooses only a range: `15m`, `1h`, `6h`, `24h`, `7d`.
- The BFF derives step, rate window and a fixed set of PromQL expressions.
- Usage comes from gogate admin daily aggregates.
- If Prometheus is missing or unavailable, the response sets
  `metricsAvailable=false`, includes a warning and keeps usage cards available.
- Top models/tenants merge usage aggregates with Prometheus request counts when possible.

## Consequences

- No arbitrary query execution through the console.
- Short ranges still have daily usage granularity for top tables; the UI labels this.
- Live metrics depend on Prometheus scrape health and retention.
- Error rate and cache hit default to zero when Prometheus has request data but
  no matching error/cache series.
