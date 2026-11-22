---
name: Retirement Shield
description: Calm actuarial porcelain-slate design system for Singapore CPF, SRS, and 4-Tap retirement planning across web PWA and A4 print.
primitives:
  colors:
    blue-50: "#eff6ff"
    blue-200: "#bfdbfe"
    blue-400: "#60a5fa"
    blue-600: "#2563eb"
    blue-700: "#1d4ed8"
    rose-50: "#fdf2f8"
    rose-200: "#fbcfe8"
    rose-500: "#e83e8c"
    pink-500: "#ec4899"
    rose-700: "#be185d"
    emerald-50: "#ecfdf5"
    emerald-200: "#a7f3d0"
    emerald-500: "#10b981"
    emerald-600: "#059669"
    emerald-700: "#047857"
    violet-50: "#f5f3ff"
    violet-200: "#ddd6fe"
    violet-600: "#7c3aed"
    amber-50: "#fffbeb"
    amber-200: "#fde68a"
    amber-600: "#d97706"
    amber-700: "#b45309"
    teal-700: "#0f766e"
    red-50: "#fef2f2"
    red-200: "#fecaca"
    red-600: "#dc2626"
    red-700: "#b91c1c"
    orange-500: "#f97316"
    slate-50: "#f4f6fa"
    white: "#ffffff"
    slate-100: "#edf0f7"
    slate-300: "#d8dee9"
    slate-500: "#64748b"
    slate-600: "#475569"
    slate-800: "#1e293b"
    gray-200: "#e5e7eb"
  spacing:
    2xs: "4px"
    xs: "8px"
    sm: "12px"
    md: "16px"
    lg: "24px"
    xl: "32px"
  rounded:
    xs: "6px"
    sm: "8px"
    md: "12px"
    lg: "16px"
    pill: "999px"
  motion:
    ease-calm: "cubic-bezier(0.2, 0.8, 0.2, 1)"
    duration-fast: "150ms"
    duration-panel: "220ms"
  breakpoints:
    xs: "640px"
    sm: "720px"
    md: "820px"
    lg: "960px"
semantic:
  color:
    action-primary: "{primitives.colors.blue-600}" # --primary
    action-primary-hover: "{primitives.colors.blue-700}" # --primary-hover
    action-primary-ink: "{primitives.colors.blue-700}" # --primary-ink
    action-primary-soft: "{primitives.colors.blue-50}" # --primary-soft
    action-primary-border: "{primitives.colors.blue-200}" # --primary-border
    brand-accent: "{primitives.colors.rose-500}" # --swell-pink
    brand-accent-bright: "{primitives.colors.pink-500}" # --swell-pink-bright
    brand-accent-ink: "{primitives.colors.rose-700}" # --swell-pink-ink
    brand-accent-soft: "{primitives.colors.rose-50}" # --swell-pink-soft
    brand-accent-border: "{primitives.colors.rose-200}" # --swell-pink-border
    asset-cpf: "{primitives.colors.emerald-600}" # --sem-cpf
    asset-cpf-chart: "{primitives.colors.emerald-500}" # --sem-emerald
    asset-equities: "{primitives.colors.blue-600}" # --sem-equities
    asset-equities-sg: "{primitives.colors.blue-400}" # --sem-equities-sg
    asset-srs: "{primitives.colors.violet-600}" # --sem-srs
    asset-cash: "{primitives.colors.amber-600}" # --sem-cash
    asset-oa-post55: "{primitives.colors.teal-700}" # --sem-teal
    status-good-fg: "{primitives.colors.emerald-700}" # --sem-cpf-ink (5.21:1 on #ecfdf5)
    status-good-bg: "{primitives.colors.emerald-50}" # --sem-cpf-soft
    status-good-border: "{primitives.colors.emerald-200}" # --sem-cpf-border
    status-warn-fg: "{primitives.colors.amber-700}" # --sem-cash-ink (4.84:1 on #fffbeb)
    status-warn-bg: "{primitives.colors.amber-50}" # --sem-cash-soft
    status-warn-border: "{primitives.colors.amber-200}" # --sem-cash-border
    status-danger-fill: "{primitives.colors.red-600}" # --sem-alert (button-danger / bars)
    status-danger-fg: "{primitives.colors.red-700}" # --sem-alert-ink (5.91:1 on #fef2f2)
    status-danger-bg: "{primitives.colors.red-50}" # --sem-alert-soft
    status-danger-border: "{primitives.colors.red-200}" # --sem-alert-border
    status-srs-bg: "{primitives.colors.violet-50}" # --sem-srs-soft
    status-srs-border: "{primitives.colors.violet-200}" # --sem-srs-border
    canvas-default: "{primitives.colors.slate-50}" # --canvas
    surface-default: "{primitives.colors.white}" # --surface
    border-subtle: "{primitives.colors.slate-100}" # --border
    border-strong: "{primitives.colors.slate-300}" # --border-strong
    text-primary: "{primitives.colors.slate-800}" # --ink
    text-secondary: "{primitives.colors.slate-600}" # --ink-soft
    text-muted: "{primitives.colors.slate-500}" # --ink-muted (white cards only)
    chart-grid: "{primitives.colors.gray-200}" # --chart-grid
  elevation:
    surface-resting: "0 2px 6px rgba(15, 23, 42, 0.03), 0 10px 28px rgba(15, 23, 42, 0.05)" # --surface-shadow
    surface-hover: "0 6px 16px rgba(15, 23, 42, 0.06), 0 16px 36px rgba(15, 23, 42, 0.08)" # --surface-shadow-hover
    popover-floating: "0 12px 32px -4px rgba(15, 23, 42, 0.12), 0 4px 12px -2px rgba(15, 23, 42, 0.06)" # --popover-shadow
    dialog-modal: "0 24px 64px -12px rgba(15, 23, 42, 0.2), 0 4px 16px -2px rgba(15, 23, 42, 0.08)" # --dialog-shadow
