import {
  money,
  m,
  centsHtml,
  compactMoney,
  html,
  raw,
  ICONS,
  buildAllocationMix,
} from "./format.js";

function svgDonut(segments, centerTop, centerBottom) {
  const total = segments.reduce((sum, x) => sum + x.value, 0);
  const r = 46,
    cx = 60,
    cy = 60,
    circ = 2 * Math.PI * r;
  let offset = 0;
  const rings =
    total <= 0
      ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--border)" stroke-width="16" />`
      : segments
          .filter((seg) => seg.value > 0)
          .map((seg) => {
            const len = (seg.value / total) * circ;
            const el = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${seg.color}" stroke-width="16" stroke-dasharray="${len} ${circ - len}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})" />`;
            offset += len;
            return el;
          })
          .join("");
  return `<div class="donut-wrap">
    <svg viewBox="0 0 120 120" width="132" height="132" class="donut-svg" aria-hidden="true">
      ${rings}
    </svg>
    <div class="donut-center">
      <strong>${centerTop}</strong>
      <span>${centerBottom}</span>
    </div>
  </div>`;
}

function buildBogleheadSection(bogle) {
  const liq = bogle.liquid;
  const hol = bogle.holistic;
  const reb = bogle.monthlyRebalance;
  const liqDonut = svgDonut(
    [
      { value: liq.globalEquities, color: "var(--sem-equities)" },
      { value: liq.sgDividends, color: "var(--sem-equities-sg)" },
      { value: liq.bondsCash, color: "var(--sem-cash)" },
    ],
    `${Math.round(liq.equityPct)}/${Math.round(liq.bondPct)}`,
    "Eq / Cash",
  );
  const holDonut = svgDonut(
    [
      { value: hol.globalEquities, color: "var(--sem-equities)" },
      { value: hol.sgDividends, color: "var(--sem-equities-sg)" },
      { value: hol.liquidBonds, color: "var(--sem-cash)" },
      { value: hol.cpfTotal, color: "var(--sem-cpf)" },
    ],
    `${Math.round(hol.effectiveEquityPct)}/${Math.round(hol.effectiveBondPct)}`,
    "Eq / Bond",
  );

  const curNW = Math.max(1, hol.totalNetWorth);
  const curGlobalPct =
    hol.totalNetWorth > 0 ? (hol.globalEquities / curNW) * 100 : 0;
  const curSgPct = hol.totalNetWorth > 0 ? (hol.sgDividends / curNW) * 100 : 0;
  const curCashPct =
    hol.totalNetWorth > 0 ? (hol.liquidBonds / curNW) * 100 : 0;
  const curCpfPct = hol.totalNetWorth > 0 ? (hol.cpfTotal / curNW) * 100 : 0;

  const bondLabel =
    hol.cpfTotal > 0 && hol.liquidBonds > 0
      ? "Bond/CPF"
      : hol.cpfTotal > 0
        ? "CPF"
        : "SSB/Cash";
  const curEqRounded = Math.round(hol.effectiveEquityPct);
  const tgtEqRounded = Math.round(hol.targetEquityPct);
  const equityDeltaPct = curEqRounded - tgtEqRounded;
  const gapBadge =
    Math.abs(equityDeltaPct) <= 3
      ? {
          cls: "is-good",
          text: `${curEqRounded}% Eq · Aligned with ${tgtEqRounded}% Target`,
        }
      : equityDeltaPct < 0
        ? {
            cls: "is-equities",
            text: `${curEqRounded}% Eq vs ${tgtEqRounded}% Target (${equityDeltaPct}% Eq)`,
          }
        : {
            cls: "is-bonds",
            text: `${curEqRounded}% Eq vs ${tgtEqRounded}% Target (+${equityDeltaPct}% Eq)`,
          };

  return `<header class="ember-page-header fin-page-header">
    <div class="fin-header-copy">
      <h1>Portfolio Allocator</h1>
      <p class="fin-page-sub">Holistic stock/bond balance counting CPF and SSB/Cash as your defensive floor.</p>
    </div>
    <div class="ember-header-meta">
      <span class="status-pill ${gapBadge.cls === "is-good" ? "is-good" : "is-info"}">${gapBadge.cls === "is-good" ? ICONS.checkTiny : ICONS.alertTriangle}<span>${gapBadge.text}</span></span>
    </div>
  </header>
  <section class="bogle-card card-surface" id="boglehead-allocator" aria-labelledby="bogle-title">
    <div class="bogle-head">
      <div>
        <h2 id="bogle-title">True Effective Stock / Bond Ratio</h2>
        <p>Current balances count CPF OA/SA/MA (${m(hol.cpfTotal)}) and SSB/Cash (${m(hol.liquidBonds)}) together as your defensive bond floor.</p>
      </div>
      <button type="button" class="text-button" data-open-settings-field="known-equities">Edit balances</button>
    </div>
    <div class="bogle-donuts-grid">
      <div class="donut-panel">
        <div class="donut-panel-head">
          <h3>Current Liquid Portfolio</h3>
          <span class="donut-tag swell-slate-pill">${m(liq.total, "", "bogle-liq-tot")} today</span>
        </div>
        <div class="donut-row">
          ${liqDonut}
          <ul class="donut-legend">
            <li><i style="background:var(--sem-equities);"></i><span>Global UCITS</span><b>${m(liq.globalEquities, "", "bogle-liq-eq")}</b></li>
            <li><i style="background:var(--sem-equities-sg);"></i><span>SG Dividends</span><b>${m(liq.sgDividends, "", "bogle-liq-sg")}</b></li>
            <li><i style="background:var(--sem-cash);"></i><span>SSB / Cash</span><b>${m(liq.bondsCash, "", "bogle-liq-cash")}</b></li>
          </ul>
        </div>
      </div>
      <div class="donut-panel donut-panel-holistic">
        <div class="donut-panel-head">
          <h3>Current Total Net Worth</h3>
          <span class="donut-tag is-holistic swell-slate-pill">${m(hol.totalNetWorth, "", "bogle-hol-tot")} total</span>
        </div>
        <div class="donut-row">
          ${holDonut}
          <ul class="donut-legend">
            <li><i style="background:var(--sem-equities);"></i><span>Global Equities</span><b>${hol.totalNetWorth ? Math.round((hol.globalEquities / hol.totalNetWorth) * 100) : 0}% (${m(hol.globalEquities)})</b></li>
            <li><i style="background:var(--sem-equities-sg);"></i><span>SG Dividends</span><b>${hol.totalNetWorth ? Math.round((hol.sgDividends / hol.totalNetWorth) * 100) : 0}% (${m(hol.sgDividends)})</b></li>
            <li><i style="background:var(--sem-cash);"></i><span>SSB / Cash</span><b>${hol.totalNetWorth ? Math.round((hol.liquidBonds / hol.totalNetWorth) * 100) : 0}% (${m(hol.liquidBonds)})</b></li>
            <li><i style="background:var(--sem-cpf);"></i><span>CPF (OA+SA+MA)</span><b>${hol.totalNetWorth ? Math.round((hol.cpfTotal / hol.totalNetWorth) * 100) : 0}% (${m(hol.cpfTotal)})</b></li>
          </ul>
        </div>
      </div>
    </div>

    <div class="bogle-target-panel">
      <div class="mix-compare-wrap">
        <div class="mix-compare-head">
          <div>
            <h3>Target Mix &amp; Outside Investment Split</h3>
            <p>Choose a preset or enter your exact % split below — your monthly outside investment and projection follow this split directly.</p>
          </div>
        </div>
        <div class="mix-bars">
          <div class="mix-bar-row">
            <div class="mix-bar-meta">
              <span>Current Mix</span>
              <strong>${Math.round(curGlobalPct)}% Global · ${Math.round(curSgPct)}% SG · ${Math.round(hol.effectiveBondPct)}% ${bondLabel}</strong>
            </div>
            <div class="mix-track" aria-hidden="true">
              ${curGlobalPct > 0.4 ? `<span style="width:${curGlobalPct.toFixed(1)}%;background:var(--sem-equities);" title="Global Equities"></span>` : ""}
              ${curSgPct > 0.4 ? `<span style="width:${curSgPct.toFixed(1)}%;background:var(--sem-equities-sg);" title="SG Dividends"></span>` : ""}
              ${curCashPct > 0.4 ? `<span style="width:${curCashPct.toFixed(1)}%;background:var(--sem-cash);" title="SSB / Cash"></span>` : ""}
              ${curCpfPct > 0.4 ? `<span style="width:${curCpfPct.toFixed(1)}%;background:var(--sem-cpf);" title="CPF OA/SA/MA"></span>` : ""}
            </div>
          </div>
        </div>
      </div>

      <div class="allocation-editor">
        <strong>Target allocation</strong>
        ${buildAllocationMix(hol.targetEquityPct, hol.sgSleevePct)}
        <div class="allocation-controls">
        <div>
          <label for="bogle-target-slider">Equity (% of portfolio)</label>
          <div class="bogle-funnel-controls">
            <div class="saving-stepper bogle-stepper">
              <button type="button" data-bogle-step="bogle-target-slider" data-delta="-5" aria-label="Decrease target equity percentage by 5%">−</button>
              <div class="input-wrap">
                <input id="bogle-target-slider" type="number" min="0" max="100" step="1" value="${hol.targetEquityPct}" inputmode="numeric" />
                <span>%</span>
              </div>
              <button type="button" data-bogle-step="bogle-target-slider" data-delta="5" aria-label="Increase target equity percentage by 5%">+</button>
            </div>
            <div class="qe-picker-chips bogle-preset-chips bogle-funnel-chips" role="group" aria-label="Target equity split presets">
              ${[0, 50, 60, 70, 80, 90, 100]
                .map(
                  (v) =>
                    `<button type="button" class="qe-picker-chip${hol.targetEquityPct === v ? " is-active" : ""}" data-bogle-eq-preset="${v}" aria-pressed="${hol.targetEquityPct === v}">${v}/${100 - v}</button>`,
                )
                .join("")}
            </div>
          </div>
        </div>

        <div id="bogle-sg-controls">
          <label for="bogle-sg-slider">SG (% of equity)</label>
          <div class="bogle-funnel-controls">
            <div class="saving-stepper bogle-stepper">
              <button type="button" data-bogle-step="bogle-sg-slider" data-delta="-5" aria-label="Decrease SG dividend sleeve by 5%"${hol.targetEquityPct === 0 ? " disabled" : ""}>−</button>
              <div class="input-wrap">
                <input id="bogle-sg-slider" type="number" min="0" max="100" step="1" value="${hol.sgSleevePct}" inputmode="numeric"${hol.targetEquityPct === 0 ? " disabled" : ""} />
                <span>%</span>
              </div>
              <button type="button" data-bogle-step="bogle-sg-slider" data-delta="5" aria-label="Increase SG dividend sleeve by 5%"${hol.targetEquityPct === 0 ? " disabled" : ""}>+</button>
            </div>
            <div class="qe-picker-chips bogle-preset-chips bogle-funnel-chips" role="group" aria-label="SG dividend sleeve presets">
              ${[0, 10, 15, 20, 30, 50, 100]
                .map(
                  (v) =>
                    `<button type="button" class="qe-picker-chip${hol.sgSleevePct === v ? " is-active" : ""}" data-bogle-sg-preset="${v}" aria-pressed="${hol.sgSleevePct === v}"${hol.targetEquityPct === 0 ? " disabled" : ""}>${100 - v}/${v}</button>`,
                )
                .join("")}
            </div>
          </div>
        </div>
      </div>

      </div>
      <div class="rebalance-directive">
        <div>
          <strong>Monthly Paycheck Action · ${m(reb.investPool, "/mo", "bogle-reb-pool")} investable</strong>
          <p>${reb.note}</p>
        </div>
        <div class="rebalance-pills">
          <span class="pill-eq"><i class="sem-dot" style="background:var(--sem-equities);"></i><b>${m(reb.buyGlobalMonthly, "/mo", "bogle-reb-eq")}</b> Global UCITS</span>
          <span class="pill-sg"><i class="sem-dot" style="background:var(--sem-equities-sg);"></i><b>${m(reb.buySgMonthly, "/mo", "bogle-reb-sg")}</b> SG Dividends</span>
          <span class="pill-cash"><i class="sem-dot" style="background:var(--sem-cash);"></i><b>${m(reb.buyBondMonthly, "/mo", "bogle-reb-bond")}</b> SSB / T-Bills</span>
          <button type="button" class="fin-link-pill cash-crosslink-btn" data-go-tab="cash-parking">Compare SSB, HYSA &amp; MMFs →</button>
        </div>
      </div>
    </div>
  </section>`;
}

