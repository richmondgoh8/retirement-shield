import {
  money,
  m,
  centsHtml,
  compactMoney,
  formatAnnuityIrr,
  html,
  raw,
  ICONS,
} from "./format.js";

function buildBogleheadSection(bogle, includeCpf = true) {
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

const cashProductCategory = (item) =>
  item.category !== "fd-mmf"
    ? item.category
    : item.categoryLabel === "Fixed Deposit"
      ? "fd"
      : "mmf";

function cashProductIsStale(cp, item) {
  const asOf = new Date(`${cp.masAsOfDate}T00:00:00Z`);
  const deadline =
    item?.id === "ssb"
      ? item.metaBadge?.match(/Closes\s+(.+)$/)?.[1]
      : item?.id === "tbills"
        ? item.rateTiers?.find((tier) => tier.label.startsWith("Next 6M"))
            ?.value
        : null;
  const dateMatch = deadline?.match(
    /^(\d{1,2})\s+([A-Za-z]{3})(?:\s+(\d{4}))?$/,
  );
  const month = dateMatch
    ? new Date(`${dateMatch[2]} 1, 2000`).getMonth()
    : null;
  if (!dateMatch || month === null || !Number.isFinite(asOf.getTime()))
    return false;
  const year = Number(dateMatch[3] || asOf.getUTCFullYear());
  const deadlineIso = new Date(Date.UTC(year, month, Number(dateMatch[1])))
    .toISOString()
    .slice(0, 10);
  const todaySg = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return deadlineIso < todaySg;
}

function buildCashFreshnessHTML(cp, item) {
  // Bank reference rates are tracked by month; MAS products expire on their
  // next issue/auction date, not on a generic age-of-data threshold.
  const staticRate = item && item.category !== "gov";
  const asOf = new Date(`${cp.masAsOfDate}T00:00:00Z`);
  const label = staticRate
    ? "Nov 2026"
    : Number.isFinite(asOf.getTime())
      ? asOf.toLocaleDateString("en-SG", {
          day: "numeric",
          month: "short",
          timeZone: "UTC",
        })
      : cp.asOf;
  return html`<span class="cash-rate-date"
    >Rates as of
    ${label}${cashProductIsStale(cp, item) ? raw(' <span class="status-pill is-warn">Newer data available · Sync MAS</span>') : ""}</span
  >`;
}

function buildCashHistoricalDetail(item) {
  if (!item.rateContext) return "";
  const rc = item.rateContext;
  const bars = rc.recent6 || [];
  const minB = Math.min(...bars.map((b) => b.rate), rc.yr1.min);
  const maxB = Math.max(...bars.map((b) => b.rate), rc.yr1.max);
  const spanB = Math.max(0.01, maxB - minB);
  const minAvgPos = Math.max(
    4,
    Math.min(
      96,
      Math.round(
        ((rc.yr1.avg - rc.yr1.min) / Math.max(0.01, rc.yr1.max - rc.yr1.min)) *
          100,
      ),
    ),
  );
  return html`<div class="cash-hist-box">
    <div class="cash-hist-head">
      <span class="cash-hist-verdict is-${rc.tone}"
        >${rc.verdict
          .split(" · ")[0]
          .replace("Strong vs 12M", "Near 12M high")
          .replace(/\bpct\b/g, "percentile")}</span
      >
      ${rc.prevLabel ? raw(html`<span class="cash-hist-delta ${rc.deltaPrev >= 0 ? "is-up" : "is-down"}">${Math.abs(rc.deltaPrev).toFixed(2)} pts ${rc.deltaPrev < 0 ? "below" : "above"} previous ${item.id === "tbills" ? "auction" : "tranche"} (${rc.prevLabel.match(/\(([^)]+)\)/)?.[1] || ""})</span>`) : ""}
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
        <span class="cash-hist-dot" style="left:${rc.yr1.posPct}%"></span>
      </div>
      ${rc.longTerm ? raw(html`<div class="cash-hist-long">${rc.longTerm.label}: ${rc.longTerm.min.toFixed(2)}%–${rc.longTerm.max.toFixed(2)}% (avg ${rc.longTerm.avg.toFixed(2)}% · ${rc.longTerm.pctText?.replace(/\bpct\b/g, "percentile") || rc.longTerm.percentile + "th percentile"})</div>`) : ""}
    </div>
    ${
      bars.length
        ? raw(
            html`<div
              class="cash-hist-spark"
              role="group"
              aria-label="Last ${bars.length} tranches. Current ${bars[bars.length - 1].rate.toFixed(2)} percent. 12-month low ${rc.yr1.min.toFixed(2)} percent, average ${rc.yr1.avg.toFixed(2)} percent, high ${rc.yr1.max.toFixed(2)} percent."
            >
              ${bars.map((b, bi) => {
                const yPct = Math.max(
                  2,
                  Math.min(98, 98 - Math.round(((b.rate - minB) / spanB) * 96)),
                );
                const isCur = bi === bars.length - 1;
                return raw(
                  html`<div
                    class="cash-spark-col${isCur ? " is-current" : ""}"
                    title="${b.code}: ${b.rate.toFixed(2)}%"
                  >
                    <span class="cash-spark-val">${b.rate.toFixed(2)}</span>
                    <span class="cash-spark-plot"
                      ><i style="top:${yPct}%"></i
                    ></span>
                    <span class="cash-spark-lbl">${b.label}</span>
                  </div>`,
                );
              })}
            </div>`,
          )
        : ""
    }
    <p class="cash-hist-action">
      ${rc.action
        .replace(
          "apply now if holding excess cash, then redeem & swap if a future tranche jumps",
          "monthly redemption is available",
        )
        .replace(
          "apply now and swap if rates climb later",
          "monthly redemption is available",
        )
        .replace(
          "stagger across 2–4 fortnightly auctions or place a competitive floor bid",
          "a staggered ladder can span 2–4 fortnightly auctions",
        )
        .replace("Locked 6m to maturity: compare vs", "Compare vs")
        .replace("Locked 6m below 12M avg", "Below the 12M average")
        .replace(" & bid competitively if you want a min yield", "")
        .replace(
          "Check HYSA/MMF liquidity or set a competitive min bid before committing.",
          "",
        )
        .replace(
          "Consider splitting tranches or keeping instant cash in a higher-yielding HYSA while waiting.",
          "",
        )}
    </p>
  </div>`;
}

