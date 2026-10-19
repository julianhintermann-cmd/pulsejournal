import { expect, test } from "./fixtures";

/**
 * Section 0.2: tablet and desktop stay as they were. The pixel comparison runs with tests/visual (see
 * docs/MOBILE-IOS.md); this guard catches the typical regression – phone chrome leaking into wider layouts.
 */
const SCREENS = [
  "/?range=all",
  "/trades?range=all",
  "/trades/new?mode=quick",
  "/journal",
  "/calendar",
  "/more",
  "/settings",
];

for (const width of [1440, 1024, 768]) {
  test(`no phone chrome at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of SCREENS) {
      await page.goto(path, { waitUntil: "networkidle" });
      const state = await page.evaluate(() => {
        const shown = (selector: string) =>
          [...document.querySelectorAll<HTMLElement>(selector)].filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
          }).length;
        return {
          chrome: shown("[data-ios-chrome], .ios-tabbar, .ios-navbar, .ios-large-title, .ios-segmented, .ios-ptr"),
          presented: document.documentElement.hasAttribute("data-presented"),
          stackLayers: shown(".ios-stack-under[data-active], .ios-stack-over[data-active]"),
          fontSize: getComputedStyle(document.documentElement).fontSize,
          scrollRestoration: history.scrollRestoration,
        };
      });
      expect(state, `${path} at ${width}`).toEqual({
        chrome: 0,
        presented: false,
        stackLayers: 0,
        fontSize: "16px",
        scrollRestoration: "auto",
      });
    }
  });
}
