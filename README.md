# Retirement Shield

A Singapore retirement planner for Solo + Helper spending, salary CPF, FRS/ERS scenarios and the outside investments needed to fund a gap. All personal calculations run in the browser; inputs are not transmitted or persisted.

Live app: https://retirement-shield.hycurl.chatgpt.site

## Development

Node 22+ is recommended. There are no browser runtime dependencies.

```sh
npm ci
npm run build
npm test
python3 -m http.server 4173 --directory dist
```

`index.html`, `app.js`, `model.js`, `styles.css` and `sw.js` are readable source. The build regenerates PNG/ICO icons from SVG, minifies CSS/JS, hashes their filenames and creates a versioned offline cache in `dist/`. The Sites hosting manifest serves this folder. Do not manually edit `dist/`.

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
