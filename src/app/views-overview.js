import {
  formatFundedPct,
  money,
  m,
  signedM,
  centsHtml,
  compactMoney,
  svgWrap,
  ICONS,
  escapeAttr,
} from "./format.js";

export function computeRebalanceTargets(bogle, p, r) {
  return RetirementModel.computeRebalanceTargets(bogle, p, r);
}

export function getMilestoneNodes(fire, r, s, simulation, basis = "today") {
  const isNominal = basis === "nominal";
  const ptVal = (pt) => (isNominal ? pt : pt?.today);
  const toDisplayMoney = (val, targetAge) => {
    const factor = Math.pow(
      1 + (r.inflation || 0),
      Math.max(0, targetAge - r.age),
    );
    if (isNominal) return r.moneyBasis === "today" ? val * factor : val;
    return r.moneyBasis === "today" ? val : val / factor;
  };
  const pts = fire?.points || [];
  const ptAt = (age) =>
    pts.find((x) => x.age === age) ||
    pts.find((x) => x.age >= age) ||
    pts[pts.length - 1];
  const nowPt = pts[0];
  const age55Target = fire.age < 55 ? 55 : fire.age;
  const pt55 = ptAt(age55Target);
  const ptRet = ptAt(fire.retire);
  const age75Target = Math.min(fire.endAge, Math.max(75, fire.retire));
  const pt75 = ptAt(age75Target);
  const pt95 = pts[pts.length - 1];
  const totalMoSave =
    (simulation?.cpfExtra || 0) +
    (simulation?.cashSaving || 0) +
    (simulation?.invest ?? s.privateSaving);
  const spendAtRetire = toDisplayMoney(r.futureSpend, fire.retire);
  const spendAt75 =
    ptVal(pt75)?.monthlySpend ?? toDisplayMoney(r.spend75, age75Target);
  const payoutAt65 = toDisplayMoney(s.payout, 65);

  return [
    {
      badge: "Now",
      tag: `Age ${fire.age}`,
      title: "Starting Base",
      metric: m(ptVal(nowPt)?.totalNetWorth ?? 0),
      pill: r.retiringNow ? "Active" : `Save ${compactMoney(totalMoSave)}/mo`,
      sub: r.retiringNow
        ? "Immediate retirement transition"
        : `Saving ${money(totalMoSave)}/mo`,
      color: "#1D4ED8",
      softBg: "#EFF6FF",
    },
    {
      badge: fire.age < 55 ? "55" : String(fire.age),
      tag: fire.age < 55 ? "Age 55 · SA → RA" : `Age ${fire.age} · Post-55`,
      title: fire.age < 55 ? "Total CPF (RA + OA + MA)" : "RA Locked Floor",
      metric: m(ptVal(pt55)?.cpfTotal ?? 0),
      pill: "CPF Check",
      sub: `Total net worth ${money(ptVal(pt55)?.totalNetWorth ?? 0)}`,
      color: "#0F766E",
      softBg: "#E6F7F5",
    },
    {
      badge: String(fire.retire),
      tag: `Age ${fire.retire}`,
      title: "Retirement Launch",
      metric: m(ptVal(ptRet)?.totalNetWorth ?? 0),
      pill: fire.retire < 65 ? "Bridge" : "CPF LIFE",
      sub: `Budget ${money(spendAtRetire)}/mo · ${fire.retire < 65 ? "Liquid bridge" : "CPF LIFE active"}`,
      color: "#1D4ED8",
      softBg: "#EFF6FF",
    },
    {
      badge: String(pt95?.age ?? fire.endAge ?? 95),
      tag: `Age 75→${pt95?.age ?? fire.endAge ?? 95}`,
      title: fire.fireNumber.fullyFundedTo95
        ? `Age ${fire.endAge ?? 95}+ Runway`
        : `Funded to ${Math.floor(fire.fireNumber.depletionAge ?? 90)}`,
      metric: m(ptVal(pt95)?.totalNetWorth ?? 0),
      pill: fire.fireNumber.fullyFundedTo95 ? "Sustained" : "Watch Gap",
      sub: `Spend ${money(spendAt75)}/mo · CPF ${money(payoutAt65)}/mo`,
      color: fire.fireNumber.fullyFundedTo95 ? "#7C3AED" : "#B91C1C",
      softBg: fire.fireNumber.fullyFundedTo95 ? "#F5F3FF" : "#FEF2F2",
    },
  ];
}

export function buildFundingSourcesList(
  taps,
  r,
  s,
  cpfCovPct,
  basis = "today",
) {
  const isNominal = basis === "nominal";
  const toDisplayMoney = (val, targetAge) => {
    const factor = Math.pow(
      1 + (r.inflation || 0),
      Math.max(0, targetAge - r.age),
    );
    if (isNominal) return r.moneyBasis === "today" ? val * factor : val;
    return r.moneyBasis === "today" ? val : val / factor;
  };
  const srsDisplayDraw = isNominal
    ? taps.tap2Srs.tenYearMonthlyDraw
    : (taps.tap2Srs.tenYearMonthlyDrawToday ?? taps.tap2Srs.tenYearMonthlyDraw);
  const srsDisplayPot = isNominal
    ? taps.tap2Srs.projectedAt63
    : (taps.tap2Srs.projectedAt63Today ?? taps.tap2Srs.projectedAt63);
  const srsTrapFloorLabel = compactMoney(
    taps.tap2Srs.trapFloorAt63 || RetirementModel.C.srsTrapFloorAt63,
  ).replace(/^\$/, "");
  const srsMarginalPct = Number(
    ((taps.tap2Srs.marginalRate || 0) * 100).toFixed(1).replace(/\.0$/, ""),
  );
  const srsDrawPill =
    taps.tap2Srs.trapStatus === "balloon-trap"
      ? `>${srsTrapFloorLabel}!`
      : taps.tap2Srs.verdictStatus === "idle-cash"
        ? "0.05%!"
        : taps.tap2Srs.projectedAt63 > 0
          ? `${compactMoney(srsDisplayPot)}`
          : taps.tap2Srs.verdictStatus === "worth-it"
            ? `Save ${compactMoney(taps.tap2Srs.taxSavedPerYear)}/yr`
            : taps.tap2Srs.verdictStatus === "rstu-first"
              ? "RSTU 1st"
              : taps.tap2Srs.verdictStatus === "cap-full"
                ? "$80k Cap"
                : `Skip (${srsMarginalPct}%)`;
  const srsCountSub =
    taps.tap2Srs.projectedAt63 > 0
      ? `Age ${taps.tap2Srs.startAge}–${taps.tap2Srs.endAge} · ${money(srsDisplayDraw)}/mo${isNominal ? "" : " (today’s $)"}`
      : taps.tap2Srs.verdictStatus === "worth-it"
        ? `Age ${taps.tap2Srs.startAge}–${taps.tap2Srs.endAge} · ${srsMarginalPct}% tax (${compactMoney(taps.tap2Srs.effectiveRoom)} room)`
        : taps.tap2Srs.verdictStatus === "rstu-first"
          ? `Age ${taps.tap2Srs.startAge}–${taps.tap2Srs.endAge} · ${srsMarginalPct}% tax · Top up SA 1st`
          : taps.tap2Srs.verdictStatus === "cap-full"
            ? `Age ${taps.tap2Srs.startAge}–${taps.tap2Srs.endAge} · $80k relief cap full`
            : `Age ${taps.tap2Srs.startAge}–${taps.tap2Srs.endAge} · ${srsMarginalPct}% tax · Keep liquid`;
  const ssbPctOf150k = Math.min(
    100,
    Math.round((taps.tap4Ssb.currentSsbCash / taps.tap4Ssb.targetBuffer) * 100),
  );
  const ssbRateTag = taps.tap4Ssb.ssb10YrPct
    ? `${Number(taps.tap4Ssb.ssb10YrPct).toFixed(2)}% 10Y`
    : `${ssbPctOf150k}%`;
  const ssbYieldMo =
    taps.tap4Ssb.currentSsbCash > 0
      ? (taps.tap4Ssb.currentMonthlyYield ?? taps.tap4Ssb.monthlyYieldAt150k)
      : taps.tap4Ssb.monthlyYieldAt150k;
  const todayToDisplay = (val, targetAge) =>
    isNominal
      ? val * Math.pow(1 + (r.inflation || 0), Math.max(0, targetAge - r.age))
      : val;
  const tap1PayoutDisplay = toDisplayMoney(s.payout, 65);
  const tap1Spend65Display = toDisplayMoney(r.spend65, 65);
  const tap3AtRetireDisplay = todayToDisplay(
    taps.tap3Equities.projectedInvestAtRetireToday ??
      taps.tap3Equities.portfolioAtRetireToday,
    r.retire,
  );
  const tap3DrawDisplay = todayToDisplay(
    taps.tap3Equities.projectedMonthlyDrawToday,
    s.gap65 > 0 ? 65 : r.retire,
  );
  const tap3Gap65Display = toDisplayMoney(s.gap65, 65);
  const tap4AtRetireDisplay = todayToDisplay(
    taps.tap4Ssb.projectedSsbCashAtRetireToday ?? taps.tap4Ssb.currentSsbCash,
    r.retire,
  );
  const oaAt55Display = isNominal
    ? taps.tap1Cpf.oaAt55Nominal
    : taps.tap1Cpf.oaAt55Today;
  const oaInterestMoDisplay = isNominal
    ? taps.tap1Cpf.oaInterestMonthlyNominal
    : taps.tap1Cpf.oaInterestMonthlyToday;
  return {
    ssbPctOf150k,
    fundingSources: [
      {
        name: `Tap 1 · CPF LIFE (${r.plan === "escalating" ? "Esc" : "Std"})`,
        count: `${money(tap1PayoutDisplay)}/mo of ${money(tap1Spend65Display)} need${taps.tap1Cpf.monthlyExtraCpf > 0 ? ` (+${money(taps.tap1Cpf.monthlyExtraCpf)}/mo)` : ""}`,
        score: `${cpfCovPct}%`,
        color: "#047857",
        badgeBg: "#ECFDF5",
        softBg: "#ECFDF5",
        border: "#A7F3D0",
        letter: "1",
        icon: svgWrap(
          '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
          16,
        ),
      },
      {
        name: "Tap 2 · SRS Bridge",
        count: srsCountSub,
        score: srsDrawPill,
        color: "#6D28D9",
        badgeBg: "#F5F3FF",
        softBg: "#F5F3FF",
        border: "#DDD6FE",
        letter: "2",
        icon: svgWrap(
          '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M8 2v4"/><path d="M16 2v4"/>',
          16,
        ),
      },
      {
        name: "Tap 3 · Equity & Dividend",
        count: `${!r.retiringNow ? `+${money(taps.tap3Equities.monthlyInvest)}/mo (${taps.tap3Equities.globalSplitPct}/${taps.tap3Equities.sgDividendSplitPct} G/SG) → ` : ""}${compactMoney(tap3AtRetireDisplay)} at ${r.retire} · ${s.gap65 > 0 ? `${money(tap3DrawDisplay)}/mo of ${money(tap3Gap65Display)} gap` : `+${money(tap3DrawDisplay)}/mo draw`}`,
        score: `${taps.tap3Equities.targetEquityPct ?? 80}/${taps.tap3Equities.targetBondPct ?? 20}`,
        color: "#1D4ED8",
        badgeBg: "#EFF6FF",
        softBg: "#EFF6FF",
        border: "#BFDBFE",
        letter: "3",
        icon: svgWrap(
          '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
          16,
        ),
      },
      {
        name: taps.tap4Ssb.cashAccountsActive
          ? `Tap 4 · Cash & SSB (${taps.tap4Ssb.accountCount})`
          : "Tap 4 · SSB Buffer",
        count:
          taps.tap4Ssb.cashAccountsActive ||
          taps.tap4Ssb.hasCustomCashRate ||
          (taps.tap4Ssb.monthlyCashSaving ?? 0) > 0 ||
          (taps.tap3Equities.monthlyBondBuy ?? 0) > 0
            ? `${!r.retiringNow && (taps.tap4Ssb.monthlyCashSaving ?? 0) > 0 ? `+${money(taps.tap4Ssb.monthlyCashSaving)}/mo → ` : `${compactMoney(taps.tap4Ssb.currentSsbCash)} → `}${compactMoney(tap4AtRetireDisplay)} at ${r.retire} · ~${money(ssbYieldMo)}/mo @ ${taps.tap4Ssb.effectiveRatePct.toFixed(2)}%`
            : `${compactMoney(taps.tap4Ssb.currentSsbCash)} → ${compactMoney(tap4AtRetireDisplay)} at ${r.retire} · ~${money(ssbYieldMo)}/mo${taps.tap4Ssb.currentSsbCash > 0 ? "" : " @ cap"}`,
        score:
          taps.tap4Ssb.cashAccountsActive ||
          taps.tap4Ssb.hasCustomCashRate ||
          (taps.tap4Ssb.monthlyCashSaving ?? 0) > 0
            ? `${taps.tap4Ssb.effectiveRatePct.toFixed(2)}%`
            : taps.tap4Ssb.currentSsbCash > 0
              ? `${ssbPctOf150k}%`
              : ssbRateTag,
        color: "#B45309",
        badgeBg: "#FFFBEB",
        softBg: "#FFFBEB",
        border: "#FDE68A",
        letter: "4",
        icon: svgWrap(
          '<path d="M3 21h18"/><path d="M3 10h18"/><path d="M5 6l7-3 7 3"/><path d="M4 10v11"/><path d="M20 10v11"/><path d="M8 14v3"/><path d="M12 14v3"/><path d="M16 14v3"/>',
          16,
        ),
      },
      {
        name: "Age-55 OA Interest Tap",
        count:
          oaAt55Display > 0
            ? `${money(oaInterestMoDisplay)}/mo liquid`
            : "$0 excess OA at 55",
        score: "2.5% p.a.",
        color: "#0F766E",
        badgeBg: "#F0FDFA",
        softBg: "#F0FDFA",
        border: "#99F6E4",
        letter: "55",
        icon: svgWrap(
          '<circle cx="12" cy="12" r="9"/><path d="M9 15l6-6"/><circle cx="9.5" cy="9.5" r=".5" fill="currentColor"/><circle cx="14.5" cy="14.5" r=".5" fill="currentColor"/>',
          16,
        ),
      },
    ],
  };
}

