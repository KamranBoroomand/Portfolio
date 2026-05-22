import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const apexOrigin = 'https://kamranboroomand.ir';
const wwwOrigin = 'https://www.kamranboroomand.ir';
const reportPath = process.env.LIVE_VERIFICATION_REPORT || 'live-site-verification-report.json';
const requestTimeoutMs = Number.parseInt(process.env.LIVE_VERIFY_REQUEST_TIMEOUT_MS || '10000', 10);
const retryAttempts = Number.parseInt(process.env.LIVE_VERIFY_RETRY_ATTEMPTS || '3', 10);
const retryBackoffMs = Number.parseInt(process.env.LIVE_VERIFY_RETRY_BACKOFF_MS || '750', 10);

const classification = Object.freeze({
  ok: 'OK',
  httpFailure: 'HTTP_FAILURE',
  contentFailure: 'CONTENT_FAILURE',
  missingHeader: 'MISSING_HEADER',
  dnsFailure: 'DNS_FAILURE',
  cloudflareChallenge: 'CLOUDFLARE_CHALLENGE',
  timeout: 'TIMEOUT',
  unknownFailure: 'UNKNOWN_FAILURE'
});

const verifierHeaders = {
  'user-agent':
    'KamranBoroomand-Portfolio-LiveVerifier/1.0 (+https://kamranboroomand.ir/security/)',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'cache-control': 'no-cache'
};

const requiredLiveHeaders = [
  'content-security-policy',
  'x-frame-options',
  'x-content-type-options',
  'referrer-policy',
  'permissions-policy',
  'cross-origin-opener-policy',
  'cross-origin-resource-policy',
  'origin-agent-cluster'
];

const cloudflareChallengeMarkers = [
  'just a moment',
  'cf-browser-verification',
  'challenge-platform',
  'checking your browser',
  'cf-chl-',
  'cloudflare ray id'
];

const httpChecks = [
  {
    name: 'root-domain',
    url: `${apexOrigin}/`,
    method: 'GET',
    redirect: 'follow',
    validations: [expectStatus(200), expectSecurityHeaders(requiredLiveHeaders)]
  },
  {
    name: 'security-page',
    url: `${apexOrigin}/security/`,
    method: 'GET',
    redirect: 'follow',
    validations: [expectStatus(200)]
  },
  {
    name: 'security-txt',
    url: `${apexOrigin}/.well-known/security.txt`,
    method: 'GET',
    redirect: 'follow',
    validations: [expectStatus(200), expectBodyIncludes('security@kamranboroomand.ir')]
  },
  {
    name: 'robots-txt',
    url: `${apexOrigin}/robots.txt`,
    method: 'GET',
    redirect: 'follow',
    validations: [expectStatus(200), expectBodyIncludes('sitemap')]
  },
  {
    name: 'sitemap-xml',
    url: `${apexOrigin}/sitemap.xml`,
    method: 'GET',
    redirect: 'follow',
    validations: [expectStatus(200), expectXmlBody()]
  },
  {
    name: 'www-domain',
    url: `${wwwOrigin}/`,
    method: 'GET',
    redirect: 'follow',
    validations: [expectWwwToReachLiveSite()]
  }
];

const dnsChecks = [
  {
    name: 'root-domain-dns',
    hostname: 'kamranboroomand.ir',
    recordTypes: ['A', 'AAAA']
  },
  {
    name: 'www-domain-dns',
    hostname: 'www.kamranboroomand.ir',
    recordTypes: ['CNAME', 'A', 'AAAA']
  }
];

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function excerpt(text, maxLength = 420) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function isTextLike(contentType) {
  const normalized = contentType.toLowerCase();
  return (
    normalized.includes('text/html') ||
    normalized.includes('text/plain') ||
    normalized.includes('application/xhtml+xml') ||
    normalized.includes('application/xml') ||
    normalized.includes('text/xml')
  );
}

