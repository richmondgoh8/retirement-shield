const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const fmtInt = (value) =>
  Math.round(Math.max(0, value) || 0).toLocaleString("en-SG");
const money = (value) => `$${fmtInt(value)}`;
const m = (value, suffix = "") =>
  `<span class="curr-wrap"><span class="curr-prefix">$</span><span class="curr-num">${fmtInt(value)}</span>${suffix ? `<span class="curr-suffix">${suffix}</span>` : ""}</span>`;
const cents = (value) =>
  `$${Math.max(0, Number(value) || 0).toLocaleString("en-SG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
const centsHtml = (value) => {
  const parts = Math.max(0, Number(value) || 0)
    .toLocaleString("en-SG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    .split(".");
  return `<span class="curr-wrap"><span class="curr-prefix">$</span><span class="curr-num">${parts[0]}</span><span class="curr-dec">.${parts[1]}</span></span>`;
};
const compactMoney = (value) => {
  const v = Math.round(Math.max(0, value) || 0);
  if (v >= 1000000)
    return `$${(v / 1000000).toFixed(2).replace(/\.?0+$/, "")}M`;
  if (v >= 1000) return `$${Math.round(v / 1000)}k`;
  return `$${v}`;
};
const svgCompactMoney = (value) => {
  const v = Math.round(Math.max(0, value) || 0);
  const body =
    v >= 1000000
      ? `${(v / 1000000).toFixed(2).replace(/\.?0+$/, "")}M`
      : v >= 1000
        ? `${Math.round(v / 1000)}k`
        : `${v}`;
  return `<tspan fill-opacity="0.72" font-size="0.86em">$</tspan>${body}`;
};
const svgMoney = (value) =>
  `<tspan fill-opacity="0.72" font-size="0.86em">$</tspan>${fmtInt(value)}`;
const ageLabel = (value) => {
  if (value == null) return "Not reached by 80";
  const totalMonths = Math.round(value * 12);
  return `${Math.floor(totalMonths / 12)} yrs ${totalMonths % 12} mos`;
};

const svgWrap = (paths, size = 16) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

const ICONS = {
  shieldCheck: svgWrap(
    '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    18,
  ),
  alertTriangle: svgWrap(
    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    18,
  ),
  checkTiny: svgWrap(
    '<circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.3 2.3 4.7-4.8"/>',
    15,
  ),
  warnTiny: svgWrap(
    '<circle cx="12" cy="12" r="9"/><path d="M12 8v4.5"/><path d="M12 16h.01"/>',
    15,
  ),
};

function niceAxis(rawMax, steps = 4) {
  const safeMax = Math.max(1000, rawMax);
  const rawStep = safeMax / steps;
  const mag = 10 ** Math.floor(Math.log10(rawStep));
  const norm = rawStep / mag;
  const niceNorm =
    norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  const step = niceNorm * mag;
  const maxVal = step * Math.ceil((safeMax * 1.05) / step);
  const actualSteps = Math.round(maxVal / step);
  const ticks = Array.from({ length: actualSteps + 1 }, (_, i) => i * step);
  return { maxVal, ticks };
}

function resetControl(el, clearTextInputs = false) {
  if (!el) return;
  el.value =
    el.tagName === "SELECT"
      ? ([...el.options].find((o) => o.defaultSelected) || el.options[0]).value
      : clearTextInputs && el.type !== "hidden"
        ? ""
        : el.defaultValue;
}

function syncCustomBudgetReset() {
  const selected = $("#known-lifestyle")?.value || "cca";
  const amount = RetirementModel.lifestyles[selected]?.budget || 2500;
  const custom = $("#known-spend");
  if (!custom) return;
  custom.placeholder = String(amount);
  const rawCustom = (custom.value || "").trim();
  const hasCustom =
    rawCustom !== "" &&
    custom.validity.valid &&
    Number.isFinite(Number(rawCustom)) &&
    Math.round(Number(rawCustom) * 100) !== Math.round(amount * 100);
  const reset = $("#use-preset-budget");
  if (reset) {
    reset.hidden = !hasCustom;
    reset.textContent = `Reset to ${selected === "cca" ? "CCA ($2,500)" : "Home + Helper ($3,500)"} preset`;
  }
}

function renderTrajectoryChart(
  trajectoryData,
  chartMode,
  currentFirePlan = null,
  basis = "today",
) {
  if (!trajectoryData?.points.length) return;
  const { points, summary } = trajectoryData;
  $("#trajectory-values").innerHTML = points
    .map(
      (pt) =>
        `<tr><th scope="row">${pt.age} / ${pt.year}</th><td>${m(pt.monthlySpend)}</td><td>${m(pt.monthlyCPF)}</td><td>${m(pt.monthlyGap)}</td><td>${m(pt.portfolioBalance)}</td></tr>`,
    )
    .join("");
  $("#trajectory-caption").textContent =
    `${trajectoryData.selectedScenario.label}: yearly figures in today’s dollars`;
  const chartArea = $("#trajectory-chart");
  chartArea.setAttribute(
    "aria-label",
    `${chartMode === "cashflow" ? "Monthly spending and CPF income" : "Outside portfolio balance"} from age ${summary.age} to 90. Explore the yearly figures below for all values.`,
  );

  if (chartMode === "networth" && currentFirePlan) {
    renderStackedNetWorthSVG(
      chartArea,
      $("#chart-tooltip"),
      $("#chart-legend"),
      currentFirePlan,
      basis,
    );
    return;
  }
  if (chartMode === "waterfall" && currentFirePlan) {
    renderCashflowWaterfallSVG(
      chartArea,
      $("#chart-tooltip"),
      $("#chart-legend"),
      currentFirePlan,
      basis,
    );
    return;
  }

  const W = 760,
    H = 312,
    padL = 74,
    padR = 26,
    padT = 44,
    padB = 40;
  const plotW = W - padL - padR,
    plotH = H - padT - padB;
  const minAge = points[0].age,
    maxAge = points[points.length - 1].age;
  const dX = (age) => padL + ((age - minAge) / (maxAge - minAge)) * plotW;

  const isCashflow = chartMode === "cashflow";
  const rawMax = Math.max(
    1000,
    ...points.map((pt) =>
      isCashflow
        ? Math.max(pt.monthlySpend, pt.monthlyCPF)
        : pt.portfolioBalance,
    ),
  );
  const { maxVal, ticks } = niceAxis(rawMax, 4);
  const dY = (val) => padT + (1 - Math.max(0, val) / maxVal) * plotH;
  const formatTickSvg = isCashflow ? svgMoney : svgCompactMoney;
  const yTicks = ticks
    .map(
      (v) =>
        `<line x1="${padL}" y1="${dY(v)}" x2="${W - padR}" y2="${dY(v)}" stroke="var(--chart-grid)" stroke-opacity="0.5" stroke-dasharray="3,3" />
         <text x="${padL - 10}" y="${dY(v) + 4}" text-anchor="end" font-size="12" fill="var(--ink-soft)">${formatTickSvg(v)}</text>`,
    )
    .join("");

  const candidateTicks = [20, 30, 35, 45, 55, 65, 75, 85, 90].filter(
    (a) => a >= minAge && a <= maxAge,
  );
  const xTicksList = [];
  for (const a of candidateTicks) {
    if (
      xTicksList.length === 0 ||
      dX(a) - dX(xTicksList[xTicksList.length - 1]) >= 62
    ) {
      xTicksList.push(a);
    }
  }
  if (xTicksList[xTicksList.length - 1] !== 90) {
    if (dX(90) - dX(xTicksList[xTicksList.length - 1]) < 48) xTicksList.pop();
    xTicksList.push(90);
  }
  const xTicks = xTicksList
    .map(
      (a) =>
        `<line x1="${dX(a)}" y1="${padT}" x2="${dX(a)}" y2="${H - padB}" stroke="var(--chart-grid)" stroke-opacity="0.35" />
         <text x="${dX(a)}" y="${H - padB + 22}" text-anchor="middle" font-size="12" fill="var(--ink-soft)">Age ${a}</text>`,
    )
    .join("");

  const linePath = (getter) =>
    points
      .map((pt, i) => `${i === 0 ? "M" : "L"} ${dX(pt.age)} ${dY(getter(pt))}`)
      .join(" ");

  const stepCpfPath = () =>
    points
      .map((pt, i) => {
        if (i === 0) return `M ${dX(pt.age)} ${dY(pt.monthlyCPF)}`;
        const prev = points[i - 1];
        if (prev.monthlyCPF === 0 && pt.monthlyCPF > 0) {
          return `L ${dX(pt.age)} ${dY(0)} L ${dX(pt.age)} ${dY(pt.monthlyCPF)}`;
        }
        return `L ${dX(pt.age)} ${dY(pt.monthlyCPF)}`;
      })
      .join(" ");

  const markerAnchor = (x) =>
    x < padL + 55 ? "start" : x > W - padR - 55 ? "end" : "middle";

  let defs = "",
    series = "",
    legend = "";
  if (isCashflow) {
    const spendPath = linePath((pt) => pt.monthlySpend);
    const cpfPath = stepCpfPath();
    const retireX = dX(summary.retire);
    const age65X = dX(65);
    const closeTogether = Math.abs(retireX - age65X) < 115;
    defs = `
      <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#2563EB" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="#2563EB" stop-opacity="0.03"/>
      </linearGradient>
      <linearGradient id="cpfGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#059669" stop-opacity="0.28"/>
        <stop offset="100%" stop-color="#059669" stop-opacity="0.06"/>
      </linearGradient>`;
    series = `
      <path d="${spendPath} L ${dX(maxAge)} ${dY(0)} L ${dX(minAge)} ${dY(0)} Z" fill="url(#spendGrad)" />
      <path d="${spendPath}" fill="none" stroke="var(--ink-soft)" stroke-width="2.2" stroke-dasharray="6,3" />
      <path d="${cpfPath} L ${dX(maxAge)} ${dY(0)} L ${dX(minAge)} ${dY(0)} Z" fill="url(#cpfGrad)" />
      <path d="${cpfPath}" fill="none" stroke="#059669" stroke-width="2.4" />
      ${summary.retire < 65 ? `<line x1="${retireX}" y1="${padT}" x2="${retireX}" y2="${H - padB}" stroke="#D97706" stroke-width="1.6" stroke-dasharray="4,3" /><text x="${retireX}" y="${padT - 20}" text-anchor="${markerAnchor(retireX)}" font-size="11.5" font-weight="600" fill="#D97706">Retire ${summary.retire}</text>` : ""}
      <line x1="${age65X}" y1="${padT}" x2="${age65X}" y2="${H - padB}" stroke="#059669" stroke-width="1.6" stroke-dasharray="4,3" />
      <text x="${age65X}" y="${closeTogether && summary.retire < 65 ? padT - 6 : padT - 20}" text-anchor="${markerAnchor(age65X)}" font-size="11.5" font-weight="600" fill="#059669">CPF LIFE 65</text>`;
    legend = `
      <span class="legend-item"><i class="legend-swatch" style="background:var(--ink-soft);"></i> Target Monthly Spend</span>
      <span class="legend-item"><i class="legend-swatch" style="background:#059669;"></i> CPF LIFE Payout (${summary.plan === "escalating" ? "Escalating +2%/yr" : "Standard Flat"})</span>
      <span class="legend-item"><i class="legend-swatch" style="background:#2563EB;"></i> Outside Portfolio Funding Gap</span>`;
  } else {
    const balPath = linePath((pt) => pt.portfolioBalance);
    const retireX = dX(summary.retire);
    const peakPt = points.reduce(
      (best, cur) =>
        cur.portfolioBalance > best.portfolioBalance ? cur : best,
      points[0],
    );
    defs = `
      <linearGradient id="portGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#2563EB" stop-opacity="0.28"/>
        <stop offset="100%" stop-color="#2563EB" stop-opacity="0.03"/>
      </linearGradient>`;
    series = `
      <path d="${balPath} L ${dX(maxAge)} ${dY(0)} L ${dX(minAge)} ${dY(0)} Z" fill="url(#portGrad)" />
      <path d="${balPath}" fill="none" stroke="#2563EB" stroke-width="2.4" />
      <line x1="${retireX}" y1="${padT}" x2="${retireX}" y2="${H - padB}" stroke="#D97706" stroke-width="1.6" stroke-dasharray="4,3" />
      <text x="${retireX}" y="${padT - 18}" text-anchor="${markerAnchor(retireX)}" font-size="11.5" font-weight="600" fill="#D97706">Retire ${summary.retire}</text>
      <circle cx="${dX(peakPt.age)}" cy="${dY(peakPt.portfolioBalance)}" r="3.5" fill="#2563EB" />
      <text x="${dX(peakPt.age)}" y="${Math.max(padT + 14, dY(peakPt.portfolioBalance) - 10)}" text-anchor="${markerAnchor(dX(peakPt.age))}" font-size="11.5" font-weight="700" fill="#2563EB" paint-order="stroke" stroke="var(--surface)" stroke-width="3" stroke-linejoin="round">Peak ${svgCompactMoney(peakPt.portfolioBalance)}</text>`;
    legend = `
      <span class="legend-item"><i class="legend-swatch" style="background:#2563EB;"></i> Outside Portfolio Balance</span>
      <span class="legend-item"><i class="legend-swatch" style="background:#D97706;"></i> Target Retirement Age ${summary.retire}</span>`;
  }

  chartArea.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid meet">
      <defs>${defs}</defs>
      ${yTicks}${xTicks}${series}
      <line id="scrub-line" x1="0" y1="${padT}" x2="0" y2="${H - padB}" stroke="var(--ink)" stroke-width="1.5" stroke-dasharray="3,3" style="display:none;" />
    </svg>`;
  $("#chart-legend").innerHTML = legend;

  const tooltipEl = $("#chart-tooltip");
  const chartWrapper = chartArea.parentElement;
  const scrubLine = $("#scrub-line");
  if (!chartWrapper || !scrubLine) return;

  const handlePointer = (e) => {
    const svgEl = $("#trajectory-chart svg");
    if (!svgEl) return;
    const svgRect = svgEl.getBoundingClientRect();
    const wrapRect = chartWrapper.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const plotScreenLeft = svgRect.left + (padL / W) * svgRect.width;
    const plotScreenWidth = (plotW / W) * svgRect.width;
    const fraction = Math.max(
      0,
      Math.min(1, (clientX - plotScreenLeft) / plotScreenWidth),
    );
    const targetAge = Math.round(minAge + fraction * (maxAge - minAge));
    const pt = points.find((p) => p.age === targetAge) || points[0];
    const svgX = dX(pt.age);
    scrubLine.setAttribute("x1", svgX);
    scrubLine.setAttribute("x2", svgX);
    scrubLine.style.display = "block";
    tooltipEl.hidden = false;
    tooltipEl.innerHTML = `
      <div class="tt-head">Age ${pt.age} (${pt.year}) · ${pt.phase.toUpperCase()}</div>
      <div class="tt-row"><span>Spend</span><b>${m(pt.monthlySpend, "/mo")}</b></div>
      <div class="tt-row"><span>CPF LIFE</span><b class="sem-cpf">${m(pt.monthlyCPF, "/mo")}</b></div>
      ${pt.monthlyGap > 0 ? `<div class="tt-row"><span>Outside gap</span><b class="sem-eq">${m(pt.monthlyGap, "/mo")}</b></div>` : ""}
      <div class="tt-row"><span>Portfolio</span><b>${m(pt.portfolioBalance)}</b></div>`;
    positionChartTooltip(
      tooltipEl,
      wrapRect,
      svgRect,
      svgX,
      dY(pt.portfolioBalance),
      W,
      H,
      padT,
      padB,
    );
  };
  const handleLeave = () => {
    scrubLine.style.display = "none";
    tooltipEl.hidden = true;
  };
  chartWrapper.onmousemove = handlePointer;
  chartWrapper.ontouchmove = handlePointer;
  chartWrapper.onmouseleave = handleLeave;
  chartWrapper.ontouchend = handleLeave;
}

function getMilestoneNodes(fire, r, s, simulation) {
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

  return [
    {
      badge: "Now",
      tag: `Age ${fire.age}`,
      title: "Starting Base",
      metric: m(nowPt?.today?.totalNetWorth ?? 0),
      pill: r.retiringNow
        ? "Active"
        : `Save ${compactMoney((simulation?.cpfExtra || 0) + s.privateSaving)}/mo`,
      sub: r.retiringNow
        ? "Immediate retirement transition"
        : `Saving ${money((simulation?.cpfExtra || 0) + s.privateSaving)}/mo`,
      color: "#F97316",
      softBg: "#FFF7ED",
    },
    {
      badge: fire.age < 55 ? "55" : String(fire.age),
      tag: fire.age < 55 ? "Age 55 · SA → RA" : `Age ${fire.age} · Post-55`,
      title: fire.age < 55 ? "CPF Consolidation" : "RA Locked Floor",
      metric: m(pt55?.today?.cpfTotal ?? 0),
      pill: "CPF Check",
      sub: `Total net worth ${money(pt55?.today?.totalNetWorth ?? 0)}`,
      color: "#0D9488",
      softBg: "#E6F7F5",
    },
    {
      badge: String(fire.retire),
      tag: `Age ${fire.retire}`,
      title: "Retirement Launch",
      metric: m(ptRet?.today?.totalNetWorth ?? 0),
      pill: fire.retire < 65 ? "Bridge" : "CPF LIFE",
      sub: `Budget ${money(r.futureSpend)}/mo · ${fire.retire < 65 ? "Liquid bridge" : "CPF LIFE active"}`,
      color: "#2563EB",
      softBg: "#EFF6FF",
    },
    {
      badge: String(pt95?.age ?? 95),
      tag: `Age 75→${pt95?.age ?? 95}`,
      title: fire.fireNumber.fullyFundedTo95
        ? "Age 95+ Runway"
        : `Funded to ${Math.floor(fire.fireNumber.depletionAge ?? 90)}`,
      metric: m(pt95?.today?.totalNetWorth ?? 0),
      pill: fire.fireNumber.fullyFundedTo95 ? "Sustained" : "Watch Gap",
      sub: `Spend ${money(pt75?.today?.monthlySpend ?? r.spend75)}/mo · CPF ${money(s.payout)}/mo`,
      color: fire.fireNumber.fullyFundedTo95 ? "#7C3AED" : "#DC2626",
      softBg: fire.fireNumber.fullyFundedTo95 ? "#F5F3FF" : "#FEF2F2",
    },
  ];
}

