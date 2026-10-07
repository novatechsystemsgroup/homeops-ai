# AGENTS.md — working conventions

## Architecture rules (non-negotiable)

1. `packages/agent-core` must not import external SDKs (Nebius, Tavily, MCP, Drizzle, Hono). It depends on `@homeops/contracts` and Node built-ins only.
2. All external access goes through the ports in `packages/agent-core/src/ports.ts`; implementations live in `packages/adapters-*` and are wired in `apps/api/src/container.ts`.
3. REST routes (`apps/api/src/routes/*`) and MCP tools (`packages/mcp-server/src/tools/*`) are thin adapters over `HomeOpsService`. Never duplicate domain logic in a route or tool.
4. Safety is deterministic (`packages/agent-core/src/safety/rules.ts`). A model output can never lower the urgency produced by the rules.
5. Every state-changing operation requires `confirm: true`; without it return `confirmation_required`.
6. Never log or return API keys, raw prompts, or hidden chain-of-thought. Traces contain action-level summaries only.

## Code style

- TypeScript strict, ESM only, `verbatimModuleSyntax`; use `import type` for types.
- Zod 4 API: `z.uuid()`, `z.iso.datetime()`, `z.url()` (not the Zod 3 `z.string().uuid()` style).
- Workspace packages export raw TypeScript (`./src/index.ts`); consumers run through `tsx` (services) or Next's `transpilePackages`.
- Tests live next to the code as `*.test.ts` and run with Vitest.

## Commands

```bash
pnpm install
pnpm lint && pnpm typecheck && pnpm test
pnpm db:migrate && pnpm db:seed
pnpm dev
```

## Secrets

- `.env` is git-ignored; only `.env.example` is committed.
- Never print key values in logs, tests, fixtures or documentation.
- `pnpm scan:secrets` must stay green before every commit.
