# SEO Roadmap

## Current Multilingual Model

The homepage supports language selection through query parameters:

- English: `https://kamranboroomand.ir/`
- Russian: `https://kamranboroomand.ir/?lang=ru`
- Persian: `https://kamranboroomand.ir/?lang=fa`

`?lang=en` still works in the client, but the public canonical English URL is the root page. This avoids indexing a duplicate English URL.

## Why Route-Based Language URLs Are Deferred

Route-based URLs such as `/en/`, `/ru/`, and `/fa/` would be cleaner for search engines because each language page could ship translated HTML before JavaScript runs. This repository currently renders language changes client-side from `assets/data/translations.json`, so route-based language pages would require a larger refactor:

- static HTML output for each language route,
- per-route canonical and hreflang tags,
- localized Open Graph and Twitter metadata in the initial HTML,
- sitemap entries for the route URLs,
- smoke tests for each language route.

That migration is intentionally not included in this hardening pass because the current query-parameter language system works and a route migration would touch routing, metadata generation, and test coverage at the same time.

## Future Safe Migration Plan

1. Generate static localized HTML snapshots for `/en/`, `/ru/`, and `/fa/`.
2. Keep `/` as `x-default` and English canonical, or redirect `/en/` to `/` deliberately.
3. Update `sitemap.xml` to include every localized route with reciprocal `hreflang`.
4. Add Playwright checks for localized title, description, `html[lang]`, and `dir`.
5. Keep `?lang=` support as a backwards-compatible alias until search indexes settle.
