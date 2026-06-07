# Privacy Analytics

This site does not use Google Analytics, Google Tag Manager, advertising tags, third-party analytics scripts, or remote tracking pixels.

## Current Analytics Model

The only analytics mechanism in this repository is a first-party, same-origin request to:

```text
/assets/images/analytics-pixel.gif
```

It is served from the same origin as the portfolio. The browser scripts use
`fetch(..., { credentials: 'omit' })`, set `referrerPolicy = 'no-referrer'`, and do not
send analytics cookies.

## Collected Fields

The first-party pixel request may include only these query parameters:

- `v`: schema version
- `event`: allowlisted event name, such as `pageview`, `outbound_click`, or explicit UI action names
- `path`: current portfolio path plus hash, with arbitrary query strings removed
- `ts`: client timestamp in milliseconds
- `lang`: active page language
- `utm_source`: optional sanitized campaign source
- `utm_medium`: optional sanitized campaign medium
- `utm_campaign`: optional sanitized campaign name
- `utm_content`: optional short sanitized campaign content
- `label`: optional short UI category label
- `target`: optional category such as `mailto`, `telegram`, `github`, `project_live`,
  `project_repo`, or `resume_download`

Outbound target logging is category-only. For `mailto:` links, scripts record only `mailto`,
not the email address. For Telegram, GitHub, project live links, project repo links, and resume
downloads, scripts record only a category label.

Outbound categories and paths exclude query strings and hashes. The analytics target
excludes query strings and hashes. The scripts explicitly drop click identifiers such as `gclid`,
`fbclid`, `msclkid`, and `ttclid`. Unknown query parameters are not sent.

The scripts do not collect `document.referrer`, cookies, email addresses, form field values,
raw client error messages, stack traces, filenames, line numbers, user-entered content, screen
size, timezone, installed fonts, canvas data, hardware concurrency, device memory, full user
agent, account identifiers, IP addresses in JavaScript, or cross-site advertising identifiers.
Server/CDN access logs may still record standard request metadata outside this repository.

## Opt Out

Analytics is skipped when any of these are true:

- `localStorage.kb_analytics_opt_out` is set to `1`
- browser Do Not Track is enabled
- browser Global Privacy Control is enabled
- localStorage is unavailable

No analytics cookies are set or sent by this repository. The portfolio footer includes a
Privacy analytics control that sets or clears `localStorage.kb_analytics_opt_out`.

## Forbidden Tracking

The rule is simple: ad-network pixels are intentionally forbidden in code review and CI checks.
Do not add Google Analytics, Google Tag Manager, Meta Pixel, TikTok Pixel, Hotjar, session replay,
fingerprinting, retargeting, or third-party analytics scripts.

Campaign attribution is limited to sanitized `utm_source`, `utm_medium`, `utm_campaign`, and
short `utm_content` fields.

## CSP Contract

The analytics implementation must remain compatible with:

```text
script-src 'self'
connect-src 'self'
```

Do not add third-party analytics domains to CSP.
