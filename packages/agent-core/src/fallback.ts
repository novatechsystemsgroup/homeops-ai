import type { PlanActionDraft, PlanDraft, IssueType, Urgency } from "@homeops/contracts";
import type { PlanModelInput } from "./ports";

function addHours(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() + hours * 3_600_000).toISOString();
}

function action(title: string, rationale: string, ownerLabel: string, dueAt: string | null, requiresConfirmation: boolean): PlanActionDraft {
  return { title, rationale, ownerLabel, dueAt, requiresConfirmation };
}

interface Trade {
  /** Who to call, in the words a household would use. */
  trade: string;
  /** Why that trade and not a general handyman. */
  why: string;
  /** The one safety action that belongs with this domain. */
  precaution: string;
}

const TRADES: Record<IssueType, Trade> = {
  boiler: {
    trade: "Gas Safe registered engineer",
    why: "Gas appliances must be worked on by a Gas Safe registered engineer; this is the fastest safe route to a fix.",
    precaution: "Do not open the boiler casing; only a Gas Safe registered engineer should work on a gas appliance."
  },
  heating: {
    trade: "heating engineer",
    why: "Heating faults need someone who can legally work on the system and test it properly.",
    precaution: "Keep one room warm with a safe temporary heater while the system is out of action."
  },
  plumbing: {
    trade: "plumber",
    why: "Water damage gets expensive quickly; a plumber can stop the source and check for hidden damage.",
    precaution: "Turn off the isolation valve or stopcock if water is escaping, and move anything valuable away from the area."
  },
  electrical: {
    trade: "registered electrician",
    why: "Electrical faults are a fire and shock risk and must be tested, not guessed at.",
    precaution: "Do not use the affected circuit; switch it off at the consumer unit only if that is safe to reach."
  },
  appliance: {
    trade: "appliance repairer",
    why: "Manufacturer-approved repairers can get the right parts and keep the warranty valid.",
    precaution: "Switch the appliance off at the socket and note the model number and any error code."
  },
  other: {
    trade: "qualified tradesperson",
    why: "Someone qualified needs to look at it in person before it gets worse.",
    precaution: "Keep the area clear and stop using anything that looks unsafe."
  }
};

/**
 * Deterministic plan used when the model is unavailable or returns an invalid draft,
 * and for emergencies. It is domain-aware: a plumbing report must not produce a
 * boiler checklist.
 */
export function buildFallbackPlanDraft(input: PlanModelInput): PlanDraft {
  const owner = input.household?.members.find((member) => member.role === "adult")?.displayName ?? "Household adult";
  const urgency: Urgency = input.safety.urgency;
  const trade = TRADES[input.issueType] ?? TRADES.other;
  const symptom = input.intake.description.trim().slice(0, 120);

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
          "A short record helps the emergency service or the engineer, and keeps everyone informed.",
          owner,
          addHours(input.today, 2),
          false
        )
      ]
    };
  }

  const actions: PlanActionDraft[] = [
    action(
      `Call a ${trade.trade} and request the earliest available visit`,
      trade.why,
      owner,
      addHours(input.today, 6),
      true
    ),
    action("Take the precaution that limits damage now", trade.precaution, owner, addHours(input.today, 1), false),
    action(
      "Write down what changed, when it started and anything you already tried",
      `A short record of "${symptom}" helps the engineer fix it on the first visit instead of the second.`,
      owner,
      addHours(input.today, 3),
      false
    )
  ];

  if (input.safety.flags.includes("vulnerable_occupant")) {
    actions.splice(1, 0, action(
      "Check on anyone vulnerable in the household",
      "Someone elderly, unwell or very young may need to move to a warm, safe room while this is unresolved.",
      owner,
      addHours(input.today, 1),
      false
    ));
  }

  return {
    issueSummary: `${input.issueType === "other" ? "Household problem" : firstLetterUpper(input.issueType)} reported at home — needs a qualified visit and a short action list.`,
    urgency,
    clarifyingQuestions: [],
    actions: actions.slice(0, 5)
  };
}

function firstLetterUpper(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
