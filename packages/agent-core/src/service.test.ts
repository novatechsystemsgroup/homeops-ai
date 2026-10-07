import { describe, expect, it } from "vitest";
import type {
  AgentTraceEvent,
  Household,
  HouseholdMember,
  PlanAction,
  PlanDraft,
  RepairPlan,
  Source
} from "@homeops/contracts";
import { HomeOpsService, buildResearchQueries, inferIssueType, summariseSymptom, type ServiceConfig, type ServiceDeps } from "./service";
import type { HouseholdRepository, ModelProvider, NewTraceEventInput, PlanRepository, SearchOptions, SearchProvider, TraceSink } from "./ports";

const HOUSEHOLD_ID = "0f5c9a52-4a1e-4c1b-9a53-2f8f6d1a7b31";
const MEMBER_ID = "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f";

function member(): HouseholdMember {
  return { id: MEMBER_ID, householdId: HOUSEHOLD_ID, displayName: "Alex Hartley", role: "adult", prefersContact: "in_person" };
}

function household(): Household {
  return {
    id: HOUSEHOLD_ID,
    name: "Hartley household",
    city: "Bristol",
    isSynthetic: true,
    members: [member()],
    createdAt: "2026-10-07T07:00:00.000Z"
  };
}

function boilerIntakeFixture() {
  return {
    householdId: HOUSEHOLD_ID,
    description: "The boiler is making a loud humming noise.",
    deadline: null,
    occupancyNotes: null,
    budgetBand: "unknown" as const,
    clarificationAnswers: []
  };
}

const DRAFT: PlanDraft = {
  issueSummary: "Boiler noise before weekend guests arrive.",
  urgency: "needs_attention",
  clarifyingQuestions: [],
  actions: [
    {
      title: "Book a boiler service visit",
      rationale: "A changing noise should be inspected before it fails.",
      ownerLabel: "Alex",
      dueAt: null,
      requiresConfirmation: true
    }
  ]
};

function createHarness(overrides: Partial<ServiceDeps> = {}, config: Partial<ServiceConfig> = {}) {
  let plan: RepairPlan | null = null;
  const events: AgentTraceEvent[] = [];
  let counter = 0;

  const plans: PlanRepository = {
    async savePlan(next) { plan = next; },
    async getPlan(id) { return plan && plan.id === id ? plan : null; },
    async listOpenPlans() { return plan ? [plan] : []; }
  };
  const households: HouseholdRepository = {
    async getHousehold(id) { return id === HOUSEHOLD_ID ? household() : null; },
    async listMembers() { return [member()]; },
    async getMember(id) { return id === MEMBER_ID ? member() : null; }
  };
  const trace: TraceSink = {
    async emit(event: NewTraceEventInput) {
      counter += 1;
      const stored: AgentTraceEvent = {
        id: `trace-${counter}`.padEnd(36, "0"),
        planId: event.planId,
        seq: counter,
        type: event.type,
        at: "2026-10-07T08:00:00.000Z",
        durationMs: event.durationMs ?? null,
        provider: event.provider ?? null,
        model: event.model ?? null,
        tool: event.tool ?? null,
        status: event.status,
        summary: event.summary
      };
      events.push(stored);
      return stored;
    },
    async listByPlan(planId) { return events.filter((event) => event.planId === planId); }
  };
  const model: ModelProvider = {
    name: "fake",
    planModel: "fake-plan",
    fastModel: "fake-fast",
    async classify() { return { issueType: "boiler", needsClarification: false, questions: [] }; },
    async plan() { return DRAFT; }
  };
  const searchCalls: Array<{ query: string; options: SearchOptions }> = [];
  const search: SearchProvider = {
    name: "fake-search",
    description: "deterministic fixture search",
    async search(query, options): Promise<Source[]> {
      searchCalls.push({ query, options });
      return [{ title: "Gas Safe Register", url: "https://www.gassaferegister.co.uk/", retrievedAt: "2026-10-07T08:00:00.000Z", snippet: "Find an engineer." }];
    }
  };

  const deps: ServiceDeps = {
    model,
    search,
    plans,
    households,
    trace,
    clock: { now: () => new Date("2026-10-07T08:00:00.000Z") },
    ids: { uuid: () => `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}` },
    config: { searchEnabled: true, maxClarifyingQuestions: 2, modelTimeoutMs: 500, searchTimeoutMs: 500, fallbackHouseholdId: HOUSEHOLD_ID, searchResultLimit: 5, ...config },
    ...overrides
  };

  return { service: new HomeOpsService(deps), get plan() { return plan; }, events, searchCalls };
}

