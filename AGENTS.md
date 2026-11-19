# Repository Guidelines for AI Agents

## Overview
Retirement Shield is a local-first Singapore retirement planning Progressive Web App (PWA) comparing Community Care Apartments (CCA) and Home + Helper scenarios against CPF rules (OA/SA/MA/RA, CPF LIFE Standard/Escalating, FRS/ERS) and outside investments. All calculation runs client-side with zero runtime framework dependencies.

---

## 1. Clean Working Tree & Ephemeral File Hygiene
- **Zero untracked leftovers:** Never leave untracked scratch files, one-off test scripts, or temporary dumps in the repository root or subdirectories upon concluding a task.
- **Scratch & debugging scripts:** If creating temporary scripts to reproduce issues or verify calculations, clean them up (delete them) before finishing.
- **Atomic configuration changes:** Never reference an untracked file in persistent configurations (`package.json`, `Makefile`, `.github/workflows/`, etc.). If a new test or file is intentionally added to project scripts, stage/commit it alongside the configuration changes.
- **Verification before finish:** Always run `git status -u` before concluding to confirm no unintentional files or half-applied edits remain.

---

## 2. Module & File Extension Conventions
- **Browser runtime (`app.js`, `model.js`):**
  - Vanilla JavaScript (`.js`).
  - No external runtime dependencies or node-specific globals in client code.
  - `model.js` exports via UMD/IIFE (`root.RetirementModel = api; if (typeof module !== 'undefined' && module.exports) module.exports = api;`) to allow direct loading in browsers and headless testing in Node.
- **Build tooling (`tools/*.mjs`):**
  - Node ES Modules with explicit `.mjs` extensions (`build.mjs`, `prune-css.mjs`, `icons.mjs`).
- **Test suites (`*.test.cjs`):**
  - CommonJS (`.cjs`) using Node's built-in test runner: `node:test` and `node:assert/strict`.
  - Execute via `npm test` (`node --test model.test.cjs pwa.test.cjs`).

---

## 3. Verification Commands
- `npm test`: Runs Node calculation invariant tests and PWA bundle validation. Must pass before completing any change.
- `npm run build`: Minifies and hashes assets into `dist/`.
- `npm run format`: Formats code, styles, tests, docs, and JSON using Prettier.

---

## 4. Domain & UI Invariants (Anti-Hallucination Rules)
- **Exact `RetirementModel.C` constant names:** Use `C.wageCap` (`$8,000/mo`), `C.annualWageCap` (`$102,000/yr`), `C.bhs` (`$79,000`), `C.frs` (`$220,400`), `C.ers` (`$440,800`), `C.personalReliefCap` (`$80,000`), `C.ssbCap` (`$200,000`), and `C.srsCap` (`$15,300`). Never reference non-existent aliases like `salaryCeiling` or `bhs2026`.
- **SRS contribution & drawdown consistency:** Both `taxSweetSpot()` and `firePlan()` allow SRS contributions up to `retire` (since IRAS permits contributions until the first penalty-free withdrawal starts the 10-year clock at `Math.max(srsLockInAge, retire)`). `taxSweetSpot()` models ongoing SRS investment returns during the 10-year drawdown via an amortizing payout factor (`r / (1 - (1+r)^-10)`). In `firePlan()`, `monthlyTotalIncome` includes **net post-tax** SRS drawdown (`netSrsDraw`), with `monthlySrsTax` tracked separately so `monthlyTotalIncome` never exceeds `monthlySpend` by IRAS tax.
- **Tap 3 vs. Tap 4 non-overlap:** In `retirementTapsPlan()`, Tap 3 (`projectedInvestAtRetireToday`) owns liquid equities only (`ptAtRetire.today.liquidEquities`), while Tap 4 (`projectedSsbCashAtRetireToday`) owns SSB/Cash + the bond sleeve (`ptAtRetire.today.ssbCash`), ensuring Tap 3 + Tap 4 = total liquid outside portfolio with zero double-counting.
- **Consistent `pctFunded` badge cap:** Use `formatFundedPct()` from `src/app/format.js` (`"100%+"` when `Math.round(pctFunded) > 100`, otherwise `"${Math.max(0, Math.round(pctFunded))}%"`) across the sidebar badge (`#nav-badge-overview`), Readiness Gauge, Overview hero KPI, Quick Edit live summary, and Print Sheet so numeric readouts never contradict the `100%`-capped SVG arc.
- **Over-funded `requiredInvestTo95`:** When `depletionAge === null` in `firePlan()`, `requiredInvestTo95` runs a downward binary search in `[0, totalMonthlyOutside]` and reports `$0` if the existing portfolio already survives to `endAge`.
- **Post-55 OA withdrawals & `age > 65` CPF bands:** `allocation(age, year)` includes statutory `65–70` (`16.5%`) and `>70` (`12.5%`) bands; `extraInterest()` clamps balances at `>= 0`; post-55 OA withdrawals prorate foregone OA interest by remaining months in the year (`(12 - monthIdx % 12) / 12 * 2.5%`).
- **Cash accounts & rebalance sync:** Editing single-figure cash (`#known-ssb-cash`, `#qe-ssb-cash`) or running portfolio rebalance clears `customCashAccounts` so re-enabling itemized mode cannot resurrect stale totals. Rebalance math handles `srsMode === "global" || srsMode === "equities"` consistently via `computeRebalanceTargets()`.
- **Accessibility & layout guardrails:** Never use `outline: none` without a replacement `:focus-visible` ring (preserve `outline: 2px solid transparent` on custom `:focus-within` wrappers for `@media (forced-colors: active)`). Keep `body { overflow-x: clip; }` (never `overflow-x: hidden`, which breaks `position: sticky`). Keep `<script type="module" src="app.js">` in `index.html` so dev-mode serving works alongside `dist/` IIFE builds.
