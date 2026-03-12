import { chromium } from "playwright";

const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:4173";
const email = process.env.TEST_EMAIL;
const password = process.env.TEST_PASSWORD;

if (!email || !password) {
  throw new Error("Missing TEST_EMAIL or TEST_PASSWORD");
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const page = await context.newPage();

const visitLog = [];

async function waitForStableUrl(timeout = 15000) {
  await page.waitForFunction(
    () => window.location.pathname !== "/auth" && document.readyState !== "loading",
    { timeout },
  );
}

async function maybeClickLinkByText(label) {
  const link = page.getByRole("link", { name: label }).first();
  if ((await link.count()) === 0) return false;

  const href = await link.getAttribute("href");
  await link.click();
  await page.waitForLoadState("networkidle").catch(() => {});
  visitLog.push({ label, href, url: page.url() });
  return true;
}

try {
  await page.goto(`${baseUrl}/auth`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();

  await waitForStableUrl();
  await page.waitForLoadState("networkidle").catch(() => {});

  visitLog.push({ label: "post-login", href: null, url: page.url() });

  const candidateLinks = ["Painel", "Grupos", "Alertas", "Resumos", "Configurações", "Minha Conta"];
  for (const label of candidateLinks) {
    await maybeClickLinkByText(label);
  }

  const sidebarLinks = await page.locator("a[href]").evaluateAll((anchors) =>
    anchors
      .map((anchor) => ({
        text: anchor.textContent?.trim() || "",
        href: anchor.getAttribute("href"),
      }))
      .filter((item) => item.text),
  );

  console.log(JSON.stringify({
    success: true,
    currentUrl: page.url(),
    title: await page.title(),
    visitLog,
    sidebarLinks,
  }));
} catch (error) {
  console.error(JSON.stringify({
    success: false,
    currentUrl: page.url(),
    title: await page.title().catch(() => null),
    visitLog,
    error: error instanceof Error ? error.message : String(error),
  }));
  process.exitCode = 1;
} finally {
  await browser.close();
}
