import { chromium } from "playwright";

const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:8081";
const email = process.env.TEST_EMAIL;
const password = process.env.TEST_PASSWORD;
const groupPath = process.env.TEST_GROUP_PATH || "/groups/ac51f9fc-df8a-460d-a1fd-d0cb93be3142";

if (!email || !password) {
  throw new Error("Missing TEST_EMAIL or TEST_PASSWORD");
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const page = await context.newPage();

const supabaseRequests = [];
const errors = [];

page.on("requestfinished", async (request) => {
  const url = request.url();
  if (!url.includes("supabase.co")) return;
  const response = await request.response().catch(() => null);
  supabaseRequests.push({
    method: request.method(),
    url,
    status: response?.status() ?? null,
  });
});

page.on("pageerror", (error) => {
  errors.push(String(error));
});

page.on("console", (message) => {
  if (message.type() === "error") {
    errors.push(message.text());
  }
});

async function login() {
  await page.goto(`${baseUrl}/auth`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForFunction(() => window.location.pathname !== "/auth", undefined, { timeout: 20_000 });
  await page.waitForLoadState("networkidle").catch(() => {});
}

async function waitForDashboardReady() {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1500);
}

try {
  await login();

  const startedAt = Date.now();
  await page.goto(`${baseUrl}${groupPath}`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(new RegExp(groupPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  await page.getByRole("heading", { name: /grupo/i }).first().waitFor({ timeout: 30_000 }).catch(() => {});
  await waitForDashboardReady();
  const durationMs = Date.now() - startedAt;

  const supabase404 = supabaseRequests.filter((item) => item.status === 404).length;
  const groupedRequests = Object.entries(
    supabaseRequests.reduce((acc, item) => {
      const cleanUrl = item.url.replace(/\?.*$/, "");
      acc[cleanUrl] = (acc[cleanUrl] || 0) + 1;
      return acc;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  console.log(
    JSON.stringify(
      {
        success: true,
        url: page.url(),
        durationMs,
        supabaseRequestCount: supabaseRequests.length,
        supabase404,
        topSupabaseEndpoints: groupedRequests,
        errors,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(
    JSON.stringify(
      {
        success: false,
        url: page.url(),
        supabaseRequestCount: supabaseRequests.length,
        errors,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
} finally {
  await browser.close();
}
