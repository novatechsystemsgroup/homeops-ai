import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SearchServiceOptionsInputSchema, SearchServiceOptionsOutputSchema } from "@homeops/contracts";
import type { HomeOpsService } from "@homeops/agent-core";
import { textResult, withToolErrors } from "./helpers";

export function registerSearchServiceOptions(server: McpServer, service: HomeOpsService): void {
  server.registerTool(
    "search_service_options",
    {
      title: "Find current options or guidance for a household problem",
      description:
        "Runtime research through Tavily. Returns public sources with their URLs and retrieval time. It never invents prices or availability, and it must not be used for emergencies.",
      inputSchema: SearchServiceOptionsInputSchema,
      outputSchema: SearchServiceOptionsOutputSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true }
    },
    async (args) =>
      withToolErrors(
        async () => {
          const { sources, researchStatus } = await service.searchOptions(args.query, args.location ?? null, args.limit ?? 5);
          const summary =
            sources.length > 0
              ? `${sources.length} source(s): ${sources.map((source) => source.title).join(" | ")}`
              : "No usable sources were found for this query.";
          return textResult(summary, { sources, researchStatus });
        },
        { fallback: "Search failed" }
      )
  );
}
