import { expect, test } from "@playwright/test";
import { expectPlanCard, openConsole, planSummary, runScenario } from "./helpers";

test.describe("boiler scenario", () => {
  test("turns a report into a plan, an assignment and a status update", async ({ page }) => {
    await openConsole(page);

    const started = Date.now();
    await runScenario(page, "boiler-noise");

    // First visual result is the deterministic triage; the plan follows.
    await expect(page.getByTestId("triage-banner")).toBeVisible();
    await expect(page.getByTestId("triage-urgency")).toHaveText(/needs attention/i);
    expect(Date.now() - started).toBeLessThan(15_000);
    await expectPlanCard(page);

    await expect(planSummary(page)).toContainText(/boiler/i);
    await expect(page.getByTestId("plan-urgency")).toHaveText(/needs attention/i);
    await expect(page.getByTestId("plan-action")).toHaveCount(3);
    await expect(page.getByTestId("plan-card").getByRole("link")).toHaveCount(3);
    await expect(page.getByTestId("confirmation-list")).toBeVisible();

    // Cancelling the confirmation must not change anything.
    const firstAction = page.getByTestId("plan-action").first();
    await firstAction.getByTestId("assign-select").selectOption({ index: 1 });
    await expect(page.getByTestId("confirm-dialog")).toBeVisible();
    await page.getByTestId("confirm-cancel").click();
    await expect(page.getByTestId("confirm-dialog")).toBeHidden();
    await expect(firstAction.getByTestId("action-status")).toHaveText("open");

    // Confirming applies the assignment.
    await firstAction.getByTestId("assign-select").selectOption({ index: 2 });
    await page.getByTestId("confirm-apply").click();
    await expect(firstAction.getByTestId("action-status")).toHaveText("assigned");
    await expect(firstAction.getByTestId("action-owner")).toContainText("Priya Hartley");

    // Marking an action done is reflected in the summary counters.
    await firstAction.getByTestId("toggle-action").click();
    await expect(firstAction.getByTestId("action-status")).toHaveText("done");
    await expect(page.getByTestId("plan-status-summary")).toContainText("1 done");
    await expect(page.getByTestId("plan-status-summary")).toContainText("2 open");

    // The plan survives a reload: the stored plan is read back from the API.
    await page.reload();
    await expect(page.getByText(/model: fake/)).toBeVisible();
  });

  test("resumes the stored plan from a fresh page", async ({ page }) => {
    await openConsole(page);
    await runScenario(page, "boiler-noise");
    await expectPlanCard(page);
    await page.getByTestId("open-plan-page").click();

    await expect(page.getByTestId("plan-card")).toBeVisible();
    await expect(page.getByTestId("resume-open")).toContainText(/\d+ open/);
    await expect(page.getByTestId("trace-panel")).toBeVisible();
    // Read-only view: no assignment controls on the resume page.
    await expect(page.getByTestId("assign-select")).toHaveCount(0);
  });
});
