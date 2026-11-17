---
name: Retirement Shield
description: Calm actuarial porcelain-slate design system for Singapore CPF, SRS, and 4-Tap retirement planning across web PWA and A4 print.
colors:
  primary-cobalt: "#2563eb"
  primary-hover: "#1d4ed8"
  primary-soft: "#eff6ff"
  primary-border: "#bfdbfe"
  swell-rose: "#e83e8c"
  swell-rose-bright: "#ec4899"
  swell-rose-ink: "#be185d"
  swell-rose-soft: "#fdf2f8"
  swell-rose-border: "#fbcfe8"
  sem-cpf: "#059669"
  sem-cpf-bright: "#10b981"
  sem-cpf-soft: "#ecfdf5"
  sem-cpf-border: "#a7f3d0"
  sem-equities-sg: "#60a5fa"
  sem-srs: "#7c3aed"
  sem-srs-soft: "#f5f3ff"
  sem-srs-border: "#ddd6fe"
  sem-cash: "#d97706"
  sem-cash-ink: "#b45309"
  sem-cash-soft: "#fffbeb"
  sem-cash-border: "#fde68a"
  sem-teal: "#0f766e"
  sem-alert: "#dc2626"
  sem-alert-ink: "#b91c1c"
  sem-alert-soft: "#fef2f2"
  sem-alert-border: "#fecaca"
  canvas-porcelain: "#f4f6fa"
  surface-pure: "#ffffff"
  border-hairline: "#edf0f7"
  border-strong: "#d8dee9"
  ink-slate: "#1e293b"
  ink-soft: "#475569"
  ink-muted: "#64748b"
  chart-grid: "#e5e7eb"
typography:
  display:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.15rem"
    fontWeight: 800
    lineHeight: 1.08
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.55rem"
    fontWeight: 750
    lineHeight: 1.18
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.02rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 450
    lineHeight: 1.55
    letterSpacing: "0em"
  label:
    fontFamily: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "0.04em"
rounded:
  sm: "10px"
  md: "14px"
  lg: "18px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "10px"
  md: "16px"
  lg: "22px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary-cobalt}"
    textColor: "{colors.surface-pure}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "9px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.surface-pure}"
  button-secondary:
    backgroundColor: "{colors.surface-pure}"
    textColor: "{colors.ink-slate}"
    rounded: "{rounded.sm}"
    padding: "8px 14px"
  button-rose-soft:
    backgroundColor: "{colors.swell-rose-soft}"
    textColor: "{colors.swell-rose-ink}"
    rounded: "{rounded.pill}"
    padding: "7px 14px"
  button-danger:
    backgroundColor: "{colors.sem-alert}"
    textColor: "{colors.surface-pure}"
    rounded: "{rounded.sm}"
    padding: "9px 16px"
  card-bento:
    backgroundColor: "{colors.surface-pure}"
    textColor: "{colors.ink-slate}"
    rounded: "{rounded.lg}"
    padding: "20px 22px"
  card-kpi:
    backgroundColor: "{colors.surface-pure}"
    textColor: "{colors.ink-slate}"
    rounded: "{rounded.md}"
    padding: "16px 18px"
  dialog-modal:
    backgroundColor: "{colors.surface-pure}"
    textColor: "{colors.ink-slate}"
    rounded: "{rounded.lg}"
    padding: "22px 24px"
  input-field:
    backgroundColor: "{colors.surface-pure}"
    textColor: "{colors.ink-slate}"
    rounded: "{rounded.sm}"
    padding: "9px 12px"
  chip-filter:
    backgroundColor: "{colors.canvas-porcelain}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
  pill-status-good:
    backgroundColor: "{colors.sem-cpf-soft}"
    textColor: "{colors.sem-cpf}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  pill-status-warn:
    backgroundColor: "{colors.sem-cash-soft}"
    textColor: "{colors.sem-cash-ink}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  pill-status-danger:
    backgroundColor: "{colors.sem-alert-soft}"
    textColor: "{colors.sem-alert-ink}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
---

# Design System: Retirement Shield

## Overview

**Creative North Star: "The Calm Actuarial Workspace"**