function buildTaxSweetSpotSection(tax) {
  const C = RetirementModel.C;
  const marginalPct = `${(tax.taxBefore.marginalRate * 100).toFixed(1).replace(/\.0$/, "")}%`;
  const capTotal = Math.max(1, C.personalReliefCap);
  const baseReliefs = Math.max(0, Math.round(tax.reliefCapUsed || 0));
  const activeSelfRstu = Math.max(0, Math.round(tax.activeSelfRstu || 0));
  const activeFamRstu = Math.max(0, Math.round(tax.activeFamilyRstu || 0));
  const activeSrs = Math.max(0, Math.round(tax.activeSrs || 0));
  const totalClaimed = Math.min(
    capTotal,
    baseReliefs + activeSelfRstu + activeFamRstu + activeSrs,
  );
  const totalClaimedPct = Math.min(
    100,
    Math.round((totalClaimed / capTotal) * 100),
  );
  const remainingAfterActive = Math.max(0, capTotal - totalClaimed);
  const basePct = Math.min(100, (baseReliefs / capTotal) * 100);
  const selfRstuPct = Math.min(
    100 - basePct,
    (activeSelfRstu / capTotal) * 100,
  );
  const famRstuPct = Math.min(
    100 - basePct - selfRstuPct,
    (activeFamRstu / capTotal) * 100,
  );
  const srsPct = Math.min(
    100 - basePct - selfRstuPct - famRstuPct,
    (activeSrs / capTotal) * 100,
  );
  const tierTone =
    tax.tier === "max-both" || tax.tier === "rstu-first"
      ? "is-good"
      : "is-warn";

  return `<section class="tax-sweet-card card-surface" id="tax-sweet-spot" aria-labelledby="tax-sweet-title">
    <div class="tax-sweet-head">
      <div>
        <h2 id="tax-sweet-title">CPF RSTU vs. SRS Tax Sweet-Spot</h2>
        <p class="tax-guidance-copy">${tax.guidance}</p>
      </div>
      <span class="status-pill ${tierTone}">${tax.headline}</span>
    </div>
    <dl class="tax-metrics-grid">
      <div class="tax-metric-box">
        <dt>Chargeable Income (est.)</dt>
        <dd>${m(tax.chargeableIncome, "/yr", "tax-chargeable")}</dd>
        <small>${marginalPct} marginal bracket · ${m(tax.taxBefore.annualTax, "/yr")} tax</small>
      </div>
      <div class="tax-metric-box">
        <dt>CPF RSTU ($8k cap to FRS)</dt>
        <dd>${m(tax.rstuTaxSaved, "/yr saved", "tax-rstu-saved")}</dd>
        <small>Eligible room: ${m(tax.maxRstu, "/yr")} (SA room ${m(tax.saRoom)})</small>
      </div>
      <div class="tax-metric-box">
        <dt>SRS ($15.3k Citizen/PR cap)</dt>
        <dd>${m(tax.srsTaxSavedAfterRstu, "/yr saved", "tax-srs-saved")}</dd>
        <small>After RSTU (${m(tax.srsStandaloneTaxSaved, "/yr")} standalone) · Lock-in age ${tax.srsLockInAge}</small>
      </div>
      <div class="tax-metric-box">
        <dt>$80k Relief Cap Used</dt>
        <dd>${m(tax.reliefCapUsed, "", "tax-cap-used")} <span class="curr-muted">/ ${m(C.personalReliefCap)}</span></dd>
        <small>${totalClaimedPct}% claimed · ${m(remainingAfterActive)} remaining</small>
      </div>
    </dl>
    <article class="fin-bento-card card-surface tax-bento-embedded" aria-label="IRAS $80,000 personal relief cap waterfall">
      <div class="fin-bento-head">
        <div>
          <span class="fin-bento-eyebrow">YA ${C.year} IRAS $80,000 Relief Cap</span>
          <h3 class="fin-bento-title">${m(totalClaimed)} <small>claimed · ${m(remainingAfterActive)} room left</small></h3>
        </div>
        <span class="fin-bento-share-pill">${totalClaimedPct}%</span>
      </div>
      <div class="fin-bento-bar" role="progressbar" aria-valuenow="${totalClaimedPct}" aria-valuemin="0" aria-valuemax="100" aria-label="${totalClaimedPct}% of $80,000 personal income tax relief cap used">
        <span data-meter-key="tax-wf-base" data-meter-w="${basePct.toFixed(1)}" style="width:${basePct.toFixed(1)}%;background:var(--sem-equities);"></span>
        <span data-meter-key="tax-wf-rstu" data-meter-w="${selfRstuPct.toFixed(1)}" style="width:${selfRstuPct.toFixed(1)}%;background:var(--sem-cpf);"></span>
        <span data-meter-key="tax-wf-fam" data-meter-w="${famRstuPct.toFixed(1)}" style="width:${famRstuPct.toFixed(1)}%;background:var(--sem-emerald);"></span>
        <span data-meter-key="tax-wf-srs" data-meter-w="${srsPct.toFixed(1)}" style="width:${srsPct.toFixed(1)}%;background:var(--sem-srs);"></span>
      </div>
      <ul class="fin-bento-list">
        <li>
          <span class="fin-bento-item-label"><i style="background:var(--sem-equities);"></i>Mandatory CPF &amp; Existing Reliefs</span>
          <span class="fin-bento-item-meta">Base IRAS reliefs before voluntary top-ups</span>
          <strong>${m(baseReliefs)} <small class="fin-bento-share-pill">${Math.round(basePct)}%</small></strong>
        </li>
        <li>
          <span class="fin-bento-item-label"><i style="background:var(--sem-cpf);"></i>Self CPF RSTU${activeFamRstu > 0 ? " + Family RSTU" : ""}</span>
          <span class="fin-bento-item-meta">${activeSelfRstu > 0 || activeFamRstu > 0 ? `Saves ${m((tax.rstuTaxSaved || 0) + (tax.familyRstuTaxSaved || 0), "/yr")}` : `Up to ${m(tax.maxRstu, "/yr")} eligible room`}</span>
          <strong>${m(activeSelfRstu + activeFamRstu)} <small class="fin-bento-share-pill">${Math.round(selfRstuPct + famRstuPct)}%</small></strong>
        </li>
        <li>
          <span class="fin-bento-item-label"><i style="background:var(--sem-srs);"></i>SRS Contribution</span>
          <span class="fin-bento-item-meta">${activeSrs > 0 ? `Locked until age ${tax.srsLockInAge}` : `Up to ${m(tax.maxSrsAfterRstu, "/yr")} after RSTU`}</span>
          <strong>${m(activeSrs)} <small class="fin-bento-share-pill">${Math.round(srsPct)}%</small></strong>
        </li>
      </ul>
    </article>
    <div class="family-rstu-bar">
      <div class="family-rstu-copy">
        <strong>Spouse / Parents CPF Cash Top-Up (Family RSTU · Separate $8,000/yr Cap)</strong>
        <p>${
          tax.familyRstuPlanned > 0
            ? `Claiming <strong>${m(tax.eligibleFamilyRstu, "/yr")}</strong> family RSTU — saving an extra <strong>${m(tax.familyRstuTaxSaved, "/yr")}</strong> in IRAS tax on top of your own SA top-up.`
            : tax.potentialFamilyRstuTaxSaved > 0
              ? `Topping up a loved one’s CPF SA/RA unlocks up to <strong>${m(tax.maxFamilyRstuRoom, "/yr")}</strong> additional IRAS relief (saves <strong>${m(tax.potentialFamilyRstuTaxSaved, "/yr")}</strong> at ${marginalPct}).`
              : "Up to $8,000/yr separate IRAS tax relief when topping up a spouse, parent, or grandparent’s CPF SA/RA (subject to $80k personal relief cap)."
        }</p>
      </div>
      <div class="family-rstu-actions">
        ${
          tax.familyRstuPlanned > 0
            ? `<button type="button" class="fin-action-chip" data-apply-family-rstu="0">Clear family RSTU</button>`
            : tax.maxFamilyRstuRoom > 0
              ? `<button type="button" class="fin-action-chip" data-apply-family-rstu="${Math.round(tax.maxFamilyRstuRoom)}">Simulate +${m(tax.maxFamilyRstuRoom, "/yr")}</button>`
              : ""
        }
      </div>
    </div>
    ${(() => {
      const srsStartAge = tax.srsWithdrawalStartAge ?? tax.srsLockInAge;
      const srsZeroTaxCap =
        tax.srsZeroTaxCap || RetirementModel.C.srsSoftCapAt63;
      const srsZeroTaxCapCompact = compactMoney(srsZeroTaxCap);
      const srsCapFillPct = Math.min(
        100,
        Math.round((tax.srsProjectedAt63 / Math.max(1, srsZeroTaxCap)) * 100),
      );
      const srsBarTone =
        tax.srsTrapStatus === "balloon-trap"
          ? "is-danger"
          : tax.srsTrapStatus === "near-cap"
            ? "is-warn"
            : "is-srs";
      return `<div class="srs-trap-panel is-${tax.srsTrapStatus || "safe"}" role="region" aria-label="Tap 2 SRS Mechanics and Age-${srsStartAge} Ballooning Trap Guardrail">
      <div class="srs-trap-head">
        <div class="srs-trap-copy">
          <strong>Tap 2 (SRS) Mechanics &amp; Age-${srsStartAge} Ballooning Guardrail</strong>
          <p>${tax.srsTrapGuidance}</p>
        </div>
        <span class="status-pill ${tax.srsTrapTone || (tax.srsTrapStatus === "balloon-trap" ? "is-danger" : tax.srsTrapStatus === "near-cap" ? "is-warn" : "is-info")}">${tax.srsTrapHeadline}</span>
      </div>
      <div class="tap-progress-wrap">
        <div class="tap-progress-meta">
          <span>Projected age-${srsStartAge} pot vs ${srsZeroTaxCapCompact} $0-tax ceiling</span>
          <strong>${srsCapFillPct}%</strong>
        </div>
        <div class="tap-progress-track" role="progressbar" aria-valuenow="${srsCapFillPct}" aria-valuemin="0" aria-valuemax="100" aria-label="Projected SRS pot vs $0-tax ceiling">
          <span class="tap-progress-fill ${srsBarTone}" data-meter-key="tax-srs-cap-bar" data-meter-w="${srsCapFillPct}" style="width:${srsCapFillPct}%"></span>
        </div>
      </div>
      <dl class="tax-metrics-grid srs-trap-metrics">
        <div class="tax-metric-box">
          <dt>Projected SRS at Age ${srsStartAge}</dt>
          <dd>${m(tax.srsProjectedAt63, "", "tax-srs-proj63")}</dd>
          <small>${tax.srsProjectedAt63 > 0 ? `${((tax.srsReturnRate ?? 0) * 100).toFixed(2).replace(/\.00$/, "")}% p.a. (${tax.srsInvestedIn === "cash" ? "idle cash" : tax.srsInvestedIn === "ssb" ? "SSB" : tax.srsInvestedIn === "balanced" ? "60/40" : "Global ETFs"}) · ${m(tax.srsBalanceToday)} now + ${m(tax.srsAnnualPlanned, "/yr")}` : `$0 balance · $0/yr planned (${((tax.srsReturnRate ?? 0) * 100).toFixed(2).replace(/\.00$/, "")}% ${tax.srsInvestedIn === "cash" ? "idle cash" : tax.srsInvestedIn === "ssb" ? "SSB" : tax.srsInvestedIn === "balanced" ? "60/40" : "Global ETFs"} assumed)`}</small>
        </div>
        <div class="tax-metric-box">
          <dt>10-Yr Drawdown (${srsStartAge}–${srsStartAge + 10})</dt>
          <dd>${m(tax.srsTenYearAnnualDraw, "/yr", "tax-srs-draw")}</dd>
          <small>${tax.srsProjectedAt63 > 0 ? `${m(tax.srsTenYearMonthlyDraw, "/mo")} nominal · Tax-free ≤ $40k/yr` : `Up to $40,000/yr ($3,333/mo) tax-free at ${srsZeroTaxCapCompact} pot`}</small>
        </div>
        <div class="tax-metric-box">
          <dt>Safe Annual Pace to ${srsZeroTaxCapCompact}</dt>
          <dd>${m(tax.srsMaxSafeAnnualTo400k, "/yr", "tax-srs-safe-pace")}</dd>
          <small>${tax.srsFullCapProjectedAt63 > tax.srsTrapFloorAt63 && tax.srsMaxSafeAnnualTo400k < 15250 ? `Over ${tax.srsYearsToLockIn ?? Math.max(0, srsStartAge - 35)} yrs @ ${((tax.srsReturnRate ?? 0) * 100).toFixed(2).replace(/\.00$/, "")}% · $15.3k/yr max → ${compactMoney(tax.srsFullCapProjectedAt63)} pot` : `Statutory cap $15,300/yr · Direct excess to brokerage`}</small>
        </div>
        <div class="tax-metric-box">
          <dt>Est. Withdrawal Tax (50% Rule)</dt>
          <dd>${m(tax.srsWithdrawalTaxAt63?.annualTax || 0, "/yr", "tax-srs-wdtax")}</dd>
          <small>${tax.srsProjectedAt63 > 0 ? `50% taxable (${m(tax.srsTaxableAnnualAt63, "/yr")} vs $20k IRAS 0% threshold)` : `50% taxable · $0 tax when draw ≤ $40k/yr ($20k chargeable)`}</small>
        </div>
      </dl>
    </div>`;
    })()}
    <div class="srs-callout-bar" role="note">
      ${ICONS.warnTiny}
      <span>${tax.srsIdleWarning}</span>
    </div>
  </section>`;
}

