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
- **SRS contribution, 10-year tax-free sweep & drawdown consistency:** Both `taxSweetSpot()` and `firePlan()` allow SRS contributions up to `retire` (since IRAS permits contributions until the first penalty-free withdrawal starts the 10-year clock at `srsWithdrawalStartAge = Math.max(srsLockInAge, retire)`). `taxSweetSpot()` models ongoing SRS investment returns during the 10-year drawdown via an amortizing payout factor (`r / (1 - (1+r)^-10)`), computes the exact `$0`-tax pot ceiling `srsZeroTaxCap = Math.min(C.srsSoftCapAt63, Math.round(40000 / pmtFactor))`, and never claims `$0 withdrawal tax` when `srsWithdrawalTaxAt63.annualTax > 0`. `retirementTapsPlan()` discounts both `srsProjectedAt63` and `srsTenYearAnnualDraw` from `srsWithdrawalStartAge`. In `firePlan()` (`stepRetirementDrawdown()`), during the 10-year penalty-free window, SRS proactively sweeps up to the `$40,000/yr` IRAS `$0`-tax band (net of taxable bridge income) into liquid cash even when CPF LIFE covers most spending—preventing an avoidable year-10 deemed-withdrawal tax bomb—while `monthlyTotalIncome` records only net post-tax SRS used for spending (`netSrsDraw <= need`) so `monthlyTotalIncome` never exceeds `monthlySpend`.
- **Net-of-SRS allocation & live MAS yield keys:** `bogleheadAllocation(p, monthlyInvest)` deducts `effectiveMonthlySrs` before splitting `liquidInvestPool` across Global Equities, SG Dividends, and Bonds/SSB so `retirementTapsPlan()` and `cashParkingPlan()` never double-count monthly SRS contributions. Always read MAS 6M T-Bill yields via `tbills.sixMonth.cutoffYield` (lowercase `o`), and never sweep cash overflow into T-Bills when `ssbRoom === 0` and `baseRatePct >= tbillBenchmarkPct`.
- **Tap 3 vs. Tap 4 non-overlap:** In `retirementTapsPlan()`, Tap 3 (`projectedInvestAtRetireToday`) owns liquid equities only (`ptAtRetire.today.liquidEquities`), while Tap 4 (`projectedSsbCashAtRetireToday`) owns SSB/Cash + the bond sleeve (`ptAtRetire.today.ssbCash`), ensuring Tap 3 + Tap 4 = total liquid outside portfolio with zero double-counting. All Tap 4 UI consumers (`buildFundingSourcesList`, Monthly Planned Savings card, Tap 4 card, Print Sheet) must read `projectedSsbCashAtRetireToday` (never `projectedCashOnlyAtRetireToday`), or the monthly bond sleeve silently vanishes.
- **Cash Parking categories & live T-Bill sweep benchmark:** `model.js` uses `category: "gov"` (MAS SSB/T-Bills) and `category: "fd-mmf"` (FDs/MMFs) — never `"sovereign"` or `"mmf"`. Cash Parking tags must badge `gov` / `protectionTone === "gov"` as `"SG Gov Backed"` (never `"SDIC $100k"`), and Cash Account readouts must check `acc.sovereignBacked`. `computeCashAccountsBreakdown()` must export `tbillBenchmarkPct` so `sweepCashAccountsOverflow()` uses live 6M T-Bill yields, and must only allocate SSB sweep room to accounts with `row.baseRatePct < ssbBenchmarkPct`.
- **Progressive IRAS tax deltas, regular monthly tax & SRS dynamic age/cap:** `computeMonthlyTakeHomeCashflow()` must deduct `regularActiveTax.monthlyTax` (excluding annual bonus tax) to reconcile with regular take-home pay `r.afterCpf`. Money Moves tax savings must compute progressive `residentTax()` deltas (stacking SRS after RSTU), never flat `amount * marginalRate`. All SRS UI labels must read `srsWithdrawalStartAge` and `srsZeroTaxCap` (never hardcoded `"age 63"` / `"$400k"`), and Tap 2 must use `maxSrsStandalone` when `maxRstu === 0`.
- **Funding percentage:** Use `formatFundedPct()` from `src/app/format.js` to display the full rounded funding percentage across the Overview, sidebar, readiness gauge, Quick Edit, and Print Sheet. The print view reads `rawPctFunded`. Keep the gauge arc capped at 100%.
- **Over-funded `requiredInvestTo95`:** When `depletionAge === null` in `firePlan()`, `requiredInvestTo95` runs a downward binary search in `[0, totalMonthlyOutside]` and reports `$0` if the existing portfolio already survives to `endAge`.
- **Post-55 OA withdrawals & `age > 65` CPF bands:** `allocation(age, year)` includes statutory `65–70` (`16.5%`) and `>70` (`12.5%`) bands; `extraInterest()` clamps balances at `>= 0`; post-55 OA withdrawals prorate foregone OA interest by remaining months in the year (`(12 - monthIdx % 12) / 12 * 2.5%`).
- **Cash accounts, rebalance falsy-zero & JSON import safety:** Editing single-figure cash (`#known-ssb-cash`, `#qe-ssb-cash`) or running portfolio rebalance clears `customCashAccounts` so re-enabling itemized mode cannot resurrect stale totals. Rebalance math handles `srsMode === "global" || srsMode === "equities"` consistently via `computeRebalanceTargets()`, must parse `0%` equity/SG sleeve with explicit empty-string checks (never `Number(val || 80)`), and must keep `sa` aligned with `bogleheadAllocation()`. JSON import must filter `["__proto__", "constructor", "prototype"]` and keep `render()` outside the JSON-parse `catch` block.
- **Accessibility, contrast & layout guardrails:** Never use `outline: none` without a replacement `:focus-visible` ring (preserve `outline: 2px solid transparent` on custom `:focus-within` wrappers for `@media (forced-colors: active)`). Keep `body { overflow-x: clip; }` (never `overflow-x: hidden`, which breaks `position: sticky`). Keep `<script type="module" src="app.js">` in `index.html` so dev-mode serving works alongside `dist/` IIFE builds. Arrow-key traversal in `role="tablist"` must pass `focus = false` to `navigateTo()` so focus stays on the active tab; Settings must preserve `tabindex="0"` on the last active tab; all `role="tabpanel"` landmarks must bind `aria-labelledby` to their tab `id`; text on `--surface-subtle` (`#f4f6fa`) must use `--ink-soft` (never `--ink-muted`, which fails WCAG AA at `4.40:1`); `.ui-tag.is-srs` must use `--sem-srs*` violet tokens (never equities cobalt blue); click-toggled `popover="auto"` help panels must not carry `role="tooltip"`.
