import { describe, expect, it } from "vitest";
import type { ChatCompletionRequest, ChatCompletionResponse } from "./chat-client";
import { createNebiusModelProvider } from "./nebius-model-provider";
import { BOILER_DRAFT } from "@homeops/test-fixtures";
import { boilerIntake } from "@homeops/test-fixtures";
import { assessSafety } from "@homeops/agent-core";

const input = {
  intake: boilerIntake(),
  household: null,
  safety: assessSafety({ description: "The boiler is humming loudly.", occupancyNotes: null }),
  issueType: "boiler" as const,
  today: "2026-10-07T08:00:00.000Z",
  repairHint: null
};

function stubClient(responses: Array<{ text: string } | Error>): { client: { complete(request: ChatCompletionRequest): Promise<ChatCompletionResponse> }; requests: ChatCompletionRequest[] } {
  const requests: ChatCompletionRequest[] = [];
  let index = 0;
  return {
    requests,
    client: {
      async complete(request) {
        requests.push(request);
        const next = responses[Math.min(index, responses.length - 1)];
        index += 1;
        if (!next) throw new Error("stub client has no queued response");
        if (next instanceof Error) throw next;
        return { text: next.text, usage: { inputTokens: 10, outputTokens: 20 } };
      }
    }
  };
}

describe("NebiusModelProvider", () => {
  it("parses a fenced JSON draft into a validated PlanDraft", async () => {
    const { client } = stubClient([{ text: `\`\`\`json\n${JSON.stringify(BOILER_DRAFT)}\n\`\`\`` }]);
    const provider = createNebiusModelProvider({ apiKey: "test", baseUrl: "http://localhost", planModel: "plan", fastModel: "fast", client });
    const draft = await provider.plan(input);
    expect(draft.actions).toHaveLength(BOILER_DRAFT.actions.length);
    expect(draft.urgency).toBe("needs_attention");
  });

  it("rejects an invalid draft instead of guessing", async () => {
    const { client } = stubClient([{ text: JSON.stringify({ issueSummary: "x", urgency: "made-up", clarifyingQuestions: [], actions: [] }) }]);
    const provider = createNebiusModelProvider({ apiKey: "test", baseUrl: "http://localhost", planModel: "plan", fastModel: "fast", client });
    await expect(provider.plan(input)).rejects.toThrowError(/schema validation/);
  });

  it("falls back to prompt-only JSON when the endpoint rejects response_format", async () => {
    const { client, requests } = stubClient([
      new Error("400 response_format is not supported for this model"),
      { text: JSON.stringify(BOILER_DRAFT) }
    ]);
    const provider = createNebiusModelProvider({ apiKey: "test", baseUrl: "http://localhost", planModel: "plan", fastModel: "fast", client });
    const draft = await provider.plan(input);
    expect(draft.issueSummary).toContain("Boiler");
    expect(requests[0]?.jsonMode).toBe(true);
    expect(requests[1]?.jsonMode).toBe(false);
  });

  it("degrades classification instead of failing the request", async () => {
    const { client } = stubClient([{ text: "not json at all" }]);
    const provider = createNebiusModelProvider({ apiKey: "test", baseUrl: "http://localhost", planModel: "plan", fastModel: "fast", client });
    const classification = await provider.classify(input);
    expect(classification.needsClarification).toBe(false);
  });
});
