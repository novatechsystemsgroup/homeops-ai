import type { ModelProvider, PlanModelInput } from "@homeops/agent-core";
import type { Classification, PlanDraft } from "@homeops/contracts";
import { ClassificationSchema, PlanDraftSchema } from "@homeops/contracts";
import {
  CLASSIFY_SYSTEM_PROMPT,
  PLAN_SYSTEM_PROMPT,
  buildClassifyUserPrompt,
  buildPlanUserPrompt,
  buildRepairPrompt,
  extractJsonObject
} from "@homeops/agent-core";
import { createNebiusChatClient, isJsonModeUnsupported, type ChatClient } from "./chat-client";

export interface NebiusModelProviderConfig {
  apiKey: string;
  baseUrl: string;
  /** Reasoning model used for the plan itself. */
  planModel: string;
  /** Small, fast model used for classification and clarifying questions. */
  fastModel: string;
  timeoutMs?: number;
  temperature?: number;
  /** Injectable for tests; defaults to the real OpenAI-compatible client. */
  client?: ChatClient;
}

export const DEFAULT_NEBIUS_BASE_URL = "https://api.tokenfactory.us-central1.nebius.com/v1/";
export const DEFAULT_PLAN_MODEL = "nvidia/nemotron-3-super-120b-a12b";
export const DEFAULT_FAST_MODEL = "nvidia/Nemotron-3_5-Lightning";

const NO_CLARIFICATION: Classification = { issueType: "other", needsClarification: false, questions: [] };

export function createNebiusModelProvider(config: NebiusModelProviderConfig): ModelProvider {
  const client = config.client ?? createNebiusChatClient({ apiKey: config.apiKey, baseUrl: config.baseUrl });
  const timeoutMs = config.timeoutMs ?? 30_000;
  const temperature = config.temperature ?? 0.2;

  // Flipped to false the first time the endpoint rejects response_format.
  let jsonMode = true;

  async function complete(model: string, system: string, user: string): Promise<unknown> {
    const attempt = async (useJsonMode: boolean) =>
      client.complete({ model, system, user, temperature, maxOutputTokens: 1200, jsonMode: useJsonMode, timeoutMs });

    let response;
    try {
      response = await attempt(jsonMode);
    } catch (error) {
      if (!jsonMode || !isJsonModeUnsupported(error)) throw error;
      jsonMode = false;
      response = await attempt(false);
    }

    return extractJsonObject(response.text);
  }

  return {
    name: "nebius",
    planModel: config.planModel,
    fastModel: config.fastModel,

    async classify(input: PlanModelInput): Promise<Classification> {
      // Classification is an optimisation, never a blocker: any failure means "plan now".
      try {
        const parsed = ClassificationSchema.safeParse(
          await complete(config.fastModel, CLASSIFY_SYSTEM_PROMPT, buildClassifyUserPrompt(input))
        );
        if (!parsed.success) return NO_CLARIFICATION;
        return parsed.data;
      } catch {
        return NO_CLARIFICATION;
      }
    },

    async plan(input: PlanModelInput): Promise<PlanDraft> {
      const user = input.repairHint ? buildRepairPrompt(input, input.repairHint) : buildPlanUserPrompt(input);
      const parsed = PlanDraftSchema.safeParse(await complete(config.planModel, PLAN_SYSTEM_PROMPT, user));
      if (!parsed.success) {
        const detail = parsed.error.issues.map((issue) => `${issue.path.join(".") || "draft"}: ${issue.message}`).join("; ");
        throw new Error(`Nebius plan draft failed schema validation (${detail})`);
      }
      return parsed.data;
    }
  };
}
