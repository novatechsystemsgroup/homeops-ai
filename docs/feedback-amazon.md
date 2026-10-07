# Product feedback — MCP and the Alexa+ surface

Submitted with the HomeOps AI project (Amazon "Build, Ship, Shape"). HomeOps AI exposes one engine through a
Model Context Protocol server over Streamable HTTP at `https://homeops.novatechsystem.co.uk/mcp`, so an
Alexa+ style client can drive the same household agent as the web console.

## What we built on the surface

Eight tools, deliberately high level rather than thin CRUD:

| Tool | Kind | Why it exists |
|---|---|---|
| `build_repair_plan` | read | A report becomes a plan: urgency, actions with owners and deadlines, safety guidance, cited sources |
| `get_safety_guidance` | read | Deterministic triage alone, for a client that wants to react before planning |
| `search_service_options` | read | Runtime research: official registers and current public sources |
| `assign_household_task` | write, confirm | Assignment changes state, so it returns `confirmation_required` without `confirm: true` |
| `update_action_status` | write, confirm | Same contract for completing or reopening an action |
| `get_plan_status` | read | The stored plan plus its open actions, for "did we fix the boiler?" in a later session |
| `get_maintenance_due` | read | Recurring upkeep that is overdue or due soon |
| `complete_maintenance_task` | write, confirm | Records the completion and moves the next due date by its cadence |

Server: stateful Streamable HTTP sessions, bearer token auth, `2025-06-18` protocol version, JSON Schemas
published for inputs and outputs, and tool annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`)
set honestly so a client can decide what needs a confirmation.

## What worked well

- **The handshake is boring, in the best way.** `initialize` → session id header → `tools/list` → `tools/call`
  worked first time with the reference SDK client, and the same flow works with plain `curl` when you send
  `Accept: application/json, text/event-stream`. Debuggability matters for a voice product, and being able to
  reproduce a client call in one curl line saved hours.
- **Published output schemas are genuinely useful.** We describe each tool's output as a flat object with an
  explicit status, and clients get a JSON Schema for free. This pushed us to a better design: our first draft
  returned a union type, and flattening it (status plus optional payload) made the tool easier for a client to
  consume — and easier for us to document.
- **Annotations were worth filling in.** Marking reads as read-only and writes as non-idempotent is what lets a
  voice assistant decide what it may do without asking.
- **In-memory transport in the SDK** made it possible to test the whole server in-process, with no network, in
  our CI.

## Where we lost time (honest friction)

1. **No way to simulate the assistant side.** We could test our server with the SDK client and curl, but we
   could not see how an Alexa+ style client would actually call, combine or sequence our tools. Which tool
   shapes does it prefer? How many round trips will it make? Does it read `structuredContent` or the text
   content? An MCP server sandbox or a reference client for skill authors would remove most of the guesswork.
   We compensated by designing for one call per user intent.
2. **Confirmation has no first-class representation.** "This changes state, ask the user first" is central to a
   household agent — nobody wants a voice assistant booking a plumber on its own. MCP gave us no standard way
   to express it, so we invented one: the call returns successfully with `status: "confirmation_required"` and
   a `proposedChanges` list, and the caller must repeat the call with `confirm: true`. It works, our tests
   assert it, but every server invents its own variant. Elicitation in newer spec revisions is a step towards
   this; a documented pattern for "propose, then confirm" would make it portable across clients.
3. **Auth guidance for a public server is thin.** The spec leaves authentication to the implementer. We used a
   static bearer token, which is honest for a demo but not a model for production account linking. A worked
   example of OAuth 2.1 resource-server metadata (and what an Alexa skill expects during account linking) would
   have saved us the most security thinking.
4. **Latency budgets are invisible.** A plan takes 10-18 seconds because a real model is writing it. We could
   not find guidance on how long a tool call may take before a voice client gives up or speaks a filler, so we
   made every slow step observable in our own trace and gave the client a summary it can speak early. If the
   platform has a timeout budget for tool calls, publishing it would let servers design for it.
5. **There is no convention for speakable output.** A voice client needs one short sentence, not a plan object.
   We added a `spokenSummary` field to our read tools ("2 things to do: test the smoke alarms, overdue by 31
   days"). A documented convention — a "speech" field, or guidance on how much text is read aloud — would make
   MCP servers voice-ready by default.

## Feature requests, in priority order

1. A sandbox or reference client that emulates the assistant side of MCP, so servers can be tested the way they
   will really be called.
2. A standard confirmation/elicitation pattern for state-changing tools.
3. Published timeout and latency expectations for tool calls from a voice client.
4. A convention for short, speakable summaries in tool results.
5. A worked authentication example for public MCP servers (OAuth 2.1 resource server, account linking).

## What we would tell another team starting today

Design few, high-level tools — one per user intent, not one per database table. Return a flat object with an
explicit status. Never let a state change happen without an explicit `confirm`, and make the refusal useful by
returning the proposed change. Keep the request path inspectable with plain curl. Everything else is detail.

## Note on our own limits

The demo household is synthetic. The server never books, pays or messages anyone; every state-changing tool
requires `confirm: true`, and the console states that nothing leaves the app. Emergency guidance (gas, smoke,
water near electrics) is written by deterministic rules, not generated, and the model is skipped entirely for
those cases — a division of labour we would keep in any voice product.
