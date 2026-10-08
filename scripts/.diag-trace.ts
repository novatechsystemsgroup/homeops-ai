import { chromium } from "@playwright/test";
const SITE = "https://homeops.novatechsystem.co.uk";

async function main(): Promise<void> {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const started = Date.now();
  const log = (line: string): void => console.log("  +" + ((Date.now() - started) / 1000).toFixed(1) + "s " + line);

  page.on("request", (r) => {
    const url = r.url();
    if (url.includes("/api/")) log("REQ  " + r.method() + " " + url.replace(SITE, ""));
  });
  page.on("response", (r) => {
    const url = r.url();
    if (url.includes("/api/")) log("RES  " + r.status() + " " + url.replace(SITE, ""));
  });
  page.on("requestfailed", (r) => log("FAIL " + r.url().replace(SITE, "") + " " + (r.failure()?.errorText ?? "")));
  page.on("console", (m) => log("console[" + m.type() + "] " + m.text().slice(0, 140)));
  page.on("pageerror", (e) => log("pageerror " + String(e).slice(0, 200)));

  await page.goto(SITE + "/nebius", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Describe what is happening at home").waitFor({ timeout: 40_000 });
  log("pagina gata");
  await page.getByTestId("scenario-boiler-noise").click();
  log("click pe scenariu");

  for (let i = 0; i < 9; i += 1) {
    await page.waitForTimeout(5000);
    const hasCard = await page.getByTestId("plan-card").count();
    const progress = await page.getByTestId("planning-progress").count();
    const logText = await page.getByRole("log").innerText();
    log("stare: card=" + hasCard + " progress=" + progress + " | ultimul mesaj: " + JSON.stringify(logText.split("\n").slice(-2).join(" / ").slice(0, 120)));
    if (hasCard) break;
  }

  await browser.close();
  process.exit(0);
}
void main();