function buildConcentricRingsSVG(
  rings,
  centerPct,
  centerSub,
  size = 176,
  interactive = false,
) {
  const cx = size / 2;
  const cy = size / 2;
  const radii = [
    Math.round(size * 0.425),
    Math.round(size * 0.328),
    Math.round(size * 0.232),
  ];
  const strokeW = size >= 160 ? 11 : 8.5;
  const arcs = rings
    .slice(0, 3)
    .map((ring, idx) => {
      const r = radii[idx];
      const circ = 2 * Math.PI * r;
      const pct = Math.max(0, Math.min(100, ring.pct || 0));
      const dash = (pct / 100) * circ;
      const shortSub = ring.shortLabel || centerSub;
      return `
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--border)" stroke-width="${strokeW}" />
        ${
          pct > 0
            ? `<circle class="ember-ring-arc" data-ring-idx="${idx}" data-ring-pct="${ring.text || `${pct}%`}" data-ring-sub="${shortSub}" cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${ring.color}" stroke-width="${strokeW}" stroke-linecap="round" stroke-dasharray="${dash.toFixed(2)} ${circ.toFixed(2)}" transform="rotate(-90 ${cx} ${cy})" />`
            : ""
        }
      `;
    })
    .join("");
  return `<div class="ember-rings-wrap${interactive ? " is-interactive" : ""}" style="--ring-size:${size}px;" data-default-pct="${centerPct}%" data-default-sub="${centerSub}">
    <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="ember-rings-svg" aria-hidden="true">
      ${arcs}
    </svg>
    <div class="ember-rings-center">
      <strong>${centerPct}%</strong>
      <span>${centerSub}</span>
    </div>
  </div>`;
}

function renderPrintSheet({
  r,
  s,
  simulation,
  fire,
  bogle,
  tax,
  guide,
  p,
  basis = "today",
}) {
  const printContainer = $("#print-sheet");
  if (!printContainer || !r || !s || !fire) return;

  const pm = RetirementModel.buildPrintReportModel({
    summary: r,
    selectedScenario: s,
    simulation,
    fire,
    bogle,
    tax,
    guide,
    params: p,
    basis,
  });

  const ringItems = [
    {
      label: `Plan Funded (${pm.retireAge})`,
      pct: Math.min(100, pm.pctFunded),
      val: `${pm.pctFunded}%`,
      color: pm.onTrack ? "#059669" : "#2563EB",
    },
    {
      label: "CPF LIFE vs Spend",
      pct: pm.cpfCovPct,
      val: `${pm.cpfCovPct}%`,
      color: "#0D9488",
    },
    {
      label: "Built Today",
      pct: pm.builtTodayPct,
      val: `${pm.builtTodayPct}%`,
      color: "#7C3AED",
    },
  ];

  const pipeRows = pm.paycheck.rows;
  const grossPlusEmp = pm.paycheck.grossPlusEmployer;
  const milestones = getMilestoneNodes(fire, r, s, simulation);
  const pt95 = fire?.points?.[fire.points.length - 1];
  const pt55 =
    fire?.points?.find((pt) => pt.age === (fire.age < 55 ? 55 : fire.age)) ||
    fire?.points?.[0];

  const presetBaseline =
    RetirementModel.lifestyles[r.lifestyle]?.budget || 2500;
  const isCustomBudget =
    Math.round(Number(r.todaySpend || 0) * 100) !==
    Math.round(presetBaseline * 100);
  const srsAnnualVal = Math.max(0, Number(p?.srsAnnual || 0));

  const formatCheckpointSub = (mn, idx) => {
    if (idx === 1 && fire.age < 55) {
      return `Age 55 · Total NW ${money(pt55?.today?.totalNetWorth ?? 0)}`;
    }
    if (idx === 3 && !pm.fullyFundedTo95) {
      const liq95 =
        (pt95?.today?.liquidEquities ?? 0) + (pt95?.today?.ssbCash ?? 0);
      const cpf95 = pt95?.today?.cpfTotal ?? 0;
      return liq95 <= 1
        ? `Age 75→${pt95?.age ?? 95} · Liquid $0 · ${money(cpf95)} CPF`
        : `${mn.tag} · ${mn.sub}`;
    }
    return `${mn.tag} · ${mn.sub}`;
  };

  printContainer.innerHTML = `
    <div class="poster-sheet">
      <header class="poster-masthead">
        <div class="poster-brand-row">
          <div class="poster-title-block">
            <span class="poster-kicker">RETIREMENT SHIELD · SINGAPORE BLUEPRINT</span>
            <h1>Retirement Readiness &amp; CPF Overview</h1>
            <div class="poster-chips">
              <span>Age ${r.age} → ${r.retire}</span>
              <span>Gross ${money(r.salary)} · Take-home ${money(r.afterCpf)}/mo</span>
              <span>${isCustomBudget ? `Custom (${money(r.todaySpend)}/mo)` : r.lifestyleLabel}</span>
              <span>CPF LIFE ${r.plan === "escalating" ? "Escalating" : "Standard"}</span>
              ${Number(p?.housing || 0) > 0 ? `<span>Housing OA ${money(p.housing)}/mo</span>` : ""}
              ${srsAnnualVal > 0 ? `<span>SRS ${money(srsAnnualVal)}/yr</span>` : ""}
            </div>
          </div>
          <div class="poster-verdict-badge is-${pm.statusTone}">
            <small>PLAN STATUS</small>
            <strong>${pm.pctFunded}% · ${pm.statusText}</strong>
            <span>${pm.verdictSub}</span>
          </div>
        </div>
      </header>

      <section class="poster-kpi-strips">
        <div class="poster-stat-strip" style="--strip-accent:#2563EB;">
          <small>Earliest Safe Age</small>
          <div><strong>${pm.earliestSafeAgeText}</strong><span class="poster-pill">${pm.runwayPill}</span></div>
        </div>
        <div class="poster-stat-strip" style="--strip-accent:#0D9488;">
          <small>Age-65 CPF Floor</small>
          <div><strong>${money(pm.cpfFloor65)}/mo</strong><span class="poster-pill">${pm.cpfCovPct}% bills</span></div>
        </div>
        <div class="poster-stat-strip" style="--strip-accent:#059669;">
          <small>${pm.savingKpiLabel}</small>
          <div><strong>${money(pm.monthlySave)}${r.retiringNow ? " now" : "/mo"}</strong><span class="poster-pill">${pm.savingKpiPill}</span></div>
        </div>
        <div class="poster-stat-strip" style="--strip-accent:#7C3AED;">
          <small>Projected at ${pm.retireAge}</small>
          <div><strong>${money(pm.projectedAtRetire)}</strong><span class="poster-pill">${money(r.futureSpend)}/mo</span></div>
        </div>
      </section>

      <section class="poster-charts-row">
        <div class="poster-chart-card">
          <h3>Net Worth Projection (Age ${fire?.age ?? r.age}–${pm.endAge})</h3>
          <div id="print-nw-chart" class="poster-chart-svg"></div>
          <div id="print-nw-legend" class="poster-chart-legend"></div>
        </div>
        <div class="poster-chart-card">
          <h3>Monthly Cashflow Waterfall (Ages ${pm.waterfallStartAge}–${pm.waterfallEndAge})</h3>
          <div id="print-wf-chart" class="poster-chart-svg"></div>
          <div id="print-wf-legend" class="poster-chart-legend"></div>
        </div>
      </section>

      <section class="poster-bento-row">
        <div class="poster-panel poster-rings-panel">
          <h3>Readiness Breakdown</h3>
          <div class="poster-rings-inner">
            ${buildConcentricRingsSVG(ringItems, pm.pctFunded, "FUNDED", 126)}
            <ul class="poster-ring-legend">
              ${ringItems
                .map(
                  (it) =>
                    `<li><span><i style="background:${it.color};"></i>${it.label}</span><b>${it.val}</b></li>`,
                )
                .join("")}
            </ul>
          </div>
        </div>

        <div class="poster-panel">
          <div class="poster-panel-head">
            <h3>Paycheck Split</h3>
            <small>${money(grossPlusEmp)}/mo incl. Emp CPF</small>
          </div>
          <div class="poster-pipes">
            ${pipeRows
              .map((pr) => {
                const w = Math.min(
                  100,
                  Math.round((pr.amt / grossPlusEmp) * 100),
                );
                return `<div class="poster-pipe-row">
                  <div class="poster-pipe-head">
                    <span><i style="background:${pr.color};"></i>${pr.label}</span>
                    <b>${money(pr.amt)} (${w}%)</b>
                  </div>
                  <div class="poster-pipe-track"><span style="width:${pr.amt > 0 ? Math.max(3, w) : 0}%;background:${pr.color};"></span></div>
                </div>`;
              })
              .join("")}
          </div>
          ${pm.paycheck.overspendMo > 0 ? `<p class="poster-panel-note is-warn">Savings exceed take-home pay by ${money(pm.paycheck.overspendMo)}/mo.</p>` : ""}
        </div>

        ${
          milestones.length
            ? `<div class="poster-panel">
                <h3>Road to 95 Checkpoints</h3>
                <div class="poster-feed-list">
                  ${milestones
                    .map(
                      (mn, idx) => `<div class="poster-feed-row">
                        <span class="poster-feed-avatar" style="background:${mn.softBg};color:${mn.color};">${mn.badge}</span>
                        <div class="poster-feed-copy">
                          <strong>${mn.title}</strong>
                          <small>${formatCheckpointSub(mn, idx)}</small>
                        </div>
                        <div class="poster-feed-right">
                          <b>${mn.metric}</b>
                          <small>${mn.pill}</small>
                        </div>
                      </div>`,
                    )
                    .join("")}
                </div>
              </div>`
            : ""
        }
      </section>

      <section class="poster-bottom-grid">
        <div class="poster-panel">
          <h3>Portfolio &amp; Tax Action Plan</h3>
          <ul class="poster-tiers">
            ${pm.actionRows
              .map(
                (row) =>
                  `<li><span>${row.label} <em class="poster-tier-tag">${row.tag}</em></span><b>${row.value}</b></li>`,
              )
              .join("")}
          </ul>
        </div>

        <div class="poster-panel">
          <div class="poster-panel-head">
            <h3>CPF Strategy Comparison Ledger</h3>
            <small>Age-55 CPF in today’s $</small>
          </div>
          <table class="poster-mini-table">
            <thead><tr><th>Strategy</th><th>Age-55 CPF</th><th>Extra CPF</th><th>Save Outside</th><th>65+ Payout</th></tr></thead>
            <tbody>
              ${r.scenarios
                .map(
                  (sc) => `<tr class="${sc.key === s.key ? "is-active" : ""}">
                    <td>${sc.key === "salary" ? "Salary CPF" : sc.key.toUpperCase()}${sc.key === s.key ? " · Active" : ""}</td>
                    <td>${money(sc.balance)}</td>
                    <td>${money(sc.cpfFunding)}${r.retiringNow ? " now" : "/mo"}</td>
                    <td>${money(sc.privateSaving)}${r.retiringNow ? " now" : "/mo"}</td>
                    <td>${money(sc.payout)}/mo</td>
                  </tr>`,
                )
                .join("")}
            </tbody>
          </table>
          ${pm.customSavingNote ? `<p class="poster-panel-note">${pm.customSavingNote}</p>` : ""}
        </div>
      </section>

      <footer class="poster-colophon">
        <span><sup>1</sup> Today’s purchasing power (${Number((r.inflation * 100).toFixed(1))}% inflation, ${Number((r.investmentReturn * 100).toFixed(1))}% net return, ${r.post55Work ? "post-55 CPF included" : "post-55 CPF excluded"}). <sup>2</sup> 2026 SG Rules (FRS $220.4k, ERS $440.8k, BHS $79k, OW cap $8k). Age-55 cohort sums grow 3.5%/yr.</span>
        <span>100% Local Calculation · Educational planning illustration only</span>
      </footer>
    </div>`;

  renderStackedNetWorthSVG(
    $("#print-nw-chart", printContainer),
    null,
    $("#print-nw-legend", printContainer),
    fire,
    basis,
    {
      interactive: false,
      forcedSeries: "all",
      showSrsMilestone: pm.hasSrs,
      compactPrint: true,
    },
  );
  renderCashflowWaterfallSVG(
    $("#print-wf-chart", printContainer),
    null,
    $("#print-wf-legend", printContainer),
    fire,
    basis,
    {
      startAge: pm.waterfallStartAge,
      endAge: pm.waterfallEndAge,
      hasSrs: pm.hasSrs,
      compactPrint: true,
    },
  );
}

const NW_SERIES = [
  {
    key: "cpf",
    name: "CPF (OA + SA/RA + MA)",
    short: "CPF",
    color: "#10B981",
    ttClass: "sem-cpf",
  },
  {
    key: "srs",
    name: "SRS",
    short: "SRS",
    color: "#7C3AED",
    ttClass: "sem-srs",
  },
  {
    key: "ssb",
    name: "SSB / T-Bills / Cash",
    short: "SSB / Cash",
    color: "#D97706",
    ttClass: "sem-cash",
  },
  {
    key: "eq",
    name: "Global & SG Equities",
    short: "Equities",
    color: "#2563EB",
    ttClass: "sem-eq",
  },
];

let netWorthSelectedSeries = "all";

function positionChartTooltip(
  tooltipEl,
  wrapRect,
  svgRect,
  svgX,
  svgY,
  W,
  H,
  padT,
  padB,
) {
  const cursorX = svgRect.left + (svgX / W) * svgRect.width - wrapRect.left;
  const placeLeft = cursorX > wrapRect.width * 0.56;
  const ttH = tooltipEl.offsetHeight || 132;
  const ttW = tooltipEl.offsetWidth || 180;
  const minY = Math.max(
    6,
    svgRect.top - wrapRect.top + (padT / H) * svgRect.height + 6,
  );
  const maxY = Math.max(minY, wrapRect.height - ttH - 8);
  const rawY =
    svgRect.top - wrapRect.top + (svgY / H) * svgRect.height - ttH / 2;
  const tTop = Math.max(minY, Math.min(maxY, rawY));
  const desiredLeft = placeLeft ? cursorX - ttW - 14 : cursorX + 14;
  const clampedLeft = Math.max(
    8,
    Math.min(wrapRect.width - ttW - 8, desiredLeft),
  );
  tooltipEl.style.left = `${clampedLeft}px`;
  tooltipEl.style.top = `${tTop}px`;
  tooltipEl.style.transform = "none";
}

function renderStackedNetWorthSVG(
  chartArea,
  tooltipEl,
  legendEl,
  fire,
  basis = "today",
  opts = {},
) {
  if (!chartArea || !fire?.points?.length) return;
  const interactive = opts.interactive !== false;
  const activeSeries =
    opts.forcedSeries || (interactive ? netWorthSelectedSeries : "all");
  const soloSeries =
    activeSeries !== "all"
      ? NW_SERIES.find((item) => item.key === activeSeries) || null
      : null;

  const pts = fire.points.map((pt) => {
    const src = basis === "today" ? pt.today : pt;
    return {
      age: pt.age,
      year: pt.year,
      phase: pt.phase,
      cpf: src.cpfTotal,
      srs: src.srs,
      ssb: src.ssbCash,
      eq: src.liquidEquities,
      total: src.totalNetWorth,
    };
  });
  const compactPrint = Boolean(opts.compactPrint);
  const W = compactPrint ? 640 : 860,
    H = compactPrint ? 256 : 316,
    padL = compactPrint ? 58 : 74,
    padR = compactPrint ? 22 : 32,
    padT = compactPrint ? 56 : 66,
    padB = compactPrint ? 32 : 40;
  const plotW = W - padL - padR,
    plotH = H - padT - padB;
  const minAge = pts[0].age,
    maxAge = pts[pts.length - 1].age;
  const dX = (age) =>
    padL + ((age - minAge) / Math.max(1, maxAge - minAge)) * plotW;
  const rawMax = Math.max(
    10000,
    ...pts.map((p) => (soloSeries ? p[soloSeries.key] : p.total)),
  );
  const { maxVal, ticks } = niceAxis(rawMax, 4);
  const dY = (val) => padT + (1 - Math.max(0, val) / maxVal) * plotH;

  const yTicks = ticks
    .map(
      (v) =>
        `<line x1="${padL}" y1="${dY(v)}" x2="${W - padR}" y2="${dY(v)}" stroke="var(--chart-grid)" stroke-opacity="0.5" stroke-dasharray="3,3" />
         <text x="${padL - 10}" y="${dY(v) + 4}" text-anchor="end" font-size="12" fill="var(--ink-soft)">${svgCompactMoney(v)}</text>`,
    )
    .join("");

  const candTicks = [20, 30, 35, 45, 55, 65, 75, 85, 90, 95].filter(
    (a) => a >= minAge && a <= maxAge,
  );
  const xTicksList = [];
  for (const a of candTicks) {
    if (!xTicksList.length || dX(a) - dX(xTicksList.at(-1)) >= 52)
      xTicksList.push(a);
  }
  const xTicks = xTicksList
    .map(
      (a) =>
        `<line x1="${dX(a)}" y1="${padT}" x2="${dX(a)}" y2="${H - padB}" stroke="var(--chart-grid)" stroke-opacity="0.3" />
         <text x="${dX(a)}" y="${H - padB + 22}" text-anchor="middle" font-size="12" fill="var(--ink-soft)">${a}</text>`,
    )
    .join("");

  const areaPath = (topFn, botFn) => {
    const fwd = pts
      .map((p, i) => `${i === 0 ? "M" : "L"} ${dX(p.age)} ${dY(topFn(p))}`)
      .join(" ");
    const bwd = [...pts]
      .reverse()
      .map((p) => `L ${dX(p.age)} ${dY(botFn(p))}`)
      .join(" ");
    return `${fwd} ${bwd} Z`;
  };
  const topLinePath = (topFn) =>
    pts
      .map((p, i) => `${i === 0 ? "M" : "L"} ${dX(p.age)} ${dY(topFn(p))}`)
      .join(" ");

  const uid = (chartArea.id || "nw").replace(/[^a-z0-9_-]/gi, "");
  const stackDefs = [
    {
      ...NW_SERIES[0],
      top: (p) => p.cpf,
      bot: () => 0,
    },
    {
      ...NW_SERIES[1],
      top: (p) => p.cpf + p.srs,
      bot: (p) => p.cpf,
    },
    {
      ...NW_SERIES[2],
      top: (p) => p.cpf + p.srs + p.ssb,
      bot: (p) => p.cpf + p.srs,
    },
    {
      ...NW_SERIES[3],
      top: (p) => p.total,
      bot: (p) => p.cpf + p.srs + p.ssb,
    },
  ];

  const gradientsSVG = `<defs>
    ${NW_SERIES.map(
      (
        sItem,
      ) => `<linearGradient id="${uid}-grad-${sItem.key}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${sItem.color}" stop-opacity="${soloSeries ? "0.38" : "0.30"}" />
        <stop offset="100%" stop-color="${sItem.color}" stop-opacity="0.04" />
      </linearGradient>`,
    ).join("")}
  </defs>`;

  const bandsSVG = soloSeries
    ? `<g class="nw-band is-solo" data-series="${soloSeries.key}">
        <path class="nw-band-fill" d="${areaPath(
          (p) => p[soloSeries.key],
          () => 0,
        )}" fill="url(#${uid}-grad-${soloSeries.key})" />
        <path class="nw-band-stroke" d="${topLinePath((p) => p[soloSeries.key])}" fill="none" stroke="${soloSeries.color}" stroke-width="2.5" stroke-linejoin="round" />
      </g>`
    : stackDefs
        .map(
          (band) => `<g class="nw-band" data-series="${band.key}">
            <path class="nw-band-fill" d="${areaPath(band.top, band.bot)}" fill="url(#${uid}-grad-${band.key})" />
            <path class="nw-band-stroke" d="${topLinePath(band.top)}" fill="none" stroke="${band.color}" stroke-width="1.85" stroke-linejoin="round" />
          </g>`,
        )
        .join("");

  const showSrs =
    opts.showSrsMilestone != null
      ? Boolean(opts.showSrsMilestone)
      : pts.some((pt) => pt.srs > 0.5);
  const rawMilestones = [
    {
      age: fire.retire,
      label: `Retire ${fire.retire}`,
      color: "#2563EB",
    },
    { age: 55, label: "55 SA Closure", color: "#059669" },
    ...(showSrs
      ? [
          {
            age: fire.srsWithdrawalAge,
            label: `${fire.srsWithdrawalAge} SRS`,
            color: "#7C3AED",
          },
        ]
      : []),
    { age: 65, label: "65 CPF LIFE", color: "#059669" },
  ]
    .filter((mItem) => mItem.age >= minAge && mItem.age <= maxAge)
    .sort((a, b) => a.age - b.age);

  const milestones = [];
  for (const item of rawMilestones) {
    const existing = milestones.find((x) => x.age === item.age);
    if (existing) {
      if (item.age === 65 && existing.label.startsWith("Retire")) {
        existing.label = "65 Retire · CPF LIFE";
        existing.color = "#059669";
      } else if (existing.label.startsWith("Retire")) {
        existing.label = `${item.age} Retire · ${item.label.replace(/^\d+\s*/, "")}`;
      } else {
        existing.label = `${existing.label} · ${item.label.replace(/^\d+\s*/, "")}`;
      }
    } else {
      milestones.push({ ...item });
    }
  }

  const rowBoxes = [[], [], [], []];
  const rowYs = [14, 28, 42, 56];
  const milestoneSVG = milestones
    .map((mItem) => {
      const x = dX(mItem.age);
      const anchor =
        x < padL + 48 ? "start" : x > W - padR - 48 ? "end" : "middle";
      const estW = mItem.label.length * 7.2 + 12;
      const x1 =
        anchor === "start" ? x : anchor === "end" ? x - estW : x - estW / 2;
      const x2 = x1 + estW;
      let chosenRow = rowBoxes.findIndex((boxes) =>
        boxes.every((b) => x2 + 12 <= b.x1 || x1 - 12 >= b.x2),
      );
      if (chosenRow === -1) chosenRow = rowBoxes.length - 1;
      rowBoxes[chosenRow].push({ x1, x2 });
      const labelY = rowYs[chosenRow];
      return `<line x1="${x}" y1="${padT}" x2="${x}" y2="${H - padB}" stroke="${mItem.color}" stroke-width="1.35" stroke-dasharray="4,3" stroke-opacity="0.65" />
        <text x="${x}" y="${labelY}" text-anchor="${anchor}" font-size="11" font-weight="700" fill="${mItem.color}">${mItem.label}</text>`;
    })
    .join("");

  const valForCallout = (pt) => (soloSeries ? pt[soloSeries.key] : pt.total);
  const calloutAges = [fire.retire, 65, maxAge].filter(
    (a, idx, arr) => arr.indexOf(a) === idx && a >= minAge + 2 && a <= maxAge,
  );
  const placedCallouts = [];
  const calloutsSVG = calloutAges
    .map((ageTarget) => {
      const pt = pts.find((p) => p.age === ageTarget);
      const val = pt ? valForCallout(pt) : 0;
      if (!pt || val <= 0) return "";
      const x = dX(pt.age);
      const dotY = dY(val);
      const anchor = x > W - padR - 48 ? "end" : "middle";
      const labelText = compactMoney(val);
      const estW = labelText.length * 7 + 8;
      const x1 = anchor === "end" ? x - estW : x - estW / 2;
      const x2 = x1 + estW;
      const aboveY = Math.max(padT + 14, dotY - 10);
      const belowY = Math.min(H - padB - 8, dotY + 18);
      const overlaps = (cy) =>
        placedCallouts.some(
          (b) =>
            !(
              x2 + 6 <= b.x1 ||
              x1 - 6 >= b.x2 ||
              cy + 8 <= b.y1 ||
              cy - 14 >= b.y2
            ),
        );
      let labelY = aboveY;
      let showLabel = true;
      if (overlaps(aboveY)) {
        if (dotY < H - padB - 24 && !overlaps(belowY)) {
          labelY = belowY;
        } else {
          showLabel = false;
        }
      }
      if (showLabel) {
        placedCallouts.push({ x1, x2, y1: labelY - 12, y2: labelY + 3 });
      }
      const dotColor = soloSeries ? soloSeries.color : "var(--ink)";
      return `<circle cx="${x}" cy="${dotY}" r="3.5" fill="${dotColor}" stroke="var(--surface)" stroke-width="1.5" />
        ${showLabel ? `<text x="${x}" y="${labelY}" text-anchor="${anchor}" font-size="11" font-weight="700" fill="var(--ink)" paint-order="stroke" stroke="var(--surface)" stroke-width="3" stroke-linejoin="round">${svgCompactMoney(val)}</text>` : ""}`;
    })
    .join("");

  const scrubDotsSVG = (soloSeries ? [soloSeries] : NW_SERIES)
    .map(
      (sItem) =>
        `<circle class="nw-scrub-dot" data-series="${sItem.key}" cx="0" cy="0" r="4" fill="${sItem.color}" stroke="var(--surface)" stroke-width="1.75" style="display:none;" />`,
    )
    .join("");

  chartArea.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid meet">
      ${gradientsSVG}
      ${yTicks}${xTicks}
      ${bandsSVG}
      ${milestoneSVG}
      ${calloutsSVG}
      <line class="nw-scrub-line" x1="0" y1="${padT}" x2="0" y2="${H - padB}" stroke="var(--ink)" stroke-width="1.4" stroke-dasharray="3,3" style="display:none;" />
      ${scrubDotsSVG}
    </svg>`;

  if (legendEl) {
    if (interactive) {
      legendEl.innerHTML = `
        <button type="button" class="legend-chip${!soloSeries ? " is-active" : ""}" data-series="all" aria-pressed="${!soloSeries}">
          All Layers
        </button>
        ${[...NW_SERIES]
          .reverse()
          .map((sItem) => {
            const isSel = soloSeries?.key === sItem.key;
            return `<button type="button" class="legend-chip${isSel ? " is-active" : ""}" data-series="${sItem.key}" aria-pressed="${isSel}">
              <i class="legend-swatch" style="background:${sItem.color};"></i>
              <span>${sItem.name}</span>
            </button>`;
          })
          .join("")}`;
    } else {
      legendEl.innerHTML = [...NW_SERIES]
        .reverse()
        .filter((sItem) => showSrs || sItem.key !== "srs")
        .map(
          (sItem) =>
            `<span class="legend-item"><i class="legend-swatch" style="background:${sItem.color};"></i> ${sItem.name}</span>`,
        )
        .join("");
    }
  }

  if (!interactive) return;

  const setHoveredBand = (seriesKey) => {
    const svg = chartArea.querySelector("svg");
    if (svg) {
      svg.classList.toggle(
        "has-hover-series",
        Boolean(seriesKey) && !soloSeries,
      );
      svg.querySelectorAll(".nw-band").forEach((el) => {
        el.classList.toggle("is-hovered", el.dataset.series === seriesKey);
      });
    }
    if (legendEl) {
      legendEl.querySelectorAll(".legend-chip").forEach((btn) => {
        btn.classList.toggle("is-hovered", btn.dataset.series === seriesKey);
      });
    }
  };

  const toggleSeriesSelection = (seriesKey) => {
    if (!seriesKey) return;
    if (tooltipEl) tooltipEl.hidden = true;
    if (seriesKey === "all") netWorthSelectedSeries = "all";
    else
      netWorthSelectedSeries =
        netWorthSelectedSeries === seriesKey ? "all" : seriesKey;
    renderStackedNetWorthSVG(chartArea, tooltipEl, legendEl, fire, basis, opts);
  };

  if (legendEl) {
    legendEl.onmouseover = (e) => {
      const btn = e.target.closest(".legend-chip");
      if (btn && btn.dataset.series !== "all")
        setHoveredBand(btn.dataset.series);
    };
    legendEl.onmouseout = (e) => {
      if (!legendEl.contains(e.relatedTarget)) setHoveredBand(null);
    };
    legendEl.onclick = (e) => {
      const btn = e.target.closest(".legend-chip");
      if (btn) toggleSeriesSelection(btn.dataset.series);
    };
  }

  chartArea.onclick = (e) => {
    const band = e.target.closest(".nw-band");
    if (band) toggleSeriesSelection(band.dataset.series);
  };

  const wrap = chartArea.parentElement;
  const scrub = chartArea.querySelector(".nw-scrub-line");
  if (!wrap || !tooltipEl || !scrub) return;
  const onMove = (e) => {
    const svg = chartArea.querySelector("svg");
    if (!svg) return;
    const svgRect = svg.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    const left = svgRect.left + (padL / W) * svgRect.width;
    const width = (plotW / W) * svgRect.width;
    const frac = Math.max(0, Math.min(1, (cx - left) / width));
    const targetAge = Math.round(minAge + frac * (maxAge - minAge));
    const pt = pts.find((p) => p.age === targetAge) || pts[0];
    const sx = dX(pt.age);
    scrub.setAttribute("x1", sx);
    scrub.setAttribute("x2", sx);
    scrub.style.display = "block";

    const bandTarget = e.target.closest?.(".nw-band");
    const hoveredKey = soloSeries
      ? soloSeries.key
      : bandTarget?.dataset?.series || null;
    if (!soloSeries) setHoveredBand(hoveredKey);

    const cumulativeAt = {
      cpf: pt.cpf,
      srs: pt.cpf + pt.srs,
      ssb: pt.cpf + pt.srs + pt.ssb,
      eq: pt.total,
    };
    svg.querySelectorAll(".nw-scrub-dot").forEach((dot) => {
      const key = dot.dataset.series;
      const val = soloSeries ? pt[key] : cumulativeAt[key];
      dot.setAttribute("cx", sx);
      dot.setAttribute("cy", dY(val));
      dot.style.display = "block";
    });

    tooltipEl.hidden = false;
    tooltipEl.innerHTML = soloSeries
      ? `
      <div class="tt-head">Age ${pt.age} (${pt.year})</div>
      <div class="tt-row is-highlighted"><span>${soloSeries.short}</span><b class="${soloSeries.ttClass}">${m(pt[soloSeries.key])}</b></div>
      <div class="tt-row"><span>Total Net Worth</span><b>${m(pt.total)}</b></div>`
      : `
      <div class="tt-head">Age ${pt.age} (${pt.year})</div>
      <div class="tt-row"><span>Total Net Worth</span><b>${m(pt.total)}</b></div>
      <div class="tt-row${hoveredKey === "eq" ? " is-highlighted" : ""}"><span>Equities</span><b class="sem-eq">${m(pt.eq)}</b></div>
      <div class="tt-row${hoveredKey === "ssb" ? " is-highlighted" : ""}"><span>SSB / Cash</span><b class="sem-cash">${m(pt.ssb)}</b></div>
      <div class="tt-row${hoveredKey === "srs" ? " is-highlighted" : ""}"><span>SRS</span><b class="sem-srs">${m(pt.srs)}</b></div>
      <div class="tt-row${hoveredKey === "cpf" ? " is-highlighted" : ""}"><span>CPF</span><b class="sem-cpf">${m(pt.cpf)}</b></div>`;

    const svgHoverY = Math.max(
      padT,
      Math.min(H - padB, ((cy - svgRect.top) / svgRect.height) * H),
    );
    positionChartTooltip(
      tooltipEl,
      wrapRect,
      svgRect,
      sx,
      svgHoverY,
      W,
      H,
      padT,
      padB,
    );
  };
  const onLeave = () => {
    scrub.style.display = "none";
    const svg = chartArea.querySelector("svg");
    if (svg) {
      svg
        .querySelectorAll(".nw-scrub-dot")
        .forEach((dot) => (dot.style.display = "none"));
    }
    setHoveredBand(null);
    tooltipEl.hidden = true;
  };
  wrap.onmousemove = onMove;
  wrap.ontouchmove = onMove;
  wrap.onmouseleave = onLeave;
  wrap.ontouchend = onLeave;
}

