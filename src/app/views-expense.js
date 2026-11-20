import { m, money, html, raw, formatExpSharePct } from "./format.js";

function describePieSlicePath(cx, cy, outerR, innerR, startDeg, endDeg) {
  const full = endDeg - startDeg >= 359.9;
  if (full) {
    return `M ${cx} ${cy - outerR} A ${outerR} ${outerR} 0 1 1 ${cx - 0.01} ${cy - outerR} Z M ${cx} ${cy - innerR} A ${innerR} ${innerR} 0 1 0 ${cx - 0.01} ${cy - innerR} Z`;
  }
  const toRad = (d) => ((d - 90) * Math.PI) / 180;
  const x1 = cx + outerR * Math.cos(toRad(startDeg));
  const y1 = cy + outerR * Math.sin(toRad(startDeg));
  const x2 = cx + outerR * Math.cos(toRad(endDeg));
  const y2 = cy + outerR * Math.sin(toRad(endDeg));
  const x3 = cx + innerR * Math.cos(toRad(endDeg));
  const y3 = cy + innerR * Math.sin(toRad(endDeg));
  const x4 = cx + innerR * Math.cos(toRad(startDeg));
  const y4 = cy + innerR * Math.sin(toRad(startDeg));
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${outerR} ${outerR} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${x3.toFixed(2)} ${y3.toFixed(2)} A ${innerR} ${innerR} 0 ${large} 0 ${x4.toFixed(2)} ${y4.toFixed(2)} Z`;
}

function buildExpensePieSVG(ep, opts = {}) {
  const isPrint = Boolean(opts.isPrint);
  const cats = (ep?.categories || []).filter((c) => c.amount > 0);
  const total = Math.max(0, Number(ep?.total || 0));
  const cx = 92;
  const cy = 92;
  const outerR = 83;
  const innerR = 54;
  let cursor = 0;
  const activeCount = cats.length;
  const gapDeg = activeCount > 1 ? 2.2 : 0;

  const slices =
    total <= 0 || !cats.length
      ? `<circle cx="${cx}" cy="${cy}" r="${(outerR + innerR) / 2}" fill="none" stroke="var(--border)" stroke-width="${outerR - innerR}" />`
      : cats
          .map((cat) => {
            const sweep = (cat.amount / total) * 360;
            const start = cursor + gapDeg / 2;
            const end = Math.max(start + 0.5, cursor + sweep - gapDeg / 2);
            cursor += sweep;
            const d = describePieSlicePath(cx, cy, outerR, innerR, start, end);
            return `<path class="exp-pie-slice" data-exp-cat="${cat.key}" d="${d}" fill="${cat.color}" fill-rule="evenodd"${isPrint ? "" : ' tabindex="0" role="img"'} aria-label="${cat.label}: ${money(cat.amount)} per month (${cat.pct.toFixed(0)}%)"><title>${cat.label}: ${money(cat.amount)}/mo (${cat.pct.toFixed(1)}%)</title></path>`;
          })
          .join("");

  return `<div class="exp-pie-stage${isPrint ? " is-print-pie" : ""}">
    <svg class="exp-pie-svg" viewBox="0 0 184 184" width="${isPrint ? 104 : 184}" height="${isPrint ? 104 : 184}" role="${isPrint ? "img" : "group"}" aria-label="Monthly living expense breakdown pie chart totaling ${money(total)} per month">
      ${slices}
    </svg>
    <div class="exp-pie-center" aria-hidden="true">
      <small>Retire Need</small>
      <strong>${isPrint ? m(total) : m(total, "", "exp-pie-total")}</strong>
      <span>per month</span>
    </div>
    ${isPrint ? "" : `<div class="exp-pie-hover-pill" id="exp-pie-hover-pill" hidden></div>`}
  </div>`;
}

function renderReadOnlyExpenseTable(
  items,
  catLabelMap,
  ariaLabel,
  catColorMap = {},
) {
  return html`
    <div
      class="exp-items-table is-readonly"
      role="table"
      aria-label="${ariaLabel}"
    >
      <div class="exp-items-head" role="row">
        <span role="columnheader">Category</span>
        <span role="columnheader">Expense item</span>
        <span role="columnheader">Monthly ($)</span>
        <span role="columnheader">Share</span>
      </div>
      <div class="exp-items-body" role="rowgroup">
        ${items.map((it) =>
          raw(
            html`<div class="exp-ro-row" role="row">
              <span class="exp-ro-cat" role="cell"
                ><i
                  class="exp-cat-dot"
                  style="background:${catColorMap[it.category] || "#64748b"}"
                  aria-hidden="true"
                ></i
                >${catLabelMap[it.category] || it.category}</span
              >
              <span class="exp-ro-name" role="cell">${it.name}</span>
              <strong class="exp-ro-amt" role="cell"
                >${raw(m(it.amount, "/mo"))}</strong
              >
              <span class="exp-ro-pct" role="cell"
                >${formatExpSharePct(it.pct)}</span
              >
            </div>`,
          ),
        )}
      </div>
    </div>
  `;
}

function buildExpenseModalBodyHTML(ep, r, newlyAddedId = null, s = null) {
  const isCustom = Boolean(ep.isCustom);
  const catList = RetirementModel.EXPENSE_CATEGORIES || [];
  const catLabelMap = Object.fromEntries(catList.map((c) => [c.key, c.label]));
  const catColorMap = Object.fromEntries(catList.map((c) => [c.key, c.color]));
  const catOptions = (selectedKey) =>
    catList
      .map(
        (cat) =>
          `<option value="${cat.key}"${cat.key === selectedKey ? " selected" : ""}>${cat.label}</option>`,
      )
      .join("");
  const planVal = r?.plan === "escalating" ? "escalating" : "standard";
  const retireAge = Number(r?.retire || 65);
  const targetSpend65 = Number(r?.spend65 ?? ep.total);
  const targetSpendRetire =
    retireAge < 65 ? Number(r?.futureSpend ?? ep.total) : targetSpend65;
  const cpfPayout65 = Number(s?.payout ?? r?.income ?? 0);
  const cpfCov65 =
    targetSpend65 > 0
      ? Math.min(100, Math.round((cpfPayout65 / targetSpend65) * 100))
      : 100;
  const outsideNeed = s?.privateSaving ?? r?.saving ?? null;

  const sourceBar = `<div class="exp-modal-source-bar" role="group" aria-label="Living budget preset or Custom">
    <button type="button" class="exp-modal-source-btn${!isCustom && ep.lifestyle === "cca" ? " is-active" : ""}" data-exp-load="cca" aria-pressed="${!isCustom && ep.lifestyle === "cca"}">
      <strong>Community Care</strong>
      <span>${m(2800, "/mo")} · Fixed preset</span>
    </button>
    <button type="button" class="exp-modal-source-btn${!isCustom && ep.lifestyle === "home-helper" ? " is-active" : ""}" data-exp-load="home-helper" aria-pressed="${!isCustom && ep.lifestyle === "home-helper"}">
      <strong>Home + Helper</strong>
      <span>${m(3900, "/mo")} · Fixed preset</span>
    </button>
    <button type="button" class="exp-modal-source-btn${isCustom ? " is-active" : ""}" data-exp-enter-custom aria-pressed="${isCustom}">
      <strong>Custom</strong>
      <span>${isCustom ? `${m(ep.total, "/mo")} · ${ep.itemizedActive ? `${ep.items.length} item${ep.items.length === 1 ? "" : "s"}` : "Single figure"}` : "Single figure or items"}</span>
    </button>
  </div>`;

  const impactStrip = `<div class="exp-impact-strip" id="exp-impact-slot" role="group" aria-label="Live retirement budget impact and CPF LIFE plan">
    <div class="exp-impact-metrics">
      <div class="exp-impact-kpi">
        <span>${retireAge < 65 ? `Age-${retireAge} Retire Need` : "Age-65 Retire Need"}</span>
        <strong>${m(targetSpendRetire, "/mo")}</strong>
        <small>Today’s $ · HealthShield curve</small>
      </div>
      <div class="exp-impact-kpi">
        <span>CPF LIFE Coverage (65)</span>
        <strong class="is-emerald">${cpfCov65}%</strong>
        <small>${m(cpfPayout65, "/mo")} projected</small>
      </div>
      <div class="exp-impact-kpi">
        <span>Outside Saving Target</span>
        <strong>${outsideNeed == null ? "—" : r?.retiringNow ? m(outsideNeed) : m(outsideNeed, "/mo")}</strong>
        <small>${r?.retiringNow ? "Capital needed now" : "Suggested monthly"}</small>
      </div>
    </div>
    <div class="exp-plan-inline-box">
      <span class="exp-plan-inline-label">CPF LIFE Payout Plan</span>
      <div class="cpf-plan-inline-toggle" role="group" aria-label="CPF LIFE payout plan">
        <button type="button" class="cpf-plan-chip${planVal === "standard" ? " is-active" : ""}" data-exp-set-plan="standard" aria-pressed="${planVal === "standard"}">Standard</button>
        <button type="button" class="cpf-plan-chip${planVal === "escalating" ? " is-active" : ""}" data-exp-set-plan="escalating" aria-pressed="${planVal === "escalating"}">Escalating +2%/yr</button>
      </div>
    </div>
  </div>`;

  const catSummaryBar = (ep.categories || [])
    .filter((cat) => cat.amount > 0)
    .map(
      (cat) =>
        html`<span class="exp-cat-summary-pill"
          ><i
            class="exp-cat-dot"
            style="background:${cat.color}"
            aria-hidden="true"
          ></i
          >${cat.label.split(",")[0].split("&")[0].trim()} ·
          ${raw(m(cat.amount))} (${formatExpSharePct(cat.pct)})</span
        >`,
    )
    .join("");

  const quickTotals = [2200, 2800, 3500, 4500];
  const roundedTotal = Math.round(Number(ep.total || 0));

  const mainSection = !isCustom
    ? `<div class="exp-modal-section">
        <div class="exp-readonly-banner">
          <span><strong>${ep.lifestyleLabel}</strong> is a fixed preset (${m(ep.total, "/mo")}) for today’s budget; projections step up HealthShield premiums with age. Switch to Custom to edit items.</span>
          <button type="button" class="button button-small button-accent" data-exp-enter-custom>Switch to Custom →</button>
        </div>
        ${catSummaryBar ? `<div class="exp-cat-summary-pills" role="group" aria-label="Category summary">${catSummaryBar}</div>` : ""}
        ${renderReadOnlyExpenseTable(ep.items, catLabelMap, `${ep.lifestyleLabel} preset monthly expense breakdown`, catColorMap)}
      </div>`
    : `<div class="exp-modal-section">
        <div class="exp-editor-toolbar">
          <div class="fin-segmented-tabs exp-mode-tabs" data-seg-idx="${ep.itemizedActive ? 1 : 0}" style="--seg-idx:${ep.itemizedActive ? 1 : 0};--seg-count:2" role="group" aria-label="Custom budget entry mode">
            <button type="button" class="fin-seg-tab${!ep.itemizedActive ? " is-active" : ""}" data-exp-custom-mode="figure" aria-pressed="${!ep.itemizedActive}">Single figure</button>
            <button type="button" class="fin-seg-tab${ep.itemizedActive ? " is-active" : ""}" data-exp-custom-mode="itemized" aria-pressed="${ep.itemizedActive}">Break down &amp; add items</button>
          </div>
        </div>
        ${
          !ep.itemizedActive
            ? `<div class="exp-figure-panel">
                <div class="exp-figure-hero">
                  <div class="exp-figure-field">
                    <label for="exp-total-input">Custom monthly retirement budget (today’s $)</label>
                    <div class="input-wrap">
                      <span>$</span>
                      <input type="number" id="exp-total-input" min="0" max="1000000" step="any" inputmode="decimal" value="${ep.total}" />
                    </div>
                    <small>Scales all ${ep.items.length} retirement items proportionally in today’s dollars.</small>
                  </div>
                  <div class="exp-figure-controls" role="group" aria-label="Quick budget adjustments">
                    <div class="exp-step-row">
                      <button type="button" class="exp-step-btn" data-exp-step-delta="-200">−$200</button>
                      <button type="button" class="exp-step-btn" data-exp-step-delta="-100">−$100</button>
                      <button type="button" class="exp-step-btn" data-exp-step-delta="100">+$100</button>
                      <button type="button" class="exp-step-btn" data-exp-step-delta="200">+$200</button>
                    </div>
                    <div class="exp-quick-chips" role="group" aria-label="Quick monthly budget anchors">
                      <span class="exp-quick-label">Anchors:</span>
                      ${quickTotals
                        .map(
                          (amt) =>
                            `<button type="button" class="exp-quick-chip${roundedTotal === amt ? " is-active" : ""}" data-exp-quick-total="${amt}" aria-pressed="${roundedTotal === amt}">${m(amt)}</button>`,
                        )
                        .join("")}
                    </div>
                  </div>
                </div>
                <div id="exp-figure-table-slot" class="exp-modal-section">
                  <div class="exp-breakdown-subhead">
                    <div class="exp-cat-summary-pills" role="group" aria-label="Category summary">${catSummaryBar}</div>
                    <button type="button" class="text-button" data-exp-custom-mode="itemized">Customize individual items →</button>
                  </div>
                  ${renderReadOnlyExpenseTable(ep.items, catLabelMap, "Proportionally scaled custom monthly expense breakdown", catColorMap)}
                </div>
              </div>`
            : `<div class="exp-itemized-bar">
                <span class="exp-itemized-sum">Total: <strong id="exp-editor-sum">${m(ep.total, "/mo")}</strong> <small>(updates Retire Budget)</small></span>
                <button type="button" class="button button-small button-accent" data-exp-add>+ Add item</button>
              </div>
              <div class="exp-items-table" role="table" aria-label="Editable monthly expense items">
                <div class="exp-items-head" role="row">
                  <span role="columnheader">Category</span>
                  <span role="columnheader">Expense item</span>
                  <span role="columnheader">Monthly ($)</span>
                  <span role="columnheader">Share</span>
                  <span role="columnheader" aria-label="Remove item"></span>
                </div>
                <div class="exp-items-body" id="exp-items-body" role="rowgroup">
                  ${
                    ep.items.length === 0
                      ? `<div class="exp-empty-state" role="row"><div role="cell">No monthly expense items yet. Add an item to build your itemized retirement budget.</div><button type="button" class="button button-small button-accent" data-exp-add>+ Add first item</button></div>`
                      : ep.items
                          .map(
                            (it, idx) =>
                              html`<div
                                class="exp-item-row${
                                  newlyAddedId && it.id === newlyAddedId
                                    ? " is-new-row"
                                    : ""
                                }"
                                data-exp-row="${idx}"
                                role="row"
                              >
                                <div
                                  class="input-wrap select-wrap exp-cat-select-wrap"
                                  role="cell"
                                >
                                  <select
                                    name="exp-cat-${idx}"
                                    data-exp-field="category"
                                    data-exp-idx="${idx}"
                                    aria-label="Category for item ${idx + 1}"
                                  >
                                    ${raw(catOptions(it.category))}
                                  </select>
                                </div>
                                <div class="input-wrap" role="cell">
                                  <input
                                    type="text"
                                    name="exp-name-${idx}"
                                    data-exp-field="name"
                                    data-exp-idx="${idx}"
                                    value="${it.name}"
                                    placeholder="e.g. Groceries, WiFi"
                                    maxlength="60"
                                    aria-label="Expense item name ${idx + 1}"
                                  />
                                </div>
                                <div class="input-wrap" role="cell">
                                  <span>$</span>
                                  <input
                                    type="number"
                                    name="exp-amt-${idx}"
                                    min="0"
                                    max="1000000"
                                    step="any"
                                    inputmode="decimal"
                                    data-exp-field="amount"
                                    data-exp-idx="${idx}"
                                    value="${it.amount}"
                                    aria-label="Monthly amount for ${it.name}"
                                  />
                                </div>
                                <span
                                  class="exp-item-pct"
                                  data-exp-pct="${idx}"
                                  role="cell"
                                  >${formatExpSharePct(it.pct)}</span
                                >
                                <span role="cell"
                                  ><button
                                    type="button"
                                    class="exp-remove-btn"
                                    data-exp-remove="${idx}"
                                    aria-label="Remove ${it.name}"
                                    title="Remove item"
                                  >
                                    ×
                                  </button></span
                                >
                              </div>`,
                          )
                          .join("")
                  }
                </div>
              </div>`
        }
      </div>`;

  return `${sourceBar}${impactStrip}${mainSection}`;
}

function buildExpenseCardHTML(ep, r) {
  const isCustom = Boolean(ep.isCustom);
  const modeLabel = !isCustom
    ? `${ep.lifestyleLabel} preset · Fixed`
    : ep.itemizedActive
      ? `Custom · ${ep.items.length} item${ep.items.length === 1 ? "" : "s"}`
      : "Custom · Single figure";
  const dropdownLabel = isCustom
    ? `Custom (${money(ep.total)}/mo)`
    : ep.lifestyle === "cca"
      ? `Community Care (${money(ep.total)}/mo)`
      : `Home + Helper (${money(ep.total)}/mo)`;
  const customSubLabel = isCustom
    ? `${money(ep.total)}/mo · Click to edit budget or items`
    : "Set custom monthly budget or items…";
  const ageNeedLabel =
    r.retire < 65
      ? `Age ${r.retire} est: ${money(r.futureSpend)}/mo`
      : `Age 65 est: ${money(r.spend65)}/mo`;
  const captionText = `Models what you need per month in retirement (<strong>${m(ep.total, "/mo", "kpi-budget")}</strong> today’s $). Separate from today’s take-home pay.`;
  const topPreview = ep.items
    .filter((it) => it.amount > 0)
    .slice()
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 4);

  return `<section class="fin-card fin-expense-card card-surface" id="expense-breakdown-card" aria-labelledby="expense-card-title">
    <div class="fin-expense-head">
      <div class="fin-expense-title-col">
        <div class="fin-expense-title-row">
          <h2 id="expense-card-title">Retirement Living Budget</h2>
          <span class="fin-inline-meta" id="exp-mode-pill">${modeLabel}</span>
          <span class="fin-inline-meta is-sep" aria-hidden="true">·</span>
          <span class="fin-inline-meta" id="exp-takehome-pill">${ageNeedLabel}</span>
        </div>
        <p id="exp-sync-caption">${captionText}</p>
      </div>
      <div class="fin-expense-actions">
        <div class="exp-card-dropdown-wrap" id="exp-card-dropdown-wrap">
          <button
            type="button"
            class="header-account-pill exp-card-dropdown-pill"
            id="exp-card-dropdown-btn"
            aria-haspopup="menu"
            aria-expanded="false"
            aria-controls="exp-card-dropdown-menu"
          >
            <span class="header-account-avatar" data-tone="${isCustom ? "custom" : ep.lifestyle}" aria-hidden="true">${isCustom ? "$" : ep.lifestyle === "cca" ? "C" : "H"}</span>
            <span id="exp-card-dropdown-label">${dropdownLabel}</span>
            <svg class="header-account-caret" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          <div class="header-account-menu exp-card-dropdown-menu" id="exp-card-dropdown-menu" role="menu" hidden>
            <button
              type="button"
              role="menuitemradio"
              class="header-menu-item${!isCustom && ep.lifestyle === "cca" ? " is-active" : ""}"
              data-switch-lifestyle="cca"
              aria-checked="${!isCustom && ep.lifestyle === "cca"}"
            >
              <div>
                <strong>Community Care Apartments</strong>
                <small>$2,800/mo baseline · assisted living from 55</small>
              </div>
            </button>
            <button
              type="button"
              role="menuitemradio"
              class="header-menu-item${!isCustom && ep.lifestyle === "home-helper" ? " is-active" : ""}"
              data-switch-lifestyle="home-helper"
              aria-checked="${!isCustom && ep.lifestyle === "home-helper"}"
            >
              <div>
                <strong>Home + Helper</strong>
                <small>$3,900/mo baseline · ageing in place</small>
              </div>
            </button>
            <button
              type="button"
              role="menuitemradio"
              class="header-menu-item${isCustom ? " is-active" : ""}"
              data-select-custom
              aria-checked="${isCustom}"
            >
              <div>
                <strong>Custom</strong>
                <small id="exp-card-custom-sub">${customSubLabel}</small>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="fin-expense-body" id="exp-card-body">
      <div class="fin-expense-chart-col" id="exp-pie-slot">
        ${buildExpensePieSVG(ep)}
      </div>
      <div class="fin-expense-summary-col">
        <div class="fin-expense-cats" id="exp-cats-slot">
          ${ep.categories
            .map((cat) => {
              const barW =
                ep.total > 0 && cat.amount > 0
                  ? Math.max(4, Math.round(cat.pct))
                  : 0;
              return `<div class="exp-cat-row" data-exp-cat="${cat.key}">
                <div class="exp-cat-meta">
                  <span class="exp-cat-name"><i style="background:${cat.color};"></i>${cat.label} <small>(${cat.items.length})</small></span>
                  <strong class="exp-cat-val">${m(cat.amount, "/mo")} <span>${Math.round(cat.pct)}%</span></strong>
                </div>
                <div class="exp-cat-track" aria-hidden="true">
                  <span style="width:${barW}%;background:${cat.color};"></span>
                </div>
              </div>`;
            })
            .join("")}
        </div>
        <div class="exp-preview-strip" id="exp-preview-slot">
          <span class="exp-preview-label">Top items:</span>
          ${
            topPreview.length
              ? topPreview
                  .map(
                    (it) =>
                      html`<span class="exp-item-chip"
                        >${it.name} · <b>${raw(m(it.amount))}</b></span
                      >`,
                  )
                  .join("")
              : '<span class="exp-item-chip">No expense items ($0/mo)</span>'
          }
        </div>
      </div>
    </div>
  </section>`;
}

export { buildExpensePieSVG, buildExpenseModalBodyHTML, buildExpenseCardHTML };
