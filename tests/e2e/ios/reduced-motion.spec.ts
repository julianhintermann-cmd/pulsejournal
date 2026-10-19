import { expect, settled, tap, test } from "./fixtures";

/** Reduce Motion (section 8): pushes crossfade instead of sliding, nothing moves sideways. */
test.use({ standalone: true });

test("push and pop crossfade without a slide", async ({ page }) => {
  await page.goto("/trades?range=all");
  await page.evaluate(() => {
    const w = window as Window & { __keyframes?: string[] };
    w.__keyframes = [];
    const original = Element.prototype.animate;
    Element.prototype.animate = function (this: Element, keyframes, options) {
      w.__keyframes!.push(JSON.stringify(keyframes));
      return original.call(this, keyframes, options);
    };
  });
  await tap(page, page.locator('.ios-swipe a[href^="/trades/"]').filter({ visible: true }).first());
  await expect(page).toHaveURL(/\/trades\/[0-9a-f-]{36}$/);
  await settled(page);
  await tap(page, page.getByRole("button", { name: "Zurück" }));
  await expect(page).toHaveURL(/\/trades(\?.*)?$/);
  await settled(page);
  const keyframes = await page.evaluate(() => (window as Window & { __keyframes?: string[] }).__keyframes ?? []);
  expect(keyframes.filter((k) => /translate/.test(k))).toEqual([]);
});

test("the edge swipe is off and the page does not move", async ({ page, finger }) => {
  await page.goto("/trades?range=all");
  await tap(page, page.locator('.ios-swipe a[href^="/trades/"]').filter({ visible: true }).first());
  await expect(page).toHaveURL(/\/trades\/[0-9a-f-]{36}$/);
  await settled(page);
  const detail = page.url();
  await finger.drag({ x: 8, y: 400 }, { x: 300, y: 404 }, { steps: 10, durationMs: 200 });
  await page.waitForTimeout(500);
  expect(page.url()).toBe(detail);
  await settled(page);
});
