import { chromium } from "@playwright/test";

/**
 * Live browser check: drives the real web app against the real API (Nebius for
 * planning, Tavily for research) and asserts what the demo promises.
 *
 * Requires "pnpm dev" to be running and real keys in .env:
 *   pnpm check:live
 */
const WEB_URL = process.env.WEB_URL ?? "http://localhost:3000";
const MAX_MS = Number(process.env.LIVE_BUDGET_MS ?? 45_000);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
const pageErrors: string[] = [];
page.on("pageerror", (error) => pageErrors.push(error.message));

function report(ok: boolean, message: string): void {
  console.log((ok ? "  PASS - " : "  FAIL - ") + message);
  if (!ok) process.exitCode = 1;
}

try {
  await page.goto(WEB_URL + "/alexa", { waitUntil: "domcontentloaded" });
  await page.getByText(/model: nebius/).first().waitFor({ timeout: 30_000 });
  console.log("Live console connected (" + WEB_URL + ") - providers: nebius + tavily");

  const started = Date.now();
  await page.getByTestId("scenario-boiler").click();
  await page.getByTestId("plan-card").waitFor({ timeout: MAX_MS });
  const elapsedMs = Date.now() - started;

  const urgency = await page.getByTestId("plan-urgency").innerText();
  const summary = await page.getByTestId("plan-summary").innerText();
  const actions = await page.getByTestId("plan-action").count();
  const sources = await page.getByTestId("plan-card").getByRole("link").count();
  const confirmations = await page.getByTestId("confirmation-list").isVisible();
  const degraded = await page.getByTestId("degraded-banner").isVisible().catch(() => false);

  console.log("");
  console.log("Plan: " + summary);
  console.log("  urgency=" + urgency + " actions=" + actions + " sources=" + sources + " elapsed=" + elapsedMs + "ms");
  console.log("");

  report(elapsedMs < 15_000, "first visual result within 15s (got " + elapsedMs + "ms)");
  report(urgency.toLowerCase().includes("needs attention"), "urgency is needs attention");
  report(actions >= 1, "plan has " + actions + " action(s)");
  report(sources >= 3, "sources attached (" + sources + ")");
  report(confirmations, "confirmation block is shown for external actions");
  report(!degraded, "plan came from the model, not the deterministic fallback");
  report(pageErrors.length === 0, "no page errors" + (pageErrors.length ? ": " + pageErrors.join(" | ") : ""));

  const html = await page.content();
  report(!/tvly-[A-Za-z0-9]{10,}/.test(html), "no API key rendered in the page");
  report(!html.includes("You are the planning engine"), "no system prompt rendered in the page");

  await page.screenshot({ path: "test-results/live-plan.png", fullPage: true });
  console.log("");
  console.log("Screenshot: test-results/live-plan.png");
  console.log(process.exitCode ? "LIVE CHECK FAILED" : "LIVE CHECK PASSED");
} catch (error) {
  console.error("LIVE CHECK FAILED: " + (error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
} finally {
  await browser.close();
}

