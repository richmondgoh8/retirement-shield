import {
  $,
  m,
  compactMoney,
  svgCompactMoney,
  svgMoney,
  buildSmoothSpline,
  niceAxis,
} from "./format.js";

let trajectoryInspectedAge = null;
let onTrajectoryInspectAge = null;

function throttleRaf(fn) {
  let rafId = null;
  let lastEvent = null;
  const wrapped = (event) => {
    lastEvent = event;
    if (rafId != null) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      const ev = lastEvent;
      lastEvent = null;
      if (ev) fn(ev);
    });
  };
  wrapped.cancel = () => {
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    lastEvent = null;
  };
  return wrapped;
}

function buildAxisMilestonesSVG({
  minAge,
  maxAge,
  dX,
  padL,
  padR,
  W,
  H,
  padB,
  retireAge,
  srsAge = null,
  showSrs = false,
  rowYs = [18, 34, 50],
  compactPrint = false,
  saLabel = "55 SA → RA",
  saStyle = { color: "#0F766E", bg: "#F0FDFA", border: "#99F6E4" },
  srsLabelSuffix = "SRS Draw",
  includeAge55AtMin = false,
}) {
  const raw = [];
  if ((includeAge55AtMin ? minAge <= 55 : minAge < 55) && maxAge >= 55) {
    raw.push({
      age: 55,
      label: saLabel,
      color: saStyle.color,
      bg: saStyle.bg,
      border: saStyle.border,
    });
  }
  if (retireAge >= minAge && retireAge <= maxAge) {
    raw.push({
      age: retireAge,
      label: `Retire ${retireAge}`,
      color: "#BE185D",
      bg: "#FDF2F8",
      border: "#FBCFE8",
    });
  }
  if (showSrs && srsAge != null && srsAge >= minAge && srsAge <= maxAge) {
    raw.push({
      age: srsAge,
      label: `${srsAge} ${srsLabelSuffix}`,
      color: "#6D28D9",
      bg: "#F5F3FF",
      border: "#DDD6FE",
    });
  }
  if (65 >= minAge && 65 <= maxAge) {
    raw.push({
      age: 65,
      label: "65 CPF LIFE",
      color: "#047857",
      bg: "#ECFDF5",
      border: "#A7F3D0",
    });
  }
  raw.sort((a, b) => a.age - b.age);
  const merged = [];
  for (const item of raw) {
    const ex = merged.find((mItem) => mItem.age === item.age);
    if (ex) {
      if (item.age === 65 && ex.label.startsWith("Retire")) {
        ex.label = "65 Retire · CPF LIFE";
        ex.color = "#BE185D";
        ex.bg = "#FDF2F8";
        ex.border = "#FBCFE8";
      } else if (ex.label.startsWith("Retire")) {
        ex.label = `${item.age} Retire · ${item.label.replace(/^\d+\s*/, "")}`;
      } else {
        ex.label = `${ex.label} · ${item.label.replace(/^\d+\s*/, "")}`;
      }
    } else {
      merged.push({ ...item });
    }
  }
  const rowBoxes = rowYs.map(() => []);
  const charW = compactPrint ? 6.8 : 6.1;
  const pillH = compactPrint ? 17 : 16;
  const pillYOffset = compactPrint ? 12 : 11.5;
  const fontSize = compactPrint ? 11.5 : 10;
  return merged
    .map((mItem) => {
      const x = dX(mItem.age);
      const anchor =
        x < padL + 54 ? "start" : x > W - padR - 54 ? "end" : "middle";
      const pillW = Math.max(54, mItem.label.length * charW + 14);
      const x1 =
        anchor === "start" ? x : anchor === "end" ? x - pillW : x - pillW / 2;
      const x2 = x1 + pillW;
      let chosenRow = rowBoxes.findIndex((boxes) =>
        boxes.every((b) => x2 + 10 <= b.x1 || x1 - 10 >= b.x2),
      );
      if (chosenRow === -1) chosenRow = rowBoxes.length - 1;
      rowBoxes[chosenRow].push({ x1, x2 });
      const labelY = rowYs[chosenRow];
      const pillY = labelY - pillYOffset;
      const textX = (x1 + pillW / 2).toFixed(1);
      return `<g class="nw-milestone-flag">
        <line x1="${x}" y1="${(pillY + pillH).toFixed(1)}" x2="${x}" y2="${H - padB}" stroke="${mItem.color}" stroke-width="1.25" stroke-dasharray="3,3" stroke-opacity="0.6" />
        <rect x="${x1.toFixed(1)}" y="${pillY.toFixed(1)}" width="${pillW.toFixed(1)}" height="${pillH}" rx="4.5" fill="${mItem.bg || "#FFFFFF"}" stroke="${mItem.border || mItem.color}" stroke-width="1" />
        <text x="${textX}" y="${labelY}" text-anchor="middle" font-size="${fontSize}" font-weight="650" fill="${mItem.color}">${mItem.label}</text>
      </g>`;
    })
    .join("");
}