modes:
  screen:
    canvas: "{semantic.color.canvas-default}"
    border-subtle: "{semantic.color.border-subtle}"
    elevation-resting: "{semantic.elevation.surface-resting}"
  print:
    canvas: "{semantic.color.surface-default}"
    border-subtle: "{semantic.color.border-strong}"
    elevation-resting: "none"
    min-label-size: "6.5pt"
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
components:
  button-primary:
    backgroundColor: "{semantic.color.action-primary}"
    textColor: "{semantic.color.surface-default}"
    typography: "{typography.body}"
    rounded: "{primitives.rounded.sm}"
    minHeight: "44px"
    padding: "10px 18px"
  button-primary-hover:
    backgroundColor: "{semantic.color.action-primary-hover}"
    textColor: "{semantic.color.surface-default}"
  button-secondary:
    backgroundColor: "{semantic.color.surface-default}"
    textColor: "{semantic.color.text-primary}"
    borderColor: "{semantic.color.border-subtle}"
    rounded: "{primitives.rounded.sm}"
    minHeight: "44px"
    padding: "10px 18px"
  button-rose-soft:
    backgroundColor: "{semantic.color.brand-accent-soft}"
    textColor: "{semantic.color.brand-accent-ink}"
    borderColor: "{semantic.color.brand-accent-border}"
    rounded: "{primitives.rounded.pill}"
    padding: "7px 14px"
  button-danger:
    backgroundColor: "{semantic.color.status-danger-fill}"
    textColor: "{semantic.color.surface-default}"
    rounded: "{primitives.rounded.sm}"
    minHeight: "44px"
    padding: "10px 18px"
  button-disabled:
    backgroundColor: "{semantic.color.canvas-default}"
    textColor: "{semantic.color.text-muted}"
    borderColor: "{semantic.color.border-strong}"
    opacity: 0.65
  card-bento:
    backgroundColor: "{semantic.color.surface-default}"
    textColor: "{semantic.color.text-primary}"
    rounded: "{primitives.rounded.lg}"
    padding: "20px 22px"
  card-kpi:
    backgroundColor: "{semantic.color.surface-default}"
    textColor: "{semantic.color.text-primary}"
    rounded: "{primitives.rounded.md}"
    padding: "16px 18px"
  dialog-modal:
    backgroundColor: "{semantic.color.surface-default}"
    textColor: "{semantic.color.text-primary}"
    rounded: "{primitives.rounded.lg}"
    padding: "22px 24px"
  input-field:
    backgroundColor: "{semantic.color.surface-default}"
    textColor: "{semantic.color.text-primary}"
    borderColor: "{semantic.color.border-strong}"
    rounded: "{primitives.rounded.sm}"
    padding: "9px 12px"
  chip-filter:
    backgroundColor: "{semantic.color.canvas-default}"
    textColor: "{semantic.color.text-secondary}"
    rounded: "{primitives.rounded.pill}"
    padding: "6px 12px"
  pill-status-good:
    backgroundColor: "{semantic.color.status-good-bg}"
    textColor: "{semantic.color.status-good-fg}"
    borderColor: "{semantic.color.status-good-border}"
    rounded: "{primitives.rounded.pill}"
    padding: "4px 10px"
  pill-status-warn:
    backgroundColor: "{semantic.color.status-warn-bg}"
    textColor: "{semantic.color.status-warn-fg}"
    borderColor: "{semantic.color.status-warn-border}"
    rounded: "{primitives.rounded.pill}"
    padding: "4px 10px"
  pill-status-danger:
    backgroundColor: "{semantic.color.status-danger-bg}"
    textColor: "{semantic.color.status-danger-fg}"
    borderColor: "{semantic.color.status-danger-border}"
    rounded: "{primitives.rounded.pill}"
    padding: "4px 10px"
---

# Design System: Retirement Shield

## Overview

**Creative North Star: "The Calm Actuarial Workspace"**

