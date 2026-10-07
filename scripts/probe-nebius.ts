import { createNebiusChatClient, DEFAULT_FAST_MODEL, DEFAULT_NEBIUS_BASE_URL, DEFAULT_PLAN_MODEL } from "@homeops/adapters-nebius";
import { extractJsonObject } from "@homeops/agent-core";
import { PlanDraftSchema } from "@homeops/contracts";
import { fingerprint, heading, requireKey } from "./lib/env";

const apiKey = requireKey("NEBIUS_API_KEY");
const baseUrl = (process.env.NEBIUS_BASE_URL ?? DEFAULT_NEBIUS_BASE_URL).replace(/\/$/, "");
const planModel = process.env.NEBIUS_MODEL_PLAN ?? DEFAULT_PLAN_MODEL;
const fastModel = process.env.NEBIUS_MODEL_FAST ?? DEFAULT_FAST_MODEL;

console.log(`Nebius Token Factory probe\n  base url   : ${baseUrl}\n  key        : ${fingerprint(apiKey)}\n  plan model : ${planModel}\n  fast model : ${fastModel}`);

heading("1. Catalog (GET /models)");
try {
  const response = await fetch(`${baseUrl}/models`, { headers: { authorization: `Bearer ${apiKey}` } });
  if (!response.ok) {
    console.log(`  /models returned HTTP ${response.status} — catalog lookup skipped, chat completion is the real test.`);
  } else {
    const payload = (await response.json()) as { data?: Array<{ id?: string }> };
    const ids = (payload.data ?? []).map((model) => model.id ?? "").filter(Boolean);
    const nvidia = ids.filter((id) => /nemotron|nvidia/i.test(id));
    console.log(`  ${ids.length} model(s) visible, ${nvidia.length} NVIDIA:`);
    for (const id of nvidia.slice(0, 12)) console.log(`    - ${id}`);
    for (const wanted of [planModel, fastModel]) {
      console.log(`  configured model "${wanted}": ${ids.includes(wanted) ? "present" : "NOT in catalog (still attempting a call)"}`);
    }
  }
} catch (error) {
  console.log(`  catalog request failed: ${error instanceof Error ? error.message : String(error)}`);
}

heading("2. Structured JSON completion");
const client = createNebiusChatClient({ apiKey, baseUrl });
const prompt = [
  "Household report: the boiler is making a loud humming noise and guests arrive on Saturday; there is no smell of gas and hot water still works.",
  "",
  'Return JSON only: {"issueSummary": string, "urgency": "emergency"|"urgent"|"needs_attention"|"monitor", "clarifyingQuestions": string[], "actions": [{"title": string, "rationale": string, "ownerLabel": string, "dueAt": null, "requiresConfirmation": boolean}]}'
].join("\n");

let jsonModeSupported = true;
const started = Date.now();
let text = "";
let usage: { inputTokens: number; outputTokens: number } | null = null;

try {
  const response = await client.complete({
    model: planModel,
    system: "You are a household operations planner. Reply with a JSON object only.",
    user: prompt,
    temperature: 0.2,
    maxOutputTokens: 900,
    jsonMode: true,
    timeoutMs: 60_000
  });
  text = response.text;
  usage = response.usage;
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.log(`  response_format=json_object rejected or failed: ${message.slice(0, 160)}`);
  console.log("  retrying with prompt-only JSON…");
  jsonModeSupported = false;
  const response = await client.complete({
    model: planModel,
    system: "You are a household operations planner. Reply with a JSON object only, no prose and no markdown fences.",
    user: prompt,
    temperature: 0.2,
    maxOutputTokens: 900,
    jsonMode: false,
    timeoutMs: 60_000
  });
  text = response.text;
  usage = response.usage;
}

const latencyMs = Date.now() - started;
console.log(`  model            : ${planModel}`);
console.log(`  latency          : ${latencyMs} ms`);
console.log(`  tokens           : ${usage ? `in ${usage.inputTokens} / out ${usage.outputTokens}` : "not reported"}`);
console.log(`  json_object mode : ${jsonModeSupported ? "accepted (use it)" : "not supported (prompt-only JSON + validation)"}`);

heading("3. Schema validation of the model draft");
const parsed = PlanDraftSchema.safeParse(extractJsonObject(text));
if (!parsed.success) {
  console.error("  INVALID draft:");
  for (const issue of parsed.error.issues) console.error(`    - ${issue.path.join(".") || "draft"}: ${issue.message}`);
  process.exit(1);
}
console.log(`  valid PlanDraft: urgency=${parsed.data.urgency}, actions=${parsed.data.actions.length}`);
console.log(`  summary: ${parsed.data.issueSummary}`);
console.log("\nPROBE OK — record the json_object result in docs/nebius-integration.md before wiring the adapter.");
