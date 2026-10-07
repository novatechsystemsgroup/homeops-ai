# Demo recording sheet (under 3:00, English UK)

Everything below exists and is live at **https://homeops.novatechsystem.co.uk** — this sheet is the click-by-click
order to record it. Two recordings come from the same product with a different emphasis.

## Before you hit record

1. **Reset the demo state** so the video starts clean and the upkeep panel shows an overdue task:
   ```bash
   SITE=https://homeops.novatechsystem.co.uk
   HH=0f5c9a52-4a1e-4c1b-9a53-2f8f6d1a7b31
   curl -sS -X DELETE "$SITE/api/households/$HH" > /dev/null   # deletes plans and attachments
   curl -sS "$SITE/api/households/demo" > /dev/null            # reseeds household and upkeep
   ```
2. **Open the console once** and run one scenario so the page is warm, then press **New conversation**.
   The live model takes 10-18 s per plan; the deterministic triage appears in ~0.15 s.
3. **Browser**: Chrome or Edge (voice input needs it), zoom 110%, window 1440x900 or larger, bookmarks bar hidden.
4. **Have these two terminal commands ready** (they print no secrets):
   - `pnpm mcp:smoke` — 401 without a token, tool discovery with one, a plan, a confirmation requirement.
   - `pnpm probe:nebius` — model catalogue, latency and token usage for the NVIDIA model.
5. Never show `.env`, the Coolify dashboard, or any terminal that prints a key.

## Amazon Alexa+ — "HomeOps for Alexa+" (2:55)

| Time | Shot | Exact actions on screen |
|---|---|---|
| 0:00-0:15 | **The result first** | Landing page. Click **Talk to the agent**. Voice-over: "A sentence about the house becomes a plan someone can finish." |
| 0:15-0:40 | **The conversation** | Press **Speak** and say the boiler sentence (or click **Boiler making noise**). The **Safety triage** banner appears immediately; the plan card follows. Voice-over: "Triage is instant and deterministic; the plan takes about fifteen seconds." |
| 0:40-1:05 | **The plan** | Scroll the plan card: urgency badge, actions with owner and deadline, "needs confirmation", **Sources**. Voice-over: "Every action has an owner, a deadline and a cited source." |
| 1:05-1:25 | **Nothing silent** | Choose a member in **Assign to…**, then **Confirm** in the dialog. Point at "Nothing external happens…". |
| 1:25-1:45 | **Proof of work** | On the first action press **📷 Photo**, attach a picture, then type a line in the note field and press **Save note**. Voice-over: "Photos and voice notes attach to the action; image location data is stripped." |
| 1:45-2:05 | **It remembers the house** | Press **What needs doing at home?** The agent answers from the upkeep list and reads it out. Then **Mark done** on the overdue task and **Confirm**: next due moves forward. |
| 2:05-2:25 | **Safety beats the model** | Click **Smell of gas**. The red banner shows 0800 111 999, research is skipped. Voice-over: "For gas, the model is not asked." |
| 2:25-2:45 | **The same agent over MCP** | Terminal: `pnpm mcp:smoke`. Show 401 without a token, **eight tools**, then the confirmation requirement. Voice-over: "Alexa+ clients get the same engine through MCP." |
| 2:45-2:55 | **Close** | Plan page in a new tab. Voice-over: "Synthetic household, MIT licence, confirmations everywhere, no silent actions." |

## Nebius x NVIDIA — "HomeOps Agent on open infrastructure" (2:55)

| Time | Shot | Exact actions on screen |
|---|---|---|
| 0:00-0:15 | **Problem to plan** | Landing page, click **Leak under the sink**. Voice-over: "One sentence, one executable plan." |
| 0:15-0:55 | **The trace** | Open **Agent trace**. Walk the steps: intake, safety rules, model request and response with model time, Tavily research, persistence, confirmation. Point at total model time versus total research time. |
| 0:55-1:25 | **The model** | Terminal: `pnpm probe:nebius` — 18-model catalogue with the NVIDIA models, `response_format: json_object` accepted, latency and token usage, draft validated against the schema. |
| 1:25-1:50 | **Runtime research** | Terminal: `pnpm probe:tavily`, then back to the card: the same sources with URLs and retrieval times. Mention the per-trade register: Gas Safe for boilers, WaterSafe for plumbing, Electrical Safety First for electrics. |
| 1:50-2:10 | **Deterministic control** | Confirmation dialog, the `confirmation.required` trace line, then **Socket sparked**: emergency in ~0.3 s with the model skipped. |
| 2:10-2:35 | **Beyond the demo** | **Home upkeep** panel: cadence, overdue task, mark done, next due moves. Then a photo attached as evidence. Voice-over: "Recurring upkeep and repair evidence, on the same engine." |
| 2:35-2:55 | **Open infrastructure** | Close on the README: NVIDIA open model on Nebius Token Factory, Tavily sources, SQLite on a volume, MIT, one command to reproduce. |

## Facts you can state on camera (all measured)

| Claim | Number |
|---|---|
| Deterministic triage on screen | ~0.15 s |
| Full model-written plan | 10-18 s (worst measured: 20 s) |
| Emergency path with the model skipped | 30-360 ms |
| Sources per researched plan | up to 7, each with URL and retrieval time |
| MCP tools exposed | 8 |
| Plan cost | about 2-4 pence (model tokens plus two Tavily searches) |

## Acceptance criteria and how they are checked

| Criterion | How it is verified |
|---|---|
| First visual result under 15 s | Triage banner renders in ~0.15 s; E2E asserts it, `pnpm check:live` measures it against the public site. |
| A user can finish the scenario alone in under 90 s | The landing page lists the steps; every next action in the console is a button. |
| No prompt, key or chain-of-thought on screen | E2E scans the rendered HTML for key patterns and for the system prompt text. |
| Confirmations and safety limits are visible | The plan card always renders the safety banner and the confirmation block. |
