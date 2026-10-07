# MCP server

The MCP surface exposes **household operations**, not CRUD. Transport: **Streamable HTTP**, mounted at `/mcp`
on the same Node process as the REST API.

## Tools

| Tool | What it does | External effect | Confirmation |
|---|---|---|---|
| `build_repair_plan` | turns an intake into a validated `RepairPlan` | none | no |
| `get_safety_guidance` | deterministic triage of a reported situation | none | no |
| `search_service_options` | runtime research through Tavily, with sources | read only | no |
| `assign_household_task` | assigns one plan action to a household member | local record | **yes** |
| `get_plan_status` | returns the stored plan and its open actions | none | no |
| `update_action_status` | marks an action open/assigned/done | local record | **yes** |

Input and output schemas live in `packages/contracts/src/mcp.ts` and are shared with the runtime validation, so
tool discovery and tool calls can never disagree.

## Authentication

```http
POST /mcp
Authorization: Bearer <MCP_AUTH_TOKEN>
```

The token comes from the environment (`.env`); the endpoint answers `401` with a problem+json document when it
is missing or wrong. The server is not meant to be exposed publicly without it.

## Sessions and client compatibility

Stateful Streamable HTTP sessions are used (the server issues `mcp-session-id`, and `GET`/`DELETE` operate on
that session). Context that must survive a session lives in the database, not in the MCP session, so a new
conversation can resume the same plan.

## Verifying it

```bash
pnpm dev            # starts the API on :8787 with /mcp
pnpm mcp:smoke      # in-process: auth check, discovery, tool calls, confirmation semantics
```

`pnpm mcp:smoke` asserts:

1. an unauthenticated `POST /mcp` returns `401`;
2. exactly six tools are discovered;
3. `build_repair_plan` returns a plan with the expected urgency;
4. `assign_household_task` without `confirm` returns `confirmation_required` plus the proposed change;
5. with `confirm: true` the assignment is applied and `get_plan_status` shows the update.

For manual exploration with the official inspector:

```bash
npx @modelcontextprotocol/inspector
# transport: Streamable HTTP, url: http://localhost:8787/mcp, header: Authorization: Bearer <token>
```

