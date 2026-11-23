import {
  $,
  m,
  compactMoney,
  formatDollarBasis,
  svgCompactMoney,
  svgMoney,
} from "./format.js";

export const NET_WORTH_SCOPE =
  "Includes CPF, SRS, equities, cash and bonds. Excludes home value and outstanding debts.";

export function getSrsUsedForSpending(point) {
  return Math.max(
    0,
    point.monthlyTotalIncome -
      point.monthlyCpfLife -
      point.monthlyBridge -
      point.monthlyLiquidDraw,
  );
}

let trajectoryInspectedAge = null;
let onTrajectoryInspectAge = null;

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

function announceChartStatus(text) {
  const sr = document.getElementById("sr-status");
  if (sr && text) sr.textContent = text;
}

/**
 * Bind accessible keyboard scrubbing (ArrowLeft/ArrowRight/Home/End/Enter/Space/Escape)
 * onto an interactive chart container so keyboard-only users can inspect data points.
 */
function bindChartKeyboard(
  chartArea,
  { count, initialIndex = 0, onShow, onLeave, onSelect },
) {
  if (!chartArea || count <= 0) return;
  chartArea.setAttribute("tabindex", "0");
  chartArea.setAttribute("role", "application");
  chartArea.setAttribute("aria-roledescription", "interactive chart");
  let activeIdx = Math.max(0, Math.min(count - 1, initialIndex));
  let isActive = false;

  chartArea.onkeydown = (e) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      activeIdx = isActive ? Math.min(count - 1, activeIdx + 1) : activeIdx;
      isActive = true;
      onShow(activeIdx);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      activeIdx = isActive ? Math.max(0, activeIdx - 1) : activeIdx;
      isActive = true;
      onShow(activeIdx);
    } else if (e.key === "Home") {
      e.preventDefault();
      activeIdx = 0;
      isActive = true;
      onShow(activeIdx);
    } else if (e.key === "End") {
      e.preventDefault();
      activeIdx = count - 1;
      isActive = true;
      onShow(activeIdx);
    } else if (
      (e.key === "Enter" || e.key === " ") &&
      typeof onSelect === "function"
    ) {
      e.preventDefault();
      if (!isActive) {
        isActive = true;
        onShow(activeIdx);
      }
      onSelect(activeIdx);
    } else if (e.key === "Escape") {
      if (isActive) {
        e.preventDefault();
        isActive = false;
        onLeave();
      }
    }
  };
  chartArea.onblur = () => {
    if (isActive) {
      isActive = false;
      onLeave();
    }
  };
}

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

