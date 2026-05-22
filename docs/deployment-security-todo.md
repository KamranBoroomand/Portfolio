# Deployment Security TODO

This repository is a static site. Evidence in this repo points to a GitHub Pages-compatible deployment: a root `CNAME` for `kamranboroomand.ir`, static root HTML files, and no Vercel, Netlify, Cloudflare Pages, Firebase, or server config. The live apex site is now proxied through Cloudflare, but Cloudflare provider configuration is not stored in this public repository.

## Controlled In This Repo

- Static HTML metadata, canonical URLs, robots, sitemap, local assets, and JSON-LD.
- Meta-delivered CSP for directives browsers can enforce from HTML.
- GitHub Pages Jekyll bypass via `.nojekyll`, so `/.well-known/security.txt` can be published.
- Static checks through `npm run test:security` and `npm run test:seo`.
- GitHub Actions live site verification logic and public diagnostics.

## Not Controlled In This Repo

GitHub Pages does not expose arbitrary per-site HTTP security headers from repository files. If this domain is served directly from GitHub Pages, configure the following at a CDN/reverse proxy in front of it, or migrate to a static host that supports headers.

Recommended HTTP response headers are listed in `docs/deployment-security-headers.md`. For the current Cloudflare-proxied deployment, apply them with Cloudflare Response Header Transform Rules or equivalent Cloudflare-managed header configuration.

Do not enable long-lived HSTS from this repo. HSTS is intentionally not enabled yet. Add `Strict-Transport-Security` only after confirming HTTPS works for the apex domain and any subdomains that would be covered by `includeSubDomains`. Start with a short `max-age`, then increase deliberately.

Do not commit Cloudflare account IDs, API tokens, zone IDs, DNS credentials, private email credentials, or provider screenshots containing private values. If a setting requires a private value, perform it inside Cloudflare or the DNS/email provider and record only the non-sensitive outcome here.

## Manual DNS/CDN/Registrar Checks

- Confirm GitHub Pages "Enforce HTTPS" is enabled if GitHub Pages is the active host.
- Confirm DNS records for `kamranboroomand.ir` point only to the intended host or CDN.
- Confirm `https://www.kamranboroomand.ir/` has a certificate that covers `www.kamranboroomand.ir` and redirects to `https://kamranboroomand.ir/`. If `www` is served directly by GitHub Pages instead of through Cloudflare, GitHub's wildcard certificate may not cover the custom `www` hostname.
- Provision and test the `security@kamranboroomand.ir` mailbox used by `/.well-known/security.txt`.
- Consider DNSSEC and CAA records at the DNS provider if supported.
- Keep registrar account MFA and domain lock enabled.
- If Cloudflare or another CDN fronts the site, apply the response headers there and verify with `curl -I https://kamranboroomand.ir/`.
- If the GitHub Actions live verifier receives HTTP `403` but normal users and local `curl` receive HTTP `200`, inspect Cloudflare Security Events, WAF custom rules, Bot Fight Mode / Super Bot Fight Mode, browser integrity checks, and rate limiting for the verifier request. The verifier sends this User-Agent: `KamranBoroomand-Portfolio-LiveVerifier/1.0 (+https://kamranboroomand.ir/security/)`.

## Manual Cloudflare Dashboard Recommendations

These are provider-side settings to review manually. Do not commit Cloudflare account IDs, API tokens, zone IDs, or screenshots containing private settings.

- Bot Fight Mode: keep off if it blocks GitHub Actions or external synthetic monitors.
- Security Level: Medium is a reasonable starting point for this portfolio.
- Browser Integrity Check: keep off if it causes false positives for monitors.
- Security headers: verify they are enabled through Cloudflare Response Header Transform Rules.
- HSTS: keep off until every active subdomain is verified HTTPS-ready.
- Cloudflare Security Events: use this as the source of truth for edge challenge/block diagnostics.

## Runtime Verification

Run these after deployment:

```bash
curl -I https://kamranboroomand.ir/
curl -I https://kamranboroomand.ir/.well-known/security.txt
npm run verify:live
```

Check that the response headers match the CDN/host configuration and that `/.well-known/security.txt` returns `200`.
