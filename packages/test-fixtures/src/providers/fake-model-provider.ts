import type { ModelProvider, PlanModelInput } from "@homeops/agent-core";
import type { Classification, PlanDraft } from "@homeops/contracts";
import { BOILER_CLASSIFICATION, BOILER_DRAFT, HEAT_LOSS_DRAFT } from "../model-outputs";

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

    async classify(): Promise<Classification> {
      return options.classification ?? BOILER_CLASSIFICATION;
    },

    async plan(input: PlanModelInput): Promise<PlanDraft> {
      if (failures > 0) {
        failures -= 1;
        throw new Error("fake model provider: simulated failure");
      }
      if (options.draft) return options.draft;
      return input.safety.flags.includes("no_heat_or_hot_water") ? HEAT_LOSS_DRAFT : BOILER_DRAFT;
    }
  };
}
