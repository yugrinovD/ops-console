import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("request audit opens a sheet with an exact Jaeger waterfall", async ({
  page,
}) => {
  await login(page);
  await page.goto("/requests");
  await expect(page.getByText("Запросы и трейсы")).toBeVisible();
  await expect(page.getByText("e2e-request").first()).toBeVisible();
  await page.locator("tbody tr").first().click();
  await expect(page.getByText(/Request e2e-request/)).toBeVisible();
  await expect(page.getByText("Span waterfall", { exact: true })).toBeVisible();
  await expect(page.getByText("gateway.chat")).toBeVisible();
  await expect(page.getByText("provider.open")).toBeVisible();
  const jaeger = page.getByRole("link", { name: "Jaeger" });
  await expect(jaeger).toBeVisible();
  await expect(jaeger).toHaveAttribute("href", /\/jaeger\/trace\//);
});

test("audit filters narrow the table via the BFF", async ({ page }) => {
  await login(page);
  await page.goto("/requests");
  await expect(page.locator("tbody tr")).toHaveCount(3);
  await page.getByPlaceholder("request_id или key_prefix…").fill("e2e-request-0002");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.getByText("e2e-request-0002")).toBeVisible();
});
