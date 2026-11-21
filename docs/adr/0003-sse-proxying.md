# ADR 0003: Normalise playground SSE, pass through lmlog SSE

## Status

Accepted.

## Context

Playground clients need provider, fallback, cache, request id, usage and cost in
addition to streamed text. lmlog exposes progress as a GET SSE stream with IDs and
`Last-Event-ID` replay. These are different needs.

## Decision

- Playground: the BFF parses upstream OpenAI SSE and re-emits a small protocol
  (`meta → delta → usage → done | error`). It calculates cost from gogate prices
  and records the actual provider.
- lmlog: the BFF passes frames through unchanged, forwards `Last-Event-ID`, adds
  no buffering and returns `204` for an already fully replayed terminal job.

Both use abort signals tied to the incoming request.

## Consequences

- The playground protocol is stable even if OpenAI chunk details change.
- Cost and provider metadata are computed server-side and cannot be forged by
  the browser.
- The BFF must handle partial SSE frames and upstream errors after headers are sent.
- lmlog backpressure is inherited from `EventSource`; a slow client cannot block
  ingest because the server drops events for a full subscriber queue.
