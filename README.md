# Retirement Shield

A Singapore retirement planner for Solo + Helper spending, salary CPF, FRS/ERS scenarios and the outside investments needed to fund a gap. All personal calculations run in the browser; inputs are not transmitted or persisted.

Live app: https://hazelah.me/retirement-shield/

## Development

Node 22+ is recommended. There are no browser runtime dependencies.

```sh
npm ci
make dev
```

`make dev` (also `make local` or just `make`) builds the current code, stops any process listening on port 4173, prints http://localhost:4173, and starts the local server. Press Ctrl+C to stop. Requires Python 3, Make and `lsof`. Use `make dev PORT=4174` for another port. Run `npm test` separately for checks.

After changing code or resetting Git, run `make dev` again. For browser development, enable DevTools → Application → Service Workers → **Bypass for network** and keep DevTools open to avoid cached PWA responses.

`index.html`, `app.js`, `model.js`, `styles.css` and `sw.js` are readable source. The build regenerates PNG/ICO icons from SVG, minifies CSS/JS, hashes their filenames and creates a versioned offline cache in `dist/`. GitHub Actions builds, tests and publishes this folder to GitHub Pages. Do not manually edit `dist/`.

`npm run format` formats source files. `tools/prune-css.mjs` is an explicit maintenance tool for removing styles left behind when modules are deleted; inspect its changes and check all dynamic states before publishing.

## PWA assets and updates

- `assets/icon.svg` is the full-bleed master icon. Its essential artwork fits inside the central maskable safe circle (40% of the canvas width in radius).
- Build output includes 192/512 PNG launcher icons, a separate opaque 512 maskable icon, a 180 Apple touch icon, and SVG/multi-resolution ICO favicons.
- The IBM Plex Sans Latin variable WOFF2 is self-hosted and precached. Its SIL Open Font License is in `assets/OFL.txt`.
- HTML uses network-first loading; versioned assets use cache-first loading. Only a finite list of app resources is cached. Activation removes only older Retirement Shield caches.
- Existing installed apps receive the new app shell on their next online navigation. No forced reload interrupts an open calculation.

## Verification

`npm test` checks calculation invariants, cash-flow reconciliation, icon dimensions/opacity, manifest identity and local build references. Headed browser QA additionally covers scenario switching, settings, keyboard use, mobile layout, installability, offline reload and cache upgrades. Chrome checks do not replace physical iOS/Android home-screen installation tests.

The model assumptions are explained in the app. Future CPF sums and payouts are illustrative scenarios, not announced future rates or personalised CPF Board quotes.

## Deployment

The canonical source is https://github.com/richmondgoh8/retirement-shield. Push to `main` to run the locked dependency install, production build and tests before deploying to GitHub Pages. Pull requests run the build and tests without publishing. The site inherits the portfolio domain at `/retirement-shield/`; do not add a project-level CNAME.

Manifest, assets and service worker use relative URLs so installation and offline access stay within `/retirement-shield/`, alongside the other PWAs. GitHub Pages is public; it does not use the old Sites viewer allowlist.
