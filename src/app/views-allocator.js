import { m } from "./format.js";

export function buildAllocatorView(bogle, includeCpf = true) {
  const { liquid, holistic, monthlyRebalance } = bogle;
  const { targetEquityPct, targetBondPct, sgSleevePct } = holistic;
  const buys = monthlyRebalance;
  const total = includeCpf ? holistic.totalNetWorth : liquid.total;
  const currentEquity = includeCpf
    ? holistic.effectiveEquityPct
    : liquid.equityPct;
  const currentFixed = includeCpf ? holistic.effectiveBondPct : liquid.bondPct;
  const curEqRounded = Math.round(currentEquity);
  const tgtEqRounded = Math.round(targetEquityPct);
  const equityDeltaPct = curEqRounded - tgtEqRounded;
  const gapPoints = Math.abs(equityDeltaPct);
  const gapLabel = gapPoints
    ? `${gapPoints} ${gapPoints === 1 ? "pt" : "pts"} ${equityDeltaPct < 0 ? "short" : "over"}`
    : "On target";
  const holdings = [
    ["Global equities", "equities", liquid.globalEquities],
    ["SG dividends", "equities-sg", liquid.sgDividends],
    ["SSB/Cash", "cash", liquid.bondsCash],
    ...(includeCpf && holistic.cpfTotal > 0
      ? [["CPF", "cpf", holistic.cpfTotal]]
      : []),
  ];
  const target = [
    [
      "Global equities",
      "equities",
      (targetEquityPct * (100 - sgSleevePct)) / 100,
    ],
    ["SG dividends", "equities-sg", (targetEquityPct * sgSleevePct) / 100],
    ["Fixed income", "cash", targetBondPct],
  ];
  const formatPct = (pct) => Number(pct.toFixed(2));
  const targetSegments = target
    .map(
      ([, color, pct]) =>
        `<span style="--allocator-share:${pct}%;--allocator-color:var(--sem-${color})"></span>`,
    )
    .join("");
  const buildNudge = (field, label, delta) =>
    `<button type="button" data-allocator-nudge="${field}" data-delta="${delta}" aria-label="${delta < 0 ? "Decrease" : "Increase"} ${label} by 1 percentage point">${delta < 0 ? "−" : "+"}</button>`;

  return `<header class="fin-page-header allocator-header">
    <div class="fin-header-copy">
      <h1>Portfolio Allocator</h1>
      <p class="allocator-status" id="allocator-status">Equity ${curEqRounded}% vs ${tgtEqRounded}% target <span class="status-pill ${gapPoints ? "is-warn" : "is-good"}">${gapLabel}</span></p>
    </div>
  </header>
  <section class="allocator-sheet card-surface" id="boglehead-allocator" aria-labelledby="bogle-title">
    <section class="allocator-current">
      <div class="allocator-heading">
        <h2 id="bogle-title">Current mix</h2>
        <button type="button" class="text-button" data-open-settings-field="known-equities">Edit plan inputs</button>
      </div>
      <div class="allocator-basis" role="group" aria-label="Current mix basis">
        <button type="button" class="qe-picker-chip" data-allocator-basis="cpf" aria-pressed="${includeCpf}">Including CPF</button>
        <button type="button" class="qe-picker-chip" data-allocator-basis="liquid" aria-pressed="${!includeCpf}">Liquid only</button>
      </div>
      <div class="allocator-comparison" aria-describedby="allocator-status">
        <div class="allocator-bar-label"><strong>Current</strong><span>${m(total, "", includeCpf ? "bogle-hol-tot" : "bogle-liq-tot")}</span></div>
        <div class="allocator-track" aria-hidden="true">
          ${holdings
            .map(
              ([, color, amount]) =>
                `<span style="--allocator-share:${total ? (amount / total) * 100 : 0}%;--allocator-color:var(--sem-${color})"></span>`,
            )
            .join("")}
        </div>
        <div class="allocator-gap" aria-hidden="true">
          ${gapPoints && total ? `<span style="--gap-start:${Math.min(currentEquity, targetEquityPct)}%;--gap-width:${Math.abs(currentEquity - targetEquityPct)}%"></span>` : ""}
        </div>
        <div class="allocator-bar-label"><strong>Target</strong><span>${targetEquityPct}% equity / ${targetBondPct}% fixed income</span></div>
        <div class="allocator-track" aria-hidden="true">${targetSegments}</div>
        <p class="allocator-mix-summary">${curEqRounded}% equity / ${Math.round(currentFixed)}% fixed income${total ? "" : " · No current balance"}</p>
        <dl class="allocator-holdings">
          ${holdings
            .map(
              ([label, color, amount]) => `
            <div><dt><i class="sem-dot" style="background:var(--sem-${color})" aria-hidden="true"></i>${label}</dt>
            <dd>${includeCpf ? `<span>${total ? Math.round((amount / total) * 100) : 0}%</span>` : ""}${m(amount)}</dd></div>`,
            )
            .join("")}
        </dl>
      </div>
    </section>

    <section class="allocator-editor" aria-labelledby="allocator-target-title">
      <div class="allocator-heading">
        <h2 id="allocator-target-title">Target allocation</h2>
        <button type="button" class="field-help-trigger allocator-info" aria-label="About the allocation split" popovertarget="allocator-help">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 10.5v6M12 7v1"/></svg>
        </button>
        <div class="field-help-panel allocator-help" id="allocator-help" popover="auto">
          <p>Including CPF counts CPF OA, SA and MA alongside SSB/Cash as the defensive floor.</p>
          <p>The equity target sets how much goes to equities. The SG share divides that equity amount between Global equities and SG dividends. The rest goes to fixed income.</p>
        </div>
      </div>
      <p class="allocator-support">Your target sets how monthly investments are split after SRS.</p>
      <div class="allocator-slider" id="allocator-slider">
        <div class="allocator-track allocator-target-track" aria-hidden="true">${targetSegments}</div>
        <div class="allocator-handle allocator-handle-sg" data-allocator-handle="sg" role="slider" tabindex="0" aria-label="SG dividends share of equity" aria-valuemin="0" aria-valuemax="100"></div>
        <div class="allocator-handle allocator-handle-equity" data-allocator-handle="equity" role="slider" tabindex="0" aria-label="Equity share of portfolio" aria-valuemin="0" aria-valuemax="100"></div>
      </div>
      <ul class="allocator-target-readout">
        ${target.map(([label, color, pct]) => `<li><strong>${formatPct(pct)}%</strong><span><i class="sem-dot" style="background:var(--sem-${color})" aria-hidden="true"></i>${label}</span></li>`).join("")}
      </ul>
      <div class="allocator-nudges">
        <div role="group" aria-label="Adjust equity share">${buildNudge("equity", "equity share", -1)}<span>Equity share</span>${buildNudge("equity", "equity share", 1)}</div>
        <div role="group" aria-label="Adjust SG share of equity">${buildNudge("sg", "SG share of equity", -1)}<span>SG share of equity</span>${buildNudge("sg", "SG share of equity", 1)}</div>
      </div>
      <div class="allocator-presets" role="group" aria-label="Equity and fixed income presets">
        ${[60, 70, 80, 90].map((preset) => `<button type="button" class="qe-picker-chip" data-allocator-preset="${preset}" aria-pressed="${targetEquityPct === preset}">${preset}/${100 - preset}</button>`).join("")}
      </div>
      <div class="allocator-exact">
        <button type="button" class="text-button allocator-exact-toggle" aria-expanded="false" aria-controls="allocator-exact-fields">Exact %</button>
        <div class="allocator-exact-fields" id="allocator-exact-fields" hidden>
          <label>Equity (% of portfolio)<input id="bogle-target-slider" data-allocator-exact="equity" type="number" min="0" max="100" step="1" inputmode="numeric" value="${targetEquityPct}"></label>
          <label>SG (% of equity)<input id="bogle-sg-slider" data-allocator-exact="sg" type="number" min="0" max="100" step="1" inputmode="numeric" value="${sgSleevePct}"></label>
        </div>
      </div>
    </section>

    <section class="allocator-paycheck" aria-labelledby="allocator-paycheck-title">
      <h2 id="allocator-paycheck-title">Monthly Paycheck Action</h2>
      <dl class="allocator-paycheck-values">
        ${[
          ["Global equities", "equities", buys.buyGlobalMonthly, "eq"],
          ["SG dividends", "equities-sg", buys.buySgMonthly, "sg"],
          ["SSB/Cash", "cash", buys.buyBondMonthly, "bond"],
        ]
          .map(
            ([label, color, amount, key]) =>
              `<div><dt><i class="sem-dot" style="background:var(--sem-${color})" aria-hidden="true"></i>${label}</dt><dd>${m(amount, "/mo", `bogle-reb-${key}`)}</dd></div>`,
          )
          .join("")}
        ${
          buys.srsMonthly > 0
            ? `<div class="allocator-paycheck-detail"><dt>Liquid subtotal after SRS</dt><dd>${m(buys.liquidInvestPool, "/mo")}</dd></div>
        <div class="allocator-paycheck-detail"><dt>Allocated to SRS</dt><dd>${m(buys.srsMonthly, "/mo")}</dd></div>`
            : ""
        }
        <div class="allocator-total"><dt>Available to invest this month</dt><dd>${m(buys.investPool, "/mo", "bogle-reb-pool")}</dd></div>
      </dl>
      <a class="text-button allocator-cash-link" href="#tab-panel-cash-parking" data-go-tab="cash-parking">Compare SSB, HYSA &amp; MMFs</a>
    </section>
  </section>`;
}