function renderCashflowWaterfallSVG(
  chartArea,
  tooltipEl,
  legendEl,
  fire,
  basis = "today",
  opts = {},
) {
  if (!chartArea || !fire?.points?.length) return;
  const startAge =
    opts.startAge ?? Math.max(fire.age, Math.min(50, fire.retire));
  const endAge = Math.min(fire.endAge, opts.endAge ?? 85);
  const pts = fire.points
    .filter((pt) => pt.age >= startAge && pt.age <= endAge)
    .map((pt) => {
      const src = basis === "today" ? pt.today : pt;
      return {
        age: pt.age,
        year: pt.year,
        retired: pt.age >= fire.retire,
        spend: src.monthlySpend,
        cpf: src.monthlyCpfLife,
        srs: src.monthlySrsDraw,
        liquid: src.monthlyLiquidDraw,
        shortfall: src.monthlyShortfall,
      };
    });
  if (!pts.length) return;
  const compactPrint = Boolean(opts.compactPrint);
  const W = compactPrint ? 640 : 760,
    H = compactPrint ? 256 : 304,
    padL = compactPrint ? 58 : 74,
    padR = compactPrint ? 22 : 26,
    padT = compactPrint ? 36 : 32,
    padB = compactPrint ? 32 : 40;
  const plotW = W - padL - padR,
    plotH = H - padT - padB;
  const rawMax = Math.max(
    1000,
    ...pts.map((p) =>
      Math.max(p.spend, p.cpf + p.srs + p.liquid + p.shortfall),
    ),
  );
  const { maxVal, ticks } = niceAxis(rawMax, 4);
  const dY = (val) => padT + (1 - Math.max(0, val) / maxVal) * plotH;
  const stepX = plotW / pts.length;
  const barW = Math.max(4, Math.min(18, stepX * 0.72));
  const barX = (i) => padL + i * stepX + (stepX - barW) / 2;
  const centerX = (i) => padL + i * stepX + stepX / 2;

  const yTicks = ticks
    .map(
      (v) =>
        `<line x1="${padL}" y1="${dY(v)}" x2="${W - padR}" y2="${dY(v)}" stroke="var(--chart-grid)" stroke-opacity="0.5" stroke-dasharray="3,3" />
         <text x="${padL - 10}" y="${dY(v) + 4}" text-anchor="end" font-size="12" fill="var(--ink-soft)">${svgMoney(v)}</text>`,
    )
    .join("");

  const xLabels = pts
    .map((p, i) =>
      p.age === startAge || p.age % 5 === 0 || p.age === endAge
        ? `<text x="${centerX(i)}" y="${H - padB + 22}" text-anchor="middle" font-size="12" fill="var(--ink-soft)">${p.age}</text>`
        : "",
    )
    .join("");

  const bars = pts
    .map((p, i) => {
      if (!p.retired) return "";
      const x = barX(i);
      const yBase = dY(0);
      const yCpf = dY(p.cpf);
      const ySrs = dY(p.cpf + p.srs);
      const yLiq = dY(p.cpf + p.srs + p.liquid);
      const yShort = dY(p.cpf + p.srs + p.liquid + p.shortfall);
      return `
        ${p.cpf > 0 ? `<rect x="${x}" y="${yCpf}" width="${barW}" height="${Math.max(0, yBase - yCpf)}" fill="#059669" rx="1.5" />` : ""}
        ${p.srs > 0 ? `<rect x="${x}" y="${ySrs}" width="${barW}" height="${Math.max(0, yCpf - ySrs)}" fill="#7C3AED" rx="1.5" />` : ""}
        ${p.liquid > 0 ? `<rect x="${x}" y="${yLiq}" width="${barW}" height="${Math.max(0, ySrs - yLiq)}" fill="#2563EB" rx="1.5" />` : ""}
        ${p.shortfall > 0.5 ? `<rect x="${x}" y="${yShort}" width="${barW}" height="${Math.max(0, yLiq - yShort)}" fill="#DC2626" fill-opacity="0.82" rx="1.5" />` : ""}`;
    })
    .join("");

  const spendLine = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${centerX(i)} ${dY(p.spend)}`)
    .join(" ");

  const showSrs =
    opts.hasSrs != null ? Boolean(opts.hasSrs) : pts.some((p) => p.srs > 0.5);
  const idx65 = pts.findIndex((p) => p.age === 65);
  const idxSrs = showSrs
    ? pts.findIndex((p) => p.age === fire.srsWithdrawalAge)
    : -1;
  const markers = [
    idxSrs >= 0
      ? {
          idx: idxSrs,
          label: `SRS (${fire.srsWithdrawalAge})`,
          color: "#7C3AED",
        }
      : null,
    idx65 >= 0
      ? { idx: idx65, label: "CPF LIFE (65)", color: "#059669" }
      : null,
  ]
    .filter(Boolean)
    .map((mk, j) => {
      const mx = centerX(mk.idx);
      const closeToPrev =
        j === 1 && idxSrs >= 0 && Math.abs(idx65 - idxSrs) <= 5;
      const my = closeToPrev ? padT - 18 : padT - 6;
      const anchor =
        mx < padL + 44 ? "start" : mx > W - padR - 48 ? "end" : "middle";
      return `<line x1="${mx}" y1="${padT}" x2="${mx}" y2="${H - padB}" stroke="${mk.color}" stroke-width="1.4" stroke-dasharray="3,3" stroke-opacity="0.7" />
        <text x="${mx}" y="${my}" text-anchor="${anchor}" font-size="11" font-weight="700" fill="${mk.color}">${mk.label}</text>`;
    })
    .join("");

  chartArea.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid meet">
      ${yTicks}${xLabels}${bars}
      <path d="${spendLine}" fill="none" stroke="var(--ink)" stroke-width="2" stroke-dasharray="6,3" />
      ${markers}
      <line class="wf-scrub-line" x1="0" y1="${padT}" x2="0" y2="${H - padB}" stroke="var(--ink)" stroke-width="1.5" stroke-dasharray="3,3" style="display:none;" />
    </svg>`;

  if (legendEl) {
    const hasAnyShortfall = pts.some((p) => p.retired && p.shortfall > 0.5);
    legendEl.innerHTML = `
      <span class="legend-item"><i class="legend-swatch" style="background:var(--ink);"></i> Target Monthly Spending</span>
      <span class="legend-item"><i class="legend-swatch" style="background:#2563EB;"></i> Equity / Dividend / SSB Drawdown</span>
      ${showSrs ? `<span class="legend-item"><i class="legend-swatch" style="background:#7C3AED;"></i> SRS 10-Yr Drawdown (${fire.srsWithdrawalAge}+)</span>` : ""}
      <span class="legend-item"><i class="legend-swatch" style="background:#059669;"></i> CPF LIFE Payout (65+)</span>
      ${hasAnyShortfall ? '<span class="legend-item"><i class="legend-swatch" style="background:#DC2626;"></i> Monthly Shortfall (Unfunded)</span>' : ""}`;
  }

  const wrap = chartArea.parentElement;
  const scrub = chartArea.querySelector(".wf-scrub-line");
  if (!wrap || !tooltipEl || !scrub) return;
  const onMove = (e) => {
    const svg = chartArea.querySelector("svg");
    if (!svg) return;
    const svgRect = svg.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const left = svgRect.left + (padL / W) * svgRect.width;
    const width = (plotW / W) * svgRect.width;
    const frac = Math.max(0, Math.min(0.9999, (cx - left) / width));
    const idx = Math.floor(frac * pts.length);
    const pt = pts[idx] || pts[0];
    const sx = centerX(idx);
    scrub.setAttribute("x1", sx);
    scrub.setAttribute("x2", sx);
    scrub.style.display = "block";
    tooltipEl.hidden = false;
    tooltipEl.innerHTML = `
      <div class="tt-head">Age ${pt.age} (${pt.year})</div>
      <div class="tt-row"><span>Target Spend</span><b>${m(pt.spend, "/mo")}</b></div>
      ${
        pt.retired
          ? `<div class="tt-row"><span>Equity / SSB</span><b class="sem-eq">${m(pt.liquid, "/mo")}</b></div>
             <div class="tt-row"><span>SRS Draw</span><b class="sem-srs">${m(pt.srs, "/mo")}</b></div>
             <div class="tt-row"><span>CPF LIFE</span><b class="sem-cpf">${m(pt.cpf, "/mo")}</b></div>
             ${pt.shortfall > 0.5 ? `<div class="tt-row tt-alert"><span>Shortfall Alert</span><b>${m(pt.shortfall, "/mo")}</b></div>` : ""}`
          : `<div class="tt-note">Accumulating (pre-FIRE)</div>`
      }`;
    positionChartTooltip(
      tooltipEl,
      wrapRect,
      svgRect,
      sx,
      dY(pt.spend),
      W,
      H,
      padT,
      padB,
    );
  };
  const onLeave = () => {
    scrub.style.display = "none";
    tooltipEl.hidden = true;
  };
  wrap.onmousemove = onMove;
  wrap.ontouchmove = onMove;
  wrap.onmouseleave = onLeave;
  wrap.ontouchend = onLeave;
}

let finActivityTab = "coverage";

function buildFinActivityBarsSVG(fire, r, s, fn) {
  const pts = fire?.points || [];
  if (!pts.length) return "";
  const candAges = [55, 60, 65, 70, 75, 80, 85];
  if (
    !candAges.includes(fire.retire) &&
    fire.retire >= 40 &&
    fire.retire <= 90
  ) {
    // Replace nearest non-65 age so Retire age is always explicitly visible
    let nearestIdx = 0;
    let bestDiff = Infinity;
    candAges.forEach((a, i) => {
      if (a === 65) return;
      const d = Math.abs(a - fire.retire);
      if (d < bestDiff) {
        bestDiff = d;
        nearestIdx = i;
      }
    });
    candAges[nearestIdx] = fire.retire;
    candAges.sort((a, b) => a - b);
  }
  const bars = candAges.map((ageTarget) => {
    const pt =
      pts.find((p) => p.age === ageTarget) ||
      pts.reduce((best, p) =>
        Math.abs(p.age - ageTarget) < Math.abs(best.age - ageTarget) ? p : best,
      );
    const val = pt?.today?.totalNetWorth ?? 0;
    return { age: pt.age, val };
  });

  const ptRet = pts.find((p) => p.age === fire.retire) || pts[pts.length - 1];
  const retireNw = ptRet?.today?.totalNetWorth ?? 0;
  const goalTarget = Math.max(
    10000,
    (fn?.totalRequiredToday || 0) + (fire?.phase2?.projectedCpfAt65Today || 0),
  );
  const maxVal = Math.max(goalTarget * 1.16, ...bars.map((b) => b.val), 10000);

  const W = 340;
  const H = 152;
  const padL = 8;
  const padR = 8;
  const padT = 28;
  const padB = 22;
  const plotH = H - padT - padB;
  const plotW = W - padL - padR;
  const goalY = padT + (1 - Math.min(1, goalTarget / maxVal)) * plotH;
  const stepX = plotW / bars.length;

  const barEls = bars
    .map((b, i) => {
      const cx = padL + stepX * i + stepX / 2;
      const barW = 16;
      const h = Math.max(8, (Math.max(0, b.val) / maxVal) * plotH);
      const y = H - padB - h;
      const isRetire = b.age === fire.retire;
      const isCpf = b.age === 65 && !isRetire;
      const isSa = b.age === 55 && !isRetire;
      const fill = isRetire
        ? "#2563EB"
        : isCpf
          ? "#10B981"
          : isSa
            ? "#F97316"
            : "#E2E8F0";
      const labelFill = isRetire ? "#111827" : "#64748B";
      const labelWeight = isRetire ? "700" : "500";
      let callout = "";
      if (isRetire) {
        const pillText = `${compactMoney(b.val)}`;
        const pillW = Math.max(52, pillText.length * 7 + 14);
        const pillX = Math.max(
          padL,
          Math.min(W - padR - pillW, cx - pillW / 2),
        );
        const pillY = Math.max(2, y - 24);
        callout = `
          <circle cx="${cx}" cy="${y}" r="3" fill="#2563EB" stroke="#FFFFFF" stroke-width="1.5" />
          <g transform="translate(${pillX}, ${pillY})">
            <rect width="${pillW}" height="19" rx="5" fill="#EFF6FF" stroke="#BFDBFE" stroke-width="1" />
            <text x="${pillW / 2}" y="13" text-anchor="middle" font-size="10" font-weight="700" fill="#1D4ED8">${pillText}</text>
          </g>`;
      }
      return `
        <g>
          <title>Age ${b.age}: ${money(b.val)} projected net worth (today’s dollars)</title>
          <rect x="${cx - barW / 2}" y="${y}" width="${barW}" height="${h}" rx="5" fill="${fill}" />
          <text x="${cx}" y="${H - 5}" text-anchor="middle" font-size="10.5" font-weight="${labelWeight}" fill="${labelFill}">${b.age}</text>
          ${callout}
        </g>`;
    })
    .join("");

  return `<div class="fin-bars-wrap">
    <div class="fin-bars-head">
      <span>Projected net worth by age</span>
      <span class="fin-goal-note">95-yr goal: ${compactMoney(goalTarget)}</span>
    </div>
    <svg class="fin-bars-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-label="Projected net worth across key ages against retirement goal">
      <line x1="${padL}" y1="${goalY}" x2="${W - padR}" y2="${goalY}" stroke="#94A3B8" stroke-width="1.2" stroke-dasharray="4,4" />
      ${barEls}
    </svg>
    <div class="fin-bars-legend">
      <span><i style="background:#F97316;"></i>55 (SA→RA)</span>
      <span><i style="background:#2563EB;"></i>${fire.retire} (Retire)</span>
      <span><i class="is-dash"></i>Target to 95</span>
    </div>
  </div>`;
}

function buildFinReadinessGaugeSVG(
  pctFunded,
  eyebrowText,
  readyText,
  deltaLine,
  deltaColor,
) {
  const ratio = Math.max(0, Math.min(1, pctFunded / 130));
  const cx = 130;
  const cy = 128;
  const totalTicks = 40;
  const ticksSVG = Array.from({ length: totalTicks }, (_, idx) => {
    const t = idx / (totalTicks - 1);
    const deg = -180 + t * 180;
    const rad = (deg * Math.PI) / 180;
    const r1 = 78;
    const r2 = 95;
    const x1 = cx + Math.cos(rad) * r1;
    const y1 = cy + Math.sin(rad) * r1;
    const x2 = cx + Math.cos(rad) * r2;
    const y2 = cy + Math.sin(rad) * r2;
    const segColor = t < 0.36 ? "#2563EB" : t < 0.72 ? "#10B981" : "#F97316";
    const active = t <= ratio;
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${active ? segColor : "#E5E7EB"}" stroke-width="3" stroke-linecap="round" />`;
  }).join("");

  const arcSegment = (startDeg, endDeg, color) => {
    const r = 104;
    const sRad = (startDeg * Math.PI) / 180;
    const eRad = (endDeg * Math.PI) / 180;
    const sx = cx + Math.cos(sRad) * r;
    const sy = cy + Math.sin(sRad) * r;
    const ex = cx + Math.cos(eRad) * r;
    const ey = cy + Math.sin(eRad) * r;
    return `<path d="M ${sx.toFixed(1)} ${sy.toFixed(1)} A ${r} ${r} 0 0 1 ${ex.toFixed(1)} ${ey.toFixed(1)}" fill="none" stroke="${color}" stroke-width="5.5" stroke-linecap="round" />`;
  };

  return `<div class="fin-gauge-wrap">
    <svg class="fin-gauge-svg" viewBox="0 0 260 142" width="260" height="142" aria-hidden="true">
      ${arcSegment(-178, -118, "#2563EB")}
      ${arcSegment(-112, -52, "#10B981")}
      ${arcSegment(-46, -2, "#F97316")}
      ${ticksSVG}
      <text x="15" y="74" font-size="10" font-weight="600" fill="#6B7280" text-anchor="middle" transform="rotate(-55 15 74)">Start</text>
      <text x="130" y="13" font-size="10" font-weight="600" fill="#6B7280" text-anchor="middle">Target</text>
      <text x="245" y="74" font-size="10" font-weight="600" fill="#6B7280" text-anchor="middle" transform="rotate(55 245 74)">Surplus</text>
    </svg>
    <div class="fin-gauge-center">
      <span class="fin-gauge-eyebrow">${eyebrowText}</span>
      <strong>${readyText}</strong>
      <span class="fin-gauge-delta" style="color:${deltaColor};">${deltaLine}</span>
    </div>
  </div>`;
}

