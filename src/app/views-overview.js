import {
  $,
  formatFundedPct,
  money,
  m,
  signedM,
  centsHtml,
  compactMoney,
  svgWrap,
  ICONS,
  KPI_ICONS,
  escapeAttr,
} from "./format.js";
import { buildExpenseCardHTML } from "./views-expense.js";

export function computeRebalanceTargets(bogle, p, r) {
  const hol = bogle?.holistic || {};
  const curEqPct = Math.round(hol.effectiveEquityPct || 0);
  const tgtEqPct = Math.round(p?.targetEquityPct ?? 80);
  const eqDriftPct = Math.abs(curEqPct - tgtEqPct);
  const curCashBucket = Math.round(bogle?.buckets?.ssbCash || 0);
  const emergencyReserveFloor = Math.max(
    20000,
    Math.round((r?.todaySpend || 2800) * 6),
  );
  const deployableExcessCash = Math.max(
    0,
    curCashBucket - emergencyReserveFloor,
  );
  const curLiqEq = Math.round(
    (bogle?.buckets?.equities || 0) + (bogle?.buckets?.sgDividends || 0),
  );
  const liqTotal = curLiqEq + curCashBucket;
  const holTot = Math.max(1, Math.round(hol.totalNetWorth || liqTotal));
  const targetTotalEq = Math.round(holTot * (tgtEqPct / 100));
  const srsMode = p?.srsInvestedIn || "global";
  const srsBal = Math.round(bogle?.buckets?.srs || 0);
  const srsEq =
    srsMode === "global" || srsMode === "equities"
      ? srsBal
      : srsMode === "balanced"
        ? Math.round(srsBal * 0.6)
        : 0;
  const rawNewLiqEq = Math.min(liqTotal, Math.max(0, targetTotalEq - srsEq));
  const isUnderweightEq = rawNewLiqEq > curLiqEq;
  const shiftAmt = isUnderweightEq
    ? Math.min(rawNewLiqEq - curLiqEq, deployableExcessCash)
    : curLiqEq - rawNewLiqEq;
  const newLiqEq = isUnderweightEq ? curLiqEq + shiftAmt : curLiqEq - shiftAmt;
  const newCash = Math.max(0, liqTotal - newLiqEq);
  return {
    curEqPct,
    tgtEqPct,
    eqDriftPct,
    curCashBucket,
    emergencyReserveFloor,
    deployableExcessCash,
    curLiqEq,
    liqTotal,
    isUnderweightEq,
    shiftAmt,
    newLiqEq,
    newCash,
  };
}

export function getMilestoneNodes(fire, r, s, simulation) {
  const pts = fire?.points || [];
  const ptAt = (age) =>
    pts.find((x) => x.age === age) ||
    pts.find((x) => x.age >= age) ||
    pts[pts.length - 1];
  const nowPt = pts[0];
  const age55Target = fire.age < 55 ? 55 : fire.age;
  const pt55 = ptAt(age55Target);
  const ptRet = ptAt(fire.retire);
  const pt75 = ptAt(Math.min(fire.endAge, Math.max(75, fire.retire)));
  const pt95 = pts[pts.length - 1];
  const totalMoSave =
    (simulation?.cpfExtra || 0) +
    (simulation?.cashSaving || 0) +
    (simulation?.invest ?? s.privateSaving);

  return [
    {
      badge: "Now",
      tag: `Age ${fire.age}`,
      title: "Starting Base",
      metric: m(nowPt?.today?.totalNetWorth ?? 0),
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
      metric: m(pt55?.today?.cpfTotal ?? 0),
      pill: "CPF Check",
      sub: `Total net worth ${money(pt55?.today?.totalNetWorth ?? 0)}`,
      color: "#0F766E",
      softBg: "#E6F7F5",
    },
    {
      badge: String(fire.retire),
      tag: `Age ${fire.retire}`,
      title: "Retirement Launch",
      metric: m(ptRet?.today?.totalNetWorth ?? 0),
      pill: fire.retire < 65 ? "Bridge" : "CPF LIFE",
      sub: `Budget ${money(r.futureSpend)}/mo · ${fire.retire < 65 ? "Liquid bridge" : "CPF LIFE active"}`,
      color: "#1D4ED8",
      softBg: "#EFF6FF",
    },
    {
      badge: String(pt95?.age ?? fire.endAge ?? 95),
      tag: `Age 75→${pt95?.age ?? fire.endAge ?? 95}`,
      title: fire.fireNumber.fullyFundedTo95
        ? `Age ${fire.endAge ?? 95}+ Runway`
        : `Funded to ${Math.floor(fire.fireNumber.depletionAge ?? 90)}`,
      metric: m(pt95?.today?.totalNetWorth ?? 0),
      pill: fire.fireNumber.fullyFundedTo95 ? "Sustained" : "Watch Gap",
      sub: `Spend ${money(pt75?.today?.monthlySpend ?? r.spend75)}/mo · CPF ${money(s.payout)}/mo`,
      color: fire.fireNumber.fullyFundedTo95 ? "#7C3AED" : "#B91C1C",
      softBg: fire.fireNumber.fullyFundedTo95 ? "#F5F3FF" : "#FEF2F2",
    },
  ];
}

