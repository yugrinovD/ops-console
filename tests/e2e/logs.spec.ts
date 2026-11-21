import { expect, test } from "@playwright/test";
import { login, selectTab } from "./helpers";

const sample = `[2026-08-25T00:00:01.479726+00:00] app.ERROR: Failed request to Storage {method} {url} {statusCode} {"class":"App\\\\Infrastructure\\\\Storage\\\\SampleStorageClient"}\n[2026-08-25T10:00:00.000000+00:00] app.INFO: Some user event occurred {"class":"App\\\\Domain\\\\User\\\\SampleUserService"}\n`;

test("uploads a log, follows SSE progress and opens the snapshot", async ({
  page,
}) => {
  await login(page);
  await page.goto("/logs");
  await expect(page.getByText("Загруженные снимки")).toBeVisible();
  await expect(page.getByText("console-sample.log").first()).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles({
    name: "console-sample.log",
    mimeType: "text/plain",
    buffer: Buffer.from(sample),
  });

  await expect(page.getByText("Перетащите лог сюда")).toBeVisible();
  await expect(page.getByText("готово").first()).toBeVisible();
  await page.getByRole("link", { name: "Открыть снимок" }).click();
  await expect(page).toHaveURL(/\/logs\/55555555/);
  await expect(
    page.getByRole("heading", { name: "console-sample.log" }),
  ).toBeVisible();
  await expect(page.getByRole("tab", { name: /Сигнатуры/ })).toBeVisible();
});

test("snapshot tabs show errors, trends and grounded chat", async ({ page }) => {
  await login(page);
  await page.goto("/logs/55555555-5555-4555-8555-555555555555");
  await expect(
    page.getByRole("heading", { name: "console-sample.log" }),
  ).toBeVisible();
  await selectTab(page, "Ошибки");
  await expect(page.getByText("Failed request to Storage")).toBeVisible();
  await selectTab(page, "Тренды");
  await expect(page.getByText("anomalous growth")).toBeVisible();

  await selectTab(page, "Чат");
  await page.locator('textarea[placeholder^="Вопрос по снимку"]').fill(
    "What should I check first?",
  );
  await page.getByRole("button", { name: "Отправить вопрос" }).click();
  await expect(
    page.getByText(/The most frequent error is the storage request 404/),
  ).toBeVisible();
  await expect(page.getByText("heuristic")).toBeVisible();
});
