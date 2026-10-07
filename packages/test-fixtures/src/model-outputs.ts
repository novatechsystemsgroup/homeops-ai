import type { Classification, PlanDraft } from "@homeops/contracts";

export const BOILER_DRAFT: PlanDraft = {
  issueSummary: "Boiler humming noise before weekend guests arrive; needs an inspection and a short action list.",
  urgency: "needs_attention",
  clarifyingQuestions: [],
  actions: [
    {
      title: "Book a boiler service visit for the earliest available slot",
      rationale: "A humming boiler usually needs a service or a small part replacement before it fails.",
      ownerLabel: "Alex",
      dueAt: null,
      requiresConfirmation: true
    },
    {
      title: "Note when the noise happens and whether the heating still works",
      rationale: "Timing and behaviour help the engineer fix it on the first visit.",
      ownerLabel: "Priya",
      dueAt: null,
      requiresConfirmation: false
    },
    {
      title: "Tell everyone what to watch for before Saturday",
      rationale: "A leak, loss of hot water or any smell of gas changes this plan into an emergency call.",
      ownerLabel: "Alex",
      dueAt: null,
      requiresConfirmation: false
    }
  ]
};

export const HEAT_LOSS_DRAFT: PlanDraft = {
  issueSummary: "No heating or hot water; needs an engineer today and a short-term warm-room plan.",
  urgency: "urgent",
  clarifyingQuestions: [],
  actions: [
    {
      title: "Call a Gas Safe registered engineer and request a same-day visit",
      rationale: "Loss of heat and hot water needs a qualified engineer quickly.",
      ownerLabel: "Alex",
      dueAt: null,
      requiresConfirmation: true
    },
    {
      title: "Keep one room warm for anyone vulnerable",
      rationale: "Reduces health risk while the boiler is out of action.",
      ownerLabel: "Priya",
      dueAt: null,
      requiresConfirmation: false
    }
  ]
};

export const PLUMBING_DRAFT: PlanDraft = {
  issueSummary: "Water is escaping under the kitchen sink; needs a plumber and quick containment.",
  urgency: "needs_attention",
  clarifyingQuestions: [],
  actions: [
    {
      title: "Call a plumber and describe the leak under the sink",
      rationale: "Water damage spreads quickly; a plumber can stop the source and check for hidden damage.",
      ownerLabel: "Alex",
      dueAt: null,
      requiresConfirmation: true
    },
    {
      title: "Turn off the isolation valve and empty the cupboard",
      rationale: "Limits the damage while you wait for the visit.",
      ownerLabel: "Priya",
      dueAt: null,
      requiresConfirmation: false
    }
  ]
};

export const ELECTRICAL_DRAFT: PlanDraft = {
  issueSummary: "Socket sparked with a burnt smell; the circuit needs a registered electrician.",
  urgency: "urgent",
  clarifyingQuestions: [],
  actions: [
    {
      title: "Call a registered electrician and stop using that circuit",
      rationale: "Sparking and a burnt smell point to a fault that must be tested, not guessed at.",
      ownerLabel: "Alex",
      dueAt: null,
      requiresConfirmation: true
    },
    {
      title: "Switch the circuit off at the consumer unit if it is safe to reach",
      rationale: "Removes the fire risk while you wait.",
      ownerLabel: "Priya",
      dueAt: null,
      requiresConfirmation: false
    }
  ]
};

export const APPLIANCE_DRAFT: PlanDraft = {
  issueSummary: "Washing machine will not drain; needs a repair visit and a way to empty it safely.",
  urgency: "monitor",
  clarifyingQuestions: [],
  actions: [
    {
      title: "Book an appliance repairer and quote the model and error light",
      rationale: "Manufacturer-approved repairers get the right parts first time.",
      ownerLabel: "Priya",
      dueAt: null,
      requiresConfirmation: true
    },
    {
      title: "Switch it off at the socket and drain the drum into a bucket",
      rationale: "Stops the water sitting in the machine and any further damage.",
      ownerLabel: "Alex",
      dueAt: null,
      requiresConfirmation: false
    }
  ]
};

export const BOILER_CLASSIFICATION: Classification = {
  issueType: "boiler",
  needsClarification: false,
  questions: []
};

/** Used when the report is vague, so the clarifying round is demonstrable without a live model. */
export const VAGUE_CLASSIFICATION: Classification = {
  issueType: "other",
  needsClarification: true,
  questions: ["Is there any smell of gas, smoke or a visible leak?", "Do you still have hot water and heating?"]
};

/** A vague home report always triggers the clarifying round in the fake provider. */
export function isVagueReport(description: string): boolean {
  return description.trim().length < 60 || /not sure|something is wrong|unclear|problem with/i.test(description);
}
