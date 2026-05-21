import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const releaseLastmod = '2026-05-21';
const productionOrigin = 'https://kamranboroomand.ir';

const pages = [
  {
    file: 'index.html',
    canonical: `${productionOrigin}/`,
    requiredJsonLdTypes: ['Person', 'WebSite', 'CollectionPage', 'ItemList'],
    requiredLinks: ['icon', 'apple-touch-icon', 'manifest'],
    hreflang: {
      en: `${productionOrigin}/`,
      ru: `${productionOrigin}/?lang=ru`,
      fa: `${productionOrigin}/?lang=fa`,
      'x-default': `${productionOrigin}/`
    }
  },
  {
    file: 'projects/nullid/index.html',
    canonical: `${productionOrigin}/projects/nullid/`,
    requiredJsonLdTypes: ['Person', 'WebSite', 'WebPage', 'SoftwareSourceCode', 'BreadcrumbList'],
    requiredLinks: ['icon', 'apple-touch-icon', 'manifest'],
    hreflang: {
      en: `${productionOrigin}/projects/nullid/`,
      'x-default': `${productionOrigin}/projects/nullid/`
    }
  },
  {
    file: 'projects/nullcal/index.html',
    canonical: `${productionOrigin}/projects/nullcal/`,
    requiredJsonLdTypes: ['Person', 'WebSite', 'WebPage', 'SoftwareSourceCode', 'BreadcrumbList'],
    requiredLinks: ['icon', 'apple-touch-icon', 'manifest'],
    hreflang: {
      en: `${productionOrigin}/projects/nullcal/`,
      'x-default': `${productionOrigin}/projects/nullcal/`
    }
  },
  {
    file: 'projects/pacman/index.html',
    canonical: `${productionOrigin}/projects/pacman/`,
    requiredJsonLdTypes: ['Person', 'WebSite', 'WebPage', 'SoftwareSourceCode', 'BreadcrumbList'],
    requiredLinks: ['icon', 'apple-touch-icon', 'manifest'],
    hreflang: {
      en: `${productionOrigin}/projects/pacman/`,
      'x-default': `${productionOrigin}/projects/pacman/`
    }
  },
  {
    file: 'projects/nullkeys/index.html',
    canonical: `${productionOrigin}/projects/nullkeys/`,
    requiredJsonLdTypes: ['Person', 'WebSite', 'WebPage', 'SoftwareSourceCode', 'BreadcrumbList'],
    requiredLinks: ['icon', 'apple-touch-icon', 'manifest'],
    hreflang: {
      en: `${productionOrigin}/projects/nullkeys/`,
      'x-default': `${productionOrigin}/projects/nullkeys/`
    }
  },
  {
    file: 'security/index.html',
    canonical: `${productionOrigin}/security/`,
    requiredJsonLdTypes: ['Person', 'WebSite', 'WebPage', 'BreadcrumbList'],
    requiredLinks: ['icon', 'apple-touch-icon', 'manifest'],
    hreflang: {
      en: `${productionOrigin}/security/`,
      'x-default': `${productionOrigin}/security/`
    }
  }
];

const sitemapUrls = [
  `${productionOrigin}/`,
  `${productionOrigin}/?lang=ru`,
  `${productionOrigin}/?lang=fa`,
  `${productionOrigin}/projects/nullid/`,
  `${productionOrigin}/projects/nullcal/`,
  `${productionOrigin}/projects/pacman/`,
  `${productionOrigin}/projects/nullkeys/`,
  `${productionOrigin}/security/`
];

const placeholderPatterns = [
  /\bUpdating\.\.\./i,
  /\bTBD\b/i,
  /\bComing soon\b/i,
  /Last updated: February 2026/i,
  /Обновляется\.\.\./i,
  /Обновлено: февраль 2026/i,
  /در حال به‌روزرسانی\.\.\./i,
  /آخرین به‌روزرسانی: فوریه ۲۰۲۶/i
];

const failures = [];

async function readText(relativePath) {
  return fs.readFile(path.join(rootDir, relativePath), 'utf8');
}

async function exists(relativePath) {
  try {
    await fs.access(path.join(rootDir, relativePath));
    return true;
  } catch {
    return false;
  }
}

