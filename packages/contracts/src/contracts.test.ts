import { describe, expect, it } from "vitest";
import {
  CreatePlanRequestSchema,
  IssueIntakeSchema,
  PlanDraftSchema,
  RepairPlanSchema,
  URGENCY_RANK,
  UpdateActionStatusInputSchema
} from "./index";

const ACTION_ID = "9a1c2f34-1111-4222-8333-444455556666";

const validPlan = {
  id: "5b0f4a1e-6a4e-4f4e-9d1f-3c2b1a0d9e8f",
  householdId: "0f5c9a52-4a1e-4c1b-9a53-2f8f6d1a7b31",
  issueSummary: "Boiler is making a loud humming noise before weekend guests arrive.",
  urgency: "needs_attention" as const,
  safetyFlags: [],
  safetyGuidance: [],
  clarifyingQuestions: [],
  actions: [
    {
      id: ACTION_ID,
      title: "Book a boiler service visit",
      rationale: "No gas, smoke or leak reported; a Gas Safe engineer should inspect the noise.",
      ownerMemberId: null,
      ownerLabel: "Alex",
      dueAt: null,
      status: "open" as const,
      requiresConfirmation: false
    }
  ],
  sources: [
    {
      title: "Gas Safe Register — find an engineer",
      url: "https://www.gassaferegister.co.uk/",
      retrievedAt: "2026-10-07T08:00:00.000Z",
      snippet: "Search for a Gas Safe registered engineer near you."
    }
  ],
  researchStatus: "ok" as const,
  degraded: false,
  createdAt: "2026-10-07T08:00:00.000Z"
};

describe("RepairPlan contract", () => {
  it("accepts a well-formed plan", () => {
    expect(RepairPlanSchema.safeParse(validPlan).success).toBe(true);
  });

  it("rejects a plan with no actions", () => {
    expect(RepairPlanSchema.safeParse({ ...validPlan, actions: [] }).success).toBe(false);
  });

  it("rejects an unknown urgency level", () => {
    expect(RepairPlanSchema.safeParse({ ...validPlan, urgency: "critical" }).success).toBe(false);
  });

  it("rejects more than five actions", () => {
    const actions = Array.from({ length: 6 }, (_, i) => ({ ...validPlan.actions[0], id: `9a1c2f34-1111-4222-8333-44445555666${i}` }));
    expect(RepairPlanSchema.safeParse({ ...validPlan, actions }).success).toBe(false);
  });

  it("rejects a non-url source", () => {
    const sources = [{ ...validPlan.sources[0], url: "not-a-url" }];
    expect(RepairPlanSchema.safeParse({ ...validPlan, sources }).success).toBe(false);
  });
});

describe("intake and api contracts", () => {
  it("rejects a too-short intake description", () => {
    const result = IssueIntakeSchema.safeParse({
      householdId: null,
      description: "hi",
      deadline: null,
      occupancyNotes: null,
      budgetBand: "unknown",
      clarificationAnswers: []
    });
    expect(result.success).toBe(false);
  });

  it("accepts a minimal plan request", () => {
    expect(CreatePlanRequestSchema.safeParse({ description: "The boiler is noisy." }).success).toBe(true);
  });

  it("requires an explicit confirm flag on state changes", () => {
    const actionId = ACTION_ID;
    expect(UpdateActionStatusInputSchema.safeParse({ planId: validPlan.id, actionId, status: "done" }).success).toBe(false);
    expect(UpdateActionStatusInputSchema.safeParse({ planId: validPlan.id, actionId, status: "done", confirm: true }).success).toBe(true);
  });
});

describe("model output contract", () => {
  it("accepts a valid draft and rejects an empty action list", () => {
    const draft = { issueSummary: "Boiler noise", urgency: "needs_attention", clarifyingQuestions: [], actions: [...validPlan.actions] };
    expect(PlanDraftSchema.safeParse(draft).success).toBe(true);
    expect(PlanDraftSchema.safeParse({ ...draft, actions: [] }).success).toBe(false);
    expect(PlanDraftSchema.safeParse({ ...draft, urgency: "urgent-ish" }).success).toBe(false);
  });
});

describe("urgency ordering", () => {
  it("ranks emergency above everything else", () => {
    expect(URGENCY_RANK.emergency).toBeGreaterThan(URGENCY_RANK.urgent);
    expect(URGENCY_RANK.urgent).toBeGreaterThan(URGENCY_RANK.needs_attention);
    expect(URGENCY_RANK.needs_attention).toBeGreaterThan(URGENCY_RANK.monitor);
  });
});
