import { chromium } from "@playwright/test";
const SITE = "https://homeops.novatechsystem.co.uk";
async function main(): Promise<void> {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const started = Date.now();
  await page.goto(SITE + "/nebius", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Describe what is happening at home").waitFor({ timeout: 40_000 });
  // Click the instant the field exists: this is the case that used to be dropped silently.
  await page.getByTestId("scenario-boiler-noise").click({ timeout: 20_000 });
  const clickAt = ((Date.now() - started) / 1000).toFixed(1);
  try {
    await page.getByTestId("plan-card").waitFor({ timeout: 120_000 });
    console.log("  click la " + clickAt + "s -> PLAN OK dupa " + ((Date.now() - started) / 1000).toFixed(1) + "s");
  } catch {
    console.log("  click la " + clickAt + "s -> inca lipsește planul (fix-ul nu e live?)");
  }
  await browser.close();
  process.exit(0);
}
void main();