Retirement Shield operates as a quiet, daylight-first Singapore financial planning desk. Long-horizon decisions about CPF LIFE, housing adequacy, SRS tax bridges, and outside investments carry high cognitive weight; the interface lowers anxiety through crisp porcelain-slate ground (`#f4f6fa`), pure white bento cards (`#ffffff`), generous breathing room between analytical modules, and crisp tabular numerals that align to the pixel across interactive views and exported A4 print sheets.

Density is deliberate and structured rather than sparse or cramped: top-level executive KPIs summarize readiness at a glance, progressive-disclosure `<dialog>` modals isolate focused parameter edits without cluttering the dashboard, and multi-series charts pair clean hairline geometry with invariant semantic asset colors. Legacy dark-navy slabs, sage-parchment cards, warm cream canvases, and decorative thick side-border stripes are explicitly retired so every surface—from mobile standalone PWA to the 1-page A4 Print Summary—reads as one cohesive FinScope / Swell workspace.

**Key Characteristics:**

- **Porcelain-Slate Daylight Ground:** Cool porcelain canvas (`#f4f6fa`) paired with pure white cards (`#ffffff`) and subtle hairline borders (`#edf0f7`) for effortless scanning in bright ambient light and ink-light A4 printing.
- **Invariant Semantic Asset Coding:** Every financial bucket (CPF, Global/SG Equities, SRS, Cash/SSB, Shortfall) retains one dedicated hue across charts, 4-Tap drawdown cards, paycheck waterfalls, modals, and print.
- **Tabular Actuarial Numerals:** Self-hosted `Inter Variable` with `font-variant-numeric: tabular-nums` and optical currency unit de-emphasis (`.curr-wrap`) so dollar columns never jitter as sliders move.
- **Screen-to-Print 1:1 Identity:** The 1-page A4 Print Summary mirrors the live FinScope header card, brand mark, semantic palette, and computed model state without switching to an alien dark-banner template.

## Token Architecture & Modes

Retirement Shield organizes design decisions into **three explicit token layers** and **two formal context modes** so `DESIGN.md`, `.impeccable/design.json`, and `styles.css` remain in 1:1 sync:

1. **Primitives (`--raw-*`):** Raw palette steps (`--raw-blue-600`, `--raw-emerald-700`, `--raw-slate-50`), spacing constants (`--raw-space-xs`..`xl`), and motion durations (`150ms`, `220ms`). Never referenced directly inside component rules.
2. **Semantic (`--primary`, `--sem-*`, `--ink*`, `--canvas`, `--surface`):** Role-named tokens pointing directly to primitives (never chained to other semantic tokens). Note that `pwa.test.cjs` enforces `--sem-cpf`, `--sem-srs`, `--primary`, and `--sem-cash` on `.tap-progress-fill.*`, so those names remain the canonical semantic layer.
3. **Component Tokens & Context Modes:** Component selectors consume semantic tokens only. Switching from **Screen Mode** to **Print Mode** (`@media print`) overrides semantic surface/elevation tokens (`--canvas: #ffffff`, `--border: #d8dee9`, `--surface-shadow: none`) without duplicating component markup.

## Colors

The palette balances authoritative cobalt action controls and signature Swell rose brand energy against a calm cool-slate neutral ramp and strictly partitioned asset-class colors.

### Primary

- **Actuarial Cobalt** (`#2563eb` / hover `#1d4ed8`, ink `#1d4ed8`): Primary interactive buttons, focused input rings, slider thumbs, active links, and Global Equities data series. Supported by **Soft Cobalt Wash** (`#eff6ff`) and **Cobalt Hairline** (`#bfdbfe`) for selected pills and informational callouts (`#1d4ed8` on `#eff6ff` = `6.16:1`).

### Secondary

- **Swell Rose** (`#e83e8c` / gradient start `#ec4899`): Brand shield badge (`.fin-brand-badge`), PWA install icon, active sidebar indicator accents, Age-55+ wealth milestone highlights, and the header Print action trigger.
- **Deep Rose Ink** (`#be185d`): Accessible foreground text whenever rose labels or actions sit on **Soft Rose Tint** (`#fdf2f8`) bordered by **Rose Petal Border** (`#fbcfe8`), achieving **`5.53:1`** WCAG 2.2 AA contrast.

### Tertiary (Asset Classes & Status Ink Pairs)

- **CPF Shield Emerald** (`#059669` / chart series `#10b981`, accessible pill ink `--sem-cpf-ink: #047857`, wash `#ecfdf5`, border `#a7f3d0`): CPF OA/SA/MA/RA balances, CPF LIFE lifelong payouts (Tap 1), and funded readiness pills (`#047857` on `#ecfdf5` = **`5.21:1`** AA).
- **SG Dividend Sky** (`#60a5fa`): Singapore dividend equity sleeve paired alongside Actuarial Cobalt (`#2563eb`) for Global Equities (Tap 3).
- **SRS Bridge Violet** (`#7c3aed`, wash `#f5f3ff`, border `#ddd6fe`): Supplementary Retirement Scheme balances, annual contributions, and 10-year tax-smoothed drawdown bridge (Tap 2).
- **Sovereign Cash Amber** (`#d97706` / accessible pill ink `--sem-cash-ink: #b45309`, wash `#fffbeb`, border `#fde68a`): Emergency cash, Singapore Savings Bonds, T-Bills (Tap 4), and caution advisories (`#b45309` on `#fffbeb` = **`4.84:1`** AA).
- **OA Yield Teal** (`#0f766e`): Post-55 liquid CPF OA interest tap and CCA lifestyle avatar badge (`5.47:1` contrast with white text).
- **Shortfall Crimson** (`#dc2626` / accessible pill & banner ink `--sem-alert-ink: #b91c1c`, wash `#fef2f2`, border `#fecaca`): True retirement income deficits, validation errors, destructive reset confirmation (`button-danger`: `#ffffff` on `#dc2626` = **`4.83:1`**), and SRS tax-trap warnings (`#b91c1c` on `#fef2f2` = **`5.91:1`** AA).

