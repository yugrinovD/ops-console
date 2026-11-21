import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("playground streams a response with provider and usage metadata", async ({
  page,
}) => {
  await login(page);
  await page.goto("/playground");
  const input = page.locator('textarea[placeholder^="Сообщение"]');
  await input.fill("Explain the gateway in one sentence.");
  const send = page.getByRole("button", { name: "Отправить" });
  await expect(send).toBeEnabled();
  await send.click();
  await expect(
    page.getByText("Mock streaming response from gogate."),
  ).toBeVisible();
  await expect(page.getByText("cache BYPASS")).toBeVisible();
  await expect(page.getByText(/^mock$/).first()).toBeVisible();
  await expect(page.getByText(/14 \+ 24 токенов/)).toBeVisible();
  await expect(page.getByText(/finish=stop/)).toBeVisible();
});

test("non-streaming mode renders a complete answer", async ({ page }) => {
  await login(page);
  await page.goto("/playground");
  const sse = page.locator("label").filter({ hasText: "SSE" }).getByRole("switch");
  await sse.click();
  const input = page.locator('textarea[placeholder^="Сообщение"]');
  await input.fill("Hello non-stream");
  await page.getByRole("button", { name: "Отправить" }).click();
  await expect(page.getByText(/Mock response from gogate/)).toBeVisible();
});
