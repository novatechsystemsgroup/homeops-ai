import { z } from "zod";

export const UrgencySchema = z.enum(["emergency", "urgent", "needs_attention", "monitor"]);

export const SafetyFlagSchema = z.enum([
  "possible_gas",
  "smoke_or_burning",
  "water_near_electricity",
  "carbon_monoxide",
  "no_heat_or_hot_water",
  "vulnerable_occupant",
  "appliance_noise",
  "active_water_leak",
  "appliance_fault"
]);

/** Result of the deterministic safety triage. Never produced by a language model. */
export const SafetyAssessmentSchema = z.object({
  urgency: UrgencySchema,
  flags: z.array(SafetyFlagSchema),
  ruleIds: z.array(z.string().min(1).max(40)),
  /** Mandatory, human-reviewed guidance that must be shown verbatim. */
  mandatoryGuidance: z.array(z.string().min(1).max(400)),
  callEmergencyServices: z.boolean(),
  /** True when the trigger pattern was negated in the text ("no smell of gas"). */
  negatedTriggers: z.array(z.string().max(60))
});

export const URGENCY_RANK: Record<z.infer<typeof UrgencySchema>, number> = {
  monitor: 0,
  needs_attention: 1,
  urgent: 2,
  emergency: 3
};

export type Urgency = z.infer<typeof UrgencySchema>;
export type SafetyFlag = z.infer<typeof SafetyFlagSchema>;
export type SafetyAssessment = z.infer<typeof SafetyAssessmentSchema>;