function buildOverviewPageHeader(fire, r, s, isCustomSpend = false) {
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

function buildFinOverviewGrid(
  fire,
  r,
  s,
  p,
  simulation,
  bogle,
  simGuide,
  tax,
  pctOfPay,
  selected,
  isCustomSpend = false,
) {
  const fn = fire.fireNumber;
  const pct = Math.min(150, Math.max(0, fn.pctFunded));
  const onTrack = pct >= 100 && fn.fullyFundedTo95;
  const contribution = simulation.cpfExtra + s.privateSaving;
  const projFireAge = fn.projectedFireAge;
  const readyText = projFireAge == null ? "After 80" : `Age ${projFireAge}`;
  const diffYears = projFireAge == null ? null : fire.retire - projFireAge;
  const depletionAgeDisplay =
    fn.depletionAge != null ? Math.floor(fn.depletionAge) : 90;
  const survivalAnswer = fn.fullyFundedTo95
    ? "Lasts past age 95+"
    : `Savings last to age ${depletionAgeDisplay}`;
  const safeAgeAnswer =
    diffYears == null
      ? "After age 80"
      : diffYears > 0
        ? `Age ${projFireAge} (${diffYears} yr${diffYears > 1 ? "s" : ""} early)`
        : diffYears === 0
          ? `Age ${projFireAge} (on target)`
          : `Age ${projFireAge} (+${-diffYears} yr${-diffYears > 1 ? "s" : ""} later)`;
  const deltaLine = `${fn.pctFunded}% of age-95 goal`;
  const deltaColor =
    diffYears != null && diffYears >= 0 && onTrack ? "#059669" : "#EA580C";

  const cpfCov65Pct = Math.min(
    100,
    Math.round((s.payout / Math.max(1, r.spend65)) * 100),
  );
  const ptAtRetire =
    fire.points.find((pt) => pt.age === fire.retire) ||
    fire.points[fire.points.length - 1];
  const retireNw = ptAtRetire?.today?.totalNetWorth ?? 0;

  const paycheck = RetirementModel.paycheckAllocation(r, simulation, bogle, p);
  const grossPlusEmployer = paycheck.grossPlusEmployer;
  const paycheckBars = paycheck.rows;

  const milestones = getMilestoneNodes(fire, r, s, simulation);
  const startPt = fire.points[0];
  const startingCpf = startPt?.cpfTotal ?? 0;
  const startingOutside = startPt?.totalOutside ?? 0;
  const startingTotalAssets = startingCpf + startingOutside;
  const yearsToRetire = Math.max(0, fire.retire - fire.age);
  const selectedPathName =
    s.key === "salary"
      ? "Salary CPF"
      : s.key === "frs"
        ? "FRS Path"
        : "ERS Path";
  const lifestyleCardLabel = isCustomSpend
    ? "Custom"
    : r.lifestyle === "cca"
      ? "Community Care"
      : "Home + Helper";
  const lifestyleCardValue = `${lifestyleCardLabel} (${m(r.todaySpend)}/mo)`;
  const lifestyleCardAria = `${lifestyleCardLabel} (${money(r.todaySpend)}/mo)`;

  const pathMeta = {
    salary: {
      name: "Salary CPF",
      tag: "Baseline",
      accent: "#64748B",
      softBg: "#F1F5F9",
      icon: svgWrap(
        '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
        16,
      ),
      note: "Uses mandatory salary CPF only; highest liquid monthly cashflow.",
    },
    frs: {
      name: "FRS Target",
      tag: "Standard Sum",
      accent: "#2563EB",
      softBg: "#EFF6FF",
      icon: svgWrap(
        '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
        16,
      ),
      note: "Targets $220.4k cohort FRS by 55 for steady baseline CPF LIFE.",
    },
    ers: {
      name: "ERS Maximum",
      tag: "Max Floor",
      accent: "#10B981",
      softBg: "#ECFDF5",
      icon: svgWrap('<path d="M3 3v18h18"/><path d="m7 14 4-4 4 3 5-6"/>', 16),
      note: "Voluntary RA top-ups from 55 toward $440.8k ERS; highest lifelong income.",
    },
  };

  const activeCoverage = finActivityTab === "coverage";
  const activePaycheck = finActivityTab === "paycheck";
  const activeMilestones = finActivityTab === "milestones";

  return `<div class="fin-top-kpis" role="region" aria-label="Key plan inputs">
    <button type="button" class="fin-kpi-card card-surface is-interactive" data-quick-edit="age" aria-label="Your current age ${fire.age}${p.dob ? `, born ${formatDobShort(p.dob)}` : ""}. Click to edit">
      <div class="fin-kpi-head">
        <span class="fin-kpi-label">Your Age</span>
        <span class="fin-kpi-tag">Now</span>
      </div>
      <strong class="fin-kpi-val">Age ${fire.age}</strong>
      <span class="fin-kpi-sub">${p.dob ? `DOB ${formatDobShort(p.dob)} · Click to edit` : "Click to set date of birth"}</span>
    </button>
    <button type="button" class="fin-kpi-card card-surface is-interactive" data-quick-edit="goal" aria-label="Target retirement age ${fire.retire}. Click to adjust">
      <div class="fin-kpi-head">
        <span class="fin-kpi-label">Target Retire Age</span>
        <span class="fin-kpi-tag">${r.retiringNow ? "Retiring now" : `${yearsToRetire} yr${yearsToRetire === 1 ? "" : "s"} to go`}</span>
      </div>
      <strong class="fin-kpi-val">Age ${fire.retire}</strong>
      <span class="fin-kpi-sub">Click to adjust target</span>
    </button>
    <button type="button" class="fin-kpi-card card-surface is-interactive" data-quick-edit="balances" aria-label="Total current assets ${money(startingTotalAssets)}. Click to view breakdown and edit balances">
      <div class="fin-kpi-head">
        <span class="fin-kpi-label">Total Current Assets</span>
        <span class="fin-kpi-tag">Breakdown ↗</span>
      </div>
      <strong class="fin-kpi-val">${m(startingTotalAssets)}</strong>
      <span class="fin-kpi-sub">${m(startingCpf)} CPF · ${m(startingOutside)} outside</span>
    </button>
    <button type="button" class="fin-kpi-card card-surface is-interactive" data-quick-edit="budget" aria-label="Living budget ${lifestyleCardAria}. Click to adjust lifestyle or CPF LIFE">
      <div class="fin-kpi-head">
        <span class="fin-kpi-label">Living Target</span>
        <span class="fin-kpi-tag">${selectedPathName}</span>
      </div>
      <strong class="fin-kpi-val">${m(r.todaySpend, "/mo")}</strong>
      <span class="fin-kpi-sub">${lifestyleCardLabel} · CPF LIFE ${r.plan === "escalating" ? "Esc" : "Std"}</span>
    </button>
  </div>
  <div class="fin-overview-grid">
    <div class="fin-col-main">
      <section class="fin-card fin-hero-card card-surface" aria-labelledby="ember-traj-title">
        <div class="fin-hero-top">
          <div class="fin-hero-metric">
            <span class="fin-card-eyebrow" id="ember-traj-title">Projected Net Worth at ${fire.retire}</span>
            <div class="fin-big-figure-row">
              <strong class="fin-big-figure">${m(retireNw)}</strong>
              <span class="fin-curr">SGD</span>
            </div>
            <p class="fin-delta-line">
              <span>${m(fn.totalRequiredToday)} outside + ${m(fire.phase2.projectedCpfAt65Today)} CPF at 65</span>
              <span class="fin-delta-badge ${onTrack ? "is-good" : "is-warn"}">${fn.pctFunded}% goal</span>
            </p>
          </div>
          <div class="fin-hero-actions">
            <button type="button" class="button button-small fin-pill-btn" data-quick-edit="balances">Edit Balances</button>
          </div>
        </div>
        <div class="chart-wrapper">
          <div id="dash-networth-chart" class="chart-area" role="img" aria-label="Stacked net worth trajectory from age ${fire.age} to ${fire.endAge}"></div>
          <div id="dash-networth-tooltip" class="chart-tooltip" hidden></div>
        </div>
        <div class="chart-legend fin-chart-legend" id="dash-networth-legend"></div>
      </section>

      <section class="fin-card fin-table-card card-surface" aria-labelledby="ledger-title">
        <div class="ember-card-head">
          <div>
            <h2 id="ledger-title">CPF Retirement Path</h2>
            <p>${r.retiringNow ? "With retirement set to now, FRS and ERS model lump-sum funding today; Salary CPF uses existing balances only." : "Compare relying on mandatory salary CPF versus funding FRS or ERS for higher lifelong CPF LIFE income."}</p>
          </div>
          <button type="button" class="button button-small fin-pill-btn" data-go-tab="trajectory">Open Simulator →</button>
        </div>
        <div class="table-scroll">
          <table class="ember-ledger-table fin-table">
            <thead>
              <tr>
                <th scope="col">Strategy Path</th>
                <th scope="col">Age-55 CPF</th>
                <th scope="col">Extra CPF</th>
                <th scope="col">Outside Save</th>
                <th scope="col">CPF LIFE (65+)</th>
                <th scope="col" class="col-action">Selection</th>
              </tr>
            </thead>
            <tbody>
              ${r.scenarios
                .map((path) => {
                  const meta = pathMeta[path.key] || pathMeta.salary;
                  const isSelected = path.key === selected;
                  return `<tr class="${isSelected ? "is-selected" : ""}">
                    <td>
                      <div class="fin-table-path">
                        <span class="fin-path-icon" style="background:${meta.softBg};color:${meta.accent};">${meta.icon}</span>
                        <div>
                          <div class="ledger-path-cell">
                            <strong>${meta.name}</strong>
                            <span class="ledger-tag">${meta.tag}</span>
                          </div>
                          <small class="ledger-sub">${meta.note}</small>
                        </div>
                      </div>
                    </td>
                    <td class="num-cell" data-label="Age-55 CPF">${m(path.balance)}</td>
                    <td class="num-cell" data-label="Extra CPF">${m(path.cpfFunding, r.retiringNow ? " now" : "/mo")}</td>
                    <td class="num-cell" data-label="Outside Save">${m(path.privateSaving, r.retiringNow ? " now" : "/mo")}</td>
                    <td class="num-cell" data-label="CPF LIFE (65+)"><strong>${m(path.payout, "/mo")}</strong></td>
                    <td class="col-action">
                      <button type="button" class="${isSelected ? "ledger-btn-active" : "ledger-btn"}" data-path="${path.key}" aria-pressed="${isSelected}">${isSelected ? "Selected" : "Select"}</button>
                    </td>
                  </tr>`;
                })
                .join("")}
            </tbody>
          </table>
        </div>
        <details class="ember-disclaimer">
          <summary class="ember-disclaimer-summary">
            <span class="disclaimer-chip">2026 CPF &amp; IRAS</span>
            <span class="disclaimer-preview">Today’s dollars · ${Number((r.inflation * 100).toFixed(1))}% inflation · ${Math.round(r.investmentReturn * 100)}% outside return</span>
            <span class="disclaimer-toggle" aria-hidden="true">Details …</span>
          </summary>
          <div class="ember-disclaimer-body">
            <ul>
              <li><strong>Purchasing power &amp; return:</strong> Shows today’s dollars (${Number((r.inflation * 100).toFixed(1))}% inflation, ${Math.round(r.investmentReturn * 100)}% blended net outside return including ETFs/SSB; ${r.post55Work ? "post-55 salary CPF included" : "post-55 work contributions excluded"}).</li>
              <li><strong>2026 CPF &amp; IRAS rules:</strong> OW ceiling $8,000/mo, Basic Healthcare Sum $79,000, FRS $220,400, ERS $440,800, and $80,000 personal relief cap.</li>
              <li><strong>Irreversible actions:</strong> Cash RSTU and OA-to-SA transfers before 55 cannot be reversed and receive $0 tax relief once SA/RA hits FRS. <button type="button" class="footnote-link-btn" commandfor="plan-settings" command="show-modal">Review assumptions ↗</button></li>
            </ul>
          </div>
        </details>
      </section>
    </div>

    <div class="fin-col-rail">
      <button type="button" class="fin-card fin-saving-card card-surface is-interactive" data-quick-edit="income" aria-label="Monthly Saving Needed. Click to adjust salary, housing, or monthly savings">
        <div class="fin-saving-top">
          <span class="fin-saving-title">Monthly saving needed</span>
          <span class="fin-outline-pill">${r.retiringNow ? "Lump sum" : `${pctOfPay}% of take-home`}</span>
        </div>
        <div class="fin-saving-val-row">
          <strong>${r.retiringNow ? m(s.privateSaving) : m(contribution)}</strong>
          <span class="fin-curr">SGD${r.retiringNow ? " now" : "/mo"}</span>
        </div>
        <div class="fin-saving-meta">
          <span>${r.retiringNow ? "Immediate portfolio requirement" : `${m(simulation.cpfExtra)} extra CPF · ${m(s.privateSaving)} outside`}</span>
          <small>Take-home ${m(r.afterCpf)}/mo (Gross ${m(r.salary)}) · Click to edit</small>
        </div>
      </button>

      <section class="fin-card fin-activity-card card-surface" aria-label="Income, paycheck allocation, and milestones">
        <div class="fin-activity-head">
          <h2>Income &amp; Cashflow</h2>
          <button type="button" class="fin-link-pill" data-quick-edit="budget">Edit budget</button>
        </div>
        <div class="fin-segmented-tabs" id="fin-activity-tabs" role="tablist" aria-label="Cashflow views">
          <button type="button" role="tab" class="fin-seg-tab${activeCoverage ? " is-active" : ""}" data-fin-activity="coverage" aria-selected="${activeCoverage}">Coverage</button>
          <button type="button" role="tab" class="fin-seg-tab${activePaycheck ? " is-active" : ""}" data-fin-activity="paycheck" aria-selected="${activePaycheck}">Paycheck</button>
          <button type="button" role="tab" class="fin-seg-tab${activeMilestones ? " is-active" : ""}" data-fin-activity="milestones" aria-selected="${activeMilestones}">Milestones</button>
        </div>

        <div class="fin-activity-pane" ${activeCoverage ? "" : "hidden"}>
          <div class="fin-coverage-card">
            <div class="fin-cov-head">
              <span>Age-65 income split</span>
              <strong>${money(r.spend65)}/mo need</strong>
            </div>
            <div class="fin-cov-track" aria-hidden="true">
              <span class="fin-cov-cpf" style="width:${cpfCov65Pct}%"></span>
              <span class="fin-cov-out" style="width:${Math.max(0, 100 - cpfCov65Pct)}%"></span>
            </div>
            <div class="fin-cov-legend">
              <span><i style="background:#10B981;"></i><b>${money(s.payout)}/mo</b> CPF LIFE (${cpfCov65Pct}%)</span>
              <span><i style="background:#2563EB;"></i><b>${money(s.gap65)}/mo</b> savings (${Math.max(0, 100 - cpfCov65Pct)}%)</span>
            </div>
          </div>
          <div class="fin-bars-stage">
            ${buildFinActivityBarsSVG(fire, r, s, fn)}
          </div>
        </div>

        <div class="fin-activity-pane" ${activePaycheck ? "" : "hidden"}>
          <div class="ember-bars-list">
            ${paycheckBars
              .map((row) => {
                const w = Math.min(
                  100,
                  Math.round((row.amt / grossPlusEmployer) * 100),
                );
                return `<div class="ember-bar-row">
                  <div class="ember-bar-meta">
                    <span><i style="background:${row.color};"></i>${row.label}</span>
                    <b>${money(row.amt)} <small>(${w}%)</small></b>
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

        <div class="fin-activity-pane" ${activeMilestones ? "" : "hidden"}>
          <ul class="ember-feed-list">
            ${milestones
              .map(
                (n) => `<li class="ember-feed-item">
                  <span class="ember-feed-avatar" style="background:${n.softBg};color:${n.color};">${n.badge}</span>
                  <div class="ember-feed-info">
                    <strong>${n.title}</strong>
                    <span>${n.tag} · ${n.sub}</span>
                  </div>
                  <div class="ember-feed-right">
                    <b>${n.metric}</b>
                    <span class="ember-feed-pill">${n.pill}</span>
                  </div>
                </li>`,
              )
              .join("")}
          </ul>
        </div>
      </section>

      <button type="button" class="fin-card fin-gauge-card card-surface is-interactive" data-quick-edit="goal" aria-label="Retirement Readiness: Earliest age ${readyText}, ${survivalAnswer}. Click to adjust target retirement age">
        <div class="fin-gauge-head">
          <h2>Retirement Readiness</h2>
          <span class="fin-target-pill">Goal: Age ${fire.retire}</span>
        </div>
        ${buildFinReadinessGaugeSVG(
          pct,
          "EARLIEST SAFE AGE",
          readyText,
          deltaLine,
          deltaColor,
        )}
        <div class="fin-gauge-facts">
          <div class="fin-gauge-fact-row">
            <span>If retiring at ${fire.retire}</span>
            <strong class="${fn.fullyFundedTo95 ? "is-good" : "is-warn"}">${survivalAnswer}</strong>
          </div>
          <div class="fin-gauge-fact-row">
            <span>To last to age 95</span>
            <strong>${safeAgeAnswer}</strong>
          </div>
        </div>
      </button>
    </div>
  </div>`;
}

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

function buildBogleheadSection(bogle, r) {
  const liq = bogle.liquid;
  const hol = bogle.holistic;
  const reb = bogle.monthlyRebalance;
  const liqDonut = svgDonut(
    [
      { value: liq.globalEquities, color: "#2563EB" },
      { value: liq.sgDividends, color: "#60A5FA" },
      { value: liq.bondsCash, color: "#D97706" },
    ],
    `${Math.round(liq.equityPct)}/${Math.round(liq.bondPct)}`,
    "Eq / Cash",
  );
  const holDonut = svgDonut(
    [
      { value: hol.globalEquities, color: "#2563EB" },
      { value: hol.sgDividends, color: "#60A5FA" },
      { value: hol.liquidBonds, color: "#D97706" },
      { value: hol.cpfTotal, color: "#059669" },
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

  const targetGlobalPct = Math.max(0, hol.targetEquityPct - hol.sgSleevePct);
  const targetSgPct = Math.max(0, hol.targetEquityPct - targetGlobalPct);
  const bondLabel =
    hol.cpfTotal > 0 && hol.liquidBonds > 0
      ? "Bond/CPF"
      : hol.cpfTotal > 0
        ? "CPF"
        : "SSB/Cash";
  const targetBondColor = hol.cpfTotal > 0 ? "#059669" : "#D97706";
  const targetBondTitle =
    hol.cpfTotal > 0 ? "Target Bond / CPF Floor" : "Target SSB / Cash Floor";
  const equityGapPct = Math.round(hol.targetEquityPct - hol.effectiveEquityPct);
  const gapBadge =
    Math.abs(equityGapPct) <= 3
      ? { cls: "is-good", text: "Aligned with target" }
      : equityGapPct > 0
        ? { cls: "is-equities", text: `+${equityGapPct}% Equities needed` }
        : { cls: "is-bonds", text: `+${-equityGapPct}% Bond floor needed` };

  return `<section class="bogle-card card-surface" id="boglehead-allocator" aria-labelledby="bogle-title">
    <div class="bogle-head">
      <div>
        <h2 id="bogle-title">True Effective Stock / Bond Ratio</h2>
        <p>Current balances count CPF OA/SA/MA (${m(hol.cpfTotal)}) and SSB/Cash (${m(hol.liquidBonds)}) together as your defensive bond floor.</p>
      </div>
    </div>
    <div class="bogle-donuts-grid">
      <div class="donut-panel">
        <div class="donut-panel-head">
          <h3>Current Liquid Portfolio</h3>
          <span class="donut-tag">${m(liq.total)} today</span>
        </div>
        <div class="donut-row">
          ${liqDonut}
          <ul class="donut-legend">
            <li><i style="background:#2563EB;"></i><span>Global UCITS</span><b>${m(liq.globalEquities)}</b></li>
            <li><i style="background:#60A5FA;"></i><span>SG Dividends</span><b>${m(liq.sgDividends)}</b></li>
            <li><i style="background:#D97706;"></i><span>SSB / Cash</span><b>${m(liq.bondsCash)}</b></li>
          </ul>
        </div>
      </div>
      <div class="donut-panel donut-panel-holistic">
        <div class="donut-panel-head">
          <h3>Current Total Net Worth</h3>
          <span class="donut-tag is-holistic">${m(hol.totalNetWorth)} total</span>
        </div>
        <div class="donut-row">
          ${holDonut}
          <ul class="donut-legend">
            <li><i style="background:#2563EB;"></i><span>Global Equities</span><b>${hol.totalNetWorth ? Math.round((hol.globalEquities / hol.totalNetWorth) * 100) : 0}% (${m(hol.globalEquities)})</b></li>
            <li><i style="background:#60A5FA;"></i><span>SG Dividends</span><b>${hol.totalNetWorth ? Math.round((hol.sgDividends / hol.totalNetWorth) * 100) : 0}% (${m(hol.sgDividends)})</b></li>
            <li><i style="background:#D97706;"></i><span>SSB / Cash</span><b>${hol.totalNetWorth ? Math.round((hol.liquidBonds / hol.totalNetWorth) * 100) : 0}% (${m(hol.liquidBonds)})</b></li>
            <li><i style="background:#059669;"></i><span>CPF (OA+SA+MA)</span><b>${hol.totalNetWorth ? Math.round((hol.cpfTotal / hol.totalNetWorth) * 100) : 0}% (${m(hol.cpfTotal)})</b></li>
          </ul>
        </div>
      </div>
    </div>

    <div class="bogle-target-panel">
      <div class="mix-compare-wrap">
        <div class="mix-compare-head">
          <div>
            <h3>Target Holistic Mix &amp; Gap</h3>
            <p>Dragging the target sliders below reshapes your long-term target mix and updates monthly buy orders live.</p>
          </div>
          <span class="mix-gap-pill ${gapBadge.cls}">${gapBadge.text}</span>
        </div>
        <div class="mix-bars">
          <div class="mix-bar-row">
            <div class="mix-bar-meta">
              <span>Current Mix</span>
              <strong>${Math.round(curGlobalPct)}% Global · ${Math.round(curSgPct)}% SG · ${Math.round(hol.effectiveBondPct)}% ${bondLabel}</strong>
            </div>
            <div class="mix-track" aria-hidden="true">
              ${curGlobalPct > 0.4 ? `<span style="width:${curGlobalPct.toFixed(1)}%;background:#2563EB;" title="Global Equities"></span>` : ""}
              ${curSgPct > 0.4 ? `<span style="width:${curSgPct.toFixed(1)}%;background:#60A5FA;" title="SG Dividends"></span>` : ""}
              ${curCashPct > 0.4 ? `<span style="width:${curCashPct.toFixed(1)}%;background:#D97706;" title="SSB / Cash"></span>` : ""}
              ${curCpfPct > 0.4 ? `<span style="width:${curCpfPct.toFixed(1)}%;background:#059669;" title="CPF OA/SA/MA"></span>` : ""}
            </div>
          </div>
          <div class="mix-bar-row">
            <div class="mix-bar-meta">
              <span>Target Mix</span>
              <strong>${targetGlobalPct}% Global · ${targetSgPct}% SG · ${hol.targetBondPct}% ${bondLabel}</strong>
            </div>
            <div class="mix-track" aria-hidden="true">
              ${targetGlobalPct > 0.4 ? `<span style="width:${targetGlobalPct}%;background:#2563EB;" title="Target Global UCITS"></span>` : ""}
              ${targetSgPct > 0.4 ? `<span style="width:${targetSgPct}%;background:#60A5FA;" title="Target SG Dividends"></span>` : ""}
              ${hol.targetBondPct > 0.4 ? `<span style="width:${hol.targetBondPct}%;background:${targetBondColor};" title="${targetBondTitle}"></span>` : ""}
            </div>
          </div>
        </div>
      </div>

      <div class="bogle-sliders">
        <label class="slider-control" for="bogle-target-slider">
          <span class="slider-head"><span>Target Holistic Equity / Bond Split</span><strong id="bogle-target-readout">${hol.targetEquityPct}% Eq / ${hol.targetBondPct}% Bond</strong></span>
          <input id="bogle-target-slider" type="range" min="20" max="95" step="5" value="${hol.targetEquityPct}" />
        </label>
        <label class="slider-control" for="bogle-sg-slider">
          <span class="slider-head"><span>Optional SG Dividend Sleeve (0–15%)</span><strong id="bogle-sg-readout">${hol.sgSleevePct}%</strong></span>
          <input id="bogle-sg-slider" type="range" min="0" max="15" step="1" value="${hol.sgSleevePct}" />
        </label>
      </div>

      <div class="rebalance-directive">
        <div>
          <strong>Monthly Paycheck Action · ${m(reb.investPool, "/mo")} investable</strong>
          <p>${reb.note}</p>
        </div>
        <div class="rebalance-pills">
          <span class="pill-eq"><i class="sem-dot" style="background:#2563EB;"></i><b>${m(reb.buyGlobalMonthly, "/mo")}</b> Global UCITS</span>
          <span class="pill-sg"><i class="sem-dot" style="background:#60A5FA;"></i><b>${m(reb.buySgMonthly, "/mo")}</b> SG Dividends</span>
          <span class="pill-cash"><i class="sem-dot" style="background:#D97706;"></i><b>${m(reb.buyBondMonthly, "/mo")}</b> SSB / T-Bills</span>
        </div>
      </div>
    </div>
  </section>`;
}

function buildTaxSweetSpotSection(tax) {
  const marginalPct = `${(tax.taxBefore.marginalRate * 100).toFixed(1).replace(/\.0$/, "")}%`;
  const capPct = Math.min(
    100,
    Math.round((tax.reliefCapUsed / RetirementModel.C.personalReliefCap) * 100),
  );
  const tierTone =
    tax.tier === "max-both" || tax.tier === "rstu-first"
      ? "is-good"
      : "is-warn";

  return `<section class="tax-sweet-card card-surface" id="tax-sweet-spot" aria-labelledby="tax-sweet-title">
    <div class="tax-sweet-head">
      <h2 id="tax-sweet-title">CPF RSTU vs. SRS Tax Sweet-Spot</h2>
      <span class="status-pill ${tierTone}">${tax.headline}</span>
    </div>
    <p class="tax-guidance-copy">${tax.guidance}</p>
    <dl class="tax-metrics-grid">
      <div class="tax-metric-box">
        <dt>Chargeable Income (est.)</dt>
        <dd>${m(tax.chargeableIncome, "/yr")}</dd>
        <small>${marginalPct} marginal bracket · ${money(tax.taxBefore.annualTax)}/yr tax</small>
      </div>
      <div class="tax-metric-box">
        <dt>CPF RSTU ($8k cap to FRS)</dt>
        <dd>${m(tax.rstuTaxSaved, "/yr saved")}</dd>
        <small>Eligible room: ${money(tax.maxRstu)}/yr (SA room ${money(tax.saRoom)})</small>
      </div>
      <div class="tax-metric-box">
        <dt>SRS ($15.3k Citizen/PR cap)</dt>
        <dd>${m(tax.srsTaxSavedAfterRstu, "/yr saved")}</dd>
        <small>After RSTU (${money(tax.srsStandaloneTaxSaved)}/yr standalone) · Lock-in age ${tax.srsLockInAge}</small>
      </div>
      <div class="tax-metric-box">
        <dt>$80k Relief Cap Used</dt>
        <dd>${m(tax.reliefCapUsed)} <span class="curr-muted">/ $80,000</span></dd>
        <small>${capPct}% used by CPF + reliefs (${money(tax.reliefCapRemaining)} left)</small>
      </div>
    </dl>
    <div class="srs-callout-bar" role="note">
      ${ICONS.warnTiny}
      <span>${tax.srsIdleWarning}</span>
    </div>
  </section>`;
}

function formatDobShort(dobStr) {
  const info = RetirementModel.computeAgeFromDob(dobStr);
  if (!info.valid) return "";
  const [y, mo, d] = info.iso.split("-").map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function setupSimplePlan() {
  const DEFAULT_DOB = RetirementModel.defaultDobForAge(35);
  const dobBounds = (() => {
    const now = new Date();
    const y = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return {
      min: `${String(y - 100).padStart(4, "0")}-01-01`,
      max: `${y}-${mo}-${d}`,
    };
  })();
  ["#person-dob", "#qe-dob"].forEach((sel) => {
    const el = $(sel);
    if (el) {
      el.min = dobBounds.min;
      el.max = dobBounds.max;
    }
  });
  if ($("#person-dob") && !$("#person-dob").value) {
    $("#person-dob").value = DEFAULT_DOB;
  }

  const fields = {
    lifestyle: "known-lifestyle",
    dob: "person-dob",
    salary: "person-salary",
    savings: "known-savings",
    spend: "known-spend",
    oa: "known-oa",
    sa: "known-sa",
    ma: "known-ma",
    maSpend: "known-ma-spend",
    saInvested: "known-sa-invested",
    equities: "known-equities",
    sgDividends: "known-sg-dividends",
    ssbCash: "known-ssb-cash",
    srs: "known-srs",
    srsAge: "known-srs-age",
    srsAnnual: "known-srs-annual",
    srsInvestedIn: "known-srs-invested",
    annualBonus: "known-annual-bonus",
    existingReliefs: "known-existing-reliefs",
    targetEquityPct: "known-target-equity",
    sgSleevePct: "known-sg-sleeve",
    cpfExtra: "known-cpf-extra",
    reserveReturn: "known-reserve-return",
    housingMode: "known-housing-mode",
    housingBalance: "known-housing-balance",
    housingYears: "known-housing-years",
    housingRate: "known-housing-rate",
    housingParties: "known-housing-parties",
    housing: "known-housing",
    retire: "known-retire",
    invest: "known-invest",
    plan: "known-plan",
    returnRate: "known-return",
    inflationRate: "known-inflation",
    post55Work: "known-post55",
  };
  const planRoot = $("#retirement-plan");
  const overviewSlot = $("#overview-slot");
  const allocatorSlot = $("#allocator-slot");
  const taxSlot = $("#tax-slot");
  const cpfRulesSlot = $("#cpf-rules-slot");
  const errorBanner = $("#plan-error-banner");

  let selected = "salary";
  let learningTarget = "frs";
  let learningPlan = null;
  let chartMode = "cashflow";
  const dashChartBasis = "today";
  let currentTrajectory = null;
  let currentFirePlan = null;
  let rafHandle = null;

  let savingEnabled = true;
  let readinessTimer;
  let readinessKey = "";
  let readinessAge = null;
  let readinessPending = true;
  try {
    savingEnabled = sessionStorage.getItem("rs_private_mode") !== "true";
    if (localStorage.getItem("rs_plan_version") !== "2") {
      localStorage.removeItem("rs_plan_state");
      localStorage.removeItem("rs_guide_step");
      localStorage.setItem("rs_plan_version", "2");
    }
  } catch (_) {}

  const restoreSavedState = () => {
    try {
      let params = null;
      if (
        location.hash &&
        location.hash.length > 2 &&
        location.hash.includes("=")
      ) {
        params = new URLSearchParams(location.hash.slice(1));
      } else {
        const saved = localStorage.getItem("rs_plan_state");
        if (saved) params = new URLSearchParams(JSON.parse(saved));
      }
      if (!params) return;
      if (
        params.get("version") !== "2" ||
        !["cca", "home-helper"].includes(params.get("lifestyle"))
      ) {
        localStorage.removeItem("rs_plan_state");
        if (location.hash.includes("="))
          history.replaceState(null, "", location.pathname + location.search);
        return;
      }
      for (const [key, id] of Object.entries(fields)) {
        if (params.has(key)) {
          const el = $("#" + id);
          if (el) {
            if (key === "housingParties") {
              const n = Math.min(
                6,
                Math.max(1, Math.round(Number(params.get(key) || 1))),
              );
              el.value = String(n);
            } else {
              el.value = params.get(key);
            }
          }
        }
      }
      if (!params.has("dob") && params.has("age") && $("#person-dob")) {
        const legacyAge = Number(params.get("age"));
        if (Number.isFinite(legacyAge) && legacyAge >= 1 && legacyAge <= 110) {
          $("#person-dob").value = RetirementModel.defaultDobForAge(legacyAge);
        }
      }
      if (!params.has("housingMode") && $("#known-housing-mode")) {
        if (!params.has("housing") || params.get("housing") === "") {
          $("#known-housing-mode").value = "all-oa";
        } else if (Number(params.get("housing")) === 0) {
          $("#known-housing-mode").value = "paid-up";
        } else {
          $("#known-housing-mode").value = "custom";
        }
      }
      if (["brs", "frs", "ers"].includes(params.get("learningTarget")))
        learningTarget = params.get("learningTarget");
      if (["salary", "frs", "ers"].includes(params.get("selected"))) {
        selected = params.get("selected");
      }
    } catch (_) {}
  };
  restoreSavedState();

  const persistState = (p) => {
    if (!savingEnabled) return;
    try {
      const data = {
        ...p,
        selected,
        learningTarget,
        version: 2,
      };
      const search = new URLSearchParams();
      for (const [k, v] of Object.entries(data)) {
        if (v != null && v !== "") search.set(k, String(v));
      }
      localStorage.setItem(
        "rs_plan_state",
        JSON.stringify(Object.fromEntries(search.entries())),
      );
      if (!location.hash || location.hash.includes("="))
        history.replaceState(history.state, "", "#" + search.toString());
    } catch (_) {}
  };

  const lastValidFieldValues = {};
  let lastCustomSpend = "";
  const qePanelForSrc = {
    "person-dob": { panel: "age", qeId: "qe-dob" },
    "known-retire": { panel: "goal", qeId: "qe-retire" },
    "known-lifestyle": { panel: "budget", qeId: "qe-lifestyle" },
    "known-spend": { panel: "budget", qeId: "qe-spend" },
    "known-plan": { panel: "budget", qeId: "qe-plan" },
    "person-salary": { panel: "income", qeId: "qe-salary" },
    "known-housing": { panel: "income", qeId: "qe-housing" },
    "known-housing-mode": { panel: "income", qeId: "qe-housing-mode" },
    "known-housing-balance": { panel: "income", qeId: "qe-housing-balance" },
    "known-housing-years": { panel: "income", qeId: "qe-housing-years" },
    "known-housing-rate": { panel: "income", qeId: "qe-housing-rate" },
    "known-housing-parties": { panel: "income", qeId: "qe-housing-parties" },
    "known-cpf-extra": { panel: "income", qeId: "qe-cpf-extra" },
    "known-invest": { panel: "income", qeId: "qe-invest" },
    "sim-invest": { panel: "income", qeId: "qe-invest" },
    "known-oa": { panel: "balances", qeId: "qe-oa" },
    "known-sa": { panel: "balances", qeId: "qe-sa" },
    "known-ma": { panel: "balances", qeId: "qe-ma" },
    "known-equities": { panel: "balances", qeId: "qe-equities" },
    "known-sg-dividends": { panel: "balances", qeId: "qe-sg-dividends" },
    "known-ssb-cash": { panel: "balances", qeId: "qe-ssb-cash" },
    "known-srs": { panel: "balances", qeId: "qe-srs" },
  };
  const getCustomSpendState = (rLifestyle = null) => {
    const lifestyleKey = rLifestyle || $("#known-lifestyle")?.value || "cca";
    const presetBudget =
      RetirementModel.lifestyles[lifestyleKey]?.budget || 2500;
    const spendEl = $("#known-spend");
    const raw = (spendEl?.value || "").trim();
    const isCustom =
      raw !== "" &&
      Boolean(spendEl?.validity?.valid) &&
      Number.isFinite(Number(raw)) &&
      Math.round(Number(raw) * 100) !== Math.round(presetBudget * 100);
    return {
      lifestyleKey,
      presetBudget,
      isCustom,
      spend: isCustom ? Number(raw) : presetBudget,
    };
  };
  const isCurrencyField = (input) =>
    input
      ?.closest?.(".input-wrap")
      ?.querySelector("span")
      ?.textContent?.trim() === "$";
  const formatBoundVal = (input, val) => {
    const n = Number(val);
    if (!Number.isFinite(n)) return String(val);
    return isCurrencyField(input) ? `$${n.toLocaleString("en-SG")}` : String(n);
  };
  const formatFieldRangeError = (input, key) => {
    const label = (
      input.labels?.[0]?.textContent ||
      document.querySelector(`label[for="${input.id}"]`)?.textContent ||
      key
    )
      .replace(/\s+/g, " ")
      .trim();
    const min = input.min;
    const max = input.max;
    if (min !== "" && max !== "") {
      return `${label} must be between ${formatBoundVal(input, min)} and ${formatBoundVal(input, max)}.`;
    }
    if (min !== "") {
      return `${label} must be at least ${formatBoundVal(input, min)}.`;
    }
    if (max !== "") {
      return `${label} must be at most ${formatBoundVal(input, max)}.`;
    }
    return `Check the allowed range for ${label}.`;
  };
  const setError = (message, invalidEl = null) => {
    const hasRenderedView = overviewSlot.children.length > 0;
    $$("[aria-invalid='true']").forEach((el) =>
      el.removeAttribute("aria-invalid"),
    );
    if (invalidEl) {
      invalidEl.setAttribute("aria-invalid", "true");
      const qeMap = qePanelForSrc[invalidEl.id];
      if (qeMap && $("#" + qeMap.qeId)) {
        $("#" + qeMap.qeId).setAttribute("aria-invalid", "true");
      }
    }
    if (!hasRenderedView) {
      learningPlan = null;
      clearTimeout(readinessTimer);
      readinessKey = "";
      readinessPending = true;
      $("#simulation-results").textContent =
        "Enter valid details to update your simulation.";
      overviewSlot.innerHTML = "";
      allocatorSlot.innerHTML = "";
      taxSlot.innerHTML = "";
      currentTrajectory = null;
      $("#trajectory-chart").replaceChildren();
      $("#trajectory-values").replaceChildren();
      $("#chart-legend").replaceChildren();
      $("#chart-tooltip").hidden = true;
      $("#print-sheet").replaceChildren();
    }
    if (errorBanner) {
      errorBanner.replaceChildren();
      const copyWrap = document.createElement("div");
      copyWrap.className = "plan-error-copy";
      const textSpan = document.createElement("span");
      textSpan.textContent = hasRenderedView
        ? `${message} Showing your last valid estimate.`
        : message;
      copyWrap.append(textSpan);
      const dobAgeCheck = RetirementModel.computeAgeFromDob(
        $("#person-dob")?.value || "",
      );
      if (dobAgeCheck.valid && dobAgeCheck.age >= 55) {
        const link = document.createElement("a");
        link.href =
          "https://www.cpf.gov.sg/member/tools-and-services/calculators";
        link.className = "text-link";
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = " Explore CPF’s personalised planning tools ↗";
        copyWrap.append(link);
      }
      const actions = document.createElement("div");
      actions.className = "plan-error-actions";
      const qeMap = invalidEl ? qePanelForSrc[invalidEl.id] : null;
      if (qeMap) {
        const fixBtn = document.createElement("button");
        fixBtn.type = "button";
        fixBtn.className = "button button-small fin-pill-btn";
        fixBtn.dataset.quickEdit = qeMap.panel;
        fixBtn.textContent = "Fix value";
        actions.append(fixBtn);
      } else {
        const settingsBtn = document.createElement("button");
        settingsBtn.type = "button";
        settingsBtn.className = "button button-small fin-pill-btn";
        settingsBtn.setAttribute("data-open-profile", "");
        settingsBtn.textContent = "Open My Settings";
        actions.append(settingsBtn);
      }
      if (invalidEl && invalidEl.id !== "person-dob") {
        const raw = invalidEl.value.trim();
        const hasMin = invalidEl.min !== "";
        const hasMax = invalidEl.max !== "";
        if (raw !== "" && !invalidEl.validity.badInput && (hasMin || hasMax)) {
          const minV = hasMin ? Number(invalidEl.min) : -Infinity;
          const maxV = hasMax ? Number(invalidEl.max) : Infinity;
          let clamped = Math.min(maxV, Math.max(minV, Number(raw)));
          if (invalidEl.step === "1") clamped = Math.round(clamped);
          const clampBtn = document.createElement("button");
          clampBtn.type = "button";
          clampBtn.className = "button button-small fin-pill-btn";
          clampBtn.dataset.clampField = invalidEl.id;
          clampBtn.dataset.clampVal = String(clamped);
          clampBtn.textContent = `Use ${formatBoundVal(invalidEl, clamped)}`;
          actions.append(clampBtn);
        } else if (
          lastValidFieldValues[invalidEl.id] != null &&
          lastValidFieldValues[invalidEl.id] !== ""
        ) {
          const restoreBtn = document.createElement("button");
          restoreBtn.type = "button";
          restoreBtn.className = "button button-small fin-pill-btn";
          restoreBtn.dataset.clampField = invalidEl.id;
          restoreBtn.dataset.clampVal = String(
            lastValidFieldValues[invalidEl.id],
          );
          restoreBtn.textContent = `Restore ${formatBoundVal(invalidEl, lastValidFieldValues[invalidEl.id])}`;
          actions.append(restoreBtn);
        }
      }
      const resetBtn = document.createElement("button");
      resetBtn.type = "button";
      resetBtn.className = "button button-small fin-pill-btn";
      resetBtn.setAttribute("data-sg-reset", "");
      resetBtn.textContent = "Reset defaults";
      actions.append(resetBtn);
      errorBanner.append(copyWrap, actions);
      errorBanner.hidden = false;
    }
    $("#print-plan-btn").disabled = true;
    $("#start-plan-error").textContent = message;
    $("#settings-error").textContent = message;
    const qeErr = $("#qe-error");
    if (qeErr) {
      qeErr.textContent = message;
      qeErr.hidden = !message;
    }
    delete $("#settings-live-summary").dataset.budget;
    $("#settings-live-summary").textContent =
      "Enter valid details to update your estimate.";
    if ($("#qe-live-summary")) {
      $("#qe-live-summary").textContent =
        "Enter valid details to update your estimate.";
    }
    $("#plan-status").textContent = message;
  };

  planRoot.addEventListener("click", (event) => {
    const learn = event.target.closest("button[data-learn]");
    if (learn) {
      learningTarget = learn.dataset.learn;
      render();
      $(`button[data-learn="${learningTarget}"]`)?.focus({
        preventScroll: true,
      });
      return;
    }
    if (
      event.target.closest("button[data-learn-apply]") &&
      learningPlan?.monthly != null
    ) {
      selected = learningTarget === "brs" ? "salary" : learningTarget;
      $("#known-cpf-extra").value = String(learningPlan.monthly);
      render();
      return;
    }
    const pathBtn = event.target.closest("button[data-path]");
    if (pathBtn) {
      selected = pathBtn.dataset.path;
      $("#known-cpf-extra").value = "";
      render();
      $(`button[data-path="${selected}"]`)?.focus({ preventScroll: true });
    }
  });

  let lastBankLoanRate = "2.5";
  const syncHousingDisplay = () => {
    const mode = $("#known-housing-mode")?.value || "all-oa";
    const isLoan = mode === "hdb" || mode === "bank";
    const isCustom = mode === "custom";
    const rateEl = $("#known-housing-rate");
    const qeRateEl = $("#qe-housing-rate");
    if (mode === "hdb") {
      if (rateEl) {
        rateEl.value = "2.6";
        rateEl.disabled = true;
      }
      if (qeRateEl) {
        qeRateEl.value = "2.6";
        qeRateEl.disabled = true;
      }
    } else if (mode === "bank") {
      if (rateEl) {
        rateEl.disabled = false;
        if (rateEl.value.trim() === "") rateEl.value = lastBankLoanRate;
      }
      if (qeRateEl) {
        qeRateEl.disabled = false;
        if (document.activeElement !== qeRateEl && rateEl) {
          qeRateEl.value = rateEl.value;
        }
      }
    } else {
      if (rateEl) rateEl.disabled = false;
      if (qeRateEl) qeRateEl.disabled = false;
    }

    for (const prefix of ["known", "qe"]) {
      const loanBox = $("#" + prefix + "-housing-loan-fields");
      const customBox = $("#" + prefix + "-housing-custom-field");
      if (loanBox) loanBox.hidden = !isLoan;
      if (customBox) customBox.hidden = !isCustom;
    }

    let previewHtml = "";
    if (mode === "all-oa") {
      previewHtml =
        "Assumes all incoming salary OA goes to housing (conservative baseline if loan details are unknown).";
    } else if (mode === "paid-up") {
      previewHtml =
        "<strong>$0/mo</strong> deducted from OA — all new OA builds CPF retirement savings at 2.5%.";
    } else if (mode === "custom") {
      const mVal = Math.max(0, Number($("#known-housing")?.value || 0));
      previewHtml = `Deducting <strong>${money(mVal)}/mo</strong> from OA across projection.`;
    } else {
      const bal = Math.max(0, Number($("#known-housing-balance")?.value || 0));
      const yrs = Math.max(0, Number($("#known-housing-years")?.value || 0));
      const rate =
        mode === "hdb"
          ? 2.6
          : Math.max(0, Number($("#known-housing-rate")?.value || 0));
      const parties = Math.max(
        1,
        Math.round(Number($("#known-housing-parties")?.value || 1)),
      );
      if (bal > 0 && yrs > 0) {
        const hp = RetirementModel.computeHousingPayment({
          mode,
          loanBalance: bal,
          loanRate: rate,
          loanYears: yrs,
          loanParties: parties,
        });
        previewHtml =
          parties > 1
            ? `Est. total mortgage ${money(hp.totalMonthly)}/mo ÷ ${parties} parties = <strong>${money(hp.monthlyShare)}/mo</strong> from OA for ${yrs} yrs (then $0).`
            : `Est. monthly mortgage: <strong>${money(hp.monthlyShare)}/mo</strong> from OA for ${yrs} yrs (then $0).`;
      } else {
        previewHtml =
          "Enter remaining loan balance &amp; years left above (currently <strong>$0/mo</strong> from OA).";
      }
    }
    if ($("#known-housing-preview"))
      $("#known-housing-preview").innerHTML = previewHtml;
    if ($("#qe-housing-preview"))
      $("#qe-housing-preview").innerHTML = previewHtml;
  };

  const render = () => {
    if (errorBanner) {
      errorBanner.hidden = true;
      errorBanner.replaceChildren();
    }
    $$("[aria-invalid='true']").forEach((el) =>
      el.removeAttribute("aria-invalid"),
    );
    syncCustomBudgetReset();
    const syncDobAgeUi = (dobValue) => {
      const info = RetirementModel.computeAgeFromDob(dobValue || "");
      const badges = ["#person-dob-age-badge", "#qe-dob-age-badge"];
      const settingsHint = $("#person-dob-hint");
      const qeHint = $("#qe-dob-hint");
      badges.forEach((sel) => {
        const badge = $(sel);
        if (!badge) return;
        if (info.valid) {
          badge.textContent = `Age ${info.age}`;
          badge.classList.toggle("is-warn", info.age < 18 || info.age > 54);
        } else {
          badge.textContent = "Enter DOB";
          badge.classList.add("is-warn");
        }
      });
      if (settingsHint) {
        if (!info.valid) {
          settingsHint.textContent =
            "Enter a valid date of birth (ages 18–54).";
        } else if (info.age >= 55) {
          settingsHint.textContent = `Calculated age ${info.age} · This illustration supports ages 18–54.`;
        } else if (info.age < 18) {
          settingsHint.textContent = `Calculated age ${info.age} · Minimum supported age is 18.`;
        } else {
          const moText =
            info.monthsRemainder > 0
              ? ` (${info.age} yrs ${info.monthsRemainder} mo${info.monthsRemainder === 1 ? "" : "s"})`
              : info.isBirthdayToday
                ? " (Happy birthday!)"
                : "";
          settingsHint.textContent = `Age ${info.age}${moText} · Salaried Singapore citizens and PRs aged 18–54.`;
        }
      }
      if (qeHint) {
        if (!info.valid) {
          qeHint.textContent =
            "Enter your date of birth (ages 18–54). Target retirement age adjusts automatically if needed.";
        } else if (info.age >= 55 || info.age < 18) {
          qeHint.textContent = `Calculated age ${info.age} · Supported range is ages 18–54.`;
        } else {
          const moText =
            info.monthsRemainder > 0
              ? ` (${info.age} yrs ${info.monthsRemainder} mo${info.monthsRemainder === 1 ? "" : "s"})`
              : "";
          qeHint.textContent = `Calculated age ${info.age}${moText} · Supports ages 18–54. Target retirement age adjusts automatically if needed.`;
        }
      }
      return info;
    };

    const dobAgeInfo = syncDobAgeUi($("#person-dob")?.value || "");
    const curAgeVal = dobAgeInfo.valid ? dobAgeInfo.age : 35;
    const lifeMinAge = $("#known-lifestyle").value === "cca" ? 55 : 40;
    $("#known-retire").min = String(Math.max(lifeMinAge, curAgeVal));
    const cpfPosOpen =
      planRoot.querySelector("#cpf-position-details")?.open || false;
    const salaryCapOpen =
      planRoot.querySelector("#salary-cpf-caps")?.open || false;
    const learningOpen =
      planRoot.querySelector("#cpf-goal-guide")?.open || false;
    const housingModeVal = $("#known-housing-mode")?.value || "all-oa";
    const p = {};
    for (const [key, id] of Object.entries(fields)) {
      if (key === "housing" && housingModeVal !== "custom") continue;
      if (
        [
          "housingBalance",
          "housingYears",
          "housingRate",
          "housingParties",
        ].includes(key) &&
        housingModeVal !== "hdb" &&
        housingModeVal !== "bank"
      ) {
        continue;
      }
      const input = $("#" + id);
      if (!input) continue;
      const val = input.value.trim();
      if (key === "dob") {
        const ageInfo = dobAgeInfo;
        if (input.validity.badInput || val === "" || !ageInfo.valid) {
          setError(
            "Enter a valid date of birth (ages 18–54) to see the CPF comparison.",
            input,
          );
          return;
        }
        if (ageInfo.age >= 55) {
          setError(
            `Based on your date of birth, your age is ${ageInfo.age}. This salary illustration supports ages 18–54. From 55, your Retirement Account and actual balances need CPF’s personalised retirement estimator.`,
            input,
          );
          return;
        }
        if (ageInfo.age < 18) {
          setError(
            `Based on your date of birth, your age is ${ageInfo.age}. Enter a date of birth for ages 18–54.`,
            input,
          );
          return;
        }
        p.dob = ageInfo.iso;
        p.age = ageInfo.age;
        continue;
      }
      if (input.validity.badInput) {
        setError(
          "Enter a number without dollar signs or commas. Leave a field blank only if you want to use its starting assumption.",
          input,
        );
        return;
      }
      if (val === "") {
        if (key === "salary") {
          setError(
            "Enter your gross monthly salary ($751–$1,000,000) to see the CPF comparison.",
            input,
          );
          return;
        }
        continue;
      }
      if (!input.validity.valid) {
        if (
          key === "retire" &&
          $("#known-lifestyle").value === "cca" &&
          Number(val) < 55
        ) {
          setError(
            "CCA currently requires age 55 or above. Choose 55–80, or switch to Home + Helper for ages 40–80.",
            input,
          );
          return;
        }
        setError(formatFieldRangeError(input, key), input);
        return;
      }
      p[key] =
        key === "plan" ||
        key === "lifestyle" ||
        key === "srsInvestedIn" ||
        key === "housingMode"
          ? val
          : key === "post55Work"
            ? val === "true"
            : Number(val);
    }
    syncHousingDisplay();
    if (housingModeVal === "all-oa") {
      delete p.housing;
      delete p.housingYears;
    } else if (housingModeVal === "paid-up") {
      p.housing = 0;
      delete p.housingYears;
    } else if (housingModeVal === "custom") {
      p.housing = p.housing == null ? 0 : p.housing;
      delete p.housingYears;
    } else {
      const hp = RetirementModel.computeHousingPayment({
        mode: housingModeVal,
        loanBalance: p.housingBalance,
        loanRate: p.housingRate,
        loanYears: p.housingYears,
        loanParties: p.housingParties,
      });
      if ((p.housingBalance || 0) > 0 && (p.housingYears || 0) > 0) {
        p.housing = Math.round(hp.monthlyShare * 100) / 100;
        p.housingYears = hp.years;
      } else {
        p.housing = 0;
        p.housingYears = 0;
      }
    }

    let r, simulation, fire, bogle, tax;
    try {
      const summary = RetirementModel.calculate(p);
      simulation = RetirementModel.simulate(p, selected, { summary });
      r = RetirementModel.todayPlan(summary);
      fire = RetirementModel.firePlan(p, selected, { summary, simulation });
      bogle = RetirementModel.bogleheadAllocation(p, simulation.invest);
      tax = RetirementModel.taxSweetSpot(p);
    } catch (e) {
      setError(e.message);
      return;
    }
    currentFirePlan = fire;

    const keepOA = RetirementModel.projectCPF(p);
    const moveOA = RetirementModel.projectCPF(p, 0, "salary", null, {
      transferOA: true,
    });
    const roomNow = Math.max(
      0,
      RetirementModel.C.frs - Number(p.sa || 0) - Number(p.saInvested || 0),
    );
    const maxRa55 = Math.max(1, keepOA.cpfAt55, moveOA.cpfAt55);
    const oaTransferSummaryTable = `<div class="timing-comparison">${[
      ["Keep OA as-is", keepOA],
      ["Transfer eligible OA to SA", moveOA],
    ]
      .map(
        ([label, x]) =>
          `<div class="timing-col"><h3>${label}</h3>
            <div class="timing-payout-bar"><span style="width:${(x.cpfAt55 / maxRa55) * 100}%"></span></div>
            <dl>
              <div><dt>Transferred now</dt><dd>${centsHtml(x.oaTransfer)}</dd></div>
              <div><dt>OA + SA just before 55</dt><dd>${m(x.oa + x.sa)}</dd></div>
              <div><dt>RA created at 55</dt><dd>${m(x.cpfAt55)}</dd></div>
              <div><dt>OA left after RA creation</dt><dd>${m(Math.max(0, x.availableAt55 - x.cpfAt55))}</dd></div>
              <div><dt>Extra housing cash needed</dt><dd>${m(x.housingShortfallToday)} (today’s $)</dd></div>
            </dl>
          </div>`,
      )
      .join("")}</div>
      <p class="result-footnote">Transferring adds <b>${m(Math.abs(moveOA.availableAt55 - keepOA.availableAt55))}</b> ${moveOA.availableAt55 >= keepOA.availableAt55 ? "more" : "less"} before 55 (future cash value), is irreversible, gives no tax relief, and reduces OA for mortgage payments.</p>`;

    const cpfDetailsHTML = `<section id="cpf-position-details" class="card-surface rules-card" aria-labelledby="cpf-pos-title">
      <div class="rules-card-head">
        <div>
          <h2 id="cpf-pos-title">CPF today → age 55 &amp; OA-to-SA transfer check</h2>
          <p>See your current OA/SA balances, 2026 FRS top-up room, and the impact of moving OA into SA before 55.</p>
        </div>
        <span class="fin-target-pill">Age-55 cash</span>
      </div>
      <dl class="tax-metrics-grid">
        <div class="tax-metric-box"><dt>OA today</dt><dd>${centsHtml(Number(p.oa || 0))}</dd></div>
        <div class="tax-metric-box"><dt>SA today</dt><dd>${centsHtml(Number(p.sa || 0))}</dd></div>
        <div class="tax-metric-box"><dt>SA top-up room to 2026 FRS</dt><dd>${centsHtml(roomNow)}</dd></div>
        <div class="tax-metric-box"><dt>OA transferable to SA now</dt><dd>${centsHtml(Math.min(Number(p.oa || 0), roomNow))}</dd></div>
      </dl>
      ${oaTransferSummaryTable}
    </section>`;

    persistState(p);
    $("#print-plan-btn").disabled = false;
    $("#start-plan-error").textContent = "";
    $("#settings-error").textContent = "";

    const s = RetirementModel.todayPlan({
      ...simulation.summary,
      scenarios: [simulation.selectedScenario],
    }).scenarios[0];
    const simMoneyHtml = (value, age, suffix = "") =>
      m(RetirementModel.todayValue(value, age, r.age, r.inflation), suffix);
    const rangeNote = simulation.payoutCapped
      ? `<div class="payout-range-note"><p><strong>Payout reference boundary reached (${m(s.payout, "/mo")} today’s value).</strong> Published CPF LIFE anchors stop at ERS; extra CPF reserve (${m(simulation.cpfResult.reserve65)} future cash at 65) stays separate. <a href="https://www.cpf.gov.sg/member/retirement-income/about-cpf-planner-retirement-income" target="_blank" rel="noopener">Check CPF’s official planner ↗</a></p></div>`
      : "";
    const simGuide = RetirementModel.outsideAllocationGuide(
      simulation.summary,
      simulation,
    );
    const combined = simulation.cpfExtra + simulation.invest;
    const left = r.afterCpf - combined;
    const takeHomePct =
      r.afterCpf > 0 ? Math.round((combined / r.afterCpf) * 100) : 0;
    $("#known-cpf-extra").placeholder = String(Math.ceil(simulation.cpfExtra));
    $("#sim-invest").value = $("#known-invest").value;
    $("#sim-invest").placeholder = String(Math.ceil(simulation.invest));
    $("#known-cpf-extra").disabled = r.retiringNow;
    $("#sim-invest").disabled = r.retiringNow;
    for (const button of $$("[data-adjust]")) button.disabled = r.retiringNow;

    const barTone =
      takeHomePct > 85 ? "is-danger" : takeHomePct > 50 ? "is-warn" : "is-good";
    const simStateIcon =
      simGuide.state.tone === "good" ? ICONS.checkTiny : ICONS.alertTriangle;
    $("#simulation-results").innerHTML = `
      <p class="fixed-retirement">Target retirement age: <strong>${r.retire}</strong>. Adjust amounts above or edit My Settings to test readiness and portfolio longevity.</p>
      <div class="affordability-card">
        <div class="affordability-head">
          <span>${r.retiringNow ? "Retirement set to now — future monthly saving is paused" : `Total monthly saving: <strong>${m(combined, "/mo")}</strong> (${takeHomePct}% of ${m(r.afterCpf)} pay after CPF)`}</span>
          <span class="affordability-right">
            <span class="status-pill is-${simGuide.state.tone}">${simStateIcon}<span>${simGuide.state.label}</span></span>
            <span>${r.retiringNow ? `Gap: ${m(s.remainingPortfolioGap)}` : left < 0 ? `Exceeds take-home by ${m(-left)}` : `${m(left, "/mo")} left before ~${m(simGuide.tax.monthlyTax)} tax`}</span>
          </span>
        </div>
        ${r.retiringNow ? "" : `<div class="affordability-track" role="progressbar" aria-valuenow="${Math.min(100, takeHomePct)}" aria-valuemin="0" aria-valuemax="100" aria-label="Share of take-home pay saved"><span class="affordability-fill ${barTone}" style="width:${Math.min(100, takeHomePct)}%"></span></div>`}
      </div>
      ${simulation.cpfResult.ra65 > 0 && simulation.cpfResult.ra65 < 60000 ? '<p class="estimate-note">Projected RA at 65 is below the $60,000 automatic CPF LIFE threshold; assumes voluntary CPF LIFE enrolment at 65.</p>' : ""}
      <dl class="simulation-metrics simulation-metrics-4">
        <div><dt>${simulation.payoutCapped ? "CPF boundary from 65" : "CPF LIFE from 65"}</dt><dd>${m(s.payout, "/mo")}<small>Today’s dollars · ${selected === "salary" ? "salary CPF path" : selected.toUpperCase() + " target"}</small></dd></div>
        <div><dt>Outside portfolio at ${r.retire}</dt><dd>${simMoneyHtml(simulation.portfolioAtRetire, r.retire)}<small>At retirement age ${r.retire}</small></dd></div>
        <div><dt>Funding status through 90</dt><dd>${simulation.fullyFunded ? `${m(0)} gap` : `${m(s.remainingPortfolioGap)} gap`}<small>${simulation.fullyFunded ? "Funded through age 90." : `Depletes around ${simulation.depletionAge == null ? r.retire : ageLabel(simulation.depletionAge)}.`}</small></dd></div>
        <div><dt>Earliest modelled retirement</dt><dd id="readiness-result">Calculating…</dd></div>
      </dl>
      <details class="result-details">
        <summary>See withdrawal rate, reserve &amp; yearly CPF ledger</summary>
        <dl class="simulation-metrics">
          <div><dt>Level portfolio withdrawal (${r.retire}–90)</dt><dd>${simMoneyHtml(simulation.monthlyPortfolioIncome, r.retire, "/mo")}<small>Estimated sustainable monthly drawdown</small></dd></div>
          <div><dt>${selected === "salary" ? "FRS milestone age" : selected.toUpperCase() + " milestone age"}</dt><dd>${simulation.cpfGoalAge == null ? "Not reached by 65" : ageLabel(simulation.cpfGoalAge)}<small>Includes earmarked reserve before 55</small></dd></div>
          <div><dt>CPF reserve outside CPF at 55</dt><dd>${simMoneyHtml(simulation.cpfResult.remainingReserve, 55)}<small>Kept separate from outside portfolio</small></dd></div>
          <div><dt>Current SA cash top-up room</dt><dd>${m(simulation.cpfResult.currentTopupRoom)}<small>${simulation.cpfResult.maShortfallToday > 0 ? `MA cash shortfall: ${m(simulation.cpfResult.maShortfallToday)}` : "2026 FRS less SA & CPFIS-SA"}</small></dd></div>
        </dl>
        <div class="table-scroll"><table class="trajectory-table"><caption>Projected CPF balances by age (stops at 65 when CPF LIFE starts)</caption><thead><tr><th scope="col">Age</th><th scope="col">OA</th><th scope="col">SA</th><th scope="col">MA</th><th scope="col">RA</th><th scope="col">Reserve</th><th scope="col">Extra deposits</th><th scope="col">CPF interest</th></tr></thead><tbody>${simulation.cpfResult.ledger.map((row) => `<tr><th scope="row">${row.age}</th>${["oa", "sa", "ma", "ra", "reserve", "totalExtra", "totalInterest"].map((key) => `<td>${m(row[key])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
      </details>
      ${rangeNote}`;

    currentTrajectory = RetirementModel.todayTrajectory(simulation);
    const drawdown = RetirementModel.drawdownToday(
      currentTrajectory.summary,
      currentTrajectory.selectedScenario,
    );
    const nextKey = JSON.stringify({
      ...p,
      selected,
      cpfExtra: simulation.cpfExtra,
      invest: simulation.invest,
    });
    const showReadiness = () => {
      const node = $("#readiness-result");
      if (!node) return;
      node.innerHTML = readinessPending
        ? "Calculating…"
        : `${ageLabel(readinessAge)}<small>${readinessAge == null ? "Increase savings or adjust budget to reach readiness by 80." : readinessAge <= r.retire ? `On track for your age-${r.retire} goal.` : `Reaches readiness by age ${Math.floor(readinessAge)}.`}</small>`;
    };
    if (nextKey !== readinessKey) {
      clearTimeout(readinessTimer);
      readinessKey = nextKey;
      readinessPending = true;
      readinessTimer = setTimeout(() => {
        readinessAge = RetirementModel.earliestRetirement(
          p,
          selected,
          simulation.cpfExtra,
          simulation.invest,
        );
        readinessPending = false;
        showReadiness();
        $("#simulation-status").textContent =
          `Retirement stays at ${r.retire}. Estimated CPF ${money(s.payout)} monthly from 65.`;
      }, 160);
    }
    showReadiness();

    const summaryText = r.retiringNow
      ? `Outside retirement savings: ${money(s.privateSaving)} needed now.`
      : `${s.key === "salary" ? "Salary CPF" : s.key.toUpperCase()}: CPF LIFE ${money(s.payout)}/mo · save ${money(s.privateSaving)}/mo outside CPF.`;
    $("#settings-live-summary").dataset.budget = summaryText;
    $("#settings-live-summary").textContent = summaryText;

    learningPlan = RetirementModel.milestonePlan(p, learningTarget);
    const lesson = learningPlan;
    const references = {
      brs: [110200, 950],
      frs: [220400, 1780],
      ers: [440800, 3440],
    };
    const lessonHTML = `<section id="cpf-goal-guide" class="card-surface rules-card" aria-labelledby="cpf-goal-title">
      <div class="rules-card-head">
        <div>
          <h2 id="cpf-goal-title">How to reach BRS, FRS or ERS at 55</h2>
          <p>2026 CPF reference anchors (male turning 55 in 2026, Standard Plan from 65).</p>
        </div>
        <span class="fin-target-pill">Age-55 cash</span>
      </div>
      <div class="goal-choices" role="group" aria-label="CPF milestone to learn about">${Object.entries(
        references,
      )
        .map(
          ([key, [sum, payout]]) =>
            `<button type="button" data-learn="${key}" aria-pressed="${key === learningTarget}"><strong>${key.toUpperCase()}</strong><span>${m(sum)} at 55</span><span>~${m(payout, "/mo")} from 65</span></button>`,
        )
        .join("")}</div>
      <dl class="tax-metrics-grid">
        <div class="tax-metric-box"><dt>Projected ${learningTarget.toUpperCase()} at your age 55</dt><dd>${m(lesson.target)}</dd></div>
        <div class="tax-metric-box"><dt>OA + SA at 55 before extra saving</dt><dd>${m(lesson.available)}</dd></div>
        <div class="tax-metric-box"><dt>Gap to ${learningTarget.toUpperCase()} at 55</dt><dd>${m(lesson.gap)}</dd></div>
        <div class="tax-metric-box"><dt>Extra CPF saving to hit milestone</dt><dd>${lesson.monthly === null ? "Lump sum only" : m(lesson.monthly, "/mo")}</dd></div>
      </dl>
      <ul class="compact-list">
        <li><strong>Before 55:</strong> Cash RSTU and OA-to-SA transfers share SA room up to current FRS (${centsHtml(lesson.currentRoom)} today) and are irreversible.</li>
        <li><strong>At 55:</strong> SA closes; SA then OA fund RA up to cohort FRS. ERS top-ups open from 55 (no RSTU tax relief above FRS).</li>
        ${learningTarget === "brs" ? "<li><strong>BRS property rule:</strong> Withdrawing RA above BRS requires pledging a property whose lease covers you to age 95+.</li>" : ""}
      </ul>
      <div class="flow-actions"><button type="button" class="text-button" data-learn-apply data-go-tab="trajectory" ${lesson.monthly === null ? "disabled" : ""}>Simulate ${lesson.monthly ? m(lesson.monthly, "/mo") : "this"} CPF saving →</button></div>
    </section>`;

    const contribution = simulation.cpfExtra + s.privateSaving;
    const pctOfPay =
      r.afterCpf > 0 ? Math.round((contribution / r.afterCpf) * 100) : 0;
    const isTight = pctOfPay > 50;
    const readinessTone =
      !simulation.fullyFunded || contribution > r.afterCpf || isTight
        ? "status-warn"
        : "status-good";
    const readinessHeadline = r.retiringNow
      ? simulation.fullyFunded
        ? "Ready today on your entered assets"
        : `${m(s.remainingPortfolioGap)} capital gap today`
      : !simulation.fullyFunded
        ? `${m(s.remainingPortfolioGap)} shortfall at ${r.retire}`
        : s.privateSaving <= 0.005 && simulation.cpfExtra <= 0.005
          ? "Already funded by your starting assets"
          : contribution > r.afterCpf
            ? `Critical target: ${m(contribution, "/mo")} (${pctOfPay}% of take-home pay)`
            : isTight
              ? `Stretch target: ${m(contribution, "/mo")} (${pctOfPay}% of take-home pay)`
              : `On track saving ${m(contribution, "/mo")} (${pctOfPay}% of take-home pay)`;

    Object.values(fields).forEach((id) => {
      const el = $("#" + id);
      if (el) lastValidFieldValues[id] = el.value;
    });
    if ($("#sim-invest"))
      lastValidFieldValues["sim-invest"] = $("#sim-invest").value;

    const { isCustom: isCustomSpend, spend: customSpendVal } =
      getCustomSpendState(r.lifestyle);
    if (isCustomSpend) {
      lastCustomSpend = String(Math.round(customSpendVal * 100) / 100);
    }
    const overviewHeaderHTML = buildOverviewPageHeader(
      fire,
      r,
      s,
      isCustomSpend,
    );
    const finGridHTML = buildFinOverviewGrid(
      fire,
      r,
      s,
      p,
      simulation,
      bogle,
      simGuide,
      tax,
      pctOfPay,
      selected,
      isCustomSpend,
    );

    const bogleHTML = buildBogleheadSection(bogle, r);
    const taxSweetHTML = buildTaxSweetSpotSection(tax);

    overviewSlot.innerHTML = `
      ${overviewHeaderHTML}
      ${rangeNote}
      ${finGridHTML}`;

    if ($("#header-lifestyle-label")) {
      $("#header-lifestyle-label").textContent =
        `${isCustomSpend ? "Custom" : r.lifestyle === "cca" ? "Community Care" : "Home + Helper"} (${money(r.todaySpend)}/mo)`;
    }
    $$("[data-switch-lifestyle]").forEach((item) => {
      const active =
        !isCustomSpend && item.dataset.switchLifestyle === r.lifestyle;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-checked", String(active));
    });
    const customMenuItem = $("#header-custom-item");
    if (customMenuItem) {
      customMenuItem.hidden = false;
      customMenuItem.classList.toggle("is-active", isCustomSpend);
      customMenuItem.setAttribute("aria-checked", String(isCustomSpend));
    }
    if ($("#header-custom-sub")) {
      $("#header-custom-sub").textContent = isCustomSpend
        ? `${money(r.todaySpend)}/mo · ${r.lifestyle === "cca" ? "CCA care rules" : "Home + Helper care rules"}`
        : lastCustomSpend
          ? `${money(Number(lastCustomSpend))}/mo saved · click to restore`
          : "Set custom monthly budget…";
    }

    const qeErrClear = $("#qe-error");
    if (qeErrClear) {
      qeErrClear.textContent = "";
      qeErrClear.hidden = true;
    }
    syncQuickEditState(r, fire, simulation);

    const activeBogleEl = document.activeElement;
    const draggingBogleSlider =
      activeBogleEl &&
      (activeBogleEl.id === "bogle-target-slider" ||
        activeBogleEl.id === "bogle-sg-slider") &&
      allocatorSlot.contains(activeBogleEl);
    if (draggingBogleSlider) {
      const tmp = document.createElement("div");
      tmp.innerHTML = bogleHTML;
      const newDonuts = tmp.querySelector(".bogle-donuts-grid");
      const newCompare = tmp.querySelector(".mix-compare-wrap");
      const newRebal = tmp.querySelector(".rebalance-directive");
      const oldDonuts = allocatorSlot.querySelector(".bogle-donuts-grid");
      const oldCompare = allocatorSlot.querySelector(".mix-compare-wrap");
      const oldRebal = allocatorSlot.querySelector(".rebalance-directive");
      if (newDonuts && oldDonuts) oldDonuts.replaceWith(newDonuts);
      if (newCompare && oldCompare) oldCompare.replaceWith(newCompare);
      if (newRebal && oldRebal) oldRebal.replaceWith(newRebal);
      const tRead = $("#bogle-target-readout");
      if (tRead)
        tRead.textContent = `${bogle.holistic.targetEquityPct}% Eq / ${bogle.holistic.targetBondPct}% Bond`;
      const sRead = $("#bogle-sg-readout");
      if (sRead) sRead.textContent = `${bogle.holistic.sgSleevePct}%`;
    } else {
      allocatorSlot.innerHTML = bogleHTML;
    }

    const marginalTaxPct = `${(tax.taxBefore.marginalRate * 100).toFixed(1).replace(/\.0$/, "")}%`;
    taxSlot.innerHTML = `
      <header class="ember-page-header">
        <h1>Tax Relief Optimization</h1>
        <span class="status-pill is-info">${marginalTaxPct} IRAS Bracket</span>
      </header>
      ${taxSweetHTML}
      <section class="card-surface rules-card" id="salary-cpf-caps" aria-labelledby="salary-caps-title">
        <div class="rules-card-head">
          <div>
            <h2 id="salary-caps-title">Salary CPF Contributions &amp; Wage Ceilings</h2>
            <p>2026 Ordinary Wage ceiling: $8,000/mo ($102,000 annual salary ceiling; $37,740 mandatory CPF cap).</p>
          </div>
          <span class="fin-target-pill">Under 55 rates</span>
        </div>
        <dl class="tax-metrics-grid">
          <div class="tax-metric-box"><dt>Employee CPF (20%)</dt><dd>${m(r.employeeCpf, "/mo")}</dd></div>
          <div class="tax-metric-box"><dt>Employer CPF (17%)</dt><dd>${m(r.employerCpf, "/mo")}</dd></div>
          <div class="tax-metric-box"><dt>Total Salary CPF</dt><dd>${m(r.employeeCpf + r.employerCpf, "/mo")}</dd></div>
          <div class="tax-metric-box"><dt>Take-home after Employee CPF</dt><dd>${m(r.afterCpf, "/mo")}</dd></div>
        </dl>
      </section>`;

    if (cpfRulesSlot) {
      cpfRulesSlot.innerHTML = `
        <header class="ember-page-header">
          <h1>CPF Milestones &amp; Age-55 Rules</h1>
          <span class="fin-target-pill">Age 55 → 65</span>
        </header>
        ${lessonHTML}
        ${cpfDetailsHTML}`;
    }

    renderStackedNetWorthSVG(
      $("#dash-networth-chart"),
      $("#dash-networth-tooltip"),
      $("#dash-networth-legend"),
      fire,
      dashChartBasis,
    );

    $("#plan-status").textContent =
      `Estimated CPF income ${money(s.payout)} a month from 65. Outside retirement pot ${money(s.privateTarget)}. Gap after CPF ${money(s.gap65)} a month.`;

    document.dispatchEvent(new Event("plan-rendered"));

    renderTrajectoryChart(
      currentTrajectory,
      chartMode,
      currentFirePlan,
      dashChartBasis,
    );
    renderPrintSheet({
      r,
      s,
      simulation,
      fire,
      bogle,
      tax,
      guide: simGuide,
      p,
      basis: dashChartBasis,
    });
  };

  const scheduleRender = () => {
    if (rafHandle != null) return;
    rafHandle = requestAnimationFrame(() => {
      rafHandle = null;
      render();
    });
  };

  const bucketIds = [
    "known-equities",
    "known-sg-dividends",
    "known-ssb-cash",
    "known-srs",
  ];
  const syncBucketsToTotal = () => {
    const sum = bucketIds.reduce(
      (acc, id) => acc + Math.max(0, Number($("#" + id)?.value || 0)),
      0,
    );
    const anyBucketSet = bucketIds.some(
      (id) => ($("#" + id)?.value || "").trim() !== "",
    );
    const val = anyBucketSet ? String(Math.round(sum * 100) / 100) : "";
    if ($("#known-savings")) $("#known-savings").value = val;
  };
  const clearBucketsOnDirectTotalEdit = () => {
    bucketIds.forEach((id) => {
      if ($("#" + id)) $("#" + id).value = "";
    });
  };

  Object.values(fields).forEach((id) => {
    const el = $("#" + id);
    if (el) {
      el.addEventListener("input", () => {
        if (id === "person-dob" && el.validity.badInput) return;
        if (bucketIds.includes(id)) {
          syncBucketsToTotal();
        } else if (id === "known-savings") {
          clearBucketsOnDirectTotalEdit();
        }
        render();
      });
      el.addEventListener("change", () => {
        render();
      });
    }
  });

  const applyPlanObject = (planObj) => {
    if (!planObj || typeof planObj !== "object")
      throw new Error("Invalid plan format.");
    Object.values(fields).forEach((id) => resetControl($("#" + id), true));
    for (const [key, id] of Object.entries(fields)) {
      const el = $("#" + id);
      if (!el || planObj[key] == null) continue;
      el.value = String(planObj[key]);
    }
    if (planObj.dob == null && planObj.age != null && $("#person-dob")) {
      const legacyAge = Number(planObj.age);
      if (Number.isFinite(legacyAge)) {
        $("#person-dob").value = RetirementModel.defaultDobForAge(legacyAge);
      }
    }
    if (
      planObj.savings == null &&
      bucketIds.some((id) => ($("#" + id)?.value || "").trim() !== "")
    ) {
      syncBucketsToTotal();
    }
  };

  const SG_DEFAULT_PLAN = {
    lifestyle: "cca",
    dob: DEFAULT_DOB,
    salary: 5500,
    retire: 65,
    oa: 0,
    sa: 0,
    ma: 0,
    equities: 35000,
    sgDividends: 5000,
    ssbCash: 20000,
    srs: 0,
    srsAge: 63,
    srsAnnual: 0,
    srsInvestedIn: "global",
    annualBonus: 0,
    existingReliefs: 1000,
    targetEquityPct: 80,
    sgSleevePct: 10,
    plan: "standard",
    returnRate: 0.04,
    inflationRate: 0.03,
    post55Work: false,
    housingMode: "all-oa",
    housingBalance: "",
    housingYears: 20,
    housingRate: 2.6,
    housingParties: 1,
  };

  const resetSgDefaults = () => {
    lastCustomSpend = "";
    applyPlanObject(SG_DEFAULT_PLAN);
    selected = "salary";
    learningTarget = "frs";
    render();
    if ($("#plan-status")) {
      $("#plan-status").textContent =
        "Reset to typical Singapore age-35 defaults.";
    }
  };

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-sg-reset]")) {
      resetSgDefaults();
      return;
    }
    const clampBtn = event.target.closest("[data-clamp-field]");
    if (clampBtn) {
      const fieldId = clampBtn.dataset.clampField;
      const clampVal = clampBtn.dataset.clampVal;
      const target = $("#" + fieldId);
      if (target && clampVal != null) {
        target.value = clampVal;
        if (fieldId === "known-savings") {
          clearBucketsOnDirectTotalEdit();
        } else if (bucketIds.includes(fieldId)) {
          syncBucketsToTotal();
        }
        render();
      }
      return;
    }
    const goalRetireBtn = event.target.closest("[data-goal-retire]");
    if (goalRetireBtn) {
      $("#known-retire").value = goalRetireBtn.dataset.goalRetire;
      if (
        $("#known-invest").value.trim() === "" &&
        Number(goalRetireBtn.dataset.goalInvest) > 0
      ) {
        $("#known-invest").value = goalRetireBtn.dataset.goalInvest;
      }
      render();
      return;
    }
    const goalPathBtn = event.target.closest("[data-goal-path]");
    if (goalPathBtn) {
      selected = goalPathBtn.dataset.goalPath;
      render();
      return;
    }
    const activityTabBtn = event.target.closest("[data-fin-activity]");
    if (activityTabBtn) {
      finActivityTab = activityTabBtn.dataset.finActivity || "coverage";
      render();
      return;
    }
    const lifePill = event.target.closest("#header-lifestyle-pill");
    const lifeMenu = $("#header-lifestyle-menu");
    if (lifePill && lifeMenu) {
      const nextOpen = lifeMenu.hidden;
      lifeMenu.hidden = !nextOpen;
      lifePill.setAttribute("aria-expanded", String(nextOpen));
      return;
    }
    const selectCustomBtn = event.target.closest("[data-select-custom]");
    if (selectCustomBtn) {
      if (lifeMenu) lifeMenu.hidden = true;
      $("#header-lifestyle-pill")?.setAttribute("aria-expanded", "false");
      const currentState = getCustomSpendState();
      if (!currentState.isCustom && lastCustomSpend) {
        $("#known-spend").value = lastCustomSpend;
        if ($("#qe-spend")) $("#qe-spend").value = lastCustomSpend;
        render();
        return;
      }
      lastQeInvoker = $("#header-lifestyle-pill") || selectCustomBtn;
      if ($("#qe-lifestyle")) $("#qe-lifestyle").dataset.pendingCustom = "true";
      syncQuickEditState(null, currentFirePlan, null);
      setQuickEditPanel("budget", false);
      const scroller = qeDialog?.querySelector(".settings-scroll-body");
      if (scroller) scroller.scrollTop = 0;
      if (qeDialog && !qeDialog.open) qeDialog.showModal();
      requestAnimationFrame(() => {
        $("#qe-spend")?.focus();
        $("#qe-spend")?.select();
      });
      render();
      return;
    }
    const switchLifeBtn = event.target.closest("[data-switch-lifestyle]");
    if (switchLifeBtn) {
      const nextVal = switchLifeBtn.dataset.switchLifestyle;
      if ($("#known-lifestyle") && nextVal) {
        const curCustom = getCustomSpendState();
        if (curCustom.isCustom) {
          lastCustomSpend = String(Math.round(curCustom.spend * 100) / 100);
        }
        delete $("#qe-lifestyle")?.dataset.pendingCustom;
        $("#known-lifestyle").value = nextVal;
        $("#known-spend").value = "";
        if ($("#qe-spend")) $("#qe-spend").value = "";
        if ($("#qe-lifestyle")) $("#qe-lifestyle").value = nextVal;
        if (nextVal === "cca" && Number($("#known-retire")?.value || 65) < 55) {
          $("#known-retire").value = "55";
          if ($("#qe-retire")) $("#qe-retire").value = "55";
        }
      }
      if (lifeMenu) lifeMenu.hidden = true;
      $("#header-lifestyle-pill")?.setAttribute("aria-expanded", "false");
      render();
      return;
    }
    if (
      lifeMenu &&
      !lifeMenu.hidden &&
      !event.target.closest("#header-lifestyle-wrap")
    ) {
      lifeMenu.hidden = true;
      $("#header-lifestyle-pill")?.setAttribute("aria-expanded", "false");
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const lifeMenu = $("#header-lifestyle-menu");
    const lifePill = $("#header-lifestyle-pill");
    if (lifeMenu && !lifeMenu.hidden) {
      const wasInside = lifeMenu.contains(document.activeElement);
      lifeMenu.hidden = true;
      lifePill?.setAttribute("aria-expanded", "false");
      if (wasInside) lifePill?.focus({ preventScroll: true });
    }
  });

  planRoot.addEventListener("input", (event) => {
    if (event.target.id === "bogle-target-slider") {
      const val = Number(event.target.value);
      $("#known-target-equity").value = String(val);
      scheduleRender();
    } else if (event.target.id === "bogle-sg-slider") {
      const val = Number(event.target.value);
      $("#known-sg-sleeve").value = String(val);
      scheduleRender();
    }
  });

  $("#sim-invest").addEventListener("input", () => {
    if (!$("#sim-invest").validity.valid) {
      setError(
        "Enter a non-negative monthly investment amount, without commas or dollar signs.",
      );
      return;
    }
    $("#known-invest").value = $("#sim-invest").value;
    render();
  });
  $("#savings-simulator").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-adjust]");
    if (!button) return;
    const input = $("#" + button.dataset.adjust);
    const current =
      input.value === "" ? Number(input.placeholder) : Number(input.value);
    input.value = String(
      Math.max(
        0,
        Math.round((current + Number(button.dataset.delta)) * 100) / 100,
      ),
    );
    if (input.id === "sim-invest") $("#known-invest").value = input.value;
    render();
  });
  $("#sim-use-target").addEventListener("click", () => {
    $("#known-cpf-extra").value = "";
    $("#known-invest").value = "";
    render();
  });
  const handleHousingModeSwitch = (modeVal) => {
    if (modeVal === "bank") {
      if (
        $("#known-housing-rate") &&
        ($("#known-housing-rate").value === "2.6" ||
          $("#known-housing-rate").value.trim() === "")
      ) {
        $("#known-housing-rate").value = lastBankLoanRate;
      }
      if ($("#qe-housing-rate") && $("#known-housing-rate")) {
        $("#qe-housing-rate").value = $("#known-housing-rate").value;
      }
    } else if (modeVal === "hdb") {
      if ($("#known-housing-rate")) $("#known-housing-rate").value = "2.6";
      if ($("#qe-housing-rate")) $("#qe-housing-rate").value = "2.6";
    }
    if (modeVal === "hdb" || modeVal === "bank") {
      if (
        $("#known-housing-years") &&
        $("#known-housing-years").value.trim() === ""
      ) {
        $("#known-housing-years").value = "20";
      }
      if (
        $("#known-housing-parties") &&
        $("#known-housing-parties").value.trim() === ""
      ) {
        $("#known-housing-parties").value = "1";
      }
    }
  };
  $("#known-housing-mode")?.addEventListener("change", (event) => {
    handleHousingModeSwitch(event.target.value);
    render();
  });
  $("#known-housing-rate")?.addEventListener("input", (event) => {
    if (
      $("#known-housing-mode")?.value === "bank" &&
      event.target.value.trim() !== ""
    ) {
      lastBankLoanRate = event.target.value.trim();
    }
  });

  $$("[data-chart-mode]").forEach((btn) =>
    btn.addEventListener("click", () => {
      chartMode = btn.dataset.chartMode;
      $$("[data-chart-mode]").forEach((other) => {
        const active = other === btn;
        other.setAttribute("aria-pressed", String(active));
        other.classList.toggle("is-active", active);
      });
      if (currentTrajectory)
        renderTrajectoryChart(
          currentTrajectory,
          chartMode,
          currentFirePlan,
          dashChartBasis,
        );
    }),
  );

  $("#print-plan-btn")?.addEventListener("click", () => window.print());
  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-print-trigger]")) {
      window.print();
    }
  });
  const scrollTopBtn = $("#scroll-top-btn");
  if (scrollTopBtn) {
    const syncScrollTop = () => {
      scrollTopBtn.hidden = window.scrollY < 100;
    };
    window.addEventListener("scroll", syncScrollTop, { passive: true });
    scrollTopBtn.addEventListener("click", () => {
      const reduced = window.matchMedia?.(
        "(prefers-reduced-motion: reduce)",
      )?.matches;
      window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    });
    syncScrollTop();
  }

  $("#reset-settings")?.addEventListener("click", () => {
    resetSgDefaults();
  });

  const qeDialog = $("#quick-edit-modal");
  const qeBindings = [
    ["qe-dob", "person-dob"],
    ["qe-retire", "known-retire"],
    ["qe-lifestyle", "known-lifestyle"],
    ["qe-spend", "known-spend"],
    ["qe-plan", "known-plan"],
    ["qe-salary", "person-salary"],
    ["qe-housing-mode", "known-housing-mode"],
    ["qe-housing-balance", "known-housing-balance"],
    ["qe-housing-years", "known-housing-years"],
    ["qe-housing-rate", "known-housing-rate"],
    ["qe-housing-parties", "known-housing-parties"],
    ["qe-housing", "known-housing"],
    ["qe-cpf-extra", "known-cpf-extra"],
    ["qe-invest", "known-invest"],
    ["qe-oa", "known-oa"],
    ["qe-sa", "known-sa"],
    ["qe-ma", "known-ma"],
    ["qe-equities", "known-equities"],
    ["qe-sg-dividends", "known-sg-dividends"],
    ["qe-ssb-cash", "known-ssb-cash"],
    ["qe-srs", "known-srs"],
  ];
  let lastQeInvoker = null;
  let activeQeTab = "goal";

  function getMinRetireAge() {
    const dobInfo = RetirementModel.computeAgeFromDob(
      $("#person-dob")?.value || "",
    );
    const curAge = dobInfo.valid ? dobInfo.age : 35;
    const lifeMin = $("#known-lifestyle")?.value === "cca" ? 55 : 40;
    return Math.max(lifeMin, curAge);
  }

  function syncQuickEditState(r = null, fire = null, simulation = null) {
    if (!qeDialog) return;
    const minRetire = getMinRetireAge();
    const qeRetire = $("#qe-retire");
    if (qeRetire) qeRetire.min = String(minRetire);

    const customState = getCustomSpendState(r?.lifestyle);
    for (const [qeId, srcId] of qeBindings) {
      if (qeId === "qe-lifestyle") continue;
      const qeEl = $("#" + qeId);
      const srcEl = $("#" + srcId);
      if (!qeEl || !srcEl) continue;
      if (document.activeElement !== qeEl) {
        qeEl.value = srcEl.value;
      }
    }

    const qeLifestyleEl = $("#qe-lifestyle");
    if (qeLifestyleEl) {
      const customOpt = qeLifestyleEl.querySelector('option[value="custom"]');
      if (customOpt) {
        customOpt.textContent = customState.isCustom
          ? `Custom (${money(customState.spend)}/mo)`
          : lastCustomSpend
            ? `Custom (${money(Number(lastCustomSpend))}/mo saved)`
            : "Custom";
      }
      if (document.activeElement !== qeLifestyleEl) {
        if (customState.isCustom) {
          qeLifestyleEl.value = "custom";
        } else if (qeLifestyleEl.dataset.pendingCustom === "true") {
          qeLifestyleEl.value = "custom";
        } else {
          qeLifestyleEl.value = customState.lifestyleKey;
        }
      }
    }

    const curRetire = Number($("#known-retire")?.value || 65);
    $$("[data-qe-retire-delta]").forEach((btn) => {
      const delta = Number(btn.dataset.qeRetireDelta);
      btn.disabled =
        (delta < 0 && curRetire <= minRetire) || (delta > 0 && curRetire >= 80);
    });

    const lifestyleVal = customState.lifestyleKey;
    const defaultBudget = customState.presetBudget;
    const qeSpend = $("#qe-spend");
    if (qeSpend) qeSpend.placeholder = String(defaultBudget);
    const qeResetSpend = $("#qe-reset-spend");
    if (qeResetSpend) {
      qeResetSpend.hidden = !customState.isCustom;
    }
    const qeLifestyleHint = $("#qe-lifestyle-hint");
    if (qeLifestyleHint) {
      qeLifestyleHint.textContent = customState.isCustom
        ? `Using custom budget (${money(customState.spend)}/mo · ${lifestyleVal === "cca" ? "CCA care rules, from age 55" : "Home + Helper care rules, from age 40"}).`
        : lifestyleVal === "cca"
          ? "CCA assumes moving in at retirement, from age 55."
          : "Assumes a paid-up flat with live-in helper, from age 40.";
    }

    if (r && simulation) {
      if ($("#qe-cpf-extra")) {
        $("#qe-cpf-extra").placeholder = String(Math.ceil(simulation.cpfExtra));
        $("#qe-cpf-extra").disabled = r.retiringNow;
      }
      if ($("#qe-invest")) {
        $("#qe-invest").placeholder = String(Math.ceil(simulation.invest));
        $("#qe-invest").disabled = r.retiringNow;
      }
    }

    if (r && fire) {
      const fn = fire.fireNumber;
      const readyBtn = $("#qe-use-ready-age");
      if (readyBtn) {
        const showReady =
          fn.projectedFireAge != null &&
          fn.projectedFireAge !== fire.retire &&
          fn.projectedFireAge >= minRetire &&
          fn.projectedFireAge <= 80;
        readyBtn.hidden = !showReady;
        if (showReady) {
          readyBtn.dataset.readyAge = String(fn.projectedFireAge);
          readyBtn.textContent = `Use ready age ${fn.projectedFireAge}`;
        }
      }
      const breakdownEl = $("#qe-balances-breakdown");
      if (breakdownEl) {
        const startPt = fire.points[0];
        const cpfTot = startPt?.cpfTotal ?? 0;
        const outTot = startPt?.totalOutside ?? 0;
        const oaV = Math.max(0, Number($("#known-oa")?.value || 0));
        const saV = Math.max(0, Number($("#known-sa")?.value || 0));
        const maV = Math.max(0, Number($("#known-ma")?.value || 0));
        const eqV = Math.max(0, Number($("#known-equities")?.value || 0));
        const sgV = Math.max(0, Number($("#known-sg-dividends")?.value || 0));
        const ssbV = Math.max(0, Number($("#known-ssb-cash")?.value || 0));
        const srsV = Math.max(0, Number($("#known-srs")?.value || 0));
        const bucketSum = eqV + sgV + ssbV + srsV;
        const outDetail =
          bucketSum > 0
            ? `Eq ${m(eqV)} · SG ${m(sgV)} · Cash ${m(ssbV)}${srsV > 0 ? ` · SRS ${m(srsV)}` : ""}`
            : `Direct total ${m(outTot)}`;
        breakdownEl.innerHTML = `
          <div class="qe-bd-top">
            <span>Total Current Assets</span>
            <strong>${m(cpfTot + outTot)}</strong>
          </div>
          <div class="qe-bd-rows">
            <div><span>CPF (${m(cpfTot)})</span><small>OA ${m(oaV)} · SA ${m(saV)} · MA ${m(maV)}</small></div>
            <div><span>Outside (${m(outTot)})</span><small>${outDetail}</small></div>
          </div>`;
      }
      const qeSummary = $("#qe-live-summary");
      if (qeSummary) {
        const funded =
          fn.pctFunded >= 100 && fn.fullyFundedTo95
            ? "On Track"
            : `${fn.pctFunded}% Funded`;
        const horizon = fn.fullyFundedTo95
          ? "Sustained to 95+"
          : `Funded to ${Math.floor(fn.depletionAge ?? 90)}`;
        qeSummary.textContent = `Age ${r.age} → ${r.retire} · ${funded} · ${horizon}`;
      }
    }
  }

  const qePanelMeta = {
    age: { title: "Date of Birth & Age", focus: "#qe-dob" },
    goal: { title: "Target Retirement Age", focus: "#qe-retire" },
    budget: { title: "Living Budget & CPF LIFE", focus: "#qe-lifestyle" },
    income: { title: "Monthly Savings & Salary", focus: "#qe-salary" },
    balances: { title: "CPF & Investment Balances", focus: "#qe-oa" },
  };

  function setQuickEditPanel(panelKey, focusInput = false) {
    const validPanels = Object.keys(qePanelMeta);
    activeQeTab = validPanels.includes(panelKey) ? panelKey : "goal";
    qeDialog.dataset.qePanel = activeQeTab;
    const titleEl = $("#quick-edit-title");
    if (titleEl) titleEl.textContent = qePanelMeta[activeQeTab].title;
    validPanels.forEach((key) => {
      const panel = $(`#qe-panel-${key}`);
      if (panel) panel.hidden = key !== activeQeTab;
    });
    if (focusInput) {
      requestAnimationFrame(() => $(qePanelMeta[activeQeTab].focus)?.focus());
    }
  }

  if (qeDialog) {
    document.addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-quick-edit]");
      if (!trigger) return;
      event.preventDefault();
      const lifeMenu = $("#header-lifestyle-menu");
      if (lifeMenu && !lifeMenu.hidden) {
        lifeMenu.hidden = true;
        $("#header-lifestyle-pill")?.setAttribute("aria-expanded", "false");
      }
      lastQeInvoker = lifeMenu?.contains(trigger)
        ? $("#header-lifestyle-pill") || trigger
        : trigger;
      syncQuickEditState(null, currentFirePlan, null);
      setQuickEditPanel(trigger.dataset.quickEdit || "goal", true);
      const scroller = qeDialog.querySelector(".settings-scroll-body");
      if (scroller) scroller.scrollTop = 0;
      if (!qeDialog.open) qeDialog.showModal();
      render();
    });

    let qeBackdropPointerDown = false;
    qeDialog.addEventListener("pointerdown", (event) => {
      const rect = qeDialog.getBoundingClientRect();
      qeBackdropPointerDown =
        event.target === qeDialog &&
        (event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom);
    });

    qeDialog.addEventListener("click", (event) => {
      const deltaBtn = event.target.closest("[data-qe-retire-delta]");
      if (deltaBtn) {
        const minRetire = getMinRetireAge();
        const cur = Number($("#known-retire")?.value || 65);
        const next = Math.min(
          80,
          Math.max(
            minRetire,
            Math.round(cur + Number(deltaBtn.dataset.qeRetireDelta)),
          ),
        );
        $("#known-retire").value = String(next);
        if ($("#qe-retire")) $("#qe-retire").value = String(next);
        render();
        return;
      }
      if (event.target.closest("#qe-use-ready-age")) {
        const age = $("#qe-use-ready-age")?.dataset.readyAge;
        if (age) {
          $("#known-retire").value = age;
          if ($("#qe-retire")) $("#qe-retire").value = age;
          render();
        }
        return;
      }
      if (event.target.closest("#qe-reset-spend")) {
        const curCustom = getCustomSpendState();
        if (curCustom.isCustom) {
          lastCustomSpend = String(Math.round(curCustom.spend * 100) / 100);
        }
        $("#known-spend").value = "";
        if ($("#qe-spend")) $("#qe-spend").value = "";
        render();
        return;
      }
      if (event.target.closest("#qe-open-full-settings")) {
        qeDialog.dataset.flowNavigation = "true";
        qeDialog.close();
        document.querySelector("[data-open-profile]")?.click();
        return;
      }
      if (event.target.closest("[data-qe-close]")) {
        qeDialog.close();
        return;
      }
      const shouldCloseBackdrop = qeBackdropPointerDown;
      qeBackdropPointerDown = false;
      const rect = qeDialog.getBoundingClientRect();
      if (
        shouldCloseBackdrop &&
        event.target === qeDialog &&
        (event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom)
      ) {
        qeDialog.close();
      }
    });

    qeBindings.forEach(([qeId, srcId]) => {
      const qeEl = $("#" + qeId);
      const srcEl = $("#" + srcId);
      if (!qeEl || !srcEl) return;
      const syncBack = () => {
        if (qeId === "qe-lifestyle") {
          if (qeEl.value === "custom") {
            if (lastCustomSpend && $("#known-spend").value.trim() === "") {
              $("#known-spend").value = lastCustomSpend;
              if ($("#qe-spend")) $("#qe-spend").value = lastCustomSpend;
              delete qeEl.dataset.pendingCustom;
              render();
            } else {
              qeEl.dataset.pendingCustom = "true";
              syncQuickEditState(null, currentFirePlan, null);
            }
            requestAnimationFrame(() => {
              $("#qe-spend")?.focus();
              $("#qe-spend")?.select();
            });
            return;
          }
          const curCustom = getCustomSpendState();
          if (curCustom.isCustom) {
            lastCustomSpend = String(Math.round(curCustom.spend * 100) / 100);
          }
          delete qeEl.dataset.pendingCustom;
          srcEl.value = qeEl.value;
          $("#known-spend").value = "";
          if ($("#qe-spend")) $("#qe-spend").value = "";
          if (
            qeEl.value === "cca" &&
            Number($("#known-retire")?.value || 65) < 55
          ) {
            $("#known-retire").value = "55";
            if ($("#qe-retire")) $("#qe-retire").value = "55";
          }
          render();
          return;
        }
        if (qeId === "qe-dob" && qeEl.validity.badInput) {
          return;
        }
        if (qeId === "qe-spend" && qeEl.value.trim() !== "") {
          delete $("#qe-lifestyle")?.dataset.pendingCustom;
        }
        srcEl.value = qeEl.value;
        if (qeId === "qe-housing-mode") {
          handleHousingModeSwitch(qeEl.value);
        }
        if (
          qeId === "qe-housing-rate" &&
          $("#known-housing-mode")?.value === "bank" &&
          qeEl.value.trim() !== ""
        ) {
          lastBankLoanRate = qeEl.value.trim();
        }
        if (qeId === "qe-dob") {
          const dobInfo = RetirementModel.computeAgeFromDob(qeEl.value);
          if (
            dobInfo.valid &&
            Number($("#known-retire")?.value || 65) < getMinRetireAge()
          ) {
            const minR = String(getMinRetireAge());
            $("#known-retire").value = minR;
            if ($("#qe-retire")) $("#qe-retire").value = minR;
          }
        }
        if (bucketIds.includes(srcId)) {
          syncBucketsToTotal();
        }
        render();
      };
      qeEl.addEventListener("input", syncBack);
      qeEl.addEventListener("change", syncBack);
    });

    qeDialog.addEventListener("close", () => {
      delete $("#qe-lifestyle")?.dataset.pendingCustom;
      let corrected = false;
      const minRetire = getMinRetireAge();
      for (const [qeId, srcId] of qeBindings) {
        if (
          qeId === "qe-lifestyle" ||
          qeId === "qe-plan" ||
          qeId === "qe-housing-mode" ||
          qeId === "qe-housing-parties"
        )
          continue;
        const qeEl = $("#" + qeId);
        const srcEl = $("#" + srcId);
        if (!qeEl || !srcEl) continue;
        const raw = srcEl.value.trim();
        if (srcId === "person-dob") {
          const dobInfo = RetirementModel.computeAgeFromDob(raw);
          if (srcEl.validity.badInput || !dobInfo.valid) {
            srcEl.value = lastValidFieldValues[srcId] || DEFAULT_DOB;
            qeEl.value = srcEl.value;
            corrected = true;
          }
          continue;
        }
        if (srcEl.validity.badInput) {
          srcEl.value = lastValidFieldValues[srcId] ?? srcEl.defaultValue ?? "";
          qeEl.value = srcEl.value;
          corrected = true;
        } else if (srcId === "person-salary" && raw === "") {
          srcEl.value = lastValidFieldValues[srcId] || "5500";
          qeEl.value = srcEl.value;
          corrected = true;
        } else if (raw !== "" && !srcEl.validity.valid) {
          const minV =
            srcId === "known-retire" ? minRetire : Number(srcEl.min || 0);
          const maxV = srcEl.max !== "" ? Number(srcEl.max) : Infinity;
          let clamped = Math.min(maxV, Math.max(minV, Number(raw)));
          if (srcEl.step === "1") clamped = Math.round(clamped);
          srcEl.value = String(clamped);
          qeEl.value = srcEl.value;
          corrected = true;
        }
      }
      if (corrected) {
        syncBucketsToTotal();
        render();
      }
      if (qeDialog.dataset.flowNavigation) {
        delete qeDialog.dataset.flowNavigation;
        return;
      }
      if (lastQeInvoker?.isConnected) {
        lastQeInvoker.focus({ preventScroll: true });
      }
    });
  }

  if (
    !($("#known-savings")?.value || "").trim() &&
    bucketIds.some((id) => ($("#" + id)?.value || "").trim() !== "")
  ) {
    syncBucketsToTotal();
  }
  render();
}