function getMobileChartWidth(chartArea, compactPrint) {
  if (compactPrint) return null;
  const cw =
    chartArea?.clientWidth || chartArea?.parentElement?.clientWidth || 0;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const avail = cw > 0 ? Math.min(cw, vw) : Math.max(240, vw - 28);
  if (avail >= 520) return null;
  return Math.max(240, Math.min(480, Math.round(avail)));
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
  isMobile = false,
  saLabel = "55 SA → RA",
  saStyle = {
    color: "var(--sem-teal)",
    bg: "var(--sem-teal-soft)",
    border: "var(--sem-teal-border)",
  },
  srsLabelSuffix = "SRS Draw",
  includeAge55AtMin = false,
  emphasize = false,
}) {
  const narrow = isMobile && !compactPrint;
  const raw = [];
  if ((includeAge55AtMin ? minAge <= 55 : minAge < 55) && maxAge >= 55) {
    raw.push({
      age: 55,
      label: narrow ? "55 SA→RA" : saLabel,
      color: saStyle.color,
      bg: saStyle.bg,
      border: saStyle.border,
    });
  }
  if (retireAge >= minAge && retireAge <= maxAge) {
    raw.push({
      age: retireAge,
      label: `Retire ${retireAge}`,
      color: "var(--swell-pink-ink)",
      bg: "var(--swell-pink-soft)",
      border: "var(--swell-pink-border)",
    });
  }
  if (showSrs && srsAge != null && srsAge >= minAge && srsAge <= maxAge) {
    raw.push({
      age: srsAge,
      label: narrow ? `${srsAge} SRS` : `${srsAge} ${srsLabelSuffix}`,
      color: "var(--sem-srs)",
      bg: "var(--sem-srs-soft)",
      border: "var(--sem-srs-border)",
    });
  }
  if (65 >= minAge && 65 <= maxAge) {
    raw.push({
      age: 65,
      label: narrow ? "65 CPF" : "65 CPF LIFE",
      color: "var(--sem-cpf-ink)",
      bg: "var(--sem-cpf-soft)",
      border: "var(--sem-cpf-border)",
    });
  }
  raw.sort((a, b) => a.age - b.age);
  const merged = [];
  for (const item of raw) {
    const ex = merged.find((mItem) => mItem.age === item.age);
    if (ex) {
      if (item.age === 65 && ex.label.startsWith("Retire")) {
        ex.label = narrow ? "65 Retire·CPF" : "65 Retire · CPF LIFE";
        ex.color = "var(--swell-pink-ink)";
        ex.bg = "var(--swell-pink-soft)";
        ex.border = "var(--swell-pink-border)";
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
  const charW = compactPrint ? 8 : emphasize ? 7.2 : narrow ? 6.2 : 6.6;
  const pillH = compactPrint || emphasize ? 19 : narrow ? 15 : 17;
  const pillYOffset = emphasize
    ? 13.5
    : compactPrint
      ? 14
      : narrow
        ? 10.5
        : 11.5;
  const fontSize = compactPrint ? 14 : emphasize ? 12 : 11;
  const gapX = narrow ? 6 : 10;
  const maxPillW = Math.max(44, W - padL - padR);
  const flags = merged.map((mItem, index) => {
    const x = dX(mItem.age);
    const anchor =
      x < padL + (narrow ? 40 : 54)
        ? "start"
        : x > W - padR - (narrow ? 40 : 54)
          ? "end"
          : "middle";
    const pillW = Math.min(
      maxPillW,
      Math.max(
        narrow ? 44 : 54,
        mItem.label.length * charW + (narrow ? 10 : 14),
      ),
    );
    const rawX1 =
      anchor === "start" ? x : anchor === "end" ? x - pillW : x - pillW / 2;
    const x1 = Math.max(padL, Math.min(W - padR - pillW, rawX1));
    const x2 = x1 + pillW;
    const fits = (boxes) =>
      boxes.every((b) => x2 + gapX <= b.x1 || x1 - gapX >= b.x2);
    const preferredRow = emphasize ? index % 2 : 0;
    const firstAvailableRow = rowBoxes.findIndex(fits);
    const chosenRow = fits(rowBoxes[preferredRow])
      ? preferredRow
      : firstAvailableRow === -1
        ? rowBoxes.length - 1
        : firstAvailableRow;
    rowBoxes[chosenRow].push({ x1, x2 });
    const labelY = rowYs[chosenRow];
    const pillY = labelY - pillYOffset;
    const textX = (x1 + pillW / 2).toFixed(1);
    return {
      line: `<line x1="${x}" y1="${(pillY + pillH).toFixed(1)}" x2="${x}" y2="${H - padB}" stroke="${mItem.color}" stroke-width="1.25" stroke-dasharray="3,3" stroke-opacity="0.6" />`,
      label: `<rect x="${x1.toFixed(1)}" y="${pillY.toFixed(1)}" width="${pillW.toFixed(1)}" height="${pillH}" rx="4.5" fill="${mItem.bg || "var(--surface)"}" stroke="${mItem.border || mItem.color}" stroke-width="1" />
        <text x="${textX}" y="${labelY}" text-anchor="middle" font-size="${fontSize}" font-weight="650" fill="${mItem.color}">${mItem.label}</text>`,
    };
  });
  return emphasize
    ? flags.map(({ line }) => line).join("") +
        flags
          .map(({ label }) => `<g class="nw-milestone-flag">${label}</g>`)
          .join("")
    : flags
        .map(
          ({ line, label }) =>
            `<g class="nw-milestone-flag">${line}${label}</g>`,
        )
        .join("");
}

function renderTrajectoryTable(view, points, basisLabel, scenarioLabel) {
  const tableBody = $("#trajectory-values");
  const focusedAge = tableBody.contains(document.activeElement)
    ? document.activeElement.dataset.inspectAge
    : null;
  $("#trajectory-columns").innerHTML =
    '<th scope="col">Age / year</th>' +
    view.columns
      .map(
        ([, label]) =>
          `<th scope="col">${label}${view.monthly ? " / month" : ""}</th>`,
      )
      .join("");
  tableBody.innerHTML = points
    .map((pt) => {
      const inspected = trajectoryInspectedAge === pt.age;
      const amounts = view.columns
        .map(([key]) => `<td>${m(pt[key])}</td>`)
        .join("");
      return `<tr data-inspect-age="${pt.age}" class="${inspected ? "is-inspected-row" : ""}"><th scope="row"><button type="button" class="traj-age-btn" data-inspect-age="${pt.age}" aria-expanded="${inspected}" aria-controls="trajectory-year-inspector">${pt.age} / ${pt.year}</button></th>${amounts}</tr>`;
    })
    .join("");
  if (focusedAge != null) {
    tableBody
      .querySelector(`button[data-inspect-age="${focusedAge}"]`)
      ?.focus({ preventScroll: true });
  }
  $("#trajectory-caption").textContent =
    `${view.title} in ${basisLabel} · ${scenarioLabel}`;
  $("#trajectory-table-note").textContent =
    "Values rounded to the nearest dollar.";
}

export function renderTrajectoryChart(
  trajectoryData,
  chartMode,
  currentFirePlan = null,
  basis = "today",
) {
  if (!trajectoryData?.points.length) return;
  if (
    !TRAJECTORY_VIEWS[chartMode] ||
    (!currentFirePlan?.points?.length &&
      ["networth", "waterfall"].includes(chartMode))
  ) {
    chartMode = "cashflow";
  }
  const { points, summary } = trajectoryData;
  const view = TRAJECTORY_VIEWS[chartMode];
  const basisLabel = formatDollarBasis(basis);
  const plottedPoints =
    chartMode === "networth"
      ? getNetWorthPoints(currentFirePlan, basis)
      : chartMode === "waterfall"
        ? getIncomePoints(currentFirePlan, basis)
        : points;
  const firstAge = plottedPoints[0].age;
  const lastAge = plottedPoints.at(-1).age;
  renderTrajectoryTable(
    view,
    plottedPoints,
    basisLabel,
    trajectoryData.selectedScenario.label,
  );

  const descEl = $(".trajectory-desc");
  if (descEl) {
    descEl.textContent = `Ages ${firstAge}–${lastAge} · ${basisLabel} · retire at age ${summary.retire}.`;
  }
  $("#trajectory-chart-note").textContent = view.note;
  const chartArea = $("#trajectory-chart");
  const chartWrapper = chartArea?.parentElement;
  if (chartWrapper) {
    chartWrapper.onmousemove = null;
    chartWrapper.ontouchmove = null;
    chartWrapper.onmouseleave = null;
    chartWrapper.ontouchend = null;
    chartWrapper.ontouchcancel = null;
    chartWrapper.onclick = null;
  }
  $("#chart-tooltip").hidden = true;
  chartArea.onclick = null;
  chartArea.onkeydown = null;
  chartArea.onblur = null;
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

  const chartLabel = `${view.title} from age ${firstAge} to ${lastAge} in ${basisLabel}`;
  chartArea.setAttribute("aria-label", chartLabel);

  if (chartMode === "networth") {
    renderStackedNetWorthSVG(
      chartArea,
      $("#chart-tooltip"),
      $("#chart-legend"),
      currentFirePlan,
      basis,
    );
    return;
  }
  if (chartMode === "waterfall") {
    renderCashflowWaterfallSVG(
      chartArea,
      $("#chart-tooltip"),
      $("#chart-legend"),
      currentFirePlan,
      plottedPoints,
      chartLabel,
    );
    return;
  }

  const mobileW = getMobileChartWidth(chartArea, false);
  const isMobile = mobileW != null;
  const W = mobileW ?? Math.min(chartArea.clientWidth || 760, 760),
    H = isMobile ? 260 : 318,
    padL = isMobile ? 52 : 74,
    padR = isMobile ? 14 : 26,
    padT = isMobile ? 74 : 54,
    padB = isMobile ? 34 : 40;
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
  const { maxVal, ticks } = niceAxis(rawMax, isMobile ? 3 : 4);
  const dY = (val) => padT + (1 - Math.max(0, val) / maxVal) * plotH;
  const formatTickSvg = isCashflow
    ? isMobile
      ? svgCompactMoney
      : svgMoney
    : svgCompactMoney;
  const yTicks = ticks
    .map(
      (v) =>
        `<line x1="${padL}" y1="${dY(v)}" x2="${W - padR}" y2="${dY(v)}" stroke="var(--chart-grid)" stroke-opacity="0.5" stroke-dasharray="3,3" />
         <text x="${padL - (isMobile ? 7 : 10)}" y="${dY(v) + 4}" text-anchor="end" class="chart-axis-label" fill="var(--ink-soft)">${formatTickSvg(v)}</text>`,
    )
    .join("");

  const candidateTicks = [20, 30, 35, 45, 55, 65, 75, 85, 90, 95, 100].filter(
    (a) => a >= minAge && a <= maxAge,
  );
  const xTicksList = [];
  const minTickGap = isMobile ? 48 : 62;
  for (const a of candidateTicks) {
    if (
      xTicksList.length === 0 ||
      dX(a) - dX(xTicksList[xTicksList.length - 1]) >= minTickGap
    ) {
      xTicksList.push(a);
    }
  }
  if (xTicksList[xTicksList.length - 1] !== maxAge) {
    if (
      xTicksList.length > 0 &&
      dX(maxAge) - dX(xTicksList[xTicksList.length - 1]) < (isMobile ? 34 : 48)
    ) {
      xTicksList.pop();
    }
    xTicksList.push(maxAge);
  }
  const xTicks = xTicksList
    .map(
      (a) =>
        `<line x1="${dX(a)}" y1="${padT}" x2="${dX(a)}" y2="${H - padB}" stroke="var(--chart-grid)" stroke-opacity="0.35" />
         <text x="${dX(a)}" y="${H - padB + (isMobile ? 20 : 22)}" text-anchor="middle" class="chart-axis-label" fill="var(--ink-soft)">${isMobile ? a : `Age ${a}`}</text>`,
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
    isMobile,
    rowYs: isMobile ? [14, 30, 46, 62] : [18, 34, 50],
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
        <stop offset="0%" stop-color="var(--ink-soft)" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="var(--ink-soft)" stop-opacity="0.03"/>
      </linearGradient>
      <linearGradient id="cpfGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--sem-cpf-ink)" stop-opacity="0.28"/>
        <stop offset="100%" stop-color="var(--sem-cpf-ink)" stop-opacity="0.06"/>
      </linearGradient>`;
    series = `
      <path d="${spendPath} L ${dX(maxAge)} ${dY(0)} L ${dX(minAge)} ${dY(0)} Z" fill="url(#spendGrad)" />
      <path d="${spendPath}" fill="none" stroke="var(--ink-soft)" stroke-width="2.2" stroke-dasharray="6,3" />
      <path d="${cpfPath} L ${dX(maxAge)} ${dY(0)} L ${dX(minAge)} ${dY(0)} Z" fill="url(#cpfGrad)" />
      <path d="${cpfPath}" fill="none" stroke="var(--sem-cpf-ink)" stroke-width="2.4" />
      ${milestoneFlagsSVG}${inspectedPinSVG}`;
    legend = `
      <span class="legend-item"><i class="legend-line is-spending" aria-hidden="true"></i> Spending target</span>
      <span class="legend-item"><i class="legend-swatch" style="background:var(--sem-cpf-ink);"></i> CPF LIFE (${summary.plan === "escalating" ? "Escalating +2%/yr" : "Standard"})</span>`;
  } else {
    const balPath = linePath((pt) => pt.portfolioBalance);
    const peakPt = points.reduce(
      (best, cur) =>
        cur.portfolioBalance > best.portfolioBalance ? cur : best,
      points[0],
    );
    defs = `
      <linearGradient id="portGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--ink-soft)" stop-opacity="0.28"/>
        <stop offset="100%" stop-color="var(--ink-soft)" stop-opacity="0.03"/>
      </linearGradient>`;
    series = `
      <path d="${balPath} L ${dX(maxAge)} ${dY(0)} L ${dX(minAge)} ${dY(0)} Z" fill="url(#portGrad)" />
      <path d="${balPath}" fill="none" stroke="var(--ink-soft)" stroke-width="2.4" />
      ${milestoneFlagsSVG}${inspectedPinSVG}
      <circle cx="${dX(peakPt.age)}" cy="${dY(peakPt.portfolioBalance)}" r="3.5" fill="var(--ink-soft)" />
      <text x="${dX(peakPt.age)}" y="${Math.max(padT + 14, dY(peakPt.portfolioBalance) - 10)}" text-anchor="${markerAnchor(dX(peakPt.age))}" font-size="11.5" font-weight="700" fill="var(--ink-soft)" paint-order="stroke" stroke="var(--surface)" stroke-width="3" stroke-linejoin="round">Peak ${svgCompactMoney(peakPt.portfolioBalance)}</text>`;
    legend = `
      <span class="legend-item"><i class="legend-line is-portfolio" aria-hidden="true"></i> Portfolio + CPF OA</span>
      <span class="legend-item"><i class="legend-line is-retirement" aria-hidden="true"></i> Retirement at age ${summary.retire}</span>`;
  }

  chartArea.innerHTML = `
    <svg role="img" aria-label="${chartLabel}" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid meet">
      <defs>${defs}</defs>
      ${yTicks}${xTicks}${series}
      <line id="scrub-line" x1="0" y1="${padT}" x2="0" y2="${H - padB}" stroke="var(--primary)" stroke-width="1.6" stroke-dasharray="3,3" stroke-opacity="0.85" style="display:none;" />
      <line id="scrub-hline" x1="${padL}" y1="0" x2="${W - padR}" y2="0" stroke="var(--ink-soft)" stroke-width="1" stroke-dasharray="3,3" stroke-opacity="0.32" style="display:none;" />
      <circle id="scrub-dot-primary" cx="0" cy="0" r="4.5" fill="var(--primary)" stroke="var(--surface)" stroke-width="2" style="display:none;" />
      <circle id="scrub-dot-secondary" cx="0" cy="0" r="4" fill="var(--sem-cpf-ink)" stroke="var(--surface)" stroke-width="2" style="display:none;" />
    </svg>`;
  $("#chart-legend").innerHTML = legend;

  const tooltipEl = $("#chart-tooltip");
  const scrubLine = $("#scrub-line");
  const scrubHLine = $("#scrub-hline");
  const scrubDotPrimary = $("#scrub-dot-primary");
  const scrubDotSecondary = $("#scrub-dot-secondary");
  if (!chartWrapper || !scrubLine || !tooltipEl) return;

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

  const showPoint = (pt, svgRect, announce = false) => {
    if (!pt || !svgRect) return;
    const wrapRect = chartWrapper.getBoundingClientRect();
    const svgX = dX(pt.age);
    scrubLine.setAttribute("x1", svgX);
    scrubLine.setAttribute("x2", svgX);
    scrubLine.style.display = "block";
    const anchorY =
      chartMode === "portfolio"
        ? dY(pt.portfolioBalance)
        : dY(Math.max(pt.monthlySpend, pt.monthlyCPF));
    if (scrubHLine) {
      scrubHLine.setAttribute("y1", anchorY);
      scrubHLine.setAttribute("y2", anchorY);
      scrubHLine.style.display = "block";
    }
    if (scrubDotPrimary) {
      if (chartMode === "portfolio") {
        scrubDotPrimary.setAttribute("cx", svgX);
        scrubDotPrimary.setAttribute("cy", dY(pt.portfolioBalance));
        scrubDotPrimary.setAttribute("fill", "var(--ink-soft)");
        scrubDotPrimary.style.display = "block";
        if (scrubDotSecondary) scrubDotSecondary.style.display = "none";
      } else {
        scrubDotPrimary.setAttribute("cx", svgX);
        scrubDotPrimary.setAttribute("cy", dY(pt.monthlySpend));
        scrubDotPrimary.setAttribute("fill", "var(--ink-soft)");
        scrubDotPrimary.style.display = "block";
        if (scrubDotSecondary) {
          scrubDotSecondary.setAttribute("cx", svgX);
          scrubDotSecondary.setAttribute("cy", dY(pt.monthlyCPF));
          scrubDotSecondary.setAttribute("fill", "var(--sem-cpf-ink)");
          scrubDotSecondary.style.display = "block";
        }
      }
    }
    tooltipEl.hidden = false;
    tooltipEl.innerHTML = `
      <div class="tt-head">Age ${pt.age} (${pt.year})</div>
      ${
        isCashflow
          ? `
        <div class="tt-row"><span>Spending target</span><b>${m(pt.monthlySpend, "/mo")}</b></div>
        <div class="tt-row"><span>CPF LIFE</span><b class="sem-cpf">${m(pt.monthlyCPF, "/mo")}</b></div>
        ${pt.monthlyBridge > 0 ? `<div class="tt-row"><span>Work income</span><b>${m(pt.monthlyBridge, "/mo")}</b></div>` : ""}
        ${pt.monthlyGap > 0 ? `<div class="tt-row"><span>Needed from savings</span><b>${m(pt.monthlyGap, "/mo")}</b></div>` : ""}
      `
          : `<div class="tt-row"><span>Portfolio + CPF OA</span><b>${m(pt.portfolioBalance)}</b></div>`
      }
      <div class="tt-note">Select the age or press Enter for the year breakdown</div>`;
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
    if (announce) {
      announceChartStatus(
        isCashflow
          ? `Age ${pt.age}. Spending target ${compactMoney(pt.monthlySpend)}, CPF LIFE ${compactMoney(pt.monthlyCPF)}, work income ${compactMoney(pt.monthlyBridge)}, needed from savings ${compactMoney(pt.monthlyGap)} per month.`
          : `Age ${pt.age}. Portfolio plus CPF OA ${compactMoney(pt.portfolioBalance)}.`,
      );
    }
  };

  const handlePointer = (e) => {
    const resolved = resolveAgeFromEvent(e);
    if (!resolved) return;
    const { svgRect, targetAge } = resolved;
    const pt = points.find((p) => p.age === targetAge) || points[0];
    showPoint(pt, svgRect, false);
  };
  const throttledPointer = throttleRaf(handlePointer);
  const handleLeave = () => {
    throttledPointer.cancel();
    scrubLine.style.display = "none";
    if (scrubHLine) scrubHLine.style.display = "none";
    if (scrubDotPrimary) scrubDotPrimary.style.display = "none";
    if (scrubDotSecondary) scrubDotSecondary.style.display = "none";
    tooltipEl.hidden = true;
  };
  chartWrapper.onmousemove = throttledPointer;
  chartWrapper.ontouchmove = throttledPointer;
  chartWrapper.onmouseleave = handleLeave;
  chartWrapper.ontouchend = handleLeave;
  chartWrapper.ontouchcancel = handleLeave;
  chartArea.onclick = null;
  chartWrapper.onclick = (e) => {
    if (e.target.closest("button")) return;
    const resolved = resolveAgeFromEvent(e);
    if (resolved && typeof onTrajectoryInspectAge === "function") {
      onTrajectoryInspectAge(resolved.targetAge);
    }
  };
  bindChartKeyboard(chartArea, {
    count: points.length,
    initialIndex: Math.max(
      0,
      points.findIndex((p) => p.age >= summary.retire),
    ),
    onShow: (idx) => {
      const svgEl = $("#trajectory-chart svg");
      if (svgEl) showPoint(points[idx], svgEl.getBoundingClientRect(), true);
    },
    onLeave: handleLeave,
    onSelect: (idx) => {
      if (typeof onTrajectoryInspectAge === "function" && points[idx]) {
        onTrajectoryInspectAge(points[idx].age);
      }
    },
  });
}

const NW_SERIES = [
  {
    key: "cpf",
    name: "CPF",
    color: "var(--sem-cpf-ink)",
    dash: "",
    ttClass: "sem-cpf",
  },
  {
    key: "srs",
    name: "SRS",
    color: "var(--sem-srs)",
    dash: "2 3",
    ttClass: "sem-srs",
  },
  {
    key: "ssb",
    name: "Cash & bonds",
    color: "var(--sem-cash-ink)",
    dash: "6 3",
    ttClass: "sem-cash",
  },
  {
    key: "eq",
    name: "Equities",
    color: "var(--sem-equities)",
    dash: "8 3 2 3",
    ttClass: "sem-eq",
  },
];

const INCOME_SERIES = [
  { key: "cpf", name: "CPF LIFE", color: "var(--sem-cpf-ink)" },
  {
    key: "bridge",
    name: "Work income",
    color: "url(#work-income-pattern)",
    swatch: "is-work-income",
  },
  { key: "srs", name: "SRS used for spending", color: "var(--sem-srs)" },
  {
    key: "liquid",
    name: "Portfolio and OA withdrawals",
    color: "var(--ink-soft)",
  },
  { key: "shortfall", name: "Spending shortfall", color: "var(--sem-alert)" },
];

const TRAJECTORY_VIEWS = {
  cashflow: {
    title: "Monthly cashflow",
    note: "Spending before retirement is your reference budget. The amount needed from savings is what remains after CPF LIFE and work income.",
    monthly: true,
    columns: [
      ["monthlySpend", "Spending target"],
      ["monthlyCPF", "CPF LIFE"],
      ["monthlyBridge", "Work income"],
      ["monthlyGap", "Needed from savings"],
    ],
  },
  networth: {
    title: "Projected net worth",
    note: NET_WORTH_SCOPE,
    columns: [
      ["total", "Projected net worth"],
      ...NW_SERIES.map(({ key, name }) => [key, name]).reverse(),
    ],
  },
  waterfall: {
    title: "Income & withdrawals",
    note: "Spending before retirement is your reference budget. The SRS column shows after-tax withdrawals used for spending.",
    monthly: true,
    columns: [
      ["spend", "Spending target"],
      ...INCOME_SERIES.map(({ key, name }) => [key, name]),
    ],
  },
  portfolio: {
    title: "Portfolio + CPF OA",
    note: "Includes equities, cash and bonds, and SRS. Adds modeled CPF OA from age 55. SRS withdrawal rules still apply.",
    columns: [["portfolioBalance", "Portfolio + CPF OA"]],
  },
};

function netWorthSwatch({ color, dash }) {
  return `<svg class="legend-line" viewBox="0 0 18 8" aria-hidden="true"><path d="M0 4H18" stroke="${color}" stroke-width="3" stroke-dasharray="${dash || "none"}" /></svg>`;
}

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

function getNetWorthPoints(fire, basis) {
  return fire.points.map((pt) => {
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

  const pts = getNetWorthPoints(fire, basis);
  const compactPrint = Boolean(opts.compactPrint);
  const mobileW = getMobileChartWidth(chartArea, compactPrint);
  const isMobile = mobileW != null;
  const isOverviewHero = chartArea.id === "dash-networth-chart";
  const desktopW = isOverviewHero ? 720 : 860;
  const W = compactPrint
      ? 680
      : (mobileW ?? Math.min(chartArea.clientWidth || desktopW, desktopW)),
    H = compactPrint
      ? 154
      : isMobile
        ? isOverviewHero
          ? 276
          : 256
        : isOverviewHero
          ? 386
          : 322,
    padL = compactPrint ? 54 : isMobile ? 48 : isOverviewHero ? 58 : 76,
    padR = compactPrint ? 16 : isMobile ? 14 : isOverviewHero ? 20 : 34,
    padT = isOverviewHero ? 94 : compactPrint ? 61 : isMobile ? 74 : 76,
    padB = compactPrint ? 24 : isMobile ? 30 : isOverviewHero ? 32 : 40;
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
  const { maxVal, ticks } = niceAxis(rawMax, isMobile ? 3 : 4);
  const dY = (val) => padT + (1 - Math.max(0, val) / maxVal) * plotH;

  const yTicks = ticks
    .map(
      (v) =>
        `<line x1="${padL}" y1="${dY(v)}" x2="${W - padR}" y2="${dY(v)}" stroke="var(--chart-grid)" stroke-opacity="0.5" stroke-dasharray="3,3" />
         <text x="${padL - (isMobile ? 7 : 10)}" y="${dY(v) + 4}" text-anchor="end" class="chart-axis-label" fill="var(--ink-soft)">${svgCompactMoney(v)}</text>`,
    )
    .join("");

  const xTicksList = [];
  if (isOverviewHero) {
    for (let age = minAge; age <= maxAge; age += 10) xTicksList.push(age);
  } else {
    const candTicks = [20, 30, 35, 45, 55, 65, 75, 85, 90, 95, 100, 105].filter(
      (a) => a >= minAge && a <= maxAge,
    );
    if (!candTicks.includes(maxAge)) candTicks.push(maxAge);
    const xTickGap = isMobile ? 48 : 52;
    for (const a of candTicks) {
      if (!xTicksList.length || dX(a) - dX(xTicksList.at(-1)) >= xTickGap)
        xTicksList.push(a);
    }
    if (
      xTicksList.at(-1) !== maxAge &&
      dX(maxAge) - dX(xTicksList.at(-1)) >= (isMobile ? 28 : 32)
    ) {
      xTicksList.push(maxAge);
    }
  }
  const xTicks = xTicksList
    .map(
      (a) =>
        `<line x1="${dX(a)}" y1="${padT}" x2="${dX(a)}" y2="${H - padB}" stroke="var(--chart-grid)" stroke-opacity="0.3" />
         <text x="${dX(a)}" y="${H - padB + (isMobile ? 19 : 22)}" text-anchor="middle" class="chart-axis-label" fill="var(--ink-soft)">${a}</text>`,
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
        <path class="nw-band-stroke" d="${topLinePath((p) => p[soloSeries.key])}" fill="none" stroke="${soloSeries.color}" stroke-width="2.5" />
      </g>`
    : stackDefs
        .map(
          (band) => `<g class="nw-band" data-series="${band.key}">
            <path class="nw-band-fill" d="${areaPath(band.top, band.bot)}" fill="url(#${uid}-grad-${band.key})" />
            <path class="nw-band-stroke" d="${topLinePath(band.top)}" fill="none" stroke="${band.color}" stroke-dasharray="${band.dash || "none"}" stroke-width="1.85" stroke-linejoin="round" />
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
    rowYs: isOverviewHero
      ? [15, 36, 57, 78]
      : compactPrint
        ? [15, 31, 47]
        : isMobile
          ? [14, 30, 46, 62]
          : [18, 36, 54, 72],
    compactPrint,
    isMobile,
    saLabel: "55 SA Closure",
    saStyle: {
      color: "var(--sem-cpf-ink)",
      bg: "var(--sem-cpf-soft)",
      border: "var(--sem-cpf-border)",
    },
    srsLabelSuffix: "SRS",
    includeAge55AtMin: true,
    emphasize: isOverviewHero,
  });

  const valForCallout = (pt) => (soloSeries ? pt[soloSeries.key] : pt.total);
  const calloutAges = [fire.retire, 65, maxAge].filter(
    (a, idx, arr) =>
      arr.indexOf(a) === idx &&
      (!isOverviewHero || soloSeries || (a !== fire.retire && a !== maxAge)) &&
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
      const pillW = Math.max(
        compactPrint ? 56 : 44,
        labelText.length * (compactPrint ? 8.5 : isOverviewHero ? 7.6 : 6.6) +
          12,
      );
      const pillH = compactPrint || isOverviewHero ? 18 : 17;
      const pillX = Math.max(
        padL + 2,
        Math.min(
          W - padR - pillW - 2,
          anchor === "end" ? x - pillW + 4 : x - pillW / 2,
        ),
      );
      const x1 = pillX;
      const x2 = pillX + pillW;
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
      const pillY = labelY - (compactPrint ? 15 : isOverviewHero ? 13 : 12);
      return `<circle cx="${x}" cy="${dotY}" r="3.5" fill="${dotColor}" stroke="var(--surface)" stroke-width="1.5" />
        ${showLabel ? `<g class="nw-callout-pill"><rect x="${pillX.toFixed(1)}" y="${pillY.toFixed(1)}" width="${pillW.toFixed(1)}" height="${pillH}" rx="4.5" fill="var(--surface)" fill-opacity="0.94" stroke="var(--border-strong)" stroke-width="1" /><text x="${(pillX + pillW / 2).toFixed(1)}" y="${labelY}" text-anchor="middle" font-size="${compactPrint ? 14 : isOverviewHero ? 12.5 : 11}" font-weight="700" fill="var(--ink)">${pillText}</text></g>` : ""}`;
    })
    .join("");

  const scrubDotsSVG = (soloSeries ? [soloSeries] : NW_SERIES)
    .map(
      (sItem) =>
        `<circle class="nw-scrub-dot" data-series="${sItem.key}" cx="0" cy="0" r="4" fill="${sItem.color}" stroke="var(--surface)" stroke-width="1.75" style="display:none;" />`,
    )
    .join("");

  const nwLabel = `${soloSeries?.name || "Projected net worth"} from age ${minAge} to ${maxAge} in ${formatDollarBasis(basis)}`;
  chartArea.innerHTML = `
    <svg role="img" aria-label="${nwLabel}" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid meet">
      ${gradientsSVG}
      ${yTicks}${xTicks}
      ${bandsSVG}
      ${milestoneSVG}
      ${calloutsSVG}
      <line class="nw-scrub-line" x1="0" y1="${padT}" x2="0" y2="${H - padB}" stroke="var(--swell-pink)" stroke-width="1.6" stroke-dasharray="3,3" style="display:none;" />
      <line class="nw-scrub-hline" x1="${padL}" y1="0" x2="${W - padR}" y2="0" stroke="var(--ink-soft)" stroke-width="1" stroke-dasharray="3,3" stroke-opacity="0.32" style="display:none;" />
      ${scrubDotsSVG}
    </svg>`;

  if (legendEl) {
    if (interactive) {
      legendEl.innerHTML = `
        <button type="button" class="legend-chip${!soloSeries ? " is-active" : ""}" data-series="all" aria-pressed="${!soloSeries}">
          All assets
        </button>
        ${[...NW_SERIES]
          .reverse()
          .map((sItem) => {
            const isSel = soloSeries?.key === sItem.key;
            return `<button type="button" class="legend-chip${isSel ? " is-active" : ""}" data-series="${sItem.key}" aria-pressed="${isSel}">
              ${netWorthSwatch(sItem)}
              <span>${sItem.name}</span>
            </button>`;
          })
          .join("")}`;
    } else {
      legendEl.innerHTML = [...NW_SERIES]
        .reverse()
        .map(
          (sItem) =>
            `<span class="legend-item">${netWorthSwatch(sItem)} ${sItem.name}</span>`,
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
    const focusedSeries = legendEl?.contains(document.activeElement)
      ? document.activeElement.dataset.series
      : null;
    renderStackedNetWorthSVG(chartArea, tooltipEl, legendEl, fire, basis, opts);
    if (focusedSeries) {
      legendEl
        .querySelector(`[data-series="${focusedSeries}"]`)
        ?.focus({ preventScroll: true });
    }
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

  if (chartArea.id === "trajectory-chart" && chartArea.parentElement) {
    chartArea.parentElement.onclick = null;
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
        const left = svgRect.left + (padL / W) * svgRect.width;
        const width = (plotW / W) * svgRect.width;
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
    const left = svgRect.left + (padL / W) * svgRect.width;
    const width = Math.max(1, (plotW / W) * svgRect.width);
    const frac = Math.max(0, Math.min(1, (cx - left) / width));
    const targetAge = Math.round(minAge + frac * (maxAge - minAge));
    const pt = pts.find((p) => p.age === targetAge) || pts[0];
    const sx = dX(pt.age);
    scrub.setAttribute("x1", sx);
    scrub.setAttribute("x2", sx);
    scrub.style.display = "block";

    const scrubH = chartArea.querySelector(".nw-scrub-hline");
    if (scrubH) {
      const topVal = soloSeries ? pt[soloSeries.key] : pt.total;
      const hy = dY(topVal);
      scrubH.setAttribute("y1", hy);
      scrubH.setAttribute("y2", hy);
      scrubH.style.display = "block";
    }

    const bandTarget = e?.target?.closest?.(".nw-band");
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
      <div class="tt-row is-highlighted"><span>${soloSeries.name}</span><b class="${soloSeries.ttClass}">${m(pt[soloSeries.key])}</b></div>
      <div class="tt-row"><span>Projected net worth</span><b>${m(pt.total)}</b></div>`
      : `
      <div class="tt-head">Age ${pt.age} (${pt.year})</div>
      <div class="tt-row"><span>Projected net worth</span><b>${m(pt.total)}</b></div>
      <div class="tt-row${hoveredKey === "eq" ? " is-highlighted" : ""}"><span>Equities</span><b class="sem-eq">${m(pt.eq)}</b></div>
      <div class="tt-row${hoveredKey === "ssb" ? " is-highlighted" : ""}"><span>Cash &amp; bonds</span><b class="sem-cash">${m(pt.ssb)}</b></div>
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
    const scrubH = chartArea.querySelector(".nw-scrub-hline");
    if (scrubH) scrubH.style.display = "none";
    const svg = chartArea.querySelector("svg");
    svg?.querySelectorAll(".nw-scrub-dot").forEach((dot) => {
      dot.style.display = "none";
    });
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
  bindChartKeyboard(chartArea, {
    count: pts.length,
    initialIndex: Math.max(
      0,
      pts.findIndex((p) => p.age >= fire.retire),
    ),
    onShow: (idx) => {
      const svg = chartArea.querySelector("svg");
      const pt = pts[idx];
      if (!svg || !pt) return;
      const svgRect = svg.getBoundingClientRect();
      if (!svgRect.width || !svgRect.height) return;
      const sx = dX(pt.age);
      const clientX = svgRect.left + (sx / W) * svgRect.width;
      const clientY = svgRect.top + (dY(pt.total) / H) * svgRect.height;
      onMove({ clientX, clientY });
      announceChartStatus(
        `Age ${pt.age}: projected net worth ${compactMoney(pt.total)}, CPF ${compactMoney(pt.cpf)}, equities ${compactMoney(pt.eq)}, cash and bonds ${compactMoney(pt.ssb)}, SRS ${compactMoney(pt.srs)} in ${formatDollarBasis(basis)}.`,
      );
    },
    onLeave: handleLeave,
    onSelect: (idx) => {
      if (
        chartArea.id === "trajectory-chart" &&
        typeof onTrajectoryInspectAge === "function" &&
        pts[idx]
      ) {
        onTrajectoryInspectAge(pts[idx].age);
      }
    },
  });
}

function getIncomePoints(fire, basis) {
  const startAge = Math.max(fire.age, Math.min(50, fire.retire));
  return fire.points
    .filter((pt) => pt.age >= startAge)
    .map((pt) => {
      const src = basis === "today" ? pt.today : pt;
      const retired = pt.age >= fire.retire;
      const cpf = retired ? src.monthlyCpfLife : 0;
      const bridge = retired ? src.monthlyBridge : 0;
      const liquid = retired ? src.monthlyLiquidDraw : 0;
      return {
        age: pt.age,
        year: pt.year,
        spend: src.monthlySpend,
        cpf,
        bridge,
        liquid,
        srs: retired ? getSrsUsedForSpending(src) : 0,
        shortfall: retired ? src.monthlyShortfall : 0,
      };
    });
}

function renderCashflowWaterfallSVG(
  chartArea,
  tooltipEl,
  legendEl,
  fire,
  pts,
  chartLabel,
) {
  const startAge = pts[0].age;
  const endAge = pts.at(-1).age;
  const mobileW = getMobileChartWidth(chartArea, false);
  const isMobile = mobileW != null;
  const W = mobileW ?? Math.min(chartArea.clientWidth || 760, 760),
    H = isMobile ? 256 : 304,
    padL = isMobile ? 52 : 78,
    padR = isMobile ? 14 : 26,
    padT = isMobile ? 74 : 60,
    padB = isMobile ? 32 : 40;
  const plotW = W - padL - padR,
    plotH = H - padT - padB;
  const rawMax = Math.max(
    1000,
    ...pts.map((p) =>
      Math.max(p.spend, p.cpf + p.bridge + p.srs + p.liquid + p.shortfall),
    ),
  );
  const { maxVal, ticks } = niceAxis(rawMax, isMobile ? 3 : 4);
  const dY = (val) => padT + (1 - Math.max(0, val) / maxVal) * plotH;
  const stepX = plotW / pts.length;
  const barW = Math.max(
    isMobile ? 3 : 4,
    Math.min(isMobile ? 14 : 18, stepX * 0.72),
  );
  const barX = (i) => padL + i * stepX + (stepX - barW) / 2;
  const centerX = (i) => padL + i * stepX + stepX / 2;

  const yTicks = ticks
    .map(
      (v) =>
        `<line x1="${padL}" y1="${dY(v)}" x2="${W - padR}" y2="${dY(v)}" stroke="var(--chart-grid)" stroke-opacity="0.5" stroke-dasharray="3,3" />
         <text x="${padL - (isMobile ? 7 : 10)}" y="${dY(v) + 4}" text-anchor="end" class="chart-axis-label" fill="var(--ink-soft)">${isMobile || maxVal >= 10000 ? svgCompactMoney(v) : svgMoney(v)}</text>`,
    )
    .join("");

  let lastWfLabelX = -Infinity;
  const wfMinLabelGap = isMobile ? 38 : 0;
  const xLabels = pts
    .map((p, i) => {
      const isEndpoint = p.age === startAge || p.age === endAge;
      const stepMod = isMobile ? 10 : 5;
      const isStep =
        p.age % stepMod === 0 &&
        Math.abs(p.age - startAge) > 1 &&
        Math.abs(p.age - endAge) > 1;
      if (!isEndpoint && !isStep) return "";
      const cx = centerX(i);
      if (isMobile && !isEndpoint && cx - lastWfLabelX < wfMinLabelGap) {
        return "";
      }
      if (isMobile && p.age === endAge && cx - lastWfLabelX < 24) {
        return "";
      }
      lastWfLabelX = cx;
      return `<text x="${cx}" y="${H - padB + (isMobile ? 20 : 22)}" text-anchor="middle" class="chart-axis-label" fill="var(--ink-soft)">${p.age}</text>`;
    })
    .join("");

  const visibleSeries = INCOME_SERIES.filter(({ key }) =>
    pts.some((point) => point[key] > 0.005),
  );
  const bars = pts
    .map((point, index) => {
      let lower = 0;
      return visibleSeries
        .map(({ key, color }) => {
          const amount = point[key];
          if (amount <= 0.005) return "";
          const upper = lower + amount;
          const segment = `<rect data-income-series="${key}" data-age="${point.age}" x="${barX(index)}" y="${dY(upper)}" width="${barW}" height="${dY(lower) - dY(upper)}" fill="${color}" />`;
          lower = upper;
          return segment;
        })
        .join("");
    })
    .join("");

  const spendLine = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${centerX(i)} ${dY(p.spend)}`)
    .join(" ");

  const showSrs = visibleSeries.some(({ key }) => key === "srs");
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
    rowYs: isMobile ? [14, 30, 46, 62] : [16, 35, 54],
    isMobile,
  });

  chartArea.innerHTML = `
    <svg role="img" aria-label="${chartLabel}" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid meet">
      <defs>
        <pattern id="work-income-pattern" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <path d="M0 0V4" fill="none" stroke="var(--ink)" stroke-width="3" />
        </pattern>
      </defs>
      ${yTicks}${xLabels}${bars}
      <path d="${spendLine}" fill="none" stroke="var(--ink)" stroke-width="2" stroke-dasharray="6,3" />
      ${markers}
      <line class="wf-scrub-line" x1="0" y1="${padT}" x2="0" y2="${H - padB}" stroke="var(--swell-pink)" stroke-width="1.6" stroke-dasharray="3,3" style="display:none;" />
      <line class="wf-scrub-hline" x1="${padL}" y1="0" x2="${W - padR}" y2="0" stroke="var(--ink-soft)" stroke-width="1" stroke-dasharray="3,3" stroke-opacity="0.32" style="display:none;" />
    </svg>`;

  if (legendEl) {
    legendEl.innerHTML = `
      <span class="legend-item"><i class="legend-line is-spending" aria-hidden="true"></i> Spending target</span>
      ${visibleSeries
        .map(
          ({ name, color, swatch = "" }) => `
        <span class="legend-item"><i class="legend-swatch ${swatch}" style="background-color:${swatch ? "var(--surface)" : color}" aria-hidden="true"></i> ${name}</span>`,
        )
        .join("")}`;
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
    const scrubH = chartArea.querySelector(".wf-scrub-hline");
    if (scrubH) {
      const hy = dY(pt.spend);
      scrubH.setAttribute("y1", hy);
      scrubH.setAttribute("y2", hy);
      scrubH.style.display = "block";
    }
    tooltipEl.hidden = false;
    tooltipEl.innerHTML = `
      <div class="tt-head">Age ${pt.age} (${pt.year})</div>
      <div class="tt-row"><span>Spending target</span><b>${m(pt.spend, "/mo")}</b></div>
      ${
        pt.age < fire.retire
          ? '<div class="tt-note">Before retirement</div>'
          : visibleSeries
              .map(
                ({ key, name }) => `
          <div class="tt-row${key === "shortfall" ? " tt-alert" : ""}"><span>${name}</span><b>${m(pt[key], "/mo")}</b></div>`,
              )
              .join("")
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
    const scrubH = chartArea.querySelector(".wf-scrub-hline");
    if (scrubH) scrubH.style.display = "none";
    tooltipEl.hidden = true;
  };
  wrap.onmousemove = throttledMove;
  wrap.ontouchmove = throttledMove;
  wrap.onmouseleave = onLeave;
  wrap.ontouchend = onLeave;
  wrap.ontouchcancel = onLeave;
  bindChartKeyboard(chartArea, {
    count: pts.length,
    initialIndex: Math.max(
      0,
      pts.findIndex((p) => p.age >= fire.retire),
    ),
    onShow: (idx) => {
      const svg = chartArea.querySelector("svg");
      const pt = pts[idx];
      if (!svg || !pt) return;
      const svgRect = svg.getBoundingClientRect();
      if (!svgRect.width || !svgRect.height) return;
      const sx = centerX(idx);
      const clientX = svgRect.left + (sx / W) * svgRect.width;
      onMove({ clientX });
      announceChartStatus(
        `Age ${pt.age}: spending target ${compactMoney(pt.spend)} per month. ${visibleSeries.map(({ key, name }) => `${name} ${compactMoney(pt[key])}`).join(", ")}.`,
      );
    },
    onLeave,
    onSelect: (idx) => {
      if (
        chartArea.id === "trajectory-chart" &&
        typeof onTrajectoryInspectAge === "function" &&
        pts[idx]
      ) {
        onTrajectoryInspectAge(pts[idx].age);
      }
    },
  });
  if (chartArea.id === "trajectory-chart") {
    chartArea.onclick = null;
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
