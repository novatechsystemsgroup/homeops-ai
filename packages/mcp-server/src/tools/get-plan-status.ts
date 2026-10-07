import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GetPlanStatusInputSchema, GetPlanStatusOutputSchema } from "@homeops/contracts";
import type { HomeOpsService } from "@homeops/agent-core";
import { errorResult, textResult, withToolErrors } from "./helpers";

export function registerGetPlanStatus(server: McpServer, service: HomeOpsService): void {
  server.registerTool(
    "get_plan_status",
    {
      title: "Read the current status of a household plan",
      description:
        "Returns the stored plan and its open actions, so a conversation can be resumed later with the same context.",
      inputSchema: GetPlanStatusInputSchema,
      outputSchema: GetPlanStatusOutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (args) =>
      withToolErrors(
        async () => {
          const envelope = await service.getPlanEnvelope(args.planId);
          if (!envelope) return errorResult("No plan was found for that id.");
          const open = envelope.openActions.map((action) => action.title).join(" | ");
          const summary = envelope.openActions.length
            ? `${envelope.plan.issueSummary} — still open: ${open}`
            : `${envelope.plan.issueSummary} — every action is done.`;
          return textResult(summary, { plan: envelope.plan, openActions: envelope.openActions });
        },
        { fallback: "Could not read the plan" }
      )
  );
}