export function renderTrajectoryChart(
  trajectoryData,
  chartMode,
  currentFirePlan = null,
  basis = "today",
) {
  if (!trajectoryData?.points.length) return;
  const { points, summary } = trajectoryData;
  const basisLabel =
    basis === "nominal" ? "future nominal dollars" : "today’s dollars";
  $("#trajectory-values").innerHTML = points
    .map(
      (pt) =>
        `<tr data-inspect-age="${pt.age}" class="${trajectoryInspectedAge === pt.age ? "is-inspected-row" : ""}" title="Click to inspect age ${pt.age} ledger"><th scope="row"><button type="button" class="traj-age-btn" data-inspect-age="${pt.age}" aria-expanded="${trajectoryInspectedAge === pt.age}">${pt.age} / ${pt.year}</button></th><td>${m(pt.monthlySpend)}</td><td>${m(pt.monthlyCPF)}</td><td>${m(pt.monthlyGap)}</td><td>${m(pt.portfolioBalance)}</td></tr>`,
    )
    .join("");
  const maxHorizonAge = points[points.length - 1].age;
  $("#trajectory-caption").textContent =
    `${trajectoryData.selectedScenario.label}: yearly figures in ${basisLabel} (through age ${maxHorizonAge})`;
  const descEl = $(".trajectory-desc");
  if (descEl) {
    descEl.textContent = `Year-by-year projection to age ${maxHorizonAge} in ${basisLabel} (${basis === "nominal" ? "unadjusted future values" : "inflation-adjusted purchasing power"}).`;
  }
  const chartArea = $("#trajectory-chart");
  const chartWrapper = chartArea?.parentElement;
  if (chartWrapper) {
    chartWrapper.onmousemove = null;
    chartWrapper.ontouchmove = null;
    chartWrapper.onmouseleave = null;
    chartWrapper.ontouchend = null;
    chartWrapper.onclick = null;
  }
  chartArea.onclick = null;
  const trajLegendEl = $("#chart-legend");
  if (trajLegendEl) {
    trajLegendEl.onmouseover = null;
    trajLegendEl.onmouseout = null;
    trajLegendEl.onclick = null;
  }
  const clickHintEl = $("#trajectory-click-hint");
  if (clickHintEl) {
    clickHintEl.hidden = false;
  }

  chartArea.setAttribute(
    "aria-label",
    `${chartMode === "cashflow" ? "Monthly spending and CPF income" : chartMode === "networth" ? "Stacked total net worth" : chartMode === "waterfall" ? "4-tap retirement income waterfall" : "Outside portfolio balance"} from age ${summary.age} to ${maxHorizonAge} in ${basisLabel}. Click any year to inspect full balances.`,
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
    H = 318,
    padL = 74,
    padR = 26,
    padT = 54,
    padB = 40;
  const plotW = W - padL - padR,
    plotH = H - padT - padB;
  const minAge = points[0].age,
    maxAge = points[points.length - 1].age;
  const dX = (age) =>
    padL + ((age - minAge) / Math.max(1, maxAge - minAge)) * plotW;

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

  const candidateTicks = [20, 30, 35, 45, 55, 65, 75, 85, 90, 95, 100].filter(
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
  if (xTicksList[xTicksList.length - 1] !== maxAge) {
    if (
      xTicksList.length > 0 &&
      dX(maxAge) - dX(xTicksList[xTicksList.length - 1]) < 48
    ) {
      xTicksList.pop();
    }
    xTicksList.push(maxAge);
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

  const hasSrs =
    currentFirePlan?.points?.some((p) => p.srs > 1 || p.monthlySrsDraw > 0.5) ||
    false;
  const milestoneFlagsSVG = buildAxisMilestonesSVG({
    minAge,
    maxAge,
    dX,
    padL,
    padR,
    W,
    H,
    padB,
    retireAge: summary.retire,
    srsAge: currentFirePlan?.srsWithdrawalAge ?? 63,
    showSrs: hasSrs,
  });

  const inspectedPinSVG =
    trajectoryInspectedAge != null &&
    trajectoryInspectedAge >= minAge &&
    trajectoryInspectedAge <= maxAge
      ? `<line x1="${dX(trajectoryInspectedAge)}" y1="${padT}" x2="${dX(trajectoryInspectedAge)}" y2="${H - padB}" stroke="var(--primary)" stroke-width="2" stroke-opacity="0.75" />`
      : "";

  let defs = "",
    series = "",
    legend = "";
  if (isCashflow) {
    const spendPath = linePath((pt) => pt.monthlySpend);
    const cpfPath = stepCpfPath();
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
      ${milestoneFlagsSVG}${inspectedPinSVG}`;
    legend = `
      <span class="legend-item"><i class="legend-swatch" style="background:var(--ink-soft);"></i> Target Monthly Spend</span>
      <span class="legend-item"><i class="legend-swatch" style="background:#059669;"></i> CPF LIFE Payout (${summary.plan === "escalating" ? "Escalating +2%/yr" : "Standard Flat"})</span>
      <span class="legend-item"><i class="legend-swatch" style="background:#2563EB;"></i> Outside Portfolio Funding Gap</span>`;
  } else {
    const balPath = linePath((pt) => pt.portfolioBalance);
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
      ${milestoneFlagsSVG}${inspectedPinSVG}
      <circle cx="${dX(peakPt.age)}" cy="${dY(peakPt.portfolioBalance)}" r="3.5" fill="#2563EB" />
      <text x="${dX(peakPt.age)}" y="${Math.max(padT + 14, dY(peakPt.portfolioBalance) - 10)}" text-anchor="${markerAnchor(dX(peakPt.age))}" font-size="11.5" font-weight="700" fill="#2563EB" paint-order="stroke" stroke="var(--surface)" stroke-width="3" stroke-linejoin="round">Peak ${svgCompactMoney(peakPt.portfolioBalance)}</text>`;
    legend = `
      <span class="legend-item"><i class="legend-swatch" style="background:#2563EB;"></i> Outside Portfolio Balance</span>
      <span class="legend-item"><i class="legend-swatch" style="background:#E83E8C;"></i> Target Retirement Age ${summary.retire}</span>`;
  }

  const trajLabel =
    chartMode === "cashflow"
      ? `Monthly retirement income vs spending chart from age ${summary.age} to ${maxHorizonAge}, retiring at age ${summary.retire}`
      : `Outside portfolio balance chart from age ${summary.age} to ${maxHorizonAge}, retiring at age ${summary.retire}`;
  chartArea.innerHTML = `
    <svg role="img" aria-label="${trajLabel}" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid meet">
      <defs>${defs}</defs>
      ${yTicks}${xTicks}${series}
      <line id="scrub-line" x1="0" y1="${padT}" x2="0" y2="${H - padB}" stroke="var(--ink)" stroke-width="1.5" stroke-dasharray="3,3" style="display:none;" />
    </svg>`;
  $("#chart-legend").innerHTML = legend;

  const tooltipEl = $("#chart-tooltip");
  const scrubLine = $("#scrub-line");
  if (!chartWrapper || !scrubLine) return;

  const resolveAgeFromEvent = (e) => {
    const svgEl = $("#trajectory-chart svg");
    if (!svgEl) return null;
    const svgRect = svgEl.getBoundingClientRect();
    const touch = e.touches?.length ? e.touches[0] : null;
    if (e.touches && !touch) return null;
    const clientX = touch ? touch.clientX : e.clientX;
    const plotScreenLeft = svgRect.left + (padL / W) * svgRect.width;
    const plotScreenWidth = (plotW / W) * svgRect.width;
    const fraction = Math.max(
      0,
      Math.min(1, (clientX - plotScreenLeft) / Math.max(1, plotScreenWidth)),
    );
    return {
      svgRect,
      targetAge: Math.round(minAge + fraction * (maxAge - minAge)),
    };
  };

  const handlePointer = (e) => {
    const resolved = resolveAgeFromEvent(e);
    if (!resolved) return;
    const { svgRect, targetAge } = resolved;
    const wrapRect = chartWrapper.getBoundingClientRect();
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
      <div class="tt-row"><span>Portfolio</span><b>${m(pt.portfolioBalance)}</b></div>
      <div class="tt-note">Click to inspect full year ledger</div>`;
    const anchorY =
      chartMode === "portfolio"
        ? dY(pt.portfolioBalance)
        : dY(Math.max(pt.monthlySpend, pt.monthlyCPF));
    positionChartTooltip(
      tooltipEl,
      wrapRect,
      svgRect,
      svgX,
      anchorY,
      W,
      H,
      padT,
    );
  };
  const throttledPointer = throttleRaf(handlePointer);
  const handleLeave = () => {
    throttledPointer.cancel();
    scrubLine.style.display = "none";
    tooltipEl.hidden = true;
  };
  chartWrapper.onmousemove = throttledPointer;
  chartWrapper.ontouchmove = throttledPointer;
  chartWrapper.onmouseleave = handleLeave;
  chartWrapper.ontouchend = handleLeave;
  chartWrapper.ontouchcancel = handleLeave;
  chartWrapper.onclick = (e) => {
    if (e.target.closest("button")) return;
    const resolved = resolveAgeFromEvent(e);
    if (resolved && typeof onTrajectoryInspectAge === "function") {
      onTrajectoryInspectAge(resolved.targetAge);
    }
  };
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

export function renderStackedNetWorthSVG(
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
  const isDashCombo =
    Boolean(opts.swellCombo) ||
    chartArea.id === "dash-networth-chart" ||
    chartArea.id === "print-nw-chart";
  const isOverviewHero = chartArea.id === "dash-networth-chart";
  const W = compactPrint ? 680 : isOverviewHero ? 720 : 860,
    H = compactPrint ? 176 : isOverviewHero ? 386 : 322,
    padL = compactPrint ? 54 : isOverviewHero ? 58 : 76,
    padR = compactPrint ? 16 : isOverviewHero ? 20 : 34,
    padT = compactPrint ? 56 : isOverviewHero ? 70 : 72,
    padB = compactPrint ? 24 : isOverviewHero ? 32 : 40;
  const plotW = W - padL - padR,
    plotH = H - padT - padB;
  const minAge = pts[0].age,
    maxAge = pts[pts.length - 1].age;
  const xInset = isDashCombo ? 16 : 0;
  const dX = (age) =>
    padL +
    xInset +
    ((age - minAge) / Math.max(1, maxAge - minAge)) * (plotW - xInset * 2);
  const rawMax = Math.max(
    10000,
    ...pts.map((p) => (soloSeries ? p[soloSeries.key] : p.total)),
  );
  const { maxVal, ticks } = niceAxis(rawMax, 4);
  const dY = (val) => padT + (1 - Math.max(0, val) / maxVal) * plotH;

  const tickFontSize = compactPrint ? 13.5 : 12;
  const yTicks = ticks
    .map(
      (v) =>
        `<line x1="${padL}" y1="${dY(v)}" x2="${W - padR}" y2="${dY(v)}" stroke="var(--chart-grid)" stroke-opacity="0.5" stroke-dasharray="3,3" />
         <text x="${padL - 10}" y="${dY(v) + 4}" text-anchor="end" font-size="${tickFontSize}" fill="var(--ink-soft)">${svgCompactMoney(v)}</text>`,
    )
    .join("");

  const candTicks = [20, 30, 35, 45, 55, 65, 75, 85, 90, 95, 100, 105].filter(
    (a) => a >= minAge && a <= maxAge,
  );
  if (!candTicks.includes(maxAge)) candTicks.push(maxAge);
  const xTicksList = [];
  for (const a of candTicks) {
    if (!xTicksList.length || dX(a) - dX(xTicksList.at(-1)) >= 52)
      xTicksList.push(a);
  }
  if (xTicksList.at(-1) !== maxAge && dX(maxAge) - dX(xTicksList.at(-1)) >= 32) {
    xTicksList.push(maxAge);
  }
  const xTicks = xTicksList
    .map(
      (a) =>
        `<line x1="${dX(a)}" y1="${padT}" x2="${dX(a)}" y2="${H - padB}" stroke="var(--chart-grid)" stroke-opacity="0.3" />
         <text x="${dX(a)}" y="${H - padB + 22}" text-anchor="middle" font-size="${tickFontSize}" fill="var(--ink-soft)">${a}</text>`,
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

  const barSampleAges = (() => {
    const span = Math.max(1, maxAge - minAge);
    const targetCount = 12;
    const step = Math.max(1, Math.round(span / (targetCount - 1)));
    const list = [];
    for (let a = minAge; a <= maxAge; a += step) list.push(a);
    if (list[list.length - 1] !== maxAge) {
      if (maxAge - list[list.length - 1] < step * 0.45 && list.length > 2) {
        list[list.length - 1] = maxAge;
      } else {
        list.push(maxAge);
      }
    }
    const mustInclude = [fire.retire, 55, 65].filter(
      (a) => a > minAge && a < maxAge,
    );
    for (const reqAge of mustInclude) {
      if (!list.includes(reqAge)) {
        let nearestIdx = 1;
        let bestDist = Infinity;
        for (let i = 1; i < list.length - 1; i++) {
          const d = Math.abs(list[i] - reqAge);
          if (d < bestDist) {
            bestDist = d;
            nearestIdx = i;
          }
        }
        list[nearestIdx] = reqAge;
      }
    }
    return [...new Set(list)].sort((a, b) => a - b);
  })();

  const swellComboSVG = (() => {
    if (!isDashCombo) return "";
    const barW = Math.max(
      14,
      Math.min(28, (plotW / barSampleAges.length) * 0.48),
    );
    const pivotAge = Math.min(55, fire.retire);
    const barRects = barSampleAges
      .map((ageVal) => {
        const pt =
          pts.find((p) => p.age === ageVal) ||
          pts.reduce((best, p) =>
            Math.abs(p.age - ageVal) < Math.abs(best.age - ageVal) ? p : best,
          );
        const val = soloSeries ? pt[soloSeries.key] : pt.total;
        const x = dX(pt.age);
        const y = dY(val);
        const h = Math.max(4, H - padB - y);
        const isPostPivot = pt.age >= pivotAge;
        const barFill = soloSeries
          ? soloSeries.color
          : isPostPivot
            ? "#EC4899"
            : "#68768A";
        return `<g class="swell-bar-col" data-age="${pt.age}">
          <rect x="${(x - barW / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="3.5" fill="${barFill}" fill-opacity="${soloSeries ? "0.86" : "0.92"}" />
        </g>`;
      })
      .join("");

    const splineCoords = barSampleAges.map((ageVal) => {
      const pt =
        pts.find((p) => p.age === ageVal) ||
        pts.reduce((best, p) =>
          Math.abs(p.age - ageVal) < Math.abs(best.age - ageVal) ? p : best,
        );
      const lineVal = soloSeries ? pt[soloSeries.key] : pt.total;
      return { x: dX(pt.age), y: dY(lineVal) };
    });
    const splinePath = buildSmoothSpline(splineCoords, padT + 2, H - padB);
    const lastCoord = splineCoords[splineCoords.length - 1];
    return `<g class="swell-combo-layer">
      ${barRects}
      <path d="${splinePath}" fill="none" stroke="#2563EB" stroke-width="2.4" stroke-linecap="round" />
      ${lastCoord ? `<circle cx="${lastCoord.x.toFixed(1)}" cy="${lastCoord.y.toFixed(1)}" r="4.5" fill="#FFFFFF" stroke="#2563EB" stroke-width="2.8" />` : ""}
    </g>`;
  })();

  const bandsSVG = soloSeries
    ? `<g class="nw-band is-solo" data-series="${soloSeries.key}">
        <path class="nw-band-fill" d="${areaPath(
          (p) => p[soloSeries.key],
          () => 0,
        )}" fill="url(#${uid}-grad-${soloSeries.key})" fill-opacity="${isDashCombo ? "0.22" : "1"}" />
        ${isDashCombo ? "" : `<path class="nw-band-stroke" d="${topLinePath((p) => p[soloSeries.key])}" fill="none" stroke="${soloSeries.color}" stroke-width="2.5" stroke-linejoin="round" />`}
      </g>${swellComboSVG}`
    : isDashCombo
      ? `${stackDefs
          .map(
            (band) => `<g class="nw-band" data-series="${band.key}">
              <path class="nw-band-fill" d="${areaPath(band.top, band.bot)}" fill="url(#${uid}-grad-${band.key})" fill-opacity="0.46" />
              <path class="nw-band-stroke" d="${topLinePath(band.top)}" fill="none" stroke="${band.color}" stroke-width="1.2" stroke-opacity="0.45" stroke-linejoin="round" />
            </g>`,
          )
          .join("")}${swellComboSVG}`
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
  const milestoneSVG = buildAxisMilestonesSVG({
    minAge,
    maxAge,
    dX,
    padL,
    padR,
    W,
    H,
    padB,
    retireAge: fire.retire,
    srsAge: fire.srsWithdrawalAge,
    showSrs,
    rowYs: compactPrint ? [15, 28, 41, 52] : [18, 34, 50, 66],
    compactPrint,
    saLabel: "55 SA Closure",
    saStyle: { color: "#047857", bg: "#ECFDF5", border: "#A7F3D0" },
    srsLabelSuffix: "SRS",
    includeAge55AtMin: true,
  });

  const valForCallout = (pt) => (soloSeries ? pt[soloSeries.key] : pt.total);
  const pivotCalloutSkip = isDashCombo ? Math.min(55, fire.retire) : -1;
  const calloutAges = [fire.retire, 65, maxAge].filter(
    (a, idx, arr) =>
      arr.indexOf(a) === idx &&
      a !== pivotCalloutSkip &&
      a >= minAge + 2 &&
      a <= maxAge,
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
      const pillText = svgCompactMoney(val);
      const pillW = Math.max(
        compactPrint ? 48 : 44,
        labelText.length * (compactPrint ? 7.6 : 6.6) + 12,
      );
      const pillH = compactPrint ? 18 : 17;
      const pillX = Math.max(
        padL + 2,
        Math.min(
          W - padR - pillW - 2,
          anchor === "end" ? x - pillW + 4 : x - pillW / 2,
        ),
      );
      const pillY = labelY - (compactPrint ? 13 : 12);
      return `<circle cx="${x}" cy="${dotY}" r="3.5" fill="${dotColor}" stroke="var(--surface)" stroke-width="1.5" />
        ${showLabel ? `<g class="nw-callout-pill"><rect x="${pillX.toFixed(1)}" y="${pillY.toFixed(1)}" width="${pillW.toFixed(1)}" height="${pillH}" rx="4.5" fill="var(--surface)" fill-opacity="0.94" stroke="var(--border-strong)" stroke-width="1" /><text x="${(pillX + pillW / 2).toFixed(1)}" y="${labelY}" text-anchor="middle" font-size="${compactPrint ? 12.5 : 11}" font-weight="700" fill="var(--ink)">${pillText}</text></g>` : ""}`;
    })
    .join("");

  const scrubDotsSVG = (soloSeries ? [soloSeries] : NW_SERIES)
    .map(
      (sItem) =>
        `<circle class="nw-scrub-dot" data-series="${sItem.key}" cx="0" cy="0" r="4" fill="${sItem.color}" stroke="var(--surface)" stroke-width="1.75" style="display:none;" />`,
    )
    .join("");

  const nwLabel = `Projected net worth stacked area chart from age ${fire.age} to ${fire.endAge}, retiring at age ${fire.retire}`;
  chartArea.innerHTML = `
    <svg role="img" aria-label="${nwLabel}" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid meet">
      ${gradientsSVG}
      ${yTicks}${xTicks}
      ${bandsSVG}
      ${milestoneSVG}
      ${calloutsSVG}
      <line class="nw-scrub-line" x1="0" y1="${padT}" x2="0" y2="${H - padB}" stroke="var(--swell-pink)" stroke-width="1.6" stroke-dasharray="3,3" style="display:none;" />
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
    if (
      chartArea.id === "trajectory-chart" &&
      typeof onTrajectoryInspectAge === "function"
    ) {
      const svg = chartArea.querySelector("svg");
      if (svg) {
        const svgRect = svg.getBoundingClientRect();
        if (!svgRect.width || !svgRect.height) return;
        const left = svgRect.left + ((padL + xInset) / W) * svgRect.width;
        const width = ((plotW - xInset * 2) / W) * svgRect.width;
        const frac = Math.max(
          0,
          Math.min(1, (e.clientX - left) / Math.max(1, width)),
        );
        const clickedAge = Math.round(minAge + frac * (maxAge - minAge));
        onTrajectoryInspectAge(clickedAge);
        return;
      }
    }
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
    if (!svgRect.width || !svgRect.height) return;
    const wrapRect = wrap.getBoundingClientRect();
    const touch = e.touches?.length ? e.touches[0] : null;
    if (e.touches && !touch) return;
    const cx = touch ? touch.clientX : e.clientX;
    const cy = touch ? touch.clientY : e.clientY;
    const left = svgRect.left + ((padL + xInset) / W) * svgRect.width;
    const width = Math.max(1, ((plotW - xInset * 2) / W) * svgRect.width);
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
    svg.querySelectorAll(".swell-bar-col").forEach((col) => {
      col.classList.toggle(
        "is-scrub-active",
        Number(col.dataset.age) === pt.age,
      );
    });
    if (chartArea.id === "dash-networth-chart") {
      const heroTitleEl = document.getElementById("ember-traj-title");
      const heroValEl = document.getElementById("hero-nw-live");
      const heroSubEl = document.getElementById("hero-nw-sub-live");
      if (heroTitleEl && heroValEl && heroSubEl) {
        if (!heroTitleEl.dataset.defaultHtml)
          heroTitleEl.dataset.defaultHtml = heroTitleEl.innerHTML;
        if (!heroValEl.dataset.defaultHtml)
          heroValEl.dataset.defaultHtml = heroValEl.innerHTML;
        if (!heroSubEl.dataset.defaultHtml)
          heroSubEl.dataset.defaultHtml = heroSubEl.innerHTML;
        const dispVal = soloSeries ? pt[soloSeries.key] : pt.total;
        heroTitleEl.innerHTML = `Age ${pt.age} (${pt.year}) <span class="nw-live-scrub-pill">Live Scrub</span>`;
        heroValEl.innerHTML = m(dispVal);
        heroSubEl.innerHTML = `<span class="nw-live-breakdown">CPF <b>${compactMoney(pt.cpf)}</b> · Eq <b>${compactMoney(pt.eq)}</b> · Cash <b>${compactMoney(pt.ssb)}</b>${pt.srs > 0 ? ` · SRS <b>${compactMoney(pt.srs)}</b>` : ""}</span>`;
      }
    }

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
    );
  };
  const onLeave = () => {
    scrub.style.display = "none";
    const svg = chartArea.querySelector("svg");
    if (svg) {
      svg
        .querySelectorAll(".nw-scrub-dot")
        .forEach((dot) => (dot.style.display = "none"));
      svg
        .querySelectorAll(".swell-bar-col.is-scrub-active")
        .forEach((col) => col.classList.remove("is-scrub-active"));
    }
    if (chartArea.id === "dash-networth-chart") {
      const heroTitleEl = document.getElementById("ember-traj-title");
      const heroValEl = document.getElementById("hero-nw-live");
      const heroSubEl = document.getElementById("hero-nw-sub-live");
      if (heroTitleEl?.dataset.defaultHtml)
        heroTitleEl.innerHTML = heroTitleEl.dataset.defaultHtml;
      if (heroValEl?.dataset.defaultHtml)
        heroValEl.innerHTML = heroValEl.dataset.defaultHtml;
      if (heroSubEl?.dataset.defaultHtml)
        heroSubEl.innerHTML = heroSubEl.dataset.defaultHtml;
    }
    setHoveredBand(null);
    tooltipEl.hidden = true;
  };
  const throttledMove = throttleRaf(onMove);
  const handleLeave = () => {
    throttledMove.cancel();
    onLeave();
  };
  wrap.onmousemove = throttledMove;
  wrap.ontouchmove = throttledMove;
  wrap.onmouseleave = handleLeave;
  wrap.ontouchend = handleLeave;
  wrap.ontouchcancel = handleLeave;
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
  const endAge = Math.min(fire.endAge, opts.endAge ?? fire.endAge);
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
        bridge: src.monthlyBridge || 0,
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
    padT = compactPrint ? 40 : 40,
    padB = compactPrint ? 32 : 40;
  const plotW = W - padL - padR,
    plotH = H - padT - padB;
  const rawMax = Math.max(
    1000,
    ...pts.map((p) =>
      Math.max(p.spend, p.cpf + p.bridge + p.srs + p.liquid + p.shortfall),
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
    .map((p, i) => {
      const isEndpoint = p.age === startAge || p.age === endAge;
      const isStep =
        p.age % 5 === 0 &&
        Math.abs(p.age - startAge) > 1 &&
        Math.abs(p.age - endAge) > 1;
      return isEndpoint || isStep
        ? `<text x="${centerX(i)}" y="${H - padB + 22}" text-anchor="middle" font-size="12" fill="var(--ink-soft)">${p.age}</text>`
        : "";
    })
    .join("");

  const bars = pts
    .map((p, i) => {
      if (!p.retired) return "";
      const x = barX(i);
      const yBase = dY(0);
      const yCpf = dY(p.cpf);
      const yBridge = dY(p.cpf + p.bridge);
      const ySrs = dY(p.cpf + p.bridge + p.srs);
      const yLiq = dY(p.cpf + p.bridge + p.srs + p.liquid);
      const yShort = dY(p.cpf + p.bridge + p.srs + p.liquid + p.shortfall);
      return `
        ${p.cpf > 0 ? `<rect x="${x}" y="${yCpf}" width="${barW}" height="${Math.max(0, yBase - yCpf)}" fill="#059669" rx="1.5" />` : ""}
        ${p.bridge > 0 ? `<rect x="${x}" y="${yBridge}" width="${barW}" height="${Math.max(0, yCpf - yBridge)}" fill="#D97706" rx="1.5" />` : ""}
        ${p.srs > 0 ? `<rect x="${x}" y="${ySrs}" width="${barW}" height="${Math.max(0, yBridge - ySrs)}" fill="#7C3AED" rx="1.5" />` : ""}
        ${p.liquid > 0 ? `<rect x="${x}" y="${yLiq}" width="${barW}" height="${Math.max(0, ySrs - yLiq)}" fill="#2563EB" rx="1.5" />` : ""}
        ${p.shortfall > 0.5 ? `<rect x="${x}" y="${yShort}" width="${barW}" height="${Math.max(0, yLiq - yShort)}" fill="#DC2626" fill-opacity="0.82" rx="1.5" />` : ""}`;
    })
    .join("");

  const spendLine = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${centerX(i)} ${dY(p.spend)}`)
    .join(" ");

  const showSrs =
    opts.hasSrs != null ? Boolean(opts.hasSrs) : pts.some((p) => p.srs > 0.5);
  const markers = buildAxisMilestonesSVG({
    minAge: pts[0].age,
    maxAge: pts[pts.length - 1].age,
    dX: (age) => {
      const i = pts.findIndex((p) => p.age === age);
      return i >= 0 ? centerX(i) : padL;
    },
    padL,
    padR,
    W,
    H,
    padB,
    retireAge: fire.retire,
    srsAge: fire.srsWithdrawalAge,
    showSrs,
    rowYs: compactPrint ? [14, 27] : [16, 30],
  });

  const wfLabel = `Retirement income waterfall chart from age ${fire.retire} to ${fire.endAge}`;
  chartArea.innerHTML = `
    <svg role="img" aria-label="${wfLabel}" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid meet">
      ${yTicks}${xLabels}${bars}
      <path d="${spendLine}" fill="none" stroke="var(--ink)" stroke-width="2" stroke-dasharray="6,3" />
      ${markers}
      <line class="wf-scrub-line" x1="0" y1="${padT}" x2="0" y2="${H - padB}" stroke="var(--swell-pink)" stroke-width="1.6" stroke-dasharray="3,3" style="display:none;" />
    </svg>`;

  if (legendEl) {
    const hasAnyBridge = pts.some((p) => p.retired && p.bridge > 0.5);
    const hasAnyShortfall = pts.some((p) => p.retired && p.shortfall > 0.5);
    legendEl.innerHTML = `
      <span class="legend-item"><i class="legend-swatch" style="background:var(--ink);"></i> Target Monthly Spending</span>
      <span class="legend-item"><i class="legend-swatch" style="background:#2563EB;"></i> Equity / Dividend / SSB Drawdown</span>
      ${showSrs ? `<span class="legend-item"><i class="legend-swatch" style="background:#7C3AED;"></i> SRS 10-Yr Drawdown (${fire.srsWithdrawalAge}+)</span>` : ""}
      ${hasAnyBridge ? '<span class="legend-item"><i class="legend-swatch" style="background:#D97706;"></i> Bridge Income (Pre-65)</span>' : ""}
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
    if (!svgRect.width || !svgRect.height) return;
    const wrapRect = wrap.getBoundingClientRect();
    const touch = e.touches?.length ? e.touches[0] : null;
    if (e.touches && !touch) return;
    const cx = touch ? touch.clientX : e.clientX;
    const left = svgRect.left + (padL / W) * svgRect.width;
    const width = Math.max(1, (plotW / W) * svgRect.width);
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
             ${pt.bridge > 0.5 ? `<div class="tt-row"><span>Bridge Income</span><b>${m(pt.bridge, "/mo")}</b></div>` : ""}
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
    );
  };
  const throttledMove = throttleRaf(onMove);
  const onLeave = () => {
    throttledMove.cancel();
    scrub.style.display = "none";
    tooltipEl.hidden = true;
  };
  wrap.onmousemove = throttledMove;
  wrap.ontouchmove = throttledMove;
  wrap.onmouseleave = onLeave;
  wrap.ontouchend = onLeave;
  wrap.ontouchcancel = onLeave;
  if (chartArea.id === "trajectory-chart") {
    wrap.onclick = (e) => {
      if (e.target.closest("button")) return;
      const svg = chartArea.querySelector("svg");
      if (!svg || typeof onTrajectoryInspectAge !== "function") return;
      const svgRect = svg.getBoundingClientRect();
      const left = svgRect.left + (padL / W) * svgRect.width;
      const width = (plotW / W) * svgRect.width;
      const frac = Math.max(
        0,
        Math.min(0.9999, (e.clientX - left) / Math.max(1, width)),
      );
      const idx = Math.floor(frac * pts.length);
      const pt = pts[idx] || pts[0];
      if (pt) onTrajectoryInspectAge(pt.age);
    };
  }
}

export function getTrajectoryInspectedAge() {
  return trajectoryInspectedAge;
}

export function setTrajectoryInspectedAge(age) {
  trajectoryInspectedAge = age;
}

export function setOnTrajectoryInspectAge(fn) {
  onTrajectoryInspectAge = fn;
}

export function setNetWorthSelectedSeries(series) {
  netWorthSelectedSeries = series;
}
