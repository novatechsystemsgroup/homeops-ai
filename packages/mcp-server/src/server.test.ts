import { beforeEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { HomeOpsService } from "@homeops/agent-core";
import { tmpdir } from "node:os";
import {
  DEMO_HOUSEHOLD,
  createDatabase,
  createEvidenceRepository,
  createHouseholdStore,
  createMaintenanceRepository,
  createPlanRepository,
  createTraceRepository,
  seedDemoHousehold
} from "@homeops/persistence";
import { BOILER_DESCRIPTION, createFakeModelProvider, createFakeSearchProvider } from "@homeops/test-fixtures";
import { buildMcpServer } from "./server";
import { TOOL_NAMES } from "./registry";

let counter = 0;
const ids = { uuid: () => `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}` };
const clock = { now: () => new Date("2026-10-07T10:00:00.000Z") };

function createService(): HomeOpsService {
  const handle = createDatabase(":memory:");
  const households = createHouseholdStore(handle);
  const plans = createPlanRepository(handle);
  const maintenance = createMaintenanceRepository(handle);
  const evidence = createEvidenceRepository(handle, tmpdir());
  const trace = createTraceRepository(handle, ids, clock);
  void seedDemoHousehold(households, clock.now().toISOString());
  return new HomeOpsService({
    model: createFakeModelProvider(),
    search: createFakeSearchProvider(),
    plans,
    households,
    maintenance,
    evidence,
    trace,
    clock,
    ids,
    config: {
      searchEnabled: true,
      maxClarifyingQuestions: 2,
      modelTimeoutMs: 2000,
      searchTimeoutMs: 2000,
      fallbackHouseholdId: DEMO_HOUSEHOLD.id,
      searchResultLimit: 5
    }
  });
}

function firstActionId(plan: { actions: Array<{ id: string }> }): string {
  const action = plan.actions[0];
  if (!action) throw new Error("expected the plan to contain at least one action");
  return action.id;
}

async function connect() {
  const server = buildMcpServer(createService(), { version: "test" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "homeops-test", version: "0.0.0" });
  await client.connect(clientTransport);
  return client;
}

describe("MCP surface", () => {
  let client: Client;
  beforeEach(async () => {
    client = await connect();
  });

  it("discovers exactly the six household tools", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([...TOOL_NAMES].sort());
    expect(TOOL_NAMES).toContain("get_maintenance_due");
    expect(TOOL_NAMES).toContain("complete_maintenance_task");
    for (const tool of tools) expect(tool.description && tool.description.length).toBeGreaterThan(20);
  });

  it("builds a plan through the tool contract", async () => {
    const result = await client.callTool({ name: "build_repair_plan", arguments: { description: BOILER_DESCRIPTION } });
    const structured = result.structuredContent as { plan: { urgency: string; actions: unknown[] } };
    expect(structured.plan.urgency).toBe("needs_attention");
    expect(structured.plan.actions.length).toBeGreaterThan(0);
  });

  it("answers a gas emergency with deterministic guidance", async () => {
    const result = await client.callTool({ name: "get_safety_guidance", arguments: { description: "There is a smell of gas by the boiler." } });
    const structured = result.structuredContent as { assessment: { urgency: string; callEmergencyServices: boolean } };
    expect(structured.assessment.urgency).toBe("emergency");
    expect(structured.assessment.callEmergencyServices).toBe(true);
  });

  it("refuses a state change without explicit confirmation", async () => {
    const planResult = await client.callTool({ name: "build_repair_plan", arguments: { description: BOILER_DESCRIPTION } });
    const plan = (planResult.structuredContent as { plan: { id: string; actions: Array<{ id: string }> } }).plan;
    const result = await client.callTool({
      name: "assign_household_task",
      arguments: { planId: plan.id, actionId: firstActionId(plan), ownerMemberId: DEMO_HOUSEHOLD.members[0].id, confirm: false }
    });
    const structured = result.structuredContent as { status: string; proposedChanges: string[] };
    expect(structured.status).toBe("confirmation_required");
    expect(structured.proposedChanges.length).toBeGreaterThan(0);
  });

  it("assigns an action when the user confirms", async () => {
    const planResult = await client.callTool({ name: "build_repair_plan", arguments: { description: BOILER_DESCRIPTION } });
    const plan = (planResult.structuredContent as { plan: { id: string; actions: Array<{ id: string }> } }).plan;
    await client.callTool({
      name: "assign_household_task",
      arguments: { planId: plan.id, actionId: firstActionId(plan), ownerMemberId: DEMO_HOUSEHOLD.members[1].id, confirm: true }
    });
    const status = await client.callTool({ name: "get_plan_status", arguments: { planId: plan.id } });
    const structured = status.structuredContent as { plan: { actions: Array<{ ownerLabel: string; status: string }> } };
    const assigned = structured.plan.actions[0];
    expect(assigned?.ownerLabel).toBe(DEMO_HOUSEHOLD.members[1].displayName);
    expect(assigned?.status).toBe("assigned");
  });
});
