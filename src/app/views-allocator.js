import { m } from "./format.js";

export function buildAllocatorView(bogle) {
  const { liquid, holistic, monthlyRebalance } = bogle;
  const { targetEquityPct, targetBondPct, sgSleevePct } = holistic;
  const buys = monthlyRebalance;
  const { total, equityPct: currentEquity, bondPct: currentFixed } = liquid;
  const curEqRounded = Math.round(currentEquity);
  const tgtEqRounded = Math.round(targetEquityPct);
  const equityDeltaPct = curEqRounded - tgtEqRounded;
  const gapPoints = Math.abs(equityDeltaPct);
  const gapMessage = !total
    ? "Add your balances to compare your holdings with your target."
    : gapPoints
      ? `Your equity share is ${gapPoints} percentage ${gapPoints === 1 ? "point" : "points"} ${equityDeltaPct < 0 ? "below" : "above"} your target. Use the monthly split below to direct new contributions.`
      : "Your current equity share matches your target for this view.";
  const holdings = [
    ["Global equities", liquid.globalEquities],
    ["SG dividends", liquid.sgDividends],
    ["SSB/Cash", liquid.bondsCash],
  ];
  const target = [
    ["Global equities", (targetEquityPct * (100 - sgSleevePct)) / 100],
    ["SG dividends", (targetEquityPct * sgSleevePct) / 100],
    ["Fixed income", targetBondPct],
  ];
  const formatPct = (pct) => Number(pct.toFixed(2));
  const buildNudge = (field, label, delta) =>
    `<button type="button" data-allocator-nudge="${field}" data-delta="${delta}" aria-label="${delta < 0 ? "Decrease" : "Increase"} ${label} by 1 percentage point">${delta < 0 ? "−" : "+"}</button>`;

  const buildField = (field, id, label, hint, value) => `
      <div class="allocator-field">
        <div>
          <label for="${id}">${label}</label>
          <p id="${id}-help">${hint}</p>
        </div>
        <div class="allocator-stepper">
          ${buildNudge(field, label.toLowerCase(), -1)}
          <div class="allocator-percentage">
            <input id="${id}" data-allocator-exact="${field}" type="number" min="0" max="100" step="1" inputmode="numeric" value="${value}" aria-describedby="${id}-help">
            <span aria-hidden="true">%</span>
          </div>
          ${buildNudge(field, label.toLowerCase(), 1)}
        </div>
      </div>`;

  return `<header class="fin-page-header allocator-header">
    <div class="fin-header-copy">
      <h1>Portfolio allocation</h1>
      <p>Compare your holdings with your target and plan your next contribution.</p>
    </div>
  </header>
  <div class="allocator-sheet card-surface" id="boglehead-allocator">
    <section class="allocator-current" aria-labelledby="bogle-title">
      <div class="allocator-heading">
        <h2 id="bogle-title">Current mix</h2>
        <button type="button" class="text-button" data-open-settings-field="known-equities">Edit plan inputs</button>
      </div>
      <div class="allocator-comparison">
        <p class="allocator-gap-note">${gapMessage}</p>
        <table class="data-table allocator-mix-table">
          <caption class="sr-only">Current holdings outside CPF compared with the target split</caption>
          <thead><tr><th scope="col">Allocation</th><th scope="col">Current</th><th scope="col">Target</th></tr></thead>
          <tbody>
            <tr><th scope="row">Equities</th><td>${curEqRounded}%</td><td>${tgtEqRounded}%</td></tr>
            <tr><th scope="row">Fixed income</th><td>${Math.round(currentFixed)}%</td><td>${targetBondPct}%</td></tr>
          </tbody>
        </table>
        <dl class="allocator-holdings">
          ${holdings
            .map(
              ([label, amount]) => `
            <div><dt>${label}</dt>
            <dd>${m(amount)}</dd></div>`,
            )
            .join("")}
          <div class="allocator-total"><dt>Total holdings</dt><dd>${m(total)}</dd></div>
        </dl>
      </div>
    </section>

    <section class="allocator-editor" aria-labelledby="allocator-target-title">
      <div class="allocator-heading"><h2 id="allocator-target-title">Set your target split</h2></div>
      <p class="allocator-support">Choose how to split new contributions after SRS. The remaining share goes to fixed income.</p>
      ${buildField("equity", "bogle-target-slider", "Equity share", "Percent of your total allocation.", targetEquityPct)}
      ${buildField("sg", "bogle-sg-slider", "SG dividends share", "Percent of equities. The rest goes to global equities.", sgSleevePct)}
      <div class="allocator-presets" role="group" aria-label="Equity share presets">
        <span>Equity presets</span>
        ${[60, 70, 80, 90].map((preset) => `<button type="button" class="button" data-allocator-preset="${preset}" aria-label="${preset}% equities" aria-pressed="${targetEquityPct === preset}">${preset}%</button>`).join("")}
      </div>
      <dl class="allocator-target-readout" aria-label="Target allocation breakdown">
        ${target.map(([label, pct]) => `<div><dt>${label}</dt><dd><strong>${formatPct(pct)}%</strong></dd></div>`).join("")}
      </dl>
    </section>

    <section class="allocator-paycheck" aria-labelledby="allocator-paycheck-title">
      <h2 id="allocator-paycheck-title">Your monthly investment split</h2>
      <p class="allocator-support">Use these amounts when placing your monthly orders.</p>
      <dl class="allocator-paycheck-values">
        ${[
          ["Global equities", buys.buyGlobalMonthly, "eq"],
          ["SG dividends", buys.buySgMonthly, "sg"],
          ["Fixed income (SSB/Cash)", buys.buyBondMonthly, "bond"],
        ]
          .map(
            ([label, amount, key]) =>
              `<div><dt>${label}</dt><dd>${m(amount, "/mo", `bogle-reb-${key}`)}</dd></div>`,
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
  </div>`;
}