### Neutral

- **Porcelain Canvas** (`#f4f6fa`): App viewport background, subtle recessed tracks, table header fills, and PWA `theme_color` / `background_color`.
- **Pure Surface** (`#ffffff`): Sidebar rail, resting bento cards, interactive KPI tiles, `<dialog>` modal shells, and A4 print cards.
- **Slate Hairline** (`#edf0f7`) & **Defined Slate Border** (`#d8dee9`): Default `1px` card/row dividers and interactive input/button borders; `#e5e7eb` renders quiet chart gridlines.
- **Deep Slate Ink** (`#1e293b`), **Secondary Slate** (`#475569`), & **Muted Slate** (`#64748b`): Three-step typographic hierarchy.

### Named Rules

**The Semantic Asset Invariant Rule.** Every wealth bucket owns one immutable color across all 7 workspace views, all 4 modals, and the A4 Print Summary (`CPF = Emerald`, `Equities = Cobalt/Sky`, `SRS = Violet`, `Cash/SSB = Amber`, `Post-55 OA Tap = Teal`, `Deficit/Trap = Crimson`). Never repurpose Shortfall Crimson (`#dc2626`) for safe Cash/SSB buffers or swap CPF and Equities colors between adjacent widgets.

**The Rose Restraint Rule.** Swell Rose (`#e83e8c` / `#ec4899`) marks brand identity, active navigation cues, and the print action—never validation errors or body paragraphs. Whenever rose text appears on `#fdf2f8`, use Deep Rose Ink (`#be185d`, `5.53:1`) so small label contrast stays comfortably above `4.5:1`.

**The Ink-on-Canvas & Soft-Tint Contrast Rule.** Muted Slate (`#64748b`) meets WCAG 2.2 AA (`4.76:1`) on `#ffffff` card surfaces but drops to `4.40:1` directly on `#f4f6fa` porcelain canvas. Any body or label copy placed directly on `#f4f6fa` must use Secondary Slate (`#475569`, `7.00:1`) or Deep Slate Ink (`#1e293b`). All small status pills, delta badges, and alert banners on soft tint washes (`#ecfdf5`, `#fffbeb`, `#fef2f2`) must use dedicated ink tokens (`--sem-cpf-ink: #047857`, `--sem-cash-ink: #b45309`, `--sem-alert-ink: #b91c1c`)—never raw mid-tone fills (`#059669`, `#d97706`, `#dc2626`) that fall below `4.5:1`.

## Typography

**Display & Body Font:** `"Inter Variable"` (self-hosted `assets/inter-latin.woff2`, `100–900` weight axis, fallback `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`)

**Character:** Clean geometric-humanist neo-grotesque engineered for high-density interfaces and financial tables—authoritative in `750–800` display metrics, effortless at `13px–15px` analytical reading sizes, and razor-sharp at `6.5pt–9pt` on A4 laser/PDF output.

### Hierarchy

- **Display** (`800`, `clamp(1.65rem, 2.6vw, 2.15rem)`, line-height `1.08`, tracking `-0.03em`): Hero retirement readiness figures, primary KPI headline numbers, and modal summary totals.
- **Headline** (`600–750`, `clamp(1.38rem, 2.2vw, 1.62rem)`, line-height `1.2`, tracking `-0.025em`): Canonical `.fin-page-header h1` / `.ember-header-main h1` / `.fin-header-copy h1` across all 7 workspace views (`Overview`, `Trajectory`, `Allocator`, `Dividend & Yield`, `Cash Parking`, `Tax Relief`, `CPF Milestones`) and `My Settings`.
- **Title** (`700`, `0.98rem–1.08rem`, line-height `1.3`, tracking `-0.015em`): Bento card headers, `<dialog>` modal titles, and 4-Tap card headings.
- **Body** (`450–500`, `0.9375rem` / `15px`, line-height `1.55`, max measure `68ch`): Explanatory guidance, assumption notes, and form field inputs.
- **Label** (`650–700`, `0.72rem–0.78rem`, line-height `1.25`, tracking `0.02em–0.05em`): Table column headers, status pills, sidebar badges, and chart axis labels (`>= 6.5pt` minimum after scaling in `@media print`).

### Named Rules