Retirement Shield operates as a quiet, daylight-first Singapore financial planning desk. Long-horizon decisions about CPF LIFE, housing adequacy, SRS tax bridges, and outside investments carry high cognitive weight; the interface lowers anxiety through crisp porcelain-slate ground (`#f4f6fa`), pure white bento cards (`#ffffff`), generous breathing room between analytical modules, and crisp tabular numerals that align to the pixel across interactive views and exported A4 print sheets.

Density is deliberate and structured rather than sparse or cramped: top-level executive KPIs summarize readiness at a glance, progressive-disclosure `<dialog>` modals isolate focused parameter edits without cluttering the dashboard, and multi-series charts pair clean hairline geometry with invariant semantic asset colors. Legacy dark-navy slabs, sage-parchment cards, warm cream canvases, and decorative thick side-border stripes are explicitly retired so every surface—from mobile standalone PWA to the 1-page A4 Print Poster—reads as one cohesive FinScope / Swell workspace.

**Key Characteristics:**

- **Porcelain-Slate Daylight Ground:** Cool porcelain canvas (`#f4f6fa`) paired with pure white cards (`#ffffff`) and subtle hairline borders (`#edf0f7`) for effortless scanning in bright ambient light and ink-light A4 printing.
- **Invariant Semantic Asset Coding:** Every financial bucket (CPF, Global/SG Equities, SRS, Cash/SSB, Shortfall) retains one dedicated hue across charts, 4-Tap drawdown cards, paycheck waterfalls, modals, and print.
- **Tabular Actuarial Numerals:** Self-hosted `Inter Variable` with `font-variant-numeric: tabular-nums` and optical currency unit de-emphasis (`.curr-wrap`) so dollar columns never jitter as sliders move.
- **Screen-to-Print 1:1 Identity:** The 1-page A4 Print Poster mirrors the live FinScope header card, brand mark, semantic palette, and computed model state without switching to an alien dark-banner template.

## Colors

The palette balances authoritative cobalt action controls and signature Swell rose brand energy against a calm cool-slate neutral ramp and strictly partitioned asset-class colors.

### Primary

- **Actuarial Cobalt** (`#2563eb` / hover `#1d4ed8`): Primary interactive buttons, focused input rings, slider thumbs, active links, and Global Equities data series. Supported by **Soft Cobalt Wash** (`#eff6ff`) and **Cobalt Hairline** (`#bfdbfe`) for selected pills and informational callouts.

### Secondary

- **Swell Rose** (`#e83e8c` / gradient start `#ec4899`): Brand shield badge (`.fin-brand-badge`), PWA install icon, active sidebar indicator accents, Age-55+ wealth milestone highlights, and the header Print action trigger.
- **Deep Rose Ink** (`#be185d`): Accessible foreground text whenever rose labels or actions sit on **Soft Rose Tint** (`#fdf2f8`) bordered by **Rose Petal Border** (`#fbcfe8`), guaranteeing `>= 5.9:1` WCAG AA contrast.

### Tertiary

- **CPF Shield Emerald** (`#059669` / chart series `#10b981`, wash `#ecfdf5`, border `#a7f3d0`): CPF OA/SA/MA/RA balances, CPF LIFE lifelong payouts (Tap 1), and funded readiness pills.
- **SG Dividend Sky** (`#60a5fa`): Singapore dividend equity sleeve paired alongside Actuarial Cobalt (`#2563eb`) for Global Equities (Tap 3).
- **SRS Bridge Violet** (`#7c3aed`, wash `#f5f3ff`, border `#ddd6fe`): Supplementary Retirement Scheme balances, annual contributions, and 10-year tax-smoothed drawdown bridge (Tap 2).
- **Sovereign Cash Amber** (`#d97706` / accessible text `#b45309`, wash `#fffbeb`, border `#fde68a`): Emergency cash, Singapore Savings Bonds, T-Bills (Tap 4), and caution advisories.
- **OA Yield Teal** (`#0f766e`): Post-55 liquid CPF OA interest tap and CCA lifestyle avatar badge (`>= 5.4:1` contrast with white text).
- **Shortfall Crimson** (`#dc2626` / accessible text `#b91c1c`, wash `#fef2f2`, border `#fecaca`): True retirement income deficits, validation errors, destructive reset confirmation, and SRS tax-trap warnings.

