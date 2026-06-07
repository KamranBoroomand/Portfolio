import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const rootDir = process.cwd();
const skippedDirs = new Set(['.git', 'node_modules']);
const releaseArtifactDirs = new Set([
  'build',
  'dist',
  'output',
  'release',
  'releases',
  'artifacts'
]);
const forbiddenTopLevelNames = new Set([
  '.DS_Store',
  '__MACOSX',
  '.lighthouseci',
  'test-results',
  'playwright-report',
  'live-site-verification-report.json',
  'uptime-monitor.log'
]);
const forbiddenPrivateKeyPatterns = [
  /^id_rsa$/i,
  /^id_dsa$/i,
  /^id_ecdsa$/i,
  /^id_ed25519$/i,
  /\.pem$/i,
  /\.p12$/i,
  /\.pfx$/i,
  /private[-_]?key/i
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
  /\.log$/i
];

const failures = [];

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function isEnvFile(name) {
  return name === '.env' || (name.startsWith('.env.') && name !== '.env.example');
}

function isForbiddenPrivateKey(name) {
  return forbiddenPrivateKeyPatterns.some((pattern) => pattern.test(name));
}

function isForbiddenLogOrCache(name) {
  return /\.log$/i.test(name) || /\.cache$/i.test(name);
}

async function scanTree(dir, relativeDir = '') {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const isInsideReleaseArtifact = relativeDir
    .split('/')
    .some((segment) => releaseArtifactDirs.has(segment));

  for (const entry of entries) {
    const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
    const fullPath = path.join(dir, entry.name);

    if (skippedDirs.has(entry.name) && !isInsideReleaseArtifact) {
      continue;
    }

    if (entry.name === '.git' && isInsideReleaseArtifact) {
      failures.push(`${relativePath}: .git must not exist inside release/export artifacts`);
    }

    if (entry.name === 'node_modules' && isInsideReleaseArtifact) {
      failures.push(`${relativePath}: node_modules must not exist inside release/export artifacts`);
    }

    if (
      forbiddenTopLevelNames.has(entry.name) ||
      entry.name.startsWith('._') ||
      isEnvFile(entry.name) ||
      isForbiddenPrivateKey(entry.name) ||
      isForbiddenLogOrCache(entry.name)
    ) {
      failures.push(`${relativePath}: forbidden local/private artifact`);
    }

    if (entry.isDirectory()) {
      await scanTree(fullPath, relativePath);
    }
  }
}

async function collectZipFiles(dir, result = []) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return result;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectZipFiles(fullPath, result);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.zip')) {
      result.push(fullPath);
    }
  }
  return result;
}

function inspectZip(zipFile) {
  const result = spawnSync('unzip', ['-Z1', zipFile], {
    cwd: rootDir,
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    failures.push(`${toPosix(path.relative(rootDir, zipFile))}: unable to inspect ZIP artifact`);
    return;
  }

  const entries = result.stdout
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean);

  for (const entry of entries) {
    for (const pattern of forbiddenZipPathPatterns) {
      if (pattern.test(entry)) {
        failures.push(`${toPosix(path.relative(rootDir, zipFile))}: forbidden ZIP entry ${entry}`);
      }
    }
  }
}

await scanTree(rootDir);
const zipFiles = await collectZipFiles(path.join(rootDir, 'output'));
zipFiles.forEach(inspectZip);

if (failures.length) {
  console.error(
    `FAIL repo hygiene check (${failures.length} issue${failures.length === 1 ? '' : 's'})`
  );
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log('PASS repo hygiene check');
}
