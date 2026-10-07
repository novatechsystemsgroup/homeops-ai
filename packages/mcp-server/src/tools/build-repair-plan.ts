import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { BuildRepairPlanInputSchema, BuildRepairPlanOutputSchema } from "@homeops/contracts";
import type { HomeOpsService } from "@homeops/agent-core";
import { textResult, withToolErrors } from "./helpers";

export function registerBuildRepairPlan(server: McpServer, service: HomeOpsService): void {
  server.registerTool(
    "build_repair_plan",
    {
      title: "Build a household repair plan",
      description:
        "Turn a household maintenance report into an executable plan: urgency, ordered actions with owners and deadlines, safety guidance and cited sources. Read-only: it plans, it does not act.",
      inputSchema: BuildRepairPlanInputSchema,
      outputSchema: BuildRepairPlanOutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true }
    },
    async (args) =>
      withToolErrors(
        async () => {
          const { plan, clarificationRequired } = await service.createPlan({
            householdId: args.householdId ?? null,
            description: args.description,
            deadline: args.deadline ?? null,
            clarificationAnswers: args.clarificationAnswers ?? []
          });

          const summary = clarificationRequired
            ? `Two quick questions before the plan: ${plan.clarifyingQuestions.join(" / ")}`
            : `${plan.issueSummary} (urgency: ${plan.urgency}, ${plan.actions.length} actions${plan.sources.length ? `, ${plan.sources.length} sources` : ""}).`;

          return textResult(summary, { plan, clarificationRequired });
        },
        { fallback: "Could not build a plan" }
      )
  );
}