function setupSettings() {
  const dialog = $("#plan-settings");
  let lastInvoker = null;

  document.addEventListener("click", (event) => {
    const button = event.target.closest('button[commandfor="plan-settings"]');
    if (!button) return;
    const command = button.getAttribute("command");
    if (command === "show-modal") {
      lastInvoker = button;
      const live = $("#settings-live-summary");
      if (live) live.textContent = live.dataset.budget || "";
      const scroller = dialog.querySelector(".settings-scroll-body");
      if (scroller) scroller.scrollTop = 0;
    }
    if (!("commandForElement" in HTMLButtonElement.prototype)) {
      event.preventDefault();
      if (command === "show-modal") dialog.showModal();
      else dialog.close();
    }
  });
  dialog.addEventListener("close", () => {
    if (dialog.dataset.flowNavigation) {
      delete dialog.dataset.flowNavigation;
      return;
    }
    if (lastInvoker?.isConnected) lastInvoker.focus({ preventScroll: true });
    else $(".settings-header-button").focus({ preventScroll: true });
  });
  let psBackdropPointerDown = false;
  dialog.addEventListener("pointerdown", (event) => {
    const r = dialog.getBoundingClientRect();
    psBackdropPointerDown =
      event.target === dialog &&
      (event.clientX < r.left ||
        event.clientX > r.right ||
        event.clientY < r.top ||
        event.clientY > r.bottom);
  });
  dialog.addEventListener("click", (event) => {
    const shouldCloseBackdrop = psBackdropPointerDown;
    psBackdropPointerDown = false;
    const r = dialog.getBoundingClientRect();
    if (
      shouldCloseBackdrop &&
      event.target === dialog &&
      (event.clientX < r.left ||
        event.clientX > r.right ||
        event.clientY < r.top ||
        event.clientY > r.bottom)
    )
      dialog.close();
  });
  $$('button[command="show-modal"]').forEach((button) => {
    button.setAttribute("aria-haspopup", "dialog");
  });
}

