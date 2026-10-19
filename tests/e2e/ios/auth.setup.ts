import { expect, test } from "@playwright/test";

/** Creates the owner on the seeded demo server once and stores the session for the iOS projects. */
const USER = "demo";
const PASSWORD = "demo-passwort-123";

test("set up the demo owner", async ({ page }) => {
  await page.goto("/");
  if (page.url().includes("/setup")) {
    await page.fill("#username", USER);
    await page.fill("#password", PASSWORD);
    await page.fill("#passwordConfirm", PASSWORD);
    await page.fill("#accountName", "Hauptkonto");
    await page.fill("#startingBalance", "10000");
    await page.getByRole("button", { name: "Einrichtung abschliessen" }).click();
  } else if (page.url().includes("/login")) {
    await page.fill("#username", USER);
    await page.fill("#password", PASSWORD);
    await page.getByRole("button", { name: "Anmelden" }).click();
  }
  await expect(page).toHaveURL(/\/$/);
  // Follow the emulated colour scheme so the dark and light projects really differ.
  await page.goto("/settings");
  await page.getByRole("radio", { name: "System" }).filter({ visible: true }).first().click();
  await page.waitForTimeout(300);
  await page.context().storageState({ path: "tests/e2e/.auth/ios.json" });
});
