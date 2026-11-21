import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("creates and evaluates a threshold rule", async ({ page }) => {
  const name = "e2e-alert";
  await login(page);
  await page.goto("/alerts");
  await page.getByRole("button", { name: "Новое правило" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator("#alert-name").fill(name);
  await dialog.getByRole("button", { name: "Сохранить" }).click();
  await expect(page.getByText(name)).toBeVisible();
  await expect(page.getByText("5xx rate, %").first()).toBeVisible();
});

test("viewer cannot create alert rules", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login");
  await page.locator("#token").fill("e2e-viewer-token");
  await page.getByRole("button", { name: /Войти/ }).click();
  await page.waitForURL("**/dashboard");
  await page.goto("/alerts");
  await expect(page.getByText("Только чтение", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Новое правило" })).toHaveCount(0);
  await context.close();
});
