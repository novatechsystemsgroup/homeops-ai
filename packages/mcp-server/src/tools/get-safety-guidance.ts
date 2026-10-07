import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GetSafetyGuidanceInputSchema, GetSafetyGuidanceOutputSchema } from "@homeops/contracts";
import type { HomeOpsService } from "@homeops/agent-core";
import { textResult, withToolErrors } from "./helpers";

export function registerGetSafetyGuidance(server: McpServer, service: HomeOpsService): void {
  server.registerTool(
    "get_safety_guidance",
    {
      title: "Check whether a household situation is dangerous",
      description:
        "Deterministic safety triage for gas, smoke or burning, water near electrics, carbon monoxide, loss of heat or hot water with a vulnerable occupant. Rules own the answer; a language model never does.",
      inputSchema: GetSafetyGuidanceInputSchema,
      outputSchema: GetSafetyGuidanceOutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (args) =>
      withToolErrors(
        async () => {
          const assessment = service.getSafetyGuidance(args.description);
          const summary = assessment.callEmergencyServices
            ? `Emergency: ${assessment.mandatoryGuidance[0] ?? "call the emergency service"}`
            : `Urgency: ${assessment.urgency}${assessment.flags.length ? ` (flags: ${assessment.flags.join(", ")})` : ""}.`;
          return textResult(summary, { assessment });
        },
        { fallback: "Could not assess safety" }
      )
  );
}