**The Tabular Currency Rule.** Every monetary amount, percentage, age, and countdown across HTML tables, KPI strips, SVG charts, and print sheets must render with `font-variant-numeric: tabular-nums` and wrap currency prefixes/suffixes (`$`, `/mo`, `/yr`) in `.curr-wrap` (`0.72em` optical scale, muted weight) so numerals command primary visual hierarchy.

**The Single H1 Scale Rule.** Every workspace tab opens with one `.fin-page-header` using the exact same `clamp(1.38rem, 2.2vw, 1.62rem)` `<h1>` scale (applied uniformly to `.ember-header-main h1`, `.fin-page-header h1`, and `.fin-header-copy h1`)—never allow secondary tabs to fall back to generic `2.35rem` document headings. (Only `.poster-title-block h1` inside `@media print` overrides to `12.2pt` for A4 density.)

## Layout & Spatial Grouping

- **Desktop Workspace Shell (`> 960px`):** Fixed-width collapsible left sidebar (`244px` expanded, `72px` icon rail when collapsed via `#sidebar-collapse-toggle`) paired with a fluid main workspace capped at `1360px` max-width (`24px–32px` horizontal padding) below a sticky `60px` top workspace bar.
- **Analytical Bento Rhythm:**
  - **Executive KPI Strip:** 5-column equal-height summary grid (`12px–14px` gap) collapsing cleanly to `2–3` columns at `<= 960px` and stacked/2-up cards on mobile (`<= 640px`). Above-the-fold priority places monthly target, readiness status, and projected Age-65 income first before secondary trajectory/breakdown modules.
  - **Primary Analytical Row:** Asymmetric `1.55fr / 1fr` or `1.35fr / 1fr` two-column bento split pairing wide time-series trajectories with focused breakdown donuts or readiness gauges (`16px–20px` grid gap).
- **Proximity & Destructive Isolation:**
  - Label-to-input gaps stay tight (`6px`) while distinct form sections and field rows separate at `16px–22px` (`1.05rem`) so related controls read as clear Gestalt groups.
  - Destructive controls (`button-danger` Reset Plan) are physically separated from primary save/navigation actions and gated behind `#confirm-reset-modal` so accidental clicks cannot wipe user assumptions.
- **Responsive Breakpoints:**
  - `960px`: Sidebar transitions off-canvas in favor of a fixed bottom 5-tab navigation bar (`Overview`, `Trajectory`, `Allocator` [with `Allocator` / `Dividend & Yield` sub-tabs], `Cash`, and `Tax & CPF` [with `Tax Relief` / `CPF Milestones` sub-tabs]) with safe-area padding (`padding-bottom: calc(76px + env(safe-area-inset-bottom))`).
  - `820px` & `720px`: Two-column analytical grids stack into single-column cards; top header compacts lifestyle selector and action buttons (preserving icon-accessible Print and Settings triggers).
  - `640px`: Form grids and modal rows stack vertically with `44px` minimum touch targets.
- **Single-Page A4 Print Grid (`@media print`):** `@page { size: A4 portrait; margin: 6.5mm 8mm; }` yielding a 1-page vertical executive blueprint organized into deterministic bands: (1) FinScope Light Masthead + Context Chips, (2) 5-Card KPI Strip + Starting Balances Strip, (3) Full-Width Net Worth Trajectory Area Chart with Milestone KPIs, (4) 2-Column Middle Grid (Top Funding Sources 4-Tap Architecture + Retirement Readiness Gauge), (5) 2-Column Strategic Bottom Grid (CPF Path Comparison Table + 5-Step Action Checklist paired alongside Living Budget Donut & Paycheck Waterfall), and (6) Statutory Methodology Colophon.

## Elevation & Depth

Retirement Shield uses a **quiet-resting, crisp-floating** hybrid depth model: resting workspace cards rely primarily on pure white contrast against the `#f4f6fa` porcelain canvas plus a whisper-soft two-layer ambient slate shadow, while interactive hover states, popovers, and top-layer `<dialog>` modals step up decisively in blur and vertical offset.

### Shadow Vocabulary

- **Resting Card (`--surface-shadow`):** `0 2px 6px rgba(15, 23, 42, 0.03), 0 10px 28px rgba(15, 23, 42, 0.05)` — Applied to `.card-surface`, `.fin-card`, `.sim-controls-card`, and `.affordability-card`.
- **Interactive Hover Lift (`--surface-shadow-hover`):** `0 6px 16px rgba(15, 23, 42, 0.06), 0 16px 36px rgba(15, 23, 42, 0.08)` — Paired with `translateY(-1px)` on clickable KPI cards and Cash Parking instrument tiles.
- **Floating Popover (`--popover-shadow`):** `0 12px 32px -4px rgba(15, 23, 42, 0.12), 0 4px 12px -2px rgba(15, 23, 42, 0.06)` — Used on `.field-help-panel` and chart tooltips.
- **Modal Dialog (`--dialog-shadow`):** `0 24px 64px -12px rgba(15, 23, 42, 0.2), 0 4px 16px -2px rgba(15, 23, 42, 0.08)` — Paired with `::backdrop { background: rgba(15, 23, 42, 0.42); backdrop-filter: blur(3px); }` across all 4 native `<dialog>` modals.
- **Print Flatness (`@media print`):** All shadows collapse to `none` in print; hierarchy is carried strictly by `1px solid var(--border)` (`#cbd5e1`) borders and `#f8fafc` subtle fills.

