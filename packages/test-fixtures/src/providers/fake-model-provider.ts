import type { ModelProvider, PlanModelInput } from "@homeops/agent-core";
import type { Classification, PlanDraft } from "@homeops/contracts";
import { inferIssueType } from "@homeops/agent-core";
import {
  APPLIANCE_DRAFT,
  BOILER_CLASSIFICATION,
  BOILER_DRAFT,
  ELECTRICAL_DRAFT,
  HEAT_LOSS_DRAFT,
  PLUMBING_DRAFT,
  VAGUE_CLASSIFICATION,
  isVagueReport
} from "../model-outputs";

/** Domain-aware drafts so local demos and E2E cover more than the boiler scenario. */
function draftForDescription(description: string): PlanDraft {
  switch (inferIssueType(description)) {
    case "plumbing":
      return PLUMBING_DRAFT;
    case "electrical":
      return ELECTRICAL_DRAFT;
    case "appliance":
      return APPLIANCE_DRAFT;
    case "heating":
      return HEAT_LOSS_DRAFT;
    default:
      return BOILER_DRAFT;
  }
}

export interface FakeModelOptions {
  name?: string;
  planModel?: string | null;
  fastModel?: string | null;
  draft?: PlanDraft;
  classification?: Classification;
  failTimes?: number;
}

/**
 * Deterministic stand-in for the NVIDIA model on Nebius. Used by tests, CI and
 * by the app when MODEL_PROVIDER=fake (no API key required).
 */
export function createFakeModelProvider(options: FakeModelOptions = {}): ModelProvider {
  let failures = options.failTimes ?? 0;

  return {
    name: options.name ?? "fake",
    planModel: options.planModel ?? "fake-plan-model",
    fastModel: options.fastModel ?? "fake-fast-model",

    async classify(input: PlanModelInput): Promise<Classification> {
      return options.classification ?? (isVagueReport(input.intake.description) ? VAGUE_CLASSIFICATION : BOILER_CLASSIFICATION);
    },

    async plan(input: PlanModelInput): Promise<PlanDraft> {
      if (failures > 0) {
        failures -= 1;
        throw new Error("fake model provider: simulated failure");
      }
      if (options.draft) return options.draft;
      if (input.safety.flags.includes("no_heat_or_hot_water")) return HEAT_LOSS_DRAFT;
      return draftForDescription(input.intake.description);
    }
  };
}