function buildCashProductDetail(cp, item, layout = "table") {
  const history = buildCashHistoricalDetail(item);
  const extraTags = layout === "table" ? "" : buildCashExtraTags(item);
  return html`<div class="cash-product-detail-body">
    <div class="cash-product-detail-notes">
      ${
        layout === "mobile"
          ? raw(
              html`<p>${item.provider} · ${item.categoryLabel}</p>
                <p>${item.capLabel} · ${item.liquidity}</p>`,
            )
          : ""
      }
      ${extraTags ? raw(html`<div class="cash-product-extra-tags">${raw(extraTags)}</div>`) : ""}
      ${layout !== "table" && item.metaBadge ? raw(html`<p class="cash-product-meta">${item.metaBadge}</p>`) : ""}
      ${
        item.rateTiers?.length
          ? raw(
              html`<dl class="cash-rate-rows">
                ${item.rateTiers
                  .filter((tier) => !tier.label.startsWith("Next 6M"))
                  .map((tier) =>
                    raw(
                      html`<div class="cash-rate-row">
                        <dt>${tier.label}</dt>
                        <dd>${tier.value}</dd>
                      </div>`,
                    ),
                  )}
              </dl>`,
            )
          : ""
      }
      ${
        item.id === "tbills" &&
        item.rateTiers?.some((tier) => tier.label.startsWith("Next 6M"))
          ? raw(
              html`<p class="cash-next-auction">
                <strong>Next auction:</strong>
                ${item.rateTiers.find((tier) => tier.label.startsWith("Next 6M")).value}
              </p>`,
            )
          : ""
      }
      ${
        item.id === "ocbc-360"
          ? ""
          : [item.rateDetail, item.requirements]
              .filter(Boolean)
              .filter((note, index, notes) => notes.indexOf(note) === index)
              .map((note) => raw(html`<p>${note}</p>`))
      }
    </div>
    ${raw(history)}
    ${
      layout !== "card"
        ? raw(
            html`<div class="cash-product-detail-footer">
              ${raw(buildCashFreshnessHTML(cp, item))}
              <a
                href="${item.url}"
                target="_blank"
                rel="noopener noreferrer"
                class="text-button cash-verify"
                aria-label="Verify live rates for ${item.name} (opens in a new tab)"
                >Verify live rates ↗</a
              >
            </div>`,
          )
        : ""
    }
  </div>`;
}

const buildCashExtraTags = (item) =>
  getCashItemTags(item)
    .filter(({ key }) => key !== "safe")
    .map(
      ({ key, label }) => html`<span class="ui-tag is-${key}">${label}</span>`,
    )
    .join("");

