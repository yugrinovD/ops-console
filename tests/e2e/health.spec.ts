import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("service status popover reports all four upstreams", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: /сервис/i }).click();
  await expect(page.getByText("gogate", { exact: true })).toBeVisible();
  await expect(page.getByText("lmlog", { exact: true })).toBeVisible();
  await expect(page.getByText("Prometheus", { exact: true })).toBeVisible();
  await expect(page.getByText("Jaeger", { exact: true })).toBeVisible();
  await expect(page.getByText("down", { exact: true })).toHaveCount(0);
});
