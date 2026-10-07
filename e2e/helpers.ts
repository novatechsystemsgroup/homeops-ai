import { expect, type Page } from "@playwright/test";

/** Waits until the console has loaded the demo household and the API metadata. */
export async function openConsole(page: Page, path = "/alexa"): Promise<void> {
  await page.goto(path);
  // The page header also links to the other surface, so target the console heading specifically.
  await expect(page.getByRole("heading", { name: /Alexa\+ simulator|Agent console/ })).toBeVisible();
  await expect(page.getByText(/model: fake/)).toBeVisible();
}

export async function runScenario(page: Page, scenario: "boiler" | "gas"): Promise<void> {
  await page.getByTestId(`scenario-${scenario}`).click();
}

export async function expectPlanCard(page: Page): Promise<void> {
  await expect(page.getByTestId("plan-card")).toBeVisible();
}

export function planSummary(page: Page) {
  return page.getByTestId("plan-summary");
}