let finActivityTab = "milestones";

export function buildFinReadinessGaugeSVG(
  pctFunded,
  eyebrowText,
  readyText,
  deltaLine,
  deltaColor,
  onTrack = pctFunded >= 100,
  uid = "swell",
  endAge = 95,
) {
  const pctVal = Math.max(0, Math.round(Number(pctFunded) || 0));
  const pctDisplay = formatFundedPct(pctFunded);
  const ratio = Math.max(0.05, Math.min(1, pctVal / 100));
  const cx = 120;
  const cy = 114;
  const r = 84;
  const startX = cx - r;
  const startY = cy;
  const endX = cx + r;
  const endY = cy;
  const activeDeg = -180 + ratio * 180;
  const activeRad = (activeDeg * Math.PI) / 180;
  const knobX = cx + Math.cos(activeRad) * r;
  const knobY = cy + Math.sin(activeRad) * r;

  const isAmazing = Boolean(onTrack && pctVal >= 100);
  const isNear = pctVal >= 80 && !isAmazing;
  const statusWord = isAmazing
    ? "On Track"
    : isNear
      ? "Near Target"
      : pctVal >= 60
        ? "In Progress"
        : "Action Needed";
  const statusColor = isAmazing
    ? "#047857"
    : isNear
      ? "#B45309"
      : pctVal >= 60
        ? "#B45309"
        : "#B91C1C";
  return `<div class="fin-gauge-wrap swell-gauge-wrap">
    <svg class="fin-gauge-svg swell-gauge-svg" viewBox="0 0 240 132" width="240" height="132" aria-hidden="true">
      <defs>
        <linearGradient id="${uid}-arc-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#F43F5E" />
          <stop offset="50%" stop-color="#EC4899" />
          <stop offset="100%" stop-color="#E83E8C" />
        </linearGradient>
      </defs>
      <path d="M ${startX} ${startY} A ${r} ${r} 0 0 1 ${endX} ${endY}" fill="none" stroke="#E2E8F0" stroke-width="12" stroke-linecap="round" />
      <path d="M ${startX} ${startY} A ${r} ${r} 0 0 1 ${knobX.toFixed(1)} ${knobY.toFixed(1)}" fill="none" stroke="url(#${uid}-arc-grad)" stroke-width="12" stroke-linecap="round" />
      <circle cx="${knobX.toFixed(1)}" cy="${knobY.toFixed(1)}" r="6.5" fill="#E83E8C" stroke="#FFFFFF" stroke-width="2.8" />
      <text x="120" y="90" text-anchor="middle" fill="#0F172A" font-size="25" font-weight="800" letter-spacing="-0.03em">${pctDisplay}</text>
      <text x="120" y="108" text-anchor="middle" fill="#64748B" font-size="9.5" font-weight="600" letter-spacing="0.03em">FUNDED TO ${endAge}</text>
    </svg>
    <span class="sr-only">${pctDisplay} funded to age ${endAge}</span>
    <div class="swell-gauge-status" style="color:${statusColor};">${statusWord}</div>
    <div class="fin-gauge-center swell-gauge-readout">
      <strong>${readyText}</strong>
      <span class="fin-gauge-eyebrow">${eyebrowText}</span>
      <span class="fin-gauge-delta" style="color:${deltaColor};">${deltaLine}</span>
    </div>
  </div>`;
}

export function getCappedSavings(value, overrides, simulation) {
  let remaining = Math.max(0, Math.round(Number(value) || 0));
  const capped = {};
  for (const field of ["invest", "cashSaving", "cpfExtra"]) {
    const current =
      overrides[field] ??
      simulation?.[field] ??
      (field === "cashSaving" ? simulation?.summary?.params?.cashSaving : 0);
    capped[field] = Math.min(
      remaining,
      Math.max(0, Math.round(Number(current) || 0)),
    );
    remaining = Math.max(0, remaining - capped[field]);
  }
  return capped;
}

function savingsRateBand(rate) {
  if (rate > 85) return { label: "Critical", tone: "danger" };
  if (rate > 50) return { label: "Stretched", tone: "warn" };
  return { label: rate > 30 ? "Healthy" : "Comfortable", tone: "good" };
}

function savingsHealth(rate, cashflow) {
  if (cashflow.leftAfterSave < 0)
    return { label: "Exceeds pay", tone: "danger" };
  if (cashflow.netCashSurplus < 0)
    return { label: "Cash shortfall", tone: "danger" };
  return savingsRateBand(rate);
}

function buildOverviewPageHeader({
  fire,
  r,
  startingTotalAssets,
  rate,
  recommendation,
  budget,
}) {
  const fn = fire.fireNumber;
  const onTrack = fn.pctFunded >= 100 && fn.fullyFundedTo95;
  const verdict = onTrack ? "On track" : "Shortfall";
  const tone = onTrack ? "good" : "warn";
  const targetRate = recommendation?.rate ?? rate;
  const targetBand = savingsRateBand(targetRate);
  const tightness = targetBand.tone !== "good" ? targetBand.label : "";
  const previewHealth = recommendation?.health;
  const hasSafeAge = fn.projectedFireAge != null;
  return `<header class="overview-hero" aria-labelledby="fire-hero-title">
    <div class="ember-page-header fin-page-header overview-title-row">
      <h1 id="fire-hero-title" tabindex="-1">Retirement Overview</h1>
      <button type="button" class="button button-small" commandfor="plan-settings" command="show-modal" aria-haspopup="dialog">
        Assumptions <span class="overview-assumption-values">· ${Number((r.inflation * 100).toFixed(1))}% inflation · ${Number((r.investmentReturn * 100).toFixed(1))}% return</span>
      </button>
    </div>
    <section class="overview-verdict card-surface is-${tone}" tabindex="-1" aria-label="Retirement readiness">
      <div class="overview-verdict-copy">
        <span class="status-pill is-${tone}">${verdict}</span>
        <h2 class="overview-hero-figure">${hasSafeAge ? `Age ${fn.projectedFireAge}` : "Beyond age 80"}</h2>
        <p class="overview-safe-age">Earliest projected retirement <span>· Goal through age ${fire.endAge}</span></p>
      </div>
      <div class="overview-hero-outcome">
      ${
        recommendation
          ? `
        <dl class="overview-action-outcome" aria-label="Estimated outcome after applying">
          <div><dt>Funded at target age ${fire.retire}</dt><dd class="overview-funded">${formatFundedPct(fn.pctFunded)} → <strong data-preview-funded>${formatFundedPct(recommendation.funded)}</strong></dd></div>
          <div><dt>Savings rate</dt><dd>${rate}% → <strong data-preview-rate>${recommendation.rate}%</strong> <span class="${previewHealth.label === targetBand.label ? "sr-only" : `status-pill is-${previewHealth.tone}`}" data-preview-savings-band>${previewHealth.label}</span></dd></div>
        </dl>`
          : `<dl class="overview-action-outcome">
          <div><dt>Funded at target age ${fire.retire}</dt><dd class="overview-funded"><strong>${formatFundedPct(fn.pctFunded)}</strong></dd></div>
        </dl>`
      }
      ${tightness ? `<p class="overview-saving-tightness">${recommendation?.move.action === "cap-affordable-save" ? "After applying the cap, save" : "Requires saving"} <strong>${targetRate}%</strong> of take-home · <strong class="overview-tightness-band is-${targetBand.tone}">${tightness}</strong></p>` : ""}
      </div>
      ${
        recommendation
          ? `
        <div class="overview-hero-actions">
          <button type="button" class="button button-primary" data-money-move="${recommendation.move.action}" data-move-val="${recommendation.move.value}"><span>${recommendation.move.action === "match-save" ? `Invest ${m(recommendation.move.value, "/mo")} outside CPF` : `Cap savings at ${m(recommendation.move.value, "/mo")}`}</span></button>
          <button type="button" class="text-button" data-quick-edit="invest" data-qe-focus="#qe-invest" aria-label="Edit monthly investment">Edit</button>
        </div>`
          : `<div class="overview-hero-actions"><button type="button" class="button button-primary" data-quick-edit="goal" data-qe-focus="#qe-retire">Review retirement age</button></div>`
      }
      <div class="overview-hero-summary" aria-label="Plan summary">
        <span>Pay after CPF <strong>${m(r.afterCpf, "/mo")}</strong></span>
        <span>Starting assets <strong>${m(startingTotalAssets)}</strong></span>
        ${budget == null ? "" : `<button type="button" class="text-button overview-budget-link" data-go-tab="budget">Budget <strong>${m(budget, "/mo")}</strong></button>`}
      </div>
    </section>
  </header>`;
}