describe("HomeOpsService.createPlan", () => {
  it("produces a validated plan for the boiler scenario", async () => {
    const harness = createHarness();
    const result = await harness.service.createPlan({ householdId: HOUSEHOLD_ID, description: "The boiler is making a loud humming noise and guests arrive on Saturday." });
    expect(result.plan.urgency).toBe("needs_attention");
    expect(result.plan.actions).toHaveLength(1);
    expect(result.plan.researchStatus).toBe("ok");
    expect(result.plan.sources).toHaveLength(1);
    expect(result.plan.degraded).toBe(false);
    expect(result.clarificationRequired).toBe(false);
  });

  it("builds a register query and a symptom-based guidance query", () => {
    const intake = { ...boilerIntakeFixture(), description: "The boiler is making a loud humming noise before guests arrive." };
    const queries = buildResearchQueries(intake, null, "boiler");

    expect(queries).toHaveLength(2);
    expect(queries[0]?.includeDomains).toEqual(["gassaferegister.co.uk"]);
    expect(queries[1]?.query).toContain("making a noise");
    expect(queries[1]?.query).not.toContain("Bristol");
    expect(queries[1]?.excludeDomains).toContain("reddit.com");
    expect(summariseSymptom("No hot water since yesterday.")).toBe("not heating or no hot water");
    expect(summariseSymptom("The kitchen tap is dripping.")).toBe("leaking");
    expect(summariseSymptom("Something is wrong somewhere.")).toBeNull();
  });

  it("falls back to a deterministic issue type when the model answers 'other'", () => {
    expect(inferIssueType("The boiler is making a loud humming noise.")).toBe("boiler");
    // Water near electrics is routed to the electrical domain on purpose: the plan must
    // isolate power before anyone starts chasing the leak. The safety rules still raise
    // this case to an emergency independently of the issue type.
    expect(inferIssueType("Water is dripping under the sink next to a socket.")).toBe("electrical");
    expect(inferIssueType("Water is dripping under the kitchen sink.")).toBe("plumbing");
    expect(inferIssueType("The kitchen light fitting is buzzing.")).toBe("electrical");
    expect(inferIssueType("The tumble dryer stopped heating.")).toBe("appliance");
    // "drain" is a plumbing word, but the specific appliance always wins.
    expect(inferIssueType("The washing machine will not drain and the drum is full.")).toBe("appliance");
    expect(inferIssueType("There is no hot water and the radiators are cold.")).toBe("heating");
    expect(inferIssueType("Something odd happened.")).toBe("other");
  });

  it("trusts the literal keywords over a wrong model category when routing research", async () => {
    const harness = createHarness({
      model: {
        name: "fake",
        planModel: "fake-plan",
        fastModel: "fake-fast",
        async classify() {
          // A plausible model mistake: it files a sink leak under heating.
          return { issueType: "heating", needsClarification: false, questions: [] };
        },
        async plan() {
          return DRAFT;
        }
      }
    });

    await harness.service.createPlan({ householdId: HOUSEHOLD_ID, description: "Water is dripping under the kitchen sink." });
    const call = harness.searchCalls.at(0);
    expect(call?.query).toContain("plumber");
    expect(call?.options.includeDomains).toEqual(["watersafe.org.uk"]);
  });

  it("uses the deterministic issue type for research when classification fails", async () => {
    const harness = createHarness({
      model: {
        name: "fake",
        planModel: "fake-plan",
        fastModel: "fake-fast",
        async classify() {
          throw new Error("classifier offline");
        },
        async plan() {
          return DRAFT;
        }
      }
    });

    await harness.service.createPlan({ householdId: HOUSEHOLD_ID, description: "The boiler is making a loud humming noise." });
    const call = harness.searchCalls.at(0);
    expect(call?.query).toContain("boiler engineer");
    expect(call?.options.includeDomains).toContain("gassaferegister.co.uk");
  });

  it("researches authoritative UK sources for the detected issue type", async () => {
    const harness = createHarness();
    await harness.service.createPlan({ householdId: HOUSEHOLD_ID, description: "The boiler is making a loud humming noise." });
    const call = harness.searchCalls.at(0);
    expect(call?.query).toContain("UK");
    expect(call?.query).toContain("Bristol");
    expect(call?.options.includeDomains).toContain("gassaferegister.co.uk");
  });

  it("skips the model entirely for an emergency and keeps the deterministic guidance", async () => {
    const harness = createHarness();
    const result = await harness.service.createPlan({ householdId: HOUSEHOLD_ID, description: "I can smell gas next to the boiler." });
    expect(result.plan.urgency).toBe("emergency");
    expect(result.plan.researchStatus).toBe("skipped");
    expect(result.plan.safetyGuidance.join(" ")).toContain("0800 111 999");
    expect(harness.events.map((event) => event.type)).toContain("model.plan.skipped");
  });

  it("never lets the model lower the urgency produced by the rules", async () => {
    const harness = createHarness({
      model: {
        name: "fake",
        planModel: "fake-plan",
        fastModel: "fake-fast",
        async classify() { return { issueType: "heating", needsClarification: false, questions: [] }; },
        async plan() { return { ...DRAFT, urgency: "monitor" as const }; }
      }
    });
    const result = await harness.service.createPlan({ householdId: HOUSEHOLD_ID, description: "The boiler is broken and we have no hot water." });
    expect(result.plan.urgency).toBe("urgent");
    expect(harness.events.map((event) => event.type)).toContain("safety.override.applied");
  });

  it("falls back to a deterministic plan when the model fails twice", async () => {
    let calls = 0;
    const harness = createHarness({
      model: {
        name: "fake",
        planModel: "fake-plan",
        fastModel: "fake-fast",
        async classify() { return { issueType: "boiler", needsClarification: false, questions: [] }; },
        async plan() { calls += 1; throw new Error("model exploded"); }
      }
    });
    const result = await harness.service.createPlan({ householdId: HOUSEHOLD_ID, description: "The boiler is making a loud humming noise." });
    expect(calls).toBe(2);
    expect(result.plan.degraded).toBe(true);
    expect(result.plan.actions.length).toBeGreaterThan(0);
  });

  it("asks at most two clarifying questions before planning", async () => {
    const harness = createHarness({
      model: {
        name: "fake",
        planModel: "fake-plan",
        fastModel: "fake-fast",
        async classify() {
          return { issueType: "boiler", needsClarification: true, questions: ["Any smell of gas?", "Do you still have hot water?", "Extra question?"] };
        },
        async plan() { return DRAFT; }
      }
    });
    const result = await harness.service.createPlan({ householdId: HOUSEHOLD_ID, description: "Something is wrong with the boiler." });
    expect(result.clarificationRequired).toBe(true);
    expect(result.plan.clarifyingQuestions).toHaveLength(2);
  });

  it("rejects an unknown household instead of inventing one", async () => {
    const harness = createHarness();
    await expect(
      harness.service.createPlan({ householdId: "11111111-1111-4111-8111-111111111111", description: "Boiler is noisy." })
    ).rejects.toThrowError(/not found/i);
  });
});

