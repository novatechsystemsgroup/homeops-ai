import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CompleteMaintenanceTaskInputSchema, CompleteMaintenanceTaskOutputSchema } from "@homeops/contracts";
import type { HomeOpsService } from "@homeops/agent-core";
import { errorResult, textResult, withToolErrors } from "./helpers";

export function registerCompleteMaintenanceTask(server: McpServer, service: HomeOpsService): void {
  server.registerTool(
    "complete_maintenance_task",
    {
      title: "Mark recurring home upkeep as done",
      description:
        "Records that a recurring task was completed today and moves the next due date forward by its cadence. This changes state, so it only proceeds with confirm=true.",
      inputSchema: CompleteMaintenanceTaskInputSchema,
      outputSchema: CompleteMaintenanceTaskOutputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
    },
    async (args) =>
      withToolErrors(
        async () => {
          const result = await service.completeMaintenance(args.taskId, args.confirm);
          if (result.kind === "not_found") return errorResult(result.message);
          if (result.kind === "confirmation_required") {
            return textResult(result.message, {
              status: "confirmation_required",
              message: result.message,
              proposedChanges: result.proposedChanges
            });
          }
          const task = result.task;
          return textResult(`${task.title} marked as done. Next due ${task.nextDueAt.slice(0, 10)}.`, { status: "ok", task });
        },
        { fallback: "Could not complete the maintenance task" }
      )
  );
}
