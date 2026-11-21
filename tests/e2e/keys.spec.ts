import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("keys page shows quotas, usage and creates a key once", async ({ page }) => {
  await login(page);
  await page.goto("/keys");
  await expect(page.getByText("API-ключи")).toBeVisible();
  await expect(page.getByText("demo", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("RPM 30")).toBeVisible();

  await page.getByRole("button", { name: "Создать ключ" }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Новый API-ключ")).toBeVisible();
  await dialog.locator("#key-name").fill("e2e-console-key");
  await dialog.getByRole("button", { name: "Создать ключ" }).click();

  await expect(page.getByRole("heading", { name: "Ключ создан" })).toBeVisible();
  await expect(page.getByText("gk_dev_e2e_newkey_plaintext_once")).toBeVisible();
  await page.getByRole("button", { name: "Я сохранил ключ" }).click();
  await expect(page.getByRole("heading", { name: "Ключ создан" })).toHaveCount(0);
});

test("tenant quota dialog is editable", async ({ page }) => {
  await login(page);
  await page.goto("/keys");
  const tenantCard = page
    .locator("div")
    .filter({ hasText: "Квоты тенантов" })
    .filter({ has: page.getByText("demo", { exact: true }) })
    .last();
  await tenantCard.getByRole("button", { name: "Настроить" }).first().click();
  await expect(page.getByRole("dialog").getByText("Квота")).toBeVisible();
  await expect(page.getByLabel("RPM")).toHaveValue("120");
});

test("quota dialog exposes tenant and key limits", async ({ page }) => {
  await login(page);
  await page.goto("/keys");
  const menu = page.getByRole("button", { name: "Действия" }).first();
  await menu.click();
  await page.getByRole("menuitem", { name: "Настроить квоту ключа" }).click();
  await expect(page.getByRole("dialog").getByText("Квота")).toBeVisible();
  await expect(page.getByLabel("RPM")).toBeVisible();
  await expect(page.getByLabel("Monthly cost budget, USD")).toBeVisible();
});
