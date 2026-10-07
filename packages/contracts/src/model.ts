import { z } from "zod";
import { UrgencySchema } from "./safety";

export const IssueTypeSchema = z.enum(["boiler", "heating", "plumbing", "electrical", "appliance", "other"]);

/** Fast model output: do we need to ask anything before planning? */
export const ClassificationSchema = z.object({
  issueType: IssueTypeSchema,
  needsClarification: z.boolean(),
  questions: z.array(z.string().min(1).max(200)).max(2)
});

export const PlanActionDraftSchema = z.object({
  title: z.string().min(1).max(120),
  rationale: z.string().min(1).max(400),
  ownerLabel: z.string().min(1).max(80),
  dueAt: z.iso.datetime().nullable(),
  requiresConfirmation: z.boolean()
});

/** Structured plan draft produced by the reasoning model and validated before use. */
export const PlanDraftSchema = z.object({
  issueSummary: z.string().min(1).max(300),
  urgency: UrgencySchema,
  clarifyingQuestions: z.array(z.string().min(1).max(200)).max(2),
  actions: z.array(PlanActionDraftSchema).min(1).max(5)
});

export type IssueType = z.infer<typeof IssueTypeSchema>;
export type Classification = z.infer<typeof ClassificationSchema>;
export type PlanActionDraft = z.infer<typeof PlanActionDraftSchema>;
export type PlanDraft = z.infer<typeof PlanDraftSchema>;
