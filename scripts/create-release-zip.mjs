import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const rootDir = process.cwd();
const outputDir = path.join(rootDir, 'output');
const zipPath = path.join(outputDir, 'kamran-portfolio-public.zip');
const includePaths = [
  'index.html',
  '404.html',
  'projects',
  'security',
  'assets',
  '.nojekyll',
  '.well-known',
  'robots.txt',
  'sitemap.xml',
  'CNAME'
];
const forbiddenZipPathPatterns = [
  /(^|\/)\.git(\/|$)/,
  /(^|\/)node_modules(\/|$)/,
  /(^|\/)\.DS_Store$/,
  /(^|\/)__MACOSX(\/|$)/,
  /(^|\/)\._[^/]+$/,
  /(^|\/)\.lighthouseci(\/|$)/,
  /(^|\/)test-results(\/|$)/,
  /(^|\/)playwright-report(\/|$)/,
  /(^|\/)live-site-verification-report\.json$/,
  /(^|\/)uptime-monitor\.log$/,
  /(^|\/)\.env(?:\.|$)/,
  /\.log$/i,
  /(^|\/)scripts(\/|$)/,
  /(^|\/)tests(\/|$)/,
  /(^|\/)src(\/|$)/,
  /(^|\/)\.github(\/|$)/
];

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    ...options
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

async function existingIncludePaths() {
  const existing = [];
  for (const relativePath of includePaths) {
    try {
      await fs.access(path.join(rootDir, relativePath));
      existing.push(relativePath);
    } catch {
      throw new Error(`Required release path is missing: ${relativePath}`);
    }
  }
  return existing;
}

function listZipEntries(filePath) {
  const result = spawnSync('unzip', ['-Z1', filePath], {
    cwd: rootDir,
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    throw new Error(`Unable to inspect release ZIP: ${filePath}`);
  }

  return result.stdout
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function assertZipIsClean(entries) {
  const failures = [];
  for (const entry of entries) {
    for (const pattern of forbiddenZipPathPatterns) {
      if (pattern.test(entry)) {
        failures.push(entry);
      }
    }
  }

  if (failures.length) {
    throw new Error(`Release ZIP contains forbidden paths:\n- ${failures.join('\n- ')}`);
  }
}

runCommand(process.execPath, ['scripts/check-repo-hygiene.mjs']);

await fs.rm(outputDir, { recursive: true, force: true });
await fs.mkdir(outputDir, { recursive: true });

const paths = await existingIncludePaths();
runCommand('zip', ['-X', '-r', zipPath, ...paths], { stdio: 'pipe' });

const entries = listZipEntries(zipPath);
assertZipIsClean(entries);

console.log(
  `PASS release ZIP created: ${path.relative(rootDir, zipPath)} (${entries.length} entries)`
);