function getCashItemTags(item) {
  const tags = [];
  const reqText =
    `${item.requirements || ""} ${item.rateDetail || ""}`.toLowerCase();
  if (
    reqText.includes("srs") ||
    item.category === "gov" ||
    item.category === "fd-mmf"
  ) {
    tags.push({ key: "srs", label: "SRS Eligible" });
  }
  if (
    item.protectionTone === "good" ||
    item.protectionTone === "gov" ||
    item.protectionTone === "sdic"
  ) {
    tags.push({
      key: "safe",
      label:
        item.category === "gov" || item.protectionTone === "gov"
          ? "SG Gov Backed"
          : "SDIC $100k",
    });
  }
  if (
    (item.liquidity || "").toLowerCase().includes("t+0") ||
    item.category === "hysa"
  ) {
    tags.push({ key: "t0", label: "Same-Day T+0" });
  }
  return tags;
}

function buildCashCardsMarkup(
  cp,
  filterKey = "all",
  entering = false,
  searchQuery = "",
  tagFilter = "all",
) {
  const items = cp?.catalog?.items || [];
  const q = String(searchQuery || "")
    .trim()
    .toLowerCase();
  const visibleItems = items.filter((it) => {
    if (filterKey !== "all" && it.category !== filterKey) return false;
    const itemTags = getCashItemTags(it);
    if (tagFilter !== "all" && !itemTags.some((t) => t.key === tagFilter)) {
      return false;
    }
    if (q) {
      const hay = [
        it.name,
        it.provider,
        it.categoryLabel,
        it.rateHeadline,
        it.protection,
        it.requirements,
        it.liquidity,
        ...itemTags.map((t) => t.label),
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (!visibleItems.length) {
    return html`<div class="cash-empty-state card-surface" role="status">
      <p>No cash parking mediums match <strong>"${q || tagFilter}"</strong>.</p>
      <button
        type="button"
        class="button button-small fin-pill-btn"
        data-cash-reset-filters
      >
        Reset search &amp; tags
      </button>
    </div>`;
  }

  return html`<div class="cash-cards-grid">
    ${visibleItems.map((item, idx) => {
      const tiers = Array.isArray(item.rateTiers) ? item.rateTiers : [];
      const tierRows = tiers.length
        ? html`<div class="cash-rate-rows">
            ${tiers.map((t) =>
              raw(
                html`<div class="cash-rate-row${t.tone ? ` is-${t.tone}` : ""}">
                  <span class="cash-rate-label">${t.label}</span>
                  <strong class="cash-rate-fig">${t.value}</strong>
                </div>`,
              ),
            )}
          </div>`
        : html`<strong class="cash-rate-val">${item.rateHeadline}</strong>`;
      const metaRow =
        item.metaBadge || item.syncBadge
          ? html`<div class="cash-rate-meta">
              ${item.metaBadge ? raw(html`<span class="cash-tranche-tag">${item.metaBadge}</span>`) : raw("<span></span>")}
              ${item.syncBadge ? raw(html`<span class="cash-sync-tag">${item.syncBadge}</span>`) : ""}
            </div>`
          : "";

      return raw(
        html`<a
          class="cash-card card-surface${entering ? " is-entering" : ""}"
          style="--stagger:${Math.min(idx, 6)}"
          href="${item.url}"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="${item.name} — ${item.rateHeadline}, ${item.capLabel}. Opens ${item.urlDomain} in a new tab"
        >
          <div class="cash-card-top">
            <span class="cash-cat-tag">${item.categoryLabel}</span>
            <span class="cash-safety-pill is-${item.protectionTone}"
              >${item.protection}</span
            >
          </div>
          <div class="cash-card-title">
            <h3>${item.name}</h3>
            <span class="cash-provider">${item.provider}</span>
          </div>
          <div class="cash-rate-box">
            ${raw(metaRow)} ${raw(tierRows)}
            <small class="cash-rate-note">${item.rateDetail}</small>
          </div>
          ${
            item.rateContext
              ? raw(
                  (() => {
                    const rc = item.rateContext;
                    const bars = rc.recent6 || [];
                    const minB = Math.min(
                      ...bars.map((b) => b.rate),
                      rc.yr1.min || 0,
                    );
                    const maxB = Math.max(...bars.map((b) => b.rate), 0.1);
                    const spanB = Math.max(0.25, maxB - minB * 0.88);
                    const minAvgPos = Math.max(
                      4,
                      Math.min(
                        96,
                        Math.round(
                          ((rc.yr1.avg - rc.yr1.min) /
                            Math.max(0.01, rc.yr1.max - rc.yr1.min)) *
                            100,
                        ),
                      ),
                    );
                    return html`<div class="cash-hist-box">
                      <div class="cash-hist-head">
                        <span class="cash-hist-verdict is-${rc.tone}"
                          >${rc.verdict}</span
                        >
                        ${rc.prevLabel ? raw(html`<span class="cash-hist-delta ${rc.deltaPrev >= 0 ? "is-up" : "is-down"}">${rc.deltaText} ${rc.prevLabel}</span>`) : ""}
                      </div>
                      <div class="cash-hist-range">
                        <div class="cash-hist-range-labels">
                          <span>12M low ${rc.yr1.min.toFixed(2)}%</span>
                          <span>12M avg ${rc.yr1.avg.toFixed(2)}%</span>
                          <span>high ${rc.yr1.max.toFixed(2)}%</span>
                        </div>
                        <div class="cash-hist-track" aria-hidden="true">
                          <span
                            class="cash-hist-avg-mark"
                            style="left:${minAvgPos}%"
                            title="12M avg"
                          ></span>
                          <span
                            class="cash-hist-dot"
                            style="left:${rc.yr1.posPct}%"
                          ></span>
                        </div>
                        ${rc.longTerm ? raw(html`<div class="cash-hist-long">${rc.longTerm.label}: ${rc.longTerm.min.toFixed(2)}%–${rc.longTerm.max.toFixed(2)}% (avg ${rc.longTerm.avg.toFixed(2)}% · ${rc.longTerm.pctText || rc.longTerm.percentile + "th pct"})</div>`) : ""}
                      </div>
                      ${
                        bars.length
                          ? raw(
                              html`<div
                                class="cash-hist-spark"
                                role="group"
                                aria-label="Last ${bars.length} tranches"
                              >
                                ${bars.map((b, bi) => {
                                  const hPct = Math.max(
                                    22,
                                    Math.min(
                                      100,
                                      Math.round(
                                        ((b.rate - minB * 0.88) / spanB) * 100,
                                      ),
                                    ),
                                  );
                                  const isCur = bi === bars.length - 1;
                                  return raw(
                                    html`<div
                                      class="cash-spark-col${isCur ? " is-current" : ""}"
                                      title="${b.code}: ${b.rate.toFixed(2)}%"
                                    >
                                      <span class="cash-spark-val"
                                        >${b.rate.toFixed(2)}</span
                                      >
                                      <span class="cash-spark-bar-wrap"
                                        ><span
                                          class="cash-spark-bar"
                                          style="height:${hPct}%"
                                        ></span
                                      ></span>
                                      <span class="cash-spark-lbl"
                                        >${b.label}</span
                                      >
                                    </div>`,
                                  );
                                })}
                              </div>`,
                            )
                          : ""
                      }
                      <p class="cash-hist-action">${rc.action}</p>
                    </div>`;
                  })(),
                )
              : ""
          }
          <div
            class="cash-card-tags"
            role="group"
            aria-label="Vehicle attributes"
          >
            ${getCashItemTags(item).map((t) =>
              raw(html`<span class="ui-tag is-${t.key}">${t.label}</span>`),
            )}
          </div>
          <dl class="cash-specs">
            <div>
              <dt>Limit / Cap</dt>
              <dd>${item.capLabel}</dd>
            </div>
            <div>
              <dt>Liquidity</dt>
              <dd>${item.liquidity}</dd>
            </div>
          </dl>
          <p class="cash-req">${item.requirements}</p>
          <div class="cash-card-foot">
            <span>Verify live rates</span>
            <span class="cash-domain-link">${item.urlDomain} ↗</span>
          </div>
        </a>`,
      );
    })}
  </div>`;
}

function buildCashAccountReadoutHTML(acc) {
  if (!acc) return "";
  const isUncapped = acc.bonusCap <= 0;
  let breakdownStr = "";
  let badgeTone = "info";
  let badgeDetail = `${m(acc.monthlyInterest, "/mo")} · ${m(acc.annualInterest, "/yr")}`;

  if (acc.hasOverflow) {
    breakdownStr = `First <strong>${m(acc.tier1Balance)}</strong> @ <strong>${acc.bonusRatePct.toFixed(2)}%</strong> (${m(acc.tier1AnnualInterest, "/yr")}) + <strong class="is-overflow-text">${m(acc.overflowBalance)} excess @ ${acc.baseRatePct.toFixed(2)}%</strong> (${m(acc.overflowAnnualInterest, "/yr")})`;
    badgeTone = "warn";
    badgeDetail = `${m(acc.monthlyInterest, "/mo")} · −${acc.rateDragPct.toFixed(2)}% drag`;
  } else if (!isUncapped) {
    const roomLeft = Math.max(0, acc.bonusCap - acc.balance);
    breakdownStr = `Within ${m(acc.bonusCap)} bonus cap @ <strong>${acc.bonusRatePct.toFixed(2)}%</strong> (${m(roomLeft)} cap room left)`;
    badgeTone = "good";
  } else if (acc.sovereignBacked) {
    breakdownStr = `MAS Sovereign (${acc.preset === "ssb" ? "$200k SSB limit" : "no cap"}) @ <strong>${acc.bonusRatePct.toFixed(2)}%</strong> p.a.`;
    badgeTone = "good";
  } else {
    breakdownStr = `Flat / uncapped yield @ <strong>${acc.bonusRatePct.toFixed(2)}%</strong> p.a.`;
    badgeTone = "info";
  }

  return `<span class="cash-acc-tier-formula">${breakdownStr}</span>
    <span class="cash-acc-badge is-${badgeTone}"><strong>${acc.effectiveRatePct.toFixed(2)}% EIR</strong> · ${badgeDetail}</span>`;
}

function buildCashAccountsSummaryHTML(bd) {
  if (!bd) return "";
  const hasSweepableOverflow =
    bd.totalOverflowBalance > 0 && Math.round(bd.sweepAnnualGain) > 0;
  const hasSdicWarn = bd.sdicOverflowTotal > 0;
  return html` <div class="cash-acc-kpi">
      <span>Total Cash &amp; SSB</span>
      <strong>${raw(m(bd.totalBalance))}</strong>
      <small
        >${bd.accountCount} account${bd.accountCount === 1 ? "" : "s"} synced to
        plan</small
      >
    </div>
    <div class="cash-acc-kpi">
      <span>Blended Effective Yield</span>
      <strong class="${hasSweepableOverflow ? "is-amber" : "is-emerald"}"
        >${bd.effectiveRatePct.toFixed(2)}% EIR</strong
      >
      <small
        >${hasSweepableOverflow ? raw(html`Dragged down by ${raw(m(bd.totalOverflowBalance))} over cap`) : "Compounds cash bucket in FIRE plan"}</small
      >
    </div>
    <div class="cash-acc-kpi">
      <span>Passive Cash Interest</span>
      <strong>${raw(m(bd.totalMonthlyInterest, "/mo"))}</strong>
      <small
        >${raw(m(bd.totalAnnualInterest, "/yr"))} total annual interest</small
      >
    </div>
    <div class="cash-acc-kpi">
      <span>Bonus Cap &amp; SDIC Status</span>
      <strong
        class="${hasSweepableOverflow || hasSdicWarn ? "is-amber" : "is-emerald"}"
        >${
          hasSweepableOverflow
            ? raw(html`${raw(m(bd.totalOverflowBalance))} over cap`)
            : hasSdicWarn
              ? raw(html`${raw(m(bd.sdicOverflowTotal))} over SDIC`)
              : "Within all caps ✓"
        }</strong
      >
      <small
        >${
          hasSweepableOverflow
            ? raw(
                html`Excess earns ${bd.overflowAvgBaseRatePct.toFixed(2)}% ·
                Sweep adds +${raw(m(bd.sweepAnnualGain, "/yr"))}`,
              )
            : hasSdicWarn
              ? `Exceeds $100k/bank in ${bd.sdicExceededBanks.map((b) => b.bankLabel).join(", ")}`
              : "All accounts within bonus & $100k SDIC caps"
        }</small
      >
    </div>`;
}

function buildCashAccountsAlertsHTML(bd) {
  if (!bd) return "";
  const parts = [];
  if (bd.totalOverflowBalance > 0 && Math.round(bd.sweepAnnualGain) > 0) {
    const overList = bd.accounts
      .filter((a) => a.hasOverflow && (a.potentialOverflowGainAnnual || 0) > 0)
      .map(
        (a) =>
          html`<strong>${a.name}</strong> has
            <strong>${raw(m(a.overflowBalance))}</strong> above its
            ${raw(m(a.bonusCap))} cap earning
            <strong>${a.baseRatePct.toFixed(2)}%</strong> (dragging account EIR
            from ${a.bonusRatePct.toFixed(2)}% down to
            <strong>${a.effectiveRatePct.toFixed(2)}%</strong>)`,
      )
      .join("; ");
    parts.push(
      html`<div class="cash-acc-alert is-warn" role="status">
        <div class="cash-acc-alert-copy">
          <strong
            >Bonus Cap Overflow Detected (${raw(m(bd.totalOverflowBalance))}
            earning ${bd.overflowAvgBaseRatePct.toFixed(2)}% base):</strong
          >
          <span
            >${raw(overList)}. Sweeping the overflow into MAS SSB / T-Bills
            (${bd.ssb10YrPct.toFixed(2)}%) lifts your blended cash EIR to
            <strong>${bd.sweptEffectiveRatePct.toFixed(2)}%</strong> (<strong
              >+${raw(m(bd.sweepAnnualGain, "/yr"))}</strong
            >
            extra interest).</span
          >
        </div>
        ${
          bd.sweepAnnualGain > 0
            ? raw(
                html`<button
                  type="button"
                  class="button button-small button-accent cash-acc-sweep-btn"
                  data-cash-acc-sweep
                >
                  Sweep ${raw(m(bd.totalOverflowBalance))} overflow to MAS SSB
                  (+${raw(m(bd.sweepAnnualGain, "/yr"))}) →
                </button>`,
              )
            : ""
        }
      </div>`,
    );
  }
  if (bd.sdicOverflowTotal > 0) {
    const sdicList = bd.sdicExceededBanks
      .map(
        (b) =>
          html`<strong>${b.bankLabel}</strong> combined deposits
            (<strong>${raw(m(b.balance))}</strong>) exceed the $100,000 SDIC
            insured limit by <strong>${raw(m(b.uninsured))}</strong>`,
      )
      .join("; ");
    parts.push(
      html`<div class="cash-acc-alert is-info" role="status">
        <div class="cash-acc-alert-copy">
          <strong>Per-Bank $100k SDIC Coverage Notice:</strong>
          <span
            >${raw(sdicList)}. Note that DBS and POSB share a single $100,000
            SDIC limit.</span
          >
        </div>
      </div>`,
    );
  }
  if (bd.ssbTotal > bd.ssbCap) {
    parts.push(
      html`<div class="cash-acc-alert is-warn" role="status">
        <div class="cash-acc-alert-copy">
          <strong>MAS $200,000 Individual SSB Limit Exceeded:</strong>
          <span
            >Your SSB rows total
            <strong>${raw(m(bd.ssbTotal))}</strong> (${raw(m(bd.ssbOverflow))}
            above the $200,000 MAS individual holding cap). Route excess into
            6-Month MAS T-Bills or a secondary bank.</span
          >
        </div>
      </div>`,
    );
  }
  return parts.join("");
}

function buildCashAccountsEditorHTML(cp, context = "page") {
  if (!cp) return "";
  const active = Boolean(cp.cashAccountsActive);
  const bd = cp.cashBreakdown;
  const isQe = context === "qe";
  const presets = RetirementModel.CASH_ACCOUNT_PRESETS || [];
  const quickPresets = [
    { key: "dbs-multiplier", label: "+ DBS Multiplier" },
    { key: "ocbc-360", label: "+ OCBC 360" },
    { key: "uob-one", label: "+ UOB One" },
    { key: "maribank", label: "+ MariBank" },
    { key: "gxs", label: "+ GXS" },
    { key: "ssb", label: "+ MAS SSB" },
    { key: "tbills", label: "+ 6M T-Bills" },
    { key: "custom", label: "+ Custom Bank" },
  ];

  const presetOptions = (selectedKey) =>
    presets
      .map(
        (pr) =>
          html`<option
            value="${pr.key}"
            ${raw(pr.key === selectedKey ? " selected" : "")}
          >
            ${pr.name || pr.label}
          </option>`,
      )
      .join("");

  return `<div class="cash-acc-editor" data-cash-acc-context="${context}">
    <div class="cash-acc-mode-bar">
      <div class="cash-acc-mode-copy">
        <h3>${isQe ? "SSB / T-Bills / High-Yield Cash Accounts" : "Cash and SSB accounts"}</h3>
        <p>${
          isQe
            ? "Split your cash across banks &amp; SSBs to calculate your exact tiered effective interest rate (EIR) and $100k bonus caps."
            : "Model multiple bank accounts with realistic bonus caps (e.g. first $100k in DBS Multiplier @ 2.0% + excess @ 0.05% base). Your blended effective interest rate (EIR) feeds directly into your retirement trajectory and Tap 4 income."
        }</p>
      </div>
      <div class="fin-segmented-tabs cash-acc-mode-tabs" data-seg-idx="${active ? 1 : 0}" style="--seg-idx:${active ? 1 : 0};--seg-count:2" role="group" aria-label="Cash bucket entry mode">
        <button type="button" class="fin-seg-tab${!active ? " is-active" : ""}" data-cash-acc-mode="single" aria-pressed="${!active}">Single figure</button>
        <button type="button" class="fin-seg-tab${active ? " is-active" : ""}" data-cash-acc-mode="itemized" aria-pressed="${active}">By account${active && bd ? ` (${bd.accountCount})` : ""}</button>
      </div>
    </div>
    ${
      !active
        ? `<div class="cash-acc-single-prompt">
            <div class="cash-acc-single-copy">
              <span>Currently using a single cash / SSB figure (<strong>${m(cp.currentCash)}</strong>). Have multiple accounts or balances above a bank’s $100,000 bonus cap? Break them down to compute your exact tiered EIR and test 1-click overflow sweeps.</span>
            </div>
            <div class="cash-acc-quick-bar">
              <button type="button" class="button button-small button-accent" data-cash-acc-add="smart">+ Add account</button>
              <button type="button" class="button button-small" data-cash-acc-mode="itemized">Break down accounts →</button>
              ${quickPresets
                .map(
                  (qp) =>
                    `<button type="button" class="cash-acc-chip" data-cash-acc-add="${qp.key}">${qp.label}</button>`,
                )
                .join("")}
            </div>
          </div>`
        : `<div class="cash-acc-summary-strip" id="cash-acc-summary-${context}">
            ${buildCashAccountsSummaryHTML(bd)}
          </div>
          <div class="cash-acc-alerts-wrap" id="cash-acc-alerts-${context}">
            ${buildCashAccountsAlertsHTML(bd)}
          </div>
          <div class="cash-acc-toolbar">
            <span class="cash-acc-toolbar-meta" id="cash-acc-count-${context}"><strong>${bd.accountCount}</strong> ${bd.accountCount === 1 ? "account" : "accounts"} · Total <strong>${m(bd.totalBalance)}</strong></span>
            <button type="button" class="button button-small button-accent" data-cash-acc-add="smart">+ Add account</button>
          </div>
          <div class="cash-acc-list" role="region" aria-label="Itemized bank and SSB accounts">
            ${bd.accounts
              .map((acc, idx) => {
                const isFlatVehicle =
                  acc.preset === "ssb" ||
                  acc.preset === "tbills" ||
                  acc.preset === "mmf";
                const isCustomPreset = acc.preset === "custom";
                return html`<div
                  class="cash-acc-row${acc.hasOverflow ? " is-overflow" : ""}"
                  data-cash-acc-row="${idx}"
                >
                  <div
                    class="cash-acc-row-top${isCustomPreset ? " is-custom-preset" : ""}"
                  >
                    <div class="cash-acc-col is-preset">
                      <label for="cash-acc-preset-${context}-${idx}"
                        >Bank / Vehicle</label
                      >
                      <div class="input-wrap select-wrap">
                        <select
                          id="cash-acc-preset-${context}-${idx}"
                          data-cash-acc-field="preset"
                          data-cash-acc-idx="${idx}"
                        >
                          ${raw(presetOptions(acc.preset))}
                        </select>
                      </div>
                    </div>
                    ${
                      isCustomPreset
                        ? raw(
                            html`<div class="cash-acc-col is-name">
                              <label for="cash-acc-name-${context}-${idx}"
                                >Bank / Account Name</label
                              >
                              <div class="input-wrap">
                                <input
                                  id="cash-acc-name-${context}-${idx}"
                                  type="text"
                                  maxlength="50"
                                  data-cash-acc-field="name"
                                  data-cash-acc-idx="${idx}"
                                  value="${acc.name}"
                                  placeholder="e.g. HSBC / CIMB"
                                />
                              </div>
                            </div>`,
                          )
                        : ""
                    }
                    <div class="cash-acc-col is-balance">
                      <label for="cash-acc-bal-${context}-${idx}"
                        >Balance ($)</label
                      >
                      <div class="input-wrap">
                        <span>$</span>
                        <input
                          id="cash-acc-bal-${context}-${idx}"
                          type="number"
                          min="0"
                          max="100000000"
                          step="any"
                          inputmode="decimal"
                          data-cash-acc-field="balance"
                          data-cash-acc-idx="${idx}"
                          value="${acc.balance}"
                        />
                      </div>
                    </div>
                    <div class="cash-acc-col is-remove">
                      <button
                        type="button"
                        class="exp-remove-btn cash-acc-remove-btn"
                        data-cash-acc-remove="${idx}"
                        aria-label="Remove ${acc.name}"
                        title="Remove account"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <div
                    class="cash-acc-row-rules${isFlatVehicle ? " is-flat" : ""}"
                  >
                    ${
                      isFlatVehicle
                        ? raw(
                            html`<div class="cash-acc-col is-rate">
                                <label for="cash-acc-bonus-${context}-${idx}"
                                  >${acc.preset === "ssb" ? "10-Yr Avg Yield" : "Annual Yield"}</label
                                >
                                <div class="input-wrap">
                                  <input
                                    id="cash-acc-bonus-${context}-${idx}"
                                    type="number"
                                    min="0"
                                    max="20"
                                    step="0.05"
                                    inputmode="decimal"
                                    data-cash-acc-field="bonusRatePct"
                                    data-cash-acc-idx="${idx}"
                                    value="${acc.bonusRatePct}"
                                  />
                                  <span>%</span>
                                </div>
                              </div>
                              <div class="cash-acc-flat-meta">
                                <span
                                  >${
                                    acc.preset === "ssb"
                                      ? "AAA Singapore Gov · $200,000 MAS individual holding limit across all SSB tranches"
                                      : acc.preset === "tbills"
                                        ? "AAA Singapore Gov · No individual holding limit · 6M / 1Y auction cut-off"
                                        : "Institutional SGD Money Market Fund · Uncapped (non-SDIC custodian)"
                                  }</span
                                >
                              </div>`,
                          )
                        : raw(
                            html`<div class="cash-acc-col is-cap">
                                <label
                                  for="cash-acc-cap-${context}-${idx}"
                                  title="Max balance earning the bonus rate (enter 0 for uncapped)"
                                  >Bonus Cap ($)</label
                                >
                                <div class="input-wrap">
                                  <span>$</span>
                                  <input
                                    id="cash-acc-cap-${context}-${idx}"
                                    type="number"
                                    min="0"
                                    max="100000000"
                                    step="1000"
                                    inputmode="numeric"
                                    data-cash-acc-field="bonusCap"
                                    data-cash-acc-idx="${idx}"
                                    value="${acc.bonusCap}"
                                    placeholder="0 = none"
                                  />
                                </div>
                              </div>
                              <div class="cash-acc-col is-rate">
                                <label
                                  for="cash-acc-bonus-${context}-${idx}"
                                  title="Interest rate on balance up to the bonus cap"
                                  >Rate up to Cap</label
                                >
                                <div class="input-wrap">
                                  <input
                                    id="cash-acc-bonus-${context}-${idx}"
                                    type="number"
                                    min="0"
                                    max="20"
                                    step="0.05"
                                    inputmode="decimal"
                                    data-cash-acc-field="bonusRatePct"
                                    data-cash-acc-idx="${idx}"
                                    value="${acc.bonusRatePct}"
                                  />
                                  <span>%</span>
                                </div>
                              </div>
                              <div class="cash-acc-col is-rate">
                                <label
                                  for="cash-acc-base-${context}-${idx}"
                                  title="Base interest rate on any excess balance above the bonus cap"
                                  >Rate &gt; Cap</label
                                >
                                <div class="input-wrap">
                                  <input
                                    id="cash-acc-base-${context}-${idx}"
                                    type="number"
                                    min="0"
                                    max="20"
                                    step="0.05"
                                    inputmode="decimal"
                                    data-cash-acc-field="baseRatePct"
                                    data-cash-acc-idx="${idx}"
                                    value="${acc.baseRatePct}"
                                  />
                                  <span>%</span>
                                </div>
                              </div>`,
                          )
                    }
                  </div>
                  <div
                    class="cash-acc-row-readout"
                    data-cash-acc-readout="${idx}"
                  >
                    ${raw(buildCashAccountReadoutHTML(acc))}
                  </div>
                </div>`;
              })
              .join("")}
          </div>
          <div class="cash-acc-quick-bar" role="group" aria-label="Quick-add Singapore bank or sovereign cash account">
            <span class="cash-acc-quick-label">Add account:</span>
            ${quickPresets
              .map(
                (qp) =>
                  `<button type="button" class="cash-acc-chip" data-cash-acc-add="${qp.key}">${qp.label}</button>`,
              )
              .join("")}
          </div>`
    }
  </div>`;
}

function buildCashPlanCardHTML(cp) {
  const bd = cp.cashBreakdown;
  return `<section class="card-surface cash-plan-card" aria-labelledby="cash-layer-title">
    <div class="rules-card-head">
      <div>
        <h2 id="cash-layer-title">Your Cash Buffer &amp; Cap Positioning</h2>
        ${html`<p>${cp.positionNote}</p>`}
      </div>
      ${html`<span class="status-pill is-${cp.positionTone}">${cp.positionHeadline}</span>`}
    </div>

    <dl class="tax-metrics-grid cash-kpi-grid">
      <div class="tax-metric-box">
        <dt>6–12m Emergency Target</dt>
        <dd>${m(cp.emergencyMin, "", "cash-em-min")}–${m(cp.emergencyMax, "", "cash-em-max")}</dd>
        <small>6–12m × ${m(cp.emergencyMonthlyBase, "/mo")} retire budget</small>
      </div>
      <div class="tax-metric-box">
        <dt>Entered SSB / Cash Bucket</dt>
        <dd>${m(cp.currentCash, "", "cash-entered")}</dd>
        <small>${
          cp.cashAccountsActive && bd
            ? `${bd.accountCount} account${bd.accountCount === 1 ? "" : "s"} · <strong>${bd.effectiveRatePct.toFixed(2)}% blended EIR</strong> (~${m(bd.totalMonthlyInterest, "/mo")})`
            : `Target $150,000 SSB after buffer (max ${m(cp.ssbCap)} MAS cap · ${m(cp.sdicCap)} SDIC/bank)`
        }</small>
      </div>
      <div class="tax-metric-box">
        <dt>Monthly Cash / Bond Slice</dt>
        <dd>${m(cp.monthlyCashSlice > 0 ? cp.monthlyCashSlice : 0, "/mo", "cash-monthly-slice")}</dd>
        <small>${
          cp.monthlyCashSaving > 0
            ? `${m(cp.monthlyCashSaving, "/mo")} planned savings + ${m(cp.monthlyBondSlice || 0, "/mo")} bond slice`
            : cp.hasSrs
              ? "Idle SRS earns 0.05% — park in T-Bills/MMFs"
              : "From Allocator SSB / T-Bills target"
        }</small>
      </div>
    </dl>
    <button type="button" class="text-button" data-open-page-cash-accounts aria-controls="cash-accounts">Edit cash accounts</button>

    <div class="cash-ladder-grid" role="group" aria-label="Suggested cash parking waterfall">
      ${cp.tiers
        .map(
          (tier) => `<div class="cash-tier-box">
            <div class="cash-tier-head">
              <strong>${tier.step}</strong>
              <span>${tier.limit}</span>
            </div>
            <div class="cash-tier-val">${m(tier.allocated)} <small>of current cash</small></div>
            <p>${tier.vehicles}</p>
          </div>`,
        )
        .join("")}
    </div>
  </section>`;
}

function syncCashFilterGlider(bar, immediate = false) {
  if (!bar) return;
  const glider = bar.querySelector(".cash-filter-glider");
  const active = bar.querySelector(".cash-filter-btn.is-active");
  if (!glider || !active) return;
  const width = active.offsetWidth;
  const height = active.offsetHeight;
  if (!width || !height) return;
  const left = active.offsetLeft;
  const top = active.offsetTop;
  if (immediate) {
    glider.style.transition = "none";
  }
  glider.style.width = `${width}px`;
  glider.style.height = `${height}px`;
  glider.style.transform = `translate3d(${left}px, ${top}px, 0)`;
  glider.style.opacity = "1";
  if (immediate) {
    void glider.offsetHeight;
    glider.style.transition = "";
  } else if (bar.scrollWidth > bar.clientWidth + 4) {
    active.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }
}

function buildCashParkingSection(
  cp,
  filterKey = "all",
  searchQuery = "",
  tagFilter = "all",
) {
  if (!cp?.catalog) return "";
  const items = cp.catalog.items || [];
  const categories = cp.catalog.categories || [];
  const counts = { all: items.length };
  items.forEach((it) => {
    counts[it.category] = (counts[it.category] || 0) + 1;
  });
  const activeFilter = counts[filterKey] ? filterKey : "all";
  const syncText = cp.masSyncLabel || `Reference · ${cp.asOf}`;
  const tagOptions = [
    { key: "all", label: "All tags" },
    { key: "srs", label: "SRS Eligible" },
    { key: "safe", label: "SDIC / Sovereign" },
    { key: "t0", label: "Same-Day T+0" },
  ];

  return `
    <header class="ember-page-header fin-page-header">
      <div class="fin-header-copy">
        <h1>Cash Parking</h1>
        <p class="fin-page-sub">Compare Singapore cash vehicles, holding limits, and SDIC coverage. Click any card to view live rates on the official provider site.</p>
      </div>
      <div class="ember-header-meta cash-header-sync">
        ${html`<span class="fin-target-pill cash-sync-pill">${syncText}</span>`}
        <button type="button" class="button button-small cash-sync-btn" data-cash-sync title="Check latest SSB tranche &amp; T-Bill auction cut-off">↻ Sync MAS</button>
      </div>
    </header>

    <div class="cash-plan-slot">${buildCashPlanCardHTML(cp)}</div>

    <h2 class="cash-comparison-title">Compare cash products</h2>
    <div class="cash-toolbar">
      <div class="cash-filter-bar" role="group" aria-label="Filter cash parking mediums">
        <span class="cash-filter-glider" aria-hidden="true"></span>
        ${categories
          .map((cat) => {
            const active = cat.key === activeFilter;
            const count = counts[cat.key] || 0;
            return `<button type="button" class="cash-filter-btn${active ? " is-active" : ""}" data-cash-filter="${cat.key}" aria-pressed="${active}">${cat.label} <span class="cash-filter-count">${count}</span></button>`;
          })
          .join("")}
      </div>
      <div class="cash-search-tag-bar">
        <div class="cash-search-wrap">
          <svg class="cash-search-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          ${html`<input type="search" id="cash-search-input" class="cash-search-input" placeholder="Search SSB, MariBank, UOB, SRS, T+0…" aria-label="Search cash parking vehicles" value="${searchQuery}" />`}
          <button type="button" class="cash-search-clear" data-cash-search-clear aria-label="Clear search" ${searchQuery ? "" : "hidden"}>×</button>
        </div>
        <div class="cash-tag-bar" role="group" aria-label="Filter by vehicle attribute tag">
          ${tagOptions
            .map(
              (t) =>
                `<button type="button" class="cash-tag-chip${tagFilter === t.key ? " is-active" : ""}" data-cash-tag="${t.key}" aria-pressed="${tagFilter === t.key}">${t.label}</button>`,
            )
            .join("")}
        </div>
      </div>
    </div>

    <div class="cash-cards-wrap">
      ${buildCashCardsMarkup(cp, activeFilter, false, searchQuery, tagFilter)}
    </div>

    <details class="cash-accounts-disclosure card-surface" id="cash-accounts">
      <summary class="planner-summary">Edit cash accounts</summary>
      <div class="cash-accounts-page-slot">${buildCashAccountsEditorHTML(cp, "page")}</div>
    </details>

    <div class="cash-rules-note" role="note">
      <strong>Key Limit Reminders (${cp.asOf}):</strong>
      <span>SDIC insures eligible SGD deposits up to <b>$100,000 per depositor, per DI Scheme bank</b> (DBS &amp; POSB share one combined $100k limit). MAS Singapore Savings Bonds have a <b>$200,000 individual holding cap</b> across all tranches. Money Market Funds and cash-management portfolios are investment products — <b>not SDIC-insured</b>.</span>
    </div>
  `;
}

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

function buildAnnuityResultsHTML(annuityModel) {
  if (!annuityModel) return "";
  const nominalIrr = Number(annuityModel.impliedAnnualIrrPct || 0);
  const realIrr = Number(annuityModel.realAnnualIrrPct || 0);
  const participatingLine =
    annuityModel.startingMonthlyPayout > annuityModel.quotedMonthlyPayout
      ? ` · +${m(Math.round(annuityModel.startingMonthlyPayout - annuityModel.quotedMonthlyPayout), "/mo")} non-guaranteed in Year 1`
      : "";
  const irrStr =
    annuityModel.impliedAnnualIrrPct <= -99
      ? "−100%"
      : `${annuityModel.impliedAnnualIrrPct >= 0 ? "+" : ""}${annuityModel.impliedAnnualIrrPct.toFixed(2)}% p.a.`;
  const irrTone =
    annuityModel.impliedAnnualIrrPct >= 4.0
      ? "is-emerald"
      : annuityModel.impliedAnnualIrrPct < 2.5
        ? "is-danger"
        : "is-amber";
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
        <p class="div-payout-sub">Nominal IRR: <strong>${nominalIrr >= 0 ? "+" : ""}${nominalIrr.toFixed(2)}%</strong> · Real IRR: <strong>${realIrr >= 0 ? "+" : ""}${realIrr.toFixed(2)}%</strong> at ${Number(annuityModel.inflationRatePct || 2.5).toFixed(1)}% inflation</p>
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
                <td class="num-col"><span class="div-rate-badge">${c.ratePct.toFixed(2)}%</span></td>
                <td class="num-col">${m(c.potAtPayoutStart)}</td>
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
        ? `${annuityModel.badge} · ${annuityModel.impliedAnnualIrrPct.toFixed(2)}% IRR`
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
  buildBogleheadSection,
  buildTaxSweetSpotSection,
  buildCashCardsMarkup,
  buildCashAccountReadoutHTML,
  buildCashAccountsSummaryHTML,
  buildCashAccountsAlertsHTML,
  buildCashAccountsEditorHTML,
  buildCashPlanCardHTML,
  syncCashFilterGlider,
  buildCashParkingSection,
  buildDividendResultsHTML,
  buildDividendBenchmarksHTML,
  buildTargetResultsHTML,
  buildTargetBenchmarksHTML,
  buildAnnuityResultsHTML,
  buildAnnuityBenchmarksHTML,
  buildDividendCalculatorSection,
};
