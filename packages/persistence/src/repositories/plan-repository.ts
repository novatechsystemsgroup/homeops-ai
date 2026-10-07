import { asc, desc, eq } from "drizzle-orm";
import type { PlanAction, RepairPlan } from "@homeops/contracts";
import { RepairPlanSchema } from "@homeops/contracts";
import type { DatabaseHandle } from "../client";
import { planActions, plans } from "../schema";

export interface PlanStore {
  savePlan(plan: RepairPlan): Promise<void>;
  getPlan(planId: string): Promise<RepairPlan | null>;
  listOpenPlans(householdId: string): Promise<RepairPlan[]>;
  listPlansForHousehold(householdId: string): Promise<RepairPlan[]>;
}

export function createPlanRepository(handle: DatabaseHandle): PlanStore {
  const { db } = handle;

  const readActions = (planId: string): PlanAction[] =>
    db
      .select()
      .from(planActions)
      .where(eq(planActions.planId, planId))
      .orderBy(asc(planActions.position))
      .all()
      .map((row) => ({
        id: row.id,
        title: row.title,
        rationale: row.rationale,
        ownerMemberId: row.ownerMemberId,
        ownerLabel: row.ownerLabel,
        dueAt: row.dueAt,
        status: row.status as PlanAction["status"],
        requiresConfirmation: row.requiresConfirmation
      }));

  const readPlan = (planId: string): RepairPlan | null => {
    const row = db.select().from(plans).where(eq(plans.id, planId)).get();
    if (!row) return null;
    return RepairPlanSchema.parse({
      id: row.id,
      householdId: row.householdId,
      issueSummary: row.issueSummary,
      urgency: row.urgency,
      safetyFlags: row.safetyFlags,
      safetyGuidance: row.safetyGuidance,
      clarifyingQuestions: row.clarifyingQuestions,
      actions: readActions(row.id),
      sources: row.sources,
      researchStatus: row.researchStatus,
      degraded: row.degraded,
      createdAt: row.createdAt
    });
  };

  const listPlansForHousehold = (householdId: string): RepairPlan[] =>
    db
      .select({ id: plans.id })
      .from(plans)
      .where(eq(plans.householdId, householdId))
      .orderBy(desc(plans.createdAt))
      .all()
      .flatMap((row) => {
        const plan = readPlan(row.id);
        return plan ? [plan] : [];
      });

  return {
    async savePlan(plan) {
      const parsed = RepairPlanSchema.parse(plan);
      db.transaction((tx) => {
        tx.insert(plans)
          .values({
            id: parsed.id,
            householdId: parsed.householdId,
            issueSummary: parsed.issueSummary,
            urgency: parsed.urgency,
            safetyFlags: parsed.safetyFlags,
            safetyGuidance: parsed.safetyGuidance,
            clarifyingQuestions: parsed.clarifyingQuestions,
            sources: parsed.sources,
            researchStatus: parsed.researchStatus,
            degraded: parsed.degraded,
            createdAt: parsed.createdAt
          })
          .onConflictDoUpdate({
            target: plans.id,
            set: {
              issueSummary: parsed.issueSummary,
              urgency: parsed.urgency,
              safetyFlags: parsed.safetyFlags,
              safetyGuidance: parsed.safetyGuidance,
              clarifyingQuestions: parsed.clarifyingQuestions,
              sources: parsed.sources,
              researchStatus: parsed.researchStatus,
              degraded: parsed.degraded
            }
          })
          .run();

        tx.delete(planActions).where(eq(planActions.planId, parsed.id)).run();
        parsed.actions.forEach((action, index) => {
          tx.insert(planActions)
            .values({
              id: action.id,
              planId: parsed.id,
              position: index,
              title: action.title,
              rationale: action.rationale,
              ownerMemberId: action.ownerMemberId,
              ownerLabel: action.ownerLabel,
              dueAt: action.dueAt,
              status: action.status,
              requiresConfirmation: action.requiresConfirmation
            })
            .run();
        });
      });
    },

    async getPlan(planId) {
      return readPlan(planId);
    },

    async listPlansForHousehold(householdId) {
      return listPlansForHousehold(householdId);
    },

    async listOpenPlans(householdId) {
      return listPlansForHousehold(householdId).filter((plan) => plan.actions.some((action) => action.status !== "done"));
    }
  };
}
