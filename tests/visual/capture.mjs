#!/usr/bin/env node
/**
 * Captures screenshots of every screen for visual reviews (docs/MOBILE-IOS.md).
 *
 *   node tests/visual/capture.mjs --base http://localhost:3000 --out docs/mobile-after --set mobile [--browser webkit]
 *
 * --set mobile   iPhone 16 Pro (402×874 @3x) and iPhone SE (375×667 @2x), dark + light, JPEG
 * --set desktop  1440×900, 1024×768 and 768×1024, dark + light, full-page PNG (for pixel diffs)
 * The app theme is switched to "System" once, so the emulated colour scheme decides dark/light.
 * Credentials: PULSE_USER / PULSE_PASSWORD (a fresh instance is set up with them).
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { chromium, webkit } from "@playwright/test";

const { values } = parseArgs({
  options: {
    base: { type: "string", default: "http://localhost:3000" },
    out: { type: "string", default: "docs/mobile-after" },
    set: { type: "string", default: "mobile" },
    browser: { type: "string", default: "chromium" },
    only: { type: "string" },
  },
});

const USER = process.env.PULSE_USER ?? "demo";
const PASSWORD = process.env.PULSE_PASSWORD ?? "demo-passwort-123";
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1";

const DEVICES = {
  mobile: [
    { name: "iphone16pro", width: 402, height: 874, dpr: 3, mobile: true },
    { name: "iphonese", width: 375, height: 667, dpr: 2, mobile: true },
  ],
  desktop: [
    { name: "1440", width: 1440, height: 900, dpr: 1, mobile: false },
    { name: "1024", width: 1024, height: 768, dpr: 1, mobile: false },
    { name: "768", width: 768, height: 1024, dpr: 1, mobile: false },
  ],
}[values.set];
if (!DEVICES) throw new Error(`Unknown --set ${values.set}`);

const engine = values.browser === "webkit" ? webkit : chromium;
const browser = await engine.launch();

async function login(context) {
  const page = await context.newPage();
  await page.goto(`${values.base}/`);
  if (page.url().includes("/setup")) {
    await page.fill("#username", USER);
    await page.fill("#password", PASSWORD);
    await page.fill("#passwordConfirm", PASSWORD);
    await page.fill("#accountName", "Hauptkonto");
    await page.fill("#startingBalance", "10000");
    await page.getByRole("button", { name: "Einrichtung abschliessen" }).click();
    await page.waitForURL(`${values.base}/`);
  } else if (page.url().includes("/login")) {
    await page.fill("#username", USER);
    await page.fill("#password", PASSWORD);
    await page.getByRole("button", { name: "Anmelden" }).click();
    await page.waitForURL(`${values.base}/`);
  }
  return page;
}

// Discover ids and switch the theme to "System" once.
const setupContext = await browser.newContext();
const setupPage = await login(setupContext);
await setupPage.goto(`${values.base}/settings`);
await setupPage.getByRole("radio", { name: "System" }).click();
await setupPage.waitForTimeout(500);
await setupPage.goto(`${values.base}/trades?range=all`);
const tradeHref = await setupPage
  .locator('a[href^="/trades/"]:not([href="/trades/new"]):not([href*="new?"])')
  .first()
  .getAttribute("href")
  .catch(() => null);
await setupPage.goto(`${values.base}/playbooks?range=all`);
const playbookHref = await setupPage
  .locator('a[href^="/playbooks/"]')
  .first()
  .getAttribute("href")
  .catch(() => null);
const storage = await setupContext.storageState();
await setupContext.close();

const SCREENS = [
  ["dashboard", "/?range=all"],
  ["trades", "/trades?range=all"],
  ["trade-new-quick", "/trades/new?mode=quick"],
  ["trade-new-detailed", "/trades/new?mode=detailed"],
  ...(tradeHref
    ? [
        ["trade-detail", tradeHref],
        ["trade-edit", `${tradeHref}/edit`],
      ]
    : []),
  ["calendar", "/calendar"],
  ["journal", "/journal"],
  ["journal-day", "/journal/today"],
  ["stats-overview", "/stats?range=all"],
  ["stats-setups", "/stats?range=all&tab=setups"],
  ["stats-time", "/stats?range=all&tab=time"],
  ["stats-symbols", "/stats?range=all&tab=symbols"],
  ["stats-psychology", "/stats?range=all&tab=psychology"],
  ["stats-r", "/stats?range=all&tab=r"],
  ["playbooks", "/playbooks?range=all"],
  ...(playbookHref ? [["playbook-detail", `${playbookHref}?range=all`]] : []),
  ["accounts", "/accounts"],
  ["import-export", "/import-export"],
  ["settings", "/settings"],
  ["more", "/more"],
].filter(([name]) => !values.only || values.only.split(",").includes(name));

mkdirSync(values.out, { recursive: true });
for (const device of DEVICES) {
  for (const scheme of ["dark", "light"]) {
    const context = await browser.newContext({
      storageState: storage,
      viewport: { width: device.width, height: device.height },
      deviceScaleFactor: device.dpr,
      isMobile: device.mobile && values.browser !== "firefox",
      hasTouch: device.mobile,
      userAgent: device.mobile ? IPHONE_UA : undefined,
      colorScheme: scheme,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    for (const [name, url] of SCREENS) {
      await page.goto(`${values.base}${url}`, { waitUntil: "networkidle" });
      // Charts render lazily once the browser is idle.
      await page.mouse.wheel(0, 2000).catch(() => undefined);
      await page.waitForTimeout(900);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(300);
      const file = path.join(values.out, `${device.name}-${scheme}-${name}.${device.mobile ? "jpg" : "png"}`);
      await page.screenshot(
        device.mobile
          ? { path: file, type: "jpeg", quality: 60 }
          : { path: file, fullPage: true, animations: "disabled" },
      );
      process.stdout.write(".");
    }
    await context.close();
  }
}
await browser.close();
console.log(`\n${DEVICES.length * 2 * SCREENS.length} screenshots in ${values.out}`);
