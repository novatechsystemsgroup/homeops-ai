import { z } from "zod";
import { ActionIdSchema, HouseholdIdSchema, MemberIdSchema, PlanIdSchema } from "./ids";
import { SafetyFlagSchema, UrgencySchema } from "./safety";

export const ActionStatusSchema = z.enum(["open", "assigned", "done"]);
export const ResearchStatusSchema = z.enum(["ok", "unavailable", "skipped"]);

export const PlanActionSchema = z.object({
  id: ActionIdSchema,
  title: z.string().min(1).max(120),
  rationale: z.string().min(1).max(400),
  ownerMemberId: MemberIdSchema.nullable(),
  ownerLabel: z.string().min(1).max(80),
  dueAt: z.iso.datetime().nullable(),
  status: ActionStatusSchema,
  requiresConfirmation: z.boolean()
});

export const SourceSchema = z.object({
  title: z.string().min(1).max(200),
  url: z.url(),
  retrievedAt: z.iso.datetime(),
  snippet: z.string().max(400)
});

/** The single structured artefact the whole product is built around. */
export const RepairPlanSchema = z.object({
  id: PlanIdSchema,
  householdId: HouseholdIdSchema,
  issueSummary: z.string().min(1).max(300),
  urgency: UrgencySchema,
  safetyFlags: z.array(SafetyFlagSchema),
  /** Verbatim deterministic guidance, rendered as an unmissable banner. */
  safetyGuidance: z.array(z.string().min(1).max(400)),
  clarifyingQuestions: z.array(z.string().min(1).max(200)).max(2),
  actions: z.array(PlanActionSchema).min(1).max(5),
  sources: z.array(SourceSchema).max(8),
  researchStatus: ResearchStatusSchema,
  /** True when the plan came from the deterministic fallback instead of the model. */
  degraded: z.boolean(),
  createdAt: z.iso.datetime()
});

export type ActionStatus = z.infer<typeof ActionStatusSchema>;
export type ResearchStatus = z.infer<typeof ResearchStatusSchema>;
export type PlanAction = z.infer<typeof PlanActionSchema>;
export type Source = z.infer<typeof SourceSchema>;
export type RepairPlan = z.infer<typeof RepairPlanSchema>;
