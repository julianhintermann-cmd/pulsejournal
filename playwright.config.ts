import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3123);
// Second server with the demo data for the iOS suite (tests/e2e/ios), so the smoke test keeps its empty start.
const IOS_PORT = PORT + 1;
const dataDir = mkdtempSync(path.join(tmpdir(), "pulse-e2e-"));
const iosDataDir = mkdtempSync(path.join(tmpdir(), "pulse-e2e-ios-"));

/**
 * The iPhone projects run in WebKit (closest to iOS Safari). Where WebKit cannot be installed, `IOS_BROWSER=chromium`
 * runs the same projects in Chromium with the iPhone viewport, DPR, touch and user agent.
 */
const IOS_BROWSER = process.env.IOS_BROWSER === "chromium" ? "chromium" : "webkit";
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1";
const AUTH = "tests/e2e/.auth/ios.json";

const iphone = (width: number, height: number, deviceScaleFactor: number) =>
  ({
    browserName: IOS_BROWSER,
    baseURL: `http://127.0.0.1:${IOS_PORT}`,
    viewport: { width, height },
    screen: { width, height },
    deviceScaleFactor,
    isMobile: true,
    hasTouch: true,
    userAgent: IPHONE_UA,
    storageState: AUTH,
  }) as const;

const IPHONE_16_PRO = iphone(402, 874, 3);
const IPHONE_16_PRO_MAX = iphone(440, 956, 3);
const IPHONE_SE = iphone(375, 667, 2);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    locale: "de-CH",
    timezoneId: "Europe/Zurich",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", testMatch: "smoke.spec.ts", use: { ...devices["Pixel 7"], browserName: "chromium" } },
    {
      name: "ios-setup",
      testMatch: "ios/auth.setup.ts",
      use: { ...IPHONE_16_PRO, storageState: undefined },
    },
    {
      name: "iphone-16-pro",
      testMatch: "ios/*.spec.ts",
      testIgnore: ["ios/reduced-motion.spec.ts", "ios/desktop.spec.ts"],
      dependencies: ["ios-setup"],
      use: { ...IPHONE_16_PRO, colorScheme: "dark" },
    },
    {
      name: "iphone-16-pro-light",
      testMatch: "ios/layout.spec.ts",
      dependencies: ["ios-setup"],
      use: { ...IPHONE_16_PRO, colorScheme: "light" },
    },
    {
      name: "iphone-16-pro-max",
      testMatch: "ios/layout.spec.ts",
      dependencies: ["ios-setup"],
      use: { ...IPHONE_16_PRO_MAX, colorScheme: "dark" },
    },
    {
      name: "iphone-se",
      testMatch: "ios/layout.spec.ts",
      dependencies: ["ios-setup"],
      use: { ...IPHONE_SE, colorScheme: "light" },
    },
    {
      name: "iphone-16-pro-reduced-motion",
      testMatch: "ios/reduced-motion.spec.ts",
      dependencies: ["ios-setup"],
      use: { ...IPHONE_16_PRO, colorScheme: "dark", contextOptions: { reducedMotion: "reduce" } },
    },
    {
      // Tablet and desktop must not change: phone chrome stays hidden at ≥ 768 px.
      name: "desktop",
      testMatch: "ios/desktop.spec.ts",
      dependencies: ["ios-setup"],
      use: {
        browserName: "chromium",
        baseURL: `http://127.0.0.1:${IOS_PORT}`,
        viewport: { width: 1440, height: 900 },
        storageState: AUTH,
      },
    },
  ],
  webServer: [
    {
      // CI builds in a previous step; locally the suite builds first.
      command: process.env.CI ? "pnpm start" : "pnpm build && pnpm start",
      url: `http://127.0.0.1:${PORT}/api/health`,
      timeout: 300_000,
      reuseExistingServer: false,
      env: { PORT: String(PORT), HOSTNAME: "127.0.0.1", DATA_DIR: dataDir, COOKIE_SECURE: "false" },
    },
    {
      // Starts after the first one (which builds locally), so it can reuse the build.
      command: "pnpm start",
      url: `http://127.0.0.1:${IOS_PORT}/api/health`,
      timeout: 300_000,
      reuseExistingServer: false,
      env: {
        PORT: String(IOS_PORT),
        HOSTNAME: "127.0.0.1",
        DATA_DIR: iosDataDir,
        COOKIE_SECURE: "false",
        SEED_DEMO: "true",
      },
    },
  ],
});