function findMetaContent(html, attributeName, attributeValue) {
  const pattern = new RegExp(
    `<meta\\b(?=[^>]*\\b${attributeName}=["']${attributeValue}["'])[^>]*>`,
    'i'
  );
  const tag = html.match(pattern)?.[0] || '';
  return tag.match(/\bcontent=(["'])(.*?)\1/is)?.[2] || '';
}

function hasLink(html, rel, href) {
  const hrefLookahead = href ? `(?=[^>]*\\bhref=["']${escapeRegExp(href)}["'])` : '';
  const pattern = new RegExp(`<link\\b(?=[^>]*\\brel=["']${rel}["'])${hrefLookahead}[^>]*>`, 'i');
  return pattern.test(html);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function requireNonEmpty(value, message) {
  if (!String(value || '').trim()) {
    failures.push(message);
  }
}

function extractJsonLdTypes(html, file) {
  const scripts = Array.from(
    html.matchAll(
      /<script\b(?=[^>]*type=["']application\/ld\+json["'])[^>]*>([\s\S]*?)<\/script>/gi
    )
  );

  if (!scripts.length) {
    failures.push(`${file}: missing JSON-LD script`);
    return new Set();
  }

  const types = new Set();
  for (const script of scripts) {
    try {
      const payload = JSON.parse(script[1]);
      const nodes = Array.isArray(payload?.['@graph']) ? payload['@graph'] : [payload];
      for (const node of nodes) {
        const type = node?.['@type'];
        if (Array.isArray(type)) {
          type.forEach((entry) => types.add(entry));
        } else if (type) {
          types.add(type);
        }
      }
    } catch (error) {
      failures.push(`${file}: invalid JSON-LD (${error.message})`);
    }
  }

  return types;
}

async function checkPage(page) {
  if (!(await exists(page.file))) {
    failures.push(`${page.file}: required public page is missing`);
    return;
  }

  const html = await readText(page.file);
  requireNonEmpty(
    html.match(/<title(?:\s[^>]*)?>(.*?)<\/title>/is)?.[1],
    `${page.file}: missing title`
  );
  requireNonEmpty(
    findMetaContent(html, 'name', 'description'),
    `${page.file}: missing meta description`
  );

  if (!hasLink(html, 'canonical', page.canonical)) {
    failures.push(`${page.file}: canonical must be ${page.canonical}`);
  }

  for (const [language, href] of Object.entries(page.hreflang)) {
    if (
      !hasLink(html, 'alternate', href) ||
      !new RegExp(`hreflang=["']${language}["']`, 'i').test(html)
    ) {
      failures.push(`${page.file}: missing hreflang ${language} -> ${href}`);
    }
  }

  for (const rel of page.requiredLinks) {
    if (!hasLink(html, rel)) {
      failures.push(`${page.file}: missing ${rel} link`);
    }
  }

  for (const [attributeName, attributeValue, label] of [
    ['property', 'og:title', 'Open Graph title'],
    ['property', 'og:description', 'Open Graph description'],
    ['property', 'og:url', 'Open Graph URL'],
    ['property', 'og:image', 'Open Graph image'],
    ['name', 'twitter:card', 'Twitter card'],
    ['name', 'twitter:title', 'Twitter title'],
    ['name', 'twitter:description', 'Twitter description'],
    ['name', 'twitter:image', 'Twitter image']
  ]) {
    requireNonEmpty(
      findMetaContent(html, attributeName, attributeValue),
      `${page.file}: missing ${label}`
    );
  }

  const jsonLdTypes = extractJsonLdTypes(html, page.file);
  for (const type of page.requiredJsonLdTypes) {
    if (!jsonLdTypes.has(type)) {
      failures.push(`${page.file}: JSON-LD is missing ${type}`);
    }
  }
}

async function checkSitemap() {
  const sitemap = await readText('sitemap.xml');
  for (const url of sitemapUrls) {
    if (!sitemap.includes(`<loc>${url}</loc>`)) {
      failures.push(`sitemap.xml: missing ${url}`);
    }
  }

  if (sitemap.includes('?lang=en')) {
    failures.push('sitemap.xml: English hreflang should resolve to canonical root, not ?lang=en');
  }

  const lastmods = Array.from(sitemap.matchAll(/<lastmod>(.*?)<\/lastmod>/g)).map(
    (match) => match[1]
  );
  if (!lastmods.length) {
    failures.push('sitemap.xml: missing lastmod entries');
  }

  for (const lastmod of lastmods) {
    if (lastmod !== releaseLastmod) {
      failures.push(`sitemap.xml: lastmod ${lastmod} must match ${releaseLastmod}`);
    }
  }
}

async function checkRobots() {
  const robots = await readText('robots.txt');
  if (!/User-agent:\s*\*/i.test(robots)) {
    failures.push('robots.txt: missing User-agent: *');
  }
  if (!/Allow:\s*\//i.test(robots)) {
    failures.push('robots.txt: missing Allow: /');
  }
  if (!robots.includes(`Sitemap: ${productionOrigin}/sitemap.xml`)) {
    failures.push('robots.txt: missing production sitemap URL');
  }
}

async function checkPublicPlaceholders() {
  const files = [
    'index.html',
    'assets/data/translations.json',
    'assets/data/projects.json',
    'projects/nullid/index.html',
    'projects/nullcal/index.html',
    'projects/pacman/index.html',
    'projects/nullkeys/index.html'
  ];

  for (const file of files) {
    const content = await readText(file);
    for (const pattern of placeholderPatterns) {
      if (pattern.test(content)) {
        failures.push(`${file}: public placeholder/stale text matched ${pattern}`);
      }
    }
  }
}

async function checkRoadmapDocs() {
  if (!(await exists('docs/seo-roadmap.md'))) {
    failures.push('docs/seo-roadmap.md: document route-based language URL tradeoffs');
  }
}

for (const page of pages) {
  await checkPage(page);
}
await checkSitemap();
await checkRobots();
await checkPublicPlaceholders();
await checkRoadmapDocs();

if (failures.length) {
  console.error(
    `FAIL SEO posture check (${failures.length} issue${failures.length === 1 ? '' : 's'})`
  );
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `PASS SEO posture check (${pages.length} pages, sitemap, robots, and placeholders scanned)`
  );
}
