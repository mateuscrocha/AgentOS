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
  await page.waitForFunction(() => window.location.pathname !== "/auth", undefined, { timeout: 20_000 });
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(900);
}

async function shot(page: Page, testInfo: { outputPath: (file: string) => string }, file: string) {
  await settle(page);
  await page.screenshot({ fullPage: true, path: testInfo.outputPath(file) });
}

test("explora profundamente o atendimento de um grupo no app real", async ({ page }, testInfo) => {
  test.setTimeout(120_000);

  await login(page);

  await page.goto("/system/groups");
  await expect(page.getByRole("heading", { name: "Grupos" })).toBeVisible();

  await page.locator("tbody tr").first().click();
  await expect(page).toHaveURL(/\/groups\/.+$/);
  const href = page.url();

  await page.goto(`${href.replace(/\/$/, "")}/support`);
  await expect(page.getByRole("heading", { name: "Atendimento" })).toBeVisible();
  await shot(page, testInfo, "group-support-overview.png");

  const searchInput = page.getByPlaceholder("Digite nome ou telefone");
  if (await searchInput.isVisible().catch(() => false)) {
    await searchInput.fill("ma");
    await settle(page);
    await shot(page, testInfo, "group-support-search-candidates.png");
  }

  const firstActionButton = page.getByRole("button", { name: /Desativar|Ativar|Remover/i }).first();
  if (await firstActionButton.isVisible().catch(() => false)) {
    await firstActionButton.click();
    await settle(page);
    await shot(page, testInfo, "group-support-row-action-state.png");
  }
});
