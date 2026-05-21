# Deployment Security TODO

This repository is a static site. Evidence in this repo points to a GitHub Pages-compatible deployment: a root `CNAME` for `kamranboroomand.ir`, static root HTML files, and no Vercel, Netlify, Cloudflare Pages, Firebase, or server config.

## Controlled In This Repo

- Static HTML metadata, canonical URLs, robots, sitemap, local assets, and JSON-LD.
- Meta-delivered CSP for directives browsers can enforce from HTML.
- GitHub Pages Jekyll bypass via `.nojekyll`, so `/.well-known/security.txt` can be published.
- Static checks through `npm run test:security` and `npm run test:seo`.

## Not Controlled In This Repo

GitHub Pages does not expose arbitrary per-site HTTP security headers from repository files. If this domain is served directly from GitHub Pages, configure the following at a CDN/reverse proxy in front of it, or migrate to a static host that supports headers.

Recommended HTTP response headers are listed in `docs/deployment-security-headers.md`.

Do not enable long-lived HSTS from this repo. Add `Strict-Transport-Security` only after confirming HTTPS works for the apex domain and any subdomains that would be covered by `includeSubDomains`. Start with a short `max-age`, then increase deliberately.

## Manual DNS/CDN/Registrar Checks

- Confirm GitHub Pages "Enforce HTTPS" is enabled if GitHub Pages is the active host.
- Confirm DNS records for `kamranboroomand.ir` point only to the intended host or CDN.
- Provision and test the `security@kamranboroomand.ir` mailbox used by `/.well-known/security.txt`.
- Consider DNSSEC and CAA records at the DNS provider if supported.
- Keep registrar account MFA and domain lock enabled.
- If Cloudflare or another CDN fronts the site, apply the response headers there and verify with `curl -I https://kamranboroomand.ir/`.

## Runtime Verification

Run these after deployment:

```bash
curl -I https://kamranboroomand.ir/
curl -I https://kamranboroomand.ir/.well-known/security.txt
```

Check that the response headers match the CDN/host configuration and that `/.well-known/security.txt` returns `200`.
