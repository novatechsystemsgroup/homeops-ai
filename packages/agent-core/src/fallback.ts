import type { PlanActionDraft, PlanDraft, Urgency } from "@homeops/contracts";
import type { PlanModelInput } from "./ports";

function addHours(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() + hours * 3_600_000).toISOString();
}

function action(title: string, rationale: string, ownerLabel: string, dueAt: string | null, requiresConfirmation: boolean): PlanActionDraft {
  return { title, rationale, ownerLabel, dueAt, requiresConfirmation };
}

/**
 * Deterministic plan used when the model is unavailable or returns an invalid
 * draft, and for emergencies where the rules own the response.
 */
export function buildFallbackPlanDraft(input: PlanModelInput): PlanDraft {
  const owner = input.household?.members.find((member) => member.role === "adult")?.displayName ?? "Household adult";
  const urgency: Urgency = input.safety.urgency;

  if (urgency === "emergency") {
    return {
      issueSummary: "Possible emergency reported at home — safety steps take priority over repairs.",
      urgency,
      clarifyingQuestions: [],
      actions: [
        action(
          "Follow the emergency guidance in this plan now",
          "The reported signs can be dangerous. The application's deterministic rules decide the safety response, not the assistant.",
          owner,
          addHours(input.today, 0),
          false
        ),
        action(
          "Get everyone out and call the emergency service if the danger is present",
          "People first, property second. Do not attempt repairs while the danger is present.",
          owner,
          addHours(input.today, 0),
          false
        ),
        action(
          "Record what happened and report back to the household",
          "A short record helps the engineer or the emergency service and keeps the household informed.",
          owner,
          addHours(input.today, 2),
          false
        )
      ]
    };
  }

  if (input.safety.flags.includes("no_heat_or_hot_water")) {
    return {
      issueSummary: "No heating or hot water at home — needs an engineer and a short-term plan.",
      urgency,
      clarifyingQuestions: [],
      actions: [
        action(
          "Book a Gas Safe registered engineer for a boiler inspection",
          "Gas appliances must be inspected by a registered engineer; this is the fastest safe route to a fix.",
          owner,
          addHours(input.today, 6),
          true
        ),
        action(
          "Keep one room warm with safe temporary heating",
          "Protects anyone vulnerable while the boiler is out of action.",
          owner,
          addHours(input.today, 1),
          false
        ),
        action(
          "Check in with everyone in the household this evening",
          "Tracks whether the situation is worsening and whether anyone needs to leave the property.",
          owner,
          addHours(input.today, 8),
          false
        )
      ]
    };
  }

  return {
    issueSummary: "Boiler noise reported before guests arrive — needs an inspection and a short action list.",
    urgency,
    clarifyingQuestions: [],
    actions: [
      action(
        "Book a boiler service visit for the earliest available slot",
        "A changing noise usually means the appliance needs attention before it fails at a worse moment.",
        owner,
        addHours(input.today, 8),
        true
      ),
      action(
        "Note when the noise happens and how the heating behaves",
        "Timing, temperature and frequency help the engineer diagnose faster on the first visit.",
        owner,
        addHours(input.today, 3),
        false
      ),
      action(
        "Tell the household what to watch for (leaks, loss of hot water, any smell of gas)",
        "Early warning signs change the plan from a service visit to an emergency call.",
        owner,
        addHours(input.today, 24),
        false
      )
    ]
  };
}
