import { z } from "zod";
import { HouseholdIdSchema, MemberIdSchema, PlanIdSchema } from "./ids";
import { MaintenanceTaskViewSchema } from "./maintenance";
import { ActionStatusSchema, PlanActionSchema, RepairPlanSchema, ResearchStatusSchema, SourceSchema } from "./plan";
import { SafetyAssessmentSchema } from "./safety";

/**
 * MCP tool contracts. The same schemas are used for tool discovery
 * (input/output JSON schema) and for runtime validation of tool arguments.
 */

export const BuildRepairPlanInputSchema = z.object({
  description: z.string().min(3).max(2000).describe("What the household reported, in their own words."),
  householdId: HouseholdIdSchema.nullable().optional().describe("Household to plan for. Defaults to the demo household."),
  deadline: z.iso.datetime().nullable().optional().describe("Optional deadline that makes the issue time-critical."),
  clarificationAnswers: z.array(z.string().min(1).max(500)).max(4).optional()
});
export const BuildRepairPlanOutputSchema = z.object({
  plan: RepairPlanSchema,
  clarificationRequired: z.boolean()
});

export const GetSafetyGuidanceInputSchema = z.object({
  description: z.string().min(3).max(2000)
});
export const GetSafetyGuidanceOutputSchema = z.object({ assessment: SafetyAssessmentSchema });

export const SearchServiceOptionsInputSchema = z.object({
  query: z.string().min(3).max(300).describe("What to research, e.g. 'boiler service Bristol'."),
  location: z.string().max(120).nullable().optional(),
  limit: z.number().int().min(1).max(10).optional()
});
export const SearchServiceOptionsOutputSchema = z.object({
  sources: z.array(SourceSchema),
  researchStatus: ResearchStatusSchema
});

export const AssignHouseholdTaskInputSchema = z.object({
  planId: PlanIdSchema,
  actionId: z.uuid(),
  ownerMemberId: MemberIdSchema,
  confirm: z.boolean().describe("Must be true. Without it the tool returns confirmation_required.")
});
/**
 * Flat shape on purpose: MCP clients receive it as the tool's JSON output schema,
 * and one object with an explicit status is easier for them than a union.
 */
export const TaskMutationOutputSchema = z.object({
  status: z.enum(["ok", "confirmation_required"]),
  plan: RepairPlanSchema.optional(),
  message: z.string().min(1).max(300).optional(),
  proposedChanges: z.array(z.string().min(1).max(200)).optional()
});

export const AssignHouseholdTaskOutputSchema = TaskMutationOutputSchema;

export const GetMaintenanceDueInputSchema = z.object({
  householdId: HouseholdIdSchema.nullable().optional().describe("Household to check. Defaults to the demo household."),
  includeScheduled: z.boolean().optional().describe("Also return tasks that are not due yet.")
});
export const GetMaintenanceDueOutputSchema = z.object({
  tasks: z.array(MaintenanceTaskViewSchema),
  spokenSummary: z.string().min(1).max(300).describe("One sentence a voice client can read out.")
});

export const CompleteMaintenanceTaskInputSchema = z.object({
  taskId: z.uuid(),
  confirm: z.boolean().describe("Must be true. Without it the tool returns confirmation_required.")
});
export const CompleteMaintenanceTaskOutputSchema = z.object({
  status: z.enum(["ok", "confirmation_required"]),
  task: MaintenanceTaskViewSchema.optional(),
  message: z.string().min(1).max(300).optional(),
  proposedChanges: z.array(z.string().min(1).max(200)).optional()
});

export const GetPlanStatusInputSchema = z.object({ planId: PlanIdSchema });
export const GetPlanStatusOutputSchema = z.object({
  plan: RepairPlanSchema,
  openActions: z.array(PlanActionSchema)
});

export const UpdateActionStatusInputSchema = z.object({
  planId: PlanIdSchema,
  actionId: z.uuid(),
  status: ActionStatusSchema,
  confirm: z.boolean().describe("Must be true. Without it the tool returns confirmation_required.")
});
export const UpdateActionStatusOutputSchema = TaskMutationOutputSchema;

export type BuildRepairPlanInput = z.infer<typeof BuildRepairPlanInputSchema>;
export type GetSafetyGuidanceInput = z.infer<typeof GetSafetyGuidanceInputSchema>;
export type SearchServiceOptionsInput = z.infer<typeof SearchServiceOptionsInputSchema>;
export type AssignHouseholdTaskInput = z.infer<typeof AssignHouseholdTaskInputSchema>;
export type GetPlanStatusInput = z.infer<typeof GetPlanStatusInputSchema>;
export type UpdateActionStatusInput = z.infer<typeof UpdateActionStatusInputSchema>;
