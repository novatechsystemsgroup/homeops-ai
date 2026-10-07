# Demo script (2:30, English UK)

Target: **show the product working in the first 15 seconds**, then prove the agent behaviour. Each hackathon
gets its own recording of the same product with a different emphasis.

## Amazon Alexa+ — "HomeOps for Alexa+"

| Time | Shot | What is on screen |
|---|---|---|
| 0:00-0:12 | The result first | Landing page, click **Boiler before the weekend**. The plan card appears: urgency, actions, owners, sources. Voice-over states problem and outcome in one sentence. |
| 0:12-0:35 | The conversation | The console: the spoken report, then the agent's reply. Optionally dictate with the **Voice** button. |
| 0:35-1:00 | The plan | Scroll the plan card: actions with rationale, the owner select, the "Waiting for your confirmation" box. Assign an action, confirmation dialog, **Confirm**. |
| 1:00-1:20 | Safety, not vibes | Click **Gas emergency**. The deterministic banner shows 0800 111 999 and the plan marks research as skipped. "The model is not allowed to decide this." |
| 1:20-1:45 | MCP, demonstrated | Terminal: `pnpm mcp:smoke` - 401 without a token, six tools discovered, `build_repair_plan` called, `assign_household_task` returning `confirmation_required`. |
| 1:45-2:10 | Context that survives | Open the plan page in a new tab: the stored plan and its open actions. "Alexa, did we fix the boiler?" answered from the stored plan. |
| 2:10-2:30 | Close | One line on the household problem, one on the MCP surface, one on privacy: synthetic data, confirmations, no silent actions. |

## Nebius x NVIDIA — "HomeOps Agent: open infrastructure"

| Time | Shot | What is on screen |
|---|---|---|
| 0:00-0:12 | Problem to plan | Same landing page, same boiler scenario: a report becomes an executable plan. |
| 0:12-0:50 | The trace | Agent console: phases 1-5, per-step status, model time, research time, failed steps. Point at `model.plan.requested` then `model.plan.received`. |
| 0:50-1:20 | The model | Terminal: `pnpm probe:nebius` - catalog with four NVIDIA models, `response_format: json_object` accepted, latency and token usage, validated `PlanDraft`. |
| 1:20-1:45 | Runtime research | Terminal: `pnpm probe:tavily` - real sources with URLs, then the same sources in the plan card with retrieval times. |
| 1:45-2:10 | Control | The confirmation dialog, the trace line `confirmation.required`, and the emergency path with the model skipped. |
| 2:10-2:30 | Open infrastructure | One line each: NVIDIA open model on Nebius Token Factory, cited sources, synthetic data, MIT licence, reproducible from the README. |

## Recording checklist

1. `cp .env.example .env` and paste the two keys, then `pnpm install && pnpm db:migrate && pnpm db:seed`.
2. `pnpm dev` starts the API on 8787 and the web app on 3000. Load both routes once before recording (Next compiles on first hit).
3. Run `pnpm demo:plan` once to warm the model: the live demo then lands around 10-15 seconds.
4. Zoom the browser to roughly 110% so the plan card text is readable at 1080p.
5. Keep `.env` out of frame, and never show a terminal that prints a key (`probe:nebius` prints only a length).
6. Record in one take if possible: the deterministic fallback keeps the demo alive if the model is slow.

## Timings the acceptance criteria are checked against

| Criterion | How it is verified |
|---|---|
| First visual result under 15 s | E2E asserts the plan card appears in under 15 s against the fake providers; with live Nebius the measured end-to-end is 10-15 s. |
| A user can complete the scenario alone in under 90 s | The landing page lists the five steps, and the console exposes every next action as a button. |
| No prompt, key or chain-of-thought on screen | E2E scans the rendered HTML for key patterns and for the system prompt text. |
| Confirmations and safety limits are visible | The plan card always renders the safety banner and the "Waiting for your confirmation" block. |