function computeMonthlyTakeHomeCashflow({
  r,
  simulation,
  contribution,
  p,
  tax,
  expenseData,
}) {
  const cf = RetirementModel.computeMonthlyTakeHomeCashflow({
    r,
    simulation,
    contribution,
    p,
    tax,
    expenseData,
  });
  const housingMetaLabel =
    cf.hMode === "paid-up"
      ? "Paid-up property ($0 OA)"
      : cf.hMode === "all-oa"
        ? `Up to ${m(cf.housingOaMo)} CPF OA ($0 cash)`
        : cf.housingCashMo > 0
          ? `${m(cf.housingCashMo)} cash + ${m(cf.housingOaMo)} CPF OA`
          : `${m(cf.housingOaMo)} via CPF OA`;
  return {
    ...cf,
    housingMetaLabel,
  };
}

function buildFinBentoGridHTML({
  r,
  p,
  bogle,
  contribution,
  taps,
  cashflow,
  startingCpf,
  startingSrs,
  startingTotalAssets,
}) {
  const hMode = p.housingMode || "all-oa";
  const hParties = Math.max(1, Math.round(Number(p.housingParties || 1)));
  const rawLoanBal =
    hMode === "hdb" || hMode === "bank"
      ? Math.max(0, Number(p.housingBalance || 0))
      : 0;
  const userLoanShare = Math.round(rawLoanBal / hParties);
  const netWorthAfterDebt = startingTotalAssets - userLoanShare;
  const housingModeLabel =
    hMode === "paid-up"
      ? "Paid-up home"
      : hMode === "hdb"
        ? `HDB loan (2.6% · ${p.housingYears || 20}y)`
        : hMode === "bank"
          ? `Bank loan (${p.housingRate || 2.6}% · ${p.housingYears || 20}y)`
          : hMode === "custom"
            ? "Custom monthly OA"
            : "Covered by monthly OA";

  const cashBal = Math.round(bogle.buckets.ssbCash || 0);
  const eqBal = Math.round(
    (bogle.buckets.equities || 0) + (bogle.buckets.sgDividends || 0),
  );
  const cpfBal = Math.round(startingCpf);
  const srsBal = Math.round(startingSrs);
  const cpfSrsBal = cpfBal + srsBal;
  const assetDenom = Math.max(1, cashBal + eqBal + cpfSrsBal);
  const cashShareW = Math.round((cashBal / assetDenom) * 100);
  const eqShareW = Math.round((eqBal / assetDenom) * 100);
  const srsShareW =
    srsBal > 0 ? Math.max(1, Math.round((srsBal / assetDenom) * 100)) : 0;
  const cpfOnlyShareW = Math.max(0, 100 - cashShareW - eqShareW - srsShareW);
  const cpfShareW = Math.max(0, 100 - cashShareW - eqShareW);

  const {
    housingCashMo,
    monthlyTax,
    recurringTotal,
    fixedOutMo,
    netCashSurplus,
  } = cashflow;
  const mandatoryCpfMo = Math.round(
    (r.employeeCpf || 0) + (r.employerCpf || 0),
  );

  // Cashflow bar shares out of take-home pay
  const takeHomeDenom = Math.max(1, r.afterCpf);
  const saveW = Math.min(
    100,
    Math.max(0, Math.round((contribution / takeHomeDenom) * 100)),
  );

  const sgDivBal = Math.round(
    bogle.holistic?.sgDividends ?? (bogle.buckets.sgDividends || 0),
  );
  const sgDivMoNow = Math.round(((sgDivBal * 0.05) / 12) * 100) / 100;
  const cashMoNow =
    Math.round((taps.tap4Ssb.currentMonthlyYield || 0) * 100) / 100;
  const passiveMoNow = Math.round((sgDivMoNow + cashMoNow) * 100) / 100;
  const passiveYrNow = Math.round(passiveMoNow * 12);

  const fixedOutW =
    netCashSurplus <= 0
      ? Math.max(0, 100 - saveW)
      : Math.min(
          100 - saveW,
          Math.max(0, Math.round((fixedOutMo / takeHomeDenom) * 100)),
        );
  const livingW = netCashSurplus > 0 ? Math.max(0, 100 - saveW - fixedOutW) : 0;

  // Reconcile the three rows to the rounded "pay after CPF" header so the
  // figures always add up (saved + tax & bills + remaining).
  const afterCpfMo = Math.round(r.afterCpf || 0);
  const savedMo = Math.round(contribution || 0);
  const livingMo = afterCpfMo - savedMo - fixedOutMo;
  return `
    <div class="fin-bento-grid" id="fin-bento-grid">
      <article class="fin-bento-card overview-holdings">
        <div class="fin-bento-head">
          <div>
            <h3 class="overview-breakdown-label">Holdings &amp; Net Worth</h3>
            <p class="fin-bento-title">${signedM(netWorthAfterDebt)} <small>${userLoanShare > 0 ? "net of loan" : "debt-free"}</small></p>
          </div>
        </div>
        ${
          cpfSrsBal + eqBal + cashBal > 0
            ? `<div class="fin-bento-bar" aria-hidden="true">
          <span data-bento-seg="0" style="width:${cpfOnlyShareW}%;background:var(--sem-cpf);" title="CPF Locked (${cpfOnlyShareW}%)"></span>
          ${srsShareW > 0 ? `<span data-bento-seg="3" style="width:${srsShareW}%;background:var(--sem-srs);" title="SRS Locked (${srsShareW}%)"></span>` : ""}
          <span data-bento-seg="1" style="width:${eqShareW}%;background:var(--sem-equities);" title="Equities (${eqShareW}%)"></span>
          <span data-bento-seg="2" style="width:${cashShareW}%;background:var(--sem-cash);" title="Cash &amp; SSB (${cashShareW}%)"></span>
        </div>`
            : ""
        }
        <ul class="fin-bento-list">
          ${
            cpfSrsBal > 0
              ? `<li data-bento-seg="0">
            <span class="fin-bento-item-label"><i style="background:var(--sem-cpf);"></i>${srsBal > 0 ? "CPF + SRS Locked" : "CPF Locked"}</span>
            <span class="fin-bento-item-meta">OA ${compactMoney(p.oa || 0)} · SA ${compactMoney(p.sa || 0)} · MA ${compactMoney(p.ma || 0)}${srsBal > 0 ? ` · SRS ${compactMoney(srsBal)}` : ""}</span>
            <strong>${m(cpfSrsBal)} <small class="fin-bento-share-pill">${cpfShareW}%</small></strong>
          </li>`
              : ""
          }
          ${
            eqBal > 0
              ? `<li data-bento-seg="1">
            <span class="fin-bento-item-label"><i style="background:var(--sem-equities);"></i>Global &amp; SG equities</span>
            <span class="fin-bento-item-meta">
              ${m(bogle.buckets.equities || 0)} global · ${m(sgDivBal)} SG
              ${sgDivBal > 0 ? `<span class="overview-holding-yield">~${centsHtml(sgDivMoNow, "/mo")} SG dividends at 5%</span>` : ""}
            </span>
            <strong>${m(eqBal)} <small class="fin-bento-share-pill">${eqShareW}%</small></strong>
          </li>`
              : ""
          }
          ${
            cashBal > 0
              ? `<li data-bento-seg="2">
            <span class="fin-bento-item-label"><i style="background:var(--sem-cash);"></i>Cash &amp; SSBs</span>
            <span class="fin-bento-item-meta">${taps.tap4Ssb.effectiveRatePct.toFixed(2)}% blended EIR
              <span class="overview-holding-yield">~${centsHtml(cashMoNow, "/mo")} interest</span>
            </span>
            <strong>${m(cashBal)} <small class="fin-bento-share-pill">${cashShareW}%</small></strong>
          </li>`
              : ""
          }
          ${
            userLoanShare > 0
              ? `<li class="is-liability-row">
            <span class="fin-bento-item-label"><i style="background:var(--sem-alert);"></i>Mortgage Liability</span>
            <span class="fin-bento-item-meta">${housingModeLabel}</span>
            <strong>−${m(userLoanShare)}</strong>
          </li>`
              : ""
          }
        </ul>
        <div class="overview-passive-income">
          ${passiveMoNow > 0 ? `<p><span>Passive income</span> <strong>${centsHtml(passiveMoNow, "/mo")}${passiveYrNow > 0 ? ` · ${m(passiveYrNow, "/yr")}` : ""}</strong></p>` : ""}
          <button type="button" class="text-button" data-go-tab="dividend-calc">Yield calculator →</button>
        </div>
      </article>
      <article class="fin-bento-card overview-cashflow">
        <div class="fin-bento-head">
          <div>
            <h3 class="overview-breakdown-label">Monthly Cashflow</h3>
            <p class="fin-bento-title">${m(r.afterCpf, "/mo")} <small>pay after CPF</small></p>
          </div>
        </div>
        <div class="fin-bento-bar" aria-hidden="true">
          <span data-bento-seg="0" style="width:${saveW}%;" title="Saved &amp; Invested (${saveW}%)"></span>
          <span data-bento-seg="1" style="width:${fixedOutW}%;" title="Tax, Housing Cash &amp; Fixed Bills (${fixedOutW}%)"></span>
          ${livingW > 0 ? `<span data-bento-seg="2" style="width:${livingW}%;" title="Remaining for Living &amp; Discretionary (${livingW}%)"></span>` : ""}
        </div>
        <ul class="fin-bento-list">
          ${
            contribution > 0
              ? `<li data-bento-seg="0">
            <span class="fin-bento-item-label"><i></i>Saved &amp; Invested</span>
            <span class="fin-bento-item-meta">CPF, cash &amp; outside investments</span>
            <strong>${m(savedMo, "/mo")} <small class="fin-bento-share-pill">${saveW}%</small></strong>
          </li>`
              : ""
          }
          ${
            fixedOutMo > 0
              ? `<li data-bento-seg="1">
            <span class="fin-bento-item-label"><i></i>${housingCashMo > 0 ? "Tax, Cash Housing &amp; Bills" : "IRAS Tax &amp; Fixed Bills"}</span>
            <span class="fin-bento-item-meta">${housingCashMo > 0 ? `${m(monthlyTax)} tax · ${m(housingCashMo)} cash hsg · ${m(recurringTotal)} bills` : `${m(monthlyTax, "/mo")} tax · ${m(recurringTotal, "/mo")} fixed bills`}</span>
            <strong>${m(fixedOutMo, "/mo")}</strong>
          </li>`
              : ""
          }
          ${
            livingMo > 0
              ? `<li data-bento-seg="2">
                  <span class="fin-bento-item-label"><i></i>Remaining for Living</span>
                  <span class="fin-bento-item-meta">Food, transport, lifestyle &amp; extra saving</span>
                  <strong id="bento-spare-cash-val">+${m(livingMo, "/mo")}</strong>
                </li>`
              : livingMo < 0
                ? `<li class="is-deficit-cash-row" data-bento-seg="2">
                    <span class="fin-bento-item-label"><i style="background:var(--sem-alert);"></i>Monthly Cash Shortfall</span>
                    <strong id="bento-spare-cash-val">−${m(-livingMo, "/mo")}</strong>
                  </li>`
                : `<li data-bento-seg="2">
                    <span class="fin-bento-item-label"><i></i>Remaining for Living</span>
                    <span class="fin-bento-item-meta">Fully allocated to savings, tax &amp; bills</span>
                    <strong id="bento-spare-cash-val">${m(0, "/mo")}</strong>
                  </li>`
          }
        </ul>
        ${
          mandatoryCpfMo > 0
            ? `<p class="fin-bento-note">Also contributed to CPF: ${m(mandatoryCpfMo, "/mo")} (employee + employer)</p>`
            : ""
        }
      </article>

    </div>`;
}

