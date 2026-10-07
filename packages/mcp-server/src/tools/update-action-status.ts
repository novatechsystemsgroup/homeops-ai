import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { UpdateActionStatusInputSchema, UpdateActionStatusOutputSchema } from "@homeops/contracts";
import type { HomeOpsService } from "@homeops/agent-core";
import { errorResult, textResult, withToolErrors } from "./helpers";

export function registerUpdateActionStatus(server: McpServer, service: HomeOpsService): void {
  server.registerTool(
    "update_action_status",
    {
      title: "Mark a plan action as open, assigned or done",
      description:
        "Updates the status of one action in an existing plan. This changes state, so it only proceeds with confirm=true; without it the tool returns the proposed change for the user to approve.",
      inputSchema: UpdateActionStatusInputSchema,
      outputSchema: UpdateActionStatusOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (args) =>
      withToolErrors(
        async () => {
          const result = await service.updateActionStatus({
            planId: args.planId,
            actionId: args.actionId,
            status: args.status,
            confirm: args.confirm
          });

          if (result.kind === "not_found") return errorResult(result.message);
          if (result.kind === "confirmation_required") {
            return textResult(result.message, { status: "confirmation_required", message: result.message, proposedChanges: result.proposedChanges });
          }
          const action = result.plan.actions.find((candidate) => candidate.id === args.actionId);
          return textResult(`"${action?.title ?? "Action"}" is now ${action?.status ?? args.status}.`, { status: "ok", plan: result.plan });
        },
        { fallback: "Could not update the action" }
      )
  );
}
