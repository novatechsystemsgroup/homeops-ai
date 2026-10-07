import { Hono } from "hono";
import { problemResponse } from "../http/errors";
import type { Container } from "../container";

export function householdsRoutes(container: Container): Hono {
  const app = new Hono();

  app.get("/", async (c) => {
    const households = await container.households.listHouseholds();
    return c.json({ households });
  });

  // The web demo always starts from the synthetic household; this seeds it on first use.
  app.get("/demo", async (c) => {
    const household = await container.ensureDemoHousehold();
    return c.json(household);
  });

  app.post("/demo", async (c) => {
    const household = await container.ensureDemoHousehold();
    return c.json(household, 201);
  });

  app.get("/:householdId", async (c) => {
    const household = await container.households.getHousehold(c.req.param("householdId"));
    if (!household) return problemResponse(c, { status: 404, code: "household_not_found", detail: "No household exists with that id." });
    return c.json(household);
  });

  app.delete("/:householdId", async (c) => {
    const deleted = await container.households.deleteHousehold(c.req.param("householdId"));
    if (!deleted) return problemResponse(c, { status: 404, code: "household_not_found", detail: "No household exists with that id." });
    return c.json({ deleted: true, householdId: c.req.param("householdId") });
  });

  return app;
}
