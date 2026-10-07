import { Hono } from "hono";
import { CompleteMaintenanceRequestSchema, CreateMaintenanceTaskSchema } from "@homeops/contracts";
import { DomainError } from "@homeops/agent-core";
import { problemResponse, validationDetail } from "../http/errors";
import type { Container } from "../container";

export function maintenanceRoutes(container: Container): Hono {
  const app = new Hono();

  app.get("/", async (c) => {
    const householdId = c.req.query("householdId");
    if (!householdId) {
      return problemResponse(c, { status: 400, code: "invalid_request", detail: "householdId query parameter is required." });
    }
    try {
      const tasks = await container.service.listMaintenance(householdId);
      return c.json({ householdId, tasks });
    } catch (error) {
      if (error instanceof DomainError) return problemResponse(c, { status: error.httpStatus, code: error.code, detail: error.message });
      throw error;
    }
  });

  app.post("/", async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = CreateMaintenanceTaskSchema.safeParse(raw);
    if (!parsed.success) {
      return problemResponse(c, { status: 400, code: "invalid_request", detail: validationDetail(parsed.error.issues) });
    }
    try {
      const task = await container.service.createMaintenance(parsed.data);
      return c.json({ task }, 201);
    } catch (error) {
      if (error instanceof DomainError) return problemResponse(c, { status: error.httpStatus, code: error.code, detail: error.message });
      throw error;
    }
  });

  app.post("/:taskId/complete", async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = CompleteMaintenanceRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return problemResponse(c, { status: 400, code: "invalid_request", detail: validationDetail(parsed.error.issues) });
    }
    const result = await container.service.completeMaintenance(c.req.param("taskId"), parsed.data.confirm);
    if (result.kind === "not_found") return problemResponse(c, { status: 404, code: "not_found", detail: result.message });
    if (result.kind === "confirmation_required") {
      return c.json({ status: "confirmation_required", message: result.message, proposedChanges: result.proposedChanges }, 200);
    }
    return c.json({ status: "ok", task: result.task }, 200);
  });

  app.delete("/:taskId", async (c) => {
    const deleted = await container.service.deleteMaintenance(c.req.param("taskId"));
    if (!deleted) return problemResponse(c, { status: 404, code: "not_found", detail: "Maintenance task not found." });
    return c.json({ deleted: true });
  });

  return app;
}