function getMoneyMoves({
  fire,
  r,
  p,
  simulation,
  bogle,
  contribution,
  taps,
  tax,
  expenseData,
  cashflow: passedCashflow,
}) {
  const fn = fire.fireNumber;
  const moves = [];

  // Compute exact Unallocated Cash Surplus so we never recommend investing cash the user does not have
  const { netCashSurplus: rawSurplusMo, maxAffordableSaveMo } =
    passedCashflow ||
    computeMonthlyTakeHomeCashflow({
      r,
      simulation,
      contribution,
      p,
      tax,
      expenseData,
    });
  const unallocatedSurplusMo = Math.max(0, rawSurplusMo);

  // 0. Cashflow Over-Commitment Guardrail (when planned savings + tax + fixed bills exceed take-home pay)
  if (
    !r.retiringNow &&
    rawSurplusMo < -10 &&
    contribution > maxAffordableSaveMo
  ) {
    const excessOutflowMo = Math.abs(rawSurplusMo);
    moves.push({
      score: 6500 + excessOutflowMo,
      tone: "is-amber",
      title: `Cap savings at ${m(maxAffordableSaveMo, "/mo")}`,
      desc: "Planned savings, tax and bills exceed your pay after CPF.",
      action: "cap-affordable-save",
      value: maxAffordableSaveMo,
      actionLabel: "Apply cap",
      edit: 'data-quick-edit="invest"',
      editLabel: "Edit monthly investment",
    });
  }

  // 1. Close Retirement Shortfall (ONLY when < 100% funded AND user has Unallocated Cash Surplus >= $50/mo)
  if (
    (!fn.fullyFundedTo95 || fn.pctFunded < 100) &&
    unallocatedSurplusMo >= 50
  ) {
    const curInvestMo = Math.round(simulation.invest || 0);
    const neededInvest = Math.max(
      curInvestMo + 1,
      Math.ceil(fn.requiredInvestTo95 || fn.requiredMonthlyTo95 || 0),
    );
    const fullDeltaMo = Math.max(1, neededInvest - curInvestMo);
    const affordableDeltaMo = Math.min(fullDeltaMo, unallocatedSurplusMo);
    const targetInvestMo = curInvestMo + affordableDeltaMo;
    const closesFullGap = affordableDeltaMo >= fullDeltaMo;
    moves.push({
      score: 5000 + (100 - fn.pctFunded) * 20,
      tone: "is-amber",
      title: `Invest ${m(targetInvestMo, "/mo")} outside CPF`,
      desc: closesFullGap
        ? "Increasing your investment closes the projected retirement funding gap."
        : "Use your available cash surplus to narrow the projected retirement funding gap.",
      action: "match-save",
      value: targetInvestMo,
      actionLabel: "Increase investment",
      edit: 'data-quick-edit="invest"',
      editLabel: "Edit monthly investment",
    });
  }

  // 2. CPF SA RSTU Tax Relief (7%+ IRAS bracket with SA room < FRS AND sufficient Unallocated Cash Surplus)
  const curCpfExtraMo = Math.round(simulation.cpfExtra || 0);
  const curCpfExtraYr = curCpfExtraMo * 12;
  const maxRstuYr = tax?.maxRstu ?? RetirementModel.C.rstuReliefCap;
  const activeSelfRstuYr =
    tax?.activeSelfRstu ?? Math.min(curCpfExtraYr, maxRstuYr);
  const rstuRoomYr = Math.max(0, maxRstuYr - activeSelfRstuYr);
  const fullTargetCpfMo = Math.ceil(maxRstuYr / 12);
  const affordableCpfDeltaMo = Math.min(
    Math.max(0, fullTargetCpfMo - curCpfExtraMo),
    unallocatedSurplusMo,
  );
  const targetCpfMo = curCpfExtraMo + affordableCpfDeltaMo;
  const effectiveRstuRoomYr = Math.min(rstuRoomYr, affordableCpfDeltaMo * 12);
  // Compute progressive IRAS tax deltas from activeChargeableIncome (which already caps
  // RSTU at $8k / SA room, counts familyRstuAnnual, and enforces the $80k personal relief cap).
  const baseChargeable = Math.max(0, Number(tax?.chargeableIncome || 0));
  const curSrsYr = Math.round(p.srsAnnual || 0);
  const currentChargeable = Math.max(
    0,
    Number(
      tax?.activeChargeableIncome ??
        Math.max(0, baseChargeable - activeSelfRstuYr - curSrsYr),
    ),
  );
  const currentAnnualTax =
    RetirementModel.residentTax(currentChargeable).annualTax;
  const rstuSaveYr = Math.max(
    0,
    Math.round(
      currentAnnualTax -
        RetirementModel.residentTax(
          Math.max(0, currentChargeable - effectiveRstuRoomYr),
        ).annualTax,
    ),
  );
  if (
    (tax?.tier === "rstu-first" || tax?.tier === "max-both") &&
    unallocatedSurplusMo >= 50 &&
    effectiveRstuRoomYr >= 240 &&
    rstuSaveYr >= 15
  ) {
    moves.push({
      score: 3200 + rstuSaveYr,
      tone: "is-emerald",
      title: "Reduce income tax with a CPF top-up",
      desc: `Set top-ups to ${m(targetCpfMo, "/mo")} to save an estimated ${m(rstuSaveYr, "/yr")} in tax.`,
      action: "apply-rstu",
      value: targetCpfMo,
      actionLabel: "Increase top-up",
      edit: 'data-quick-edit="cpf-extra"',
      editLabel: "Edit extra CPF savings",
    });
  }

  // 3. SRS Tax Shelter — strictly gated: ONLY when taps.tap2Srs.worthIt is true AND user has Unallocated Cash Surplus
  const srsStartAge = tax?.srsWithdrawalStartAge ?? tax?.srsLockInAge ?? 63;
  const maxAffordableSrsYr = curSrsYr + unallocatedSurplusMo * 12;
  const maxSrsEligibleYr =
    maxRstuYr + (tax?.eligibleFamilyRstu || 0) > 0
      ? (tax?.maxSrsAfterRstu ?? RetirementModel.C.srsCap)
      : (tax?.maxSrsStandalone ?? RetirementModel.C.srsCap);
  const safeSrsTargetYr = Math.min(
    maxSrsEligibleYr,
    Math.max(0, Math.floor(tax?.srsMaxSafeAnnualTo400k || 0)),
    maxAffordableSrsYr,
  );
  const remSafeSrsYr = Math.max(0, safeSrsTargetYr - curSrsYr);
  const postRstuChargeable = Math.max(
    0,
    currentChargeable - (effectiveRstuRoomYr >= 240 ? effectiveRstuRoomYr : 0),
  );
  const remSafeSrsSaveYr = Math.max(
    0,
    Math.round(
      RetirementModel.residentTax(postRstuChargeable).annualTax -
        RetirementModel.residentTax(
          Math.max(0, postRstuChargeable - remSafeSrsYr),
        ).annualTax,
    ),
  );
  const srsWorthIt = Boolean(taps?.tap2Srs?.worthIt);

  if (
    srsWorthIt &&
    unallocatedSurplusMo >= 50 &&
    remSafeSrsYr >= 240 &&
    remSafeSrsSaveYr >= 25 &&
    tax?.srsTrapStatus !== "balloon-trap"
  ) {
    moves.push({
      score: 2800 + remSafeSrsSaveYr,
      tone: "is-emerald",
      title: `Set SRS contributions to ${m(safeSrsTargetYr, "/yr")}`,
      desc: `Estimated income tax savings of ${m(remSafeSrsSaveYr, "/yr")}.`,
      action: "apply-srs",
      value: safeSrsTargetYr,
      actionLabel: "Update SRS",
      edit: 'data-open-settings-field="known-srs-annual"',
      editLabel: "Edit annual SRS contributions",
    });
  } else if (curSrsYr > 0 && !srsWorthIt) {
    // Guardrail: user has SRS top-ups enabled in a low tax bracket where SRS lock-in is not worth it
    moves.push({
      score: 2750,
      tone: "is-amber",
      title: "Pause SRS contributions",
      desc: `At your current tax bracket, locking up cash until age ${srsStartAge} offers limited tax benefit.`,
      action: "apply-srs",
      value: 0,
      actionLabel: "Pause contributions",
      edit: 'data-open-settings-field="known-srs-annual"',
      editLabel: "Edit annual SRS contributions",
    });
  } else if (
    tax?.srsTrapStatus === "balloon-trap" &&
    curSrsYr > safeSrsTargetYr
  ) {
    moves.push({
      score: 2900,
      tone: "is-amber",
      title: `Cap SRS contributions at ${m(safeSrsTargetYr, "/yr")}`,
      desc: `Projected withdrawals exceed the tax-free band at age ${srsStartAge}.`,
      action: "apply-srs",
      value: safeSrsTargetYr,
      actionLabel: "Apply cap",
      edit: 'data-open-settings-field="known-srs-annual"',
      editLabel: "Edit annual SRS contributions",
    });
  }

  // 4. Invest Idle 0.05% SRS Cash
  if (
    p.srsInvestedIn === "cash" &&
    ((p.srs || 0) > 0 || (p.srsAnnual || 0) > 0)
  ) {
    const srsBal = Math.round(p.srs || 0);
    const srsSpread = Math.max(
      0,
      (r.investmentReturn ?? RetirementModel.C.investmentReturn) -
        RetirementModel.C.srsIdleRate,
    );
    const extraSrsYr = Math.max(50, Math.round(srsBal * srsSpread));
    moves.push({
      score: 2650 + extraSrsYr,
      tone: "is-amber",
      title: "Invest idle SRS cash in global ETFs",
      desc: `Idle SRS cash earns 0.05% p.a. and stays locked until age ${srsStartAge}.`,
      action: "invest-srs",
      actionLabel: "Invest SRS",
      edit: 'data-open-settings-field="known-srs-invested"',
      editLabel: "Edit SRS allocation",
    });
  }

  // 5. Cash Stack Overflow Sweep (when base-tier 0.05% bank overflow exists)
  const cashBd = taps.tap4Ssb.cashBreakdown;
  if (
    cashBd &&
    cashBd.sweepAnnualGain > 20 &&
    cashBd.totalOverflowBalance > 0
  ) {
    const gainYr = Math.round(cashBd.sweepAnnualGain);
    moves.push({
      score: 2500 + gainYr,
      tone: "is-blue",
      title: `Sweep ${m(cashBd.totalOverflowBalance)} from bank cash to SSBs`,
      desc: `Estimated extra interest of ${m(gainYr, "/yr")}.`,
      action: "sweep-cash",
      actionLabel: "Sweep cash",
      edit: 'data-go-tab="cash-accounts" data-open-page-cash-accounts',
      editLabel: "Edit cash accounts",
    });
  }

  // 6. CPF OA -> SA Interest Arbitrage (when OA > $25k buffer before age 55 and SA < FRS)
  if ((p.oa || 0) > 25000 && fire.age < 55 && (tax?.saRoom || 0) > 5000) {
    const oaExcess = Math.min(
      Math.max(0, Math.round((p.oa || 0) - 20000)),
      Math.round(tax.saRoom),
    );
    const extraSaYr = Math.round(oaExcess * 0.015);
    if (oaExcess >= 2000 && extraSaYr >= 30) {
      moves.push({
        score: 2300 + extraSaYr,
        tone: "is-blue",
        title: `Transfer ${m(oaExcess)} from OA to SA`,
        desc: `Keep your OA buffer and earn an estimated ${m(extraSaYr, "/yr")} more in CPF interest.`,
        action: "transfer-oa-sa",
        value: oaExcess,
        actionLabel: "Transfer to SA",
        edit: 'data-open-settings-field="known-oa"',
        editLabel: "Edit CPF OA balance",
      });
    }
  }

  // 7. Portfolio Rebalance (only deploy cash above the 6-month / $20k emergency reserve floor)
  const reb = computeRebalanceTargets(bogle, p, r);
  const { eqDriftPct, liqTotal, isUnderweightEq, shiftAmt } = reb;
  if (liqTotal >= 5000 && eqDriftPct >= 5) {
    if (shiftAmt >= 2000) {
      const defaultEqReturn = RetirementModel.SG_DEFAULT_PLAN.returnRate;
      const defaultSsbReturnPct =
        RetirementModel.DEFAULT_MAS_LIVE_RATES.ssb.year10Return;
      const rawReturnRate =
        p.returnRate == null || p.returnRate === ""
          ? defaultEqReturn
          : Number(p.returnRate);
      const eqReturnRate = Number.isFinite(rawReturnRate)
        ? rawReturnRate
        : defaultEqReturn;
      const rawCashRatePct =
        taps.tap4Ssb.effectiveRatePct == null ||
        taps.tap4Ssb.effectiveRatePct === ""
          ? defaultSsbReturnPct
          : Number(taps.tap4Ssb.effectiveRatePct);
      const cashRatePct = Number.isFinite(rawCashRatePct)
        ? rawCashRatePct
        : defaultSsbReturnPct;
      const rateDiff = Math.max(0.015, eqReturnRate - cashRatePct / 100);
      const annualBoost = Math.round(shiftAmt * rateDiff);
      moves.push({
        score: 2100 + annualBoost,
        tone: "is-blue",
        title: isUnderweightEq
          ? `Move ${m(shiftAmt)} from cash to equities`
          : `Move ${m(shiftAmt)} from equities to cash or SSBs`,
        desc: isUnderweightEq
          ? `Expected return increases by +${m(annualBoost, "/yr")} while preserving your emergency reserve.`
          : "Increase your fixed-income holdings to restore your target allocation.",
        action: "rebalance-portfolio",
        actionLabel: "Rebalance",
        edit: 'data-go-tab="allocator"',
        editLabel: "Edit portfolio allocation",
      });
    }
  }

  return moves.sort((a, b) => b.score - a.score);
}

