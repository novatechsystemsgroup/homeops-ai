# Product feedback — Nebius Token Factory and NVIDIA Nemotron

Submitted with the HomeOps AI project (Nebius x NVIDIA hackathon). Everything below comes from building and
running the product, not from reading the docs: the numbers are measurements taken while the live demo was
running at https://homeops.novatechsystem.co.uk.

## What we built on the platform

One planning pipeline: a household sentence goes in, a structured repair plan comes out. The model is called
twice per fresh report:

1. **Classification** — `nvidia/Nemotron-3_5-Lightning`, JSON mode, 2,000 output tokens, deciding the problem
   domain and whether one round of clarification is needed.
2. **Planning** — the same model, JSON mode, 4,000 output tokens, producing a draft that is validated with Zod
   before it is allowed anywhere near the user.

Research runs in parallel with the model (Tavily, two queries), so the user waits for the slower branch instead
of the sum. If both model attempts fail or the draft is invalid, a deterministic fallback plan is used and the
plan is marked `degraded: true` in the UI and the trace.

**Measured on the live deployment**

| What | Number |
|---|---|
| Plan draft, Nemotron-3.5-Lightning | 4-8 s, valid JSON draft |
| Same prompt, nemotron-3-super-120b-a12b | 6-68 s depending on reasoning length (kept as a documented option, not the default) |
| End-to-end plan with research | 10-18 s typical, 20 s worst observed |
| Emergency path (model skipped by design) | 30-360 ms |
| Token spend per plan | about 1.5k in, 2.5k out |
| Model call cost per plan | a few pence, including two Tavily searches |

## What worked well

- **OpenAI-compatible endpoint.** Swapping `baseURL` and the API key was the whole integration. We kept the
  standard `openai` SDK, which meant retries, timeouts and error shapes behaved the way the code already
  expected. No provider-specific client, no wrapper library to maintain.
- **`response_format: {"type": "json_object"}` is accepted** by the Lightning model and we rely on it. We
  validate every draft against a schema and clamp the result (maximum five actions, two questions) before it
  reaches the UI.
- **A real catalogue with a usable fast model.** Eighteen models including four NVIDIA Nemotron variants. Having
  a fast model that is good enough for a *structured* task was the single most important thing for the demo:
  the perceived quality of an agent is dominated by latency, and Lightning keeps a full plan inside the time a
  person will wait for an answer.
- **Usage and finish reason come back normally**, which let us log token counts per step in the trace without
  guesswork.
- **Stability.** In every call we made during development we did not see a server error or a connection reset;
  the only failures were timeouts we had configured ourselves, and one deployment-side disk problem of our own
  making.

## Where we lost time (honest friction)

1. **JSON mode is not a guarantee.** We saw drafts arrive wrapped in prose or Markdown fences, or with a
   trailing comma, often enough during development that we built a repair layer for it, even with
   `json_object` requested. The SDK raises a parse error, which is correct,
   but it means every consumer writes the same repair layer. We ended up with a balanced-brace extractor plus a
   trailing-comma repair, and a retry that re-prompts with the parse error. A strict "the response body is
   exactly one JSON object" mode (or a documented error code for malformed JSON) would remove this work
   entirely. This is the single change that would have saved us the most time.
2. **Latency guidance is missing for the bigger models.** We documented our own numbers because we could not
   find published p50/p95 per model. With `super-120b` at up to 68 s, the default SDK timeout is far too short,
   and choosing a default model without latency data is guesswork. A published latency table (even a rough one)
   would change how people pick a model more than any benchmark score.
3. **Output token limits are not obvious.** We cap plans at 4,000 output tokens and classification at 2,000
   because we inferred the limits from failures. Long model outputs that hit the cap come back truncated, which
   surfaces as invalid JSON — an easy trap. Documented `max_tokens` per model would fix it.
4. **No speech models in the catalogue.** We wanted voice input and spoken output to work in every browser. The
   catalogue has no speech-to-text or text-to-speech model, so we had to build voice on the browser Web Speech
   API (which Firefox does not implement) plus MediaRecorder for voice notes. A Whisper-class transcription
   model on Token Factory would have made the voice path uniform and server-side. This was the biggest gap
   between what the platform offers and what a household agent needs.
5. **Concurrency and rate limits are not stated** where a new user will find them. Our demo is a single
   household so we never hit a limit, but we could not say with confidence what happens at 50 concurrent
   planning requests.

## Feature requests, in priority order

1. Strict structured output (schema-constrained decoding, or at minimum a documented "invalid JSON" signal).
2. A latency and max-output-token table per model on the model page.
3. Speech-to-text (and ideally TTS) in the catalogue.
4. A documented rate limit and concurrency model per plan/project.
5. First-class tool/function calling, so a plan can be produced as tool arguments instead of free-text JSON.

## What we would tell another team starting today

Use the fast model for anything structured and validate it with your own schema; keep a deterministic fallback
for the case where the model is slow or wrong; and run your independent work (search, lookups) in parallel with
the model call, because the model dominates the clock. The platform itself was the least troublesome part of
this project — the friction was in the edges around JSON, latency and voice.

## Data and privacy note

The demo household is synthetic. No personal data is sent to the model: prompts contain the reported problem,
the household composition in generic terms, and the safety flags produced by our deterministic rules. Images
attached as repair evidence are stripped of EXIF/XMP/IPTC metadata (including GPS) before storage and are never
sent to the model.
