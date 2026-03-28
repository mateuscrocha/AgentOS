import { expect, Page, test } from "playwright/test";

const TEST_EMAIL = process.env.TEST_EMAIL?.trim();
const TEST_PASSWORD = process.env.TEST_PASSWORD?.trim();

async function login(page: Page) {
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
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(700);
}

async function shot(page: Page, testInfo: { outputPath: (file: string) => string }, file: string) {
  await settle(page);
  await page.screenshot({ fullPage: true, path: testInfo.outputPath(file) });
}

test("explora profundamente a area de organizacoes no app real", async ({ page }, testInfo) => {
  test.setTimeout(180_000);

  await login(page);

  await page.goto("/system/organizations");
  await expect(page.getByRole("heading", { name: "Organizações" })).toBeVisible();
  await shot(page, testInfo, "organizations-system-overview.png");

  const firstRow = page.locator("tbody tr").first();
  await firstRow.hover();
  await firstRow.getByLabel("Ações").click({ force: true });
  await shot(page, testInfo, "organizations-system-actions-menu.png");
  await page.getByRole("menuitem", { name: "Editar" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await shot(page, testInfo, "organizations-system-edit-dialog.png");
  await page.keyboard.press("Escape");
  await settle(page);

  await page.getByRole("button", { name: "Nova organização" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await shot(page, testInfo, "organizations-system-create-dialog.png");
  await page.keyboard.press("Escape");
  await settle(page);

  await page.locator("tbody tr").first().click();
  await expect(page).toHaveURL(/\/organization\/.+$/);
  await shot(page, testInfo, "organization-detail-overview.png");

  const safeButtons = [
    "Atualizar Stripe",
    "Adicionar grupo",
    "Editar",
    "Revisar contato principal",
  ];

  for (const label of safeButtons) {
    const button = page.getByRole("button", { name: new RegExp(label, "i") }).first();
    const isVisible = await button.isVisible().catch(() => false);
    const isEnabled = await button.isEnabled().catch(() => false);
    if (isVisible && isEnabled) {
      await button.click();
      await settle(page);
      if (await page.getByRole("dialog").isVisible().catch(() => false)) {
        const fileSafe = label
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
        await shot(page, testInfo, `organization-detail-${fileSafe}-dialog.png`);
        await page.keyboard.press("Escape").catch(() => {});
        await settle(page);
      }
    }
  }
});
