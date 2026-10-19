import { centre, expect, tap, test } from "./fixtures";

/** Section 6: swipe actions, full swipe with undo, long-press menu, pull to refresh, chart scrubbing. */

const rows = (page: import("@playwright/test").Page) => page.locator(".ios-swipe").filter({ visible: true });

test.beforeEach(async ({ page }) => {
  await page.goto("/trades?range=all");
  await expect(rows(page).first()).toBeVisible();
});

test("swiping a row reveals its actions, a tap elsewhere closes them", async ({ page, finger }) => {
  const row = rows(page).nth(1);
  const { y } = await centre(row);
  await finger.drag({ x: 330, y }, { x: 220, y }, { steps: 10, durationMs: 300 });
  await expect(row.locator(".ios-swipe__action", { hasText: "Löschen" })).toBeInViewport();
  await expect(row.locator(".ios-swipe__action", { hasText: "Bearbeiten" })).toBeInViewport();
  await page.touchscreen.tap(200, 150);
  await expect(row.locator(".ios-swipe__action", { hasText: "Löschen" })).not.toBeInViewport();

  // The other edge offers Duplizieren.
  await finger.drag({ x: 150, y }, { x: 260, y }, { steps: 10, durationMs: 300 });
  await expect(row.locator(".ios-swipe__action", { hasText: "Duplizieren" })).toBeInViewport();
  await page.touchscreen.tap(200, 150);
});

test("a full swipe deletes the trade and the banner brings it back", async ({ page, finger }) => {
  const before = await rows(page).count();
  const row = rows(page).nth(2);
  const href = await row.locator('a[href^="/trades/"]').first().getAttribute("href");
  const { y } = await centre(row);
  await finger.drag({ x: 380, y }, { x: 30, y }, { steps: 14, durationMs: 220 });
  await expect(page.getByText("Trade gelöscht")).toBeVisible();
  await expect(page.locator(`.ios-swipe a[href="${href}"]`).filter({ visible: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Rückgängig" }).click();
  await expect(page.locator(`.ios-swipe a[href="${href}"]`).filter({ visible: true })).toHaveCount(1);
  await expect(rows(page)).toHaveCount(before);
});

test("a long press opens the context menu without navigating", async ({ page, finger }) => {
  const url = page.url();
  await finger.hold(await centre(rows(page).nth(3)), 700);
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem")).toHaveText(["Bearbeiten", "Duplizieren", "Teilen", "Löschen"]);
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  expect(page.url()).toBe(url);
});

test("pull to refresh shows the activity indicator and settles", async ({ page, finger }) => {
  await page.evaluate(() => window.scrollTo(0, 0));
  await finger.down(200, 220);
  for (let i = 1; i <= 12; i++) {
    await finger.move(200, 220 + i * 18);
    await page.waitForTimeout(16);
  }
  await finger.up();
  await expect(page.locator(".ios-ptr[data-refreshing]")).toHaveCount(1);
  await expect(page.locator(".ios-ptr[data-refreshing]")).toHaveCount(0, { timeout: 8_000 });
  await expect
    .poll(() => page.evaluate(() => document.getElementById("main")!.style.transform || "none"))
    .toMatch(/none|translate3d\(0px, 0px, 0px\)|translateY\(0px\)/);
});

test("scrubbing the dashboard chart shows the value under the finger", async ({ page, finger }) => {
  await page.goto("/?range=all");
  const chart = page
    .getByRole("img", { name: /Equity|Verlauf|P&L/i })
    .filter({ visible: true })
    .first();
  const box = (await chart.boundingBox())!;
  const y = box.y + box.height / 2;
  const hero = page.locator(".ios-roll").first();
  const total = await hero.locator(".sr-only").textContent();
  await finger.down(box.x + 40, y);
  for (let i = 1; i <= 8; i++) {
    await finger.move(box.x + 40 + i * 12, y + 1);
    await page.waitForTimeout(16);
  }
  await expect.poll(() => hero.locator(".sr-only").textContent()).not.toBe(total);
  await finger.up();
  await expect.poll(() => hero.locator(".sr-only").textContent()).toBe(total);
});

test("segmented range presets change the dashboard filter", async ({ page }) => {
  await page.goto("/?range=all");
  await tap(page, page.getByRole("radio", { name: "1M" }));
  await expect(page).not.toHaveURL(/range=all/);
  await expect(page.getByRole("radio", { name: "1M" })).toHaveAttribute("aria-checked", "true");
  await tap(page, page.getByRole("radio", { name: "Alles" }));
  await expect(page).toHaveURL(/range=all/);
});
