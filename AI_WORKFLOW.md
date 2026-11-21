# AI workflow

This project follows the shared [AI Ops Stack AI workflow](https://github.com/yugrinovD/ai-ops-stack/blob/master/AI_WORKFLOW.md).

Additional rules for `ops-console`:

- Never send upstream admin tokens, playground keys or lmlog tokens to the
  browser.
- Validate every upstream response with Zod.
- Render model and log output through sanitized Markdown.
- Regenerate screenshots only from synthetic mock data.
