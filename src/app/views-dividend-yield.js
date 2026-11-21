import { m, centsHtml, formatAnnuityIrr } from "./format.js";

function buildDividendResultsHTML(divModel) {
  if (!divModel) return "";
  const realSign = divModel.realMonthlyPayout >= 0 ? "+" : "−";
  const realRateSign = divModel.realRatePct >= 0 ? "+" : "";
  const realToneClass =
    divModel.realRatePct > 0.05
      ? "is-emerald"
      : divModel.realRatePct < -0.05
        ? "is-danger"
        : "is-amber";
  const rPct = Math.max(0, divModel.ratePct);
  const ssbFloor = Math.min(divModel.ssbRatePct, divModel.inflationPct);
  let pinPct = 0;
  if (rPct < ssbFloor) {
    pinPct = (rPct / Math.max(0.1, ssbFloor)) * 18;
  } else if (rPct < divModel.inflationPct) {
    pinPct =
      18 +
      ((rPct - ssbFloor) / Math.max(0.05, divModel.inflationPct - ssbFloor)) *
        14;
  } else if (rPct < 4.0) {
    pinPct =
      32 +
      ((rPct - divModel.inflationPct) /
        Math.max(0.1, 4.0 - divModel.inflationPct)) *
        17;
  } else if (rPct <= 6.0) {
    pinPct = 49 + ((rPct - 4.0) / 2.0) * 20;
  } else if (rPct <= 7.5) {
    pinPct = 69 + ((rPct - 6.0) / 1.5) * 15;
  } else {
    pinPct = Math.min(98, 84 + ((rPct - 7.5) / 4.5) * 16);
  }
  const zones = [
    { key: "sub-floor", label: "<2.2% Bank", width: "17%" },
    { key: "capital-preserve", label: "2.2–2.5%", width: "15%" },
    { key: "safe-floor", label: "2.5–4% CPF", width: "17%" },
    { key: "sweet-spot", label: "4–6% SG Div", width: "20%" },
    { key: "elevated", label: "6–7.5% High", width: "16%" },
    { key: "yield-trap", label: ">7.5% Trap", width: "15%" },
  ];

  return `
    <div class="div-payout-hero">
      <div class="div-payout-main">
        <span class="div-payout-eyebrow">Monthly Passive Income</span>
        <strong class="div-payout-amount" id="div-monthly-readout">${centsHtml(divModel.monthlyPayout, "/mo")}</strong>
        <p class="div-payout-sub">From <strong>${m(divModel.capital)}</strong> principal at <strong>${divModel.ratePct.toFixed(2)}% p.a.</strong> (~<strong>${centsHtml(divModel.dailyPayout)}/day</strong>)</p>
      </div>
      <div class="div-payout-subgrid">
        <div class="div-payout-stat">
          <span>Annual Payout</span>
          <strong id="div-annual-readout">${m(divModel.annualPayout, "/yr")}</strong>
          <small>12 months gross</small>
        </div>
        <div class="div-payout-stat">
          <span>Quarterly Payout</span>
          <strong id="div-quarterly-readout">${m(divModel.quarterlyPayout, "/qtr")}</strong>
          <small>Every 3 months</small>
        </div>
        <div class="div-payout-stat">
          <span>After ${divModel.inflationPct.toFixed(1)}% Inflation</span>
          <strong class="${realToneClass}" id="div-real-readout">${realSign}${m(Math.abs(divModel.realMonthlyPayout), "/mo")}</strong>
          <small>${realRateSign}${divModel.realRatePct.toFixed(2)}% real purchasing power</small>
        </div>
      </div>
    </div>

    <div class="div-verdict-card is-${divModel.tone}" id="div-verdict-card" role="status" aria-live="polite">
      <div class="div-verdict-head">
        <span class="status-pill is-${divModel.tone}" id="div-verdict-badge">${divModel.badge}</span>
        <h2 id="div-verdict-headline">${divModel.headline}</h2>
      </div>
      <p class="div-verdict-summary" id="div-verdict-summary">${divModel.summary}</p>
      <div class="div-spectrum-wrap" role="group" aria-label="Singapore yield benchmark spectrum from 0% to 10%+">
        <div class="div-spectrum-track">
          ${zones
            .map(
              (z) =>
                `<div class="div-spectrum-zone is-${z.key}${divModel.tierKey === z.key ? " is-current" : ""}" style="width:${z.width}"><span>${z.label}</span></div>`,
            )
            .join("")}
          <div class="div-spectrum-pin" style="left:${pinPct.toFixed(1)}%" title="Your rate: ${divModel.ratePct.toFixed(2)}%">
            <span>${divModel.ratePct.toFixed(2)}%</span>
          </div>
        </div>
      </div>
    </div>`;
}