function buildCashProductTags(item, table = false) {
  const protection =
    item.category === "gov" || item.protectionTone === "gov"
      ? "SG Gov Backed"
      : item.protection;
  const secondary = getCashItemTags(item).find(({ key }) => key !== "safe");
  return html`<span class="cash-product-tags">
    <span
      class="cash-safety-pill is-${item.protectionTone}"
      title="${item.protection}"
      >${protection}</span
    >
    ${table && secondary ? raw(html`<span class="ui-tag is-${secondary.key}" title="${secondary.label}"><span aria-hidden="true">${secondary.key === "srs" ? "SRS" : "T+0"}</span><span class="sr-only">${secondary.label}</span></span>`) : ""}
  </span>`;
}

const cashRateBasis = {
  ssb: "Coupon / 10Y average",
  tbills: "Auction cut-off",
  "ocbc-360": "Effective interest rate",
  "uob-one": "Effective interest rate",
  "dbs-multiplier": "Interest rate range",
  gxs: "Interest rate range",
  maribank: "Base / bonus interest",
  "trust-bank": "Base / bonus interest",
  "fd-cimb": "Deposit rate range",
  "fd-ocbc": "Promotional deposit rate",
  "fd-uob": "Promotional deposit rate",
  "fullerton-sgd": "Gross yield / net return",
  "lionglobal-mmf": "Yield to maturity / net return",
  "mari-invest": "Yield to maturity / net return",
  "chocolate-finance": "Rate by balance",
  "syfe-cash": "Rate by product",
  "endowus-cash": "Net return range",
  "phillip-mms": "Annualised yield",
};

function cashConditionLabel(item) {
  return item.metaBadge || item.requirements.split(/[.;]/, 1)[0];
}

function buildCashHeadline(item) {
  // Keep every headline verbatim. Highlight the existing qualifier without moving it.
  const parts = item.rateHeadline.split(/(up to )/i);
  return html`<span class="cash-headline-text"
      >${parts.map((part) =>
        /^up to $/i.test(part)
          ? raw(html`<span class="cash-rate-ceiling">${part}</span>`)
          : part,
      )}</span
    ><span class="cash-rate-basis">${cashRateBasis[item.id]}</span>`;
}

function singleCashHeadlineRate(item) {
  const rates = item.rateHeadline.match(/\d+(?:\.\d+)?\s*%/g);
  return rates?.length === 1 ? Number.parseFloat(rates[0]) : null;
}

// Earliest advertised access, with the original liquidity descriptions retained.
const cashLiquidityOrder = [
  ["Instant access", "Instant (Main/Pockets)", "Instant up to $10k/day"],
  ["Same-day up to $30k"],
  [
    "T+1 Flexi / 3–12m locked",
    "T+1 to T+3 business days",
    "Market hours + T+2",
  ],
  ["2–4 working days"],
  ["Monthly exit, no penalty"],
  [
    "3–12m lock-in",
    "6–10m lock-in",
    "6–12m lock-in",
    "Locked to maturity (6m/1y)",
  ],
];

