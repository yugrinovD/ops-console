# Contributing

This is a portfolio project, but it is maintained like a real service.

## Local checks

```bash
npm ci
cp .env.example .env.local
npm run dev

npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

## Rules

- Do not commit `.env*`, tokens, cookies, Playwright traces or screenshots with
  real customer data.
- Keep all upstream tokens server-side; the browser talks only to same-origin
  `/api/*`.
- Add Zod schemas for new upstream contracts.
- Update `CHANGELOG.md` for user-visible changes.
- Use conventional commit prefixes (`feat:`, `fix:`, `docs:`, `test:`).

See [AI_WORKFLOW.md](AI_WORKFLOW.md) and [docs/SECURITY.md](docs/SECURITY.md).
