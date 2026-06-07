import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const rootDir = process.cwd();
const productionOrigin = 'https://kamranboroomand.ir';
const skippedDirs = new Set([
  '.git',
  'node_modules',
  '.lighthouseci',
  'test-results',
  'playwright-report',
  'output'
]);
const scannedTextExtensions = new Set([
  '.html',
  '.css',
  '.js',
  '.mjs',
  '.json',
  '.webmanifest',
  '.xml',
  '.txt',
  '.md'
]);
const publicAssetDirs = [
  'assets/images',
  'assets/fonts',
  'assets/audio',
  'assets/data',
  'assets/docs'
];
const parsedImageExtensions = new Set(['.avif', '.gif', '.jpg', '.jpeg', '.png', '.svg', '.webp']);
const sourceOnlyAllowlist = new Map([
  [
    'assets/docs/kamran-boroomand-resume-ats.html',
    'Source-only HTML used by scripts/generate-resume-pdf.mjs to build the downloadable PDF.'
  ],
  [
    'assets/docs/resume-ats.css',
    'Source-only stylesheet used by scripts/generate-resume-pdf.mjs to render the resume PDF.'
  ],
  [
    'assets/fonts/README.md',
    'Font redistribution inventory retained for public repository transparency, not loaded at runtime.'
  ]
]);

