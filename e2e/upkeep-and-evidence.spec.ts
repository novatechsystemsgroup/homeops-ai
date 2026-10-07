import { expect, test } from "@playwright/test";
import { expectPlanCard, openConsole, runScenario } from "./helpers";

test.describe("home upkeep and repair evidence", () => {
  test("shows recurring upkeep and completes a task only after confirmation", async ({ page }) => {
    await openConsole(page);

    const panel = page.getByTestId("maintenance-panel");
    await expect(panel).toBeVisible();
    await expect(page.getByTestId("maintenance-due-count")).toContainText("due");
    // The demo household always starts with an overdue safety check.
    await expect(page.getByTestId("maintenance-state").first()).toContainText(/overdue|due in|due today/);

    // A unique title keeps this test independent of data left by earlier runs.
    const unique = "Test the hallway smoke alarm " + Date.now();
    await page.getByLabel("New reminder").fill(unique);
    await page.getByTestId("maintenance-add-submit").click();

    const row = page.getByTestId("maintenance-task").filter({ hasText: unique }).first();
    await expect(row).toBeVisible();
    await expect(row.getByTestId("maintenance-state")).toContainText(/due/);

    await row.getByTestId("maintenance-complete").click();
    await expect(page.getByTestId("confirm-dialog")).toBeVisible();
    await page.getByTestId("confirm-apply").click();

    await expect(row).toContainText(/last done/);
    await expect(row.getByTestId("maintenance-state")).not.toContainText(/overdue|due today/);
  });

  test("adds a reminder with a cadence", async ({ page }) => {
    await openConsole(page);
    await page.getByLabel("New reminder").fill("Replace the fridge water filter");
    await page.getByLabel("How often").selectOption("biannual");
    await page.getByTestId("maintenance-add-submit").click();

    await expect(page.getByTestId("maintenance-list")).toContainText("Replace the fridge water filter");
    await expect(page.getByTestId("maintenance-list")).toContainText(/every 6 months/);
  });

  test("answers what needs doing at home", async ({ page }) => {
    await openConsole(page);
    await page.getByTestId("ask-upkeep").click();
    await expect(page.getByRole("log")).toContainText(/to do at home|Nothing needs doing/i);
  });

  test("attaches a photo and a note to a plan action as repair evidence", async ({ page }) => {
    await openConsole(page);
    await runScenario(page, "boiler-noise");
    await expectPlanCard(page);

    const action = page.getByTestId("plan-action").first();
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
    await action.getByTestId("evidence-photo").setInputFiles({ name: "boiler.png", mimeType: "image/png", buffer: png });

    await expect(action.getByTestId("evidence-item")).toHaveCount(1);
    await expect(action.getByTestId("evidence-item").first()).toContainText(/photo/);

    await action.getByTestId("evidence-note").fill("Engineer said the fan bearings need replacing");
    await action.getByTestId("evidence-save-note").click();
    await expect(action.getByTestId("evidence-item")).toHaveCount(2);

    // The photo is served back by the API, so the thumbnail must actually render.
    await expect(action.getByTestId("evidence-item").locator("img").first()).toBeVisible();

    await action.getByTestId("evidence-item").first().getByTestId("evidence-delete").click();
    await expect(action.getByTestId("evidence-item")).toHaveCount(1);
  });
});