function buildMoneyMovesStripHTML(topMoves) {
  if (topMoves.length === 0) return "";

  const renderRowContent = (move, headingTag, rank) => `
    <div class="fin-move-indicator" aria-hidden="true">
      ${rank ? `<span class="fin-move-rank">${rank}.</span>` : ""}
      ${move.tone === "is-amber" ? ICONS.alertTriangle : move.tone === "is-emerald" ? ICONS.checkTiny : ICONS.warnTiny}
    </div>
    <div class="fin-move-copy">
      <${headingTag} class="fin-move-title">${move.title}</${headingTag}>
      <p class="fin-move-desc">${move.desc}</p>
    </div>
    <div class="fin-move-actions">
      <button type="button" class="text-button fin-move-link" ${move.edit} aria-label="${move.editLabel}">Edit</button>
      <button type="button" class="button button-primary button-small fin-move-cta" data-money-move="${move.action}"${move.value == null ? "" : ` data-move-val="${move.value}"`}>${move.actionLabel}</button>
    </div>`;

  if (topMoves.length === 1) {
    const [move] = topMoves;
    return `<section class="fin-moves-strip fin-move-row ${move.tone}" id="fin-money-moves" aria-label="Actionable Insights">
      ${renderRowContent(move, "h2")}
    </section>`;
  }

  return `<section class="overview-insights-group" aria-labelledby="fin-moves-title">
    <div class="swell-section-head"><h2 id="fin-moves-title">Actionable Insights</h2></div>
    <div class="fin-moves-strip" id="fin-money-moves">
    <ol class="fin-moves-list" role="list">
      ${topMoves
        .map(
          (move, index) => `
        <li class="fin-move-row ${move.tone}">
          ${renderRowContent(move, "h3", index + 1)}
        </li>`,
        )
        .join("")}
    </ol>
    </div>
  </section>`;
}

function buildRetirementIncomeTile({
  title,
  figure,
  description,
  progress,
  chip,
  emptyAction,
  detailsLabel,
  detailsHTML,
}) {
  return `<article class="swell-tap-box overview-income-tile">
    <div class="overview-income-tile-head">
      <h3>${title}</h3>
      ${chip && !emptyAction ? `<span class="status-pill ${chip.tone}">${escapeAttr(chip.label)}</span>` : ""}
    </div>
    ${
      emptyAction
        ? `<div class="overview-income-empty">
          <p><strong>${figure}</strong> <span>· Not in use</span></p>
          <button type="button" class="text-button" data-open-settings-field="${emptyAction.field}">${emptyAction.label}</button>
        </div>`
        : `<strong class="overview-income-figure">${figure}</strong>
        <p>${description}</p>`
    }
    ${
      progress && !emptyAction
        ? `<div class="tap-progress-track" role="progressbar" aria-valuenow="${progress.pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${escapeAttr(progress.label)}">
      <span class="tap-progress-fill ${progress.tone || "is-blue"}" style="width:${progress.pct}%"></span>
    </div>`
        : ""
    }
    <details class="overview-disclosure-card tap-accordion">
      <summary class="overview-disclosure-summary">${detailsLabel}</summary>
      <div class="overview-disclosure-body overview-income-rules">${detailsHTML}</div>
    </details>
  </article>`;
}