function isBodyExcerptAllowed(contentType) {
  const normalized = contentType.toLowerCase();
  return normalized.includes('text/html') || normalized.includes('text/plain');
}

function getHeader(headers, name) {
  return headers.get(name) || '';
}

function issue(kind, message) {
  return { classification: kind, message };
}

function causeFor(kind) {
  switch (kind) {
    case classification.cloudflareChallenge:
      return 'Cloudflare bot or security controls challenged the GitHub Actions verifier request.';
    case classification.httpFailure:
      return 'The public route returned an unexpected HTTP status or redirect result.';
    case classification.contentFailure:
      return 'The public file was reachable but did not contain the expected content.';
    case classification.missingHeader:
      return 'Cloudflare Response Header Transform Rules are missing or not applying to this response.';
    case classification.dnsFailure:
      return 'Public DNS resolution did not return the expected record through DNS-over-HTTPS.';
    case classification.timeout:
      return 'The verifier did not receive a response before the request timeout.';
    case classification.unknownFailure:
      return 'The verifier encountered an unexpected fetch/runtime failure.';
    default:
      return 'No issue detected.';
  }
}

function actionFor(kind) {
  switch (kind) {
    case classification.cloudflareChallenge:
      return 'Check Cloudflare Security Events, WAF rules, Bot Fight Mode, Browser Integrity Check, and monitor allowlisting. Do not treat this as proof of a public outage.';
    case classification.httpFailure:
      return 'Check the GitHub Pages deployment, Cloudflare redirects, and route/page rules for this URL.';
    case classification.contentFailure:
      return 'Check the committed public file, GitHub Pages deploy status, and Cloudflare cache for stale content.';
    case classification.missingHeader:
      return 'Check Cloudflare Response Header Transform Rules for the apex hostname and HTML route.';
    case classification.dnsFailure:
      return 'Check public DNS records in the DNS/CDN provider dashboard; do not commit private DNS data to the repo.';
    case classification.timeout:
      return 'Retry and inspect Cloudflare/network events if timeouts persist.';
    case classification.unknownFailure:
      return 'Inspect the GitHub Actions log and rerun the verifier with fresh diagnostics.';
    default:
      return 'No action required.';
  }
}

function primaryClassification(issues) {
  return issues[0]?.classification || classification.ok;
}

function collectHttpDiagnostics(check, response, body) {
  const contentType = getHeader(response.headers, 'content-type');
  const diagnostics = {
    checkName: check.name,
    url: check.url,
    method: check.method,
    status: response.status,
    finalUrl: response.url,
    server: getHeader(response.headers, 'server'),
    cfRay: getHeader(response.headers, 'cf-ray'),
    location: getHeader(response.headers, 'location'),
    contentType
  };

  if (body && isBodyExcerptAllowed(contentType)) {
    diagnostics.bodyExcerpt = excerpt(body);
  }

  return diagnostics;
}

function isCloudflareChallenge(response, body) {
  const server = getHeader(response.headers, 'server').toLowerCase();
  const cfRay = getHeader(response.headers, 'cf-ray');
  const bodyText = String(body || '').toLowerCase();
  const hasCloudflareHeader = server.includes('cloudflare') || Boolean(cfRay);
  const hasChallengeMarker = cloudflareChallengeMarkers.some((marker) => bodyText.includes(marker));

  return response.status === 403 && hasCloudflareHeader && hasChallengeMarker;
}

function expectStatus(status) {
  return ({ response }) => {
    if (response.status === status) {
      return [];
    }

    return [issue(classification.httpFailure, `expected HTTP ${status}, got ${response.status}`)];
  };
}

function expectBodyIncludes(needle) {
  const validation = ({ body }) => {
    if (body.toLowerCase().includes(needle.toLowerCase())) {
      return [];
    }

    return [issue(classification.contentFailure, `response body must contain ${needle}`)];
  };

  validation.needsBody = true;
  return validation;
}

