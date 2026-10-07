import type { IssueIntake } from "@homeops/contracts";
import { DEMO_HOUSEHOLD } from "./household";

export const BOILER_DESCRIPTION =
  "The boiler is making a loud humming noise. We have guests arriving on Saturday and I do not want to be without hot water.";

export const BOILER_EMERGENCY_DESCRIPTION = "There is a smell of gas next to the boiler cupboard and the boiler keeps clicking.";

export const BOILER_CLARIFICATION_ANSWERS = [
  "No smell of gas and no smoke, just the noise.",
  "We still have hot water and the heating works."
];

export function boilerIntake(overrides: Partial<IssueIntake> = {}): IssueIntake {
  return {
    householdId: DEMO_HOUSEHOLD.id,
    description: BOILER_DESCRIPTION,
    deadline: null,
    occupancyNotes: null,
    budgetBand: "unknown",
    clarificationAnswers: [],
    ...overrides
  };
}
