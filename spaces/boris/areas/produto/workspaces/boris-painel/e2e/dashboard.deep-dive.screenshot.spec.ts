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

test("explora profundamente o painel principal no app real", async ({ page }, testInfo) => {
  test.setTimeout(120_000);

  await login(page);

  await page.goto("/system");
  await expect(page.getByRole("heading", { name: "Panorama geral" })).toBeVisible();
  await shot(page, testInfo, "dashboard-overview.png");

  await page.locator("#kpis").scrollIntoViewIfNeeded();
  await shot(page, testInfo, "dashboard-kpis-section.png");

  await page.locator("#executive-summary").scrollIntoViewIfNeeded();
  await shot(page, testInfo, "dashboard-executive-summary.png");

  const firstGroupLink = page.locator('#executive-summary a[href^="/groups/"]').first();
  if (await firstGroupLink.isVisible().catch(() => false)) {
    await firstGroupLink.click();
    await expect(page).toHaveURL(/\/groups\/.+$/);
    await shot(page, testInfo, "dashboard-top-group-drilldown.png");
  }
});