function setupDeepLinks() {
  const revealHash = (hash) => {
    if (!hash || hash.includes("=")) return;
    const target = document.getElementById(hash.slice(1));
    if (!target) return;
    const details = target.matches("details")
      ? target
      : target.querySelector("details");
    if (details) details.open = true;
    let ancestor = target.closest("details");
    while (ancestor) {
      ancestor.open = true;
      ancestor = ancestor.parentElement.closest("details");
    }
  };
  document.addEventListener("click", (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (link) revealHash(link.getAttribute("href"));
  });
  window.addEventListener("hashchange", () => revealHash(location.hash));
  revealHash(location.hash);
}

function setupGuidedFlow() {
  const TABS = ["overview", "trajectory", "allocator", "tax", "cpf-rules"];
  let activeTab = "overview";
  let profileOpen = false;
  const form = $("#quick-form");
  const lifestyle = $("#known-lifestyle");

  form.addEventListener(
    "invalid",
    (event) => {
      let parent = event.target.parentElement;
      while (parent && parent !== form) {
        if (parent.matches("details")) parent.open = true;
        parent = parent.parentElement;
      }
    },
    true,
  );
  $("#use-preset-budget")?.addEventListener("click", () => {
    $("#known-spend").value = "";
    if ($("#qe-spend")) $("#qe-spend").value = "";
    $("#known-spend").dispatchEvent(new Event("input", { bubbles: true }));
    $("#known-spend").focus({ preventScroll: true });
  });
  lifestyle?.addEventListener("change", (event) => {
    if (!event.isTrusted) return;
    delete $("#qe-lifestyle")?.dataset.pendingCustom;
    $("#known-spend").value = "";
    if ($("#qe-spend")) $("#qe-spend").value = "";
    if (
      lifestyle.value === "cca" &&
      Number($("#known-retire")?.value || 65) < 55
    ) {
      $("#known-retire").value = "55";
      if ($("#qe-retire")) $("#qe-retire").value = "55";
    }
    lifestyle.dispatchEvent(new Event("input", { bubbles: true }));
  });

  const applyViewState = (focus = true, push = false) => {
    document.body.dataset.view = profileOpen ? "profile" : activeTab;
    $("#top").hidden = !profileOpen;
    $("#retirement-plan").hidden = profileOpen;

    TABS.forEach((tab) => {
      const panel = $(`#tab-panel-${tab}`);
      if (panel) panel.hidden = profileOpen || tab !== activeTab;
    });

    $$("[data-tab]").forEach((btn) => {
      const inTaxGroup =
        btn.dataset.tabGroup === "tax" &&
        ["tax", "cpf-rules"].includes(activeTab);
      const isSelected =
        !profileOpen && (btn.dataset.tab === activeTab || inTaxGroup);
      btn.classList.toggle("is-active", isSelected);
      btn.setAttribute("aria-selected", String(isSelected));
      if (isSelected) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    });

    const sidebarSettingsBtn = $(".sidebar-settings-btn");
    if (sidebarSettingsBtn) {
      sidebarSettingsBtn.classList.toggle("is-active", profileOpen);
      sidebarSettingsBtn.setAttribute("aria-expanded", String(profileOpen));
    }

    if (push) {
      history.pushState(
        { ...history.state, plannerTab: activeTab, profileOpen },
        "",
        location.href,
      );
    }

    if (focus) {
      const targetEl = profileOpen
        ? $("#hero-title")
        : $(`#tab-panel-${activeTab}`);
      targetEl?.setAttribute("tabindex", "-1");
      targetEl?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  };

  const navigateTo = (
    { tab = activeTab, profile = false } = {},
    focus = true,
  ) => {
    if ($("#plan-settings").open)
      $("#plan-settings").dataset.flowNavigation = "true";
    $("#plan-settings").close();
    if ($("#quick-edit-modal")?.open) {
      $("#quick-edit-modal").dataset.flowNavigation = "true";
      $("#quick-edit-modal").close();
    }
    activeTab = TABS.includes(tab) ? tab : "overview";
    profileOpen = profile;
    applyViewState(focus, true);
  };

  // Unified click handlers for tabs, deep links inside cards, and Profile Editor
  document.addEventListener("click", (event) => {
    const tabBtn = event.target.closest("button[data-tab]");
    if (tabBtn) {
      event.preventDefault();
      navigateTo({ tab: tabBtn.dataset.tab, profile: false });
      return;
    }

    const goTabBtn = event.target.closest("[data-go-tab]");
    if (goTabBtn) {
      event.preventDefault();
      navigateTo({ tab: goTabBtn.dataset.goTab, profile: false });
      return;
    }

    if (event.target.closest("[data-open-profile]")) {
      event.preventDefault();
      navigateTo({ profile: true });
      return;
    }

    if (event.target.closest("[data-close-profile]")) {
      event.preventDefault();
      navigateTo({ tab: activeTab, profile: false });
      return;
    }

    const stepBtn = event.target.closest("button[data-step]");
    if (!stepBtn) return;
    event.preventDefault();
    const stepNum = Number(stepBtn.dataset.step);
    if (stepNum === 1) {
      navigateTo({ profile: true });
      if (stepBtn.dataset.reveal === "cpf") {
        $("#known-oa")?.focus({ preventScroll: true });
      }
    } else if (stepNum === 3) {
      navigateTo({ tab: "trajectory", profile: false });
    } else {
      navigateTo({ tab: "overview", profile: false });
    }
  });

  const appShell = $("#app-shell");
  const sidebarToggle = $("#sidebar-collapse-toggle");
  const applySidebarState = (collapsed) => {
    if (!appShell || !sidebarToggle) return;
    appShell.classList.toggle("is-sidebar-collapsed", collapsed);
    sidebarToggle.setAttribute("aria-expanded", String(!collapsed));
    sidebarToggle.setAttribute(
      "aria-label",
      collapsed ? "Expand sidebar" : "Collapse sidebar",
    );
    sidebarToggle.setAttribute(
      "title",
      collapsed ? "Expand sidebar" : "Collapse sidebar",
    );
  };
  try {
    applySidebarState(localStorage.getItem("rs_sidebar_collapsed") === "true");
  } catch (_) {}
  sidebarToggle?.addEventListener("click", () => {
    const next = !appShell?.classList.contains("is-sidebar-collapsed");
    applySidebarState(next);
    try {
      localStorage.setItem("rs_sidebar_collapsed", String(next));
    } catch (_) {}
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    navigateTo({ tab: "overview", profile: false });
  });

  document.addEventListener("plan-rendered", () =>
    applyViewState(false, false),
  );

  window.addEventListener("popstate", (event) => {
    activeTab = TABS.includes(event.state?.plannerTab)
      ? event.state.plannerTab
      : "overview";
    profileOpen = Boolean(event.state?.profileOpen);
    applyViewState(false, false);
  });

  $$(".brand").forEach((b) =>
    b.addEventListener("click", (event) => {
      event.preventDefault();
      navigateTo({ tab: "overview", profile: false });
    }),
  );

  const openRoute = () => {
    const id = location.hash.slice(1);
    if (!id || id.includes("=")) return;
    if (id === "top") {
      profileOpen = true;
      applyViewState(false, false);
      return;
    }
    if (id === "retirement-plan" || id === "tab-panel-overview") {
      profileOpen = false;
      activeTab = "overview";
      applyViewState(false, false);
      return;
    }
    if (
      [
        "savings-simulator",
        "funding-steps",
        "trajectory-section",
        "tab-panel-trajectory",
      ].includes(id)
    ) {
      profileOpen = false;
      activeTab = "trajectory";
      applyViewState(false, false);
      const targetEl = $(
        "#" + (id === "funding-steps" ? "savings-simulator" : id),
      );
      requestAnimationFrame(() => targetEl?.scrollIntoView());
      return;
    }
    if (["boglehead-allocator", "tab-panel-allocator"].includes(id)) {
      profileOpen = false;
      activeTab = "allocator";
      applyViewState(false, false);
      const targetEl = $("#" + id);
      requestAnimationFrame(() => targetEl?.scrollIntoView());
      return;
    }
    if (
      [
        "tax-sweet-spot",
        "salary-cpf-caps",
        "tab-panel-tax",
        "cpf-goal-guide",
        "cpf-position-details",
        "tab-panel-cpf-rules",
      ].includes(id)
    ) {
      profileOpen = false;
      activeTab = [
        "cpf-goal-guide",
        "cpf-position-details",
        "tab-panel-cpf-rules",
      ].includes(id)
        ? "cpf-rules"
        : "tax";
      applyViewState(false, false);
      const targetEl = $("#" + id);
      requestAnimationFrame(() => targetEl?.scrollIntoView());
    }
  };
  window.addEventListener("hashchange", openRoute);
  applyViewState(false, false);
  openRoute();
}

// Supplemental field guidance stays available without filling every form row.
function setupFieldHelp() {
  const nativePopover = "popover" in HTMLElement.prototype;
  const essential = {
    "known-cpf-extra": "Extra saving above salary CPF.",
    "sim-invest": "Separate from CPF savings.",
  };
  const closeHelp = () =>
    $$(".field-help-panel:popover-open").forEach((panel) =>
      panel.hidePopover(),
    );
  $$(".field").forEach((field) => {
    const label = field.querySelector(":scope > label");
    const help = field.querySelector(":scope > small");
    const input = label && document.getElementById(label.htmlFor);
    if (!input || !help) return;
    const panel = document.createElement("div");
    panel.id = `${input.id}-more-info`;
    panel.className = "field-help-panel";
    panel.append(help);
    const title = label.textContent.replace(/\s+/g, " ").trim();
    const row = document.createElement("div");
    row.className = "field-label";
    label.before(row);
    row.append(label);
    if (nativePopover) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "field-help-trigger";
      button.setAttribute("popovertarget", panel.id);
      button.setAttribute("aria-label", `More about ${title}`);
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-controls", panel.id);
      button.innerHTML =
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 10.5v6M12 7v1"/></svg>';
      panel.setAttribute("popover", "auto");
      panel.setAttribute("role", "tooltip");
      panel.addEventListener("toggle", (event) =>
        button.setAttribute("aria-expanded", String(event.newState === "open")),
      );
      row.append(button, panel);
    } else {
      const details = document.createElement("details");
      details.className = "field-help-fallback";
      const summary = document.createElement("summary");
      summary.textContent = "More info";
      summary.setAttribute("aria-label", `More about ${title}`);
      details.append(summary, panel);
      field.append(details);
    }
    const describedBy = (input.getAttribute("aria-describedby") || "")
      .split(/\s+/)
      .filter((id) => id && id !== help.id);
    if (essential[input.id]) {
      const hint = document.createElement("small");
      hint.className = "field-essential";
      hint.id = `${input.id}-essential`;
      hint.textContent = essential[input.id];
      field.append(hint);
      describedBy.push(hint.id);
    }
    if (describedBy.length)
      input.setAttribute("aria-describedby", describedBy.join(" "));
    else input.removeAttribute("aria-describedby");
  });
  if (nativePopover) {
    document.addEventListener("click", (event) => {
      if (event.target.closest("button[data-step], .brand")) closeHelp();
    });
    $("#plan-settings").addEventListener("close", closeHelp);
    window.addEventListener("popstate", closeHelp);
  }
}

