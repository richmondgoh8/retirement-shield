# Retirement Shield

A local-first Singapore retirement planner comparing Community Care Apartments (CCA), Home + Helper, and custom itemized budgets against salary CPF, FRS/ERS scenarios, SRS bridges, and outside investments.

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

- `index.html`, `styles.css`, `app.js` — 6-tab FinScope workspace (`Overview`, `Trajectory`, `Allocator`, `Cash Parking`, `Tax Relief`, `CPF Milestones`), `My Settings`, focused `<dialog>` modals, and 1-page A4 Print Summary.
- `model.js` — Pure calculation engine (`RetirementModel`) for CPF projections, scenario targets, SRS/Boglehead/MAS taps, housing loan checks, and print report models.
- `DESIGN.md`, `PRODUCT.md` — Authoritative Porcelain-Slate design system specification and product brief.
- `sw.js`, `manifest.webmanifest`, `assets/` — Offline service worker, PWA manifest, self-hosted Inter Variable font (`assets/inter-latin.woff2`, `assets/OFL.txt`), and unified Swell Rose-Pink SVG/PNG icons.
- `tools/` — Build (`build.mjs`), PNG/ICO icon generation (`icons.mjs`), MAS rate sync (`fetch-mas-rates.mjs`), and CSS pruning (`prune-css.mjs`).
- `*.test.cjs` — Node test suites for the model (`model.test.cjs`) and production PWA build (`pwa.test.cjs`).
- `docs/cpf-model.md` — Verified CPF rules, calculation assumptions, official sources, and model boundaries.

## Privacy & Deployment

All calculations run locally in the browser; inputs are never transmitted to a server. Plans are stored in `localStorage` and the URL hash (`#...`), with a reset-to-default confirmation flow.

Pushing to `main` builds, tests, and deploys `dist/` to GitHub Pages via `.github/workflows/pages.yml` using relative URLs under `/retirement-shield/`.
