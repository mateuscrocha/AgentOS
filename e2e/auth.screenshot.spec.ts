import { expect, test } from "playwright/test";

test("captura screenshot da tela publica de autenticacao", async ({ page }, testInfo) => {
  await page.goto("/auth");

  await expect(page.getByRole("heading", { name: "Central de Controle" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.locator("#password")).toBeVisible();

  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath("auth-page.png"),
  });
});

test("captura screenshot da tela publica de onboarding", async ({ page }, testInfo) => {
  await page.goto("/signup");

  await expect(page.getByRole("heading", { name: "Criar organização" })).toBeVisible();
  await expect(page.getByLabel("Nome completo")).toBeVisible();
  await expect(page.getByLabel("Organização")).toBeVisible();
  await expect(page.getByPlaceholder("(11) 99999-9999")).toBeVisible();
  await expect(page.getByLabel("Link do grupo do WhatsApp")).toBeVisible();

  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath("onboarding-page.png"),
  });
});