function buildCashCardsMarkup(cp, options) {
  const { filter, search, tag, view, sort, direction, expanded } = options;
  const q = search.trim().toLowerCase();
  const items = (cp?.catalog?.items || []).filter((it) => {
    if (filter !== "all" && cashProductCategory(it) !== filter) return false;
    const tags = getCashItemTags(it);
    if (tag !== "all" && !tags.some((t) => t.key === tag)) return false;
    return [
      it.name,
      it.provider,
      it.categoryLabel,
      it.rateHeadline,
      it.protection,
      it.requirements,
      it.liquidity,
      ...tags.map((t) => t.label),
    ]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });

  if (!items.length) {
    return html`<div class="cash-empty-state card-surface" role="status">
      <p>No products match <strong>"${search.trim() || tag}"</strong>.</p>
      <button type="button" class="button button-small" data-cash-reset-filters>
        Reset filters
      </button>
    </div>`;
  }

  if (sort === "rate") {
    items.sort((a, b) => {
      const left = singleCashHeadlineRate(a);
      const right = singleCashHeadlineRate(b);
      if (left === null) return right === null ? 0 : 1;
      if (right === null) return -1;
      return direction * (left - right);
    });
  } else if (sort === "liquidity") {
    const rank = (item) => {
      const index = cashLiquidityOrder.findIndex((group) =>
        group.includes(item.liquidity),
      );
      return index < 0 ? cashLiquidityOrder.length : index;
    };
    items.sort((a, b) => direction * (rank(a) - rank(b)));
  }

  if (view === "cards") {
    return html`<div class="cash-product-grid">
      ${items.map((item) =>
        raw(
          html`<article class="card-surface cash-product-card">
            <h3>${item.name}</h3>
            <p class="cash-product-issuer">${item.provider}</p>
            <div class="cash-product-rate">${raw(buildCashHeadline(item))}</div>
            ${raw(buildCashProductTags(item))}
            <p class="cash-product-secondary">
              ${item.liquidity} · ${item.capLabel}
            </p>
            ${raw(buildCashFreshnessHTML(cp, item))}
            <div class="cash-card-actions">
              <a
                href="${item.url}"
                target="_blank"
                rel="noopener noreferrer"
                class="text-button cash-verify cash-card-verify"
                aria-label="Verify live rates for ${item.name} (opens in a new tab)"
                >Verify live rates ↗</a
              >
              <button
                type="button"
                class="text-button cash-product-toggle cash-card-detail-toggle"
                data-cash-product="${item.id}"
                aria-expanded="${expanded.has(item.id)}"
                aria-controls="cash-product-${item.id}"
              >
                <span class="cash-detail-label"
                  ><span class="sr-only">${item.name} </span>Details</span
                >
                <span class="cash-chevron" aria-hidden="true"></span>
              </button>
            </div>
            ${expanded.has(item.id) ? raw(html`<div id="cash-product-${item.id}">${raw(buildCashProductDetail(cp, item, "card"))}</div>`) : raw(html`<div id="cash-product-${item.id}" hidden></div>`)}
          </article>`,
        ),
      )}
    </div>`;
  }

  const sortState = direction > 0 ? "ascending" : "descending";
  const sortButton = (key, label, mobile = false) =>
    html`<button
      type="button"
      data-cash-sort="${key}"
      ${mobile ? raw(html`aria-pressed="${sort === key}"`) : ""}
      title="${key === "rate" ? "Sort single published percentages" : "Sort by earliest advertised access"}"
    >
      ${label}
      <span aria-hidden="true"
        >${sort === key ? (direction > 0 ? "↑" : "↓") : "↕"}</span
      >
      ${mobile && sort === key ? raw(html`<span class="sr-only">${sortState}</span>`) : ""}
    </button>`;
  const sortHeader = (key, label) =>
    html`<th
      scope="col"
      class="cash-sort-header"
      ${sort === key ? raw(html`aria-sort="${sortState}"`) : ""}
    >
      ${raw(sortButton(key, label))}
    </th>`;
  const disclosure = (item, detailId) =>
    html`<button
      type="button"
      class="cash-product-toggle cash-chevron-button"
      data-cash-product="${item.id}"
      aria-label="Rate details for ${item.name}"
      aria-expanded="${expanded.has(item.id)}"
      aria-controls="${detailId}"
    >
      <span class="cash-chevron" aria-hidden="true"></span>
    </button>`;

  const unsortableRateNames = items
    .filter((item) => singleCashHeadlineRate(item) === null)
    .map((item) => item.name);
  return html`${sort === "rate" ? raw(html`<p class="cash-sort-note">Sorted by the single published headline percentage (including advertised ceilings). Rows without one sortable headline value follow: ${unsortableRateNames.join(", ")}.</p>`) : ""}
    <div class="cash-table-surface card-surface">
      <table class="cash-product-table" aria-label="Cash products">
        <thead>
          <tr>
            <th scope="col">Product</th>
            <th scope="col">Type</th>
            ${raw(sortHeader("rate", "Headline rate"))}
            <th scope="col">Conditions</th>
            <th scope="col">Limit</th>
            ${raw(sortHeader("liquidity", "Liquidity"))}
            <th scope="col">Tags</th>
            <th scope="col" class="cash-chevron-cell">
              <span class="sr-only">Details</span>
            </th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item) => {
            const detailId = `cash-product-${item.id}`;
            const isOpen = expanded.has(item.id);
            return raw(
              html`<tr class="cash-product-row" data-cash-product-row>
                  <th scope="row">
                    ${item.name}<span class="cash-product-issuer"
                      >${item.provider}</span
                    >
                  </th>
                  <td>${item.categoryLabel}</td>
                  <td class="cash-product-rate">
                    ${raw(buildCashHeadline(item))}
                  </td>
                  <td>
                    ${cashConditionLabel(item)}
                    ${cashProductIsStale(cp, item) ? raw('<span class="cash-stale-note">Newer data available · Sync MAS</span>') : ""}
                  </td>
                  <td>${item.capLabel}</td>
                  <td>${item.liquidity}</td>
                  <td class="cash-product-table-tags">
                    ${raw(buildCashProductTags(item, true))}
                  </td>
                  <td class="cash-chevron-cell">
                    ${raw(disclosure(item, detailId))}
                  </td>
                </tr>
                <tr
                  class="cash-detail-row"
                  id="${detailId}"
                  ${isOpen ? "" : "hidden"}
                >
                  <td colspan="8">
                    ${isOpen ? raw(buildCashProductDetail(cp, item)) : ""}
                  </td>
                </tr>`,
            );
          })}
        </tbody>
      </table>
    </div>
    <div class="cash-mobile-comparison card-surface">
      <div
        class="cash-mobile-sort cash-sort-header"
        role="group"
        aria-label="Sort cash products"
      >
        ${raw(sortButton("rate", "Headline rate", true))}
        ${raw(sortButton("liquidity", "Liquidity", true))}
      </div>
      <ul class="cash-mobile-list" aria-label="Cash products">
        ${items.map((item) => {
          const detailId = `cash-list-detail-${item.id}`;
          const isOpen = expanded.has(item.id);
          return raw(
            html`<li>
              <div class="cash-mobile-row" data-cash-product-row>
                <strong>${item.name}</strong>
                <div class="cash-product-rate">
                  ${raw(buildCashHeadline(item))}
                </div>
                ${raw(buildCashProductTags(item))}
                ${raw(disclosure(item, detailId))}
              </div>
              <div
                class="cash-mobile-detail"
                id="${detailId}"
                ${isOpen ? "" : "hidden"}
              >
                ${isOpen ? raw(buildCashProductDetail(cp, item, "mobile")) : ""}
              </div>
            </li>`,
          );
        })}
      </ul>
    </div>`;
}

