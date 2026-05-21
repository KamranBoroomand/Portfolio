import assert from 'node:assert/strict';

const apexOrigin = 'https://kamranboroomand.ir';
const requestTimeoutMs = Number.parseInt(process.env.UPTIME_REQUEST_TIMEOUT_MS || '10000', 10);
const retryAttempts = Number.parseInt(process.env.UPTIME_RETRY_ATTEMPTS || '3', 10);
const retryBackoffMs = Number.parseInt(process.env.UPTIME_RETRY_BACKOFF_MS || '750', 10);

const monitorHeaders = {
  'user-agent':
    'KamranBoroomand-Portfolio-UptimeMonitor/1.0 (+https://kamranboroomand.ir/security/)',
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

const httpChecks = [
  {
    name: 'root-domain',
    url: `${apexOrigin}/`,
    redirect: 'follow',
    validations: [expectStatus(200), expectSecurityHeaders(requiredLiveHeaders)]
  },
  {
    name: 'security-page',
    url: `${apexOrigin}/security/`,
    redirect: 'follow',
    validations: [expectStatus(200)]
  },
  {
    name: 'security-txt',
    url: `${apexOrigin}/.well-known/security.txt`,
    redirect: 'follow',
    validations: [expectStatus(200), expectBodyIncludes('security@kamranboroomand.ir')]
  },
  {
    name: 'robots-txt',
    url: `${apexOrigin}/robots.txt`,
    redirect: 'follow',
    validations: [expectStatus(200), expectBodyIncludes('sitemap')]
  },
  {
    name: 'sitemap-xml',
    url: `${apexOrigin}/sitemap.xml`,
    redirect: 'follow',
    validations: [expectStatus(200), expectXmlBody()]
  },
  {
    name: 'www-domain',
    url: 'http://www.kamranboroomand.ir/',
    redirect: 'follow',
    validations: [expectWwwToReachApex()]
  }
];

const dnsChecks = [
  {
    name: 'root-a-record',
    url: 'https://cloudflare-dns.com/dns-query?name=kamranboroomand.ir&type=A'
  },
  {
    name: 'www-cname-record',
    url: 'https://cloudflare-dns.com/dns-query?name=www.kamranboroomand.ir&type=CNAME'
  }
];

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function excerpt(text, maxLength = 420) {
  return text.replace(/\s+/g, ' ').trim().slice(0, maxLength);
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

function collectHttpDiagnostics(response, body) {
  const contentType = getHeader(response.headers, 'content-type');
  const diagnostics = {
    status: response.status,
    finalUrl: response.url,
    location: getHeader(response.headers, 'location'),
    server: getHeader(response.headers, 'server'),
    cfRay: getHeader(response.headers, 'cf-ray'),
    contentType
  };

  if (body && isBodyExcerptAllowed(contentType)) {
    diagnostics.bodyExcerpt = excerpt(body);
  }

  return diagnostics;
}

function expectStatus(status) {
  return ({ response }) => {
    if (response.status === status) {
      return [];
    }

    return [`expected HTTP ${status}, got ${response.status}`];
  };
}

function expectBodyIncludes(needle) {
  const validation = ({ body }) => {
    if (body.toLowerCase().includes(needle.toLowerCase())) {
      return [];
    }

    return [`response body must contain ${needle}`];
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

    return [`missing live security headers: ${missing.join(', ')}`];
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

    return ['sitemap.xml must be served as XML content'];
  };

  validation.needsBody = true;
  return validation;
}

function isApexUrl(value, baseUrl) {
  try {
    const url = new URL(value, baseUrl);
    return url.origin === apexOrigin && url.pathname === '/';
  } catch {
    return false;
  }
}

function expectWwwToReachApex() {
  return ({ response, check }) => {
    const redirectStatuses = new Set([301, 302, 307, 308]);
    const location = getHeader(response.headers, 'location');

    if (redirectStatuses.has(response.status) && isApexUrl(location, check.url)) {
      return [];
    }

    if (response.status === 200 && isApexUrl(response.url, check.url)) {
      return [];
    }

    return [
      `www must redirect to ${apexOrigin}/ or resolve to the live apex site; got status=${response.status} location=${location || 'none'} final=${response.url}`
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
    method: 'GET',
    redirect: check.redirect,
    headers: monitorHeaders
  });

  const contentType = getHeader(response.headers, 'content-type');
  const shouldReadBody =
    isTextLike(contentType) || check.validations.some((validation) => validation.needsBody);
  const body = shouldReadBody ? await response.text() : '';
  const errors = check.validations.flatMap((validation) => validation({ response, body, check }));

  return {
    ok: errors.length === 0,
    kind: 'http',
    name: check.name,
    errors,
    diagnostics: collectHttpDiagnostics(response, body)
  };
}

async function runDnsCheck(check) {
  const response = await fetchWithTimeout(check.url, {
    method: 'GET',
    redirect: 'follow',
    headers: {
      ...monitorHeaders,
      accept: 'application/dns-json'
    }
  });

  if (!response.ok) {
    return {
      ok: false,
      kind: 'dns',
      name: check.name,
      errors: [`DNS query HTTP ${response.status}`],
      diagnostics: {
        status: response.status,
        finalUrl: response.url,
        contentType: getHeader(response.headers, 'content-type')
      }
    };
  }

  const body = await response.json();
  const answerCount = Array.isArray(body.Answer) ? body.Answer.length : 0;
  const ok = body.Status === 0 && answerCount > 0;

  return {
    ok,
    kind: 'dns',
    name: check.name,
    errors: ok
      ? []
      : [
          `DNS status=${body.Status} answer-count=${answerCount} comment=${Array.isArray(body.Comment) ? body.Comment.join('; ') : 'none'}`
        ],
    diagnostics: {
      dnsStatus: body.Status,
      answerCount
    }
  };
}

async function runWithRetries(check, runner) {
  let lastResult;

  for (let attempt = 1; attempt <= retryAttempts; attempt += 1) {
    try {
      lastResult = await runner(check);
    } catch (error) {
      lastResult = {
        ok: false,
        kind: check.kind,
        name: check.name,
        errors: [error instanceof Error ? error.message : String(error)],
        diagnostics: {
          exception: error instanceof Error ? error.name : 'Error'
        }
      };
    }

    lastResult.attempts = attempt;
    if (lastResult.ok) {
      return lastResult;
    }

    if (attempt < retryAttempts) {
      console.log(`RETRY ${check.name} attempt=${attempt} reason=${lastResult.errors.join('; ')}`);
      await sleep(retryBackoffMs * attempt);
    }
  }

  return lastResult;
}

function formatResultLine(result) {
  if (result.kind === 'dns') {
    return `${result.ok ? 'PASS' : 'FAIL'} ${result.name} kind=dns dns-status=${result.diagnostics.dnsStatus ?? 'n/a'} answers=${result.diagnostics.answerCount ?? 0} attempts=${result.attempts}`;
  }

  return `${result.ok ? 'PASS' : 'FAIL'} ${result.name} kind=http status=${result.diagnostics.status ?? 'n/a'} final-url=${result.diagnostics.finalUrl ?? 'n/a'} attempts=${result.attempts}`;
}

function formatFailure(result) {
  const diagnostics = result.diagnostics;
  const lines = [
    `check=${result.name}`,
    `kind=${result.kind}`,
    `attempts=${result.attempts}`,
    `errors=${result.errors.join('; ')}`
  ];

  if (result.kind === 'http') {
    lines.push(`status=${diagnostics.status ?? 'n/a'}`);
    lines.push(`final-url=${diagnostics.finalUrl ?? 'n/a'}`);
    lines.push(`location=${diagnostics.location || 'none'}`);
    lines.push(`server=${diagnostics.server || 'none'}`);
    lines.push(`cf-ray=${diagnostics.cfRay || 'none'}`);
    lines.push(`content-type=${diagnostics.contentType || 'none'}`);
    if (diagnostics.bodyExcerpt) {
      lines.push(`body-excerpt=${diagnostics.bodyExcerpt}`);
    }
  } else {
    lines.push(`dns-status=${diagnostics.dnsStatus ?? 'n/a'}`);
    lines.push(`answer-count=${diagnostics.answerCount ?? 0}`);
    if (diagnostics.status) {
      lines.push(`dns-http-status=${diagnostics.status}`);
    }
  }

  return lines.join('\n');
}

async function runMonitor() {
  const checks = [
    ...httpChecks.map((check) => ({ ...check, kind: 'http' })),
    ...dnsChecks.map((check) => ({ ...check, kind: 'dns' }))
  ];
  const results = [];

  for (const check of checks) {
    const runner = check.kind === 'http' ? runHttpCheck : runDnsCheck;
    const result = await runWithRetries(check, runner);
    results.push(result);
    console.log(formatResultLine(result));
  }

  const failures = results.filter((result) => !result.ok);
  if (failures.length > 0) {
    console.log('--- UPTIME FAILURES ---');
    for (const failure of failures) {
      console.log(formatFailure(failure));
      console.log('---');
    }
    process.exitCode = 1;
    return;
  }

  console.log('All uptime checks passed.');
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
  assert.equal(isApexUrl('https://kamranboroomand.ir/', 'http://www.kamranboroomand.ir/'), true);
  assert.equal(isApexUrl('https://example.com/', 'http://www.kamranboroomand.ir/'), false);
  assert.deepEqual(
    expectXmlBody()({
      response: { headers: new Headers({ 'content-type': 'text/plain' }) },
      body: '<?xml version="1.0"?><urlset></urlset>'
    }),
    [],
    'XML-looking sitemap body should pass even if content-type is generic'
  );

  console.log('PASS monitor self-test');
}

if (process.argv.includes('--self-test')) {
  runSelfTest();
} else {
  await runMonitor();
}
