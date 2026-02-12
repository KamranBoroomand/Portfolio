const checks = [
  {
    name: 'root-domain',
    kind: 'http',
    url: 'https://kamranboroomand.ir/'
  },
  {
    name: 'www-domain',
    kind: 'http',
    // `www` currently issues an HTTP 301 to the apex domain. Checking over HTTP
    // avoids false alarms from certificate mismatches on the subdomain while
    // still validating DNS + edge reachability for that host.
    url: 'http://www.kamranboroomand.ir/'
  },
  {
    name: 'root-a-record',
    kind: 'dns',
    url: 'https://cloudflare-dns.com/dns-query?name=kamranboroomand.ir&type=A'
  },
  {
    name: 'www-cname-record',
    kind: 'dns',
    url: 'https://cloudflare-dns.com/dns-query?name=www.kamranboroomand.ir&type=CNAME'
  }
];

const failures = [];

for (const check of checks) {
  try {
    if (check.kind === 'http') {
      const response = await fetch(check.url, {
        method: 'HEAD',
        redirect: 'manual'
      });
      const ok = response.status >= 200 && response.status < 400;
      console.log(`${ok ? 'PASS' : 'FAIL'} ${check.name} status=${response.status}`);
      if (!ok) {
        failures.push(`${check.name}: HTTP ${response.status}`);
      }
      continue;
    }

    const response = await fetch(check.url, {
      headers: {
        accept: 'application/dns-json'
      }
    });

    if (!response.ok) {
      failures.push(`${check.name}: DNS query HTTP ${response.status}`);
      console.log(`FAIL ${check.name} dns-http=${response.status}`);
      continue;
    }

    const body = await response.json();
    const hasAnswer = Array.isArray(body.Answer) && body.Answer.length > 0;
    const ok = body.Status === 0 && hasAnswer;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${check.name} dns-status=${body.Status}`);
    if (!ok) {
      failures.push(
        `${check.name}: status=${body.Status} comment=${Array.isArray(body.Comment) ? body.Comment.join('; ') : 'none'}`
      );
    }
  } catch (error) {
    failures.push(`${check.name}: ${error instanceof Error ? error.message : String(error)}`);
    console.log(`FAIL ${check.name} exception`);
  }
}

if (failures.length > 0) {
  console.log('--- UPTIME FAILURES ---');
  for (const failure of failures) {
    console.log(failure);
  }
  process.exitCode = 1;
} else {
  console.log('All uptime checks passed.');
}
