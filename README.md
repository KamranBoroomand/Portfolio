# Kamran Boroomand Portfolio
A high-signal personal site showcasing Linux administration, security hardening, and automation work with interactive visual effects.

## Table of Contents
- [Overview](#overview)
- [Core Features](#core-features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Scripts](#scripts)
- [Deployment](#deployment)
- [Security/Quality Notes](#securityquality-notes)
- [Roadmap](#roadmap)

## Overview
This repository contains a static portfolio site for `kamranboroomand.ir`. The UI is primarily HTML/CSS/JavaScript, with a small React + OGL effects layer bundled into static assets. The site focuses on:
- Professional profile and capabilities in Linux systems and security.
- Resume-style certifications and technical stack.
- A filterable live project showcase with outbound links.

## Core Features
- Single-page tab navigation (`About`, `Resume`, `Projects`) with URL hash synchronization.
- Client-side project filtering (`All`, `Security`, `Automation`) for the showcase section.
- Visual effects layer using WebGL (faulty terminal shader) rendered behind the main layout.
- Hidden avatar-triggered easter egg modal with audio and glitch canvas animation.
- SEO and social metadata (Open Graph, Twitter, canonical URL, JSON-LD `Person` schema).
- Custom 404 page with friendly recovery links and timed redirect.
- Static `robots.txt`, `sitemap.xml`, and custom domain support via `CNAME`.

## Tech Stack
- `HTML5` for page structure and content.
- `CSS3` for responsive design system and component styling.
- `Vanilla JavaScript` for tabs, filters, and UI interactions.
- `React 18` + `react-dom` for the effects/easter-egg layer.
- `OGL` for WebGL shader rendering.
- `esbuild` for bundling React effects to static assets.
- `Ionicons` (CDN) for interface icons.

## Architecture
High-level structure:
- `index.html`: Primary document, semantic sections, metadata, and script/style includes.
- `assets/css/style.css`: Main UI styling and design tokens.
- `assets/js/script.js`: Non-React interaction logic (tabs + filter UI).
- `src/react/*`: Effects source code (`FaultyTerminal`, `AvatarEasterEgg`, `LetterGlitch`).
- `assets/js/effects.bundle.js` and `assets/js/effects.bundle.css`: Build output served in production.
- `404.html`: Standalone error page.
- `robots.txt`, `sitemap.xml`, `CNAME`: Search/discovery/domain configuration.

Runtime flow:
1. Static HTML loads layout/content.
2. `script.js` enables navigation and project filtering.
3. `effects.bundle.js` mounts React into `#effects-root` for visual layer + easter egg.

## Quick Start
Prerequisites:
- Node.js 18+ and npm.

Install and build effects bundle:
```bash
npm install
npm run build:effects
```

Run locally with any static server from the repo root:
```bash
python3 -m http.server 4173
```

Then open `http://127.0.0.1:4173`.

## Configuration
Common edits:
- Profile content, sections, project cards, metadata: `index.html`
- Main visual styling and responsive behavior: `assets/css/style.css`
- Navigation/filter logic: `assets/js/script.js`
- Effect parameters (shader intensity, tint, mouse reaction): `src/react/effects-entry.tsx`
- Easter egg behavior/audio path: `src/react/AvatarEasterEgg.tsx`
- Domain and crawler config: `CNAME`, `robots.txt`, `sitemap.xml`

When modifying files under `src/react/`, rebuild:
```bash
npm run build:effects
```

## Scripts
`package.json` currently defines:
- `npm run build:effects`  
  Bundles `src/react/effects-entry.tsx` into `assets/js/effects.bundle.js`.

## Deployment
Target deployment is static hosting (GitHub Pages-compatible), with custom domain `kamranboroomand.ir`.

Typical release flow:
1. Update content/styles/source files.
2. Run `npm run build:effects` if React effects changed.
3. Commit source changes plus generated bundle assets.
4. Push to the branch/environment used by your static host.

Domain/search files already included:
- `CNAME`
- `robots.txt`
- `sitemap.xml`

## Security/Quality Notes
- No backend/runtime server code, which keeps attack surface low.
- External links use `target="_blank"` with `rel="noopener noreferrer"`.
- Structured metadata and semantic HTML improve discoverability and consistency.
- `404.html` is marked `noindex` and guides users back to valid routes.
- `package-lock.json` is committed for deterministic dependency resolution.
- Current gap: no automated linting/tests/CI checks are configured in this repo.

## Roadmap
- Add local dev workflow (`watch`/`serve`) for faster iteration.
- Add linting and formatting scripts with CI enforcement.
- Add end-to-end smoke tests for tabs, filters, and key links.
- Improve performance by optimizing/compressing large image assets.
- Strengthen front-end hardening with CSP and pinned external asset strategy.
