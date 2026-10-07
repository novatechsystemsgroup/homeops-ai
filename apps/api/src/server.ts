import { Hono } from "hono";
import { cors } from "hono/cors";
import { ZodError } from "zod";
import { DomainError } from "@homeops/agent-core";
import type { ApiMeta } from "@homeops/contracts";
import { APP_VERSION, type Container } from "./container";
import { domainErrorResponse, problemResponse, validationDetail } from "./http/errors";
import { householdsRoutes } from "./routes/households";
import { plansRoutes } from "./routes/plans";

export { createLogger } from "./http/logger";
export type { Logger } from "./http/logger";

export function createApp(container: Container): Hono {
  const app = new Hono();

  app.use("*", async (c, next) => {
    const started = Date.now();
    await next();
    container.logger.info(
      { method: c.req.method, path: c.req.path, status: c.res.status, durationMs: Date.now() - started },
      "request"
    );
  });

  // The web app runs on a different port, so the browser needs CORS on the API.
  app.use(
    "/api/*",
    cors({
      origin: (origin) => (container.config.corsOrigins.includes(origin) ? origin : undefined),
      allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
      allowHeaders: ["content-type", "idempotency-key"],
      maxAge: 600
    })
  );

  app.get("/healthz", (c) =>
    c.json({
      ok: true,
      service: "homeops-ai",
      version: APP_VERSION,
      providers: { model: container.model.name, search: container.search.name }
    })
  );

  app.get("/api/meta", (c) => {
    const meta: ApiMeta = {
      version: APP_VERSION,
      modelProvider: container.model.name,
      model: container.model.planModel,
      searchProvider: container.search.name,
      startedAt: container.startedAt
    };
    return c.json({ ...meta, searchDescription: container.search.description, degradedProviders: container.config.degradedProviders });
  });

  app.route("/api/plans", plansRoutes(container));
  app.route("/api/households", householdsRoutes(container));

  app.notFound((c) => problemResponse(c, { status: 404, code: "not_found", detail: `No route for ${c.req.method} ${c.req.path}.` }));

  app.onError((error, c) => {
    if (error instanceof DomainError) return domainErrorResponse(c, error);
    if (error instanceof ZodError) return problemResponse(c, { status: 400, code: "invalid_request", detail: validationDetail(error.issues) });
    container.logger.error({ err: error instanceof Error ? error.message : String(error) }, "unhandled error");
    return problemResponse(c, { status: 500, code: "internal_error", detail: "Unexpected error. Check the server logs." });
  });

  return app;
}
