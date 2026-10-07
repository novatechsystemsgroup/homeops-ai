import { createServer } from "node:http";
import { getRequestListener } from "@hono/node-server";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createApp } from "@homeops/api/server";
import { createContainer } from "@homeops/api/container";
import { loadRepoEnv, loadServerConfig } from "@homeops/api/config";
import { createLogger } from "@homeops/api";
import { createMcpHandler } from "@homeops/api/mcp/mount";
import { BOILER_DESCRIPTION } from "@homeops/test-fixtures";
import { heading, repoRoot } from "./lib/env";

function check(condition: boolean, message: string): void {
  console.log(`  ${condition ? "PASS" : "FAIL"} — ${message}`);
  if (!condition) throw new Error(`check failed: ${message}`);
}

interface PlanShape {
  id: string;
  urgency: string;
  actions: Array<{ id: string; title: string }>;
}

loadRepoEnv(repoRoot);
const config = loadServerConfig({ ...process.env, PORT: "0", LOG_LEVEL: "silent" } as NodeJS.ProcessEnv, repoRoot);
const container = createContainer(config, createLogger("silent"));
await container.ensureDemoHousehold();

const app = createApp(container);
const mcpHandler = createMcpHandler(container);
const listener = getRequestListener(app.fetch);
const server = createServer((req, res) => {
  const url = req.url ?? "/";
  if (url === "/mcp" || url.startsWith("/mcp?")) {
    void mcpHandler(req, res);
    return;
  }
  void listener(req, res);
});

await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const port = typeof address === "object" && address ? address.port : 0;
const mcpUrl = `http://127.0.0.1:${port}/mcp`;

async function run(): Promise<void> {
  console.log(`MCP smoke test against ${mcpUrl} (bearer token required)`);

  heading("1. Unauthorized access is rejected");
  const unauthorized = await fetch(mcpUrl, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "smoke", version: "0" } }
    })
  });
  check(unauthorized.status === 401, `POST /mcp without a bearer token returns 401 (got ${unauthorized.status})`);

  heading("2. Tool discovery");
  const transport = new StreamableHTTPClientTransport(new URL(mcpUrl), {
    requestInit: { headers: { authorization: `Bearer ${config.MCP_AUTH_TOKEN}` } }
  });
  const client = new Client({ name: "homeops-smoke", version: "0.1.0" });
  await client.connect(transport);

  const tools = await client.listTools();
  const names = tools.tools.map((tool) => tool.name);
  check(tools.tools.length === 8, `eight tools discovered: ${names.join(", ")}`);
  check(
    names.includes("get_maintenance_due") && names.includes("complete_maintenance_task"),
    "the upkeep tools are exposed for voice clients"
  );

  heading("3. build_repair_plan");
  const planResult = await client.callTool({ name: "build_repair_plan", arguments: { description: BOILER_DESCRIPTION } });
  const plan = (planResult.structuredContent as { plan?: PlanShape } | undefined)?.plan;
  if (!plan) throw new Error("the tool returned no plan");
  check(plan.urgency === "needs_attention", `urgency is needs_attention (got ${plan.urgency})`);
  const actionId = plan.actions[0]?.id;
  if (!actionId) throw new Error("the plan contains no actions");
  check(plan.actions.length > 0, `plan contains ${plan.actions.length} action(s)`);

  heading("4. State changes require confirmation");
  const blocked = await client.callTool({
    name: "assign_household_task",
    arguments: { planId: plan.id, actionId, ownerMemberId: "1a2b3c4d-1111-4a2b-9c3d-000000000002", confirm: false }
  });
  const blockedContent = blocked.structuredContent as { status?: string; proposedChanges?: string[] } | undefined;
  check(blockedContent?.status === "confirmation_required", "assign without confirm returns confirmation_required");
  check((blockedContent?.proposedChanges ?? []).length > 0, "the proposed change is explained to the caller");

  heading("5. Confirmed assignment and status read-back");
  const applied = await client.callTool({
    name: "assign_household_task",
    arguments: { planId: plan.id, actionId, ownerMemberId: "1a2b3c4d-1111-4a2b-9c3d-000000000002", confirm: true }
  });
  check((applied.structuredContent as { status?: string } | undefined)?.status === "ok", "assign with confirm changes the plan");

  const status = await client.callTool({ name: "get_plan_status", arguments: { planId: plan.id } });
  const openActions = (status.structuredContent as { openActions?: unknown[] } | undefined)?.openActions ?? [];
  check(openActions.length > 0, `plan status returns ${openActions.length} open action(s)`);

  await client.close();
}

let exitCode = 0;
try {
  await run();
  console.log("\nMCP SMOKE TEST PASSED");
} catch (error) {
  console.error(`\nMCP SMOKE TEST FAILED: ${error instanceof Error ? error.message : String(error)}`);
  exitCode = 1;
}

await new Promise<void>((resolve) => server.close(() => resolve()));
container.close();
process.exit(exitCode);
