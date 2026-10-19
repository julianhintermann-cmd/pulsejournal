import { expect, test } from "@playwright/test";

const USER = "pulse-owner";
const PASSWORD = "sehr-geheim-123";

test.describe.configure({ mode: "serial" });

test("setup, account, quick trade, dashboard, list, logout and login", async ({ page }) => {
  // First start: every route leads to the setup page.
  await page.goto("/");
  await expect(page).toHaveURL(/\/setup$/);
  await page.fill("#username", USER);
  await page.fill("#password", PASSWORD);
  await page.fill("#passwordConfirm", PASSWORD);
  await page.fill("#accountName", "Hauptkonto");
  await page.fill("#startingBalance", "10000");
  await page.getByRole("button", { name: "Einrichtung abschliessen" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Noch keine Trades" })).toBeVisible();

  // Create a second account.
  await page.goto("/accounts");
  await page.getByRole("button", { name: "Neues Konto" }).first().click();
  await page.fill("#account-name", "Prop Challenge");
  await page.fill("#account-balance", "50000");
  await page.getByRole("dialog").getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByRole("heading", { name: "Prop Challenge" })).toBeVisible();

  // Quick-add a trade from the "+" button.
  await page.goto("/");
  await page.getByRole("link", { name: "Neuer Trade" }).first().click();
  await expect(page).toHaveURL(/\/trades\/new/);
  await page.getByRole("radio", { name: "Schnell" }).click();
  await page.selectOption("#accountId", { label: "Hauptkonto · CHF" });
  await page.fill("#symbol", "NAS100");
  await page.keyboard.press("Tab");
  await expect(page.getByText("Neues Instrument angelegt")).toBeVisible();
  await page.fill("#entryPrice", "20000");
  await page.fill("#exitPrice", "20100");
  await page.fill("#qty", "2");
  await page.fill("#initialStop", "19950");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page).toHaveURL(/\/trades\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "NAS100" })).toBeVisible();
  await expect(page.getByText("+2.00R").first()).toBeVisible();

  // It shows up on the dashboard …
  await page.goto("/?range=all");
  await expect(page.getByText("Letzte Trades")).toBeVisible();
  await expect(page.getByRole("link", { name: /NAS100/ }).first()).toBeVisible();
  await expect(page.getByText("+CHF 200.00").first()).toBeVisible();

  // … and in the trade list.
  await page.goto("/trades?range=all");
  await expect(page.getByRole("link", { name: /NAS100/ }).first()).toBeVisible();

  // Logout and login again.
  await page.goto("/more");
  await page.getByRole("button", { name: "Abmelden" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.fill("#username", USER);
  await page.fill("#password", "falsches-passwort");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByText("Benutzername oder Passwort falsch.")).toBeVisible();
  await page.fill("#password", PASSWORD);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: new RegExp(`, ${USER}$`) })).toBeVisible();
});