function buildCashAccountReadoutHTML(acc) {
  if (!acc) return "";
  if (acc.hasOverflow) {
    return `First ${m(acc.tier1Balance)} @ ${acc.bonusRatePct.toFixed(2)}% (${m(acc.tier1AnnualInterest, "/yr")}) · ${m(acc.overflowBalance)} over cap @ ${acc.baseRatePct.toFixed(2)}% (${m(acc.overflowAnnualInterest, "/yr")})`;
  }
  if (acc.bonusCap > 0) {
    const room = Math.max(0, acc.bonusCap - acc.balance);
    return `Within ${m(acc.bonusCap)} bonus cap @ ${acc.bonusRatePct.toFixed(2)}% · ${m(room)} room`;
  }
  return `${acc.sovereignBacked ? "SG Gov Backed" : "Uncapped rate"} @ ${acc.bonusRatePct.toFixed(2)}% p.a.`;
}

function buildCashAccountInterestHTML(acc) {
  return `${m(acc.monthlyInterest, "/mo")} · ${m(acc.annualInterest, "/yr")}${acc.hasOverflow ? ` · ${acc.effectiveRatePct.toFixed(2)}% effective rate (−${acc.rateDragPct.toFixed(2)}% drag)` : ""}`;
}

const formatCashInput = (amount) =>
  Number(amount).toLocaleString("en-SG", { maximumFractionDigits: 20 });

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