function buildDividendBenchmarksHTML(divModel) {
  if (!divModel?.benchmarks) return "";
  return `
    <div class="rules-card-head">
      <div>
        <h2 id="div-bench-title">How ${m(divModel.capital)} Performs Across Singapore Yield Tiers</h2>
        <p>Compare each Singapore benchmark tier against your selected <strong>${divModel.ratePct.toFixed(2)}% p.a.</strong> (${centsHtml(divModel.monthlyPayout)}/mo).</p>
      </div>
      <span class="fin-target-pill">Capital: ${m(divModel.capital)}</span>
    </div>
    <div class="table-scroll">
      <table class="ember-ledger-table div-bench-table" aria-label="Singapore yield benchmark comparison">
        <thead>
          <tr>
            <th scope="col">Singapore Benchmark Tier</th>
            <th scope="col">Assessment</th>
            <th scope="col" class="num-col">Ref Yield</th>
            <th scope="col" class="num-col">Monthly Payout</th>
            <th scope="col" class="num-col">Annual Payout</th>
            <th scope="col" class="num-col">Real Yield</th>
            <th scope="col" class="num-col">vs Your ${divModel.ratePct.toFixed(2)}%</th>
          </tr>
        </thead>
        <tbody>
          ${divModel.benchmarks
            .map((b) => {
              const isMatched = Math.abs(b.ratePct - divModel.ratePct) < 0.015;
              const tierVsYours = b.monthlyPayout - divModel.monthlyPayout;
              const diffStr =
                Math.abs(tierVsYours) < 0.01 || isMatched
                  ? `<span class="div-your-rate-pill">Your rate</span>`
                  : tierVsYours > 0
                    ? `+${centsHtml(tierVsYours, "/mo")}`
                    : `−${centsHtml(Math.abs(tierVsYours), "/mo")}`;
              const diffClass =
                Math.abs(tierVsYours) < 0.01 || isMatched
                  ? ""
                  : tierVsYours > 0
                    ? "is-emerald"
                    : "is-muted-diff";
              const realSign = b.realRatePct >= 0 ? "+" : "";
              const realClass =
                b.realRatePct > 0.05
                  ? "is-emerald"
                  : b.realRatePct < -0.05
                    ? "is-danger-text"
                    : "";
              return `<tr class="${isMatched ? "is-selected is-active-row" : b.isClosest ? "is-closest-row" : ""}">
                <td>
                  <div class="div-bench-name">
                    <strong>${b.label}</strong>
                    <small>${b.sub}</small>
                  </div>
                </td>
                <td>
                  <span class="status-pill is-${b.tone} div-tier-pill">${b.verdictShort}</span>
                </td>
                <td class="num-col"><span class="div-rate-badge">${b.ratePct.toFixed(2)}%</span></td>
                <td class="num-col"><strong class="div-mo-val">${centsHtml(b.monthlyPayout, "/mo")}</strong></td>
                <td class="num-col">${m(b.annualPayout, "/yr")}</td>
                <td class="num-col ${realClass}">${realSign}${b.realRatePct.toFixed(2)}%</td>
                <td class="num-col ${diffClass}">${diffStr}</td>
              </tr>`;
            })
            .join("")}
        </tbody>
      </table>
    </div>`;
}

function buildTargetResultsHTML(targetModel) {
  if (!targetModel) return "";
  const yrsLabel =
    targetModel.capitalGap <= 0
      ? "Goal Reached Today"
      : targetModel.yearsToGoal == null
        ? "Increase Monthly Saving"
        : `${targetModel.yearsToGoal.toFixed(1)} yrs`;
  const yrsSub =
    targetModel.capitalGap <= 0
      ? `Your ${m(targetModel.currentCapital)} already covers this goal`
      : targetModel.yearsToGoal == null
        ? targetModel.monthlyContribution <= 0
          ? "Cannot reach goal at $0/mo contribution"
          : targetModel.ratePct <= targetModel.inflationPct
            ? `Yield (${targetModel.ratePct.toFixed(2)}%) does not outpace ${targetModel.inflationPct.toFixed(1)}% inflation`
            : `Exceeds 100-year horizon at ${m(targetModel.monthlyContribution, "/mo")}`
        : `Saving ${m(targetModel.monthlyContribution, "/mo")} at ${targetModel.ratePct.toFixed(2)}% p.a. (${targetModel.inflationPct.toFixed(1)}% inflation)`;

  return `
    <div class="div-payout-hero">
      <div class="div-payout-main">
        <span class="div-payout-eyebrow">Required Capital for ${m(targetModel.targetMonthly, "/mo")}</span>
        <strong class="div-payout-amount" id="div-target-req-readout">${m(targetModel.requiredCapital)}</strong>
        <p class="div-payout-sub">Generates <strong>${m(targetModel.targetMonthly, "/mo")}</strong> (<strong>${m(targetModel.targetAnnual, "/yr")}</strong>) perpetually at <strong>${targetModel.ratePct.toFixed(2)}% p.a.</strong></p>
      </div>
      <div class="div-payout-subgrid">
        <div class="div-payout-stat">
          <span>Capital Shortfall</span>
          <strong id="div-target-gap-readout">${m(targetModel.capitalGap)}</strong>
          <small>${targetModel.pctReachedNow.toFixed(1)}% funded (${m(targetModel.currentCapital)} now)</small>
        </div>
        <div class="div-payout-stat">
          <span>Time to Target</span>
          <strong class="is-emerald" id="div-target-years-readout">${yrsLabel}</strong>
          <small>${yrsSub}</small>
        </div>
        <div class="div-payout-stat">
          <span>Required Monthly Savings (15Y / 20Y)</span>
          <strong id="div-target-15y-readout">${m(targetModel.save15YrMo, "/mo")}</strong>
          <small>20 yrs: ${m(targetModel.save20YrMo, "/mo")} · 10 yrs: ${m(targetModel.save10YrMo, "/mo")}</small>
        </div>
      </div>
    </div>

    <div class="div-verdict-card is-${targetModel.tone}" id="div-target-verdict-card" role="status" aria-live="polite">
      <div class="div-verdict-head">
        <span class="status-pill is-${targetModel.tone}">${targetModel.badge}</span>
        <h2>${targetModel.headline}</h2>
      </div>
      <p class="div-verdict-summary">${targetModel.summary}</p>
    </div>`;
}

