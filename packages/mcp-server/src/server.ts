import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HomeOpsService } from "@homeops/agent-core";
import { registerTools } from "./registry";

export interface McpServerOptions {
  version?: string;
}

/**
 * MCP surface of HomeOps AI. It exposes high-level household operations (not
 * raw CRUD), which is what Alexa+ style assistants can actually orchestrate.
 */
export function buildMcpServer(service: HomeOpsService, options: McpServerOptions = {}): McpServer {
  const server = new McpServer(
    { name: "homeops-ai", version: options.version ?? "0.1.0" },
    {
      instructions:
        "HomeOps AI coordinates household operations. Start with build_repair_plan for a reported problem; use get_safety_guidance when danger is possible; use search_service_options for current public sources; assign_household_task and update_action_status change state and always need explicit user confirmation."
    }
  );
  registerTools(server, service);
  return server;
}
