# HomeOps AI

> A household operations agent that turns a natural request such as *"the boiler is making a noise and we have guests on Saturday"* into an executable, explainable plan — and follows it until it is done.

HomeOps AI is submitted to two hackathons from one codebase:

| Submission | Surface | What it proves |
|---|---|---|
| **HomeOps for Alexa+** (Amazon Developer Hackathon) | Streamable-HTTP **MCP server** + conversational web simulator with cards and confirmations | real tool-use, cross-session context, task completion |
| **HomeOps Agent — Open Infrastructure for Household Operations** (Nebius × NVIDIA) | NVIDIA **Nemotron** model on **Nebius Token Factory**, **Tavily** runtime research, agent trace console | open-infrastructure reasoning, structured output, source transparency |

> The MVP demonstrates exactly one scenario: **a boiler problem before an important weekend**. It is a vertical slice, not a general smart-home assistant.

## Architecture

```text
apps/web (Next.js simulator + trace console)
      |  REST
apps/api (Hono)  ──────────────►  packages/mcp-server  (/mcp, Streamable HTTP)
      |                                     |
      └──────────►  packages/agent-core  ◄───┘
                    (orchestration, deterministic safety, ports)
                          |            |
             packages/adapters-nebius   packages/adapters-tavily
                          |            |
                    packages/persistence (SQLite + Drizzle)
```

Design rules:

1. `agent-core` never imports an external SDK — it depends on `@homeops/contracts` and Node built-ins only.
2. REST and MCP are two surfaces over **one service layer** (`HomeOpsService`).
3. Safety triage is deterministic. A language model can never downgrade an emergency identified by the rules.
4. No silent actions: every state-changing call requires `confirm: true`.
5. No secrets in logs, traces or fixtures.

## Measured on 2026-10-07 (live services, not estimates)

| Step | Result |
|---|---|
| Nebius `GET /models` | 18 models, 4 NVIDIA (Nemotron 3 family) |
| `nvidia/Nemotron-3_5-Lightning` plan draft | ~4–8 s, valid `PlanDraft` |
| `nvidia/nemotron-3-super-120b-a12b` plan draft | 6–68 s depending on reasoning length (kept as an option) |
| Tavily runtime search | ~1.4–2.1 s, 3–5 sources with URLs |
| End-to-end `pnpm demo:plan` | ~14 s, `degraded: false`, plan + sources + trace |
| `pnpm mcp:smoke` | 401 without token, six tools discovered, confirmation semantics verified |
| `pnpm check:live` (real browser) | plan card in 13-22 s, 7 sources (official register + manufacturer guides), no page errors |
| `pnpm test:e2e` | 6 browser flows in ~6 s: boiler scenario, assignment confirmation, resume, gas emergency, clarifying round, no-leak check |

### Research quality policy

A single broad web query returns trade directories and pages about the wrong Bristol. HomeOps AI therefore
runs **two targeted queries in parallel with the model call** and merges them:

1. an official register query (`gassaferegister.co.uk` for boilers, `watersafe.org.uk` for plumbing, `electricalsafetyfirst.org.uk` for electrics) capped at two results;
2. a symptom-based guidance query (`boiler making a noise what to do UK`) with forums, video and social domains excluded.

The issue type comes from the fast model, with a deterministic keyword fallback so research never degrades
because one model call failed. Results are deduplicated on host + path and the list is kept short on purpose.

Design notes that came out of these measurements live in [docs/nebius-integration.md](docs/nebius-integration.md).

## Quick start

```bash
cp .env.example .env      # then paste NEBIUS_API_KEY and TAVILY_API_KEY
pnpm install
pnpm db:migrate && pnpm db:seed
pnpm dev                  # api on :8787, web on :3000
```

Without API keys the app runs with an explicit fake provider (`MODEL_PROVIDER=fake`, `SEARCH_PROVIDER=fake`), so tests and CI never need credentials.

```bash
pnpm lint && pnpm typecheck && pnpm test   # quality gates (unit + contract)
pnpm test:e2e                              # Playwright: browser flows against the fake providers
pnpm probe:nebius                          # real call: model id, latency, token usage
pnpm probe:tavily                          # real call: sources with URLs
pnpm demo:plan                             # end-to-end plan from the CLI
pnpm mcp:smoke                             # MCP tool discovery + tool call
pnpm check:live                            # real browser + real Nebius/Tavily, asserts the demo promises
```

`pnpm test:e2e` starts its own API (:8788) and web (:3100) servers with deterministic fake providers and
a separate Next build directory, so it can run next to a normal `pnpm dev` session.

## MCP tools (Alexa+ surface)

| Tool | Purpose | Confirmation |
|---|---|---|
| `build_repair_plan` | turn an intake into a validated `RepairPlan` | no |
| `get_safety_guidance` | deterministic safety triage | no |
| `search_service_options` | runtime research through Tavily | no |
| `assign_household_task` | assign a plan action to a household member | **yes** |
| `get_plan_status` | current plan and open actions | no |
| `update_action_status` | mark an action open/assigned/done | **yes** |

## Safety and privacy

- Deterministic rules handle gas, smoke/burning, water near electricity, carbon monoxide, vulnerable occupants and loss of heat/hot water; emergency copy is never model-generated.
- Demo data is synthetic (a fictional household). No real addresses, phone numbers or personal data.
- Research results always keep their source URL and retrieval time; prices and availability are never invented.
- This project is a coordinator, not a professional diagnostic or contracting service.

## Documentation

| Document | Content |
|---|---|
| [docs/architecture.md](docs/architecture.md) | layering, request flow, surfaces, persistence |
| [docs/safety-boundaries.md](docs/safety-boundaries.md) | deterministic triage rules and product limits |
| [docs/nebius-integration.md](docs/nebius-integration.md) | endpoint, models, probe results, model quirks |
| [docs/mcp.md](docs/mcp.md) | MCP tools, auth, sessions, how to verify |

## License

MIT — see [LICENSE](./LICENSE).
