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

  await expect(page.getByRole("heading", { name: "Crie sua conta" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Quem está criando" })).toBeVisible();
  await expect(page.getByLabel("Nome completo")).toBeVisible();
  await expect(page.getByLabel("Organização")).toBeVisible();
  await expect(page.getByPlaceholder("(11) 99999-9999")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continuar" })).toBeVisible();

  await page.getByLabel("Nome completo").fill("Maria Oliveira");
  await page.getByLabel("Organização").fill("Resenha Beneficios");
  await page.getByLabel("Email").fill("maria@empresa.com");
  await page.getByLabel("WhatsApp").fill("(11) 99999-9999");
  await page.getByRole("button", { name: "Continuar" }).click();

  await expect(page.getByRole("heading", { name: "Crie sua senha" })).toBeVisible();
  await page.getByLabel(/^Senha$/).fill("Senha!12345");
  await page.getByLabel("Confirmar senha").fill("Senha!12345");
  await page.getByRole("button", { name: "Continuar" }).click();

  await expect(page.getByRole("heading", { name: "Conecte seu grupo" })).toBeVisible();
  await expect(page.getByLabel("Link do grupo do WhatsApp")).toBeVisible();

  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath("onboarding-page.png"),
  });
});
