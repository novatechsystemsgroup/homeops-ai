import { Hono } from "hono";
import { SafetyGuidanceRequestSchema } from "@homeops/contracts";
import { problemResponse, validationDetail } from "../http/errors";
import type { Container } from "../container";

/**
 * Deterministic triage, available before planning. The web app calls this first so
 * the safety state is on screen immediately instead of after the model answers.
 */
export function safetyRoutes(container: Container): Hono {
  const app = new Hono();

  app.post("/", async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = SafetyGuidanceRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return problemResponse(c, { status: 400, code: "invalid_request", detail: validationDetail(parsed.error.issues) });
    }
    return c.json({ assessment: container.service.getSafetyGuidance(parsed.data.description) });
  });

  return app;
}
