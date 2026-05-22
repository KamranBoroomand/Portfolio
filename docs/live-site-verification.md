# Live Site Verification

This repository is public and must not store Cloudflare secrets, DNS provider secrets, API keys, account IDs, private email credentials, or provider screenshots containing private values.

## Monitoring Model

- GitHub Actions: post-deploy/live verification for deployment correctness, public files, DNS resolution, and expected Cloudflare security headers.
- Cloudflare or external synthetic monitoring: authoritative uptime monitoring and alerting.
- Cloudflare Security Events: source of truth for edge challenges, bot blocks, WAF matches, and rate-limit diagnostics.

The workflow remains scheduled and manually runnable, but it is not the source of truth for whether the public site is down. GitHub-hosted runners can be challenged by Cloudflare even when normal visitors receive HTTP `200`.

## Checked URLs

The live verifier checks:

- `https://kamranboroomand.ir/`
- `https://kamranboroomand.ir/security/`
- `https://kamranboroomand.ir/.well-known/security.txt`
- `https://kamranboroomand.ir/robots.txt`
- `https://kamranboroomand.ir/sitemap.xml`
- `https://www.kamranboroomand.ir/`

The apex homepage must return `200` and include the expected Cloudflare-applied security headers. `Strict-Transport-Security` is intentionally not required until every active subdomain is verified HTTPS-ready.

## Cloudflare Challenges

The verifier uses `GET`, follows redirects where appropriate, retries short-lived failures, and sends this first-party User-Agent:

```text
KamranBoroomand-Portfolio-LiveVerifier/1.0 (+https://kamranboroomand.ir/security/)
```

If Cloudflare returns a `403` challenge page such as `Just a moment...`, the script reports `CLOUDFLARE_CHALLENGE` instead of `SITE_DOWN`. The workflow may still fail because it could not inspect required pages, but the issue title and report should say that Cloudflare challenged the GitHub Actions verifier.

A TLS certificate error on `https://www.kamranboroomand.ir/` is reported as `HTTP_FAILURE`, not a Cloudflare challenge. Fix that provider-side by ensuring `www.kamranboroomand.ir` is covered by a valid certificate and redirects to `https://kamranboroomand.ir/` over HTTPS.

## Workflow Outputs

`.github/workflows/uptime-monitor.yml` is named `Live Site Verification` in GitHub Actions. The filename is legacy; the workflow role is post-deploy/live verification. It:

- runs the live verifier on a schedule and by manual dispatch;
- uploads `live-site-verification-report.json` and `live-site-verification.log` as public-safe artifacts;
- keeps one open alert issue labeled `site-verification-alert`;
- updates that issue with exact failed checks and diagnostics;
- closes the alert issue automatically when verification recovers;
- uses minimal permissions: `contents: read` and `issues: write`.

Run the same verifier locally:

```bash
npm run verify:live
```

## Manual Cloudflare Recommendations

Review these in the Cloudflare dashboard. Do not commit private Cloudflare values to this repository.

- Bot Fight Mode: keep off if it blocks GitHub Actions or external synthetic monitors.
- Security Level: Medium is a reasonable starting point for this portfolio.
- Browser Integrity Check: keep off if it causes monitor false positives.
- Security headers: verify they are on through Cloudflare Response Header Transform Rules.
- HSTS: keep off until all subdomains in `docs/subdomain-inventory.md` are HTTPS-ready.

If GitHub Actions reports `CLOUDFLARE_CHALLENGE`, inspect Cloudflare Security Events for the request time, `cf-ray`, hostname, path, and User-Agent above.

## External Uptime Monitoring

Use one external monitor as the authoritative uptime source. Suitable options include:

- Cloudflare Health Checks, if available for the zone
- Better Stack
- UptimeRobot
- Checkly
- Grafana Synthetic Monitoring

Recommended monitored URLs:

- `https://kamranboroomand.ir/`
- `https://kamranboroomand.ir/security/`
- `https://kamranboroomand.ir/.well-known/security.txt`

Recommended alert recipient:

- `security@kamranboroomand.ir`