### Neutral

- **Porcelain Canvas** (`#f4f6fa`): App viewport background, subtle recessed tracks, table header fills, and PWA `theme_color` / `background_color`.
- **Pure Surface** (`#ffffff`): Sidebar rail, resting bento cards, interactive KPI tiles, `<dialog>` modal shells, and A4 print cards.
- **Slate Hairline** (`#edf0f7`) & **Defined Slate Border** (`#d8dee9`): Default `1px` card/row dividers and interactive input/button borders; `#e5e7eb` renders quiet chart gridlines.
- **Deep Slate Ink** (`#1e293b`), **Secondary Slate** (`#475569`), & **Muted Slate** (`#64748b`): Three-step typographic hierarchy maintaining WCAG AA legibility across pure white and porcelain surfaces.

### Named Rules

**The Semantic Asset Invariant Rule.** Every wealth bucket owns one immutable color across all 6 workspace tabs, all 4 modals, and the A4 Print Poster (`CPF = Emerald`, `Equities = Cobalt/Sky`, `SRS = Violet`, `Cash/SSB = Amber`, `Post-55 OA Tap = Teal`, `Deficit/Trap = Crimson`). Never repurpose Shortfall Crimson (`#dc2626`) for safe Cash/SSB buffers or swap CPF and Equities colors between adjacent widgets.

**The Rose Restraint Rule.** Swell Rose (`#e83e8c` / `#ec4899`) marks brand identity, active navigation cues, and the print action—never validation errors or body paragraphs. Whenever rose text appears on `#fdf2f8`, use Deep Rose Ink (`#be185d`) so small label contrast stays comfortably above `4.5:1`.

## Typography

**Display & Body Font:** `"Inter Variable"` (self-hosted `assets/inter-latin.woff2`, `100–900` weight axis, fallback `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`)

**Character:** Clean geometric-humanist neo-grotesque engineered for high-density interfaces and financial tables—authoritative in `750–800` display metrics, effortless at `13px–15px` analytical reading sizes, and razor-sharp at `6.5pt–9pt` on A4 laser/PDF output.

### Hierarchy

- **Display** (`800`, `clamp(1.65rem, 2.6vw, 2.15rem)`, line-height `1.08`, tracking `-0.03em`): Hero retirement readiness figures, primary KPI headline numbers, and modal summary totals.
- **Headline** (`750`, `clamp(1.38rem, 2.2vw, 1.62rem)`, line-height `1.18`, tracking `-0.025em`): Canonical `.fin-page-header h1` across all 6 workspace tabs (`Overview`, `Trajectory`, `Allocator`, `Cash Parking`, `Tax Relief`, `CPF Milestones`) and `My Settings`.
- **Title** (`700`, `0.98rem–1.08rem`, line-height `1.3`, tracking `-0.015em`): Bento card headers, `<dialog>` modal titles, and 4-Tap card headings.
- **Body** (`450–500`, `0.9375rem` / `15px`, line-height `1.55`, max measure `68ch`): Explanatory guidance, assumption notes, and form field inputs.
- **Label** (`650–700`, `0.72rem–0.78rem`, line-height `1.25`, tracking `0.02em–0.05em`): Table column headers, status pills, sidebar badges, and chart axis labels (`>= 6.5pt` minimum after scaling in `@media print`).

### Named Rules

**The Tabular Currency Rule.** Every monetary amount, percentage, age, and countdown across HTML tables, KPI strips, SVG charts, and print sheets must render with `font-variant-numeric: tabular-nums` and wrap currency prefixes/suffixes (`$`, `/mo`, `/yr`) in `.curr-wrap` (`0.72em` optical scale, muted weight) so numerals command primary visual hierarchy.

**The Single H1 Scale Rule.** Every workspace tab opens with one `.fin-page-header` using the exact same `clamp(1.38rem, 2.2vw, 1.62rem)` `<h1>` scale—never mix oversized `2.35rem` marketing headers on secondary tabs with compact `1.62rem` workspace headers on Overview.

