import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const skippedDirs = new Set([
  '.git',
  'node_modules',
  '.lighthouseci',
  'test-results',
  'playwright-report'
]);

function sanitizeTarget(target) {
  const [withoutHash] = String(target || '').split('#');
  const [withoutQuery] = withoutHash.split('?');
  return withoutQuery.trim();
}

function isExternalTarget(target) {
  const normalized = String(target || '')
    .trim()
    .toLowerCase();
  return (
    !normalized ||
    normalized.startsWith('#') ||
    normalized.startsWith('http://') ||
    normalized.startsWith('https://') ||
    normalized.startsWith('mailto:') ||
    normalized.startsWith('tel:') ||
    normalized.startsWith('data:') ||
    normalized.startsWith('javascript:') ||
    normalized.startsWith('//')
  );
}

async function collectHtmlFiles(dir, result = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (skippedDirs.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await collectHtmlFiles(fullPath, result);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.html')) {
      result.push(fullPath);
    }
  }

  return result;
}

function extractAttributeTargets(html) {
  const targets = [];
  const directAttributePattern = /\b(?:href|src|poster)=["']([^"']+)["']/gi;
  const srcSetPattern = /\bsrcset=["']([^"']+)["']/gi;

  let match = directAttributePattern.exec(html);
  while (match) {
    targets.push(match[1]);
    match = directAttributePattern.exec(html);
  }

  match = srcSetPattern.exec(html);
  while (match) {
    const values = String(match[1] || '')
      .split(',')
      .map((entry) => entry.trim().split(/\s+/)[0])
      .filter(Boolean);

    targets.push(...values);
    match = srcSetPattern.exec(html);
  }

  return targets;
}

async function pathExists(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

function resolveCandidates(htmlFilePath, rawTarget) {
  const normalized = sanitizeTarget(rawTarget);
  if (!normalized) {
    return [];
  }

  const resolvedBase = normalized.startsWith('/')
    ? path.resolve(rootDir, `.${normalized}`)
    : path.resolve(path.dirname(htmlFilePath), normalized);

  const candidates = [];
  const extension = path.extname(resolvedBase);

  if (normalized.endsWith('/')) {
    candidates.push(path.join(resolvedBase, 'index.html'));
    return candidates;
  }

  candidates.push(resolvedBase);

  if (!extension) {
    candidates.push(`${resolvedBase}.html`);
    candidates.push(path.join(resolvedBase, 'index.html'));
  }

  return candidates;
}

async function main() {
  const htmlFiles = await collectHtmlFiles(rootDir);
  const failures = [];

  for (const htmlFilePath of htmlFiles) {
    const content = await fs.readFile(htmlFilePath, 'utf8');
    const targets = extractAttributeTargets(content);

    for (const target of targets) {
      if (isExternalTarget(target)) {
        continue;
      }

      const candidates = resolveCandidates(htmlFilePath, target);
      if (!candidates.length) {
        continue;
      }

      let found = false;
      for (const candidate of candidates) {
        if (await pathExists(candidate)) {
          found = true;
          break;
        }
      }

      if (!found) {
        failures.push({
          file: path.relative(rootDir, htmlFilePath),
          target
        });
      }
    }
  }

  if (failures.length) {
    console.error(
      `FAIL internal link check (${failures.length} unresolved target${failures.length === 1 ? '' : 's'})`
    );
    for (const failure of failures) {
      console.error(`- ${failure.file} -> ${failure.target}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`PASS internal link check (${htmlFiles.length} HTML files scanned)`);
}

void main();
