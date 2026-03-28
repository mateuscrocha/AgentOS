import { expect, Locator, Page, test } from "playwright/test";

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

async function saveShot(page: Page, testInfo: { outputPath: (file: string) => string }, file: string) {
  await settle(page);
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath(file),
  });
}

async function clickIfVisible(locator: Locator) {
  if (await locator.count()) {
    const first = locator.first();
    if (await first.isVisible().catch(() => false)) {
      await first.click();
      return true;
    }
  }
  return false;
}

async function closeSurface(page: Page) {
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(250);
}

test("explora profundamente a area de grupos no app real", async ({ page }, testInfo) => {
  test.setTimeout(120_000);

  await login(page);

  await page.goto("/system/groups");
  await expect(page.getByRole("heading", { name: "Grupos" })).toBeVisible();
  await saveShot(page, testInfo, "groups-system-overview.png");

  const rowActions = page.getByLabel("Ações");
  if (await clickIfVisible(rowActions)) {
    await saveShot(page, testInfo, "groups-system-actions-menu.png");
    const editInvite = page.getByRole("menuitem").filter({ hasText: "Editar convite" }).first();
    if (await editInvite.isVisible().catch(() => false)) {
      await editInvite.click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await saveShot(page, testInfo, "groups-system-edit-invite.png");
      await closeSurface(page);
    }
  }

  if (await clickIfVisible(rowActions)) {
    const sendMessage = page.getByRole("menuitem").filter({ hasText: "Enviar mensagem" }).first();
    if (await sendMessage.isVisible().catch(() => false)) {
      await sendMessage.click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await saveShot(page, testInfo, "groups-system-send-message.png");
      await closeSurface(page);
    }
  }

  const firstGroupRow = page.locator("tbody tr").first();
  await firstGroupRow.click();
  await page.waitForURL(/\/groups\/.+$/);
  await expect(page.getByRole("heading", { name: /Painel do Grupo|Primeira visita ao grupo|Seu grupo/ })).toBeVisible();
  const groupUrl = page.url();

  await saveShot(page, testInfo, "group-dashboard-overview.png");

  if (await clickIfVisible(page.getByRole("button", { name: "Ver administradores" }))) {
    await expect(page.getByRole("dialog")).toBeVisible();
    await saveShot(page, testInfo, "group-dashboard-admins-dialog.png");
    await closeSurface(page);
  }

  if (await clickIfVisible(page.getByRole("button", { name: /Enviar mensagem|Enviar mensagem inicial/ }))) {
    await expect(page.getByRole("dialog")).toBeVisible();
    await saveShot(page, testInfo, "group-dashboard-send-message-dialog.png");
    await closeSurface(page);
  }

  const groupPath = new URL(groupUrl).pathname;

  await page.goto(`${groupPath}/members`);
  await expect(page.getByRole("heading", { name: "Membros" })).toBeVisible();
  await saveShot(page, testInfo, "group-members-overview.png");

  const firstMemberCard = page.locator("article[role='button']").first();
  if (await firstMemberCard.isVisible().catch(() => false)) {
    await firstMemberCard.click();
    if (await page.getByRole("dialog").isVisible().catch(() => false)) {
      await saveShot(page, testInfo, "group-members-details-dialog.png");
      await closeSurface(page);
    }
  }

  await page.goto(`${groupPath}/messages`);
  await expect(page.getByRole("heading", { name: "Mensagens" })).toBeVisible();
  await saveShot(page, testInfo, "group-messages-overview.png");

  if (await clickIfVisible(page.getByRole("button", { name: "Outros" }))) {
    await saveShot(page, testInfo, "group-messages-type-menu.png");
    await closeSurface(page);
  }

  const firstMessageCard = page.locator("article[role='button']").first();
  if (await firstMessageCard.isVisible().catch(() => false)) {
    await firstMessageCard.click();
    if (await page.getByRole("dialog").isVisible().catch(() => false)) {
      await saveShot(page, testInfo, "group-message-details-dialog.png");
      await closeSurface(page);
    }
  }

  if (await clickIfVisible(page.getByRole("button", { name: "Importar mensagens" }))) {
    await expect(page.getByRole("dialog")).toBeVisible();
    await saveShot(page, testInfo, "group-messages-import-dialog.png");
    await closeSurface(page);
  }

  await page.goto(`${groupPath}/summaries`);
  await expect(page.getByRole("heading", { name: /Diário|Painel do Grupo|Grupo/ })).toBeVisible();
  await saveShot(page, testInfo, "group-summaries-overview.png");

  const timelineButton = page.locator("button").filter({ hasText: /\d{1,2}\sde|dor|oportunidade|objeção|dia/i }).first();
  if (await timelineButton.isVisible().catch(() => false)) {
    await timelineButton.click();
    await saveShot(page, testInfo, "group-summaries-selected-day.png");
  }

  await page.goto(`${groupPath}/polls`);
  await expect(page.getByRole("heading", { name: "Enquetes" })).toBeVisible();
  await saveShot(page, testInfo, "group-polls-overview.png");

  const pollDetailsButton = page.getByLabel("Abrir detalhes da enquete").first();
  if (await pollDetailsButton.isVisible().catch(() => false)) {
    await pollDetailsButton.click();
    await saveShot(page, testInfo, "group-polls-expanded.png");
  }

  await page.goto(`${groupPath}/edit`);
  await expect(page.getByRole("heading", { name: "Configurações do grupo" })).toBeVisible();
  await saveShot(page, testInfo, "group-settings-overview.png");

  if (await clickIfVisible(page.getByRole("button", { name: "Mostrar" }).first())) {
    await saveShot(page, testInfo, "group-settings-expanded-section.png");
  }

  if (await clickIfVisible(page.getByRole("button", { name: "Ver lista" }))) {
    await settle(page);
    await saveShot(page, testInfo, "group-settings-admins-list.png");
  }

  if (await clickIfVisible(page.getByRole("button", { name: /Mostrar|Ocultar/ }).nth(1))) {
    await saveShot(page, testInfo, "group-settings-sensitive-actions.png");
  }
});