## Layout

- **Desktop Workspace Shell (`> 960px`):** Fixed-width collapsible left sidebar (`244px` expanded, `72px` icon rail when collapsed via `#sidebar-collapse-toggle`) paired with a fluid main workspace capped at `1360px` max-width (`24px–32px` horizontal padding) below a sticky `60px` top workspace bar.
- **Analytical Bento Rhythm:**
  - **Executive KPI Strip:** 5-column equal-height summary grid (`12px–14px` gap) collapsing cleanly to `2–3` columns at `<= 960px` and stacked/2-up cards on mobile (`<= 640px`).
  - **Primary Analytical Row:** Asymmetric `1.55fr / 1fr` or `1.35fr / 1fr` two-column bento split pairing wide time-series trajectories with focused breakdown donuts or readiness gauges (`16px–20px` grid gap).
- **Responsive Breakpoints:**
  - `960px`: Sidebar transitions off-canvas in favor of a fixed bottom 6-tab navigation bar (`padding-bottom: calc(76px + env(safe-area-inset-bottom))`).
  - `820px` & `720px`: Two-column analytical grids stack into single-column cards; top header compacts lifestyle selector and action buttons (preserving icon-accessible Print and Settings triggers).
  - `640px`: Form grids and modal rows stack vertically with `44px` minimum touch targets.
- **Single-Page A4 Print Grid (`@media print`):** `@page { size: A4 portrait; margin: 9mm; }` yielding a `192mm × 279mm` printable frame organized into five deterministic bands: (1) FinScope Light Masthead + Context Chips, (2) 5-Card KPI Strip + Starting Balances Strip, (3) Net Worth Trajectory + Readiness Gauge + Age-65 Expense Donut, (4) 4-Tap Retirement Income Architecture + Paycheck Allocation Waterfall, and (5) Milestones, Strategy Comparison Table, 5-Row Action Plan, and Statutory Colophon.

## Elevation & Depth

Retirement Shield uses a **quiet-resting, crisp-floating** hybrid depth model: resting workspace cards rely primarily on pure white contrast against the `#f4f6fa` porcelain canvas plus a whisper-soft two-layer ambient slate shadow, while interactive hover states, popovers, and top-layer `<dialog>` modals step up decisively in blur and vertical offset.

### Shadow Vocabulary

- **Resting Card (`--surface-shadow`):** `0 2px 6px rgba(15, 23, 42, 0.03), 0 10px 28px rgba(15, 23, 42, 0.05)` — Applied to `.card-surface`, `.fin-card`, `.sim-controls-card`, and `.affordability-card`.
- **Interactive Hover Lift (`--shadow-hover`):** `0 6px 16px rgba(15, 23, 42, 0.06), 0 16px 36px rgba(15, 23, 42, 0.08)` — Paired with `translateY(-1px)` on clickable KPI cards and Cash Parking instrument tiles.
- **Floating Popover (`--popover-shadow`):** `0 12px 32px -4px rgba(15, 23, 42, 0.12), 0 4px 12px -2px rgba(15, 23, 42, 0.06)` — Used on `#header-lifestyle-menu`, `.field-help-panel`, and chart tooltips.
- **Modal Dialog (`--dialog-shadow`):** `0 24px 64px -12px rgba(15, 23, 42, 0.20), 0 4px 16px -2px rgba(15, 23, 42, 0.08)` — Paired with `::backdrop { background: rgba(15, 23, 42, 0.42); backdrop-filter: blur(3px); }` across all 4 native `<dialog>` modals.
- **Print Flatness (`@media print`):** All shadows collapse to `none` in print; hierarchy is carried strictly by `1px solid #d8dee9` borders and `#f8fafc` subtle fills.

### Named Rules

**The Quiet Resting Card, Crisp Floating Layer Rule.** Resting cards never compete for depth, while floating overlays (`.plan-settings`, `.field-help-panel`, `#header-lifestyle-menu`, `#ui-toast`) must never have their `box-shadow` stripped—elevation is how users immediately distinguish transient layers from the underlying sheet.