function expectSecurityHeaders(headerNames) {
  return ({ response }) => {
    const missing = headerNames.filter((headerName) => !response.headers.has(headerName));
    if (missing.length === 0) {
      return [];
    }

    return [
      issue(classification.missingHeader, `missing live security headers: ${missing.join(', ')}`)
    ];
  };
}

function expectXmlBody() {
  const validation = ({ response, body }) => {
    const contentType = getHeader(response.headers, 'content-type').toLowerCase();
    const bodyStart = body.trim().slice(0, 120).toLowerCase();
    if (
      contentType.includes('xml') ||
      bodyStart.startsWith('<?xml') ||
      bodyStart.includes('<urlset')
    ) {
      return [];
    }

    return [issue(classification.contentFailure, 'sitemap.xml must be served as XML content')];
  };

  validation.needsBody = true;
  return validation;
}

function isApexRootUrl(value, baseUrl) {
  try {
    const url = new URL(value, baseUrl);
    return url.origin === apexOrigin && url.pathname === '/';
  } catch {
    return false;
  }
}

function isLiveSiteUrl(value, baseUrl) {
  try {
    const url = new URL(value, baseUrl);
    return (
      (url.origin === apexOrigin || url.origin === wwwOrigin) &&
      (url.pathname === '/' || url.pathname === '')
    );
  } catch {
    return false;
  }
}

