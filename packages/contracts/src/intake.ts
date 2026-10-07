import { z } from "zod";
import { HouseholdIdSchema } from "./ids";

export const BudgetBandSchema = z.enum(["low", "medium", "high", "unknown"]);

/** Raw, unstructured intake: everything the household told us before planning. */
export const IssueIntakeSchema = z.object({
  householdId: HouseholdIdSchema.nullable(),
  description: z.string().min(3).max(2000),
  deadline: z.iso.datetime().nullable(),
  occupancyNotes: z.string().max(400).nullable(),
  budgetBand: BudgetBandSchema,
  /** Answers to the (max two) clarifying questions of a previous round. */
  clarificationAnswers: z.array(z.string().min(1).max(500)).max(4)
});

export type BudgetBand = z.infer<typeof BudgetBandSchema>;
export type IssueIntake = z.infer<typeof IssueIntakeSchema>;
