# Deployment Security Headers

## Deployment Detection

Repo evidence points to a GitHub Pages-compatible static deployment:

- `CNAME` contains `kamranboroomand.ir`.
- `.nojekyll` is present so dot directories such as `/.well-known/` can be published.
- The site is static root HTML with no server runtime.
- No `vercel.json`, `netlify.toml`, `_headers`, `wrangler.toml`, or Firebase config is present.

Decision: do not add `vercel.json` or `_headers` for this repo. For the detected target, those files would not make GitHub Pages emit arbitrary HTTP response headers. GitHub Pages cannot set arbitrary response headers directly from repository files.

Current production context: the apex portfolio is GitHub Pages-compatible and is now proxied through Cloudflare. Cloudflare Response Header Transform Rules are the right place to apply the live HTTP security headers for this deployment. Keep Cloudflare account IDs, API tokens, DNS credentials, and private provider settings out of this public repository.

## Header Set For CDN Or Static Host Migration

Apply these as real HTTP response headers at Cloudflare, another CDN, reverse proxy, or a static host if one fronts the site.

```http
Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; script-src 'self'; script-src-attr 'none'; style-src 'self'; font-src 'self'; img-src 'self' data:; media-src 'self'; connect-src 'self'; form-action 'self'; frame-src 'none'; frame-ancestors 'none'; worker-src 'none'; manifest-src 'self'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: accelerometer=(), ambient-light-sensor=(), autoplay=(), bluetooth=(), browsing-topics=(), camera=(), clipboard-read=(), clipboard-write=(), display-capture=(), encrypted-media=(), fullscreen=(self), gamepad=(), geolocation=(), gyroscope=(), hid=(), idle-detection=(), local-fonts=(), magnetometer=(), microphone=(), midi=(), payment=(), publickey-credentials-get=(), screen-wake-lock=(), serial=(), usb=(), web-share=(), xr-spatial-tracking=()
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
Origin-Agent-Cluster: ?1
```

Do not add Google Analytics, Google Tag Manager, advertising tags, remote tracking pixels, or third-party analytics scripts. Keep analytics first-party and privacy-minimal. The CSP intentionally keeps `script-src 'self'` and `connect-src 'self'`.

Apply `Cross-Origin-Resource-Policy: same-origin` carefully. It is a good default for HTML document responses, but applying it globally to image assets or social-preview assets may affect cross-origin previews and embeds. If needed, use Cloudflare rules to apply stricter headers to HTML routes and lighter or overridden headers for image assets. Test Open Graph image previews before using a global rule.

## HSTS Guardrail

HSTS is intentionally not enabled yet. Do not enable includeSubDomains until every active subdomain in `docs/subdomain-inventory.md` is confirmed HTTPS-ready.

After verification, use:

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

Before that point, either omit HSTS or test only the apex domain with a short `max-age` and no `includeSubDomains`.

## Runtime Verification

After deployment through Cloudflare or another host that supports headers:

```bash
curl -I https://kamranboroomand.ir/
curl -I https://kamranboroomand.ir/projects/nullid/
curl -I https://kamranboroomand.ir/security/
```

Confirm the headers above are present in HTTP responses. Meta CSP in HTML remains only a static fallback and does not provide clickjacking protection.

The GitHub Actions workflow named `Live Site Verification` checks the live apex response for these headers, except `Strict-Transport-Security`. It verifies deployment correctness, headers, and public files; it is not the authoritative uptime monitor. Use Cloudflare Health Checks, Better Stack, UptimeRobot, Checkly, Grafana Synthetic Monitoring, or another external synthetic monitor for uptime alerting.

Run the same check locally with:

```bash
npm run verify:live
```

If GitHub Actions receives HTTP `403` while normal browsers and local `curl -I https://kamranboroomand.ir/` return `200`, treat that as a verifier challenge, not proof that the public site is down. Inspect Cloudflare Security Events, WAF custom rules, Bot Fight Mode / Super Bot Fight Mode, browser integrity checks, and any rate-limiting rules for GitHub Actions runner traffic. Prefer allowlisting the verifier's first-party User-Agent where appropriate:

```text
KamranBoroomand-Portfolio-LiveVerifier/1.0 (+https://kamranboroomand.ir/security/)
```