function buildTargetBenchmarksHTML(targetModel) {
  if (!targetModel?.tierRows) return "";
  return `
    <div class="rules-card-head">
      <div>
        <h2 id="div-bench-title">Capital Required for ${m(targetModel.targetMonthly, "/mo")} Across Singapore Yield Tiers</h2>
        <p>Higher yield requires a smaller lump sum, but going above <strong>6.0% p.a.</strong> increases NAV erosion and dividend cut risk.</p>
      </div>
      <span class="fin-target-pill">Goal: ${m(targetModel.targetMonthly, "/mo")}</span>
    </div>
    <div class="table-scroll">
      <table class="ember-ledger-table div-bench-table" aria-label="Target monthly income capital comparison">
        <thead>
          <tr>
            <th scope="col">Singapore Yield Tier</th>
            <th scope="col" class="num-col">Ref Yield</th>
            <th scope="col" class="num-col">Required Capital</th>
            <th scope="col" class="num-col">Capital Shortfall</th>
            <th scope="col" class="num-col">15Y Monthly Savings</th>
            <th scope="col" class="num-col">20Y Monthly Savings</th>
          </tr>
        </thead>
        <tbody>
          ${targetModel.tierRows
            .map(
              (
                row,
              ) => `<tr class="${row.isSelected ? "is-selected is-active-row" : ""}">
                <td>
                  <div class="div-bench-name">
                    <strong>${row.label}</strong>
                    <small>${row.sub}</small>
                  </div>
                </td>
                <td class="num-col"><span class="div-rate-badge">${row.ratePct.toFixed(2)}%</span></td>
                <td class="num-col"><strong class="div-mo-val">${m(row.requiredCapital)}</strong></td>
                <td class="num-col">${m(row.capitalGap)}</td>
                <td class="num-col">${m(row.save15YrMo, "/mo")}</td>
                <td class="num-col">${m(row.save20YrMo, "/mo")}</td>
              </tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </div>`;
}

function formatAnnuityBadge({ badge, impliedAnnualIrrPct }) {
  return Number.isFinite(impliedAnnualIrrPct)
    ? `${badge} · ${formatAnnuityIrr(impliedAnnualIrrPct)} IRR`
    : badge;
}

function buildAnnuityResultsHTML(annuityModel) {
  if (!annuityModel) return "";
  const nominalIrr = annuityModel.impliedAnnualIrrPct;
  const hasIrr = Number.isFinite(nominalIrr);
  const participatingLine =
    annuityModel.startingMonthlyPayout > annuityModel.quotedMonthlyPayout
      ? ` · +${m(Math.round(annuityModel.startingMonthlyPayout - annuityModel.quotedMonthlyPayout), "/mo")} non-guaranteed in Year 1`
      : "";
  const irrStr = hasIrr
    ? `${formatAnnuityIrr(nominalIrr, { signed: true })} p.a.`
    : "Unavailable";
  const irrTone = hasIrr
    ? nominalIrr >= 4
      ? "is-emerald"
      : nominalIrr < 2.5
        ? "is-danger"
        : "is-amber"
    : "";
  const vsCpfDelta = Math.round(
    annuityModel.diyCpfSa.monthlyPayout - annuityModel.blendedMonthlyPayout,
  );
  const vsDiyDelta = Math.round(
    annuityModel.diyBench.monthlyPayout - annuityModel.blendedMonthlyPayout,
  );

  return `
    <div class="div-payout-hero">
      <div class="div-payout-main">
        <span class="div-payout-eyebrow">Implied Annualized Return (IRR)</span>
        <strong class="div-payout-amount ${irrTone}" id="div-annuity-irr-readout">${irrStr}</strong>
        <p class="div-payout-sub">${
          hasIrr
            ? `Nominal IRR: <strong>${formatAnnuityIrr(nominalIrr, { signed: true })}</strong> · Real IRR: <strong>${formatAnnuityIrr(annuityModel.realAnnualIrrPct, { signed: true })}</strong> at ${Number(annuityModel.inflationRatePct ?? 2.5).toFixed(1)}% inflation`
            : "No payouts in this scenario."
        }</p>
        <div class="div-annuity-realization-row">
          <span>Bonus Realization</span>
          <div class="div-segmented-inline div-segmented-realization" role="group" aria-label="Bonus realization">
            ${[0, 0.5, 1]
              .map((realization) => {
                const currentRealization = Number.isFinite(
                  Number(annuityModel.bonusRealization),
                )
                  ? Number(annuityModel.bonusRealization)
                  : 1;
                const isActive =
                  Math.abs(currentRealization - realization) < 0.01;
                return `<button type="button" class="div-segment-btn${isActive ? " is-active" : ""}" data-div-annuity-realization="${realization}" aria-pressed="${isActive}">${realization === 0 ? "0% Guaranteed" : realization === 0.5 ? "50% Haircut" : "100% Full"}</button>`;
              })
              .join("")}
          </div>
        </div>
        <p class="div-payout-sub"><strong>${m(annuityModel.monthlyContribution, "/mo")}</strong> × <strong>${annuityModel.contributeYears} yrs</strong>${annuityModel.deferYears > 0 ? ` · <strong>${annuityModel.deferYears} yrs</strong> deferment` : ""} → <strong>${m(annuityModel.quotedMonthlyPayout, "/mo")} guaranteed</strong> × <strong>${annuityModel.payoutYears} yrs</strong>${participatingLine}</p>
      </div>
      <div class="div-payout-subgrid">
        <div class="div-payout-stat">
          <span>Starting Monthly Payout (Year 1)</span>
          <strong>${m(Math.round(annuityModel.startingMonthlyPayout || 0), "/mo")}</strong>
          <small>${m(Math.round(annuityModel.quotedMonthlyPayout || 0), "/mo")} guaranteed + participating dividends</small>
        </div>
        <div class="div-payout-stat">
          <span>Final Monthly Payout (Final Year)</span>
          <strong>${m(Math.round(annuityModel.finalMonthlyPayout || 0), "/mo")}</strong>
          <small>${annuityModel.dividendStepUpRatePct || 5}% annual dividend step-up</small>
        </div>
        <div class="div-payout-stat">
          <span>Maturity Lump Sum</span>
          <strong>${m(annuityModel.scaledTerminalDividend || 0)}</strong>
          <small>Paid in the final payout month · ${Math.round((annuityModel.bonusRealization || 1) * 100)}% realization</small>
        </div>
        <div class="div-payout-stat">
          <span>Total Premium → Total Payout</span>
          <strong id="div-annuity-mult-readout">${annuityModel.payoutMultiple.toFixed(2)}x (${m(annuityModel.totalPayoutReceived)})</strong>
          <small>Total Premium: ${m(annuityModel.totalPrincipalPaid)} · Net Gain: ${annuityModel.netProfitNominal >= 0 ? "+" : "−"}${m(Math.abs(annuityModel.netProfitNominal))}</small>
        </div>
        <div class="div-payout-stat">
          <span>DIY @ 4.0% CPF SA Floor</span>
          <strong id="div-annuity-cpf-readout">${m(Math.round(annuityModel.diyCpfSa.monthlyPayout), "/mo")}</strong>
          <small>${vsCpfDelta > 0 ? `DIY pays +${m(vsCpfDelta, "/mo")} more` : vsCpfDelta < 0 ? `Plan beats SA by +${m(Math.abs(vsCpfDelta), "/mo")}` : "Matches 4.0% floor"}</small>
        </div>
        <div class="div-payout-stat">
          <span>DIY @ ${annuityModel.benchmarkRatePct.toFixed(1)}% Portfolio</span>
          <strong class="is-emerald" id="div-annuity-diy-readout">${m(Math.round(annuityModel.diyBench.monthlyPayout), "/mo")}</strong>
          <small>${vsDiyDelta > 0 ? `DIY pays +${m(vsDiyDelta, "/mo")} more` : `Accumulated: ${m(annuityModel.diyBench.potAtPayoutStart)}`}</small>
        </div>
      </div>
    </div>

    <div class="div-verdict-card is-${annuityModel.tone}" id="div-annuity-verdict-card" role="status" aria-live="polite">
      <div class="div-verdict-head">
        <span class="status-pill is-${annuityModel.tone}">${annuityModel.badge}</span>
        <h2>${annuityModel.headline}</h2>
      </div>
      <p class="div-verdict-summary">${annuityModel.summary}</p>
    </div>`;
}

function buildAnnuityBenchmarksHTML(annuityModel) {
  if (!annuityModel?.comparisons) return "";
  return `
    <div class="rules-card-head">
      <div>
        <h2 id="div-bench-title">Quoted Annuity vs DIY Investing (${m(annuityModel.monthlyContribution, "/mo")} for ${annuityModel.contributeYears} Yrs)</h2>
        <p>See what happens if you invest the exact same <strong>${m(annuityModel.monthlyContribution, "/mo")}</strong> yourself over <strong>${annuityModel.contributeYears} years</strong>${annuityModel.deferYears > 0 ? ` + ${annuityModel.deferYears} deferment years` : ""} and draw down over <strong>${annuityModel.payoutYears} years</strong>.</p>
      </div>
      <span class="fin-target-pill">Total Premium: ${m(annuityModel.totalPrincipalPaid)}</span>
    </div>
    <div class="table-scroll">
      <table class="ember-ledger-table div-bench-table" aria-label="Annuity vs DIY benchmark comparison">
        <thead>
          <tr>
            <th scope="col">Strategy / Benchmark</th>
            <th scope="col" class="num-col">Annual Return</th>
            <th scope="col" class="num-col">Accumulated Value</th>
            <th scope="col" class="num-col">Monthly Payout (${annuityModel.payoutYears}y)</th>
            <th scope="col" class="num-col">Total Payout</th>
            <th scope="col" class="num-col">vs Quoted Plan</th>
          </tr>
        </thead>
        <tbody>
          ${annuityModel.comparisons
            .map((c) => {
              const delta = c.monthlyDeltaVsQuoted;
              const deltaStr = c.isQuoted
                ? `<span class="div-your-rate-pill">Quoted Plan</span>`
                : Math.abs(delta) < 1
                  ? "Same payout"
                  : delta > 0
                    ? `DIY +${m(Math.round(delta), "/mo")}`
                    : `Plan +${m(Math.round(Math.abs(delta)), "/mo")}`;
              const deltaClass = c.isQuoted
                ? ""
                : delta > 0
                  ? "is-emerald"
                  : "is-muted-diff";
              return `<tr class="${c.isQuoted ? "is-selected is-active-row" : ""}">
                <td>
                  <div class="div-bench-name">
                    <strong>${c.label}</strong>
                    <small>${c.sub}</small>
                  </div>
                </td>
                <td class="num-col"><span class="div-rate-badge">${formatAnnuityIrr(c.ratePct)}</span></td>
                <td class="num-col">${c.potAtPayoutStart === null ? "—" : m(c.potAtPayoutStart)}</td>
                <td class="num-col"><strong class="div-mo-val">${m(Math.round(c.monthlyPayout), "/mo")}</strong></td>
                <td class="num-col">${m(c.totalPayout)}</td>
                <td class="num-col ${deltaClass}">${deltaStr}</td>
              </tr>`;
            })
            .join("")}
        </tbody>
      </table>
    </div>`;
}

function buildDividendCalculatorSection({
  mode = "lump",
  divModel,
  targetModel,
  annuityModel,
}) {
  if (!divModel) return "";
  const capPresets = [
    { val: 10000, label: "$10k" },
    { val: 50000, label: "$50k" },
    { val: 100000, label: "$100k" },
    { val: 250000, label: "$250k" },
    { val: 500000, label: "$500k" },
    { val: 1000000, label: "$1M" },
  ];

  const ratePresets = [
    { val: 0.05, label: "0.05% Bank Base" },
    {
      val: Number(divModel.ssbRatePct.toFixed(2)),
      label: `${divModel.ssbRatePct.toFixed(2)}% MAS SSB`,
    },
    { val: 2.5, label: "2.5% CPF OA" },
    { val: 4.0, label: "4.0% CPF SA" },
    { val: 5.0, label: "5.0% SG Banks" },
    { val: 6.0, label: "6.0% SG REITs" },
    { val: 8.0, label: "8.0% High Yield" },
  ];

  const targetMoPresets = [
    { val: 2000, label: "$2,000/mo" },
    { val: 3500, label: "$3,500/mo" },
    { val: 5000, label: "$5,000/mo" },
    { val: 8000, label: "$8,000/mo" },
    { val: 10000, label: "$10,000/mo" },
    { val: 15000, label: "$15,000/mo" },
  ];

  const startCapPresets = [
    { val: 0, label: "$0" },
    { val: 50000, label: "$50k" },
    { val: 100000, label: "$100k" },
    { val: 250000, label: "$250k" },
    { val: 500000, label: "$500k" },
  ];

  const saveMoPresets = [
    { val: 500, label: "$500/mo" },
    { val: 1000, label: "$1,000/mo" },
    { val: 1500, label: "$1,500/mo" },
    { val: 2000, label: "$2,000/mo" },
    { val: 3000, label: "$3,000/mo" },
    { val: 5000, label: "$5,000/mo" },
  ];

  const hdrTone =
    mode === "target" && targetModel
      ? targetModel.tone
      : mode === "annuity" && annuityModel
        ? annuityModel.tone
        : divModel.tone;
  const hdrText =
    mode === "target" && targetModel
      ? `${targetModel.badge} · ${m(targetModel.requiredCapital)} needed`
      : mode === "annuity" && annuityModel
        ? formatAnnuityBadge(annuityModel)
        : `${divModel.badge} · ${divModel.ratePct.toFixed(2)}%`;

  let controlsHTML = "";
  let resultsHTML = "";
  let benchHTML = "";

  if (mode === "target" && targetModel) {
    controlsHTML = `
      <div class="div-control-block">
        <div class="div-control-label-row">
          <label for="div-target-monthly" id="div-calc-heading">Target Monthly Passive Income</label>
          <span class="div-control-hint">Desired monthly payout</span>
        </div>
        <div class="div-input-stepper-row">
          <button type="button" class="div-step-btn" data-div-target-step="-500" aria-label="Decrease target monthly income by $500">−$500</button>
          <div class="input-prefix div-cap-input-wrap">
            <span>$</span>
            <input id="div-target-monthly" type="number" inputmode="numeric" min="100" max="500000" step="100" value="${Math.round(targetModel.targetMonthly)}" aria-label="Target monthly income in SGD" />
          </div>
          <button type="button" class="div-step-btn" data-div-target-step="500" aria-label="Increase target monthly income by $500">+$500</button>
        </div>
        <div class="div-chip-row" role="group" aria-label="Quick target monthly income presets">
          ${targetMoPresets
            .map((tp) => {
              const active = Math.round(targetModel.targetMonthly) === tp.val;
              return `<button type="button" class="div-preset-chip${active ? " is-active" : ""}" data-div-target-pick="${tp.val}" aria-pressed="${active}">${tp.label}</button>`;
            })
            .join("")}
        </div>
      </div>

      <div class="div-control-block">
        <div class="div-control-label-row">
          <label for="div-target-rate">Expected Portfolio / Dividend Yield (% p.a.)</label>
          <span class="div-control-hint">Annual percentage yield</span>
        </div>
        <div class="div-rate-input-row">
          <input id="div-target-rate-slider" class="div-rate-slider" type="range" min="0.5" max="12" step="0.05" value="${Math.min(12, Math.max(0.5, targetModel.ratePct))}" aria-label="Target yield percentage slider" />
          <div class="input-suffix div-rate-num-wrap">
            <input id="div-target-rate" type="number" inputmode="decimal" min="0.1" max="25" step="0.05" value="${Number(targetModel.ratePct.toFixed(2))}" aria-label="Expected annual yield percentage" />
            <span>% p.a.</span>
          </div>
        </div>
        <div class="div-chip-row" role="group" aria-label="Yield presets for target income">
          ${ratePresets
            .filter((rp) => rp.val >= 2.0)
            .map((rp) => {
              const active = Math.abs(targetModel.ratePct - rp.val) < 0.015;
              return `<button type="button" class="div-preset-chip${active ? " is-active" : ""}" data-div-target-rate-pick="${rp.val}" aria-pressed="${active}">${rp.label}</button>`;
            })
            .join("")}
        </div>
      </div>

      <div class="div-subcontrols-grid">
        <div class="div-control-block">
          <div class="div-control-label-row">
            <label for="div-target-cur-cap">Starting Capital Today</label>
            <span class="div-control-hint">Initial lump sum</span>
          </div>
          <div class="input-prefix div-cap-input-wrap">
            <span>$</span>
            <input id="div-target-cur-cap" type="number" inputmode="numeric" min="0" max="50000000" step="1000" value="${Math.round(targetModel.currentCapital)}" aria-label="Starting capital in SGD" />
          </div>
          <div class="div-chip-row" role="group" aria-label="Starting capital presets">
            ${startCapPresets
              .map((cp) => {
                const active =
                  Math.round(targetModel.currentCapital) === cp.val;
                return `<button type="button" class="div-preset-chip${active ? " is-active" : ""}" data-div-target-cap-pick="${cp.val}" aria-pressed="${active}">${cp.label}</button>`;
              })
              .join("")}
          </div>
        </div>

        <div class="div-control-block">
          <div class="div-control-label-row">
            <label for="div-target-mo-save">Monthly Contribution</label>
            <span class="div-control-hint">Monthly investment</span>
          </div>
          <div class="input-prefix div-cap-input-wrap">
            <span>$</span>
            <input id="div-target-mo-save" type="number" inputmode="numeric" min="0" max="500000" step="100" value="${Math.round(targetModel.monthlyContribution)}" aria-label="Monthly contribution in SGD" />
          </div>
          <div class="div-chip-row" role="group" aria-label="Monthly contribution presets">
            ${saveMoPresets
              .slice(0, 4)
              .map((sp) => {
                const active =
                  Math.round(targetModel.monthlyContribution) === sp.val;
                return `<button type="button" class="div-preset-chip${active ? " is-active" : ""}" data-div-target-save-pick="${sp.val}" aria-pressed="${active}">${sp.label}</button>`;
              })
              .join("")}
          </div>
        </div>
      </div>`;
    resultsHTML = buildTargetResultsHTML(targetModel);
    benchHTML = buildTargetBenchmarksHTML(targetModel);
  } else if (mode === "annuity" && annuityModel) {
    controlsHTML = `
      <section class="div-annuity-card div-annuity-card-primary">
        <div class="div-annuity-card-head">
          <div>
            <h2>Contribution &amp; Timeline</h2>
            <p>Premium schedule and accumulation horizon</p>
          </div>
          <div class="div-segmented-inline" role="group" aria-label="Premium payment mode">
            ${["monthly", "annual"].map((paymentMode) => `<button type="button" class="div-segment-btn${annuityModel.paymentMode === paymentMode ? " is-active" : ""}" data-div-annuity-payment="${paymentMode}" aria-pressed="${annuityModel.paymentMode === paymentMode}">${paymentMode === "monthly" ? "Monthly" : "Annual"}</button>`).join("")}
          </div>
        </div>
        <div class="div-annuity-premium-row">
          <div class="div-annuity-field">
            <label for="div-annuity-mo-save">Monthly Premium</label>
            <small>Enter once; Annual mode pays this amount × 12 upfront each year</small>
          </div>
          <div class="div-annuity-premium-stack">
            <div class="div-compact-currency">
              <span>$</span>
              <input id="div-annuity-mo-save" type="text" inputmode="decimal" value="${annuityModel.monthlyContribution.toLocaleString("en-SG")}" aria-label="Monthly premium" />
            </div>
            ${annuityModel.paymentMode === "annual" ? `<small>Annual equivalent: ${m(annuityModel.monthlyContribution * 12, "/yr")}</small>` : ""}
          </div>
        </div>
        <div class="div-annuity-timeline-grid">
          <div class="div-annuity-field">
            <label for="div-annuity-pay-yrs">Premium Term</label>
            <div class="div-annuity-unit-input">
              <input id="div-annuity-pay-yrs" type="number" inputmode="numeric" min="1" max="50" step="1" value="${annuityModel.contributeYears}" />
              <span>yrs</span>
            </div>
          </div>
          <div class="div-annuity-field">
            <label for="div-annuity-defer-yrs">Deferment</label>
            <div class="div-annuity-unit-input">
              <input id="div-annuity-defer-yrs" type="number" inputmode="numeric" min="0" max="30" step="1" value="${annuityModel.deferYears}" />
              <span>yrs</span>
            </div>
          </div>
          <div class="div-annuity-field">
            <label for="div-annuity-draw-yrs">Payout Duration</label>
            <div class="div-annuity-unit-input">
              <input id="div-annuity-draw-yrs" type="number" inputmode="numeric" min="1" max="50" step="1" value="${annuityModel.payoutYears}" />
              <span>yrs</span>
            </div>
          </div>
        </div>
      </section>

      <section class="div-annuity-card">
        <div class="div-annuity-card-head">
          <div>
            <h2>Guaranteed Payout</h2>
            <p>Base contract payout excluding bonuses</p>
          </div>
        </div>
        <div class="div-annuity-premium-row">
          <label for="div-annuity-quoted-mo">Guaranteed Monthly Payout</label>
          <div class="div-compact-currency">
            <span>$</span>
            <input id="div-annuity-quoted-mo" type="text" inputmode="decimal" value="${annuityModel.quotedMonthlyPayout.toLocaleString("en-SG")}" aria-label="Guaranteed monthly payout" />
          </div>
        </div>
      </section>

      <details class="div-annuity-card div-annuity-bonus-card" open>
        <summary class="div-annuity-card-head">
          <div>
            <h2>Non-Guaranteed Bonuses</h2>
            <p>Optional participating dividends and maturity benefit</p>
          </div>
          <span class="div-annuity-disclosure" aria-hidden="true"></span>
        </summary>
        <div class="div-annuity-bonus-body">
          <div class="div-annuity-two-col">
            <div class="div-annuity-field">
              <label for="div-annuity-monthly-dividends">Total Monthly Dividends</label>
              <div class="div-compact-currency">
                <span>$</span>
                <input id="div-annuity-monthly-dividends" type="text" inputmode="decimal" value="${Math.round(annuityModel.nonGuaranteedMonthlyDividends || 0).toLocaleString("en-SG")}" aria-label="Total non-guaranteed monthly dividends" />
              </div>
            </div>
            <div class="div-annuity-field">
              <label for="div-annuity-terminal">Terminal Dividend at Maturity</label>
              <div class="div-compact-currency">
                <span>$</span>
                <input id="div-annuity-terminal" type="text" inputmode="decimal" value="${Math.round(annuityModel.terminalDividend || 0).toLocaleString("en-SG")}" aria-label="Terminal non-guaranteed dividend" />
              </div>
            </div>
          </div>
          <div class="div-annuity-step-row">
            <span>Annual Dividend Step-Up</span>
            <div class="div-segmented-inline" role="group" aria-label="Dividend step-up presets">
              ${[0, 3, 5].map((pct) => `<button type="button" class="div-segment-btn${Math.abs((annuityModel.dividendStepUpRatePct || 5) - pct) < 0.01 ? " is-active" : ""}" data-div-annuity-step-up="${pct}" aria-pressed="${Math.abs((annuityModel.dividendStepUpRatePct || 5) - pct) < 0.01}">${pct}%</button>`).join("")}
            </div>
          </div>
        </div>
      </details>`;
    resultsHTML = buildAnnuityResultsHTML(annuityModel);
    benchHTML = buildAnnuityBenchmarksHTML(annuityModel);
  } else {
    controlsHTML = `
      <div class="div-control-block">
        <div class="div-control-label-row">
          <label for="div-calc-capital" id="div-calc-heading">Capital / Principal Amount</label>
          <span class="div-control-hint">Lump sum invested</span>
        </div>
        <div class="div-input-stepper-row">
          <button type="button" class="div-step-btn" data-div-cap-step="-10000" aria-label="Decrease capital by $10,000">−$10k</button>
          <div class="input-prefix div-cap-input-wrap">
            <span>$</span>
            <input id="div-calc-capital" type="number" inputmode="numeric" min="0" max="50000000" step="1000" value="${Math.round(divModel.capital)}" aria-label="Capital amount in SGD" />
          </div>
          <button type="button" class="div-step-btn" data-div-cap-step="10000" aria-label="Increase capital by $10,000">+$10k</button>
        </div>
        <div class="div-chip-row" role="group" aria-label="Quick capital presets">
          ${capPresets
            .map((cp) => {
              const active = Math.round(divModel.capital) === cp.val;
              return `<button type="button" class="div-preset-chip${active ? " is-active" : ""}" data-div-cap-pick="${cp.val}" aria-pressed="${active}">${cp.label}</button>`;
            })
            .join("")}
        </div>
      </div>

      <div class="div-control-block">
        <div class="div-control-label-row">
          <label for="div-calc-rate">Dividend / Interest Yield (% p.a.)</label>
          <span class="div-control-hint">Annual percentage yield</span>
        </div>
        <div class="div-rate-input-row">
          <input id="div-calc-rate-slider" class="div-rate-slider" type="range" min="0" max="12" step="0.05" value="${Math.min(12, Math.max(0, divModel.ratePct))}" aria-label="Dividend or interest yield slider" />
          <div class="input-suffix div-rate-num-wrap">
            <input id="div-calc-rate" type="number" inputmode="decimal" min="0" max="25" step="0.05" value="${Number(divModel.ratePct.toFixed(2))}" aria-label="Annual yield percentage" />
            <span>% p.a.</span>
          </div>
        </div>
        <div class="div-chip-row" role="group" aria-label="Singapore benchmark yield presets">
          ${ratePresets
            .map((rp) => {
              const active = Math.abs(divModel.ratePct - rp.val) < 0.015;
              return `<button type="button" class="div-preset-chip${active ? " is-active" : ""}" data-div-rate-pick="${rp.val}" aria-pressed="${active}">${rp.label}</button>`;
            })
            .join("")}
        </div>
      </div>`;
    resultsHTML = buildDividendResultsHTML(divModel);
    benchHTML = buildDividendBenchmarksHTML(divModel);
  }

  return `
    <header class="ember-page-header fin-page-header">
      <div class="fin-header-copy">
        <h1>Dividend, Target Income &amp; Annuity Calculator</h1>
        <p class="fin-page-sub">Standalone Singapore calculator for lump-sum yield, target monthly passive income, and retirement annuity evaluation.</p>
      </div>
      <div class="ember-header-meta">
        <span class="status-pill is-${hdrTone}" id="div-header-badge">${hdrText}</span>
      </div>
    </header>

    <div class="div-mode-bar" role="tablist" aria-label="Calculator mode">
      <button type="button" role="tab" class="div-mode-tab${mode === "lump" ? " is-active" : ""}" data-div-mode="lump" aria-selected="${mode === "lump"}">
        <strong>Dividend &amp; Interest Yield</strong>
        <span>Principal &amp; Yield → Monthly Income</span>
      </button>
      <button type="button" role="tab" class="div-mode-tab${mode === "target" ? " is-active" : ""}" data-div-mode="target" aria-selected="${mode === "target"}">
        <strong>Target Monthly Income</strong>
        <span>Required Capital &amp; Accumulation Horizon</span>
      </button>
      <button type="button" role="tab" class="div-mode-tab${mode === "annuity" ? " is-active" : ""}" data-div-mode="annuity" aria-selected="${mode === "annuity"}">
        <strong>Annuity &amp; Savings Plan</strong>
        <span>Premium, Deferment &amp; Payout IRR Analysis</span>
      </button>
    </div>

    <section class="card-surface rules-card div-calc-card" id="dividend-calculator-card" aria-labelledby="div-calc-heading">
      <div class="div-calc-grid">
        <div class="div-calc-results" id="div-calc-results-pane">
          ${resultsHTML}
        </div>
        <div class="div-calc-controls">
          ${controlsHTML}
        </div>
      </div>
    </section>

    <section class="card-surface rules-card div-bench-card" id="dividend-benchmarks-card" aria-labelledby="div-bench-title">
      ${benchHTML}
    </section>
  `;
}

export {
  buildDividendResultsHTML,
  buildDividendBenchmarksHTML,
  buildTargetResultsHTML,
  buildTargetBenchmarksHTML,
  buildAnnuityResultsHTML,
  buildAnnuityBenchmarksHTML,
  formatAnnuityBadge,
  buildDividendCalculatorSection,
};
