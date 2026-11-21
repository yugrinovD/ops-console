import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { login } from "./helpers";

const dir = "docs/screenshots";

async function top(page: import("@playwright/test").Page) {
  await page.evaluate(() => window.scrollTo(0, 0));
}

test("capture desktop screenshots for the documentation", async ({ page }) => {
  await mkdir(dir, { recursive: true });

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Вход в консоль" })).toBeVisible();
  await page.screenshot({ path: `${dir}/login.jpg`, type: "jpeg", quality: 88 });

  await login(page);
  await expect(page.getByText("Трафик и ошибки")).toBeVisible();
  await top(page);
  await page.screenshot({ path: `${dir}/dashboard.jpg`, type: "jpeg", quality: 88 });

  await page.goto("/playground");
  await page.locator('textarea[placeholder^="Сообщение"]').fill(
    "Summarize the purpose of this console.",
  );
  await page.getByRole("button", { name: "Отправить" }).click();
  await expect(page.getByText(/Mock streaming response/)).toBeVisible();
  await top(page);
  await page.screenshot({ path: `${dir}/playground.jpg`, type: "jpeg", quality: 88 });

  await page.goto("/keys");
  await expect(page.getByText("API-ключи")).toBeVisible();
  await expect(page.getByText("demo", { exact: true }).first()).toBeVisible();
  await top(page);
  await page.screenshot({ path: `${dir}/keys.jpg`, type: "jpeg", quality: 88 });

  await page.goto("/logs/55555555-5555-4555-8555-555555555555");
  await expect(page.getByRole("tab", { name: /Сигнатуры/ })).toBeVisible();
  await top(page);
  await page.screenshot({ path: `${dir}/logs.jpg`, type: "jpeg", quality: 88 });

  await page.goto("/requests");
  await page.locator("tbody tr").first().click();
  await expect(page.getByText("Span waterfall", { exact: true })).toBeVisible();
  await top(page);
  await page.screenshot({ path: `${dir}/requests.jpg`, type: "jpeg", quality: 88 });

  await page.goto("/alerts");
  await expect(
    page.getByText(/e2e-alert|Правил пока нет/).first(),
  ).toBeVisible();
  await top(page);
  await page.screenshot({ path: `${dir}/alerts.jpg`, type: "jpeg", quality: 88 });

  await page.goto("/compare");
  await page.locator("#prompt").fill("Explain observability in one sentence.");
  await page.getByRole("button", { name: /Запустить/ }).click();
  await expect(page.getByText("fastest").first()).toBeVisible();
  await top(page);
  await page.screenshot({ path: `${dir}/compare.jpg`, type: "jpeg", quality: 88 });
});
