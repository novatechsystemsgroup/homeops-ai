import { expect, test } from "@playwright/test";
import { expectPlanCard, openConsole, runScenario } from "./helpers";

test.describe("any household problem", () => {
  test("handles a plumbing report, not just the boiler scenario", async ({ page }) => {
    await openConsole(page);
    await runScenario(page, "kitchen-leak");
    await expectPlanCard(page);

    await expect(page.getByTestId("plan-summary")).toContainText(/leak|sink|water/i);
    await expect(page.getByTestId("plan-action").first()).toContainText(/plumber|leak|valve/i);
  });

  test("handles an appliance report", async ({ page }) => {
    await openConsole(page);
    await runScenario(page, "washing-machine");
    await expectPlanCard(page);

    await expect(page.getByTestId("plan-summary")).toContainText(/washing machine|drain/i);
  });

  test("accepts a free-form request that is not one of the examples", async ({ page }) => {
    await openConsole(page);
    await page.getByLabel("Describe what is happening at home").fill("The radiator in the bedroom is cold while the rest of the house is warm.");
    await page.getByTestId("send-button").click();

    await expectPlanCard(page);
    await expect(page.getByTestId("triage-banner")).toBeVisible();
    await expect(page.getByTestId("plan-action")).not.toHaveCount(0);
  });

  test("offers a help panel that explains the demo and voice", async ({ page }) => {
    await openConsole(page);
    await page.getByTestId("help-toggle").click();
    await expect(page.getByTestId("help-panel")).toBeVisible();
    await expect(page.getByTestId("help-panel")).toContainText(/microphone/i);
    await expect(page.getByTestId("help-panel")).toContainText(/Chrome, Edge and Safari/i);
  });

  test("voice replies are on by default", async ({ page }) => {
    await openConsole(page);
    await expect(page.getByTestId("speak-toggle")).toContainText(/on/i);
  });
});
