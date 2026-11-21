import { expect, type Page } from "@playwright/test";

export const ADMIN_TOKEN = "e2e-admin-token";
export const VIEWER_TOKEN = "e2e-viewer-token";

export async function login(page: Page, token = ADMIN_TOKEN) {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Вход в консоль" })).toBeVisible();
  await page.locator("#token").fill(token);
  await page.getByRole("button", { name: /Войти/ }).click();
  await page.waitForURL("**/dashboard");
  await expect(
    page.getByRole("heading", { name: "Обзор инфраструктуры" }),
  ).toBeVisible();
}

export async function selectTab(page: Page, name: string) {
  const tab = page.getByRole("tab", { name: new RegExp(name) });
  await tab.click();
  await expect(tab).toHaveAttribute("data-state", "active");
}
