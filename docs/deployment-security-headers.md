# Deployment Security Headers

## Deployment Detection

Repo evidence points to a GitHub Pages-compatible static deployment:

- `CNAME` contains `kamranboroomand.ir`.
- `.nojekyll` is present so dot directories such as `/.well-known/` can be published.
- The site is static root HTML with no server runtime.
- No `vercel.json`, `netlify.toml`, `_headers`, `wrangler.toml`, or Firebase config is present.

Decision: do not add `vercel.json` or `_headers` for this repo. For the detected target, those files would not make GitHub Pages emit arbitrary HTTP response headers. GitHub Pages cannot set arbitrary response headers directly from repository files.

## Header Set For CDN Or Static Host Migration

Apply these as real HTTP response headers at the CDN, reverse proxy, or static host if one fronts the site.

```http
Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; script-src 'self'; script-src-attr 'none'; style-src 'self'; font-src 'self'; img-src 'self' data:; media-src 'self'; connect-src 'self' https://api.github.com; form-action 'self'; frame-src 'none'; frame-ancestors 'none'; worker-src 'none'; manifest-src 'self'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: accelerometer=(), ambient-light-sensor=(), autoplay=(), bluetooth=(), browsing-topics=(), camera=(), clipboard-read=(), clipboard-write=(), display-capture=(), encrypted-media=(), fullscreen=(self), gamepad=(), geolocation=(), gyroscope=(), hid=(), idle-detection=(), local-fonts=(), magnetometer=(), microphone=(), midi=(), payment=(), publickey-credentials-get=(), screen-wake-lock=(), serial=(), usb=(), web-share=(), xr-spatial-tracking=()
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
Origin-Agent-Cluster: ?1
```

If the host supports path-specific headers, only the homepage needs `connect-src https://api.github.com` for the public commit activity panel. Project and security pages can use `connect-src 'self'`.

Apply `Cross-Origin-Resource-Policy: same-origin` carefully. It is appropriate for HTML document responses, but applying it globally to image assets can affect cross-origin previews and embeds. Test Open Graph image previews before using a global rule.

## HSTS Guardrail

Do not enable includeSubDomains until every active subdomain in `docs/subdomain-inventory.md` is confirmed HTTPS-ready.

After verification, use:

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

Before that point, either omit HSTS or test only the apex domain with a short `max-age` and no `includeSubDomains`.

## Runtime Verification

After deployment through a CDN or a host that supports headers:

```bash
curl -I https://kamranboroomand.ir/
curl -I https://kamranboroomand.ir/projects/nullid/
curl -I https://kamranboroomand.ir/security/
```

Confirm the headers above are present in HTTP responses. Meta CSP in HTML remains only a static fallback and does not provide clickjacking protection.
