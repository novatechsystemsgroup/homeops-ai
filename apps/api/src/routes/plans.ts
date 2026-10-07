import { Hono } from "hono";
import { ZodError } from "zod";
import { AssignActionRequestSchema, CreatePlanRequestSchema, UpdateActionStatusRequestSchema } from "@homeops/contracts";
import { problemResponse, validationDetail } from "../http/errors";
import type { Container } from "../container";

export function plansRoutes(container: Container): Hono {
  const app = new Hono();
  // Idempotency keys are kept in memory: a demo instance does not need more.
  const idempotency = new Map<string, string>();

  app.post("/", async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = CreatePlanRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return problemResponse(c, { status: 400, code: "invalid_request", detail: validationDetail(parsed.error.issues) });
    }

    const key = c.req.header("idempotency-key");
    const cachedPlanId = key ? idempotency.get(key) : undefined;
    if (cachedPlanId) {
      const envelope = await container.service.getPlanEnvelope(cachedPlanId);
      if (envelope) return c.json({ plan: envelope.plan, trace: envelope.trace, clarificationRequired: envelope.plan.clarifyingQuestions.length > 0 }, 200);
    }

    try {
      const result = await container.service.createPlan(parsed.data);
      if (key) idempotency.set(key, result.plan.id);
      return c.json(result, 201);
    } catch (error) {
      if (error instanceof ZodError) {
        return problemResponse(c, { status: 400, code: "invalid_request", detail: validationDetail(error.issues) });
      }
      throw error;
    }
  });

  app.get("/:planId", async (c) => {
    const envelope = await container.service.getPlanEnvelope(c.req.param("planId"));
    if (!envelope) return problemResponse(c, { status: 404, code: "plan_not_found", detail: "No plan exists with that id." });
    return c.json(envelope);
  });

  app.post("/:planId/actions/:actionId/assign", async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = AssignActionRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return problemResponse(c, { status: 400, code: "invalid_request", detail: validationDetail(parsed.error.issues) });
    }

    const result = await container.service.assignAction({
      planId: c.req.param("planId"),
      actionId: c.req.param("actionId"),
      ownerMemberId: parsed.data.ownerMemberId,
      confirm: parsed.data.confirm
    });

    if (result.kind === "not_found") return problemResponse(c, { status: 404, code: "not_found", detail: result.message });
    if (result.kind === "confirmation_required") {
      return c.json({ status: "confirmation_required", message: result.message, proposedChanges: result.proposedChanges }, 200);
    }
    return c.json({ status: "ok", plan: result.plan }, 200);
  });

  app.post("/:planId/actions/:actionId/status", async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = UpdateActionStatusRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return problemResponse(c, { status: 400, code: "invalid_request", detail: validationDetail(parsed.error.issues) });
    }

    const result = await container.service.updateActionStatus({
      planId: c.req.param("planId"),
      actionId: c.req.param("actionId"),
      status: parsed.data.status,
      confirm: parsed.data.confirm
    });

    if (result.kind === "not_found") return problemResponse(c, { status: 404, code: "not_found", detail: result.message });
    if (result.kind === "confirmation_required") {
      return c.json({ status: "confirmation_required", message: result.message, proposedChanges: result.proposedChanges }, 200);
    }
    return c.json({ status: "ok", plan: result.plan }, 200);
  });

  return app;
}