function buildCashAccountsEditorHTML(cp) {
  const active = Boolean(cp.cashAccountsActive);
  const bd = cp.cashBreakdown;
  const addButton =
    '<button type="button" class="button button-small" data-cash-acc-add="smart">+ Add account</button>';

  const renderField = (acc, idx, field, label, isMoney) =>
    html`<div class="cash-acc-col">
      <label for="cash-acc-${field}-${idx}">${label}</label>
      <div class="input-wrap">
        ${isMoney ? raw('<span aria-hidden="true">$</span>') : ""}
        <input
          id="cash-acc-${field}-${idx}"
          type="${isMoney ? "text" : "number"}"
          inputmode="decimal"
          ${isMoney ? raw("data-cash-money") : raw('min="0" max="20" step="0.05"')}
          data-cash-acc-field="${field}"
          data-cash-acc-idx="${idx}"
          value="${isMoney ? formatCashInput(acc[field]) : acc[field]}"
        />
        ${isMoney ? "" : raw('<span aria-hidden="true">%</span>')}
      </div>
    </div>`;

  return html`<div class="cash-acc-editor">
    <div class="cash-acc-mode-bar">
      <div
        class="cash-acc-mode-tabs"
        role="group"
        aria-label="Cash bucket entry mode"
      >
        <button
          type="button"
          class="qe-picker-chip"
          data-cash-acc-mode="single"
          aria-pressed="${!active}"
        >
          Single figure
        </button>
        <button
          type="button"
          class="qe-picker-chip"
          data-cash-acc-mode="itemized"
          aria-pressed="${active}"
        >
          By account
        </button>
      </div>
      ${raw(addButton)}
    </div>
    ${
      !active
        ? raw(
            html`<p class="cash-acc-single-copy">
              Using one cash and SSB balance of
              <strong>${raw(m(cp.currentCash))}</strong>.
            </p>`,
          )
        : raw(
            html`<div id="cash-acc-summary-page" class="cash-account-summary">
                ${bd.accountCount}
                ${bd.accountCount === 1 ? "account" : "accounts"} ·
                ${raw(m(bd.totalAnnualInterest, "/yr"))} total interest
              </div>
              <div id="cash-acc-alerts-page">
                ${raw(buildCashAccountsAlertsHTML(bd))}
              </div>
              <div
                class="cash-acc-list"
                role="group"
                aria-label="Itemized cash accounts"
              >
                ${bd.accounts.map((acc, idx) => {
                  const isFlat = ["ssb", "tbills", "mmf"].includes(acc.preset);
                  const isCustom = acc.preset === "custom";
                  return raw(
                    html`<section
                      class="cash-acc-row"
                      data-cash-acc-row="${idx}"
                      aria-label="Account ${idx + 1}"
                    >
                      <div
                        class="cash-acc-row-top${isCustom ? " is-custom-preset" : ""}"
                      >
                        <div class="cash-acc-col is-preset">
                          <label for="cash-acc-preset-${idx}"
                            >Bank / Vehicle</label
                          >
                          <div class="input-wrap select-wrap">
                            <select
                              id="cash-acc-preset-${idx}"
                              data-cash-acc-field="preset"
                              data-cash-acc-idx="${idx}"
                            >
                              ${RetirementModel.CASH_ACCOUNT_PRESETS.map((preset) => raw(html`<option value="${preset.key}" ${raw(preset.key === acc.preset ? "selected" : "")}>${preset.name || preset.label}</option>`))}
                            </select>
                          </div>
                        </div>
                        ${
                          isCustom
                            ? raw(
                                html`<div class="cash-acc-col is-name">
                                  <label for="cash-acc-name-${idx}"
                                    >Bank / Account name</label
                                  >
                                  <div class="input-wrap">
                                    <input
                                      id="cash-acc-name-${idx}"
                                      type="text"
                                      maxlength="50"
                                      data-cash-acc-field="name"
                                      data-cash-acc-idx="${idx}"
                                      value="${acc.name}"
                                    />
                                  </div>
                                </div>`,
                              )
                            : ""
                        }
                        ${raw(renderField(acc, idx, "balance", "Balance ($)", true))}
                        <button
                          type="button"
                          class="text-button cash-account-remove"
                          data-cash-acc-remove="${idx}"
                          aria-label="Remove ${acc.name}"
                        >
                          Remove
                        </button>
                      </div>
                      <p
                        class="cash-acc-row-readout"
                        data-cash-acc-readout="${idx}"
                      >
                        ${raw(buildCashAccountReadoutHTML(acc))}
                      </p>
                      <details
                        class="cash-customize"
                        data-cash-customize="${acc.id}"
                      >
                        <summary>Customize rates</summary>
                        <div
                          class="cash-acc-row-rules${isFlat ? " is-flat" : ""}"
                        >
                          ${
                            isFlat
                              ? raw(
                                  renderField(
                                    acc,
                                    idx,
                                    "bonusRatePct",
                                    acc.preset === "ssb"
                                      ? "10-year average yield"
                                      : "Annual yield",
                                    false,
                                  ),
                                )
                              : [
                                  raw(
                                    renderField(
                                      acc,
                                      idx,
                                      "bonusCap",
                                      "Bonus cap ($)",
                                      true,
                                    ),
                                  ),
                                  raw(
                                    renderField(
                                      acc,
                                      idx,
                                      "bonusRatePct",
                                      "Rate up to cap",
                                      false,
                                    ),
                                  ),
                                  raw(
                                    renderField(
                                      acc,
                                      idx,
                                      "baseRatePct",
                                      "Rate above cap",
                                      false,
                                    ),
                                  ),
                                ]
                          }
                        </div>
                        <p data-cash-acc-interest="${idx}">
                          ${raw(buildCashAccountInterestHTML(acc))}
                        </p>
                      </details>
                    </section>`,
                  );
                })}
              </div>`,
          )
    }
  </div>`;
}

