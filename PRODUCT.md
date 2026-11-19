# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Singapore Citizens and Permanent Residents aged 18 to 54 planning long-term retirement cashflow, housing adequacy, CPF accumulation, tax-efficient Supplementary Retirement Scheme (SRS) contributions, and outside investment bridges. Primary users evaluate concrete trade-offs between ageing in a Community Care Apartment (CCA) versus staying in an existing Home + Helper household, and export a single-page A4 plan for spouse or family review.

## Product Purpose

Retirement Shield translates complex multi-account Singapore statutory rules (CPF Ordinary, Special, MediSave, and Retirement Accounts, Age-55 shield formation, CPF LIFE Standard and Escalating payouts at Age 65, IRAS progressive tax relief, and MAS cash yields) into a transparent, inflation-adjusted monthly retirement paycheck plan. Success means a user can immediately see their real monthly spending target, how much CPF LIFE covers, how the 4-Tap withdrawal sequence bridges early or Age-65 retirement, and the exact monthly saving split needed today.

## Positioning

Unlike generic compound-interest calculators or bank lead-generation tools, Retirement Shield models Singapore's statutory mechanics locally in real today-dollars alongside nominal statutory caps—accounting for CPF wage ceilings, Age-55 RA sweep order, SRS 10-year 50%-taxable drawdown traps, HDB vs. bank mortgage OA drag, and holistic CPF-as-bond Boglehead asset allocation—with zero servers, zero telemetry, and instant offline PWA execution.

## Operating Context

Used on desktop browsers for deep multi-tab scenario modeling (`Overview`, `Trajectory`, `Allocator`, `Dividend & Yield`, `Cash Parking`, `Tax Relief`, `CPF Milestones`), on mobile standalone PWAs for quick check-ins and parameter edits, and printed or saved as a 1-page A4 portrait PDF (`#print-sheet`) for offline filing or household discussion.

## Capabilities and Constraints

- **100% Client-Side & Offline-First:** Vanilla JavaScript (`model.js`, `app.js`), self-hosted `Inter Variable` WOFF2 font, and a versioned service worker (`sw.js`) with zero runtime framework or CDN dependencies.
- **Persistence & Privacy:** All inputs stay in `localStorage` and URL hash parameters (`#...`), with an explicit one-step reset and session-save opt-out.
- **2026 Singapore Statutory Baseline:** Enforces cohort FRS/ERS projections, `$8,000/mo` CPF Ordinary Wage ceiling (`$102,000/yr` annual salary ceiling), `$8,000/yr` cash RSTU tax relief cap, `$15,300/yr` SRS cap (`$80,000` personal income tax relief cap), and live/synced MAS SSB and T-Bill yields.
- **Planning Age Scope:** Pre-55 accumulation planning (`18–54`) projecting through Age 55, custom retirement ages (`35–65`), Age 65 CPF LIFE start, and longevity horizons (`85–100`).

## Brand Commitments

- **Identity:** `RetirementShield` wordmark paired with the Swell Rose-Pink gradient shield containing three ascending wealth bars (`.fin-brand-badge`, `assets/icon.svg`, `favicon.svg`).
- **Voice:** Evidence-based, calm, direct Singapore financial-planning clarity—plain English labels, transparent statutory limits, and actionable recovery hints on validation errors without hype or fear-mongering.

## Evidence on Hand

- Verified CPF, IRAS, and MAS rules documented in `docs/cpf-model.md`.
- Deterministic calculation engine in `model.js` verified by `model.test.cjs` and production bundle checks in `pwa.test.cjs`.
- Synced MAS yield snapshot via `tools/fetch-mas-rates.mjs`.

## Product Principles

1. **Real-Dollar Honesty:** Present future retirement spending and multi-tap drawdowns in today's purchasing power first, explicitly labeling nominal statutory figures whenever IRAS or CPF rules fix caps in nominal dollars.
2. **One Coherent Plan Across Every Surface:** Changing a salary, lifestyle preset, custom expense item, or Trajectory saving override must reconcile identically across Overview KPIs, charts, modals, and the 1-page A4 Print Poster.
3. **Statutory Guardrails Over Guesswork:** Proactively surface CPF wage ceilings, Basic Healthcare Sum overflows, mortgage OA shortfalls, idle `0.05%` SRS cash drag, and SRS ballooning tax traps before they distort a plan.
4. **Zero-Trust Local Privacy:** Never add external fonts, analytics pixels, or server round-trips; the app must load and print cleanly completely offline.

## Accessibility & Inclusion

Targets WCAG 2.2 AA contrast (`>= 4.5:1` for body and pill copy, `>= 3:1` for large display numerals and graphical segments), full keyboard navigation across tabs, `<dialog>` modals, menus, and popovers, screen-reader polite live announcements (`#sr-status`), `prefers-reduced-motion` compliance, and non-color differentiation on charts and status pills.
