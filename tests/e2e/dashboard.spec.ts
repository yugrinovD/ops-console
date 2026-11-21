import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("dashboard renders live KPIs, charts and usage", async ({ page }) => {
  await login(page);
  await expect(page.getByText("Requests / sec", { exact: true })).toBeVisible();
  await expect(page.getByText("p95 latency", { exact: true })).toBeVisible();
  await expect(page.getByText("p99 latency", { exact: true })).toBeVisible();
  await expect(page.getByText("Ошибки 5xx", { exact: true })).toBeVisible();
  await expect(page.getByText("Токены", { exact: true })).toBeVisible();
  await expect(page.getByText("Стоимость", { exact: true })).toBeVisible();
  await expect(page.getByText("Cache hit", { exact: true })).toBeVisible();
  await expect(page.getByText("Rate limited", { exact: true })).toBeVisible();
  await expect(page.getByText("Трафик и ошибки")).toBeVisible();
  await expect(page.getByText("Задержки", { exact: true })).toBeVisible();
  await expect(page.getByText("Токены и стоимость")).toBeVisible();
  await expect(page.getByText("mock", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("demo", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "1ч" }).click();
  await expect(page.getByRole("button", { name: "1ч" })).toHaveClass(/bg-secondary/);
});
