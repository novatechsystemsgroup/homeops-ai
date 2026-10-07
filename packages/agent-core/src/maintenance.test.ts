import { describe, expect, it } from "vitest";
import type { MaintenanceTask } from "@homeops/contracts";
import { addMonths, buildStarterMaintenance, dueOrSoon, nextDueFrom, sortByUrgency, viewOf } from "./maintenance";

const HOUSEHOLD = "0f5c9a52-4a1e-4c1b-9a53-2f8f6d1a7b31";

function task(overrides: Partial<MaintenanceTask>): MaintenanceTask {
  return {
    id: "b1a7c0de-0001-4a11-9c01-00000000000a",
    householdId: HOUSEHOLD,
    title: "Test task",
    instructions: "",
    category: "other",
    cadence: "annual",
    nextDueAt: "2026-10-07T09:00:00.000Z",
    lastCompletedAt: null,
    sourcePlanId: null,
    createdAt: "2026-10-07T09:00:00.000Z",
    ...overrides
  };
}

describe("cadence arithmetic", () => {
  it("adds whole months", () => {
    expect(addMonths("2026-01-15T10:00:00.000Z", 3).slice(0, 10)).toBe("2026-04-15");
    expect(nextDueFrom("monthly", "2026-01-15T10:00:00.000Z").slice(0, 10)).toBe("2026-02-15");
    expect(nextDueFrom("annual", "2026-01-15T10:00:00.000Z").slice(0, 10)).toBe("2027-01-15");
  });

  it("clamps month ends instead of rolling into the next month", () => {
    expect(addMonths("2026-01-31T10:00:00.000Z", 1).slice(0, 10)).toBe("2026-02-28");
    expect(addMonths("2024-01-31T10:00:00.000Z", 1).slice(0, 10)).toBe("2024-02-29");
    expect(addMonths("2026-08-31T10:00:00.000Z", 6).slice(0, 10)).toBe("2027-02-28");
  });
});

describe("due states", () => {
  const now = new Date("2026-10-07T09:00:00.000Z");

  it("marks a past date as overdue", () => {
    const view = viewOf(task({ nextDueAt: "2026-10-01T09:00:00.000Z" }), now);
    expect(view.state).toBe("overdue");
    expect(view.daysUntilDue).toBeLessThan(0);
  });

  it("marks the next fortnight as due soon", () => {
    expect(viewOf(task({ nextDueAt: "2026-10-18T09:00:00.000Z" }), now).state).toBe("due_soon");
  });

  it("keeps anything further out scheduled", () => {
    expect(viewOf(task({ nextDueAt: "2026-12-01T09:00:00.000Z" }), now).state).toBe("scheduled");
  });

  it("sorts overdue first and filters out the comfortable ones", () => {
    const views = [
      viewOf(task({ id: "b1a7c0de-0001-4a11-9c01-000000000001", nextDueAt: "2026-12-01T09:00:00.000Z" }), now),
      viewOf(task({ id: "b1a7c0de-0001-4a11-9c01-000000000002", nextDueAt: "2026-10-01T09:00:00.000Z" }), now),
      viewOf(task({ id: "b1a7c0de-0001-4a11-9c01-000000000003", nextDueAt: "2026-10-12T09:00:00.000Z" }), now)
    ];
    expect(sortByUrgency(views).map((view) => view.state)).toEqual(["overdue", "due_soon", "scheduled"]);
    expect(dueOrSoon(views)).toHaveLength(2);
  });
});

describe("starter upkeep", () => {
  it("gives a new household a safety check, a service and a seasonal job", () => {
    const tasks = buildStarterMaintenance(HOUSEHOLD, new Date("2026-10-07T09:00:00.000Z"));
    expect(tasks).toHaveLength(3);
    expect(tasks.map((item) => item.category).sort()).toEqual(["building", "heating", "safety"]);
    for (const item of tasks) expect(item.householdId).toBe(HOUSEHOLD);
  });

  it("starts with the alarm test already overdue, like most real homes", () => {
    const now = new Date("2026-10-07T09:00:00.000Z");
    const views = buildStarterMaintenance(HOUSEHOLD, now).map((item) => viewOf(item, now));
    expect(views.filter((view) => view.state === "overdue")).toHaveLength(1);
    expect(views.find((view) => view.state === "overdue")?.category).toBe("safety");
  });
});
