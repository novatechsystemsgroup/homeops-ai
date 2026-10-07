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

  it("allows the web app origin through CORS and refuses unknown origins", async () => {
    const allowed = await app.request("/api/plans", {
      method: "OPTIONS",
      headers: { origin: "http://localhost:3000", "access-control-request-method": "POST" }
    });
    expect(allowed.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");

    const refused = await app.request("/api/plans", {
      method: "OPTIONS",
      headers: { origin: "https://evil.example", "access-control-request-method": "POST" }
    });
    expect(refused.headers.get("access-control-allow-origin")).toBeNull();
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

  it("seeds recurring home upkeep and moves the next due date when a task is completed", async () => {
    const household = (await (await app.request("/api/households/demo")).json()) as { id: string };

    const listed = await app.request(`/api/maintenance?householdId=${household.id}`);
    expect(listed.status).toBe(200);
    const { tasks } = (await listed.json()) as { tasks: Array<{ id: string; title: string; state: string; nextDueAt: string }> };
    expect(tasks.length).toBeGreaterThanOrEqual(3);
    expect(tasks[0]?.state).toBe("overdue");

    const task = tasks[0]!;
    const blocked = await app.request(`/api/maintenance/${task.id}/complete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirm: false })
    });
    expect(blocked.status).toBe(200);
    const blockedBody = (await blocked.json()) as { status: string; proposedChanges: string[] };
    expect(blockedBody.status).toBe("confirmation_required");
    expect(blockedBody.proposedChanges.join(" ")).toMatch(/next due/);

    const applied = await app.request(`/api/maintenance/${task.id}/complete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirm: true })
    });
    const appliedBody = (await applied.json()) as { status: string; task: { state: string; nextDueAt: string } };
    expect(appliedBody.status).toBe("ok");
    expect(appliedBody.task.state).not.toBe("overdue");
    expect(appliedBody.task.nextDueAt > task.nextDueAt).toBe(true);
  });

  it("accepts a photo as repair evidence, serves the bytes back and deletes it", async () => {
    const household = (await (await app.request("/api/households/demo")).json()) as { id: string };
    const created = await app.request("/api/plans", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ householdId: household.id, description: BOILER_DESCRIPTION })
    });
    const { plan } = (await created.json()) as { plan: { id: string; actions: Array<{ id: string }> } };
    const action = firstAction(plan);

    // A tiny PNG: the multipart path is what the browser uses.
    const png = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
    const form = new FormData();
    form.set("kind", "photo");
    form.set("actionId", action.id);
    form.set("note", "Photo of the cabinet before the visit");
    form.set("file", new File([new Uint8Array(png)], "cabinet.png", { type: "image/png" }));

    const uploaded = await app.request(`/api/evidence/plan/${plan.id}`, { method: "POST", body: form });
    expect(uploaded.status).toBe(201);
    const { evidence } = (await uploaded.json()) as { evidence: { id: string; url: string; kind: string; byteSize: number } };
    expect(evidence.kind).toBe("photo");
    expect(evidence.byteSize).toBe(png.length);

    const listed = await app.request(`/api/evidence/plan/${plan.id}`);
    const listedBody = (await listed.json()) as { evidence: Array<{ id: string }> };
    expect(listedBody.evidence).toHaveLength(1);

    const bytes = await app.request(`/api/evidence/${evidence.id}`);
    expect(bytes.status).toBe(200);
    expect(bytes.headers.get("content-type")).toBe("image/png");
    expect(Buffer.from(await bytes.arrayBuffer()).equals(png)).toBe(true);

    const removed = await app.request(`/api/evidence/${evidence.id}`, { method: "DELETE" });
    expect(removed.status).toBe(200);
    expect((await app.request(`/api/evidence/${evidence.id}`)).status).toBe(404);
  });

  it("refuses an attachment with a kind that does not match the file", async () => {
    const household = (await (await app.request("/api/households/demo")).json()) as { id: string };
    const created = await app.request("/api/plans", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ householdId: household.id, description: BOILER_DESCRIPTION })
    });
    const { plan } = (await created.json()) as { plan: { id: string } };

    const form = new FormData();
    form.set("kind", "voice_note");
    form.set("file", new File([new Uint8Array(Buffer.from("89504e47", "hex"))], "sound.png", { type: "image/png" }));

    const response = await app.request(`/api/evidence/plan/${plan.id}`, { method: "POST", body: form });
    expect(response.status).toBe(400);
    const problem = (await response.json()) as { detail: string };
    expect(problem.detail).toMatch(/must be uploaded as/i);
  });

  it("deletes demo data including trace events", async () => {
    const household = (await (await app.request("/api/households/demo")).json()) as { id: string };
    const response = await app.request(`/api/households/${household.id}`, { method: "DELETE" });
    expect(response.status).toBe(200);
    expect(await container.households.getHousehold(household.id)).toBeNull();
  });
});
