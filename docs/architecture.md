# Architecture

```text
apps/web  (Next.js 16: Alexa+ simulator, agent trace console, plan re-entry)
    |  REST (JSON, problem+json errors)
apps/api  (Hono on node:http)  ─────────────►  packages/mcp-server  (/mcp, Streamable HTTP)
    |                                                   |
    └─────────────►  packages/agent-core  ◄──────────────┘
                     HomeOpsService: ports, deterministic safety,
                     orchestration, fallback, trace
                          |                    |
        packages/adapters-nebius        packages/adapters-tavily
        (NVIDIA models on Nebius)       (runtime research)
                          |                    |
                     packages/persistence (SQLite + Drizzle)
```

## Rules that are enforced by review, not only by documentation

1. `agent-core` depends on `@homeops/contracts` and Node built-ins only. It never imports a provider SDK.
2. REST routes and MCP tools are thin adapters over the same `HomeOpsService`. Tool names and route names map
   one-to-one onto service methods, so a capability can never exist on one surface only.
3. Every external dependency arrives through a port: `ModelProvider`, `SearchProvider`, `PlanRepository`,
   `HouseholdRepository`, `TraceSink`, `Clock`, `IdGenerator`.
4. Safety is deterministic and cannot be lowered by model output.
5. State-changing operations require explicit confirmation (`confirm: true`); without it the service returns a
   `confirmation_required` payload describing exactly what would change.
6. Traces contain action-level summaries. Raw prompts, hidden chain-of-thought and API keys are never exposed.

## Request flow for the boiler scenario

```text
intake.received
safety.evaluated              deterministic rules decide the urgency floor
clarification.requested       only when the model asks something that changes the plan (max 2, one round)
model.plan.requested          NVIDIA model on Nebius, JSON mode
model.plan.received           validated against PlanDraftSchema, one repair retry
safety.override.applied       only if the model tried to go below the rules
search.requested / completed  Tavily, sources keep URL + retrieval time
plan.persisted                SQLite through Drizzle
confirmation.required         actions that contact a third party
response.returned
```

## Surfaces

| Surface | Where | Purpose |
|---|---|---|
| REST | `apps/api/src/routes/*` | the web app, curl, and any reviewer |
| MCP | `packages/mcp-server`, mounted at `/mcp` | Alexa+ style clients: six high-level household operations |
| CLI | `scripts/demo-plan.ts` | end-to-end proof without a browser |
| Smoke test | `scripts/mcp-smoke.ts` | tool discovery, tool call, auth and confirmation over real HTTP |

## Persistence

SQLite through Drizzle ORM, with an idempotent DDL bootstrap at start-up (`packages/persistence/src/client.ts`)
and `drizzle-kit` configured for future migrations. Tables: `households`, `household_members`, `plans`,
`plan_actions`, `trace_events`, `preferences`. A test performs a full ORM round-trip on every table so the DDL
and the Drizzle schema cannot drift unnoticed.

## Why one service layer, two surfaces

Amazon rewards demonstrable integration: the MCP server is not a wrapper that re-implements logic, it is a
second projection of the same domain service that the web simulator uses. That is also why the agent trace is
identical in both demos.