### Named Rules

**The Quiet Resting Card, Crisp Floating Layer Rule.** Resting cards never compete for depth, while floating overlays (`.plan-settings`, `.field-help-panel`, `#ui-toast`) must never have their `box-shadow` stripped—elevation is how users immediately distinguish transient layers from the underlying sheet.

## Shapes

- **Outer Bento & Modal Radius (`16px` / `--radius-lg`):** Primary analytical cards, hero containers, and `<dialog>` modal frames.
- **Secondary Card & Callout Radius (`12px` / `--radius-md`):** Executive KPI cards, 4-Tap income cards, Cash Parking tiles, and Print Summary modules.
- **Control & Input Radius (`8px` / `--radius-sm`):** Text/number inputs, `<select>` menus, standard action buttons, segmented sub-blocks, and brand badge squircle.
- **Pill Geometry (`999px`):** Status verdicts (`.status-pill`), header Print button, lifestyle switcher pill, filter chips, toggle tracks, and segmented control gliders.
- **Clean Hairline Framing:** Containers are bounded by uniform `1px solid` borders (`#edf0f7` at rest, `#d8dee9` on inputs/print). Thick `3px–4px` colored `border-left` or `border-top` stripes on rounded cards are banned; semantic status is signaled via compact dots, icon badges, or soft pill fills.

## Interaction Design, Accessibility & States

Grounded in Figma's **5 Dimensions of Interaction Design** (Words, Visuals, Physical Ergonomics, Time, Behavior) and **WCAG 2.2 AA**:

- **Non-Color Differentiation:** Never communicate status or series identity by color alone. Pair semantic hues with inline SVG icons (`checkTiny`, `alertTriangle`), explicit text verdicts (`100% Funded`, `Shortfall`), or patterned/labeled legend tags so color-vision-deficient users read every signal unambiguously.
- **Assistive Technology & Live Feedback:** Route dynamic recalculations, modal confirmations, and validation summaries through polite ARIA live regions (`.sr-status` on `#plan-status` and `#sim-status`), enforce `:focus-visible` (`2px solid var(--primary)` with `2px` offset) across all interactive controls (including SVG chart slices), preserve `outline: 2px solid transparent` on custom `:focus-within` input wrappers, and support `@media (forced-colors: active)` (`3px solid CanvasText` focus outlines).
- **Funding percentage:** Use `formatFundedPct()` to display the full rounded percentage in readiness labels. The gauge arc fills at 100%.
- **Physical Ergonomics (`44×44px` Tap Targets):** Standard `.button` controls maintain `min-height: 44px`, and on `@media (pointer: coarse)` icon buttons (`.dialog-dismiss`, `.field-help-trigger`, `.text-link`, `.text-button`) enforce at least `44px × 44px` hit areas.
- **4D Time & Motion Budget & View Transitions:** Micro-interactions (button hover/active, input focus rings, chip transitions) run at `150ms` (`--raw-duration-fast`) and overlay/toggle/sidebar transitions at `220ms` (`--raw-duration-panel`) using `--ease: cubic-bezier(0.2, 0.8, 0.2, 1)`. Cross-tab workspace navigation progressively leverages the View Transitions API (`document.startViewTransition()` with `160ms/180ms` root cross-fade and `3px` vertical glide) on modern browsers while falling back synchronously for non-supporting browsers and automated testing. All transitions and entrance animations collapse under `@media (prefers-reduced-motion: reduce)`.
- **Multi-Axis Interactive Chart Crosshairs:** Interactive SVG trajectory charts render dual-axis guidelines (`1.6px` vertical dashed hairline + `1px` horizontal level guide) paired with synchronized coordinate pinpoint dots (`4.5px` fill with `2px` white stroke) that track cursor scrubbing and lock onto data points with instantaneous tooltip synchronization.
- **Orientation, User Control & Empty States:**
  - _Orientation:_ Active sidebar/bottom-tab indicators + live tabular badges (`83%`, `Age 65`, `60/40`, `2.86%`) keep users oriented; modals carry explicit titles and restore focus to the triggering KPI/button on close.
  - _User Control & Recovery:_ Canceling or closing a modal reverts transient invalid edits rather than locking the workspace; validation errors provide plain-language recovery actions (`.plan-error-actions`); Reset requires two-step confirmation.
  - _Empty / Zero States:_ Zero balances, zero custom expenses, or unconfigured optional fields must render clear explanatory guidance and a single primary action (never blank cards or `NaN`/`$0` ambiguity).

## Components

### Buttons (Complete 9-State Matrix)

