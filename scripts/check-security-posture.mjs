import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const htmlEntrypoints = [
  'index.html',
  '404.html',
  'assets/docs/kamran-boroomand-resume-ats.html',
  'projects/nullid/index.html',
  'projects/nullcal/index.html',
  'projects/pacman/index.html',
  'projects/nullkeys/index.html',
  'security/index.html'
];

const requiredCspDirectives = [
  'default-src',
  'base-uri',
  'object-src',
  'script-src',
  'script-src-attr',
  'style-src',
  'font-src',
  'img-src',
  'connect-src',
  'form-action'
];

const unsupportedMetaCspDirectives = ['frame-ancestors', 'report-uri', 'sandbox'];
const forbiddenCspTokens = ["'unsafe-inline'", "'unsafe-eval'"];
const requiredHeaderNames = [
  'Content-Security-Policy',
  'X-Frame-Options',
  'X-Content-Type-Options',
  'Referrer-Policy',
  'Permissions-Policy',
  'Cross-Origin-Opener-Policy',
  'Cross-Origin-Resource-Policy',
  'Origin-Agent-Cluster',
  'Strict-Transport-Security'
];
const forbiddenRuntimeTokens = [
  'google-analytics.com',
  'googletagmanager.com',
  'gtag(',
  'dataLayer',
  'doubleclick.net',
  'facebook.net',
  'connect.facebook.net',
  'hotjar.com',
  'segment.com',
  'plausible.io',
  'https://api.github.com'
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

function parseDirectives(policy) {
  const directives = new Map();
  for (const rawDirective of policy.split(';')) {
    const directive = rawDirective.trim();
    if (!directive) continue;

    const [name, ...values] = directive.split(/\s+/);
    directives.set(name.toLowerCase(), values);
  }
  return directives;
}

function extractCsp(html, file) {
  const metaMatch = html.match(/<meta\b(?=[^>]*http-equiv=["']Content-Security-Policy["'])[^>]*>/i);
  if (!metaMatch) {
    failures.push(`${file}: missing meta Content-Security-Policy`);
    return null;
  }

  const contentMatch = metaMatch[0].match(/\bcontent=(["'])(.*?)\1/is);
  if (!contentMatch) {
    failures.push(`${file}: CSP meta tag is missing a content attribute`);
    return null;
  }

  return contentMatch[2];
}

function checkCsp(file, html) {
  const policy = extractCsp(html, file);
  if (!policy) return;

  const directives = parseDirectives(policy);

  for (const directive of requiredCspDirectives) {
    if (!directives.has(directive)) {
      failures.push(`${file}: CSP is missing ${directive}`);
    }
  }

  for (const directive of unsupportedMetaCspDirectives) {
    if (directives.has(directive)) {
      failures.push(
        `${file}: CSP meta includes ${directive}, which is ignored when CSP is delivered by meta`
      );
    }
  }

  for (const [directive, values] of directives) {
    for (const token of forbiddenCspTokens) {
      if (values.includes(token)) {
        failures.push(`${file}: CSP ${directive} includes forbidden token ${token}`);
      }
    }
  }

  const scriptSrc = directives.get('script-src') || [];
  if (scriptSrc.length !== 1 || scriptSrc[0] !== "'self'") {
    failures.push(`${file}: CSP script-src must be exactly 'self'`);
  }

  const connectSrc = directives.get('connect-src') || [];
  if (connectSrc.length !== 1 || connectSrc[0] !== "'self'") {
    failures.push(`${file}: CSP connect-src must be exactly 'self'`);
  }
}

function checkNoRemoteRuntime(file, html) {
  const remoteScript = html.match(/<script\b[^>]*\bsrc=["']https?:\/\//i);
  if (remoteScript) {
    failures.push(`${file}: remote runtime script found; use local/static assets`);
  }

  const remoteStylesheet = html.match(
    /<link\b(?=[^>]*\brel=["']stylesheet["'])(?=[^>]*\bhref=["']https?:\/\/)[^>]*>/i
  );
  if (remoteStylesheet) {
    failures.push(`${file}: remote stylesheet found; use local/static assets`);
  }
}

function checkTargetBlankRel(file, html) {
  const targetBlankPattern = /<a\b(?=[^>]*\btarget=["']_blank["'])[^>]*>/gi;
  let match = targetBlankPattern.exec(html);

  while (match) {
    const tag = match[0];
    const rel = tag.match(/\brel=["']([^"']+)["']/i)?.[1] || '';
    const relTokens = new Set(rel.toLowerCase().split(/\s+/).filter(Boolean));
    if (!relTokens.has('noopener') || !relTokens.has('noreferrer')) {
      failures.push(`${file}: target="_blank" link is missing rel="noopener noreferrer"`);
    }

    match = targetBlankPattern.exec(html);
  }
}

function checkFirstPartyAnalyticsMeta(file, html) {
  const metaMatch = html.match(/<meta\b[^>]*name=["']privacy-analytics-pixel["'][^>]*>/i);
  if (!metaMatch) return;

  const content = metaMatch[0].match(/\bcontent=(["'])(.*?)\1/is)?.[2] || '';
  if (!content.startsWith('/assets/images/') || /^https?:\/\//i.test(content)) {
    failures.push(`${file}: privacy analytics pixel must stay first-party and local`);
  }
}

async function checkHtmlEntrypoints() {
  for (const file of htmlEntrypoints) {
    const html = await readText(file);
    checkCsp(file, html);
    checkNoRemoteRuntime(file, html);
    checkTargetBlankRel(file, html);
    checkFirstPartyAnalyticsMeta(file, html);
  }
}

async function checkTrustAndDeploymentFiles() {
  const requiredFiles = [
    '.nojekyll',
    '.well-known/security.txt',
    'SECURITY.md',
    'docs/deployment-security-headers.md',
    'docs/deployment-security-todo.md',
    'docs/privacy-analytics.md'
  ];

  for (const file of requiredFiles) {
    if (!(await exists(file))) {
      failures.push(`${file}: required trust/deployment file is missing`);
    }
  }

  if (await exists('.well-known/security.txt')) {
    const securityTxt = await readText('.well-known/security.txt');
    for (const field of ['Contact:', 'Expires:', 'Preferred-Languages:', 'Canonical:']) {
      if (!securityTxt.includes(field)) {
        failures.push(`.well-known/security.txt: missing ${field}`);
      }
    }

    if (!securityTxt.includes('https://kamranboroomand.ir/.well-known/security.txt')) {
      failures.push('.well-known/security.txt: canonical URL must point to the production domain');
    }

    if (!securityTxt.includes('Contact: mailto:security@kamranboroomand.ir')) {
      failures.push('.well-known/security.txt: contact must use security@kamranboroomand.ir');
    }

    if (!securityTxt.includes('Preferred-Languages: en, ru')) {
      failures.push('.well-known/security.txt: preferred languages must be English and Russian');
    }

    if (!securityTxt.includes('Policy: https://kamranboroomand.ir/security/')) {
      failures.push('.well-known/security.txt: policy must point to the public /security/ page');
    }

    if (!securityTxt.includes('Expires: 2027-05-21T00:00:00.000Z')) {
      failures.push('.well-known/security.txt: expiry must be one year from the release date');
    }
  }

  if (await exists('docs/deployment-security-headers.md')) {
    const headerDoc = await readText('docs/deployment-security-headers.md');
    if (!headerDoc.includes('GitHub Pages') || !headerDoc.includes('cannot set arbitrary')) {
      failures.push(
        'docs/deployment-security-headers.md: must document GitHub Pages header limits'
      );
    }

    for (const headerName of requiredHeaderNames) {
      if (!headerDoc.includes(headerName)) {
        failures.push(`docs/deployment-security-headers.md: missing ${headerName}`);
      }
    }

    if (headerDoc.includes('https://api.github.com')) {
      failures.push('docs/deployment-security-headers.md: must keep connect-src self-only');
    }

    if (!headerDoc.includes('Do not enable includeSubDomains')) {
      failures.push(
        'docs/deployment-security-headers.md: must document the HSTS includeSubDomains guardrail'
      );
    }
  }
}

async function checkPrivacyImplementation() {
  const mainScript = await readText('assets/js/script.js');
  const projectScript = await readText('assets/js/project-page.js');
  const indexHtml = await readText('index.html');
  const analyticsDoc = await readText('docs/privacy-analytics.md');

  for (const [file, source] of [
    ['assets/js/script.js', mainScript],
    ['assets/js/project-page.js', projectScript],
    ['index.html', indexHtml]
  ]) {
    if (source.includes("params.set('ref'") || source.includes('params.set("ref"')) {
      failures.push(
        `${file}: first-party analytics must not copy document.referrer into query logs`
      );
    }

    if (source.includes('document.referrer')) {
      failures.push(`${file}: first-party analytics must not read document.referrer`);
    }
  }

  for (const [file, source] of [
    ['assets/js/script.js', mainScript],
    ['assets/js/project-page.js', projectScript],
    ['index.html', indexHtml]
  ]) {
    for (const token of forbiddenRuntimeTokens) {
      if (source.includes(token)) {
        failures.push(`${file}: forbidden third-party analytics/runtime token found: ${token}`);
      }
    }
  }

  if (!projectScript.includes('kb_analytics_opt_out')) {
    failures.push('assets/js/project-page.js: project pages must honor kb_analytics_opt_out');
  }

  for (const requiredText of [
    'does not use Google Analytics',
    'referrerPolicy =',
    'kb_analytics_opt_out',
    'No analytics cookies'
  ]) {
    if (!analyticsDoc.includes(requiredText)) {
      failures.push(`docs/privacy-analytics.md: missing required privacy note: ${requiredText}`);
    }
  }
}

await checkHtmlEntrypoints();
await checkTrustAndDeploymentFiles();
await checkPrivacyImplementation();

if (failures.length) {
  console.error(
    `FAIL security posture check (${failures.length} issue${failures.length === 1 ? '' : 's'})`
  );
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log(`PASS security posture check (${htmlEntrypoints.length} HTML entrypoints scanned)`);
}