## Shapes

- **Outer Bento & Modal Radius (`18px` / `--radius-lg`):** Primary analytical cards, hero containers, and `<dialog>` modal frames.
- **Secondary Card & Callout Radius (`14px` / `--radius-md`):** Executive KPI cards, 4-Tap income cards, Cash Parking tiles, and Print Poster modules.
- **Control & Input Radius (`10px` / `--radius-sm`):** Text/number inputs, `<select>` menus, standard action buttons, segmented sub-blocks, and brand badge squircle.
- **Pill Geometry (`999px`):** Status verdicts (`.status-pill`), header Print button, lifestyle switcher pill, filter chips, toggle tracks, and segmented control gliders.
- **Clean Hairline Framing:** Containers are bounded by uniform `1px solid` borders (`#edf0f7` at rest, `#d8dee9` on inputs/print). Thick `3px–4px` colored `border-left` or `border-top` stripes on rounded cards are banned; semantic status is signaled via compact dots, icon badges, or soft pill fills.

## Components

### Buttons

- **Shape:** Gently rounded controls (`10px` radius) for standard actions; full capsule (`999px` radius) for top-header utility pills.
- **Primary (`.button-primary`):** Actuarial Cobalt (`#2563eb`) fill, white `600`-weight label, `9px 16px` padding; shifts to `#1d4ed8` on hover and displays a `2px` `#2563eb` focus ring (`2px` offset) on `:focus-visible`.
- **Secondary (`.button-secondary`):** Pure white (`#ffffff`) fill, `1px solid #d8dee9` border, Deep Slate (`#1e293b`) label; shifts to `#f8fafc` with `#cbd5e1` border on hover.
- **Rose Utility Pill (`.button-rose-soft`):** Soft Rose (`#fdf2f8`) fill, `1px solid #fbcfe8` border, Deep Rose Ink (`#be185d`) label and icon for the Print / Export A4 trigger.
- **Destructive (`.button-danger`):** Shortfall Crimson (`#dc2626`) fill with white text, reserved strictly for irreversible `#confirm-reset-modal` confirmation.

### Cards & Interactive KPI Tiles

- **Corner Style:** `18px` on primary `.fin-card` / `.card-surface` modules; `14px` on `.fin-kpi-card` tiles.
- **Background & Border:** `#ffffff` fill with `1px solid #edf0f7` and `--surface-shadow`.
- **Interactive Behavior:** Clickable KPI cards (`data-qe-open`) expose an edit affordance on hover/focus, lift `-1px` with `#bfdbfe` border tint, and open `#quick-edit-modal` pre-focused to the relevant parameter panel.

### Native Modal Dialogs (`<dialog class="plan-settings">`)

- **Anatomy:** Shared shell across `#plan-settings` (Model Assumptions), `#quick-edit-modal` (Quick Edit), `#expense-modal` (Spending Breakdown), and `#confirm-reset-modal` (Reset Confirmation): `18px` radius, `#ffffff` surface, `--dialog-shadow`, unified slate blur `::backdrop`, sticky header with circular/squircle close button, scrollable body, and right-aligned footer action bar.
- **Focus & Escape Discipline:** Opened via `showModal()`, traps tab focus natively, closes cleanly on `Escape` or backdrop click while clamping/reverting transient invalid inputs, and restores keyboard focus to the triggering control.

### Inputs, Steppers & Toggle Switches

- **Style:** `10px` radius, `1px solid #d8dee9` stroke, `#ffffff` fill, `tabular-nums` text, optional `$` prefix or `%` / `yrs` suffix adornments, and `±$50` `.saving-stepper` buttons for tactile saving adjustments.
- **Focus & Error:** `:focus-visible` shifts border to `#2563eb` with `0 0 0 3px rgba(37, 99, 235, 0.14)` ring; `[aria-invalid="true"]` shifts to `#dc2626` with an inline `.settings-error` recovery message.
- **Toggle Switch (`.ui-toggle-btn`):** `role="switch"` capsule button containing `.ui-toggle-state` text plus a `36px × 20px` `.ui-toggle-track` (`#cbd5e1` off, `#2563eb` on) and `16px` white `.ui-toggle-thumb` sliding `16px` via `transform`.

