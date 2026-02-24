# Portfolio Website Repository

Static, production-ready portfolio website for [kamranboroomand.ir](https://kamranboroomand.ir), with multilingual UX, data-driven projects, case-study pages, and CI quality gates.

This repo can be used as-is for this site or forked as a base for your own portfolio website.

## Live Website

- Main site: `https://kamranboroomand.ir/`
- Case studies:

1. `https://kamranboroomand.ir/projects/nullid/`
2. `https://kamranboroomand.ir/projects/nullcal/`
3. `https://kamranboroomand.ir/projects/pacman/`

## Feature Highlights

- Single-page tab flow with hash routing (`#about`, `#resume`, `#portfolio`, `#settings`).
- Language switcher with persisted preference (`en`, `ru`, `fa`) and RTL support for Persian.
- Data-driven project cards from `assets/data/projects.json`.
- Dedicated case-study pages under `projects/*` with project-specific SEO/OG metadata.
- Optional interactive effects layer (React + OGL) mounted separately from core content.
- Accessibility baseline with keyboard tab navigation, skip link, and `axe` checks.
- SEO and discoverability: Open Graph, Twitter metadata, JSON-LD schema, `robots.txt`, and `sitemap.xml`.
- Security baseline: strict CSP, hardened outbound links, no server runtime in this repository.
- Automated quality gates in CI, including Playwright, Lighthouse CI, and asset budgets.

## Tech Stack

- UI: `HTML`, `CSS`, `Vanilla JavaScript`
- Effects layer: `React 18`, `OGL`, bundled by `esbuild`
- Tooling: `ESLint`, `Prettier`
- Tests: `Playwright`, `@axe-core/playwright`, `Lighthouse CI`
- Asset pipeline: `sharp` scripts for image optimization and responsive variants

## Repository Layout

```text
.
├── index.html
├── 404.html
├── projects/
├── assets/
│   ├── css/
│   ├── data/
│   ├── docs/
│   ├── images/
│   └── js/
├── src/react/
├── scripts/
├── tests/e2e/
├── .github/workflows/
└── README.md
```

## Getting Started

Prerequisites:

- Node.js `20+`
- npm `10+`

Install:

```bash
npm ci
```

Run local development (watch effects bundle + static server):

```bash
npm run dev
```

Open `http://127.0.0.1:4173`.

## NPM Scripts

Development and build:

- `npm run dev` - watch effects bundle and serve on `127.0.0.1:4173`
- `npm run serve` - static server for manual checks
- `npm run serve:test` - static server used by Playwright (`127.0.0.1:4273`)
- `npm run watch:effects` - rebuild `assets/js/effects.bundle.js` on change
- `npm run build:effects` - one-time effects bundle build
- `npm run images:responsive` - regenerate responsive image variants
- `npm run optimize:images` - optimize source image assets
- `npm run resume:pdf` - regenerate `assets/docs/kamran-boroomand-resume-ats.pdf`
- `npm run build` - run responsive images + effects build

Quality and release gates:

- `npm run lint` - ESLint across browser JS, scripts, and tests
- `npm run format` - Prettier write mode
- `npm run format:check` - Prettier check mode
- `npm run perf:check` - asset/performance budget checks
- `npm run test:links` - internal link/asset reference checks in HTML
- `npm run test:e2e` - Chromium smoke suite
- `npm run test:e2e:matrix` - smoke suite across multiple browsers/devices
- `npm run test:a11y` - accessibility checks with `axe`
- `npm run test:visual` - visual regression snapshots
- `npm run test:e2e:easter-egg` - avatar easter egg behavior check
- `npm run test:lighthouse` - Lighthouse CI assertions
- `npm run check` - build + lint + format + perf + links + smoke + a11y
- `npm run quality:extended` - matrix + visual + easter egg
- `npm run release:prepare` - full gate (`check + quality:extended + lighthouse`)

When visual baselines intentionally change:

```bash
npm run test:visual -- --update-snapshots
```

## Customize This Repo For Your Portfolio

If you fork this project, update these first:

1. Identity and metadata

- `index.html`: `<title>`, description, canonical URL, Open Graph, Twitter, JSON-LD person/site data
- `404.html`: fallback copy and metadata

2. Personal and project content

- `assets/data/projects.json`: card content, filters, metrics, links, localized project text
- `projects/*/index.html`: case-study page copy and media
- `assets/data/translations.json`: interface and content localization

3. Resume

- `assets/docs/kamran-boroomand-resume-ats.html` then run `npm run resume:pdf`

4. Domain and indexing

- `CNAME`, `robots.txt`, `sitemap.xml`, and absolute URLs in HTML metadata

5. Branding/media

- Replace images under `assets/images/`, then run:
  - `npm run optimize:images`
  - `npm run images:responsive`

## CI Workflows

Workflows in `.github/workflows/`:

- `ci.yml` - main CI for build, lint, formatting, perf, links, smoke, a11y, and lighthouse jobs
- `extended-quality.yml` - scheduled/manual cross-browser smoke + visual regression
- `preview.yml` - PR preview artifact upload with PR comment
- `release-snapshot.yml` - artifact snapshot for pushes to `main`
- `rollback.yml` - manual rollback PR generator to a target commit SHA
- `uptime-monitor.yml` - scheduled uptime checks with auto-open/close alert issue flow

Lighthouse thresholds (`.lighthouserc.json`):

- Performance: `>= 0.53`
- Accessibility: `>= 0.95`
- SEO: `>= 0.90`

## Deployment

This is a static site. You can deploy to any static host (for example GitHub Pages, Cloudflare Pages, Netlify, Vercel static output, or S3+CDN).

Recommended release flow:

1. Update content/code/assets.
2. Run `npm run release:prepare`.
3. Commit source and generated artifacts.
4. Push and deploy.

## Contributing

See `CONTRIBUTING.md` for branch and release checklists.

## License

Released under the MIT License. See `LICENSE`.