function buildCashPlanCardHTML(cp) {
  const bd = cp.cashBreakdown;
  const months =
    cp.emergencyMonthlyBase > 0
      ? Math.round(cp.currentCash / cp.emergencyMonthlyBase)
      : null;
  const progress =
    cp.emergencyMax > cp.emergencyMin
      ? Math.min(
          100,
          Math.max(
            0,
            (100 * (cp.currentCash - cp.emergencyMin)) /
              (cp.emergencyMax - cp.emergencyMin),
          ),
        )
      : 0;
  const belowTarget = cp.currentCash < cp.emergencyMin;
  const coverage = belowTarget
    ? "Below target range"
    : cp.currentCash > cp.emergencyMax
      ? "Above target range"
      : "Within target range";
  const purposes = [
    "Instant access",
    "Government-backed",
    "Higher-yield funds",
  ];
  return `<section class="card-surface cash-plan-card" aria-labelledby="cash-layer-title">
    <div class="cash-plan-heading">
      <h2 id="cash-layer-title">Cash buffer</h2>
      <button type="button" class="text-button" data-open-page-cash-accounts aria-controls="cash-accounts">Edit cash accounts</button>
    </div>
    <dl class="cash-plan-stats">
      <div>
        <dt>Emergency target</dt>
        <dd>${m(cp.emergencyMin, "", "cash-em-min")}–${m(cp.emergencyMax, "", "cash-em-max")}</dd>
        <dd class="cash-stat-note">6–12 months at ${m(cp.emergencyMonthlyBase, "/mo")}</dd>
      </div>
      <div>
        <dt>Cash &amp; SSB</dt>
        <dd>${m(cp.currentCash, "", "cash-entered")}</dd>
        ${cp.cashAccountsActive && bd ? `<dd class="cash-stat-note">${bd.effectiveRatePct.toFixed(2)}% blended EIR · ~${m(bd.totalMonthlyInterest, "/mo")}</dd>` : ""}
      </div>
      <div>
        <dt>Monthly cash/bond slice</dt>
        <dd>${m(cp.monthlyCashSlice, "/mo", "cash-monthly-slice")}</dd>
        <dd class="cash-stat-note">${
          cp.monthlyCashSaving > 0
            ? `${m(cp.monthlyCashSaving, "/mo")} cash savings + ${m(cp.monthlyBondSlice, "/mo")} bonds`
            : "Bond slice from Allocator"
        }</dd>
      </div>
    </dl>
    ${
      months === null
        ? ""
        : `<div class="cash-coverage${belowTarget ? " is-below-target" : ""}">
      <p><strong>About ${months} ${months === 1 ? "month" : "months"}</strong> · ${coverage}</p>
      <div class="cash-coverage-range" aria-hidden="true">
        <span>6 months</span><div><i style="left:${progress}%"></i></div><span>12 months</span>
      </div>
    </div>`
    }
    <ul class="cash-purpose-list" aria-label="Suggested allocation of current cash">
      ${cp.tiers
        .map(
          (tier, idx) => `<li${tier.allocated === 0 ? ' class="is-zero"' : ""}>
        <div><strong>${purposes[idx]}</strong><p>${tier.vehicles}</p>
        ${idx === 1 ? `<p>${m(cp.ssbTargetBuffer)} SSB target after the emergency buffer · T-Bills have no individual cap</p>` : ""}
        ${idx === 2 && cp.monthlyCashSaving === 0 && cp.hasSrs ? "<p>Idle SRS earns 0.05%.</p>" : ""}</div>
        <strong>${m(tier.allocated)}</strong>
      </li>`,
        )
        .join("")}
    </ul>
  </section>`;
}

