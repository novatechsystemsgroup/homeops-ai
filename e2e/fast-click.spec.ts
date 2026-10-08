import { expect, test } from "@playwright/test";
import { expectPlanCard, openConsole, runScenario } from "./helpers";

test.describe("a hurried visitor", () => {
  test("clicking an example before the household loads still produces a plan", async ({ page }) => {
    // No waiting for the bootstrap: this is the click a judge makes in the first half second.
    await openConsole(page);
    await runScenario(page, "kitchen-leak");
    await expectPlanCard(page);
    await expect(page.getByTestId("plan-summary")).toContainText(/leak|sink|water/i);
  });

  test("typing and sending immediately also works", async ({ page }) => {
    await openConsole(page);
    const input = page.getByLabel("Describe what is happening at home");
    await input.fill("Water is dripping under the kitchen sink.");
    await page.getByTestId("send-button").click();
    await expectPlanCard(page);
  });
});
