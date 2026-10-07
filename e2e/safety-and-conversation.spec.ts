import { expect, test } from "@playwright/test";
import { expectPlanCard, openConsole, runScenario } from "./helpers";

test.describe("safety and conversation", () => {
  test("a gas report is handled deterministically and skips the model", async ({ page }) => {
    await openConsole(page, "/nebius");
    await runScenario(page, "gas-smell");

    // The deterministic triage is the first thing on screen, before any model call.
    await expect(page.getByTestId("triage-banner")).toBeVisible();
    await expect(page.getByTestId("triage-urgency")).toHaveText(/emergency/i);
    await expect(page.getByTestId("triage-banner")).toContainText("0800 111 999");

    await expectPlanCard(page);
    await expect(page.getByTestId("plan-urgency")).toHaveText(/emergency/i);
    await expect(page.getByTestId("plan-card")).toContainText("0800 111 999");
    await expect(page.getByTestId("plan-card")).toContainText("not an emergency service");
    await expect(page.getByTestId("trace-panel")).toContainText("model.plan.skipped");
    await expect(page.getByTestId("plan-card")).toContainText("research skipped");
  });

  test("asks at most two questions before planning a vague report", async ({ page }) => {
    await openConsole(page);
    await page.getByLabel("Describe what is happening at home").fill("Something is wrong with the boiler.");
    await page.getByTestId("send-button").click();

    const form = page.getByTestId("clarification-form");
    await expect(form).toBeVisible();
    await expect(form.locator("input")).toHaveCount(2);

    await form.locator("input").nth(0).fill("No smell of gas and no leak, just the noise.");
    await form.locator("input").nth(1).fill("We still have hot water and the heating works.");
    await form.getByRole("button", { name: "Send answers" }).click();

    await expectPlanCard(page);
    await expect(page.getByTestId("plan-summary")).toContainText(/boiler/i);
    await expect(page.getByTestId("plan-action")).toHaveCount(3);
  });

  test("shows where the plan stands when asked later", async ({ page }) => {
    await openConsole(page);
    await runScenario(page, "boiler-noise");
    await expectPlanCard(page);

    await page.getByTestId("check-plan").click();
    await expect(page.getByRole("log")).toContainText(/still open|marked done/i);
  });

  test("never exposes prompts, chain-of-thought or credentials", async ({ page }) => {
    await openConsole(page, "/nebius");
    await runScenario(page, "boiler-noise");
    await expectPlanCard(page);

    const content = await page.content();
    expect(content).not.toMatch(/tvly-[A-Za-z0-9]{10,}/);
    expect(content).not.toMatch(/sk-[A-Za-z0-9_-]{20,}/);
    expect(content).not.toContain("detailed thinking");
    expect(content).not.toContain("You are the planning engine");
  });
});
