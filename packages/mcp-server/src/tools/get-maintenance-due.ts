import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GetMaintenanceDueInputSchema, GetMaintenanceDueOutputSchema } from "@homeops/contracts";
import type { HomeOpsService } from "@homeops/agent-core";
import { textResult, withToolErrors } from "./helpers";

function describeDue(tasks: Array<{ title: string; state: string; daysUntilDue: number }>): string {
  if (tasks.length === 0) return "Nothing needs doing around the house right now.";
  const parts = tasks.map((task) => {
    if (task.state === "overdue") return `${task.title} (overdue by ${Math.abs(task.daysUntilDue)} days)`;
    if (task.daysUntilDue === 0) return `${task.title} (due today)`;
    return `${task.title} (due in ${task.daysUntilDue} days)`;
  });
  return `${parts.length} thing${parts.length === 1 ? "" : "s"} to do: ${parts.join("; ")}.`;
}

export function registerGetMaintenanceDue(server: McpServer, service: HomeOpsService): void {
  server.registerTool(
    "get_maintenance_due",
    {
      title: "List home upkeep that is due",
      description:
        "Returns the recurring home upkeep that is overdue or due in the next fortnight: smoke alarm tests, boiler services, seasonal jobs. Read-only.",
      inputSchema: GetMaintenanceDueInputSchema,
      outputSchema: GetMaintenanceDueOutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async (args) =>
      withToolErrors(
        async () => {
          const householdId = args.householdId ?? null;
          const tasks = args.includeScheduled
            ? await service.listMaintenance(householdId)
            : await service.maintenanceDue(householdId);
          const spokenSummary = describeDue(tasks);
          return textResult(spokenSummary, { tasks, spokenSummary });
        },
        { fallback: "Could not read the home upkeep list" }
      )
  );
}