- **Variants & Hierarchy:**
  - **Primary (`.button-primary`):** Actuarial Cobalt (`#2563eb`) fill, white `600`-weight label, `min-height: 44px`, `10px 18px` padding, `10px` radius.
  - **Secondary (`.button` / `.button-secondary`):** Pure white (`#ffffff`) fill, `1px solid #edf0f7` border, Deep Slate (`#1e293b`) label, `min-height: 44px`, `10px 18px` padding.
  - **Rose Utility Pill (`.button-rose-soft`):** Soft Rose (`#fdf2f8`) fill, `1px solid #fbcfe8` border, Deep Rose Ink (`#be185d`) label and icon for the Print / Export A4 trigger (`999px` radius).
  - **Destructive (`.button-danger`):** Shortfall Crimson (`#dc2626`) fill with white text, reserved strictly for irreversible `#confirm-reset-modal` confirmation.
- **5 Core States:**
  - **Default:** Recognizable shape, border, label, and `>= 4.5:1` contrast without relying on hover reveal.
  - **Hover (`@media (hover: hover)` + `:not(:disabled)`):** Subtle color/border shift (`#1d4ed8` for primary, `#fce7f3`/`#f472b6` for rose) and `-1px` lift.
  - **Active / Pressed (`:not(:disabled):active`):** `scale(0.96)` (or `0.985` on interactive KPI/bento cards) for immediate tactile confirmation.
  - **Focused (`:focus-visible`):** `2px solid #2563eb` outline with `2px` offset (`3px solid CanvasText` in forced-colors mode). Never suppress focus outlines.
  - **Disabled (`:disabled`, `[aria-disabled="true"]`):** Porcelain fill (`#f4f6fa`), `#d8dee9` border, `#64748b` text, `opacity: 0.65`, `cursor: not-allowed`, no hover lift—always paired with nearby inline text or tooltip explaining _why_ the action is unavailable (e.g., retiring now disables accumulation inputs).
- **4 Functional States:**
  - **Loading (`.is-loading`, `[aria-busy="true"]`):** `opacity: 0.78`, `cursor: wait`, `pointer-events: none` to prevent duplicate triggers during print/rate sync.
  - **Success / Confirmed (`.is-confirmed`):** Soft Emerald (`#ecfdf5`) fill, `#a7f3d0` border, `#047857` (`5.21:1`) text + checkmark feedback.
  - **Error (`.is-error`):** Soft Crimson (`#fef2f2`) fill, `#fecaca` border, `#b91c1c` (`5.91:1`) text paired with inline recovery copy.
  - **Selected / Toggled (`[aria-pressed="true"]`, `.is-active`):** Primary border (`#2563eb`) + Soft Cobalt (`#eff6ff`) fill for pressed option chips and active filters.

### Cards & Interactive KPI Tiles

- **Corner Style:** `18px` on primary `.fin-card` / `.card-surface` modules; `14px` on `.fin-kpi-card` tiles.
- **Background & Border:** `#ffffff` fill with `1px solid #edf0f7` and `--surface-shadow`.
- **Interactive Behavior:** Clickable KPI cards (`data-qe-open`) expose an edit affordance on hover/focus, lift `-1px` with `#bfdbfe` border tint, and open `#quick-edit-modal` pre-focused to the relevant parameter panel.

### Native Modal Dialogs (`<dialog class="plan-settings">`)

- **Anatomy:** Shared shell across `#plan-settings` (Model Assumptions), `#quick-edit-modal` (Quick Edit), `#expense-modal` (Spending Breakdown), and `#confirm-reset-modal` (Reset Confirmation): `18px` radius, `#ffffff` surface, `--dialog-shadow`, unified slate blur `::backdrop`, sticky header with circular close button (`.dialog-dismiss`, `44px` on coarse pointers), scrollable body, and right-aligned footer action bar.
- **Focus & Escape Discipline:** Opened via `showModal()`, traps tab focus natively, closes cleanly on `Escape` or backdrop click while clamping/reverting transient invalid inputs, and restores keyboard focus to the triggering control.

### Inputs, Steppers & Toggle Switches

- **Style:** `10px` radius, `1px solid #d8dee9` stroke, `#ffffff` fill, `tabular-nums` text, optional `$` prefix or `%` / `yrs` suffix adornments, and `±$50` `.saving-stepper` buttons for tactile saving adjustments.
- **Focus & Error:** `:focus-visible` / `:focus-within` shifts border to `#2563eb` with `0 0 0 3px rgba(37, 99, 235, 0.16)` ring; `[aria-invalid="true"]` shifts to `#dc2626` with an inline `.settings-error` recovery message.
- **Toggle Switch (`.ui-toggle-switch`):** `role="switch"` capsule button containing `.ui-toggle-state` text plus a `36px × 20px` `.ui-toggle-track` (`#cbd5e1` off, `#2563eb` on) and `16px` white `.ui-toggle-thumb` sliding `16px` via `transform`. Its `<label>` targets the switch button directly (never a hidden `<select>` inside `aria-hidden="true"`).

### Segmented Controls & Filter Bars