function firstAction(plan: RepairPlan): PlanAction {
  const action = plan.actions[0];
  if (!action) throw new Error("expected the plan to contain at least one action");
  return action;
}

describe("HomeOpsService action mutations", () => {
  async function plannedHarness() {
    const harness = createHarness();
    const created = await harness.service.createPlan({ householdId: HOUSEHOLD_ID, description: "The boiler is making a loud humming noise." });
    return { harness, created };
  }

  it("requires confirmation before assigning a task", async () => {
    const { harness, created } = await plannedHarness();
    const action = firstAction(created.plan);
    const blocked = await harness.service.assignAction({ planId: created.plan.id, actionId: action.id, ownerMemberId: MEMBER_ID, confirm: false });
    expect(blocked.kind).toBe("confirmation_required");
    const allowed = await harness.service.assignAction({ planId: created.plan.id, actionId: action.id, ownerMemberId: MEMBER_ID, confirm: true });
    expect(allowed.kind).toBe("ok");
    if (allowed.kind === "ok") expect(firstAction(allowed.plan).status).toBe("assigned");
  });

  it("marks an action done and reports open actions", async () => {
    const { harness, created } = await plannedHarness();
    const action = firstAction(created.plan);
    const result = await harness.service.updateActionStatus({ planId: created.plan.id, actionId: action.id, status: "done", confirm: true });
    expect(result.kind).toBe("ok");
    const envelope = await harness.service.getPlanEnvelope(created.plan.id);
    expect(envelope?.openActions).toHaveLength(0);
  });
});
