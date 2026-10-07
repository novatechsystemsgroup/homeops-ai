# Nebius x NVIDIA integration

HomeOps AI uses **NVIDIA open models served by Nebius Token Factory** for the part of the pipeline that
actually needs reasoning: extracting constraints from a household report, drafting urgency, and producing the
ordered action list that becomes the RepairPlan.

## Endpoint and models

| Item | Value |
|---|---|
| API | Nebius Token Factory, OpenAI-compatible |
| Base URL | https://api.tokenfactory.us-central1.nebius.com/v1/ |
| Client | `openai` npm package with a baseURL override (`packages/adapters-nebius`) |
| Plan model (default) | `nvidia/Nemotron-3_5-Lightning` |
| Fast model (classification) | `nvidia/Nemotron-3_5-Lightning` |
| Reasoning alternative | `nvidia/nemotron-3-super-120b-a12b` (set `NEBIUS_MODEL_PLAN` and `MODEL_TIMEOUT_MS=180000`) |
| Third option | `nvidia/Nemotron-3-Ultra-550b-a55b` |

Verified against the live catalog on **2026-10-07** with `pnpm probe:nebius`: 18 models visible, 4 of them NVIDIA.

## Probe results (2026-10-07)

| Measurement | Value |
|---|---|
| `GET /models` | ok, both configured models present |
| `response_format: json_object` | **accepted** by the endpoint |
| Nemotron-3_5-Lightning plan draft | ~4-6 s, valid `PlanDraft` after schema validation |
| nemotron-3-super-120b-a12b plan draft | ~68 s, valid `PlanDraft` (too slow for a live demo, kept as an option) |
| Tavily runtime search | ~1.4-2.1 s, 3-5 sources with URLs |

## What the model is responsible for

1. **Classification** (`classify`): issue type plus at most two clarifying questions that genuinely change the plan.
2. **Plan draft** (`plan`): issueSummary, urgency, clarifyingQuestions, and 1-8 action drafts with rationale,
   owner label, optional deadline and a confirmation flag.

Everything the model returns is validated with Zod (`PlanDraftSchema`) before it can become a `RepairPlan`.
A rejected draft triggers exactly one repair retry with the validation error attached; a second failure falls
back to the deterministic plan and marks the response `degraded: true`.

## Model quirks we design around

Nemotron-3.5-Lightning answers with a visible "thinking process" preamble and then the JSON object. Two
consequences, both handled in code:

- `extractJsonObject` (`packages/agent-core/src/prompts/plan.ts`) scans for the first **balanced** JSON object
  instead of trusting the whole response. It tolerates code fences, trailing commas, a second object and braces
  inside strings.
- The plan call allows a generous output budget (2000+ tokens) so the object is not truncated mid-flight. A
  truncated object is reported as "unterminated JSON object" in the agent trace, which is how we found it.

## Safety boundary

The model never decides whether a situation is dangerous. `assessSafety()` runs first, its urgency is a
**floor** (a model can raise it, never lower it), and emergency responses are built from deterministic rules
without consulting the model at all. See [safety-boundaries.md](./safety-boundaries.md).

## Cost and timeout controls

- At most three model calls per plan (one classification, up to two plan attempts).
- `MODEL_TIMEOUT_MS` (default 60000) bounds each call; a timeout is treated like an invalid draft.
- Prompts are never logged at info level, and API keys never reach the trace or the UI.

