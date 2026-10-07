import { z } from "zod";
import { EvidenceWithUrlSchema } from "./evidence";
import { BudgetBandSchema } from "./intake";
import { MaintenanceTaskViewSchema } from "./maintenance";
import { HouseholdIdSchema, MemberIdSchema, PlanIdSchema } from "./ids";
import { ActionStatusSchema, PlanActionSchema, RepairPlanSchema } from "./plan";
import { SafetyAssessmentSchema } from "./safety";
import { AgentTraceEventSchema } from "./trace";

export const CreatePlanRequestSchema = z.object({
  householdId: HouseholdIdSchema.nullable().optional(),
  description: z.string().min(3).max(2000),
  deadline: z.iso.datetime().nullable().optional(),
  occupancyNotes: z.string().max(400).nullable().optional(),
  budgetBand: BudgetBandSchema.optional(),
  clarificationAnswers: z.array(z.string().min(1).max(500)).max(4).optional()
});

export const CreatePlanResponseSchema = z.object({
  plan: RepairPlanSchema,
  trace: z.array(AgentTraceEventSchema),
  clarificationRequired: z.boolean()
});

export const PlanEnvelopeSchema = z.object({
  plan: RepairPlanSchema,
  trace: z.array(AgentTraceEventSchema),
  openActions: z.array(PlanActionSchema)
});

export const AssignActionRequestSchema = z.object({
  ownerMemberId: MemberIdSchema,
  confirm: z.boolean()
});

export const UpdateActionStatusRequestSchema = z.object({
  status: ActionStatusSchema,
  confirm: z.boolean()
});

/** Deterministic triage preview: no model, no research, safe to show instantly. */
export const SafetyGuidanceRequestSchema = z.object({
  description: z.string().min(3).max(2000)
});

export const SafetyGuidanceResponseSchema = z.object({
  assessment: SafetyAssessmentSchema
});

export const CompleteMaintenanceRequestSchema = z.object({ confirm: z.boolean() });

export const MaintenanceListResponseSchema = z.object({
  householdId: HouseholdIdSchema,
  tasks: z.array(MaintenanceTaskViewSchema)
});

export const MaintenanceTaskResponseSchema = z.object({ task: MaintenanceTaskViewSchema });
export const MaintenanceMutationResponseSchema = z.object({
  status: z.enum(["ok", "confirmation_required"]),
  task: MaintenanceTaskViewSchema.optional(),
  message: z.string().optional(),
  proposedChanges: z.array(z.string()).optional()
});

export const EvidenceListResponseSchema = z.object({
  planId: PlanIdSchema,
  evidence: z.array(EvidenceWithUrlSchema)
});

export const EvidenceResponseSchema = z.object({ evidence: EvidenceWithUrlSchema });

export const PlanIdParamSchema = z.object({ planId: PlanIdSchema });
export const HouseholdIdParamSchema = z.object({ householdId: HouseholdIdSchema });

export const ConfirmationRequiredSchema = z.object({
  status: z.literal("confirmation_required"),
  message: z.string().min(1).max(300),
  proposedChanges: z.array(z.string().min(1).max(200)).min(1)
});

export const ApiProblemSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  code: z.string(),
  detail: z.string().optional()
});

export const ApiMetaSchema = z.object({
  version: z.string(),
  modelProvider: z.string(),
  model: z.string().nullable(),
  searchProvider: z.string(),
  startedAt: z.iso.datetime()
});

export type CreatePlanRequest = z.infer<typeof CreatePlanRequestSchema>;
export type CreatePlanResponse = z.infer<typeof CreatePlanResponseSchema>;
export type PlanEnvelope = z.infer<typeof PlanEnvelopeSchema>;
export type AssignActionRequest = z.infer<typeof AssignActionRequestSchema>;
export type UpdateActionStatusRequest = z.infer<typeof UpdateActionStatusRequestSchema>;
export type ConfirmationRequired = z.infer<typeof ConfirmationRequiredSchema>;
export type ApiProblem = z.infer<typeof ApiProblemSchema>;
export type ApiMeta = z.infer<typeof ApiMetaSchema>;
