import { expect, test } from "@playwright/test";
import { VIEWER_TOKEN, login } from "./helpers";

test.describe("authentication", () => {
  test("admin signs in and lands on the dashboard", async ({ page }) => {
    await login(page);
    await expect(page.getByText("Prometheus live")).toBeVisible();
    await expect(page.getByText("Топ моделей", { exact: true })).toBeVisible();
    await expect(page.getByText("Топ тенантов", { exact: true })).toBeVisible();
  });

  test("wrong token shows an inline error", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#token").fill("definitely-wrong");
    await page.getByRole("button", { name: /Войти/ }).click();
    await expect(page.locator('p[role="alert"]')).toContainText("Неверный токен доступа");
    await expect(page).toHaveURL(/\/login/);
  });

  test("viewer is read-only in the UI", async ({ page }) => {
    await login(page, VIEWER_TOKEN);
    await page.goto("/playground");
    await expect(
      page.getByText("Роль viewer не может отправлять запросы в playground."),
    ).toBeVisible();
    await page.goto("/keys");
    await expect(page.getByText("Только чтение", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Создать ключ" })).toHaveCount(0);
  });

  test("protected pages redirect to login", async ({ page }) => {
    await page.goto("/keys");
    await expect(page).toHaveURL(/\/login\?next=%2Fkeys/);
  });
});