### Segmented Controls & Filter Bars

- **Style:** Recessed `#f4f6fa` track (`10px` or `999px` radius, `3px` padding) housing elevated `#ffffff` active pills (`0 1px 3px rgba(15, 23, 42, 0.08)` shadow, `#1e293b` `650`-weight text). Used consistently across `Trajectory` scenario toggles, `Overview` CPF LIFE plan toggles, `Cash Parking` glider tabs, and `Tax`/`CPF` subtabs.

### Navigation & Header Shell

- **Desktop Sidebar:** `244px` white rail with Swell Rose `.fin-brand-badge` header, `role="tablist"` navigation buttons showing live tabular status badges (`83%`, `Age 65`, `60/40`, `2.86%`, `SRS`, `Sal`/`FRS`/`ERS`), and collapsible `72px` icon mode.
- **Mobile Tabbar (`<= 960px`):** Fixed bottom 6-item bar with clear active Cobalt/Rose indicator and safe-area inset padding.

### Signature Component: 1-Page A4 Print Poster (`#print-sheet`)

- **Purpose:** Self-contained executive retirement blueprint designed specifically for `A4 portrait` (`192mm × 279mm`) physical printing and PDF export.
- **Structure:** Opens with a light Porcelain-Slate & White FinScope masthead card (`.fin-brand-badge` SVG + plan title + assumption chips + readiness status pill), followed by the 5-card KPI strip, starting CPF/outside portfolio breakdown, full-series net worth area chart (`forcedSeries: "all"`), readiness gauge, Age-65 spending donut, 4-Tap retirement income table in real today-dollars, paycheck allocation bars, life milestones, strategy comparison table, 5-row action checklist, and statutory methodology colophon.

## Do's and Don'ts

### Do:

- **Do** keep semantic asset colors identical across every chart, 4-Tap card, paycheck bar, modal breakdown, and A4 print widget (`CPF = #059669/#10b981`, `Equities = #2563eb/#60a5fa`, `SRS = #7c3aed`, `Cash/SSB = #d97706`, `Post-55 OA = #0f766e`, `Alert = #dc2626`).
- **Do** format all dollar figures with `tabular-nums` and `.curr-wrap` unit de-emphasis across both interactive DOM views and `#print-sheet`.
- **Do** express retirement income taps in **today's real purchasing power** whenever rendered side-by-side, explicitly tagging any nominal statutory cap (such as the `$40,000/yr` tax-free SRS drawdown band) as nominal.
- **Do** separate locked `SRS` balances from liquid outside investments (`Global Equities`, `SG Dividends`, `Cash/SSB`) in asset summaries and breakdowns.
- **Do** self-host all fonts (`assets/inter-latin.woff2`) and inline SVG icons so the PWA and A4 print poster render identically with zero network connectivity.
- **Do** hide transient viewport chrome (`#ui-toast`, `.app-sidebar`, `.mobile-tabbar`, `<dialog>` backdrops, help popovers) in `@media print` and omit `tabindex` inside `aria-hidden="true"` print containers.

### Don't:

- **Don't** reintroduce legacy palette eras—no dark-navy `#0a1829` / `#111827` banners or backdrops, no sage `#f6f8f5` / parchment `#faf3e5` cards, and no `#fdfbfa` cream backgrounds.
- **Don't** use thick (`> 1px`) colored `border-left` or `border-top` stripes on rounded cards or KPI strips; use subtle `1px` borders paired with semantic dots, icon badges, or soft tint pills.
- **Don't** strip `box-shadow` from `<dialog class="plan-settings">` modals or `.field-help-panel` popovers on screen.
- **Don't** leak interactive chart solo-filter state (`netWorthSelectedSeries`) into `#print-nw-chart`; the printed poster must always show the complete wealth stack.
- **Don't** allow closing a modal (`#quick-edit-modal`, `#expense-modal`, `#plan-settings`) to leave half-typed out-of-range inputs that lock the workspace behind an unrecoverable error banner.