function expectWwwToReachLiveSite() {
  return ({ response, check }) => {
    const redirectStatuses = new Set([301, 302, 307, 308]);
    const location = getHeader(response.headers, 'location');

    if (redirectStatuses.has(response.status) && isApexRootUrl(location, check.url)) {
      return [];
    }

    if (response.status === 200 && isLiveSiteUrl(response.url, check.url)) {
      return [];
    }

    return [
      issue(
        classification.httpFailure,
        `www must redirect to ${apexOrigin}/ or resolve to the live site; got status=${response.status} location=${location || 'none'} final=${response.url}`
      )
    ];
  };
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function runHttpCheck(check) {
  const response = await fetchWithTimeout(check.url, {
    method: check.method,
    redirect: check.redirect,
    headers: verifierHeaders
  });

  const contentType = getHeader(response.headers, 'content-type');
  const shouldReadBody =
    isTextLike(contentType) || check.validations.some((validation) => validation.needsBody);
  const body = shouldReadBody ? await response.text() : '';
  const diagnostics = collectHttpDiagnostics(check, response, body);

  if (isCloudflareChallenge(response, body)) {
    return completeResult({
      ok: false,
      kind: 'http',
      name: check.name,
      classification: classification.cloudflareChallenge,
      issues: [
        issue(
          classification.cloudflareChallenge,
          'Cloudflare challenged the GitHub Actions verifier'
        )
      ],
      diagnostics
    });
  }

  const issues = check.validations.flatMap((validation) => validation({ response, body, check }));
  return completeResult({
    ok: issues.length === 0,
    kind: 'http',
    name: check.name,
    classification: primaryClassification(issues),
    issues,
    diagnostics
  });
}

async function runDnsCheck(check) {
  const queries = [];

  for (const recordType of check.recordTypes) {
    const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(check.hostname)}&type=${recordType}`;
    const response = await fetchWithTimeout(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        ...verifierHeaders,
        accept: 'application/dns-json'
      }
    });

    if (!response.ok) {
      queries.push({
        recordType,
        httpStatus: response.status,
        finalUrl: response.url,
        contentType: getHeader(response.headers, 'content-type'),
        answerCount: 0
      });
      continue;
    }

    const body = await response.json();
    const answerCount = Array.isArray(body.Answer) ? body.Answer.length : 0;
    const comment = Array.isArray(body.Comment) ? body.Comment.join('; ') : '';

    queries.push({
      recordType,
      httpStatus: response.status,
      finalUrl: response.url,
      dnsStatus: body.Status,
      answerCount,
      comment
    });

    if (body.Status === 0 && answerCount > 0) {
      return completeResult({
        ok: true,
        kind: 'dns',
        name: check.name,
        classification: classification.ok,
        issues: [],
        diagnostics: {
          checkName: check.name,
          hostname: check.hostname,
          recordTypes: check.recordTypes,
          method: 'GET',
          dnsStatus: body.Status,
          answerCount,
          answerSummary: `${recordType}:${answerCount}`,
          queries
        }
      });
    }
  }

  return completeResult({
    ok: false,
    kind: 'dns',
    name: check.name,
    classification: classification.dnsFailure,
    issues: [
      issue(
        classification.dnsFailure,
        `no public DNS answers for ${check.hostname} (${check.recordTypes.join('/')})`
      )
    ],
    diagnostics: {
      checkName: check.name,
      hostname: check.hostname,
      recordTypes: check.recordTypes,
      method: 'GET',
      answerSummary: 'none',
      queries
    }
  });
}

function completeResult(result) {
  const finalClassification = result.ok ? classification.ok : result.classification;

  return {
    ...result,
    classification: finalClassification,
    likelyCause: result.likelyCause || causeFor(finalClassification),
    suggestedNextAction: result.suggestedNextAction || actionFor(finalClassification)
  };
}

function errorCause(error) {
  return error instanceof Error && error.cause && typeof error.cause === 'object'
    ? error.cause
    : {};
}

function errorMessage(error) {
  const cause = errorCause(error);
  const causeCode = typeof cause.code === 'string' ? cause.code : '';
  const causeReason = typeof cause.reason === 'string' ? cause.reason : '';
  const causeMessage = typeof cause.message === 'string' ? cause.message : '';
  const primaryMessage = error instanceof Error ? error.message : String(error);
  const details = [causeCode, causeReason || causeMessage].filter(Boolean).join(' - ');

  return details ? `${primaryMessage}: ${details}` : primaryMessage;
}

function isTlsCertificateError(error) {
  const cause = errorCause(error);
  const causeCode = typeof cause.code === 'string' ? cause.code : '';

  return causeCode.startsWith('ERR_TLS') || causeCode.includes('CERT');
}

function exceptionResult(check, error) {
  let kind = classification.unknownFailure;
  let likelyCause;
  let suggestedNextAction;

  if (error instanceof Error && error.name === 'AbortError') {
    kind = classification.timeout;
  } else if (check.kind === 'dns') {
    kind = classification.dnsFailure;
  } else if (check.kind === 'http' && isTlsCertificateError(error)) {
    kind = classification.httpFailure;
    likelyCause =
      'The HTTPS certificate presented for this hostname is invalid before any redirect can complete.';
    suggestedNextAction =
      'Configure Cloudflare/GitHub Pages so the hostname has a valid HTTPS certificate and redirects to the apex over HTTPS.';
  }

  const cause = errorCause(error);

  return completeResult({
    ok: false,
    kind: check.kind,
    name: check.name,
    classification: kind,
    issues: [issue(kind, errorMessage(error))],
    likelyCause,
    suggestedNextAction,
    diagnostics: {
      checkName: check.name,
      url: check.url || '',
      hostname: check.hostname || '',
      recordTypes: check.recordTypes || [],
      method: check.method || 'GET',
      exception: error instanceof Error ? error.name : 'Error',
      errorCode: typeof cause.code === 'string' ? cause.code : '',
      errorReason: typeof cause.reason === 'string' ? cause.reason : '',
      errorHost: typeof cause.host === 'string' ? cause.host : ''
    }
  });
}

async function runWithRetries(check, runner) {
  let lastResult;

  for (let attempt = 1; attempt <= retryAttempts; attempt += 1) {
    try {
      lastResult = await runner(check);
    } catch (error) {
      lastResult = exceptionResult(check, error);
    }

    lastResult.attempts = attempt;
    if (lastResult.ok) {
      return lastResult;
    }

    if (attempt < retryAttempts) {
      console.log(
        `RETRY ${check.name} attempt=${attempt} classification=${lastResult.classification} reason=${lastResult.issues.map((item) => item.message).join('; ')}`
      );
      await sleep(retryBackoffMs * attempt);
    }
  }

  return lastResult;
}

function statusWord(result) {
  if (result.ok) return 'PASS';
  if (result.classification === classification.cloudflareChallenge) return 'CHALLENGE';
  return 'FAIL';
}

function formatResultLine(result) {
  if (result.kind === 'dns') {
    return `${statusWord(result)} ${result.name} kind=dns classification=${result.classification} hostname=${result.diagnostics.hostname ?? 'n/a'} answers=${result.diagnostics.answerSummary ?? 'none'} attempts=${result.attempts}`;
  }

  return `${statusWord(result)} ${result.name} kind=http classification=${result.classification} status=${result.diagnostics.status ?? 'n/a'} final-url=${result.diagnostics.finalUrl ?? 'n/a'} attempts=${result.attempts}`;
}

function formatDiagnostic(result) {
  const diagnostics = result.diagnostics;
  const lines = [
    `check=${result.name}`,
    `classification=${result.classification}`,
    `kind=${result.kind}`,
    `url=${diagnostics.url || 'n/a'}`,
    `method=${diagnostics.method || 'GET'}`,
    `attempts=${result.attempts}`,
    `issues=${result.issues.map((item) => item.message).join('; ') || 'none'}`,
    `likely-cause=${result.likelyCause}`,
    `suggested-next-action=${result.suggestedNextAction}`
  ];

  if (result.kind === 'http') {
    lines.push(`status=${diagnostics.status ?? 'n/a'}`);
    lines.push(`final-url=${diagnostics.finalUrl ?? 'n/a'}`);
    lines.push(`server=${diagnostics.server || 'none'}`);
    lines.push(`cf-ray=${diagnostics.cfRay || 'none'}`);
    lines.push(`location=${diagnostics.location || 'none'}`);
    lines.push(`content-type=${diagnostics.contentType || 'none'}`);
    if (diagnostics.errorCode) {
      lines.push(`error-code=${diagnostics.errorCode}`);
    }
    if (diagnostics.errorReason) {
      lines.push(`error-reason=${diagnostics.errorReason}`);
    }
    if (diagnostics.errorHost) {
      lines.push(`error-host=${diagnostics.errorHost}`);
    }
    if (diagnostics.bodyExcerpt) {
      lines.push(`body-excerpt=${diagnostics.bodyExcerpt}`);
    }
  } else {
    lines.push(`hostname=${diagnostics.hostname || 'n/a'}`);
    lines.push(`record-types=${diagnostics.recordTypes?.join(',') || 'n/a'}`);
    lines.push(`answer-summary=${diagnostics.answerSummary || 'none'}`);
    lines.push(`dns-status=${diagnostics.dnsStatus ?? 'n/a'}`);
    lines.push(`answer-count=${diagnostics.answerCount ?? 0}`);
    if (Array.isArray(diagnostics.queries)) {
      lines.push(
        `queries=${diagnostics.queries
          .map(
            (query) =>
              `${query.recordType}:http=${query.httpStatus ?? 'n/a'},dns=${query.dnsStatus ?? 'n/a'},answers=${query.answerCount ?? 0}`
          )
          .join('; ')}`
      );
    }
    if (diagnostics.status) {
      lines.push(`dns-http-status=${diagnostics.status}`);
    }
  }

  return lines.join('\n');
}

function summarize(results) {
  const counts = Object.fromEntries(Object.values(classification).map((name) => [name, 0]));
  for (const result of results) {
    counts[result.classification] += 1;
  }

  const failedResults = results.filter((result) => !result.ok);
  const challengedResults = results.filter(
    (result) => result.classification === classification.cloudflareChallenge
  );

  return {
    ok: failedResults.length === 0,
    checkedCount: results.length,
    failedCount: failedResults.length,
    challengedCount: challengedResults.length,
    failedChecks: failedResults.map((result) => result.name),
    challengedChecks: challengedResults.map((result) => result.name),
    classifications: counts
  };
}

async function writeReport(results) {
  const summary = summarize(results);
  const report = {
    generatedAt: new Date().toISOString(),
    role: 'post-deploy/live verification',
    authoritativeUptimeMonitor: false,
    authoritativeMonitoringRecommendation:
      'Use Cloudflare Health Checks, Better Stack, UptimeRobot, Checkly, Grafana Synthetic Monitoring, or another external synthetic monitor for uptime alerts.',
    userAgent: verifierHeaders['user-agent'],
    requestTimeoutMs,
    retryAttempts,
    summary,
    httpResults: results.filter((result) => result.kind === 'http'),
    dnsResults: results.filter((result) => result.kind === 'dns')
  };

  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

async function runVerifier() {
  console.log('Live Site Verification');
  console.log('Role: post-deploy/live verification, not authoritative uptime monitoring.');

  const checks = [
    ...httpChecks.map((check) => ({ ...check, kind: 'http' })),
    ...dnsChecks.map((check) => ({ ...check, kind: 'dns', method: 'GET' }))
  ];
  const results = [];

  for (const check of checks) {
    const runner = check.kind === 'http' ? runHttpCheck : runDnsCheck;
    const result = await runWithRetries(check, runner);
    results.push(result);
    console.log(formatResultLine(result));
  }

  const report = await writeReport(results);

  console.log('--- HTTP CHECKS ---');
  for (const result of report.httpResults) {
    console.log(formatResultLine(result));
  }

  console.log('--- DNS CHECKS ---');
  for (const result of report.dnsResults) {
    console.log(formatResultLine(result));
  }

  if (!report.summary.ok) {
    console.log('--- LIVE SITE VERIFICATION ISSUES ---');
    for (const result of [...report.httpResults, ...report.dnsResults].filter((item) => !item.ok)) {
      console.log(formatDiagnostic(result));
      console.log('---');
    }
    console.log(`Report written to ${reportPath}`);
    process.exitCode = 1;
    return;
  }

  console.log(`All live verification checks passed. Report written to ${reportPath}.`);
}

function runSelfTest() {
  const headers = new Headers();
  for (const headerName of requiredLiveHeaders) {
    headers.set(headerName, 'test');
  }

  assert.deepEqual(
    expectSecurityHeaders(requiredLiveHeaders)({ response: { headers } }),
    [],
    'all required security headers should pass'
  );
  assert.equal(isApexRootUrl('https://kamranboroomand.ir/', wwwOrigin), true);
  assert.equal(isLiveSiteUrl('https://www.kamranboroomand.ir/', wwwOrigin), true);
  assert.equal(isLiveSiteUrl('https://example.com/', wwwOrigin), false);
  assert.deepEqual(
    expectXmlBody()({
      response: { headers: new Headers({ 'content-type': 'text/plain' }) },
      body: '<?xml version="1.0"?><urlset></urlset>'
    }),
    [],
    'XML-looking sitemap body should pass even if content-type is generic'
  );
  assert.equal(
    isCloudflareChallenge(
      {
        status: 403,
        headers: new Headers({
          server: 'cloudflare',
          'cf-ray': 'example',
          'content-type': 'text/html'
        })
      },
      '<html><title>Just a moment...</title><script src="/cdn-cgi/challenge-platform/"></script>'
    ),
    true,
    'Cloudflare challenge markers should be classified separately from public outage'
  );

  console.log('PASS live verifier self-test');
}

if (process.argv.includes('--self-test')) {
  runSelfTest();
} else {
  await runVerifier();
}
