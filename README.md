# Kamran Boroomand Portfolio

Static portfolio website for [kamranboroomand.ir](https://kamranboroomand.ir), built for Linux systems/security work showcase with interactive WebGL effects and strong quality gates.

## Highlights

- Single-page app flow with hash-based tabs (`About`, `Resume`, `Projects`, `Settings`).
- Data-driven project cards loaded from `assets/data/projects.json`.
- Interactive effects layer (React + OGL) mounted separately from main content.
- Accessibility-first interactions: keyboard tab navigation, skip link, ARIA-aware controls.
- Security and SEO baseline: CSP, Open Graph/Twitter metadata, JSON-LD schema, `robots.txt`, and `sitemap.xml`.
- Custom `404.html` with recovery links.

## Stack

- Core UI: `HTML`, `CSS`, `Vanilla JS`
- Effects: `React 18`, `OGL`, `esbuild`
- Tooling: `ESLint`, `Prettier`
- Testing: `Playwright`, `axe-core` (a11y), `Lighthouse CI`
- Asset pipeline: `sharp` scripts for image optimization and responsive variants

## Project Layout

```text
.
├── index.html
├── 404.html
├── assets/
│   ├── css/
│   ├── data/
│   ├── images/
│   └── js/
├── src/react/
├── tests/e2e/
├── scripts/
├── .github/workflows/
└── README.md
```

## Quick Start

Prerequisites:

- Node.js 20+ recommended
- npm 10+

Install dependencies:

```bash
npm ci
```

Run local development (watch effects + serve static site):

```bash
npm run dev
```

Open:

- `http://127.0.0.1:4173`

## Key Files

- Content/metadata: `index.html`
- Main styling: `assets/css/style.css`
- Interaction logic (tabs, filters, preferences, analytics pixel): `assets/js/script.js`
- Effect source: `src/react/effects-entry.tsx`
- Project data: `assets/data/projects.json`
- Playwright config: `playwright.config.mjs`
- Lighthouse config: `.lighthouserc.json`

## Scripts

### Development and Build

- `npm run dev` - watch effects bundle + serve site on `127.0.0.1:4173`.
- `npm run serve` - serve static files for local manual checks.
- `npm run serve:test` - local server used by Playwright.
- `npm run watch:effects` - watch and rebuild `assets/js/effects.bundle.js`.
- `npm run build:effects` - one-time effects bundle build.
- `npm run images:responsive` - generate responsive image variants.
- `npm run build` - run `images:responsive` then `build:effects`.
- `npm run optimize:images` - optimize source image assets.

### Quality

- `npm run lint` - ESLint for browser JS, scripts, and tests.
- `npm run format` - format repository with Prettier.
- `npm run format:check` - verify formatting.
- `npm run perf:check` - enforce asset/performance budgets.
- `npm run test:e2e` - smoke tests (chromium).
- `npm run test:e2e:matrix` - smoke tests across multiple browsers/devices.
- `npm run test:a11y` - accessibility checks with axe.
- `npm run test:visual` - screenshot regression checks.
- `npm run test:e2e:easter-egg` - avatar easter egg behavior check.
- `npm run test:lighthouse` - Lighthouse CI assertions.
- `npm run check` - build + lint + format + perf + smoke + a11y.
- `npm run quality:extended` - matrix + visual + easter egg.
- `npm run release:prepare` - full gate: `check + quality:extended + lighthouse`.

## Visual Snapshot Workflow

When intentional UI changes affect screenshot baselines:

```bash
npm run test:visual -- --update-snapshots
```

Snapshots are stored in `tests/e2e/visual.spec.js-snapshots/`.

## Quality and CI

CI workflows live in `.github/workflows/`:

- `ci.yml`: build, lint, formatting, perf, smoke, and a11y.
- `extended-quality.yml`: matrix + visual + easter egg.
- Lighthouse assertions are configured in `.lighthouserc.json`.

Current Lighthouse thresholds:

- Performance: `>= 0.55`
- Accessibility: `>= 0.95`
- SEO: `>= 0.90`

## Deployment

This is a static site project and is deployment-targeted for custom domain hosting.

Included deployment/search files:

- `CNAME`
- `robots.txt`
- `sitemap.xml`

Recommended release flow:

1. Update content/style/code.
2. Run `npm run release:prepare`.
3. Commit source + generated assets (effects bundle, snapshots if intentionally changed).
4. Push/deploy to your static host.

## Security Notes

- CSP is defined in both `index.html` and `404.html`.
- No backend runtime in this repository.
- Outbound links are hardened with `rel="noopener noreferrer"`.
- Lockfile is committed for deterministic installs.