function setupEmberRingsInteractivity() {
  let lockedIdx = null;
  const applyRingState = (card, activeIdx) => {
    if (!card) return;
    const wrap = card.querySelector(".ember-rings-wrap");
    const centerStrong = card.querySelector(".ember-rings-center strong");
    const centerSpan = card.querySelector(".ember-rings-center span");
    if (!wrap || !centerStrong || !centerSpan) return;
    const hasActive = activeIdx != null && activeIdx !== "";
    card.classList.toggle("has-focused-ring", hasActive);
    card.querySelectorAll(".ember-ring-arc").forEach((arc) => {
      arc.classList.toggle(
        "is-active",
        arc.dataset.ringIdx === String(activeIdx),
      );
    });
    card.querySelectorAll(".ember-ring-btn").forEach((btn) => {
      const isFocused = btn.dataset.ringIdx === String(activeIdx);
      btn.classList.toggle("is-active", isFocused);
      btn.setAttribute(
        "aria-pressed",
        String(lockedIdx === btn.dataset.ringIdx),
      );
    });
    if (hasActive) {
      const src =
        card.querySelector(`.ember-ring-btn[data-ring-idx="${activeIdx}"]`) ||
        card.querySelector(`.ember-ring-arc[data-ring-idx="${activeIdx}"]`);
      if (src) {
        centerStrong.textContent =
          src.dataset.ringPct || wrap.dataset.defaultPct;
        centerSpan.textContent = src.dataset.ringSub || wrap.dataset.defaultSub;
      }
    } else {
      centerStrong.textContent = wrap.dataset.defaultPct || "";
      centerSpan.textContent = wrap.dataset.defaultSub || "";
    }
  };
  document.addEventListener("plan-rendered", () => {
    lockedIdx = null;
  });
  document.addEventListener("mouseover", (e) => {
    const target = e.target.closest?.(".ember-ring-btn, .ember-ring-arc");
    if (!target) return;
    applyRingState(target.closest(".ember-rings-card"), target.dataset.ringIdx);
  });
  document.addEventListener("mouseout", (e) => {
    const card = e.target.closest?.(".ember-rings-card");
    if (!card) return;
    const next = e.relatedTarget?.closest?.(".ember-ring-btn, .ember-ring-arc");
    if (!next || next.closest(".ember-rings-card") !== card) {
      applyRingState(card, lockedIdx);
    }
  });
  document.addEventListener("click", (e) => {
    const target = e.target.closest?.(".ember-ring-btn, .ember-ring-arc");
    if (!target) return;
    const card = target.closest(".ember-rings-card");
    const idx = target.dataset.ringIdx;
    lockedIdx = lockedIdx === idx ? null : idx;
    applyRingState(card, lockedIdx);
  });
}