function buildCashParkingSection(cp, options) {
  if (!cp?.catalog) return "";
  const categories = [
    { key: "all", label: "All products" },
    ...cp.catalog.categories.filter(
      ({ key }) => key !== "all" && key !== "fd-mmf",
    ),
    { key: "fd", label: "Fixed deposits" },
    { key: "mmf", label: "MMF & cash management" },
  ];
  const counts = { all: cp.catalog.items.length };
  for (const item of cp.catalog.items) {
    const category = cashProductCategory(item);
    counts[category] = (counts[category] || 0) + 1;
  }
  const tags = [
    { key: "srs", label: "SRS eligible" },
    { key: "safe", label: "SDIC / SG Gov" },
    { key: "t0", label: "Same-day T+0" },
  ];

  return html` <header class="fin-page-header cash-page-header">
      <h1>Cash options</h1>
      <div class="cash-header-sync">
        <span class="cash-mas-date"
          >MAS data date
          <span class="cash-sync-pill"
            >${raw(buildCashFreshnessHTML(cp))}</span
          ></span
        >
        <button
          type="button"
          class="button button-small cash-sync-btn"
          data-cash-sync
        >
          Sync MAS
        </button>
      </div>
    </header>
    <div class="cash-plan-slot">${raw(buildCashPlanCardHTML(cp))}</div>
    <details class="cash-accounts-disclosure card-surface" id="cash-accounts">
      <summary class="planner-summary">
        Your accounts <span class="cash-chevron" aria-hidden="true"></span>
      </summary>
      <div class="cash-accounts-page-slot">
        ${raw(buildCashAccountsEditorHTML(cp))}
      </div>
    </details>
    <section aria-labelledby="cash-comparison-title">
      <div class="cash-compare-heading">
        <h2 class="cash-comparison-title" id="cash-comparison-title">
          Compare cash products
        </h2>
        <div
          class="cash-view-options"
          role="group"
          aria-label="Comparison view"
        >
          <button
            type="button"
            class="qe-picker-chip"
            data-cash-view="table"
            aria-pressed="${options.view === "table"}"
          >
            Table
          </button>
          <button
            type="button"
            class="qe-picker-chip"
            data-cash-view="cards"
            aria-pressed="${options.view === "cards"}"
          >
            Cards
          </button>
        </div>
      </div>
      <div class="cash-toolbar">
        <div
          class="cash-filter-bar"
          role="group"
          aria-label="Filter by product type"
        >
          ${categories.map(({ key, label }) => raw(html`<button type="button" class="qe-picker-chip" data-cash-filter="${key}" aria-pressed="${key === options.filter}">${label} <span class="cash-filter-count">${counts[key] || 0}</span></button>`))}
        </div>
        <div class="cash-search-tag-bar">
          <div class="cash-search-wrap">
            <svg
              class="cash-search-icon"
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              stroke-width="1.75"
              stroke-linecap="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="search"
              id="cash-search-input"
              class="cash-search-input"
              placeholder="Search cash products"
              aria-label="Search cash products"
              value="${options.search}"
            />
            <button
              type="button"
              class="cash-search-clear"
              data-cash-search-clear
              aria-label="Clear search"
              ${raw(options.search ? "" : "hidden")}
            >
              ×
            </button>
          </div>
          <div class="cash-tag-bar" role="group" aria-label="Filter by tag">
            ${tags.map(({ key, label }) => raw(html`<button type="button" class="qe-picker-chip" data-cash-tag="${key}" aria-pressed="${options.tag === key}">${label}</button>`))}
          </div>
        </div>
      </div>
      <div class="cash-cards-wrap">
        ${raw(buildCashCardsMarkup(cp, options))}
      </div>
    </section>
    <div class="cash-rules-note" role="note">
      <strong>Key limit reminders (${cp.asOf})</strong>
      <span
        >SDIC insures eligible SGD deposits up to
        <b>$100,000 per depositor, per DI Scheme bank</b> (DBS &amp; POSB share
        one combined $100k limit). MAS Singapore Savings Bonds have a
        <b>$200,000 individual holding cap</b> across all tranches. Money market
        funds and cash-management portfolios are investment products and are
        <b>not SDIC-insured</b>.</span
      >
    </div>`;
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
        <p class="div-payout-sub">${hasIrr
          ? `Nominal IRR: <strong>${formatAnnuityIrr(nominalIrr, { signed: true })}</strong> · Real IRR: <strong>${formatAnnuityIrr(annuityModel.realAnnualIrrPct, { signed: true })}</strong> at ${Number(annuityModel.inflationRatePct ?? 2.5).toFixed(1)}% inflation`
          : "No payouts in this scenario."}</p>
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
  buildBogleheadSection,
  buildTaxSweetSpotSection,
  buildCashCardsMarkup,
  buildCashAccountReadoutHTML,
  buildCashAccountInterestHTML,
  buildCashFreshnessHTML,
  formatCashInput,
  buildCashAccountsAlertsHTML,
  buildCashAccountsEditorHTML,
  buildCashPlanCardHTML,
  buildCashParkingSection,
  buildDividendResultsHTML,
  buildDividendBenchmarksHTML,
  buildTargetResultsHTML,
  buildTargetBenchmarksHTML,
  buildAnnuityResultsHTML,
  buildAnnuityBenchmarksHTML,
  formatAnnuityBadge,
  buildDividendCalculatorSection,
};
