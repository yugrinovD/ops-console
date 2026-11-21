import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("compares two models on the same prompt", async ({ page }) => {
  await login(page);
  await page.goto("/compare");
  await expect(page.getByText("Условия эксперимента")).toBeVisible();
  await page.locator("#prompt").fill("Write one sentence about observability.");
  const run = page.getByRole("button", { name: /Запустить/ });
  await expect(run).toBeEnabled();
  await run.click();
  await expect(page.getByText("fastest").first()).toBeVisible();
  await expect(page.getByText("cheapest").first()).toBeVisible();
  await expect(page.getByText("fewest tokens").first()).toBeVisible();
  await expect(page.getByText(/Mock response from gogate/).first()).toBeVisible();
});