function setupServiceWorkerUpdates() {
  if (!("serviceWorker" in navigator)) return;
  const updateBtn = $("#app-update-btn");
  const pageRev =
    document.querySelector('meta[name="app-revision"]')?.content || "dev";
  const hadController = Boolean(navigator.serviceWorker.controller);
  let lastCheckAt = 0;

  const revealUpdate = () => {
    if (updateBtn) updateBtn.hidden = false;
  };

  if (updateBtn) {
    updateBtn.addEventListener("click", () => {
      window.location.reload();
    });
  }

  const verifyRevision = (worker) => {
    if (!worker || pageRev === "dev" || typeof MessageChannel === "undefined")
      return;
    try {
      const ch = new MessageChannel();
      ch.port1.onmessage = (event) => {
        const swRev = String(event.data?.cacheVersion || "").replace(
          "retirement-shield-",
          "",
        );
        if (swRev && swRev !== pageRev) revealUpdate();
      };
      worker.postMessage({ type: "GET_VERSION" }, [ch.port2]);
    } catch {
      // Ignore postMessage failure on torn-down workers
    }
  };

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hadController) revealUpdate();
    verifyRevision(navigator.serviceWorker.controller);
  });

  navigator.serviceWorker
    .register("sw.js", { updateViaCache: "none" })
    .then((reg) => {
      verifyRevision(navigator.serviceWorker.controller || reg.active);
      if (reg.waiting && navigator.serviceWorker.controller) revealUpdate();
      reg.addEventListener("updatefound", () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (
            installing.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            revealUpdate();
          }
        });
      });

      const checkForUpdate = () => {
        if (!navigator.onLine) return;
        const now = Date.now();
        if (now - lastCheckAt < 120_000) return;
        lastCheckAt = now;
        reg.update().catch(() => {});
        verifyRevision(navigator.serviceWorker.controller || reg.active);
      };

      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") checkForUpdate();
      });
      window.addEventListener("online", checkForUpdate);
      window.addEventListener("pageshow", (event) => {
        if (event.persisted) checkForUpdate();
      });
    })
    .catch(() => {});
}

setupEmberRingsInteractivity();
setupServiceWorkerUpdates();

setupSimplePlan();
setupSettings();
setupDeepLinks();
setupGuidedFlow();
setupFieldHelp();
