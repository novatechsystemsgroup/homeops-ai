import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AssignHouseholdTaskInputSchema, AssignHouseholdTaskOutputSchema } from "@homeops/contracts";
import type { HomeOpsService } from "@homeops/agent-core";
import { errorResult, textResult, withToolErrors } from "./helpers";

export function registerAssignHouseholdTask(server: McpServer, service: HomeOpsService): void {
  server.registerTool(
    "assign_household_task",
    {
      title: "Assign a plan action to a household member",
      description:
        "Assigns one action of an existing plan to a household member. This changes state, so it only proceeds with confirm=true; without it the tool returns the proposed change for the user to approve.",
      inputSchema: AssignHouseholdTaskInputSchema,
      outputSchema: AssignHouseholdTaskOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (args) =>
      withToolErrors(
        async () => {
          const result = await service.assignAction({
            planId: args.planId,
            actionId: args.actionId,
            ownerMemberId: args.ownerMemberId,
            confirm: args.confirm
          });

          if (result.kind === "not_found") return errorResult(result.message);
          if (result.kind === "confirmation_required") {
            return textResult(result.message, { status: "confirmation_required", message: result.message, proposedChanges: result.proposedChanges });
          }
          const action = result.plan.actions.find((candidate) => candidate.id === args.actionId);
          return textResult(`Assigned "${action?.title ?? "action"}" to ${action?.ownerLabel ?? "the household"}.`, { status: "ok", plan: result.plan });
        },
        { fallback: "Could not assign the task" }
      )
  );
}
