# Privacy Analytics

This site does not use Google Analytics, Google Tag Manager, advertising tags, third-party analytics scripts, or remote tracking pixels.

## Current Analytics Model

The only analytics mechanism in this repository is a first-party image request to:

```text
/assets/images/analytics-pixel.gif
```

It is served from the same origin as the portfolio. The browser scripts set `referrerPolicy = 'no-referrer'` on the image request.

## Collected Fields

The first-party pixel request may include these query parameters:

- `v`: schema version
- `event`: event name, such as `pageview`, `outbound_click`, or explicit UI action names
- `path`: current portfolio path, query, and hash
- `ts`: client timestamp in milliseconds
- `lang`: active page language
- `label`: optional clicked link label or short client-error message
- `target`: optional clicked target or short client-error source

Outbound target logging is minimized and excludes query strings and hashes. For `http` and `https` links, scripts record only the target origin plus pathname. For `mailto:` and `tel:` links, scripts record only `mailto` or `tel`.

The scripts do not collect `document.referrer`, cookies, account identifiers, IP addresses in JavaScript, or cross-site advertising identifiers. Server/CDN access logs may still record standard request metadata outside this repository.

## Opt Out

Analytics is skipped when any of these are true:

- `localStorage.kb_analytics_opt_out` is set to `1`
- browser Do Not Track is enabled
- browser Global Privacy Control is enabled
- localStorage is unavailable

No analytics cookies are set by this repository.

## CSP Contract

The analytics implementation must remain compatible with:

```text
script-src 'self'
connect-src 'self'
```

Do not add third-party analytics domains to CSP.
