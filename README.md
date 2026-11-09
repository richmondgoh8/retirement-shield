# Retirement Shield

A Singapore retirement planner for Solo + Helper spending, salary CPF, FRS/ERS scenarios and the outside investments needed to fund a gap. All personal calculations run in the browser; inputs are not transmitted to a server. Plans are saved in browser localStorage and the URL fragment; copied URLs can reveal inputs. The privacy disclosure includes a clear-saved-plan control that disables saving for the current browser-tab visit.

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

## Rules reviewed 9 November 2026

Default assumptions and the 18–54 full-rate employee scope are retained. The optional post-55 illustration uses CPF’s announced 2027 allocation ratios (held constant afterwards), caps RA contributions at the cohort FRS, excludes post-55 OA from payout funding, and discounts RA additions to a 55-equivalent for approximate reference-table payouts. This is not personalised annuity pricing. CPF interest rates, sum growth and payout scaling remain disclosed planning assumptions.

Official references: [2026 allocations](https://www.cpf.gov.sg/service/sfc/servlet.shepherd/document/download/069IW00000DZMxZYAX), [2027 allocations](https://cpf.gov.sg/content/dam/web/employer/employer-obligations/documents/jan2027cpfallocationrates.pdf), [2027 contribution changes](https://www.cpf.gov.sg/service/article/what-are-the-changes-to-the-cpf-contribution-rates-for-senior-workers-that-will-take-effect-from-1-january-2027), [CPF payout references](https://www.cpf.gov.sg/service/article/how-much-cpf-payouts-can-i-get-every-month).

The optional peaceful-retirement guide is self-paced. Completion/skip advances only on user action; it does not certify financial readiness. Progress is stored locally and erased with the saved plan. The yearly trajectory table provides keyboard and assistive-technology access to the chart data.

### Refinement validation

28 automated checks pass, including official senior allocation anchors, RA cap/OA separation, discounting later additions and preventing post-55 contributions from pre-funding an age-55 target. Headed Chromium checks covered answer ordering, reset defaults, guide advancement/persistence, chart table/toggle state, unsupported-age handoff, stale-output clearing, true deletion and no immediate re-save, dialog keyboard tabs/Escape/focus return, and offline reload. The 390×844 start CTA fits in view without horizontal page overflow. A one-page PDF was generated and visually inspected. Physical device installation and a full screen-reader/AA conformance audit remain manual follow-ups.

## Today-dollar display

All personal future balances, payouts, spending and gaps are displayed in today's purchasing power: nominal amount / (1 + selected inflation) ^ years to the amount's date. CPF targets use age 55, payouts use their payout age, and portfolio targets/balances use retirement/the chart point's age. Current balances, salary and required fixed-cash monthly contributions are not discounted. The underlying funding calculation remains nominal; returns remain nominal after fees. A fixed nominal helper levy loses purchasing power, so real spending before the care-age uplift can be below today's input budget. Current statutory caps are shown as current rules, not inflation-adjusted entitlements.

The separate care-cost example starts at age 65 today; its original ten-year cost allowances are deflated by its disclosed 3% reference inflation. Personalised projections use the user's selected rate. Drawdown slices share the chosen retirement date, cannot exceed the portfolio and convert the nominal SSB cap at that date. Monthly trajectory withdrawals now match the target calculation's cash-flow timing rather than using yearly stepped spending. Display conversions, nominal savings invariance, milestone reconciliation, retirement ages 40–80 and funded depletion at 90 have regression coverage.

Today-dollar validation: 33 automated tests pass. Headed browser checks reconciled the answer, age-65 chart row and printed target across 54 age/plan/retirement/scenario combinations; verified converted care ranges, mobile overflow, offline reload and the one-page PDF. Default example: age-65 spending $3,324, CPF $639, outside gap $2,684 (independently rounded), with an unchanged $2,869 monthly cash investment target starting now.
