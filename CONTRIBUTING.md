# Contributing

## Scope

This repository is a static portfolio site with a React/OGL effects layer bundled into static assets.

## Contribution Checklist

- Create a branch from `main` using prefix `codex/` (or your own feature naming convention).
- Keep project data in `/Users/kamran/Documents/GitHub/Portfolio/assets/data/projects.json` instead of hardcoding project cards in HTML.
- If images change, run `npm run optimize:images`.
- Run `npm run check` before opening a PR.
- Run `npm run test:security` after changing metadata, CSP, privacy behavior, deployment artifacts, or workflow release packaging.
- Run `npm run test:seo` after changing titles, descriptions, hreflang tags, sitemap, robots, JSON-LD, public policy pages, or visible review dates.
- For UI/effects changes, also run `npm run quality:extended`.
- Ensure external links opened in new tabs include `rel="noopener noreferrer"`.
- Keep CSP-compatible resource usage (`script-src 'self'` and `script-src-attr 'none'` by default).

## Release Checklist

- Run `npm run release:prepare`.
- Confirm `npm run build` regenerated `/Users/kamran/Documents/GitHub/Portfolio/assets/images/responsive/*` and `/Users/kamran/Documents/GitHub/Portfolio/assets/js/effects.bundle.js`.
- Review `git diff` for accidental asset churn before commit.
- Verify `/Users/kamran/Documents/GitHub/Portfolio/index.html`, `/Users/kamran/Documents/GitHub/Portfolio/404.html`, `/Users/kamran/Documents/GitHub/Portfolio/security/index.html`, `/Users/kamran/Documents/GitHub/Portfolio/robots.txt`, and `/Users/kamran/Documents/GitHub/Portfolio/sitemap.xml` still match the release intent.
- Verify `/Users/kamran/Documents/GitHub/Portfolio/.well-known/security.txt` is included in release artifacts.
- Merge after CI passes (`quality`, `extended-quality`, and `lighthouse` jobs).
