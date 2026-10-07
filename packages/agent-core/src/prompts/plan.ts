import type { PlanModelInput } from "../ports";

/**
 * A concrete example beats a type skeleton: smaller models copy a type skeleton
 * verbatim instead of filling it in. The values below are illustrative only.
 */
const PLAN_DRAFT_EXAMPLE = `{
  "issueSummary": "One sentence about the reported problem.",
  "urgency": "needs_attention",
  "clarifyingQuestions": [],
  "actions": [
    {
      "title": "Call the qualified tradesperson this problem needs and book the earliest slot",
      "rationale": "Why this action, in plain English, for this specific problem.",
      "ownerLabel": "Alex",
      "dueAt": "2026-10-08T09:00:00.000Z",
      "requiresConfirmation": true
    },
    {
      "title": "Take the precaution that limits damage right now",
      "rationale": "The single most useful thing to do before anyone arrives.",
      "ownerLabel": "Priya",
      "dueAt": null,
      "requiresConfirmation": false
    }
  ]
}`;

export const PLAN_SYSTEM_PROMPT = `You are the planning engine of HomeOps AI, a household operations coordinator.

Rules:
- You coordinate; you do not diagnose gas, electrical or structural problems, and you never invent prices, guarantees or availability.
- Safety triage is handled by the application. You may raise urgency, but never argue a situation is safer than the application says.
- Prefer concrete, reversible actions that a family can complete today.
- Anything that contacts a third party (calling, booking, emailing, paying) must have requiresConfirmation = true.
- issueSummary is one short sentence (under 300 characters); each rationale is at most two sentences.
- Every plan must include at least one action that contacts the qualified trade for this problem type (Gas Safe engineer, plumber, electrician, appliance repairer, locksmith). Safety steps come first in an emergency.
- Reply with a single JSON object and nothing else. No markdown, no commentary, no preamble.`;

export function buildPlanUserPrompt(input: PlanModelInput): string {
  const memberList =
    input.household?.members.map((member) => `${member.displayName} (${member.role}, prefers ${member.prefersContact})`).join("; ") ?? "unknown";

  return [
    `Current time: ${input.today}`,
    `Household: ${input.household ? `${input.household.name}, ${input.household.city}` : "unknown"}`,
    `Household members: ${memberList}`,
    `Reported issue: ${input.intake.description}`,
    `Detected problem type: ${input.issueType} (stay in this domain; do not add checks that belong to another trade)`,
    `Deadline: ${input.intake.deadline ?? "none stated"}`,
    `Other context: ${input.intake.occupancyNotes ?? "none"}`,
    `Additional answers: ${input.intake.clarificationAnswers.length ? input.intake.clarificationAnswers.join(" | ") : "none"}`,
    `Application safety triage: urgency=${input.safety.urgency}, flags=${input.safety.flags.join(", ") || "none"}, rules=${input.safety.ruleIds.join(", ") || "none"}`,
    // The application renders the mandatory safety guidance itself, so the model is
    // told not to repeat it: it only adds noise (and used to be copied into issueSummary).
    "The application displays the mandatory safety guidance separately. Do not repeat it, do not quote it, and never copy it into issueSummary.",
    "",
    "Return one JSON object with your own values, in exactly this shape (this example is illustrative — never copy its wording):",
    PLAN_DRAFT_EXAMPLE,
    "",
    "Constraints: 1 to 5 actions, at most 2 clarifying questions (usually none), dueAt is an ISO 8601 date-time or null, and requiresConfirmation is true for anything that contacts a third party."
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildRepairPrompt(input: PlanModelInput, errors: string): string {
  return [
    buildPlanUserPrompt(input),
    "",
    "Your previous answer was rejected by schema validation with these errors:",
    errors,
    "Return a corrected JSON object only."
  ].join("\n");
}

export const CLASSIFY_SYSTEM_PROMPT = `You triage household maintenance reports for HomeOps AI.
Decide the issue type and whether one or two clarifying questions are genuinely needed before a plan can be built.
Ask only about things that change the plan: danger signs, loss of heat or hot water, access, deadline, who is at home.
Never ask for personal data. Reply with a single JSON object, no prose and no markdown.`;

export function buildClassifyUserPrompt(input: PlanModelInput): string {
  return [
    `Reported issue: ${input.intake.description}`,
    `Deadline: ${input.intake.deadline ?? "none stated"}`,
    `Other context: ${input.intake.occupancyNotes ?? "none"}`,
    "",
    "Return one JSON object with your own values, for example:",
    '{"issueType":"boiler","needsClarification":false,"questions":[]}',
    "issueType is one of: boiler, heating, plumbing, electrical, appliance, other."
  ].join("\n");
}

const CODE_FENCE = "\u0060\u0060\u0060";

/**
 * Models wrap JSON in prose, code fences or a second object, and some emit a
 * trailing comma. Take the first *balanced* object and repair the small stuff,
 * instead of trusting the whole response to be JSON.
 */
export function extractJsonObject(raw: string): unknown {
  let text = raw.trim();
  if (text.startsWith(CODE_FENCE)) text = text.slice(CODE_FENCE.length).replace(/^json/i, "").trim();
  if (text.endsWith(CODE_FENCE)) text = text.slice(0, -CODE_FENCE.length).trim();

  const direct = parse(text);
  if (direct.ok) return direct.value;

  const start = text.indexOf("{");
  if (start === -1) throw new Error("Model response did not contain a JSON object.");
  const end = findBalancedEnd(text, start);
  if (end === -1) throw new Error("Model response contained an unterminated JSON object.");

  const candidate = text.slice(start, end + 1).replace(/,\s*([}\]])/g, "$1");
  const parsed = parse(candidate);
  if (parsed.ok) return parsed.value;
  throw new Error(`Model response contained invalid JSON: ${parsed.error}`);
}

function parse(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Scans from an opening brace to its matching close, ignoring braces inside strings. */
function findBalancedEnd(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "{") depth += 1;
    else if (character === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}
