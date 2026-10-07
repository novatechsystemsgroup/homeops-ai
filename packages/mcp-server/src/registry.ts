import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HomeOpsService } from "@homeops/agent-core";
import { registerAssignHouseholdTask } from "./tools/assign-household-task";
import { registerBuildRepairPlan } from "./tools/build-repair-plan";
import { registerGetPlanStatus } from "./tools/get-plan-status";
import { registerGetSafetyGuidance } from "./tools/get-safety-guidance";
import { registerSearchServiceOptions } from "./tools/search-service-options";
import { registerUpdateActionStatus } from "./tools/update-action-status";

/** Tool names are the public contract with Alexa+ style clients. */
export const TOOL_NAMES = [
  "build_repair_plan",
  "get_safety_guidance",
  "search_service_options",
  "assign_household_task",
  "get_plan_status",
  "update_action_status"
] as const;

export function registerTools(server: McpServer, service: HomeOpsService): void {
  registerBuildRepairPlan(server, service);
  registerGetSafetyGuidance(server, service);
  registerSearchServiceOptions(server, service);
  registerAssignHouseholdTask(server, service);
  registerGetPlanStatus(server, service);
  registerUpdateActionStatus(server, service);
}
