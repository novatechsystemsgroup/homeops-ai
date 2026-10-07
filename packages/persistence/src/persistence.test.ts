import { describe, expect, it } from "vitest";
import type { RepairPlan } from "@homeops/contracts";
import { createDatabase } from "./client";
import { createHouseholdStore } from "./repositories/household-repository";
import { createPlanRepository } from "./repositories/plan-repository";
import { createTraceRepository } from "./repositories/trace-repository";
import { DEMO_HOUSEHOLD, seedDemoHousehold } from "./seed";

let counter = 0;
const ids = { uuid: () => `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}` };
const clock = { now: () => new Date("2026-10-07T09:00:00.000Z") };

function planFixture(id: string): RepairPlan {
  return {
    id,
    householdId: DEMO_HOUSEHOLD.id,
    issueSummary: "Boiler noise before guests arrive.",
    urgency: "needs_attention",
    safetyFlags: [],
    safetyGuidance: [],
    clarifyingQuestions: [],
    actions: [
      {
        id: "9a1c2f34-1111-4222-8333-444455556666",
        title: "Book a boiler service visit",
        rationale: "Inspect the noise before it gets worse.",
        ownerMemberId: DEMO_HOUSEHOLD.members[0].id,
        ownerLabel: "Alex Hartley",
        dueAt: null,
        status: "open",
        requiresConfirmation: true
      }
    ],
    sources: [],
    researchStatus: "skipped",
    degraded: false,
    createdAt: "2026-10-07T09:00:00.000Z"
  };
}

describe("persistence round-trip", () => {
  it("stores and reads the demo household", async () => {
    const handle = createDatabase(":memory:");
    const store = createHouseholdStore(handle);
    await seedDemoHousehold(store, "2026-10-07T09:00:00.000Z");

    const household = await store.getHousehold(DEMO_HOUSEHOLD.id);
    expect(household?.members).toHaveLength(4);
    expect(household?.isSynthetic).toBe(true);

    const member = await store.getMember(DEMO_HOUSEHOLD.members[1].id);
    expect(member?.displayName).toBe("Priya Hartley");
    handle.close();
  });

  it("round-trips a plan through the ORM, including json columns", async () => {
    const handle = createDatabase(":memory:");
    const households = createHouseholdStore(handle);
    const plans = createPlanRepository(handle);
    await seedDemoHousehold(households, "2026-10-07T09:00:00.000Z");

    const plan = planFixture("5b0f4a1e-6a4e-4f4e-9d1f-3c2b1a0d9e8f");
    await plans.savePlan(plan);
    const loaded = await plans.getPlan(plan.id);

    expect(loaded).toEqual(plan);
    expect(await plans.listOpenPlans(DEMO_HOUSEHOLD.id)).toHaveLength(1);

    const action = plan.actions[0];
    if (!action) throw new Error("fixture plan must contain one action");
    await plans.savePlan({ ...plan, actions: [{ ...action, status: "done" }] });
    expect(await plans.listOpenPlans(DEMO_HOUSEHOLD.id)).toHaveLength(0);
    handle.close();
  });

  it("assigns monotonic sequence numbers to trace events per plan", async () => {
    const handle = createDatabase(":memory:");
    const households = createHouseholdStore(handle);
    const plans = createPlanRepository(handle);
    const trace = createTraceRepository(handle, ids, clock);
    await seedDemoHousehold(households, "2026-10-07T09:00:00.000Z");

    const planId = "5b0f4a1e-6a4e-4f4e-9d1f-3c2b1a0d9e8f";
    await plans.savePlan(planFixture(planId));
    await trace.emit({ planId, type: "intake.received", status: "ok", summary: "Intake received." });
    await trace.emit({ planId, type: "safety.evaluated", status: "ok", summary: "Triage done." });

    const events = await trace.listByPlan(planId);
    expect(events.map((event) => event.seq)).toEqual([1, 2]);
    expect(events.at(1)?.type).toBe("safety.evaluated");
    handle.close();
  });

  it("deletes the demo household, its plans and its trace events", async () => {
    const handle = createDatabase(":memory:");
    const households = createHouseholdStore(handle);
    const plans = createPlanRepository(handle);
    const trace = createTraceRepository(handle, ids, clock);
    await seedDemoHousehold(households, "2026-10-07T09:00:00.000Z");

    const planId = "5b0f4a1e-6a4e-4f4e-9d1f-3c2b1a0d9e8f";
    await plans.savePlan(planFixture(planId));
    await trace.emit({ planId, type: "intake.received", status: "ok", summary: "Intake received." });

    expect(await households.deleteHousehold(DEMO_HOUSEHOLD.id)).toBe(true);
    expect(await households.getHousehold(DEMO_HOUSEHOLD.id)).toBeNull();
    expect(await plans.getPlan(planId)).toBeNull();
    expect(await trace.listByPlan(planId)).toHaveLength(0);
    expect(await households.deleteHousehold(DEMO_HOUSEHOLD.id)).toBe(false);
    handle.close();
  });
});
