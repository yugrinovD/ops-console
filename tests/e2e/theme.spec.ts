import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("switches theme and opens the command palette", async ({ page }) => {
  await login(page);
  const isDark = () =>
    page.evaluate(() => document.documentElement.classList.contains("dark"));
  expect(await isDark()).toBe(true);
  await page.getByRole("button", { name: "Переключить тему" }).click();
  await page.getByRole("menuitem", { name: "Светлая" }).click();
  await expect.poll(isDark).toBe(false);

  await page.keyboard.press("Control+k");
  await expect(
    page.getByPlaceholder("Перейти к разделу или действию…"),
  ).toBeVisible();
  await page.getByRole("option", { name: "Playground" }).click();
  await expect(page).toHaveURL(/\/playground/);
});
