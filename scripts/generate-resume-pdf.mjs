import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const cwd = process.cwd();
const sourcePath = path.resolve(cwd, 'assets/docs/kamran-boroomand-resume-ats.html');
const outputPath = path.resolve(cwd, 'assets/docs/kamran-boroomand-resume-ats.pdf');

const html = await fs.readFile(sourcePath, 'utf8');

async function resolveBrowserExecutable() {
  const home = process.env.HOME;
  if (!home) {
    return null;
  }

  const cacheRoot = path.join(home, 'Library', 'Caches', 'ms-playwright');
  let entries;

  try {
    entries = await fs.readdir(cacheRoot, { withFileTypes: true });
  } catch {
    return null;
  }

  const browserDirs = entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('chromium_headless_shell-'))
    .map((entry) => entry.name)
    .sort((a, b) => b.localeCompare(a));

  for (const browserDir of browserDirs) {
    const armBinary = path.join(
      cacheRoot,
      browserDir,
      'chrome-headless-shell-mac-arm64',
      'chrome-headless-shell'
    );
    const x64Binary = path.join(
      cacheRoot,
      browserDir,
      'chrome-headless-shell-mac-x64',
      'chrome-headless-shell'
    );

    try {
      await fs.access(armBinary);
      return armBinary;
    } catch {
      // try next path
    }

    try {
      await fs.access(x64Binary);
      return x64Binary;
    } catch {
      // try next path
    }
  }

  return null;
}

const launchOptions = { headless: true };
const executablePath = await resolveBrowserExecutable();
if (executablePath) {
  launchOptions.executablePath = executablePath;
}

const browser = await chromium.launch(launchOptions);
const page = await browser.newPage();

await page.setContent(html, { waitUntil: 'networkidle' });
await page.pdf({
  path: outputPath,
  printBackground: true,
  preferCSSPageSize: true,
  margin: {
    top: '0',
    right: '0',
    bottom: '0',
    left: '0'
  }
});

await browser.close();

console.log(`generated ${path.relative(cwd, outputPath)}`);
