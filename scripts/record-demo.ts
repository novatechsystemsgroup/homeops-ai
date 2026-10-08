/**
 * Records the public demo, one video file per scene, for the submission videos.
 * Real browser, real providers, no mocks: whatever this captures is what a judge sees.
 *
 *   pnpm exec tsx scripts/record-demo.ts            # all scenes
 *   SCENES=02,04 pnpm exec tsx scripts/record-demo.ts
 */
/// <reference lib="dom" />
import { chromium, type Browser, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SITE = process.env.WEB_URL ?? "https://homeops.novatechsystem.co.uk";
const RAW = "video/raw";
const VIEWPORT = { width: 1920, height: 1080 };

mkdirSync(RAW, { recursive: true });
mkdirSync("video/assets", { recursive: true });

/** A visible pointer: Playwright's videos do not render the mouse, and a demo is hard to follow without one. */
async function installCursor(page: Page): Promise<void> {
  await page.addStyleTag({
    content: ":root { --ho-zoom: 1.25 } body { zoom: var(--ho-zoom); }"
  });
  await page.evaluate(() => {
    const dot = document.createElement("div");
    dot.id = "ho-cursor";
    dot.style.cssText = [
      "position:fixed", "left:0", "top:0", "width:18px", "height:18px", "border-radius:9999px",
      "background:rgba(56,189,248,0.9)", "box-shadow:0 0 0 6px rgba(56,189,248,0.25)",
      "transform:translate(-50%,-50%)", "pointer-events:none", "z-index:2147483647",
      "transition:left 80ms linear, top 80ms linear"
    ].join(";");
    document.body.appendChild(dot);
    window.addEventListener("mousemove", (event) => {
      const element = document.getElementById("ho-cursor");
      if (element) {
        element.style.left = (event as MouseEvent).clientX + "px";
        element.style.top = (event as MouseEvent).clientY + "px";
      }
    });
  });
}

async function point(page: Page, x: number, y: number): Promise<void> {
  await page.mouse.move(x, y, { steps: 12 });
  await page.waitForTimeout(180);
}

async function pointAt(page: Page, selector: string): Promise<void> {
  const box = await page.locator(selector).first().boundingBox();
  if (box) await point(page, box.x + box.width / 2, box.y + box.height / 2);
}

async function glide(page: Page, to: number, steps = 22): Promise<void> {
  const from = await page.evaluate(() => window.scrollY);
  for (let index = 1; index <= steps; index += 1) {
    const y = from + ((to - from) * index) / steps;
    await page.evaluate((value) => window.scrollTo(0, value), y);
    await page.waitForTimeout(22);
  }
}

type Scene = { name: string; run: (page: Page) => Promise<void> };

const SCENES: Scene[] = [
  {
    name: "01-landing",
    run: async (page) => {
      await page.goto(SITE, { waitUntil: "domcontentloaded" });
      await page.getByTestId("start-demo").waitFor({ timeout: 40_000 });
      await page.waitForTimeout(1500);
      await pointAt(page, "[data-testid=start-demo]");
      await pointAt(page, "[data-testid^=home-scenario-kitchen-leak]");
      await glide(page, 620);
      await page.waitForTimeout(1200);
      await pointAt(page, "[data-testid^=home-scenario-gas-smell]");
      await glide(page, 1500);
      await page.waitForTimeout(1500);
      await glide(page, 0);
      await page.waitForTimeout(800);
    }
  },
  {
    name: "02-console-ask",
    run: async (page) => {
      await page.goto(SITE + "/alexa", { waitUntil: "domcontentloaded" });
      await page.getByLabel("Describe what is happening at home").waitFor({ timeout: 40_000 });
      await page.waitForTimeout(1500);
      await glide(page, 300);
      await pointAt(page, "[data-testid=maintenance-panel]");
      await page.waitForTimeout(1200);
      await glide(page, 0);
      const input = page.getByLabel("Describe what is happening at home");
      await input.click();
      await input.type("The boiler is making a loud humming noise. We have guests arriving on Saturday.", { delay: 45 });
      await page.waitForTimeout(700);
      await pointAt(page, "[data-testid=send-button]");
      await page.getByTestId("send-button").click();
      // The deterministic triage lands almost immediately; hold on it.
      await page.getByTestId("triage-banner").waitFor({ timeout: 20_000 });
      await page.waitForTimeout(2200);
    }
  },
  {
    name: "03-plan-and-confirm",
    run: async (page) => {
      await page.goto(SITE + "/alexa?scenario=boiler-noise", { waitUntil: "domcontentloaded" });
      await page.getByTestId("plan-card").waitFor({ timeout: 120_000 });
      await page.waitForTimeout(1200);
      await glide(page, 260);
      await pointAt(page, "[data-testid=plan-urgency]");
      await page.waitForTimeout(900);
      await pointAt(page, "[data-testid=plan-action]");
      await glide(page, 700);
      await page.waitForTimeout(1200);
      const select = page.getByTestId("assign-select").first();
      await pointAt(page, "[data-testid=assign-select]");
      await select.selectOption({ index: 1 });
      await page.getByTestId("confirm-dialog").waitFor({ timeout: 15_000 });
      await page.waitForTimeout(1400);
      await pointAt(page, "[data-testid=confirm-apply]");
      await page.getByTestId("confirm-apply").click();
      await page.waitForTimeout(1600);
    }
  },
  {
    name: "04-evidence",
    run: async (page) => {
      await page.goto(SITE + "/alexa?scenario=boiler-noise", { waitUntil: "domcontentloaded" });
      await page.getByTestId("plan-card").waitFor({ timeout: 120_000 });
      await glide(page, 620);
      await page.waitForTimeout(900);
      const action = page.getByTestId("plan-action").first();
      await pointAt(page, "[data-testid=evidence-photo]");
      await action.getByTestId("evidence-photo").setInputFiles("video/assets/boiler-fault.png");
      await page.getByTestId("evidence-item").first().waitFor({ timeout: 40_000 });
      await page.waitForTimeout(1400);
      await pointAt(page, "[data-testid=evidence-note]");
      await action.getByTestId("evidence-note").type("Engineer: fan bearings worn, part ordered.", { delay: 40 });
      await page.waitForTimeout(600);
      await pointAt(page, "[data-testid=evidence-save-note]");
      await action.getByTestId("evidence-save-note").click();
      await page.getByTestId("evidence-item").nth(1).waitFor({ timeout: 40_000 });
      await page.waitForTimeout(1800);
    }
  },
  {
    name: "05-upkeep",
    run: async (page) => {
      await page.goto(SITE + "/alexa", { waitUntil: "domcontentloaded" });
      await page.getByTestId("maintenance-panel").waitFor({ timeout: 40_000 });
      await glide(page, 420);
      await pointAt(page, "[data-testid=maintenance-due-count]");
      await page.waitForTimeout(1200);
      await glide(page, 260);
      await pointAt(page, "[data-testid=ask-upkeep]");
      await page.getByTestId("ask-upkeep").click();
      await page.waitForTimeout(2600);
      await glide(page, 420);
      await pointAt(page, "[data-testid=maintenance-complete]");
      await page.getByTestId("maintenance-complete").first().click();
      await page.getByTestId("confirm-dialog").waitFor({ timeout: 15_000 });
      await page.waitForTimeout(1400);
      await pointAt(page, "[data-testid=confirm-apply]");
      await page.getByTestId("confirm-apply").click();
      await page.waitForTimeout(2000);
    }
  },
  {
    name: "06-emergency",
    run: async (page) => {
      await page.goto(SITE + "/alexa?scenario=gas-smell", { waitUntil: "domcontentloaded" });
      await page.getByTestId("triage-banner").waitFor({ timeout: 30_000 });
      await page.waitForTimeout(1400);
      await pointAt(page, "[data-testid=triage-banner]");
      await glide(page, 320);
      await page.waitForTimeout(2200);
    }
  },
  {
    name: "07-trace",
    run: async (page) => {
      await page.goto(SITE + "/nebius", { waitUntil: "domcontentloaded" });
      await page.getByLabel("Describe what is happening at home").waitFor({ timeout: 40_000 });
      await waitForHousehold(page);
      await page.getByTestId("scenario-boiler-noise").click();
      await page.getByTestId("plan-card").waitFor({ timeout: 120_000 });
      await page.waitForTimeout(1000);
      await glide(page, 900);
      await page.waitForTimeout(1600);
      await glide(page, 1600);
      await page.waitForTimeout(2000);
    }
  },
  {
    name: "08-plan-page",
    run: async (page) => {
      await page.goto(SITE + "/alexa?scenario=kitchen-leak", { waitUntil: "domcontentloaded" });
      await page.getByTestId("plan-card").waitFor({ timeout: 120_000 });
      await page.waitForTimeout(900);
      await glide(page, 240);
      await pointAt(page, "[data-testid=open-plan-page]");
      await Promise.all([page.waitForNavigation(), page.getByTestId("open-plan-page").click()]);
      await page.getByTestId("plan-card").waitFor({ timeout: 40_000 });
      await page.waitForTimeout(2000);
      await glide(page, 500);
      await page.waitForTimeout(1500);
    }
  },
  {
    name: "09-mcp",
    run: async (page) => {
      // A terminal cannot be captured from Playwright, so the real output of the MCP smoke
      // test is rendered exactly as printed, inside a terminal frame.
      const output = readFileSync("video/assets/mcp-smoke.txt", "utf8").replace(/</g, "&lt;");
      await page.setContent(
        '<!doctype html><html><body style="margin:0;background:#0b1120;color:#cbd5e1;font-family:Menlo,monospace">' +
          '<div style="padding:26px 34px">' +
          '<p style="margin:0 0 14px;color:#7dd3fc;font-size:15px">$ pnpm mcp:smoke   -   the public MCP endpoint at /mcp</p>' +
          '<pre style="margin:0;font-size:19px;line-height:1.6;white-space:pre-wrap">' + output + "</pre>" +
          "</div></body></html>"
      );
      await page.waitForTimeout(1400);
      await glide(page, 900, 40);
      await page.waitForTimeout(1600);
      await glide(page, 1800, 40);
      await page.waitForTimeout(1800);
    }
  },
];

/** A placeholder photo for the evidence scene: it is the app's own upload path that matters. */
async function makeEvidencePhoto(browser: Browser): Promise<void> {
  const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
  await page.setContent(`<!doctype html><html><body style="margin:0;font-family:system-ui;background:#0b1220;color:#e2e8f0">
    <div style="padding:38px 44px">
      <p style="font-size:15px;letter-spacing:.18em;color:#7dd3fc;margin:0">WORCESTER BOSCH · GREENSTAR</p>
      <p style="font-size:76px;font-weight:700;margin:14px 0 4px">F28</p>
      <p style="font-size:22px;color:#fca5a5;margin:0">Flame detected when no gas present</p>
      <div style="margin-top:36px;display:flex;gap:28px;font-size:16px;color:#94a3b8">
        <span>pressure 1.1 bar</span><span>flow 24.8 °C</span><span>service due 11/2026</span>
      </div>
      <p style="margin-top:52px;font-size:14px;color:#64748b">Photo taken 19:42 · cupboard, kitchen</p>
    </div></body></html>`);
  await page.screenshot({ path: "video/assets/boiler-fault.png" });
  await page.close();
}


/**
 * Waits until the console really has the household. The upkeep list is rendered from the
 * household id, so the first task is the honest signal; clicking earlier used to be dropped.
 */
async function waitForHousehold(page: Page): Promise<void> {
  await page.getByTestId("maintenance-task").first().waitFor({ timeout: 30_000 }).catch(() => undefined);
  await page.waitForTimeout(300);
}

async function main(): Promise<void> {
  const wanted = process.env.SCENES?.split(",").map((value) => value.trim());
  const scenes = wanted?.length ? SCENES.filter((scene) => wanted.some((prefix) => scene.name.startsWith(prefix))) : SCENES;

  const browser = await chromium.launch();
  await makeEvidencePhoto(browser);

  for (const scene of scenes) {
    const dir = join(RAW, scene.name);
    mkdirSync(dir, { recursive: true });
    const context = await browser.newContext({ viewport: VIEWPORT, recordVideo: { dir, size: VIEWPORT } });
    const page = await context.newPage();
    const started = Date.now();
    try {
      await installCursor(page);
      await scene.run(page);
      console.log("  recorded " + scene.name + " in " + Math.round((Date.now() - started) / 1000) + "s");
    } catch (error) {
      console.log("  FAILED " + scene.name + ": " + (error instanceof Error ? error.message.slice(0, 160) : String(error)));
    }
    await context.close();
    // Playwright names the file with a random id: give it the scene name instead.
    for (const file of readdirSync(dir)) {
      if (file.endsWith(".webm")) renameSync(join(dir, file), join(RAW, scene.name + ".webm"));
    }
  }

  await browser.close();
  writeFileSync(join(RAW, "recorded-at.txt"), new Date().toISOString());
  console.log("clips in " + RAW);
  process.exit(0);
}

void main();
