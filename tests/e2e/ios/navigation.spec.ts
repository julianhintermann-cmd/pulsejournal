import { centre, expect, settled, tap, test } from "./fixtures";

/** Section 4: tab bar, navigation bar, stack transitions and the edge swipe (home-screen app). */
test.use({ standalone: true });

const TAB_OF = (path: string) =>
  path === "/" ? "Übersicht" : path.startsWith("/trades") ? "Trades" : path.startsWith("/journal") ? "Journal" : "Mehr";

const tabItem = (page: import("@playwright/test").Page, label: string) =>
  page.locator(".ios-tabbar__item", { hasText: label });

const firstTradeRow = (page: import("@playwright/test").Page) =>
  page.locator('.ios-swipe a[href^="/trades/"]').filter({ visible: true }).first();

test("tab bar switches tabs and marks the current one", async ({ page }) => {
  await page.goto("/?range=all");
  await expect(page.locator(".ios-tabbar")).toBeVisible();
  for (const [label, path] of [
    ["Trades", /\/trades/],
    ["Journal", /\/journal/],
    ["Mehr", /\/more/],
    ["Übersicht", /\/(\?.*)?$/],
  ] as const) {
    await tap(page, tabItem(page, label));
    await expect(page).toHaveURL(path);
    await expect(tabItem(page, label)).toHaveAttribute("aria-current", "page");
    await expect(page.locator(".ios-tabbar__item[aria-current=page]")).toHaveCount(1);
  }
});

test("push to a trade and pop back with the back button keeps the scroll position", async ({ page }) => {
  await page.goto("/trades?range=all");
  // The app restores positions itself; the browser's own (late, in Safari) restore must not interfere.
  await expect.poll(() => page.evaluate(() => history.scrollRestoration)).toBe("manual");
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(200);
  const row = page.locator('.ios-swipe a[href^="/trades/"]').filter({ visible: true }).nth(3);
  await row.scrollIntoViewIfNeeded();
  const scrollBefore = await page.evaluate(() => Math.round(window.scrollY));
  await tap(page, row);
  await expect(page).toHaveURL(/\/trades\/[0-9a-f-]{36}$/);
  await settled(page);
  await expect(page.getByRole("button", { name: "Zurück" })).toBeVisible();
  await tap(page, page.getByRole("button", { name: "Zurück" }));
  await expect(page).toHaveURL(/\/trades(\?.*)?$/);
  await settled(page);
  await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBeGreaterThan(scrollBefore - 60);
});

test("edge swipe pops, a short swipe snaps back", async ({ page, finger }) => {
  await page.goto("/trades?range=all");
  await tap(page, firstTradeRow(page));
  await expect(page).toHaveURL(/\/trades\/[0-9a-f-]{36}$/);
  await settled(page);
  const detail = page.url();
  const width = page.viewportSize()!.width;

  // A short, slow swipe is cancelled.
  await finger.drag({ x: 8, y: 400 }, { x: width * 0.2, y: 404 }, { steps: 10, durationMs: 400, holdMs: 150 });
  await settled(page);
  expect(page.url()).toBe(detail);

  // Past the threshold it completes.
  await finger.drag({ x: 8, y: 400 }, { x: width * 0.7, y: 406 }, { steps: 14, durationMs: 300 });
  await expect(page).toHaveURL(/\/trades(\?.*)?$/);
  await settled(page);
});

test("tapping the active tab scrolls to the top", async ({ page }) => {
  await page.goto("/trades?range=all");
  await page.evaluate(() => window.scrollTo(0, 900));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
  // Scrolling down collapses the tab bar into the mini capsule: the first tap expands it, the second scrolls up.
  if (await page.locator(".ios-tabbar[data-collapsed]").count()) await tap(page, page.locator(".ios-tabbar__mini"));
  await tap(page, tabItem(page, "Trades"));
  await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 3_000 }).toBeLessThan(5);
  await expect(page).toHaveURL(/\/trades/);
});

test("large title hands over to the inline title when scrolled", async ({ page }) => {
  await page.goto("/trades?range=all");
  await expect(page.locator(".ios-large-title")).toBeVisible();
  await expect(page.locator(".ios-navbar[data-inline-title]")).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 300));
  await expect(page.locator(".ios-navbar[data-inline-title]")).toHaveCount(1);
});

test("rapid tab and row taps never leave a broken stack", async ({ page, browserName }) => {
  test.slow();
  const errors: string[] = [];
  if (browserName === "chromium") {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  }
  const rounds = Number(process.env.STACK_RACE_ROUNDS ?? 20);
  for (let i = 0; i < rounds; i++) {
    await page.evaluate(() => sessionStorage.clear()).catch(() => undefined);
    await page.goto(i % 2 ? "/journal" : "/?range=all", { waitUntil: "networkidle" });
    const frames = (i * 7) % 23;
    const { x, y } = await centre(tabItem(page, "Trades"));
    await page.touchscreen.tap(x, y);
    await page.evaluate(
      (n) =>
        new Promise<void>((resolve) => {
          let k = 0;
          const step = () => (k++ >= n ? resolve() : requestAnimationFrame(step));
          step();
        }),
      frames,
    );
    // Whatever screen is showing now: tap where the first row is.
    await page.touchscreen.tap(200, 260);
    await page.waitForTimeout(600);
    await settled(page);
    const state = await page.evaluate(() => ({
      path: location.pathname,
      under:
        (document.querySelector(".ios-stack-under")?.hasAttribute("data-active") ?? false) &&
        !document.documentElement.hasAttribute("data-presented"),
      over: document.querySelector(".ios-stack-over")?.hasAttribute("data-active") ?? false,
      current: [...document.querySelectorAll(".ios-tabbar__item[aria-current=page]")].map((a) => a.textContent),
    }));
    if (state.under || state.over || state.current.length !== 1 || state.current[0] !== TAB_OF(state.path)) {
      errors.push(`round ${i} (${frames} frames): ${JSON.stringify(state)}`);
    }
  }
  expect(errors).toEqual([]);
});