const failures = [];
const referencedAssets = new Map();

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function normalizeLocalReference(rawValue) {
  const raw = String(rawValue || '')
    .trim()
    .replace(/&amp;/g, '&');
  if (!raw || raw.startsWith('#')) return null;

  if (/^(?:mailto|tel|data|javascript):/i.test(raw)) return null;
  if (/^\/\//.test(raw)) return null;

  let candidate = raw;
  try {
    const url = new URL(raw);
    if (url.origin !== productionOrigin) {
      return null;
    }
    candidate = `${url.pathname}${url.search}${url.hash}`;
  } catch {
    // Relative references are handled below.
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(candidate)) {
    return null;
  }

  if (
    candidate.includes('${') ||
    candidate.includes('$') ||
    candidate.includes('*') ||
    candidate.includes('\\') ||
    candidate.startsWith('/cdn-cgi/') ||
    /[\s,{}]/.test(candidate)
  ) {
    return null;
  }

  const localPathPrefixes = [
    '/',
    './',
    '../',
    'assets/',
    'projects/',
    'security/',
    '.well-known/',
    'index.html',
    '404.html',
    'robots.txt',
    'sitemap.xml',
    'CNAME'
  ];
  if (!localPathPrefixes.some((prefix) => candidate.startsWith(prefix))) {
    return null;
  }

  const withoutHash = candidate.split('#')[0];
  const withoutQuery = withoutHash.split('?')[0];
  const trimmed = withoutQuery.trim().replace(/[.,;:]+$/, '');
  if (!trimmed || trimmed === '/') return trimmed || null;

  return trimmed;
}

function rememberReference(target, fromFile) {
  if (!target) return;
  const normalized = toPosix(target).replace(/^\//, '').replace(/^\.\//, '');
  if (!normalized) return;

  if (!referencedAssets.has(normalized)) {
    referencedAssets.set(normalized, new Set());
  }
  referencedAssets.get(normalized).add(fromFile);
}

async function collectFiles(dir, result = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (skippedDirs.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(fullPath, result);
      continue;
    }

    if (entry.isFile()) {
      result.push(fullPath);
    }
  }
  return result;
}

function extractHtmlReferences(content) {
  const references = [];
  const attributePattern = /\b(?:href|src|poster|content|data-project-source)=["']([^"']+)["']/gi;
  const srcsetPattern = /\bsrcset=["']([^"']+)["']/gi;
  let match = attributePattern.exec(content);
  while (match) {
    references.push(match[1]);
    match = attributePattern.exec(content);
  }

  match = srcsetPattern.exec(content);
  while (match) {
    const values = String(match[1] || '')
      .split(',')
      .map((entry) => entry.trim().split(/\s+/)[0])
      .filter(Boolean);
    references.push(...values);
    match = srcsetPattern.exec(content);
  }

  return references;
}

function extractCssReferences(content) {
  return Array.from(content.matchAll(/url\((['"]?)(.*?)\1\)/gi)).map((match) => match[2]);
}

function extractStringPathReferences(content) {
  const references = [];
  const stringPathPattern =
    /["'`](\/?(?:\.{1,2}\/)?(?:assets|projects|security|\.well-known)\/[^"'`\s)]+)["'`]/g;
  let match = stringPathPattern.exec(content);
  while (match) {
    references.push(match[1]);
    match = stringPathPattern.exec(content);
  }
  return references;
}

function resolveReference(fromFile, rawReference) {
  const normalized = normalizeLocalReference(rawReference);
  if (normalized === null) return [];
  if (
    normalized.startsWith('./') &&
    !normalized.startsWith('./assets/') &&
    !fromFile.endsWith('.html') &&
    !fromFile.endsWith('.css')
  ) {
    return [];
  }

  const fromDir = path.dirname(path.join(rootDir, fromFile));
  const rootRelativePrefixes = [
    '/',
    './assets/',
    'assets/',
    './projects/',
    'projects/',
    './security/',
    'security/',
    './.well-known/',
    '.well-known/',
    'index.html',
    '404.html',
    'robots.txt',
    'sitemap.xml',
    'CNAME'
  ];
  const isRootRelative = rootRelativePrefixes.some((prefix) => normalized.startsWith(prefix));
  const rootRelativePath = normalized.replace(/^\//, '').replace(/^\.\//, '');
  const base = isRootRelative
    ? path.join(rootDir, rootRelativePath)
    : path.resolve(fromDir, normalized);
  const candidates = [];

  if (!normalized) {
    candidates.push(path.join(rootDir, 'index.html'));
    return candidates;
  }

  if (normalized.endsWith('/')) {
    candidates.push(base);
    candidates.push(path.join(base, 'index.html'));
    return candidates;
  }

  candidates.push(base);

  if (!path.extname(base)) {
    candidates.push(`${base}.html`);
    candidates.push(path.join(base, 'index.html'));
  }

  return candidates;
}

async function pathExists(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile() || stat.isDirectory();
  } catch {
    return false;
  }
}

async function checkReferencesInTextFiles() {
  const files = await collectFiles(rootDir);
  const textFiles = files.filter((file) => scannedTextExtensions.has(path.extname(file)));

  for (const file of textFiles) {
    const relativeFile = toPosix(path.relative(rootDir, file));
    const content = await fs.readFile(file, 'utf8');
    const references = [
      ...extractHtmlReferences(content),
      ...extractCssReferences(content),
      ...extractStringPathReferences(content)
    ];

    for (const reference of references) {
      const candidates = resolveReference(relativeFile, reference);
      if (!candidates.length) continue;

      let foundPath = '';
      for (const candidate of candidates) {
        if (await pathExists(candidate)) {
          foundPath = toPosix(path.relative(rootDir, candidate)) || 'index.html';
          break;
        }
      }

      if (!foundPath) {
        failures.push(`${relativeFile}: missing local asset/reference ${reference}`);
        continue;
      }

      rememberReference(foundPath, relativeFile);
    }
  }
}

async function checkResponsiveProjectAssets() {
  const projectsPath = path.join(rootDir, 'assets/data/projects.json');
  const payload = JSON.parse(await fs.readFile(projectsPath, 'utf8'));
  const projects = Array.isArray(payload.projects) ? payload.projects : [];

  for (const project of projects) {
    const image = project.image && typeof project.image === 'object' ? project.image : null;
    if (!image) continue;

    const source = normalizeLocalReference(image.src);
    if (source) {
      rememberReference(source, 'assets/data/projects.json');
    }

    const responsiveBase = String(image.responsiveBase || '').trim();
    const responsiveWidths = Array.isArray(image.responsiveWidths) ? image.responsiveWidths : [];
    for (const width of responsiveWidths) {
      for (const extension of ['avif', 'webp']) {
        const relativePath = `assets/images/responsive/${responsiveBase}-${width}.${extension}`;
        rememberReference(relativePath, 'assets/data/projects.json');
        if (!(await pathExists(path.join(rootDir, relativePath)))) {
          failures.push(`assets/data/projects.json: missing responsive asset ${relativePath}`);
        }
      }
    }
  }
}

async function checkImageFilesParse() {
  const files = await collectFiles(path.join(rootDir, 'assets/images'));
  for (const file of files) {
    const relativeFile = toPosix(path.relative(rootDir, file));
    const extension = path.extname(file).toLowerCase();
    if (!parsedImageExtensions.has(extension)) {
      continue;
    }

    try {
      await sharp(file).metadata();
    } catch (error) {
      failures.push(`${relativeFile}: invalid image file (${error.message})`);
    }
  }
}

async function checkUnusedPublicAssets() {
  for (const dir of publicAssetDirs) {
    const fullDir = path.join(rootDir, dir);
    const files = await collectFiles(fullDir);
    for (const file of files) {
      const relativeFile = toPosix(path.relative(rootDir, file));
      if (sourceOnlyAllowlist.has(relativeFile)) {
        continue;
      }

      if (!referencedAssets.has(relativeFile)) {
        failures.push(`${relativeFile}: public asset is not referenced or allowlisted`);
      }
    }
  }
}

await checkReferencesInTextFiles();
await checkResponsiveProjectAssets();
await checkImageFilesParse();
await checkUnusedPublicAssets();

if (failures.length) {
  console.error(
    `FAIL asset reference check (${failures.length} issue${failures.length === 1 ? '' : 's'})`
  );
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log(`PASS asset reference check (${referencedAssets.size} referenced assets verified)`);
}
