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