export function buildFinOverviewGrid(
  fire,
  r,
  s,
  p,
  simulation,
  bogle,
  pctOfPay,
  selected,
  isCustomSpend = false,
  expenseData = null,
  masRates = null,
  tax = null,
  rangeNote = "",
  suggestedSavings = {},
) {
  const contribution = r.retiringNow
    ? simulation.cpfExtra + s.privateSaving
    : simulation.cpfExtra + (simulation.cashSaving || 0) + simulation.invest;

  const cpfCov65Pct = Math.min(
    100,
    Math.round((s.payout / Math.max(1, r.spend65)) * 100),
  );
  const ptAtRetire =
    fire.atRetire ||
    fire.points.find((pt) => pt.age === Math.round(fire.retire)) ||
    fire.points[fire.points.length - 1];
  const retireNw = ptAtRetire?.today?.totalNetWorth ?? 0;
  const chartStatus =
    fire.fireNumber.pctFunded >= 100 && fire.fireNumber.fullyFundedTo95
      ? "On track"
      : "Shortfall";
  const chartMilestones = [65, 95]
    .map((age) => {
      const point = fire.points.find((entry) => entry.age === age);
      return point?.today
        ? `Age ${age}: ${money(point.today.totalNetWorth)}.`
        : "";
    })
    .filter(Boolean);

  const paycheck = RetirementModel.paycheckAllocation(r, simulation, bogle, p);
  const grossPlusEmployer = paycheck.grossPlusEmployer;
  const paycheckBars = paycheck.rows;

  const [, cpfMilestone, retirementMilestone, horizonMilestone] =
    getMilestoneNodes(fire, r, s, simulation);
  const endAge = fire.endAge;
  const milestones = [
    cpfMilestone,
    {
      ...retirementMilestone,
      title: "Retirement starts",
      metric: "",
      sub:
        r.retire < 65
          ? "Draw from savings before CPF LIFE starts"
          : "CPF LIFE in payment",
    },
    {
      ...horizonMilestone,
      title: `Net worth at age ${endAge}`,
      tag: "",
      sub: fire.fireNumber.fullyFundedTo95
        ? "Spending funded throughout the planning horizon"
        : `Spending funded until age ${Math.floor(fire.fireNumber.depletionAge ?? endAge)} · net worth includes CPF`,
    },
  ];
  const startPt = fire.points[0];
  const startingCpf = startPt?.cpfTotal ?? 0;
  const startingSrs = startPt?.srs ?? 0;
  const startingOutside = startPt?.totalOutside ?? 0;
  const startingTotalAssets = startingCpf + startingOutside;
  const selectedPathName =
    s.key === "brs"
      ? "BRS Pledge"
      : s.key === "ers"
        ? "ERS Path"
        : s.key === "salary"
          ? "CPF Salary Only"
          : "FRS Path";
  const isItemizedTarget = Boolean(expenseData?.itemizedActive);
  const lifestyleCardLabel = isItemizedTarget
    ? "Custom itemized"
    : isCustomSpend
      ? "Custom"
      : r.lifestyle === "cca"
        ? "Community Care"
        : "Home + Helper";
  const lifestyleCardAria = `${lifestyleCardLabel} (${money(r.todaySpend)}/mo)`;

  const pathMeta = {
    brs: {
      name: "BRS (Property Pledge)",
      tag: "50% Sum · Liquid OA",
      accent: "#0F766E",
      softBg: "#F0FDFA",
      icon: svgWrap(
        '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
        16,
      ),
      note: `Caps age-55 RA at ${compactMoney(r.brs || r.frs / 2)} BRS (property lease to 95+); excess stays in 2.5% liquid OA.`,
    },
    frs: {
      name: "FRS Target",
      tag: "Standard Sum",
      accent: "#1D4ED8",
      softBg: "#EFF6FF",
      icon: svgWrap(
        '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
        16,
      ),
      note: `Targets ${compactMoney(r.frs)} cohort FRS (today’s $) by 55 for steady baseline CPF LIFE.`,
    },
    ers: {
      name: "ERS Maximum",
      tag: "Max Floor",
      accent: "#047857",
      softBg: "#ECFDF5",
      icon: svgWrap('<path d="M3 3v18h18"/><path d="m7 14 4-4 4 3 5-6"/>', 16),
      note: `Voluntary RA top-ups toward ${compactMoney(r.ers)} ERS (today’s $); highest lifelong income.`,
    },
  };

  const activePaycheck = finActivityTab === "paycheck";
  const activeMilestones = !activePaycheck;
  const activeSegIdx = activePaycheck ? 1 : 0;

  const taps = RetirementModel.retirementTapsPlan({
    summary: r,
    selectedScenario: s,
    simulation,
    fire,
    bogle,
    tax,
    params: p,
    masRates,
  });
  const { ssbPctOf150k } = buildFundingSourcesList(taps, r, s, cpfCov65Pct);
  const cashflow = computeMonthlyTakeHomeCashflow({
    r,
    simulation,
    contribution,
    p,
    tax,
    expenseData,
  });

  const moves = getMoneyMoves({
    fire,
    r,
    p,
    simulation,
    bogle,
    contribution,
    taps,
    tax,
    expenseData,
    cashflow,
  });
  const primaryMove = moves.find(
    (move) =>
      move.action === "cap-affordable-save" || move.action === "match-save",
  );
  let recommendation = null;
  if (primaryMove) {
    const caps = primaryMove.action === "cap-affordable-save";
    const nextParams = {
      ...p,
      ...(masRates ? { masRates } : {}),
      ...(caps
        ? getCappedSavings(primaryMove.value, p, simulation)
        : { invest: primaryMove.value }),
    };
    try {
      const projected = RetirementModel.solveBucketAwareSimulation(
        nextParams,
        caps && selected === "salary" ? "frs" : selected,
      );
      const nextSimulation = projected.simulation;
      const nextContribution = r.retiringNow
        ? nextSimulation.cpfExtra +
          nextSimulation.selectedScenario.privateSaving
        : nextSimulation.cpfExtra +
          (nextSimulation.cashSaving || 0) +
          nextSimulation.invest;
      const rate =
        r.afterCpf > 0 ? Math.round((100 * nextContribution) / r.afterCpf) : 0;
      const nextCashflow = computeMonthlyTakeHomeCashflow({
        r,
        simulation: nextSimulation,
        contribution: nextContribution,
        p: nextParams,
        tax: RetirementModel.taxSweetSpot(nextParams, {
          simulation: nextSimulation,
        }),
        expenseData,
      });
      recommendation = {
        move: primaryMove,
        funded: projected.fire.fireNumber.pctFunded,
        rate,
        health: savingsHealth(rate, nextCashflow),
      };
    } catch {
      // An unavailable preview leaves the existing recommendation in Actionable Insights.
    }
  }
  const currentHealth = savingsHealth(pctOfPay, cashflow);
  const overviewInputs = [
    ["known-cpf-extra", "Extra CPF savings", p.cpfExtra ?? simulation.cpfExtra],
    [
      "known-cash-saving",
      "Cash savings",
      p.cashSaving ?? simulation.cashSaving ?? 0,
    ],
    ["known-invest", "Outside investments", p.invest ?? simulation.invest],
  ];

  const savingsMarkers = [
    ["Now", pctOfPay, currentHealth.label],
    ...(recommendation
      ? [["After", recommendation.rate, recommendation.health.label]]
      : []),
  ];
  const staggerSavingsLabels =
    recommendation &&
    Math.abs(Math.min(100, recommendation.rate) - Math.min(100, pctOfPay)) < 32;

  return `${buildOverviewPageHeader({ fire, r, startingTotalAssets, rate: pctOfPay, recommendation, budget: expenseData?.total })}
  <section class="swell-section-block" aria-label="Wealth trajectory, income taps, and retirement readiness">
    <div class="swell-section-head">
      <h2>Trajectory &amp; Readiness</h2>
    </div>
    <div class="swell-discover-grid">
      <section class="fin-card fin-hero-card card-surface" aria-labelledby="ember-traj-title">
        <div class="overview-chart-head">
          <div class="swell-mini-kpi is-primary">
            <h3 id="ember-traj-title">Net Worth at Age ${fire.retire}</h3>
            <div class="fin-big-figure-row">
              <strong class="fin-big-figure" id="hero-nw-live">${m(retireNw, "", "hero-nw")}</strong>
            </div>
          </div>
          <button type="button" class="text-button overview-projection-link" data-go-tab="trajectory">View projection →</button>
        </div>
        <div class="chart-wrapper">
          <div id="dash-networth-chart" class="chart-area" role="img" aria-label="Stacked net worth trajectory from age ${fire.age} to ${fire.endAge}" aria-describedby="overview-networth-description"></div>
          <p class="sr-only" id="overview-networth-description">Projected net worth in today’s dollars. ${chartMilestones.join(" ")} ${chartStatus}.</p>
          <div id="dash-networth-tooltip" class="chart-tooltip" hidden></div>
        </div>
        <div class="chart-legend fin-chart-legend" id="dash-networth-legend" role="group" aria-label="Net worth chart layers"></div>
      </section>

      <section class="fin-card fin-activity-card card-surface" aria-label="Key milestones and paycheck allocation">
        <div class="fin-activity-head">
          <h3>Milestones &amp; Paycheck</h3>
          <button type="button" class="fin-link-pill" data-go-tab="budget">Edit budget</button>
        </div>
        <div class="fin-segmented-tabs" id="fin-activity-tabs" data-seg-idx="${activeSegIdx}" style="--seg-idx:${activeSegIdx};--seg-count:2" role="tablist" aria-label="Cashflow and milestone views">
          <button type="button" role="tab" class="fin-seg-tab${activeMilestones ? " is-active" : ""}" data-fin-activity="milestones" aria-selected="${activeMilestones}">Milestones</button>
          <button type="button" role="tab" class="fin-seg-tab${activePaycheck ? " is-active" : ""}" data-fin-activity="paycheck" aria-selected="${activePaycheck}">Paycheck</button>
        </div>

        <div class="fin-activity-pane" ${activeMilestones ? "" : "hidden"}>
          <ul class="ember-feed-list">
            ${milestones
              .map(
                (
                  n,
                  idx,
                ) => `<li class="ember-feed-item" style="--item-idx:${idx}">
                  <span class="ember-feed-avatar" style="background:${n.softBg};color:${n.color};">${n.badge}</span>
                  <div class="ember-feed-info">
                    <strong>${n.title}</strong>
                    <span>${n.tag ? `${n.tag} · ` : ""}${n.sub}</span>
                  </div>
                  ${n.metric ? `<div class="ember-feed-right"><b>${n.metric}</b></div>` : ""}
                </li>`,
              )
              .join("")}
          </ul>
          <div class="fin-coverage-card">
            <div class="fin-cov-head">
              <span>Age-65 income split · CPF LIFE and savings</span>
              <strong>${m(r.spend65, "/mo")} need</strong>
            </div>
            <div class="fin-cov-track" aria-hidden="true">
              <span class="fin-cov-cpf" data-meter-key="cov-cpf" data-meter-w="${cpfCov65Pct}" style="width:${cpfCov65Pct}%"></span>
              <span class="fin-cov-out" data-meter-key="cov-out" data-meter-w="${Math.max(0, 100 - cpfCov65Pct)}" style="width:${Math.max(0, 100 - cpfCov65Pct)}%"></span>
            </div>
            <div class="fin-cov-legend">
              <span><i style="background:#10B981;"></i>CPF LIFE <b>${cpfCov65Pct}%</b></span>
              <span><i style="background:#2563EB;"></i><b>${m(s.gap65, "/mo")}</b> from savings, including SSBs (${Math.max(0, 100 - cpfCov65Pct)}%)</span>
            </div>
          </div>
        </div>

        <div class="fin-activity-pane" ${activePaycheck ? "" : "hidden"}>
          <div class="ember-bars-list">
            ${paycheckBars
              .map((row, idx) => {
                const w = Math.min(
                  100,
                  Math.round((row.amt / Math.max(1, grossPlusEmployer)) * 100),
                );
                return `<div class="ember-bar-row" style="--item-idx:${idx}">
                  <div class="ember-bar-meta">
                    <span><i style="background:${row.color};"></i>${row.label} <small>(${m(row.amt)})</small></span>
                    <span class="swell-slate-pill">${w}%</span>
                  </div>
                  <div class="ember-bar-track" aria-hidden="true">
                    <span style="width:${row.amt > 0 ? Math.max(3, w) : 0}%;background:${row.color};"></span>
                  </div>
                </div>`;
              })
              .join("")}
          </div>
          <div class="ember-card-foot">

            <button type="button" class="text-button" data-go-tab="allocator">Allocator →</button>
          </div>
        </div>
      </section>

    </div>
  </section>

  <section class="swell-section-block" aria-labelledby="overview-savings-title">
    <div class="swell-section-head"><h2 id="overview-savings-title">Monthly Savings &amp; Investment Plan</h2></div>
    <div class="overview-savings card-surface">
    <div class="overview-total-saving">
      <span>Total saving</span>
      <strong class="overview-savings-total">${r.retiringNow ? "Saving paused" : m(contribution, "/mo")}</strong>
    </div>
    ${
      r.retiringNow
        ? `<p>Outside capital needed now ${m(s.privateSaving)}</p>`
        : `
      <div class="overview-saving-fields" role="group" aria-label="Monthly savings amounts">
        ${overviewInputs
          .map(([id, label, value]) => {
            const suggestion = suggestedSavings[id];
            const formattedSuggestion =
              Math.round(value) === Math.round(suggestion)
                ? centsHtml(suggestion)
                : m(suggestion);
            return `
          <div class="overview-saving-field">
            <span>${label}</span>
            <button type="button" class="overview-saving-figure" id="overview-edit-${id}" data-overview-saving-edit aria-expanded="false" aria-controls="overview-editor-${id}">
              <span class="sr-only">Edit ${label.toLowerCase()}: </span>
              ${m(Number(value ?? 0), "/mo")}
              ${svgWrap('<path d="m13.5 6.5 4 4M4 20l4.5-1 11-11a2.8 2.8 0 0 0-4-4l-11 11L4 20Z"/>', 15)}
            </button>
            <div class="overview-saving-editor" id="overview-editor-${id}" hidden>
              <span aria-hidden="true">$</span>
              <input type="number" min="0" max="${Math.max(0, Math.floor(r.afterCpf))}" step="any" inputmode="decimal" id="overview-${id}" data-overview-saving="${id}" value="${Number(Number(value ?? 0).toFixed(2))}" aria-label="${label} in dollars per month" aria-describedby="overview-saving-message">
              <span aria-hidden="true">/mo</span>
            </div>
            <div class="overview-saving-hint">
              <button type="button" class="text-button overview-saving-suggestion" data-use-suggested="${id}" hidden aria-label="Use suggested ${label.toLowerCase()} of ${Number(suggestion).toFixed(2)} dollars per month">
                <span>Suggested: ${formattedSuggestion}</span><span aria-hidden="true">·</span><strong>Use</strong>
              </button>
            </div>
          </div>`;
          })
          .join("")}
      </div>
      <p class="settings-error" id="overview-saving-message" role="status"></p>
      <div class="overview-saving-health" role="group" aria-label="Savings rate as a share of pay after CPF">
        <div class="overview-saving-meter${staggerSavingsLabels ? " is-staggered" : ""}">
          <div class="overview-saving-track" aria-hidden="true"></div>
          ${savingsMarkers
            .map(
              ([name, rate, band], index) => `
            <div class="overview-saving-marker${index ? " is-preview" : ""}" style="--saving-position:${Math.max(0, Math.min(100, rate))}%">
              <span class="overview-saving-marker-label">${name} <strong${index ? "" : " data-current-savings-rate"}>${rate}%</strong><span class="sr-only"${index ? "" : " data-current-savings-band"}>${band}</span></span>
            </div>`,
            )
            .join("")}
        </div>
        <ul class="overview-saving-zones" aria-label="Savings rate bands">
          <li><strong>Healthy</strong> <span>≤50%</span></li>
          <li><strong>Stretched</strong> <span>51–85%</span></li>
          <li><strong>Critical</strong> <span>&gt;85%</span></li>
        </ul>
        ${cashflow.netCashSurplus < 0 ? `<p>Monthly gap after tax and bills ${m(-cashflow.netCashSurplus)}</p>` : ""}
      </div>
    `
    }
    <details class="overview-disclosure-card" id="overview-saving-details">
      <summary class="overview-disclosure-summary">Savings projections</summary>
      <div class="overview-disclosure-body">
      <dl class="overview-saving-projections">
        <div><dt>Cash &amp; bonds at ${fire.retire}</dt><dd>${m(taps.tap4Ssb.projectedSsbCashAtRetireToday)}</dd></div>
        <div><dt>Equities at ${fire.retire}</dt><dd>${m(taps.tap3Equities.projectedInvestAtRetireToday)}</dd></div>
      </dl>
      <button type="button" class="text-button" data-go-tab="allocator">Edit allocation</button>
      </div>
    </details>
    </div>
  </section>

  <section class="swell-section-block" id="cpf-strategy-comparison" aria-label="CPF strategy paths and retirement income architecture">
    <div class="swell-section-head">
      <h2>CPF Strategy &amp; Income Architecture</h2>
    </div>
    <section class="fin-card fin-table-card card-surface swell-path-full-card" aria-labelledby="ledger-title">
      <div class="ember-card-head">
        <div>
          <h3 id="ledger-title">CPF Retirement Path</h3>
          <p>${r.retiringNow ? "With retirement set to now, BRS, FRS and ERS model Age-55 Retirement Sum levels using current balances or lump-sum top-ups." : "Compare BRS (Property Pledge), FRS Target, and ERS Maximum to set your Age-55 Retirement Sum and lifelong CPF LIFE income."}</p>
        </div>
        <div class="ember-card-actions">
          <div class="cpf-plan-inline-toggle" role="group" aria-label="CPF LIFE payout plan">
            <button type="button" class="cpf-plan-chip${r.plan !== "escalating" ? " is-active" : ""}" data-toggle-cpf-plan="standard" aria-pressed="${r.plan !== "escalating"}">Standard</button>
            <button type="button" class="cpf-plan-chip${r.plan === "escalating" ? " is-active" : ""}" data-toggle-cpf-plan="escalating" aria-pressed="${r.plan === "escalating"}">Escalating +2%/yr</button>
          </div>
        </div>
      </div>
      ${rangeNote}
      <div class="table-scroll">
        <table class="ember-ledger-table fin-table is-row-selectable">
          <caption class="sr-only">CPF Retirement Path comparison across BRS, FRS, and ERS strategies</caption>
          <thead>
            <tr>
              <th scope="col">Strategy Path</th>
              <th scope="col" class="num-col">Age-55 CPF</th>
              <th scope="col" class="num-col">Extra CPF</th>
              <th scope="col" class="num-col">${r.retiringNow ? "Outside capital needed" : "Outside invest"}</th>
              <th scope="col" class="num-col">CPF LIFE (65+)</th>
            </tr>
          </thead>
          <tbody>
            ${[
              ...(r.brsScenario ? [r.brsScenario] : []),
              ...r.scenarios.slice(1),
            ]
              .map((path) => {
                const meta = pathMeta[path.key] || pathMeta.frs;
                const isSelected = path.key === selected;
                const rowBal = isSelected ? s.balance : path.balance;
                const rowCpf =
                  isSelected && !r.retiringNow
                    ? simulation.cpfExtra || 0
                    : path.cpfFunding;
                const rowOut =
                  isSelected && !r.retiringNow
                    ? simulation.invest || 0
                    : path.privateSaving;
                const rowLife = isSelected ? s.payout : path.payout;
                const cpfDiffers =
                  isSelected &&
                  !r.retiringNow &&
                  Math.abs(rowCpf - path.cpfFunding) > 1;
                const outDiffers =
                  isSelected &&
                  !r.retiringNow &&
                  Math.abs(rowOut - s.privateSaving) > 1;
                return `<tr class="ledger-selectable-row${isSelected ? " is-selected" : ""}" data-path="${path.key}">
                  <td>
                    <input type="radio" name="overview-cpf-path" class="sr-only ledger-path-selector" id="overview-cpf-path-${path.key}" data-path="${path.key}" ${isSelected ? "checked" : ""} aria-label="${escapeAttr(meta.name)} (${escapeAttr(meta.tag)}): Age-55 CPF ${money(rowBal)}, CPF LIFE ${money(rowLife)}/mo">
                    <label for="overview-cpf-path-${path.key}" class="ledger-path-select-btn">
                      <span class="fin-table-path">
                        <span class="ledger-row-radio${isSelected ? " is-active" : ""}" aria-hidden="true"></span>
                        <span class="fin-path-icon" style="background:${meta.softBg};color:${meta.accent};">${meta.icon}</span>
                        <span>
                          <span class="ledger-path-cell">
                            <strong>${meta.name}</strong>
                            <span class="ledger-tag">${meta.tag}</span>
                          </span>
                          <small class="ledger-sub">${meta.note}</small>
                        </span>
                      </span>
                    </label>
                  </td>
                  <td class="num-cell num-col" data-label="Age-55 CPF">${m(rowBal, "", `path-${path.key}-bal`)}</td>
                  <td class="num-cell num-col" data-label="Extra CPF">${m(rowCpf, r.retiringNow ? " now" : "/mo", `path-${path.key}-cpf`)}${cpfDiffers ? `<small class="ledger-cell-sub">Path: ${m(path.cpfFunding, "/mo")}</small>` : ""}</td>
                  <td class="num-cell num-col" data-label="${r.retiringNow ? "Outside capital needed" : "Outside invest"}">${m(rowOut, r.retiringNow ? " now" : "/mo", `path-${path.key}-out`)}${outDiffers ? `<small class="ledger-cell-sub">Target: ${m(s.privateSaving, "/mo")}</small>` : ""}</td>
                  <td class="num-cell num-col" data-label="CPF LIFE (65+)"><strong>${m(rowLife, "/mo", `path-${path.key}-life`)}</strong></td>
                </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>
      <details class="overview-disclosure-card" id="overview-methodology">
        <summary class="overview-disclosure-summary">CPF rules and methodology</summary>
        <div class="overview-disclosure-body ember-disclaimer-body">
          <ul>
            <li><strong>Purchasing power &amp; return:</strong> Shows today’s dollars (${Number((r.inflation * 100).toFixed(1))}% inflation, ${Number((r.investmentReturn * 100).toFixed(1))}% blended net outside return including ETFs/SSB; ${r.post55Work ? "post-55 salary CPF included" : "post-55 work contributions excluded"}).</li>
            <li><strong>2026 CPF &amp; IRAS rules:</strong> OW ceiling ${m(RetirementModel.C.wageCap, "/mo")}, Basic Healthcare Sum ${m(RetirementModel.C.bhs)}, FRS ${m(RetirementModel.C.frs)}, ERS ${m(RetirementModel.C.ers)}, and ${m(RetirementModel.C.personalReliefCap)} personal relief cap.</li>
            <li><strong>Irreversible actions:</strong> Cash RSTU and OA-to-SA transfers before 55 cannot be reversed and receive $0 tax relief once SA/RA hits FRS. <button type="button" class="footnote-link-btn" commandfor="plan-settings" command="show-modal" aria-haspopup="dialog">Review assumptions ↗</button></li>
          </ul>
        </div>
      </details>
    </section>
  </section>

  ${buildMoneyMovesStripHTML(moves.filter((move) => move !== recommendation?.move).slice(0, 3))}
  <section class="swell-section-block overview-breakdown-section" aria-labelledby="overview-breakdown-title">
    <details class="overview-disclosure-card overview-detail card-surface" id="overview-portfolio-details">
      <summary class="overview-disclosure-summary overview-section-summary"><h2 id="overview-breakdown-title">Portfolio &amp; Cashflow Breakdown</h2></summary>
      <div class="overview-disclosure-body">
        <div class="overview-breakdown-edit-mobile"><button type="button" class="text-button" data-open-profile>Edit plan inputs</button></div>
        ${buildFinBentoGridHTML({
          r,
          p,
          bogle,
          contribution,
          taps,
          cashflow,
          startingCpf,
          startingSrs,
          startingTotalAssets,
        })}
      </div>
    </details>
    <button type="button" class="text-button overview-edit-plan" data-open-profile>Edit plan inputs</button>
  </section>
  <section class="swell-section-block" aria-labelledby="taps-blueprint-title">
    <details class="overview-disclosure-card overview-detail card-surface" id="retirement-taps-card">
      <summary class="overview-disclosure-summary overview-section-summary"><h2 id="taps-blueprint-title">How your retirement income is funded</h2></summary>
      <div class="overview-disclosure-body">
        <div class="swell-taps-grid">
        ${(() => {
          const tap1Pct = taps.tap1Cpf.budgetCoveragePct ?? cpfCov65Pct;
          const srsZeroTaxCap =
            taps.tap2Srs.srsZeroTaxCap || RetirementModel.C.srsSoftCapAt63;
          const srsZeroTaxCapCompact = compactMoney(srsZeroTaxCap);
          const srsTrapFloor =
            taps.tap2Srs.trapFloorAt63 || RetirementModel.C.srsTrapFloorAt63;
          const srsTrapFloorCompact = compactMoney(srsTrapFloor);
          const srsTrapCeilingCompact = compactMoney(
            taps.tap2Srs.trapCeilingAt63 ||
              RetirementModel.C.srsTrapCeilingAt63,
          );
          const tap2Pct = Math.min(
            100,
            Math.round(
              (taps.tap2Srs.projectedAt63 / Math.max(1, srsZeroTaxCap)) * 100,
            ),
          );
          const tap3Pct = taps.tap3Equities.gapCoveragePct ?? 100;
          const srsMarginalPct = ((taps.tap2Srs.marginalRate ?? 0) * 100)
            .toFixed(1)
            .replace(/\.0$/, "");
          const tap2PillTone =
            taps.tap2Srs.verdictStatus === "trap-alert" ||
            taps.tap2Srs.verdictStatus === "idle-cash"
              ? "is-danger"
              : taps.tap2Srs.verdictStatus === "rstu-first"
                ? "is-good"
                : "is-info";
          const hasAnyRstu =
            (taps.tap2Srs.maxRstu || 0) +
              (taps.tap2Srs.eligibleFamilyRstu || 0) >
            0;
          const srsTaxSavedVal = hasAnyRstu
            ? taps.tap2Srs.srsTaxSavedAfterRstu
            : taps.tap2Srs.srsStandaloneTaxSaved;
          const srsEligibleCap = hasAnyRstu
            ? taps.tap2Srs.maxSrsAfterRstu
            : (taps.tap2Srs.maxSrsStandalone ?? taps.tap2Srs.annualCap);
          let tap2BodyHTML;
          if (taps.tap2Srs.verdictStatus === "trap-alert") {
            tap2BodyHTML = `<strong>Ballooning Trap Alert:</strong> Projected <strong>${m(taps.tap2Srs.projectedAt63)}</strong> nominal pot at age <strong>${taps.tap2Srs.startAge}</strong> exceeds ${srsTrapFloorCompact} (~<strong>${m(taps.tap2Srs.withdrawalTaxAnnual, "/yr")}</strong> withdrawal tax). Cap annual SRS at <strong>≤${m(taps.tap2Srs.maxSafeAnnualTo400k, "/yr")}</strong> and invest overflow in brokerage.`;
          } else if (taps.tap2Srs.verdictStatus === "idle-cash") {
            tap2BodyHTML = `<strong>Action needed:</strong> Your SRS (<strong>${m(taps.tap2Srs.srsBalanceToday)}</strong> balance${taps.tap2Srs.srsAnnualPlanned > 0 ? ` + ${m(taps.tap2Srs.srsAnnualPlanned, "/yr")}` : ""}) is set to <strong>0.05% idle cash</strong>. Switch SRS mode to Global ETFs, 60/40, or SSBs so inflation doesn’t erode your tax relief.`;
          } else if (taps.tap2Srs.verdictStatus === "cap-full") {
            tap2BodyHTML = `Your <strong>$80,000 IRAS personal relief cap</strong> is already full, so SRS gives <strong>$0 tax relief</strong>. Route extra savings directly into your liquid brokerage instead.`;
          } else if (taps.tap2Srs.verdictStatus === "skip-low-tax") {
            tap2BodyHTML = `At your <strong>${srsMarginalPct}%</strong> IRAS bracket (${m(taps.tap2Srs.chargeableIncome)} chargeable), <strong>skip SRS for now</strong> — tax savings are too small to lock funds until <strong>${taps.tap2Srs.startAge}</strong>. Prioritize liquid ETFs &amp; SSBs.`;
          } else if (taps.tap2Srs.verdictStatus === "rstu-first") {
            tap2BodyHTML = `At your <strong>${srsMarginalPct}%</strong> IRAS bracket, <strong>prioritize CPF RSTU first</strong> (up to <strong>${m(taps.tap2Srs.maxRstu, "/yr")}</strong> → saves <strong>${m(taps.tap2Srs.rstuTaxSaved, "/yr")}</strong> + 4% floor) before locking cash in SRS${taps.tap2Srs.srsAnnualPlanned > 0 ? ` (currently ${m(taps.tap2Srs.srsAnnualPlanned, "/yr")} → ${m(taps.tap2Srs.tenYearMonthlyDrawToday, "/mo")} bridge)` : ""}.`;
          } else if (taps.tap2Srs.srsAnnualPlanned > 0) {
            tap2BodyHTML = `At your <strong>${srsMarginalPct}%</strong> IRAS bracket, SRS is <strong>worth it</strong>: contributing <strong>${m(taps.tap2Srs.srsAnnualPlanned, "/yr")}</strong> builds <strong>${m(taps.tap2Srs.projectedAt63Today)}</strong> (today’s $) by <strong>${taps.tap2Srs.startAge}</strong> (<strong>${m(taps.tap2Srs.tenYearMonthlyDrawToday, "/mo")}</strong> 10-yr bridge, ≤$40k/yr nominal tax-free).`;
          } else {
            tap2BodyHTML = `At your <strong>${srsMarginalPct}%</strong> IRAS bracket, SRS is <strong>worth it</strong> — saves up to <strong>${m(srsTaxSavedVal, "/yr")}</strong> tax on <strong>${m(srsEligibleCap, "/yr")}</strong> (after RSTU). Add an annual SRS contribution in <strong>Tax Relief</strong> and invest it immediately.`;
          }
          return [
            buildRetirementIncomeTile({
              title: "Cover essentials with CPF LIFE",
              figure: `${tap1Pct}%`,
              description: "Share of the age-65 budget covered by CPF LIFE.",
              progress:
                r.spend65 > 0
                  ? {
                      pct: tap1Pct,
                      label: "CPF LIFE coverage of the age-65 budget",
                    }
                  : null,
              detailsLabel: "CPF LIFE and OA withdrawal rules",
              detailsHTML: `<p>The <strong>${selectedPathName}</strong> pays <strong>${m(taps.tap1Cpf.monthlyPayoutToday, "/mo")}</strong> from age 65 (${r.plan === "escalating" ? "Escalating +2%/yr" : "Standard"}). 2026 anchors: BRS $950 · FRS $1,780 · ERS $3,440/mo.</p>
                <p>Projected liquid OA at 55: <strong>${m(taps.tap1Cpf.oaAt55Today)}</strong> today’s value (${m(taps.tap1Cpf.oaAt55Nominal)} nominal), earning <strong>${m(taps.tap1Cpf.oaInterestMonthlyToday, "/mo")}</strong> at 2.5% p.a. OA is withdrawable once FRS is met. As a reference, ${m(taps.tap1Cpf.oa500kRefBalance)} in OA earns about ${m(taps.tap1Cpf.oa500kRefMonthly, "/mo")}.</p>`,
            }),
            buildRetirementIncomeTile({
              title: "Bridge income with SRS",
              figure: m(taps.tap2Srs.projectedAt63Today),
              description: `Projected pot at age ${taps.tap2Srs.startAge} in today’s dollars.`,
              emptyAction:
                taps.tap2Srs.projectedAt63 > 0
                  ? null
                  : { field: "known-srs-annual", label: "Add SRS" },
              chip: {
                tone: tap2PillTone,
                label: taps.tap2Srs.verdictLabel || "SRS tax rules",
              },
              progress:
                taps.tap2Srs.projectedAt63 > 0
                  ? {
                      pct: tap2Pct,
                      label: `SRS pot toward ${money(srsZeroTaxCap)} soft cap`,
                      tone:
                        taps.tap2Srs.trapStatus === "balloon-trap"
                          ? "is-danger"
                          : "is-blue",
                    }
                  : null,
              detailsLabel: "SRS withdrawals and tax guardrails",
              detailsHTML: `<p>${tap2BodyHTML}</p>
                <p>Withdrawal window: ages ${taps.tap2Srs.startAge}–${taps.tap2Srs.endAge}. The projected pot is <strong>${m(taps.tap2Srs.projectedAt63)}</strong> nominal, supporting <strong>${m(taps.tap2Srs.tenYearMonthlyDrawToday, "/mo")}</strong> in today’s dollars. The model’s nominal zero-tax ceiling is <strong>${srsZeroTaxCapCompact}</strong> (up to ${m(taps.tap2Srs.maxSafeAnnualTo400k, "/yr")} in contributions). Guardrail range: ${srsTrapFloorCompact}–${srsTrapCeilingCompact}.</p>`,
            }),
            buildRetirementIncomeTile({
              title:
                s.gap65 > 0 ? "Draw from equities" : "Optional equity income",
              figure: m(taps.tap3Equities.projectedMonthlyDrawToday, "/mo"),
              description:
                s.gap65 > 0
                  ? "Projected equity draw toward the gap after CPF LIFE."
                  : "Estimated extra capacity. CPF LIFE covers the age-65 budget.",
              progress:
                s.gap65 > 0
                  ? {
                      pct: tap3Pct,
                      label: "Equity draw coverage of the gap after CPF LIFE",
                    }
                  : null,
              detailsLabel: "Portfolio and rebalancing rules",
              detailsHTML: `<p>Equities grow from <strong>${m(taps.tap3Equities.currentEquities)}</strong> today, with ${m(taps.tap3Equities.monthlyInvest, "/mo")} planned investment, to <strong>${m(taps.tap3Equities.projectedInvestAtRetireToday)}</strong> at age ${r.retire} in today’s dollars. The outside portfolio including cash and SRS is <strong>${m(taps.tap3Equities.portfolioAtRetireToday)}</strong>.</p>
                <p>Allocation: ${taps.tap3Equities.targetEquityPct}% equities / ${taps.tap3Equities.targetBondPct}% bonds, with a ${taps.tap3Equities.globalSplitPct}/${taps.tap3Equities.sgDividendSplitPct} global/SG split within equities.</p>`,
            }),
            buildRetirementIncomeTile({
              title: "Keep a cash buffer",
              figure: m(taps.tap4Ssb.currentSsbCash),
              description: "Current cash and SSBs toward the $150k buffer.",
              progress: {
                pct: ssbPctOf150k,
                label: "Cash and SSB buffer progress toward $150,000",
              },
              detailsLabel: "Cash buffer and SSB redemption rules",
              detailsHTML: `<p>The 6–12 month emergency floor is <strong>${m(taps.tap4Ssb.emergencyMin)}–${m(taps.tap4Ssb.emergencyMax)}</strong>. Current cash earns about ${m(taps.tap4Ssb.currentMonthlyYield, "/mo")} at ${taps.tap4Ssb.effectiveRatePct.toFixed(2)}% effective annual interest.</p>
                <p>Cash and bonds at age ${r.retire}: <strong>${m(taps.tap4Ssb.projectedSsbCashAtRetireToday)}</strong> in today’s dollars. ${!r.retiringNow && taps.tap4Ssb.monthlyCashSaving > 0 ? `Planned cash savings: ${m(taps.tap4Ssb.monthlyCashSaving, "/mo")}. ` : ""}${!r.retiringNow && taps.tap3Equities.monthlyBondBuy > 0 ? `Bond allocation: ${m(taps.tap3Equities.monthlyBondBuy, "/mo")}. ` : ""}${taps.tap4Ssb.cashAccountsActive ? `The effective rate blends ${taps.tap4Ssb.accountCount} cash accounts${taps.tap4Ssb.overflowBalance > 0 ? ` with ${m(taps.tap4Ssb.overflowBalance)} above bonus caps` : ""}. ` : ""}At the buffer target, estimated interest is ${m(taps.tap4Ssb.monthlyYieldAt150k, "/mo")}.</p>
                <p>SSB principal is government-backed, with a ${m(RetirementModel.C.ssbCap)} individual limit, 10-year step-up coupons, and penalty-free monthly redemption.</p>`,
            }),
          ].join("");
        })()}
        </div>
      </div>
    </details>
  </section>`;
}

export function setFinActivityTab(tab) {
  finActivityTab = tab;
}