- **Style:** Recessed `#f4f6fa` track (`10px` or `999px` radius, `3px` padding) housing elevated `#ffffff` active pills (`0 1px 3px rgba(15, 23, 42, 0.08)` shadow, `#1e293b` `650`-weight text). Used consistently across `Trajectory` scenario toggles, `Overview` CPF LIFE plan toggles, `Cash Parking` glider tabs, and `Tax`/`CPF` subtabs.

### Navigation & Header Shell

- **Desktop Sidebar:** `244px` white rail with Swell Rose `.fin-brand-badge` header, `role="tablist"` navigation buttons showing live tabular status badges (`83%`, `Age 65`, `60/40`, `2.86%`, `SRS`, `Sal`/`FRS`/`ERS`), and collapsible `72px` icon mode.
- **Mobile Tabbar (`<= 960px`):** Fixed bottom 5-item bar (grouping `Allocator` + `Dividend & Yield` and `Tax Relief` + `CPF Milestones`) with clear active Cobalt/Rose indicator and safe-area inset padding.

### Signature Component: 1-Page A4 Print Summary (`#print-sheet`)

- **Purpose:** Self-contained executive retirement blueprint designed specifically for `A4 landscape` (`6.5mm 8mm` margins) physical printing and PDF export.
- **Structure:** Opens with a light Porcelain-Slate & White FinScope masthead card (`.fin-brand-badge` SVG + plan title + assumption chips + readiness status pill), followed by the 5-card KPI strip, starting CPF/outside portfolio breakdown, full-series net worth area chart (`forcedSeries: "all"`), readiness gauge, Age-65 spending donut, 4-Tap retirement income table in real today-dollars, paycheck allocation bars, life milestones, strategy comparison table, 5-row action checklist, and statutory methodology colophon.

## Governance & Sync Protocol

- **Single Source of Truth:** Token additions or contrast changes must update `DESIGN.md`, `.impeccable/design.json`, and `styles.css` in the same commit, followed by `npm test && npm run build`.
- **Legacy Alias Retirement:** Deprecated CSS aliases (`--navy-950`, `--navy-900`, `--paper`, `--white`, `--teal-deep`, `--green`, `--yellow`, `--blue-soft`, `--line`) have been completely retired and removed from `:root` following a full codebase audit.

## Do's and Don'ts

### Do:

- **Do** keep semantic asset colors identical across every chart, 4-Tap card, paycheck bar, modal breakdown, and A4 print widget (`CPF = #059669/#10b981`, `Equities = #2563eb/#60a5fa`, `SRS = #7c3aed`, `Cash/SSB = #d97706`, `Post-55 OA = #0f766e`, `Alert = #dc2626`) while using accessible ink tokens (`#047857`, `#b45309`, `#b91c1c`) for small text on soft tint pills.
- **Do** format all dollar figures with `tabular-nums` and `.curr-wrap` unit de-emphasis across both interactive DOM views and `#print-sheet`.
- **Do** express retirement income taps in **today's real purchasing power** whenever rendered side-by-side, explicitly tagging any nominal statutory cap (such as the `$40,000/yr` tax-free SRS drawdown band) as nominal.
- **Do** separate locked `SRS` balances from liquid outside investments (`Global Equities`, `SG Dividends`, `Cash/SSB`) in asset summaries and breakdowns.
- **Do** self-host all fonts (`assets/inter-latin.woff2`) and inline SVG icons so the PWA and A4 Print Summary render identically with zero network connectivity.
- **Do** hide transient viewport chrome (`#ui-toast`, `.app-sidebar`, `.mobile-tabbar`, `<dialog>` backdrops, help popovers) in `@media print` and omit `tabindex` inside `aria-hidden="true"` print containers.
- **Do** pair disabled controls with explanatory context and keep every interactive state (`hover`, `active`, `focus-visible`, `disabled`, `loading`, `confirmed`, `error`, `pressed`) consistent across buttons.

### Don't:

- **Don't** reintroduce legacy palette eras—no dark-navy `#0a1829` / `#111827` banners or backdrops, no sage `#f6f8f5` / parchment `#faf3e5` cards, and no `#fdfbfa` cream backgrounds.
- **Don't** use thick (`> 1px`) colored `border-left` or `border-top` stripes on rounded cards or KPI strips; use subtle `1px` borders paired with semantic dots, icon badges, or soft tint pills.
- **Don't** strip `box-shadow` from `<dialog class="plan-settings">` modals or `.field-help-panel` popovers on screen.
- **Don't** leak interactive chart solo-filter state (`netWorthSelectedSeries`) into `#print-nw-chart`; the printed poster must always show the complete wealth stack.
- **Don't** allow closing a modal (`#quick-edit-modal`, `#expense-modal`, `#plan-settings`) to leave half-typed out-of-range inputs that lock the workspace behind an unrecoverable error banner.
- **Don't** place `#64748b` (`--ink-muted`) body or label copy directly on `#f4f6fa` canvas; use `#475569` (`--ink-soft`) or `#1e293b` (`--ink`).
