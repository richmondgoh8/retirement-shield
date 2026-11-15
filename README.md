# Retirement Shield

A local-first Singapore retirement planner comparing Community Care Apartments (CCA) and Home + Helper budgets against salary CPF, FRS/ERS scenarios, and outside investments.

Live app: https://hazelah.me/retirement-shield/

## Quick Start

Requires Node 22+, Python 3, Make, and `lsof`.

```sh
npm ci
make dev        # Builds dist/ and serves http://localhost:4173
npm test        # Runs model, calculation audit, and PWA checks
npm run build   # Builds minified, hashed offline assets into dist/
npm run format  # Formats source, tests, tools, and docs with Prettier
```

For browser development with the service worker active, enable DevTools -> Application -> Service Workers -> **Bypass for network**.

## Structure

- `index.html`, `styles.css`, `app.js` — Guided 3-step UI (details, estimate, savings simulator), charts, settings modal, and 1-page print sheet.
- `model.js` — Pure calculation engine (`RetirementModel`) for CPF projections, scenario targets, top-up timing comparisons, milestones, and trajectories.
- `sw.js`, `manifest.webmanifest`, `assets/` — Offline service worker, PWA manifest, self-hosted IBM Plex Sans font (`assets/OFL.txt`), and master SVG icon.
- `tools/` — Build (`build.mjs`), PNG/ICO icon generation (`icons.mjs`), and CSS pruning (`prune-css.mjs`).
- `*.test.cjs` — Node test suites for the model (`model.test.cjs`) and production PWA build (`pwa.test.cjs`).
- `docs/cpf-model.md` — Verified CPF rules, calculation assumptions, official sources, and model boundaries.

## Privacy & Deployment

All calculations run locally in the browser; inputs are never transmitted to a server. Plans are stored in `localStorage` and the URL hash (`#...`), with a clear-saved-plan toggle that disables saving for the current tab session.

Pushing to `main` builds, tests, and deploys `dist/` to GitHub Pages via `.github/workflows/pages.yml` using relative URLs under `/retirement-shield/`.
