import type { PlanModelInput } from "../ports";

/** Shape the model must return. Kept in the prompt so a plain-text model can comply without tool schemas. */
const PLAN_DRAFT_SHAPE = `{
  "issueSummary": string,                       // one sentence, no diagnosis
  "urgency": "emergency" | "urgent" | "needs_attention" | "monitor",
  "clarifyingQuestions": string[],              // empty unless something essential is missing (max 2)
  "actions": [                                  // 1 to 5 concrete actions
    {
      "title": string,                          // imperative, short
      "rationale": string,                      // why this action, in plain English
      "ownerLabel": string,                     // household member name or role
      "dueAt": string | null,                   // ISO 8601 date-time or null
      "requiresConfirmation": boolean           // true for anything that contacts a third party
    }
  ]
}`;

export const PLAN_SYSTEM_PROMPT = `You are the planning engine of HomeOps AI, a household operations coordinator.

Rules:
- You coordinate; you do not diagnose gas, electrical or structural problems, and you never invent prices, guarantees or availability.
- Safety triage is handled by the application. You may raise urgency, but never argue a situation is safer than the application says.
- Prefer concrete, reversible actions that a family can complete today.
- Anything that contacts a third party (calling, booking, emailing, paying) must have requiresConfirmation = true.
- Reply with a single JSON object and nothing else. No markdown, no commentary.`;

export function buildPlanUserPrompt(input: PlanModelInput): string {
  const memberList =
    input.household?.members.map((member) => `${member.displayName} (${member.role}, prefers ${member.prefersContact})`).join("; ") ?? "unknown";

  return [
    `Current time: ${input.today}`,
    `Household: ${input.household ? `${input.household.name}, ${input.household.city}` : "unknown"}`,
    `Household members: ${memberList}`,
    `Reported issue: ${input.intake.description}`,
    `Deadline: ${input.intake.deadline ?? "none stated"}`,
    `Other context: ${input.intake.occupancyNotes ?? "none"}`,
    `Additional answers: ${input.intake.clarificationAnswers.length ? input.intake.clarificationAnswers.join(" | ") : "none"}`,
    `Application safety triage: urgency=${input.safety.urgency}, flags=${input.safety.flags.join(", ") || "none"}, rules=${input.safety.ruleIds.join(", ") || "none"}`,
    input.safety.mandatoryGuidance.length ? `Mandatory guidance that must appear in the plan: ${input.safety.mandatoryGuidance.join(" | ")}` : "",
    "",
    "Return JSON with exactly this shape:",
    PLAN_DRAFT_SHAPE
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
Never ask for personal data. Reply with a single JSON object and nothing else.`;

export function buildClassifyUserPrompt(input: PlanModelInput): string {
  return [
    `Reported issue: ${input.intake.description}`,
    `Deadline: ${input.intake.deadline ?? "none stated"}`,
    `Other context: ${input.intake.occupancyNotes ?? "none"}`,
    "",
    'Return JSON: { "issueType": "boiler" | "heating" | "plumbing" | "electrical" | "appliance" | "other", "needsClarification": boolean, "questions": string[] }'
  ].join("\n");
}

const CODE_FENCE = "\u0060\u0060\u0060";

/** Models sometimes wrap JSON in prose or code fences; take the first object that parses. */
export function extractJsonObject(raw: string): unknown {
  let cleaned = raw.trim();
  if (cleaned.startsWith(CODE_FENCE)) cleaned = cleaned.slice(CODE_FENCE.length).replace(/^json/i, "").trim();
  if (cleaned.endsWith(CODE_FENCE)) cleaned = cleaned.slice(0, -CODE_FENCE.length).trim();
  const trimmed = cleaned;
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("Model response did not contain a JSON object.");
    }
    return JSON.parse(trimmed.slice(start, end + 1));
  }
}