export function buildFundingSourcesList(taps, r, s, cpfCovPct) {
  const srsTodayDraw =
    taps.tap2Srs.tenYearMonthlyDrawToday ?? taps.tap2Srs.tenYearMonthlyDraw;
  const srsTodayPot =
    taps.tap2Srs.projectedAt63Today ?? taps.tap2Srs.projectedAt63;
  const srsMarginalPct = Number(
    ((taps.tap2Srs.marginalRate || 0) * 100).toFixed(1).replace(/\.0$/, ""),
  );
  const srsDrawPill =
    taps.tap2Srs.trapStatus === "balloon-trap"
      ? ">450k!"
      : taps.tap2Srs.verdictStatus === "idle-cash"
        ? "0.05%!"
        : taps.tap2Srs.projectedAt63 > 0
          ? `${compactMoney(srsTodayPot)}`
          : taps.tap2Srs.verdictStatus === "worth-it"
            ? `Save ${compactMoney(taps.tap2Srs.taxSavedPerYear)}/yr`
            : taps.tap2Srs.verdictStatus === "rstu-first"
              ? "RSTU 1st"
              : taps.tap2Srs.verdictStatus === "cap-full"
                ? "$80k Cap"
                : `Skip (${srsMarginalPct}%)`;
  const srsCountSub =
    taps.tap2Srs.projectedAt63 > 0
      ? `Age ${taps.tap2Srs.startAge}–${taps.tap2Srs.endAge} · ${money(srsTodayDraw)}/mo (today’s $)`
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
  return {
    ssbPctOf150k,
    fundingSources: [
      {
        name: `Tap 1 · CPF LIFE (${r.plan === "escalating" ? "Esc" : "Std"})`,
        count: `${money(s.payout)}/mo of ${money(r.spend65)} need${taps.tap1Cpf.monthlyExtraCpf > 0 ? ` (+${money(taps.tap1Cpf.monthlyExtraCpf)}/mo)` : ""}`,
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
        count: `${!r.retiringNow ? `+${money(taps.tap3Equities.monthlyInvest)}/mo (${taps.tap3Equities.globalSplitPct}/${taps.tap3Equities.sgDividendSplitPct} G/SG) → ` : ""}${compactMoney(taps.tap3Equities.projectedInvestAtRetireToday ?? taps.tap3Equities.portfolioAtRetireToday)} at ${r.retire} · ${s.gap65 > 0 ? `${money(taps.tap3Equities.projectedMonthlyDrawToday)}/mo of ${money(s.gap65)} gap` : `+${money(taps.tap3Equities.projectedMonthlyDrawToday)}/mo draw`}`,
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
          (taps.tap4Ssb.monthlyCashSaving ?? 0) > 0
            ? `${!r.retiringNow && (taps.tap4Ssb.monthlyCashSaving ?? 0) > 0 ? `+${money(taps.tap4Ssb.monthlyCashSaving)}/mo → ` : `${compactMoney(taps.tap4Ssb.currentSsbCash)} → `}${compactMoney(taps.tap4Ssb.projectedCashOnlyAtRetireToday ?? taps.tap4Ssb.currentSsbCash)} at ${r.retire} · ~${money(ssbYieldMo)}/mo @ ${taps.tap4Ssb.effectiveRatePct.toFixed(2)}%`
            : `${compactMoney(taps.tap4Ssb.currentSsbCash)} → ${compactMoney(taps.tap4Ssb.projectedCashOnlyAtRetireToday ?? taps.tap4Ssb.currentSsbCash)} at ${r.retire} · ~${money(ssbYieldMo)}/mo${taps.tap4Ssb.currentSsbCash > 0 ? "" : " @ cap"}`,
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
          taps.tap1Cpf.oaAt55Today > 0
            ? `${money(taps.tap1Cpf.oaInterestMonthlyToday)}/mo liquid`
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
      <text x="120" y="90" text-anchor="middle" fill="#0F172A" font-size="25" font-weight="800" letter-spacing="-0.03em">${pctVal}%</text>
      <text x="120" y="108" text-anchor="middle" fill="#64748B" font-size="9.5" font-weight="600" letter-spacing="0.03em">FUNDED TO ${endAge}</text>
    </svg>
    <span class="sr-only">${pctVal}% funded to age ${endAge}</span>
    <div class="swell-gauge-status" style="color:${statusColor};">${statusWord}</div>
    <div class="fin-gauge-center swell-gauge-readout">
      <strong>${readyText}</strong>
      <span class="fin-gauge-eyebrow">${eyebrowText}</span>
      <span class="fin-gauge-delta" style="color:${deltaColor};">${deltaLine}</span>
    </div>
  </div>`;
}

export function buildOverviewPageHeader(fire) {
  const fn = fire.fireNumber;
  const pct = Math.min(150, Math.max(0, fn.pctFunded));
  const onTrack = pct >= 100 && fn.fullyFundedTo95;
  const nearTrack = pct >= 80 && !onTrack;
  const statusBadgeText = onTrack
    ? "On Track"
    : nearTrack
      ? "Within Reach"
      : "Shortfall Detected";
  const statusClass = onTrack ? "is-good" : nearTrack ? "is-warn" : "is-danger";
  const statusIcon = onTrack ? ICONS.checkTiny : ICONS.alertTriangle;
  return `<header class="ember-page-header fin-page-header" aria-labelledby="fire-hero-title">
    <div class="ember-header-main">
      <div class="fin-title-row">
        <h1 id="fire-hero-title" tabindex="-1">Retirement Readiness Overview</h1>
        <span class="status-pill ${statusClass}">${statusIcon}<span>${statusBadgeText}</span></span>
      </div>
    </div>
    <div class="ember-header-meta">
      <button type="button" class="button button-small mobile-balances-btn" data-open-profile>My Settings</button>
    </div>
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
  const hMode = p.housingMode || "all-oa";
  const hInfo = RetirementModel.computeHousingPayment({
    mode: hMode,
    loanBalance: p.housingBalance,
    loanRate: p.housingRate,
    loanYears: p.housingYears,
    loanParties: p.housingParties,
    manualMonthly: p.housing,
  });
  const housingTotalMo =
    hMode === "paid-up"
      ? 0
      : hMode === "all-oa"
        ? Math.round(r.currentOA || 0)
        : Math.round(hInfo.monthlyShare || 0);
  const housingOaMo = Math.min(Math.round(r.currentOA || 0), housingTotalMo);
  const housingCashMo = Math.max(0, housingTotalMo - housingOaMo);
  const exactTax =
    tax?.activeTax ||
    RetirementModel.computeTaxSummary(p, simulation).activeTax;
  const monthlyTax = Math.max(0, Math.round(exactTax.monthlyTax || 0));
  const allItems = expenseData?.items || [];
  const fixedMatcher =
    /insurance|healthshield|multiplier life|accident|term|utilities|s&cc|town council|wifi|mobile|streaming|subscription|broadband|telco|levy|helper/i;
  const recurringItems = allItems
    .filter(
      (it) =>
        it.category === "housing" ||
        it.category === "digital" ||
        fixedMatcher.test(it.name),
    )
    .sort((a, b) => b.amount - a.amount);
  const recurringTotal = Math.round(
    recurringItems.reduce((acc, it) => acc + (it.amount || 0), 0),
  );
  const fixedOutMo = Math.round(monthlyTax + housingCashMo + recurringTotal);
  const leftAfterSave = Math.round(r.afterCpf - contribution);
  const netCashSurplus = Math.round(r.afterCpf - contribution - fixedOutMo);
  const maxAffordableSaveMo = Math.max(0, Math.round(r.afterCpf - fixedOutMo));
  const housingMetaLabel =
    hMode === "paid-up"
      ? "Paid-up property ($0 OA)"
      : hMode === "all-oa"
        ? `Up to ${m(housingOaMo)} CPF OA ($0 cash)`
        : housingCashMo > 0
          ? `${m(housingCashMo)} cash + ${m(housingOaMo)} CPF OA`
          : `${m(housingOaMo)} via CPF OA`;
  return {
    hMode,
    housingTotalMo,
    housingOaMo,
    housingCashMo,
    monthlyTax,
    recurringItems,
    recurringTotal,
    fixedOutMo,
    leftAfterSave,
    netCashSurplus,
    maxAffordableSaveMo,
    housingMetaLabel,
  };
}

function buildFinBentoGridHTML({
  fire,
  r,
  p,
  simulation,
  bogle,
  pctOfPay,
  contribution,
  expenseData,
  taps,
  paycheck,
  tax,
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
  const cpfSrsBal = Math.round(startingCpf + startingSrs);
  const assetDenom = Math.max(1, cashBal + eqBal + cpfSrsBal);
  const cashShareW = Math.round((cashBal / assetDenom) * 100);
  const eqShareW = Math.round((eqBal / assetDenom) * 100);
  const cpfShareW = Math.max(0, 100 - cashShareW - eqShareW);

  // Housing, IRAS tax & fixed bills reconciliation
  const cashflow = computeMonthlyTakeHomeCashflow({
    r,
    simulation,
    contribution,
    p,
    tax,
    expenseData,
  });
  const {
    housingOaMo,
    housingCashMo,
    monthlyTax,
    recurringItems,
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

  // Portfolio distribution & passive income today
  const hol = bogle.holistic || {};
  const holDenom = Math.max(1, hol.totalNetWorth || startingTotalAssets || 1);
  const glEqBal = Math.round(
    hol.globalEquities ??
      (bogle.buckets.equities || 0) + (bogle.buckets.srsGrowth || 0),
  );
  const sgDivBal = Math.round(
    hol.sgDividends ?? (bogle.buckets.sgDividends || 0),
  );
  const safeBondBal = Math.round(
    hol.totalBonds ?? (bogle.buckets.ssbCash || 0) + startingCpf,
  );
  const glEqW = Math.round((glEqBal / holDenom) * 100);
  const sgEqW = Math.round((sgDivBal / holDenom) * 100);
  const safeW = Math.max(0, 100 - glEqW - sgEqW);

  const sgDivMoNow = Math.round(((sgDivBal * 0.05) / 12) * 100) / 100;
  const cashMoNow =
    Math.round((taps.tap4Ssb.currentMonthlyYield || 0) * 100) / 100;
  const passiveMoNow = Math.round((sgDivMoNow + cashMoNow) * 100) / 100;
  const passiveYrNow = Math.round(passiveMoNow * 12);

  // Subscriptions, Insurance & Fixed Bills from expenseData
  const expTotal = Math.max(
    1,
    Math.round(expenseData?.total || r.todaySpend || 1),
  );
  const recurringPct = Math.min(
    100,
    Math.round((recurringTotal / expTotal) * 100),
  );
  const insSubTotal = Math.round(
    recurringItems
      .filter(
        (it) =>
          it.category === "care" ||
          /insurance|healthshield|life|accident/i.test(it.name),
      )
      .reduce((acc, it) => acc + (it.amount || 0), 0),
  );
  const billSubTotal = Math.max(0, recurringTotal - insSubTotal);
  const fixedOutW =
    netCashSurplus <= 0
      ? Math.max(0, 100 - saveW)
      : Math.min(
          100 - saveW,
          Math.max(0, Math.round((fixedOutMo / takeHomeDenom) * 100)),
        );
  const livingW = netCashSurplus > 0 ? Math.max(0, 100 - saveW - fixedOutW) : 0;
  const insW = Math.min(100, Math.round((insSubTotal / expTotal) * 100));
  const billW = Math.min(
    100 - insW,
    Math.round((billSubTotal / expTotal) * 100),
  );
  const flexW = Math.max(0, 100 - insW - billW);

  const catColorMap = {};
  (expenseData?.categories || []).forEach((c) => {
    catColorMap[c.key] = c.color;
  });

  function formatBillRow(it) {
    const raw = String(it.name || "");
    const parenMatch = raw.match(/^(.*?)\s*\(([^)]+)\)\s*(.*)$/);
    let shortTitle = raw;
    let detailNote = "";
    if (parenMatch) {
      shortTitle = [parenMatch[1], parenMatch[3]]
        .filter(Boolean)
        .join(" ")
        .trim();
      detailNote = parenMatch[2].trim();
    } else if (raw.includes(" + ")) {
      const parts = raw.split(" + ");
      shortTitle = parts[0].trim();
      detailNote = parts.slice(1).join(" + ").trim();
    }
    const baseTag =
      it.category === "digital"
        ? "Subscription"
        : it.category === "housing"
          ? "Utility"
          : "Policy / Care";
    const metaText = detailNote ? `${detailNote} · ${baseTag}` : baseTag;
    return { shortTitle, metaText };
  }

  return `
    <div class="fin-bento-grid" id="fin-bento-grid" role="region" aria-label="Personal finance overview widgets">
      <!-- 1. Net Worth & Balance Sheet -->
      <article class="fin-bento-card card-surface">
        <div class="fin-bento-head">
          <div>
            <span class="fin-bento-eyebrow">Net Worth &amp; Balance Sheet</span>
            <h3 class="fin-bento-title">${signedM(netWorthAfterDebt)} <small>${userLoanShare > 0 ? "net of loan" : "debt-free"}</small></h3>
          </div>
          <button type="button" class="fin-link-pill" data-quick-edit="balances">Edit balances</button>
        </div>
        <div class="fin-bento-bar" aria-hidden="true">
          <span data-bento-seg="0" style="width:${cpfShareW}%;background:var(--sem-cpf);" title="CPF + SRS (${cpfShareW}%)"></span>
          <span data-bento-seg="1" style="width:${eqShareW}%;background:var(--sem-equities);" title="Equities (${eqShareW}%)"></span>
          <span data-bento-seg="2" style="width:${cashShareW}%;background:var(--sem-cash);" title="Cash &amp; SSB (${cashShareW}%)"></span>
        </div>
        <ul class="fin-bento-list">
          <li data-bento-seg="0">
            <span class="fin-bento-item-label"><i style="background:var(--sem-cpf);"></i>CPF + SRS Locked</span>
            <span class="fin-bento-item-meta">OA ${compactMoney(p.oa || 0)} · SA ${compactMoney(p.sa || 0)} · MA ${compactMoney(p.ma || 0)}</span>
            <strong>${m(cpfSrsBal)} <small class="fin-bento-share-pill">${cpfShareW}%</small></strong>
          </li>
          <li data-bento-seg="1">
            <span class="fin-bento-item-label"><i style="background:var(--sem-equities);"></i>Equities &amp; SG Div</span>
            <span class="fin-bento-item-meta">${m(bogle.buckets.equities || 0)} Global · ${m(sgDivBal)} SG</span>
            <strong>${m(eqBal)} <small class="fin-bento-share-pill">${eqShareW}%</small></strong>
          </li>
          <li data-bento-seg="2">
            <span class="fin-bento-item-label"><i style="background:var(--sem-cash);"></i>Liquid Cash &amp; SSB</span>
            <span class="fin-bento-item-meta">${taps.tap4Ssb.effectiveRatePct.toFixed(2)}% blended EIR</span>
            <strong>${m(cashBal)} <small class="fin-bento-share-pill">${cashShareW}%</small></strong>
          </li>
          <li class="${userLoanShare > 0 ? "is-liability-row" : ""}">
            <span class="fin-bento-item-label"><i style="background:var(--sem-alert);"></i>Mortgage Liability</span>
            <span class="fin-bento-item-meta">${housingModeLabel}</span>
            <strong>${userLoanShare > 0 ? `−${m(userLoanShare)}` : "$0"}</strong>
          </li>
        </ul>
      </article>

      <!-- 2. Monthly Cashflow -->
      <article class="fin-bento-card card-surface">
        <div class="fin-bento-head">
          <div>
            <span class="fin-bento-eyebrow">Monthly Cashflow &amp; Surplus</span>
            <h3 class="fin-bento-title">${m(r.afterCpf, "/mo")} <small>take-home (${pctOfPay}% saved${netCashSurplus < 0 ? ` · −${m(-netCashSurplus)} short` : ""})</small></h3>
          </div>
          <button type="button" class="fin-link-pill" data-quick-edit="salary">Edit income</button>
        </div>
        <div class="fin-bento-bar" aria-hidden="true">
          <span data-bento-seg="0" style="width:${saveW}%;background:var(--sem-cpf);" title="Saved &amp; Invested (${saveW}%)"></span>
          <span data-bento-seg="1" style="width:${fixedOutW}%;background:var(--sem-cash);" title="Tax, Housing Cash &amp; Fixed Bills (${fixedOutW}%)"></span>
          ${livingW > 0 ? `<span data-bento-seg="2" style="width:${livingW}%;background:var(--sem-equities-sg);" title="Remaining for Living &amp; Discretionary (${livingW}%)"></span>` : ""}
        </div>
        <ul class="fin-bento-list">
          <li data-bento-seg="0">
            <span class="fin-bento-item-label"><i style="background:var(--sem-cpf);"></i>Saved &amp; Invested</span>
            <span class="fin-bento-item-meta">${m(simulation.invest)} Inv · ${m(simulation.cashSaving || 0)} Cash · ${m(simulation.cpfExtra || 0)} CPF</span>
            <strong class="is-emerald">${m(contribution, "/mo")}</strong>
          </li>
          <li>
            <span class="fin-bento-item-label"><i style="background:var(--primary);"></i>Mandatory CPF (Payroll)</span>
            <span class="fin-bento-item-meta">${m(r.employeeCpf)} emp + ${m(r.employerCpf)} empyr</span>
            <strong>${m(mandatoryCpfMo, "/mo")}</strong>
          </li>
          <li data-bento-seg="1">
            <span class="fin-bento-item-label"><i style="background:var(--sem-cash);"></i>${housingCashMo > 0 ? "Tax, Cash Housing &amp; Bills" : "IRAS Tax &amp; Fixed Bills"}</span>
            <span class="fin-bento-item-meta">${housingCashMo > 0 ? `${m(monthlyTax)} tax · ${m(housingCashMo)} cash hsg · ${m(recurringTotal)} bills` : `${m(monthlyTax, "/mo")} tax · ${m(recurringTotal, "/mo")} fixed bills`}</span>
            <strong>${m(fixedOutMo, "/mo")}</strong>
          </li>
          ${
            netCashSurplus > 0
              ? `<li class="is-spare-cash-row" data-bento-seg="2">
                  <span class="fin-bento-item-label"><i style="background:var(--sem-equities-sg);"></i>Remaining for Living</span>
                  <span class="fin-bento-item-meta">Food, transport, lifestyle &amp; extra saving</span>
                  <strong class="is-emerald" id="bento-spare-cash-val">+${m(netCashSurplus, "/mo")}</strong>
                </li>`
              : netCashSurplus < 0
                ? `<li class="is-deficit-cash-row" data-bento-seg="2">
                    <span class="fin-bento-item-label"><i style="background:var(--sem-alert);"></i>Monthly Cash Shortfall</span>
                    <span class="fin-bento-item-meta">Exceeds take-home by ${m(-netCashSurplus, "/mo")}</span>
                    <strong class="is-danger-text" id="bento-spare-cash-val">−${m(-netCashSurplus, "/mo")}</strong>
                  </li>`
                : ""
          }
        </ul>
      </article>

      <!-- 3. Portfolio Distribution & Passive Yield -->
      <article class="fin-bento-card card-surface">
        <div class="fin-bento-head">
          <div>
            <span class="fin-bento-eyebrow">Portfolio Distribution &amp; Yield</span>
            <h3 class="fin-bento-title">+${centsHtml(passiveMoNow)}<span class="fin-bento-unit">/mo</span> <small>passive yield now</small></h3>
          </div>
          <button type="button" class="fin-link-pill" data-go-tab="dividend-calc">Yield calculator →</button>
        </div>
        <div class="fin-bento-bar" aria-hidden="true">
          <span data-bento-seg="0" style="width:${glEqW}%;background:var(--sem-equities);" title="Global Equity (${glEqW}%)"></span>
          <span data-bento-seg="1" style="width:${sgEqW}%;background:var(--sem-equities-sg);" title="SG Dividend (${sgEqW}%)"></span>
          <span data-bento-seg="2" style="width:${safeW}%;background:var(--sem-cpf);" title="Safe Floor (${safeW}%)"></span>
        </div>
        <ul class="fin-bento-list">
          <li data-bento-seg="0">
            <span class="fin-bento-item-label"><i style="background:var(--sem-equities);"></i>Global Equity ETFs</span>
            <span class="fin-bento-item-meta">VWRA / IWDA · +${m(taps.tap3Equities.monthlyGlobalBuy, "/mo")} buy</span>
            <strong>${m(glEqBal)} <small class="fin-bento-share-pill">${glEqW}%</small></strong>
          </li>
          <li data-bento-seg="1">
            <span class="fin-bento-item-label"><i style="background:var(--sem-equities-sg);"></i>SG Dividend Sleeve</span>
            <span class="fin-bento-item-meta">~${centsHtml(sgDivMoNow)}/mo @ 5% · +${m(taps.tap3Equities.monthlySgBuy, "/mo")} buy</span>
            <strong>${m(sgDivBal)} <small class="fin-bento-share-pill">${sgEqW}%</small></strong>
          </li>
          <li data-bento-seg="2">
            <span class="fin-bento-item-label"><i style="background:var(--sem-cpf);"></i>CPF + SSB Safe Floor</span>
            <span class="fin-bento-item-meta">~${centsHtml(cashMoNow)}/mo cash interest (${taps.tap4Ssb.effectiveRatePct.toFixed(2)}%)</span>
            <strong>${m(safeBondBal)} <small class="fin-bento-share-pill">${safeW}%</small></strong>
          </li>
          <li>
            <span class="fin-bento-item-label"><i style="background:var(--sem-cash);"></i>Annual Passive Cashflow</span>
            <span class="fin-bento-item-meta">SG dividends + SSB/HYSA interest</span>
            <strong class="is-emerald">+${m(passiveYrNow, "/yr")}</strong>
          </li>
        </ul>
      </article>

      <!-- 4. Subscriptions, Insurance & Fixed Bills -->
      <article class="fin-bento-card card-surface">
        <div class="fin-bento-head">
          <div>
            <span class="fin-bento-eyebrow">Subscriptions, Insurance &amp; Bills</span>
            <h3 class="fin-bento-title">${m(recurringTotal, "/mo")} <small>${recurringPct}% of ${m(expenseData?.total || r.todaySpend)} budget</small></h3>
          </div>
          <button type="button" class="fin-link-pill" data-open-expense-modal="custom">Edit expenses</button>
        </div>
        <div class="fin-bento-bar" aria-hidden="true">
          <span data-bento-seg="0" style="width:${insW}%;background:var(--sem-cpf);" title="Insurance &amp; Healthcare (${insW}%)"></span>
          <span data-bento-seg="1" style="width:${billW}%;background:var(--sem-srs);" title="Utilities, WiFi &amp; Subscriptions (${billW}%)"></span>
          <span data-bento-seg="2" style="width:${flexW}%;background:var(--border-strong);" title="Flexible Dining, Groceries &amp; Lifestyle (${flexW}%)"></span>
        </div>
        <ul class="fin-bento-list">
          ${recurringItems
            .slice(0, 4)
            .map((it) => {
              const isInsItem =
                it.category === "care" ||
                /insurance|healthshield|life|accident/i.test(it.name);
              const segIdx = isInsItem ? "0" : "1";
              const itemSharePct = Math.round(
                ((it.amount || 0) / expTotal) * 100,
              );
              const dotColor = catColorMap[it.category] || "var(--primary)";
              const { shortTitle, metaText } = formatBillRow(it);
              return `<li data-bento-seg="${segIdx}">
                <span class="fin-bento-item-label" title="${escapeAttr(it.name)}"><i style="background:${dotColor};"></i>${escapeAttr(shortTitle)}</span>
                <span class="fin-bento-item-meta">${escapeAttr(metaText)}</span>
                <strong>${m(it.amount, "/mo")} <small class="fin-bento-share-pill">${itemSharePct}%</small></strong>
              </li>`;
            })
            .join("")}
        </ul>
      </article>
    </div>`;
}

function buildMoneyMovesStripHTML({
  fire,
  r,
  s,
  p,
  simulation,
  bogle,
  contribution,
  taps,
  tax,
  expenseData,
  pctOfPay = 0,
}) {
  const fn = fire.fireNumber;
  const moves = [];

  // Compute exact Unallocated Cash Surplus so we never recommend investing cash the user does not have
  const margRate = tax?.taxBefore?.marginalRate || 0;
  const {
    housingCashMo,
    monthlyTax,
    recurringTotal,
    netCashSurplus: rawSurplusMo,
    maxAffordableSaveMo,
  } = computeMonthlyTakeHomeCashflow({
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
      badge: `Exceeds cashflow by ${m(excessOutflowMo, "/mo")}`,
      tone: "is-amber",
      title: `Cap monthly savings to ${m(maxAffordableSaveMo, "/mo")} sustainable limit`,
      desc: `Planned savings (${m(contribution, "/mo")}) plus tax and fixed bills (${m(housingCashMo + monthlyTax + recurringTotal, "/mo")}) exceed your ${m(r.afterCpf, "/mo")} take-home pay by ${m(excessOutflowMo, "/mo")}.`,
      ctaHtml: `<button type="button" class="fin-move-cta" data-money-move="cap-affordable-save" data-move-val="${maxAffordableSaveMo}">Cap at ${m(maxAffordableSaveMo, "/mo")} →</button>`,
      subHtml: `<button type="button" class="fin-move-link" data-quick-edit="invest">Edit savings</button>`,
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
      badge: closesFullGap
        ? `${fn.pctFunded}% → 100% funded`
        : `Uses ${m(affordableDeltaMo, "/mo")} surplus`,
      tone: "is-amber",
      title: closesFullGap
        ? `Add +${m(affordableDeltaMo, "/mo")} to monthly investing`
        : `Deploy +${m(affordableDeltaMo, "/mo")} cash surplus to monthly investing`,
      desc: closesFullGap
        ? `Raising monthly investing from ${m(curInvestMo, "/mo")} to ${m(targetInvestMo, "/mo")} (from your ${m(unallocatedSurplusMo, "/mo")} unallocated cash surplus) closes your ${m(Math.round(fn.shortfallToday || 0))} age-${fire.retire} shortfall.`
        : `Raising monthly investing from ${m(curInvestMo, "/mo")} to ${m(targetInvestMo, "/mo")} deploys your available ${m(unallocatedSurplusMo, "/mo")} unallocated cash surplus toward closing your age-${fire.retire} shortfall.`,
      ctaHtml: `<button type="button" class="fin-move-cta" data-money-move="match-save" data-move-val="${targetInvestMo}">Apply ${m(targetInvestMo, "/mo")} →</button>`,
      subHtml: `<button type="button" class="fin-move-link" data-go-tab="trajectory">Trajectory</button>`,
    });
  }

  // 2. CPF SA RSTU Tax Relief (7%+ IRAS bracket with SA room < FRS AND sufficient Unallocated Cash Surplus)
  const curCpfExtraMo = Math.round(simulation.cpfExtra || 0);
  const curCpfExtraYr = curCpfExtraMo * 12;
  const rstuRoomYr = Math.max(0, (tax?.maxRstu || 0) - curCpfExtraYr);
  const fullTargetCpfMo = Math.ceil(
    (tax?.maxRstu || RetirementModel.C.rstuReliefCap) / 12,
  );
  const affordableCpfDeltaMo = Math.min(
    Math.max(0, fullTargetCpfMo - curCpfExtraMo),
    unallocatedSurplusMo,
  );
  const targetCpfMo = curCpfExtraMo + affordableCpfDeltaMo;
  const effectiveRstuRoomYr = Math.min(rstuRoomYr, affordableCpfDeltaMo * 12);
  const rstuSaveYr = Math.round(effectiveRstuRoomYr * margRate);
  if (
    (tax?.tier === "rstu-first" || tax?.tier === "max-both") &&
    unallocatedSurplusMo >= 50 &&
    effectiveRstuRoomYr >= 240 &&
    rstuSaveYr >= 15
  ) {
    const rateLabel = (margRate * 100).toFixed(1).replace(/\.0$/, "");
    moves.push({
      score: 3200 + rstuSaveYr,
      badge: `+${m(rstuSaveYr, "/yr")} tax saved`,
      tone: "is-emerald",
      title: `Top up ${m(effectiveRstuRoomYr, "/yr")} to CPF SA (RSTU)`,
      desc: `At your ${rateLabel}% IRAS bracket, +${m(affordableCpfDeltaMo, "/mo")} RSTU cuts tax by ${m(rstuSaveYr, "/yr")} and earns 4.0% p.a. risk-free.`,
      ctaHtml: `<button type="button" class="fin-move-cta" data-money-move="apply-rstu" data-move-val="${targetCpfMo}">Apply +${m(targetCpfMo, "/mo")} RSTU →</button>`,
      subHtml: `<button type="button" class="fin-move-link" data-go-tab="tax">Tax Relief</button>`,
    });
  }

  // 3. SRS Tax Shelter — strictly gated: ONLY when taps.tap2Srs.worthIt is true AND user has Unallocated Cash Surplus
  const curSrsYr = Math.round(p.srsAnnual || 0);
  const maxAffordableSrsYr = curSrsYr + unallocatedSurplusMo * 12;
  const safeSrsTargetYr = Math.min(
    tax?.maxSrsAfterRstu || RetirementModel.C.srsCap,
    Math.max(0, Math.floor(tax?.srsMaxSafeAnnualTo400k || 0)),
    maxAffordableSrsYr,
  );
  const remSafeSrsYr = Math.max(0, safeSrsTargetYr - curSrsYr);
  const remSafeSrsSaveYr = Math.round(remSafeSrsYr * margRate);
  const srsWorthIt = Boolean(taps?.tap2Srs?.worthIt);

  if (
    srsWorthIt &&
    unallocatedSurplusMo >= 50 &&
    remSafeSrsYr >= 240 &&
    remSafeSrsSaveYr >= 25 &&
    tax?.srsTrapStatus !== "balloon-trap"
  ) {
    const rateLabel = (margRate * 100).toFixed(1).replace(/\.0$/, "");
    moves.push({
      score: 2800 + remSafeSrsSaveYr,
      badge: `+${m(remSafeSrsSaveYr, "/yr")} tax saved`,
      tone: "is-emerald",
      title: `Shelter ${m(safeSrsTargetYr, "/yr")} in SRS (${rateLabel}% bracket)`,
      desc: `At your ${rateLabel}% bracket, SRS saves ${m(remSafeSrsSaveYr, "/yr")} in IRAS tax while staying inside the $400k age-63 tax-free cap.`,
      ctaHtml: `<button type="button" class="fin-move-cta" data-money-move="apply-srs" data-move-val="${safeSrsTargetYr}">Apply ${m(safeSrsTargetYr, "/yr")} SRS →</button>`,
      subHtml: `<button type="button" class="fin-move-link" data-go-tab="tax">Tax Relief</button>`,
    });
  } else if (curSrsYr > 0 && !srsWorthIt) {
    // Guardrail: user has SRS top-ups enabled in a low tax bracket where SRS lock-in is not worth it
    const rateLabel = (margRate * 100).toFixed(1).replace(/\.0$/, "");
    moves.push({
      score: 2750,
      badge: `Avoid age-63 lock-in`,
      tone: "is-amber",
      title: `Skip ${m(curSrsYr, "/yr")} SRS at ${rateLabel}% tax bracket`,
      desc: `At a ${rateLabel}% bracket (<11.5%), locking cash in SRS until age 63 (50% taxable on withdrawal) underperforms liquid ETFs & CPF SA.`,
      ctaHtml: `<button type="button" class="fin-move-cta" data-money-move="apply-srs" data-move-val="0">Set SRS to $0/yr →</button>`,
      subHtml: `<button type="button" class="fin-move-link" data-go-tab="tax">Tax Relief</button>`,
    });
  } else if (
    tax?.srsTrapStatus === "balloon-trap" &&
    curSrsYr > safeSrsTargetYr
  ) {
    moves.push({
      score: 2900,
      badge: `Avoid $450k+ SRS tax trap`,
      tone: "is-amber",
      title: `Cap SRS at ${m(safeSrsTargetYr, "/yr")} to stay ≤$400k`,
      desc: `Your projected SRS exceeds $450k at age 63, triggering withdrawal tax. Capping at ${m(safeSrsTargetYr, "/yr")} keeps drawdowns $0-tax.`,
      ctaHtml: `<button type="button" class="fin-move-cta" data-money-move="apply-srs" data-move-val="${safeSrsTargetYr}">Cap at ${m(safeSrsTargetYr, "/yr")} →</button>`,
      subHtml: `<button type="button" class="fin-move-link" data-go-tab="tax">Tax Relief</button>`,
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
    const targetRetPct = (
      (r.investmentReturn ?? RetirementModel.C.investmentReturn) * 100
    ).toFixed(1);
    moves.push({
      score: 2650 + extraSrsYr,
      badge: `0.05% → ${targetRetPct}% p.a.`,
      tone: "is-amber",
      title: `Invest idle SRS cash into Global ETFs`,
      desc: `Uninvested SRS cash earns 0.05% p.a. Deploying into low-cost indexed funds compounds tax-deferred until age 63.`,
      ctaHtml: `<button type="button" class="fin-move-cta" data-money-move="invest-srs">Invest SRS in Global ETFs →</button>`,
      subHtml: `<button type="button" class="fin-move-link" data-go-tab="tax">Tax Relief</button>`,
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
      badge: `+${m(gainYr, "/yr")} risk-free`,
      tone: "is-blue",
      title: `Sweep ${m(cashBd.totalOverflowBalance)} overflow to MAS SSB`,
      desc: `Moving 0.05% base-tier bank cash into MAS 10Y SSB (${taps.tap4Ssb.ssb10YrPct.toFixed(2)}%) lifts your cash EIR to ${cashBd.sweptEffectiveRatePct.toFixed(2)}%.`,
      ctaHtml: `<button type="button" class="fin-move-cta" data-money-move="sweep-cash">Sweep Overflow →</button>`,
      subHtml: `<button type="button" class="fin-move-link" data-go-tab="cash-parking">Cash Parking</button>`,
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
        badge: `+${m(extraSaYr, "/yr")} CPF yield`,
        tone: "is-blue",
        title: `Transfer ${m(oaExcess)} excess OA to SA (+1.5%)`,
        desc: `Keeping $20k in OA for the +1% cap and transferring ${m(oaExcess)} to SA lifts risk-free CPF interest from 2.5% to 4.0%.`,
        ctaHtml: `<button type="button" class="fin-move-cta" data-money-move="transfer-oa-sa" data-move-val="${oaExcess}">Transfer ${m(oaExcess)} to SA →</button>`,
        subHtml: `<button type="button" class="fin-move-link" data-go-tab="cpf-rules">Milestones</button>`,
      });
    }
  }

  // 7. Portfolio Rebalance (only deploy cash above the 6-month / $20k emergency reserve floor)
  const reb = computeRebalanceTargets(bogle, p, r);
  const {
    curEqPct,
    tgtEqPct,
    eqDriftPct,
    emergencyReserveFloor,
    liqTotal,
    isUnderweightEq,
    shiftAmt,
  } = reb;
  if (liqTotal >= 5000 && eqDriftPct >= 5) {
    if (shiftAmt >= 2000) {
      const rateDiff = Math.max(
        0.015,
        (Number(p.returnRate ?? 0.05) || 0.05) -
          (taps.tap4Ssb.effectiveRatePct || 2.39) / 100,
      );
      const annualBoost = Math.round(shiftAmt * rateDiff);
      moves.push({
        score: 2100 + annualBoost,
        badge: isUnderweightEq
          ? `+${m(annualBoost, "/yr")} expected return`
          : `Lock in ${m(shiftAmt)} safe floor`,
        tone: "is-blue",
        title: isUnderweightEq
          ? `Deploy ${m(shiftAmt)} excess cash above reserve to ${tgtEqPct}/${100 - tgtEqPct} target`
          : `Rebalance ${m(shiftAmt)} equity overweight to ${tgtEqPct}/${100 - tgtEqPct} target`,
        desc: isUnderweightEq
          ? `Preserving your ${m(emergencyReserveFloor)} emergency reserve, shifting ${m(shiftAmt)} of excess cash into Global/SG equities moves toward your ${tgtEqPct}/${100 - tgtEqPct} target (+${m(annualBoost, "/yr")}).`
          : `Your portfolio is ${curEqPct}/${100 - curEqPct} vs your ${tgtEqPct}/${100 - tgtEqPct} target. Moving ${m(shiftAmt)} into SSB/cash restores your fixed-income allocation.`,
        ctaHtml: `<button type="button" class="fin-move-cta" data-money-move="rebalance-portfolio">Rebalance to ${tgtEqPct}/${100 - tgtEqPct} →</button>`,
        subHtml: `<button type="button" class="fin-move-link" data-go-tab="allocator">Allocator</button>`,
      });
    }
  }

  const topMoves = moves.sort((a, b) => b.score - a.score).slice(0, 3);

  if (topMoves.length === 0) {
    const hasShortfall = !fn.fullyFundedTo95 || fn.pctFunded < 100;
    if (hasShortfall && unallocatedSurplusMo < 50) {
      return `
        <div class="fin-moves-strip is-all-done" id="fin-money-moves" role="region" aria-label="Actionable money moves">
          <div class="fin-moves-done-bar">
            <span class="fin-moves-done-badge">Cashflow Fully Allocated</span>
            <span class="fin-moves-done-text">100% of available take-home cashflow is allocated (${pctOfPay}% saved). To close your remaining age-${fire.retire} shortfall (${fn.pctFunded}% funded), adjust your retirement budget or target retirement age.</span>
          </div>
        </div>`;
    }
    return `
      <div class="fin-moves-strip is-all-done" id="fin-money-moves" role="region" aria-label="Actionable money moves">
        <div class="fin-moves-done-bar">
          <span class="fin-moves-done-badge">✓ All Portfolio Actions Applied</span>
          <span class="fin-moves-done-text">Your monthly savings, eligible IRAS tax reliefs, and ${tgtEqPct}/${100 - tgtEqPct} portfolio allocation are fully optimized.</span>
        </div>
      </div>`;
  }

  return `
    <div class="fin-moves-strip" id="fin-money-moves" role="region" aria-label="Prioritized money moves">
      <div class="fin-moves-head">
        <div class="fin-moves-title-wrap">
          <span class="fin-moves-kicker">Actionable Insights</span>
          <h3>${topMoves.length === 1 ? "1 Recommended Portfolio Action" : `Priority Portfolio Actions (${topMoves.length})`}</h3>
        </div>
        <span class="fin-moves-subpill">Disappears once applied · Ranked by impact</span>
      </div>
      <div class="fin-moves-grid cols-${topMoves.length}">
        ${topMoves
          .map(
            (mv, idx) => `
          <article class="fin-move-card card-surface">
            <div class="fin-move-top">
              <span class="fin-move-rank">#${idx + 1}</span>
              <span class="fin-move-badge ${mv.tone}">${mv.badge}</span>
            </div>
            <h4 class="fin-move-title">${mv.title}</h4>
            <p class="fin-move-desc">${mv.desc}</p>
            <div class="fin-move-actions">
              ${mv.ctaHtml}
              ${mv.subHtml}
            </div>
          </article>`,
          )
          .join("")}
      </div>
    </div>`;
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
) {
  const fn = fire.fireNumber;
  const pct = Math.min(100, Math.max(0, Math.round(fn.pctFunded || 0)));
  const pctLabel = formatFundedPct(fn.pctFunded);
  const onTrack = fn.pctFunded >= 100 && fn.fullyFundedTo95;
  const cashSavingMo = simulation.cashSaving || 0;
  const hasCustomSaveOverride =
    !r.retiringNow &&
    (Math.abs(simulation.invest - s.privateSaving) > 1 || cashSavingMo > 0);
  const contribution = r.retiringNow
    ? simulation.cpfExtra + s.privateSaving
    : simulation.cpfExtra + cashSavingMo + simulation.invest;
  const projFireAge = fn.projectedFireAge;
  const readyText = projFireAge == null ? "After 80" : `Age ${projFireAge}`;
  const diffYears = projFireAge == null ? null : fire.retire - projFireAge;
  const depletionAgeDisplay =
    fn.depletionAge != null ? Math.floor(fn.depletionAge) : fire.endAge;
  const survivalAnswer = fn.fullyFundedTo95
    ? `Lasts past age ${fire.endAge}+`
    : `Lasts to age ${depletionAgeDisplay}`;
  const safeAgeAnswer =
    diffYears == null
      ? "After age 80"
      : diffYears > 0
        ? `Age ${projFireAge} (${diffYears} yr${diffYears > 1 ? "s" : ""} earlier optional)`
        : diffYears === 0
          ? `Age ${projFireAge} (on target)`
          : `Age ${projFireAge} (+${-diffYears} yr${-diffYears > 1 ? "s" : ""} later)`;
  const deltaLine =
    diffYears != null && diffYears > 0 && onTrack
      ? `Can retire ${diffYears} yr${diffYears > 1 ? "s" : ""} earlier · ${pctLabel} funded`
      : `${pctLabel} of age-${fire.endAge} goal`;
  const deltaColor =
    diffYears != null && diffYears >= 0 && onTrack ? "#047857" : "#B45309";

  const cpfCov65Pct = Math.min(
    100,
    Math.round((s.payout / Math.max(1, r.spend65)) * 100),
  );
  const ptAtRetire =
    fire.atRetire ||
    fire.points.find((pt) => pt.age === Math.round(fire.retire)) ||
    fire.points[fire.points.length - 1];
  const retireNw = ptAtRetire?.today?.totalNetWorth ?? 0;

  const paycheck = RetirementModel.paycheckAllocation(r, simulation, bogle, p);
  const grossPlusEmployer = paycheck.grossPlusEmployer;
  const paycheckBars = paycheck.rows;

  const milestones = getMilestoneNodes(fire, r, s, simulation);
  const startPt = fire.points[0];
  const startingCpf = startPt?.cpfTotal ?? 0;
  const startingSrs = startPt?.srs ?? 0;
  const startingOutside = startPt?.totalOutside ?? 0;
  const startingLiquid = Math.max(0, startingOutside - startingSrs);
  const startingTotalAssets = startingCpf + startingOutside;
  const yearsToRetire = Math.max(0, fire.retire - fire.age);
  const selectedPathName =
    s.key === "brs" ? "BRS Pledge" : s.key === "ers" ? "ERS Path" : "FRS Path";
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
  const takeHomePctOfGross =
    r.salary > 0 ? Math.round((r.afterCpf / r.salary) * 100) : 0;

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
  const { ssbPctOf150k, fundingSources } = buildFundingSourcesList(
    taps,
    r,
    s,
    cpfCov65Pct,
  );

  return `<section class="swell-section-block" aria-label="Plan snapshot key metrics">
    <div class="swell-section-head">
      <h2>Plan Snapshot</h2>
    </div>
    <div class="fin-top-kpis" role="region" aria-label="Key plan inputs">
      <button type="button" class="fin-kpi-card card-surface is-interactive" data-quick-edit="age" aria-label="Edit your current age ${fire.age}">
        <div class="fin-kpi-head">
          <span class="fin-kpi-label">Your Age</span>
          <span class="swell-kpi-icon" aria-hidden="true">${KPI_ICONS.age}</span>
        </div>
        <strong class="fin-kpi-val">${fire.age} <span class="swell-kpi-unit">yrs</span></strong>
        <span class="fin-kpi-sub"><b class="swell-delta">Current</b> · ${Math.max(0, 55 - fire.age)} yrs to 55</span>
      </button>
      <button type="button" class="fin-kpi-card card-surface is-interactive" data-quick-edit="goal" aria-label="Edit target retirement age ${fire.retire}">
        <div class="fin-kpi-head">
          <span class="fin-kpi-label">Target Retire Age</span>
          <span class="swell-kpi-icon" aria-hidden="true">${KPI_ICONS.goal}</span>
        </div>
        <strong class="fin-kpi-val">Age ${fire.retire}</strong>
        <span class="fin-kpi-sub"><b class="swell-delta">${r.retiringNow ? "Now" : `${yearsToRetire} yrs`}</b> · ${fire.retire < 65 ? `${65 - fire.retire}-yr bridge` : fire.retire === 65 ? "Standard CPF LIFE" : "Deferred payout"}</span>
      </button>
      <button type="button" class="fin-kpi-card card-surface is-interactive" data-quick-edit="salary" aria-label="Edit monthly salary. Take-home ${money(r.afterCpf)} per month on ${money(r.salary)} gross">
        <div class="fin-kpi-head">
          <span class="fin-kpi-label">Take-Home Pay</span>
          <span class="swell-kpi-icon" aria-hidden="true">${KPI_ICONS.salary}</span>
        </div>
        <strong class="fin-kpi-val">${m(r.afterCpf, "/mo", "kpi-takehome")}</strong>
        <span class="fin-kpi-sub"><b class="swell-delta is-up">${takeHomePctOfGross}% net</b> on ${m(r.salary)}/mo</span>
      </button>
      <button type="button" class="fin-kpi-card card-surface is-interactive" data-quick-edit="balances" aria-label="Edit total assets ${money(startingTotalAssets)}">
        <div class="fin-kpi-head">
          <span class="fin-kpi-label">Total Assets</span>
          <span class="swell-kpi-icon" aria-hidden="true">${KPI_ICONS.balances}</span>
        </div>
        <strong class="fin-kpi-val">${m(startingTotalAssets, "", "kpi-assets")}</strong>
        <span class="fin-kpi-sub"><b class="swell-delta is-up">${compactMoney(startingCpf)} CPF</b> · ${compactMoney(Math.max(0, startingOutside - startingSrs))} liq${startingSrs > 0 ? ` · ${compactMoney(startingSrs)} SRS` : ""}</span>
      </button>
    </div>
    <details class="overview-disclosure-card">
      <summary class="overview-disclosure-summary">
        <span>Portfolio &amp; Cashflow Breakdown</span>
        <span class="overview-disclosure-meta">Net Worth · Take-Home Cashflow · Passive Yield · Recurring Budget</span>
      </summary>
      <div class="overview-disclosure-body">
        ${buildFinBentoGridHTML({
          fire,
          r,
          p,
          simulation,
          bogle,
          pctOfPay,
          contribution,
          expenseData,
          taps,
          paycheck,
          tax,
          startingCpf,
          startingSrs,
          startingTotalAssets,
        })}
      </div>
    </details>
    ${buildMoneyMovesStripHTML({
      fire,
      r,
      s,
      p,
      simulation,
      bogle,
      contribution,
      taps,
      tax,
      expenseData,
      pctOfPay,
    })}
    ${expenseData ? buildExpenseCardHTML(expenseData, r) : ""}
  </section>

  <section class="swell-section-block" aria-label="Monthly CPF, savings, and investment plan">
    <div class="swell-section-head">
      <h2>Monthly Savings &amp; Investment Plan</h2>
      ${
        !r.retiringNow && pctOfPay <= 50
          ? `<span class="status-pill is-good">${pctOfPay > 30 ? "Healthy" : "Comfortable"} · ${pctOfPay}% of take-home</span>`
          : ""
      }
    </div>
    <div class="fin-saving-trio-grid" role="region" aria-label="Monthly CPF, savings, and investment plan">
      <button type="button" class="fin-card fin-saving-card fin-planned-cpf-card card-surface is-interactive" data-quick-edit="cpf-extra" data-qe-focus="#qe-cpf-extra" aria-label="Edit extra CPF saving each month">
        ${(() => {
          const cpfExtraMo = simulation.cpfExtra || 0;
          const rstuYr = Math.round(
            tax?.activeSelfRstu ?? Math.min(8000, cpfExtraMo * 12),
          );
          return `<div class="fin-saving-top">
              <span class="fin-saving-title">Extra CPF saving</span>
              <span class="status-pill is-good">4.0% p.a. SA / RA</span>
            </div>
            <div class="fin-saving-val-row">
              <strong>${m(cpfExtraMo, "/mo", "saving-cpf-extra")}</strong>
            </div>
            <div class="fin-saving-meta">
              <span>Age-55 CPF: <strong>${m(s.balance, "", "saving-cpf-55")}</strong> · CPF LIFE (65+): <strong>${m(s.payout, "/mo", "saving-cpf-life")}</strong></span>
              <small>IRAS RSTU tax relief: <strong>${m(rstuYr, "/yr", "saving-cpf-rstu")}</strong> of $8,000/yr max cap${Math.abs(cpfExtraMo - s.cpfFunding) > 1 ? ` · Path target ${m(s.cpfFunding, "/mo")}` : ""}</small>
            </div>`;
        })()}
      </button>

      <button type="button" class="fin-card fin-saving-card fin-planned-savings-card card-surface is-interactive" data-quick-edit="cash-saving" data-qe-focus="#qe-cash-saving" aria-label="Edit monthly planned savings (HYSA / SSB)">
        ${(() => {
          const hysaRatePct = Number(taps.tap4Ssb.effectiveRatePct.toFixed(2));
          const curCashBal = taps.tap4Ssb.currentSsbCash;
          const projCashAtRetire = taps.tap4Ssb.projectedCashOnlyAtRetireToday;
          const curCashYieldMo = taps.tap4Ssb.currentMonthlyYield;
          return `<div class="fin-saving-top">
              <span class="fin-saving-title is-cash-tone">Monthly planned savings</span>
              <span class="status-pill is-info">${hysaRatePct}% p.a. HYSA / SSB</span>
            </div>
            <div class="fin-saving-val-row">
              <strong>${m(taps.tap4Ssb.monthlyCashSaving, "/mo", "saving-cash")}</strong>
            </div>
            <div class="fin-saving-meta">
              <span>Today: <strong>${m(curCashBal, "", "saving-cash-bal")}</strong> → Age ${fire.retire}: <strong>${m(projCashAtRetire, "", "saving-cash-ret")}</strong> (Tap 4)</span>
              <small>Yields ~<strong>${m(curCashYieldMo, "/mo", "saving-cash-yield")}</strong> today at <strong>${hysaRatePct}% p.a.</strong> projected HYSA / SSB rate</small>
            </div>`;
        })()}
      </button>

      <button type="button" class="fin-card fin-saving-card fin-planned-invest-card card-surface is-interactive" data-quick-edit="invest" data-qe-focus="#qe-invest" aria-label="Edit monthly planned investment (Outside investment)">
        ${(() => {
          if (r.retiringNow) {
            const pillTone = s.remainingPortfolioGap > 0 ? "warn" : "good";
            return `<div class="fin-saving-top">
                <span class="fin-saving-title is-invest-tone">Portfolio gap now</span>
                <span class="status-pill is-${pillTone}">Lump sum</span>
              </div>
              <div class="fin-saving-val-row">
                <strong>${m(s.privateSaving, "", "saving-lump")}</strong>
                <span class="fin-curr">now</span>
              </div>
              <div class="fin-saving-meta">
                <span>Immediate portfolio requirement</span>
                <small>Follows your ${taps.tap3Equities.targetEquityPct}% Equity / ${taps.tap3Equities.targetBondPct}% Bond outside investment split</small>
              </div>`;
          }
          const glPct = taps.tap3Equities.globalSplitPct;
          const sgPct = taps.tap3Equities.sgDividendSplitPct;
          const curInvestBal = taps.tap3Equities.currentEquities;
          const projInvestAtRetire =
            taps.tap3Equities.projectedInvestAtRetireToday;
          return `<div class="fin-saving-top">
              <span class="fin-saving-title is-invest-tone">Monthly planned investment</span>
              <span class="status-pill is-good">${taps.tap3Equities.targetEquityPct}% Eq / ${taps.tap3Equities.targetBondPct}% Bond</span>
            </div>
            <div class="fin-saving-val-row">
              <strong>${m(taps.tap3Equities.monthlyInvest, "/mo", "saving-outside")}</strong>
            </div>
            <div class="fin-saving-meta">
              <span>Today: <strong>${m(curInvestBal, "", "saving-inv-bal")}</strong> → Age ${fire.retire}: <strong>${m(projInvestAtRetire, "", "saving-inv-ret")}</strong> (Tap 3: <strong>${m(taps.tap3Equities.projectedMonthlyDrawToday, "/mo", "saving-inv-draw")}</strong>)</span>
              <small>Outside split (${glPct}/${sgPct} G/SG): <strong>${m(taps.tap3Equities.monthlyGlobalBuy, "", "saving-buy-eq")}</strong> Global · <strong>${m(taps.tap3Equities.monthlySgBuy, "", "saving-buy-sg")}</strong> SG · <strong>${m(taps.tap3Equities.monthlyBondBuy, "", "saving-buy-bond")}</strong> Bond${Math.abs(taps.tap3Equities.monthlyInvest - s.privateSaving) > 1 ? ` (target ${m(s.privateSaving)})` : ""}</small>
            </div>`;
        })()}
      </button>
    </div>

    ${(() => {
      if (r.retiringNow) return "";
      const cashflowHealth = computeMonthlyTakeHomeCashflow({
        r,
        simulation,
        contribution,
        p,
        tax,
        expenseData,
      });
      const exactPct = r.afterCpf > 0 ? (contribution / r.afterCpf) * 100 : 0;
      const clampedPct = Math.min(100, Math.max(0, exactPct));
      const {
        leftAfterSave,
        netCashSurplus,
        fixedOutMo,
        monthlyTax,
        housingCashMo,
        recurringTotal,
      } = cashflowHealth;
      const exceedsPay = leftAfterSave < 0;
      const hasCashDeficit = !exceedsPay && netCashSurplus < 0;
      const isCritical = exceedsPay || hasCashDeficit || pctOfPay > 85;
      const isStretched = !isCritical && pctOfPay > 50;
      const pillTone = isCritical ? "danger" : isStretched ? "warn" : "good";
      const bandLabel = exceedsPay
        ? "Exceeds pay"
        : hasCashDeficit
          ? "Cash Shortfall"
          : pctOfPay > 85
            ? "Critical"
            : pctOfPay > 50
              ? "Stretched"
              : pctOfPay > 30
                ? "Healthy"
                : "Comfortable";
      const pillText = hasCashDeficit
        ? `${bandLabel} · −${money(-netCashSurplus)}/mo`
        : `${bandLabel} · ${pctOfPay}% of take-home`;

      const healthyFill =
        Math.round(Math.min(100, (Math.min(clampedPct, 50) / 50) * 100) * 10) /
        10;
      const stretchedFill =
        clampedPct > 50
          ? Math.round(
              Math.min(100, ((Math.min(clampedPct, 85) - 50) / 35) * 100) * 10,
            ) / 10
          : 0;
      const criticalFill =
        clampedPct > 85
          ? Math.round(
              Math.min(100, ((Math.min(clampedPct, 100) - 85) / 15) * 100) * 10,
            ) / 10
          : 0;
      const markerPos = Math.round(clampedPct * 10) / 10;
      const leftSharePct = Math.max(0, 100 - pctOfPay);

      const meterHtml = `<div class="fin-band-meter">
        <div class="fin-band-track-wrap" role="img" aria-label="Monthly saving takes ${pctOfPay}% of take-home pay. Thresholds: up to 50% healthy, 51 to 85% stretched, over 85% critical.">
          <div class="fin-band-track">
            <div class="fin-band-zone is-healthy">
              <span class="fin-band-fill" data-meter-key="band-healthy" data-meter-w="${healthyFill}" style="width:${healthyFill}%;"></span>
            </div>
            <div class="fin-band-zone is-stretched">
              <span class="fin-band-fill" data-meter-key="band-stretched" data-meter-w="${stretchedFill}" style="width:${stretchedFill}%;"></span>
            </div>
            <div class="fin-band-zone is-critical">
              <span class="fin-band-fill" data-meter-key="band-critical" data-meter-w="${criticalFill}" style="width:${criticalFill}%;"></span>
            </div>
          </div>
          <span class="fin-band-marker is-${pillTone}" data-meter-key="band-marker" data-meter-left="${markerPos}" style="left:clamp(6px, ${markerPos}%, calc(100% - 6px));"></span>
        </div>
        <div class="fin-band-scale" aria-hidden="true">
          <span data-tick="0">0%</span>
          <span data-tick="50">50%</span>
          <span data-tick="85">85%</span>
          <span data-tick="100">100%</span>
        </div>
        <div class="fin-band-legend">
          <span><i style="background:var(--sem-cpf);"></i>≤50% Healthy</span>
          <span><i style="background:var(--sem-cash);"></i>51–85% Stretched</span>
          <span><i style="background:var(--sem-alert);"></i>&gt;85% Critical</span>
        </div>
      </div>`;

      const hasMonthlyShortfall = s.contributionShortfall > 1;
      const monthlyChipLabel = hasMonthlyShortfall
        ? "Invest more / mo"
        : "Cap saving";
      const shortfallLine = hasMonthlyShortfall
        ? ` <span class="fin-saving-gap-note">Currently investing ${m(s.chosenInvest, "/mo")} — ${m(s.contributionShortfall, "/mo")} below target.</span>`
        : "";

      const surplusNote =
        netCashSurplus > 0
          ? `+${m(netCashSurplus, "/mo")} surplus after ${m(fixedOutMo, "/mo")} tax &amp; fixed bills`
          : `exact match for ${m(fixedOutMo, "/mo")} tax &amp; fixed bills`;

      const statusHtml = exceedsPay
        ? `<div class="fin-saving-alert is-danger" role="status">
            <p>Exceeds your <strong>${m(r.afterCpf)}</strong> take-home by <strong>${m(-leftAfterSave, "/mo")}</strong> (plus ${m(fixedOutMo, "/mo")} tax &amp; bills = <strong>−${m(-netCashSurplus, "/mo")}</strong> shortfall).${shortfallLine}</p>
            <div class="fin-saving-actions">
              <button type="button" class="fin-action-chip" data-quick-edit="balances">Invest assets</button>
              <button type="button" class="fin-action-chip" commandfor="plan-settings" command="show-modal" aria-haspopup="dialog">Boost return</button>
              <button type="button" class="fin-action-chip" data-quick-edit="invest">${monthlyChipLabel}</button>
              <button type="button" class="fin-action-chip" data-quick-edit="goal">Retire later</button>
              <button type="button" class="fin-action-chip" data-quick-edit="budget">Trim retire budget</button>
            </div>
          </div>`
        : hasCashDeficit
          ? `<div class="fin-saving-alert is-danger" role="status">
              <p><strong>Short −${m(-netCashSurplus, "/mo")} after bills:</strong> ${m(leftAfterSave, "/mo")} (${leftSharePct}%) left after saving does not cover ${m(monthlyTax, "/mo")} IRAS tax${housingCashMo > 0 ? `, ${m(housingCashMo, "/mo")} cash housing` : ""} &amp; ${m(recurringTotal, "/mo")} fixed bills (${m(fixedOutMo, "/mo")}).${shortfallLine}</p>
              <div class="fin-saving-actions">
                <button type="button" class="fin-action-chip" data-quick-edit="invest">${monthlyChipLabel}</button>
                <button type="button" class="fin-action-chip" data-open-expense-modal="custom">Review bills</button>
                <button type="button" class="fin-action-chip" data-quick-edit="balances">Invest assets</button>
                <button type="button" class="fin-action-chip" data-quick-edit="goal">Retire later</button>
              </div>
            </div>`
          : isCritical
            ? `<div class="fin-saving-alert is-danger" role="status">
                <p>Above the <strong>85%</strong> critical threshold — leaves <strong>${m(leftAfterSave, "/mo")}</strong> (${leftSharePct}%) of take-home (${surplusNote}).${shortfallLine}</p>
                <div class="fin-saving-actions">
                  <button type="button" class="fin-action-chip" data-quick-edit="balances">Invest assets</button>
                  <button type="button" class="fin-action-chip" commandfor="plan-settings" command="show-modal" aria-haspopup="dialog">Boost return</button>
                  <button type="button" class="fin-action-chip" data-quick-edit="invest">${monthlyChipLabel}</button>
                  <button type="button" class="fin-action-chip" data-quick-edit="goal">Retire later</button>
                  <button type="button" class="fin-action-chip" data-quick-edit="budget">Trim retire budget</button>
                </div>
              </div>`
            : isStretched
              ? `<div class="fin-saving-alert is-warn" role="status">
                  <p>Above the <strong>50%</strong> healthy threshold — leaves <strong>${m(leftAfterSave, "/mo")}</strong> (${leftSharePct}%) of take-home (${surplusNote}).${shortfallLine}</p>
                  <div class="fin-saving-actions">
                    ${hasMonthlyShortfall ? `<button type="button" class="fin-action-chip" data-quick-edit="invest">Invest more / mo</button>` : ""}
                    <button type="button" class="fin-action-chip" data-quick-edit="balances">Invest assets</button>
                    <button type="button" class="fin-action-chip" commandfor="plan-settings" command="show-modal" aria-haspopup="dialog">Boost return</button>
                    <button type="button" class="fin-action-chip" data-quick-edit="invest" data-qe-focus="#qe-target-equity">Adjust split</button>
                  </div>
                </div>`
              : `<div class="fin-saving-ok-row">
                  <p class="fin-saving-ok">Within the <strong>≤50%</strong> healthy threshold — leaves <strong>${m(leftAfterSave, "/mo")}</strong> (${leftSharePct}%) of take-home (${surplusNote}).${shortfallLine}</p>
                </div>`;

      if (!isCritical && !isStretched && !hasMonthlyShortfall) {
        return "";
      }

      return `<section class="fin-card fin-saving-health-bar card-surface" aria-label="Monthly take-home saving health">
        <div class="fin-saving-health-left">
          <div class="fin-saving-health-head">
            <span class="fin-saving-health-title">Monthly Take-Home Saving Health</span>
            <span class="status-pill is-${pillTone}">${pillText}</span>
          </div>
          <p class="fin-saving-health-sub">
            Total planned saving <strong>${m(contribution, "/mo", "saving-monthly")}</strong> (${m(simulation.cpfExtra || 0)} CPF · ${m(cashSavingMo)} Savings · ${m(simulation.invest)} Investment)
            ${exceedsPay ? `exceeds ${m(r.afterCpf)} take-home by <strong>${m(-leftAfterSave, "/mo", "saving-left")}</strong>` : `leaves <strong>${m(leftAfterSave, "/mo", "saving-left")}</strong> before <strong>${m(fixedOutMo, "/mo")}</strong> tax &amp; fixed bills`}
          </p>
          ${statusHtml}
        </div>
        <div class="fin-saving-health-right">
          ${meterHtml}
        </div>
      </section>`;
    })()}
  </section>

  <section class="swell-section-block" aria-label="Wealth trajectory, income taps, and retirement readiness">
    <div class="swell-section-head">
      <h2>Trajectory &amp; Readiness</h2>
    </div>
    <div class="swell-discover-grid">
      <section class="fin-card fin-hero-card card-surface" aria-labelledby="ember-traj-title">
        <div class="swell-mini-kpis">
          <div class="swell-mini-kpi is-primary">
            <span class="fin-card-eyebrow" id="ember-traj-title">Net Worth at Age ${fire.retire}</span>
            <div class="fin-big-figure-row">
              <strong class="fin-big-figure" id="hero-nw-live">${m(retireNw, "", "hero-nw")}</strong>
            </div>
            <span class="swell-sub-delta" id="hero-nw-sub-live"><b class="swell-delta ${onTrack ? "is-up" : "is-warn"}">${pctLabel} funded</b> to age ${fire.endAge}</span>
          </div>
          <div class="swell-mini-kpi">
            <span class="fin-card-eyebrow">${hasCustomSaveOverride ? "Committed Saving" : "Monthly Saving"}</span>
            <strong class="swell-mid-figure">${m(contribution, "/mo", "hero-save")}</strong>
            <span class="swell-sub-delta"><b class="swell-delta ${pctOfPay <= 50 ? "is-up" : "is-down"}">${pctOfPay}%</b> of take-home</span>
          </div>
          <div class="swell-mini-kpi">
            <span class="fin-card-eyebrow">CPF LIFE from 65</span>
            <strong class="swell-mid-figure is-emerald">${m(s.payout, "/mo", "hero-cpf-life")}</strong>
            <span class="swell-sub-delta"><b class="swell-delta is-up">${cpfCov65Pct}%</b> of budget</span>
          </div>
        </div>
        ${(() => {
          const ssbMoFloor = Math.round(
            taps.tap4Ssb.currentSsbCash > 0
              ? (taps.tap4Ssb.currentMonthlyYield ?? 0)
              : 0,
          );
          const guaranteedFloorMo = Math.round(s.payout + ssbMoFloor);
          const guaranteedPct = Math.min(
            100,
            Math.round((guaranteedFloorMo / Math.max(1, r.spend65)) * 100),
          );
          const marketDrawMo = Math.max(
            0,
            Math.round(r.spend65 - guaranteedFloorMo),
          );
          const marketPct = Math.max(0, 100 - guaranteedPct);
          return `<div class="fin-security-split-bar" aria-label="Age-65 Guaranteed Sovereign Floor versus Market Drawdown">
            <div class="fin-security-split-meta">
              <span><i style="background:var(--sem-cpf);"></i>Guaranteed Floor (CPF LIFE + SSB): <strong>${m(guaranteedFloorMo, "/mo")} (${guaranteedPct}%)</strong></span>
              <span><i style="background:var(--primary);"></i>Market Portfolio Draw: <strong>${m(marketDrawMo, "/mo")} (${marketPct}%)</strong></span>
            </div>
            <div class="fin-security-split-track" aria-hidden="true">
              <span style="width:${guaranteedPct}%;background:var(--sem-cpf);"></span>
              <span style="width:${marketPct}%;background:var(--primary);"></span>
            </div>
          </div>`;
        })()}
        <div class="swell-chart-subbar">
          <div class="swell-inline-keys" aria-hidden="true">
            <span class="swell-inline-key"><i class="swell-key-swatch is-pink"></i>${Math.min(55, fire.retire)}+ Wealth</span>
            <span class="swell-inline-key"><i class="swell-key-swatch is-slate"></i>Pre-${Math.min(55, fire.retire)} Base</span>
            <span class="swell-inline-key"><i class="swell-key-line"></i>Net Worth Trend</span>
          </div>
          <button type="button" class="fin-link-pill" data-quick-edit="balances">Edit balances</button>
        </div>
        <div class="chart-wrapper">
          <div id="dash-networth-chart" class="chart-area" role="img" aria-label="Stacked net worth trajectory from age ${fire.age} to ${fire.endAge}"></div>
          <div id="dash-networth-tooltip" class="chart-tooltip" hidden></div>
        </div>
        <div class="chart-legend fin-chart-legend" id="dash-networth-legend"></div>
      </section>

      <section class="fin-card fin-activity-card card-surface" aria-label="Key milestones and paycheck allocation">
        <div class="fin-activity-head">
          <h2>Milestones &amp; Paycheck</h2>
          <button type="button" class="fin-link-pill" data-quick-edit="budget">Edit budget</button>
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
                    <span>${n.tag} · ${n.sub}</span>
                  </div>
                  <div class="ember-feed-right">
                    <b>${n.metric}</b>
                    <span class="swell-slate-pill">${n.pill}</span>
                  </div>
                </li>`,
              )
              .join("")}
          </ul>
          <div class="fin-coverage-card">
            <div class="fin-cov-head">
              <span>Age-65 income split</span>
              <strong>${money(r.spend65)}/mo need</strong>
            </div>
            <div class="fin-cov-track" aria-hidden="true">
              <span class="fin-cov-cpf" data-meter-key="cov-cpf" data-meter-w="${cpfCov65Pct}" style="width:${cpfCov65Pct}%"></span>
              <span class="fin-cov-out" data-meter-key="cov-out" data-meter-w="${Math.max(0, 100 - cpfCov65Pct)}" style="width:${Math.max(0, 100 - cpfCov65Pct)}%"></span>
            </div>
            <div class="fin-cov-legend">
              <span><i style="background:#10B981;"></i><b>${money(s.payout)}/mo</b> CPF LIFE (${cpfCov65Pct}%)</span>
              <span><i style="background:#2563EB;"></i><b>${money(s.gap65)}/mo</b> savings (${Math.max(0, 100 - cpfCov65Pct)}%)</span>
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
                    <span><i style="background:${row.color};"></i>${row.label} <small>(${money(row.amt)})</small></span>
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
            <span>Savings rate: <strong>${pctOfPay}%</strong> of ${m(r.afterCpf)} take-home</span>
            <button type="button" class="text-button" data-go-tab="allocator">Allocator →</button>
          </div>
        </div>
      </section>

      <button type="button" class="fin-card fin-gauge-card card-surface is-interactive" data-quick-edit="goal" aria-label="Edit target retirement age. Earliest safe age ${readyText}, ${survivalAnswer}">
        <div class="fin-gauge-head">
          <h2>Retirement Readiness</h2>
          <span class="fin-target-pill">Goal: Age ${fire.retire}</span>
        </div>
        ${buildFinReadinessGaugeSVG(
          pct,
          "Earliest Safe Retirement Age",
          readyText,
          deltaLine,
          deltaColor,
          onTrack,
          "swell",
          fire.endAge,
        )}
        <div class="fin-gauge-facts">
          <div class="fin-gauge-fact-row">
            <span>Retiring at ${fire.retire}</span>
            <strong class="${fn.fullyFundedTo95 ? "is-good" : "is-warn"}">${survivalAnswer}</strong>
          </div>
          <div class="fin-gauge-fact-row">
            <span>Safe age (to ${fire.endAge})</span>
            <strong>${safeAgeAnswer}</strong>
          </div>
        </div>
      </button>
    </div>
  </section>

  <section class="swell-section-block" aria-label="CPF strategy paths and retirement income architecture">
    <div class="swell-section-head">
      <h2>CPF Strategy &amp; Income Architecture</h2>
    </div>
    <section class="fin-card fin-table-card card-surface swell-path-full-card" aria-labelledby="ledger-title">
      <div class="ember-card-head">
        <div>
          <h2 id="ledger-title">CPF Retirement Path</h2>
          <p>${r.retiringNow ? "With retirement set to now, BRS, FRS and ERS model Age-55 Retirement Sum levels using current balances or lump-sum top-ups." : "Compare BRS (Property Pledge), FRS Target, and ERS Maximum to set your Age-55 Retirement Sum and lifelong CPF LIFE income."}</p>
        </div>
        <div class="ember-card-actions">
          <div class="cpf-plan-inline-toggle" role="group" aria-label="CPF LIFE payout plan">
            <button type="button" class="cpf-plan-chip${r.plan !== "escalating" ? " is-active" : ""}" data-toggle-cpf-plan="standard" aria-pressed="${r.plan !== "escalating"}">Standard</button>
            <button type="button" class="cpf-plan-chip${r.plan === "escalating" ? " is-active" : ""}" data-toggle-cpf-plan="escalating" aria-pressed="${r.plan === "escalating"}">Escalating +2%/yr</button>
          </div>
        </div>
      </div>
      <div class="table-scroll">
        <table class="ember-ledger-table fin-table is-row-selectable">
          <thead>
            <tr>
              <th scope="col">Strategy Path</th>
              <th scope="col">Age-55 CPF</th>
              <th scope="col">Extra CPF</th>
              <th scope="col">Outside Save</th>
              <th scope="col">CPF LIFE (65+)</th>
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
                    <button type="button" class="ledger-path-select-btn" data-path="${path.key}" aria-pressed="${isSelected}" aria-label="${escapeAttr(meta.name)} (${escapeAttr(meta.tag)}): Age-55 CPF ${money(rowBal)}, CPF LIFE ${money(rowLife)}/mo${isSelected ? ", currently selected" : ""}">
                      <span class="fin-table-path">
                        <span class="ledger-row-radio${isSelected ? " is-active" : ""}" aria-hidden="true"></span>
                        <span class="fin-path-icon" style="background:${meta.softBg};color:${meta.accent};">${meta.icon}</span>
                        <span>
                          <span class="ledger-path-cell">
                            <strong>${meta.name}</strong>
                            <span class="ledger-tag">${meta.tag}</span>
                            ${isSelected ? '<span class="ledger-active-pill">Active Path</span>' : ""}
                          </span>
                          <small class="ledger-sub">${meta.note}</small>
                        </span>
                      </span>
                    </button>
                  </td>
                  <td class="num-cell" data-label="Age-55 CPF">${m(rowBal, "", `path-${path.key}-bal`)}</td>
                  <td class="num-cell" data-label="Extra CPF">${m(rowCpf, r.retiringNow ? " now" : "/mo", `path-${path.key}-cpf`)}${cpfDiffers ? `<small class="ledger-cell-sub">Path: ${m(path.cpfFunding, "/mo")}</small>` : ""}</td>
                  <td class="num-cell" data-label="Outside Save">${m(rowOut, r.retiringNow ? " now" : "/mo", `path-${path.key}-out`)}${outDiffers ? `<small class="ledger-cell-sub">Target: ${m(s.privateSaving, "/mo")}</small>` : ""}</td>
                  <td class="num-cell" data-label="CPF LIFE (65+)"><strong>${m(rowLife, "/mo", `path-${path.key}-life`)}</strong></td>
                </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>
      <details class="ember-disclaimer">
        <summary class="ember-disclaimer-summary">
          <span class="disclaimer-chip">2026 CPF &amp; IRAS</span>
          <span class="disclaimer-preview">Today’s dollars · ${Number((r.inflation * 100).toFixed(1))}% inflation · ${Number((r.investmentReturn * 100).toFixed(1))}% outside return</span>
          <span class="disclaimer-toggle" aria-hidden="true">
            <span class="disclaimer-toggle-label">Details</span>
            <svg class="disclaimer-toggle-icon" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true">
              <path class="line-h" d="M3.5 8h9" />
              <path class="line-v" d="M8 3.5v9" />
            </svg>
          </span>
        </summary>
        <div class="ember-disclaimer-body">
          <ul>
            <li><strong>Purchasing power &amp; return:</strong> Shows today’s dollars (${Number((r.inflation * 100).toFixed(1))}% inflation, ${Number((r.investmentReturn * 100).toFixed(1))}% blended net outside return including ETFs/SSB; ${r.post55Work ? "post-55 salary CPF included" : "post-55 work contributions excluded"}).</li>
            <li><strong>2026 CPF &amp; IRAS rules:</strong> OW ceiling ${money(RetirementModel.C.wageCap)}/mo, Basic Healthcare Sum ${money(RetirementModel.C.bhs)}, FRS ${money(RetirementModel.C.frs)}, ERS ${money(RetirementModel.C.ers)}, and ${money(RetirementModel.C.personalReliefCap)} personal relief cap.</li>
            <li><strong>Irreversible actions:</strong> Cash RSTU and OA-to-SA transfers before 55 cannot be reversed and receive $0 tax relief once SA/RA hits FRS. <button type="button" class="footnote-link-btn" commandfor="plan-settings" command="show-modal" aria-haspopup="dialog">Review assumptions ↗</button></li>
          </ul>
        </div>
      </details>
    </section>

    <section class="fin-card card-surface swell-taps-card" id="retirement-taps-card" aria-labelledby="taps-blueprint-title">
      <div class="ember-card-head">
        <div>
          <h2 id="taps-blueprint-title">4-Tap Retirement Income Architecture &amp; Guardrails</h2>
          <p>How your CPF LIFE floor, SRS 10-year tax-concession bridge, ${100 - Math.round(Number(p.sgSleevePct ?? 15))}/${Math.round(Number(p.sgSleevePct ?? 15))} Global &amp; SG Dividend portfolio, and $150k SSB buffer stack together.</p>
        </div>
        <span class="swell-slate-pill">4 Income Taps</span>
      </div>
      <div class="swell-taps-grid">
        ${(() => {
          const tap1Pct = taps.tap1Cpf.budgetCoveragePct ?? cpfCov65Pct;
          const tap2Pct = Math.min(
            100,
            Math.round((taps.tap2Srs.projectedAt63 / 400000) * 100),
          );
          const tap3Pct =
            s.gap65 > 0
              ? (taps.tap3Equities.gapCoveragePct ?? 100)
              : Math.min(
                  100,
                  Math.round(
                    (taps.tap3Equities.projectedMonthlyDrawToday / 2200) * 100,
                  ),
                );
          const tap4Pct = ssbPctOf150k;
          const srsMarginalPct = ((taps.tap2Srs.marginalRate ?? 0) * 100)
            .toFixed(1)
            .replace(/\.0$/, "");
          const tap2PillTone =
            taps.tap2Srs.verdictStatus === "trap-alert" ||
            taps.tap2Srs.verdictStatus === "idle-cash"
              ? "is-danger"
              : taps.tap2Srs.verdictStatus === "worth-it"
                ? "is-srs"
                : taps.tap2Srs.verdictStatus === "rstu-first"
                  ? "is-good"
                  : "is-neutral";
          const srsTaxSavedVal =
            taps.tap2Srs.maxRstu > 0
              ? taps.tap2Srs.srsTaxSavedAfterRstu
              : taps.tap2Srs.srsStandaloneTaxSaved;
          const srsEligibleCap =
            taps.tap2Srs.maxRstu > 0
              ? taps.tap2Srs.maxSrsAfterRstu
              : taps.tap2Srs.annualCap;
          let tap2BodyHTML;
          if (taps.tap2Srs.verdictStatus === "trap-alert") {
            tap2BodyHTML = `<strong>Ballooning Trap Alert:</strong> Projected <strong>${m(taps.tap2Srs.projectedAt63)}</strong> nominal pot at age <strong>${taps.tap2Srs.startAge}</strong> exceeds $450k (~<strong>${m(taps.tap2Srs.withdrawalTaxAnnual, "/yr")}</strong> withdrawal tax). Cap annual SRS at <strong>≤${m(taps.tap2Srs.maxSafeAnnualTo400k, "/yr")}</strong> and invest overflow in brokerage.`;
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
          const tap2MetaLabel =
            taps.tap2Srs.projectedAt63 > 0
              ? `Age-${taps.tap2Srs.startAge} pot (${m(taps.tap2Srs.projectedAt63)} nom.) vs $400k cap`
              : taps.tap2Srs.worthIt
                ? `Age-${taps.tap2Srs.startAge} pot ($0/yr set) vs $400k soft cap`
                : `${srsMarginalPct}% tax bracket · $0 SRS pot planned`;
          return `
        <article class="swell-tap-box">
          <div class="swell-tap-top">
            <span class="swell-tap-badge is-tap1">Tap 1 · Age 55 &amp; 65+</span>
            <span class="tap-verdict-pill is-good">${m(s.payout, "/mo")}${taps.tap1Cpf.oaInterestMonthlyToday >= 1 ? ` + ${m(taps.tap1Cpf.oaInterestMonthlyToday, "/mo")} OA` : ""}</span>
          </div>
          <h3>CPF LIFE (${r.plan === "escalating" ? "Escalating +2%/yr" : "Standard"}) &amp; OA Interest</h3>
          <div class="tap-progress-wrap">
            <div class="tap-progress-meta">
              <span>Covers ${tap1Pct}% of ${m(r.spend65, "/mo")} age-65 need</span>
              <strong>${tap1Pct}%</strong>
            </div>
            <div class="tap-progress-track" role="progressbar" aria-valuenow="${tap1Pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Tap 1 CPF LIFE coverage of age-65 retirement budget">
              <span class="tap-progress-fill is-tap1" style="width:${tap1Pct}%"></span>
            </div>
          </div>
          <p>Your <strong>${selectedPathName}</strong> projects <strong>${m(s.payout, "/mo")}</strong> from 65, covering <strong>${tap1Pct}%</strong> of your <strong>${m(r.spend65, "/mo")}</strong> age-65 budget (2026 anchors: BRS $950 · FRS $1,780 · ERS $3,440/mo).</p>
          <details class="tap-accordion">
            <summary class="tap-accordion-summary"><span>Age-55 OA interest &amp; statutory rules</span><span class="tap-accordion-chevron" aria-hidden="true">▾</span></summary>
            <small class="swell-tap-sub"><strong>When 55, $500k OA ≈ $1,000/mo:</strong> Your projected liquid OA at 55 is <b>${m(taps.tap1Cpf.oaAt55Today)}</b> today’s $ (<b>${m(taps.tap1Cpf.oaAt55Nominal)}</b> nominal → <b>${m(taps.tap1Cpf.oaInterestMonthlyToday, "/mo")}</b> at 2.5% p.a., withdrawable anytime once FRS is met).</small>
          </details>
        </article>
        <article class="swell-tap-box">
          <div class="swell-tap-top">
            <span class="swell-tap-badge is-tap2">Tap 2 · Age ${taps.tap2Srs.startAge}–${taps.tap2Srs.endAge}</span>
            <span class="tap-verdict-pill ${tap2PillTone}">${escapeAttr(taps.tap2Srs.verdictLabel || "≤$40k/yr 0% Tax")}</span>
          </div>
          <h3>SRS 10-Year Tax-Concession Bridge</h3>
          <div class="tap-progress-wrap">
            <div class="tap-progress-meta">
              <span>${tap2MetaLabel}</span>
              <strong>${tap2Pct}%</strong>
            </div>
            <div class="tap-progress-track" role="progressbar" aria-valuenow="${tap2Pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Tap 2 SRS pot toward $400,000 soft cap">
              <span class="tap-progress-fill ${taps.tap2Srs.trapStatus === "balloon-trap" ? "is-danger" : "is-tap2"}" style="width:${tap2Pct}%"></span>
            </div>
          </div>
          <p>${tap2BodyHTML}</p>
          <details class="tap-accordion" ${taps.tap2Srs.trapStatus === "balloon-trap" ? "open" : ""}>
            <summary class="tap-accordion-summary"><span>Ballooning trap guardrail ($450k–$500k)</span><span class="tap-accordion-chevron" aria-hidden="true">▾</span></summary>
            <small class="swell-tap-sub ${taps.tap2Srs.trapStatus === "balloon-trap" ? "is-danger" : ""}"><strong>Critical Trap Guardrail:</strong> Projected age-${taps.tap2Srs.startAge} pot is <b>${m(taps.tap2Srs.projectedAt63)}</b> nominal (<b>${m(taps.tap2Srs.projectedAt63Today ?? taps.tap2Srs.projectedAt63)}</b> today’s $ · <b>${m(taps.tap2Srs.tenYearMonthlyDrawToday ?? taps.tap2Srs.tenYearMonthlyDraw, "/mo")}</b> real draw). Keep nominal SRS ≤<b>$400k</b> (≤${money(taps.tap2Srs.maxSafeAnnualTo400k)}/yr) so 50%-concession withdrawals stay tax-free.</small>
          </details>
        </article>
        <article class="swell-tap-box">
          <div class="swell-tap-top">
            <span class="swell-tap-badge is-tap3">Tap 3 · Brokerage</span>
            <span class="tap-verdict-pill is-info">${taps.tap3Equities.targetEquityPct}/${taps.tap3Equities.targetBondPct} · ${taps.tap3Equities.globalSplitPct}/${taps.tap3Equities.sgDividendSplitPct} G/SG</span>
          </div>
          <h3>Global Growth &amp; SG Dividend Equities</h3>
          <div class="tap-progress-wrap">
            <div class="tap-progress-meta">
              <span>${s.gap65 > 0 ? `Covers ${tap3Pct}% of ${m(s.gap65, "/mo")} post-CPF gap` : "Full post-CPF gap covered · Surplus draw"}</span>
              <strong>${tap3Pct}%</strong>
            </div>
            <div class="tap-progress-track" role="progressbar" aria-valuenow="${tap3Pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Tap 3 monthly equity drawdown coverage">
              <span class="tap-progress-fill is-tap3" style="width:${tap3Pct}%"></span>
            </div>
          </div>
          <p>With <strong>${m(taps.tap3Equities.currentEquities)}</strong> today + <strong>${m(taps.tap3Equities.monthlyInvest, "/mo")}</strong> planned investment growing to <strong>${m(taps.tap3Equities.projectedInvestAtRetireToday)}</strong> at age ${r.retire}, your <strong>${taps.tap3Equities.targetEquityPct}% Eq / ${taps.tap3Equities.targetBondPct}% Bond (${taps.tap3Equities.globalSplitPct}/${taps.tap3Equities.sgDividendSplitPct} G/SG)</strong> portfolio supports <strong>${m(taps.tap3Equities.projectedMonthlyDrawToday, "/mo")}</strong> sustainable drawdown${s.gap65 > 0 ? ` vs your <strong>${m(s.gap65, "/mo")}</strong> post-CPF gap` : " on top of full CPF coverage"}.</p>
          <details class="tap-accordion">
            <summary class="tap-accordion-summary"><span>Overflow &amp; rebalancing rules</span><span class="tap-accordion-chevron" aria-hidden="true">▾</span></summary>
            <small class="swell-tap-sub">Projected outside investment pot at ${r.retire}: <b>${m(taps.tap3Equities.projectedInvestAtRetireToday)}</b> (total outside incl. cash &amp; SRS: <b>${m(taps.tap3Equities.portfolioAtRetireToday)}</b> today’s $).</small>
          </details>
        </article>
        <article class="swell-tap-box">
          <div class="swell-tap-top">
            <span class="swell-tap-badge is-tap4">Tap 4 · Sovereign Buffer</span>
            <span class="tap-verdict-pill is-warn">${taps.tap4Ssb.cashAccountsActive || taps.tap4Ssb.hasCustomCashRate || taps.tap4Ssb.monthlyCashSaving > 0 ? `${!r.retiringNow && taps.tap4Ssb.monthlyCashSaving > 0 ? `+${m(taps.tap4Ssb.monthlyCashSaving, "/mo")} · ` : `${m(taps.tap4Ssb.currentSsbCash)} · `}${taps.tap4Ssb.effectiveRatePct.toFixed(2)}%` : `${m(taps.tap4Ssb.currentSsbCash)} / $150k`}</span>
          </div>
          <h3>SSB After All Done &amp; $150k Buffer</h3>
          <div class="tap-progress-wrap">
            <div class="tap-progress-meta">
              <span>Current SSB &amp; cash vs $150k target</span>
              <strong>${tap4Pct}%</strong>
            </div>
            <div class="tap-progress-track" role="progressbar" aria-valuenow="${tap4Pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Tap 4 SSB buffer progress toward $150,000 target">
              <span class="tap-progress-fill is-tap4" style="width:${tap4Pct}%"></span>
            </div>
          </div>
          <p>Your 6–12m emergency floor is <strong>${m(taps.tap4Ssb.emergencyMin)}–${m(taps.tap4Ssb.emergencyMax)}</strong>. Current cash/SSB (<strong>${m(taps.tap4Ssb.currentSsbCash)}</strong>${!r.retiringNow && taps.tap4Ssb.monthlyCashSaving > 0 ? ` + <strong>${m(taps.tap4Ssb.monthlyCashSaving, "/mo")}</strong> planned savings → <strong>${m(taps.tap4Ssb.projectedCashOnlyAtRetireToday)}</strong> at age ${r.retire}` : ""}) earns ~<strong>${m(taps.tap4Ssb.currentMonthlyYield, "/mo")}</strong> at ${taps.tap4Ssb.cashAccountsActive ? `your blended <strong>${taps.tap4Ssb.effectiveRatePct.toFixed(2)}%</strong> EIR across <strong>${taps.tap4Ssb.accountCount} account${taps.tap4Ssb.accountCount === 1 ? "" : "s"}</strong>${taps.tap4Ssb.overflowBalance > 0 ? ` (${m(taps.tap4Ssb.overflowBalance)} above bonus caps)` : ""}` : taps.tap4Ssb.hasCustomCashRate ? `your <strong>${taps.tap4Ssb.effectiveRatePct.toFixed(2)}% p.a.</strong> projected HYSA / SSB rate` : `live <strong>${taps.tap4Ssb.effectiveRatePct.toFixed(2)}%</strong> 10Y SSB yield`} (~<strong>${money(taps.tap4Ssb.monthlyYieldAt150k)}/mo</strong> at $150k).</p>
          <details class="tap-accordion">
            <summary class="tap-accordion-summary"><span>Redemption &amp; MAS cap mechanics</span><span class="tap-accordion-chevron" aria-hidden="true">▾</span></summary>
            <small class="swell-tap-sub">100% Singapore Government-backed principal within the $200,000 MAS individual limit, with 10-year step-up coupons and penalty-free monthly redemption.</small>
          </details>
        </article>`;
        })()}
      </div>
    </section>
  </section>`;
}

export function setFinActivityTab(tab) {
  finActivityTab = tab;
}
