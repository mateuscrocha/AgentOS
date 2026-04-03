import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const targetDir = process.argv[2];

if (!targetDir) {
  console.error('Usage: node scripts/render_svgs_with_playwright.mjs <dir>');
  process.exit(1);
}

const absDir = path.resolve(targetDir);
const svgFiles = fs
  .readdirSync(absDir)
  .filter((file) => file.endsWith('.svg'))
  .sort();

if (svgFiles.length === 0) {
  console.error(`No SVG files found in ${absDir}`);
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1080, height: 1350 },
  deviceScaleFactor: 1,
});

for (const file of svgFiles) {
  const svgPath = path.join(absDir, file);
  const fileUrl = `file://${svgPath}`;
  await page.goto(fileUrl);
  await page.screenshot({
    path: path.join(absDir, file.replace(/\.svg$/, '.png')),
  });
}

await browser.close();
