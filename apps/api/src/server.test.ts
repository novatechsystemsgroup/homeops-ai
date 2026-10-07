import { beforeEach, describe, expect, it } from "vitest";
import { loadServerConfig } from "./config";
import { createContainer, type Container } from "./container";
import { createLogger } from "./http/logger";
import { createApp } from "./server";
import { BOILER_DESCRIPTION } from "@homeops/test-fixtures";

function firstAction<T extends { id: string }>(plan: { actions: T[] }): T {
  const action = plan.actions[0];
  if (!action) throw new Error("expected the plan to contain at least one action");
  return action;
}

function firstMember<T extends { id: string }>(household: { members: T[] }): T {
  const member = household.members[0];
  if (!member) throw new Error("expected the demo household to contain at least one member");
  return member;
}

function createTestContainer(): Container {
  const config = loadServerConfig(
    {
      NODE_ENV: "test",
      MODEL_PROVIDER: "fake",
      SEARCH_PROVIDER: "fake",
      DB_PATH: ":memory:",
      LOG_LEVEL: "silent",
      SEARCH_ENABLED: "true"
    } as NodeJS.ProcessEnv,
    process.cwd()
  );
  return createContainer(config, createLogger("silent"));
}

describe("REST surface", () => {
  let container: Container;
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    container = createTestContainer();
    await container.ensureDemoHousehold();
    app = createApp(container);
  });

  it("answers the health probe with the active providers", async () => {
    const response = await app.request("/healthz");
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean; providers: { model: string } };
    expect(body.ok).toBe(true);
    expect(body.providers.model).toBe("fake");
  });

  it("creates a plan for the boiler scenario", async () => {
    const householdResponse = await app.request("/api/households/demo");
    const household = (await householdResponse.json()) as { id: string };

    const response = await app.request("/api/plans", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ householdId: household.id, description: BOILER_DESCRIPTION })
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as { plan: { id: string; urgency: string; actions: unknown[]; researchStatus: string }; trace: unknown[] };
    expect(body.plan.urgency).toBe("needs_attention");
    expect(body.plan.actions.length).toBeGreaterThan(0);
    expect(body.plan.researchStatus).toBe("ok");
    expect(body.trace.length).toBeGreaterThan(3);

    const envelope = await app.request(`/api/plans/${body.plan.id}`);
    expect(envelope.status).toBe(200);
  });

  it("rejects an invalid payload with a problem+json document, never a stack trace", async () => {
    const response = await app.request("/api/plans", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ description: "hi" })
    });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { code: string; detail: string };
    expect(body.code).toBe("invalid_request");
    expect(body.detail).not.toContain("at ");
  });

  it("requires confirmation before assigning an action", async () => {
    const household = (await (await app.request("/api/households/demo")).json()) as { id: string; members: Array<{ id: string }> };
    const created = (await (
      await app.request("/api/plans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ householdId: household.id, description: BOILER_DESCRIPTION })
      })
    ).json()) as { plan: { id: string; actions: Array<{ id: string }> } };

    const action = firstAction(created.plan);
    const blocked = await app.request(`/api/plans/${created.plan.id}/actions/${action.id}/assign`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ownerMemberId: firstMember(household).id, confirm: false })
    });
    expect(((await blocked.json()) as { status: string }).status).toBe("confirmation_required");

    const allowed = await app.request(`/api/plans/${created.plan.id}/actions/${action.id}/assign`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ownerMemberId: firstMember(household).id, confirm: true })
    });
    const body = (await allowed.json()) as { status: string; plan: { actions: Array<{ status: string }> } };
    expect(body.status).toBe("ok");
    expect(body.plan.actions[0]?.status).toBe("assigned");
  });

  it("deletes demo data including trace events", async () => {
    const household = (await (await app.request("/api/households/demo")).json()) as { id: string };
    const response = await app.request(`/api/households/${household.id}`, { method: "DELETE" });
    expect(response.status).toBe(200);
    expect(await container.households.getHousehold(household.id)).toBeNull();
  });
});
