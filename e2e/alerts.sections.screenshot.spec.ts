import { expect, test } from "playwright/test";

const TEST_EMAIL = process.env.TEST_EMAIL?.trim();
const TEST_PASSWORD = process.env.TEST_PASSWORD?.trim();

test("captura screenshots das secoes principais de alertas no app real", async ({ page }, testInfo) => {
  if (!TEST_EMAIL || !TEST_PASSWORD) {
    throw new Error("Missing TEST_EMAIL or TEST_PASSWORD");
  }

  await page.goto("/auth");
  await expect(page.getByRole("heading", { name: "Central de Controle" })).toBeVisible();
  await page.getByLabel("Email").fill(TEST_EMAIL);
  await page.locator('input[autocomplete="current-password"]').fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForFunction(() => window.location.pathname !== "/auth", undefined, {
    timeout: 20_000,
  });

  const sections = [
    { path: "/system/alerts", file: "alerts-events-page.png" },
    { path: "/system/alert-definitions", file: "alerts-definitions-page.png" },
  ];

  for (const section of sections) {
    await page.goto(section.path);
    await expect(page.getByRole("heading", { name: /Alertas|Definições de alerta/ })).toBeVisible();
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath(section.file),
    });
  }
});
