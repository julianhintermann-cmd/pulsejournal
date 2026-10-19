import { centre, expect, settled, tap, test } from "./fixtures";

/** Section 5: presented routes, sheets with detents, action sheets and banners. */
test.use({ standalone: true });

test("the + button presents the trade form as a sheet with a card stack", async ({ page }) => {
  await page.goto("/?range=all");
  await tap(page, page.getByRole("link", { name: "Neuer Trade" }).filter({ visible: true }).first());
  await expect(page).toHaveURL(/\/trades\/new\?mode=quick/);
  await expect(page.locator("html")).toHaveAttribute("data-presented", "");
  await expect(page.getByRole("radio", { name: "Schnell" }).filter({ visible: true })).toBeVisible();
  // Clean form: ✕ closes without asking.
  await tap(page, page.getByRole("button", { name: "Abbrechen" }).filter({ visible: true }).first());
  await expect(page).not.toHaveURL(/\/trades\/new/);
  await expect(page.locator("html")).not.toHaveAttribute("data-presented", "");
  await settled(page);
});

test("a dirty trade form asks before it is discarded", async ({ page }) => {
  await page.goto("/trades/new?mode=quick");
  // A known symbol: a new one creates the instrument on blur and its banner would cover the ✕ for a moment.
  await page.fill("#symbol", "NAS100");
  await tap(page, page.getByRole("button", { name: "Abbrechen" }).filter({ visible: true }).first());
  const sheet = page.getByRole("alertdialog");
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText("Änderungen verwerfen?")).toBeVisible();
  // Keep editing first …
  await tap(page, sheet.getByRole("button", { name: "Weiter bearbeiten" }));
  await expect(sheet).toBeHidden();
  await expect(page.locator("#symbol")).toHaveValue("NAS100");
  // … then discard.
  await tap(page, page.getByRole("button", { name: "Abbrechen" }).filter({ visible: true }).first());
  await tap(page, page.getByRole("alertdialog").getByRole("button", { name: "Verwerfen" }));
  await expect(page).not.toHaveURL(/\/trades\/new/);
});

test("a form sheet opens large and is dismissed by dragging it down", async ({ page, finger }) => {
  await page.goto("/accounts");
  await tap(page, page.getByRole("button", { name: "Neues Konto" }).filter({ visible: true }).first());
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-dialog-large", "");
  await page.waitForTimeout(500);
  const grab = await centre(page.locator(".ios-sheet__grabber"));
  await finger.drag(grab, { x: grab.x, y: grab.y + 520 }, { steps: 12, durationMs: 240 });
  await expect(dialog).toBeHidden();
  await expect(page.locator("html")).not.toHaveAttribute("data-dialog-large", "");
});

test("a dirty sheet asks before a swipe dismisses it", async ({ page, finger }) => {
  await page.goto("/accounts");
  await tap(page, page.getByRole("button", { name: "Neues Konto" }).filter({ visible: true }).first());
  await page.fill("#account-name", "Swing");
  await page.waitForTimeout(400);
  const grab = await centre(page.locator(".ios-sheet__grabber"));
  await finger.drag(grab, { x: grab.x, y: grab.y + 520 }, { steps: 12, durationMs: 240 });
  await expect(page.getByRole("alertdialog").getByText("Änderungen verwerfen?")).toBeVisible();
  await tap(page, page.getByRole("button", { name: "Änderungen verwerfen" }));
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("deleting from the trade menu asks with an action sheet", async ({ page }) => {
  await page.goto("/trades?range=all");
  await tap(page, page.locator('.ios-swipe a[href^="/trades/"]').filter({ visible: true }).first());
  await expect(page).toHaveURL(/\/trades\/[0-9a-f-]{36}$/);
  await settled(page);
  const detail = page.url();
  await tap(page, page.getByRole("button", { name: "Weitere Aktionen" }).filter({ visible: true }).first());
  await tap(page, page.getByRole("menuitem", { name: "Löschen" }));
  const sheet = page.getByRole("alertdialog");
  await expect(sheet).toBeVisible();
  await expect(sheet.locator(".ios-action-sheet__row.text-loss")).toBeVisible();
  await tap(page, sheet.locator(".ios-action-sheet__cancel"));
  await expect(sheet).toBeHidden();
  expect(page.url()).toBe(detail);
});
