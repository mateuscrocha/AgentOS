import { expect, test, type Locator } from "playwright/test";

const TEST_EMAIL = process.env.TEST_EMAIL?.trim();
const TEST_PASSWORD = process.env.TEST_PASSWORD?.trim();

async function loginAsSystemAdmin(page: import("playwright/test").Page) {
  if (!TEST_EMAIL || !TEST_PASSWORD) return false;

  await page.goto("/auth");

  await expect(page.getByRole("heading", { name: "Central de Controle" })).toBeVisible();
  await page.getByLabel("Email").fill(TEST_EMAIL);
  await page.locator('input[autocomplete="current-password"]').fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();

  await page.waitForLoadState("networkidle").catch(() => {});

  const authError = page.getByRole("alert");
  if (await authError.isVisible().catch(() => false)) {
    const text = (await authError.textContent())?.trim() || "Falha de autenticação";
    throw new Error(`Nao foi possivel autenticar no CRM real: ${text}`);
  }

  await page.waitForFunction(() => window.location.pathname !== "/auth", undefined, {
    timeout: 20_000,
  });
  return true;
}

async function openRealPipeline(page: import("playwright/test").Page) {
  await page.goto("/system/crm/pipeline");
  await expect(page.getByRole("heading", { name: "CRM" })).toBeVisible();
  await expect(page.getByText("Pipeline", { exact: true }).first()).toBeVisible();
}

async function getRealPipelineCard(page: import("playwright/test").Page) {
  const taggedCards = page.locator('[data-testid="crm-pipeline-card"]');
  await page.waitForLoadState("networkidle").catch(() => {});

  if (await taggedCards.count()) {
    return taggedCards.first();
  }

  const articleCards = page.locator("main article");
  await expect(articleCards.first()).toBeVisible({ timeout: 20_000 });
  return articleCards.first();
}

async function expandCard(card: Locator) {
  const editButton = card.getByRole("button", { name: /^Editar / });
  if (!(await editButton.isVisible().catch(() => false))) {
    await card.click();
  }
  await expect(editButton).toBeVisible();
}

test("captura screenshots do pipeline do CRM, card expandido e modal de edicao", async ({
  page,
}, testInfo) => {
  let card: Locator;

  if (TEST_EMAIL && TEST_PASSWORD) {
    await loginAsSystemAdmin(page);
    await openRealPipeline(page);
    card = await getRealPipelineCard(page);
  } else {
    await page.goto("/dev/crm-sandbox");
    await expect(page.getByRole("heading", { name: "CRM Pipeline" })).toBeVisible();
    await expect(page.getByText("Pipeline", { exact: true }).first()).toBeVisible();
    card = page.locator('[data-testid="crm-pipeline-card"]', { hasText: "Clínica Aurora" }).first();
    await expect(card).toBeVisible();
  }

  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath("crm-pipeline-overview.png"),
  });

  await expandCard(card);

  await card.screenshot({
    path: testInfo.outputPath("crm-pipeline-card-expanded.png"),
  });

  await card.getByRole("button", { name: /^Editar / }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Editar lead / conta comercial")).toBeVisible();

  await dialog.screenshot({
    path: testInfo.outputPath("crm-pipeline-edit-dialog.png"),
  });
});
