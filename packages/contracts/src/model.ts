import { z } from "zod";
import { UrgencySchema } from "./safety";

export const IssueTypeSchema = z.enum(["boiler", "heating", "plumbing", "electrical", "appliance", "other"]);

/** Fast model output: do we need to ask anything before planning? */
export const ClassificationSchema = z.object({
  issueType: IssueTypeSchema,
  needsClarification: z.boolean(),
  questions: z.array(z.string().min(1).max(200)).max(2)
});

/**
 * Model output is validated leniently here and clamped to the product contract
 * (`RepairPlan`) when the plan is assembled: models are verbose, and a plan that
 * is merely too wordy must not be thrown away.
 */
export const PlanActionDraftSchema = z.object({
  title: z.string().min(1).max(400),
  rationale: z.string().min(1).max(2000),
  ownerLabel: z.string().min(1).max(200),
  dueAt: z.iso.datetime().nullable(),
  requiresConfirmation: z.boolean()
});

/** Structured plan draft produced by the reasoning model and validated before use. */
export const PlanDraftSchema = z.object({
  issueSummary: z.string().min(1).max(2000),
  urgency: UrgencySchema,
  // Deliberately lenient: models sometimes return more than the product allows.
  // HomeOpsService trims to 2 questions and 5 actions for the RepairPlan.
  clarifyingQuestions: z.array(z.string().min(1).max(1000)).max(6),
  actions: z.array(PlanActionDraftSchema).min(1).max(8)
});

export type IssueType = z.infer<typeof IssueTypeSchema>;
export type Classification = z.infer<typeof ClassificationSchema>;
export type PlanActionDraft = z.infer<typeof PlanActionDraftSchema>;
export type PlanDraft = z.infer<typeof PlanDraftSchema>;
