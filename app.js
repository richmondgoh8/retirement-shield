const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const fmtInt = (value) =>
  Math.round(Math.max(0, value) || 0).toLocaleString("en-SG");
const money = (value) => `$${fmtInt(value)}`;
const m = (value, suffix = "", animKey = "") => {
  const numVal = Math.round(Math.max(0, value) || 0);
  const animAttr = animKey
    ? ` data-anim-key="${animKey}" data-anim-val="${numVal}"`
    : "";
  return `<span class="curr-wrap"${animAttr}><span class="curr-prefix">$</span><span class="curr-num">${numVal.toLocaleString("en-SG")}</span>${suffix ? `<span class="curr-suffix">${suffix}</span>` : ""}</span>`;
};
const centsHtml = (value) => {
  const num = Math.max(0, Number(value) || 0);
  const parts = num
    .toLocaleString("en-SG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    .split(".");
  const hasCents = parts[1] !== "00";
  return `<span class="curr-wrap"><span class="curr-prefix">$</span><span class="curr-num">${parts[0]}</span>${hasCents ? `<span class="curr-dec">.${parts[1]}</span>` : ""}</span>`;
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

const KPI_ICONS = {
  age: svgWrap(
    '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v4.5l3 1.8"/>',
    16,
  ),
  goal: svgWrap(
    '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/>',
    16,
  ),
  salary: svgWrap(
    '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M7 9h.01M17 15h.01"/>',
    16,
  ),
  balances: svgWrap(
    '<path d="M12 21s7-3.5 7-9V5l-7-2.5L5 5v7c0 5.5 7 9 7 9z"/><path d="M9 14v-2.5"/><path d="M12 14v-4.5"/><path d="M15 14V8"/>',
    16,
  ),
  budget: svgWrap(
    '<path d="m4 10.5 8-6.5 8 6.5"/><path d="M6 9.5V19a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9.5"/><path d="M10 20v-5h4v5"/>',
    16,
  ),
};
KPI_ICONS.clock = KPI_ICONS.age;
KPI_ICONS.star = KPI_ICONS.goal;
KPI_ICONS.chat = KPI_ICONS.salary;
KPI_ICONS.shield = KPI_ICONS.balances;
KPI_ICONS.wallet = KPI_ICONS.budget;

function buildSmoothSpline(coords, minY, maxY) {
  if (!coords.length) return "";
  if (coords.length === 1) return `M ${coords[0].x} ${coords[0].y}`;
  const clampY = (y) => Math.max(minY, Math.min(maxY, y));
  let d = `M ${coords[0].x.toFixed(1)} ${clampY(coords[0].y).toFixed(1)}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[Math.max(0, i - 1)];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[Math.min(coords.length - 1, i + 2)];
    const tension = 0.22;
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = clampY(p1.y + (p2.y - p0.y) * tension);
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = clampY(p2.y - (p3.y - p1.y) * tension);
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${clampY(p2.y).toFixed(1)}`;
  }
  return d;
}

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

function syncCustomBudgetReset(opts = {}) {
  const selected = $("#known-lifestyle")?.value || "cca";
  const amount = RetirementModel.lifestyles[selected]?.budget || 2800;
  const custom = $("#known-spend");
  if (!custom) return;
  custom.placeholder = String(amount);
  const rawCustom = (custom.value || "").trim();
  const hasNumericDiff =
    rawCustom !== "" &&
    custom.validity.valid &&
    Number.isFinite(Number(rawCustom)) &&
    Math.round(Number(rawCustom) * 100) !== Math.round(amount * 100);
  const hasCustom = Boolean(
    hasNumericDiff || opts.customBudgetActive || opts.useItemizedExpenses,
  );
  const reset = $("#use-preset-budget");
  if (reset) {
    reset.hidden = !hasCustom;
    reset.textContent = `Reset to ${selected === "cca" ? "CCA ($2,800)" : "Home + Helper ($3,900)"} preset`;
  }
  const itemizedNote = $("#settings-itemized-note");
  if (itemizedNote) {
    const count = Number(opts.itemizedCount || 0);
    itemizedNote.hidden = !opts.useItemizedExpenses;
    if (opts.useItemizedExpenses) {
      const span = itemizedNote.querySelector("span");
      if (span) {
        span.textContent = `Driven by ${count || "custom"} itemized expense item${count === 1 ? "" : "s"} (${money(Number(rawCustom || amount))}/mo).`;
      }
    }
  }
  const cashNote = $("#settings-cash-accounts-note");
  const cashOpenBtn = $("#open-cash-breakdown-settings");
  if (cashNote) {
    const active = Boolean(opts.useItemizedCashAccounts);
    const count = Number(opts.cashAccountsCount || 0);
    cashNote.hidden = !active;
    if (cashOpenBtn) {
      cashOpenBtn.textContent = active
        ? `Edit ${count || "custom"} bank & SSB account${count === 1 ? "" : "s"} →`
        : "Break down bank accounts & $100k caps →";
    }
    if (active) {
      const span = cashNote.querySelector("span");
      if (span) {
        const rawCash = ($("#known-ssb-cash")?.value || "").trim();
        const eirStr =
          opts.cashEffectiveRatePct != null
            ? ` @ ${Number(opts.cashEffectiveRatePct).toFixed(2)}% EIR`
            : "";
        span.textContent = `Driven by ${count || "multiple"} cash & SSB account${count === 1 ? "" : "s"} (${money(Number(rawCash || 0))}${eirStr}).`;
      }
    }
  }
}

function bindDialogBackdropDismiss(dialog) {
  if (!dialog) return;
  let backdropPointerDown = false;
  dialog.addEventListener("pointerdown", (event) => {
    const r = dialog.getBoundingClientRect();
    backdropPointerDown =
      event.target === dialog &&
      (event.clientX < r.left ||
        event.clientX > r.right ||
        event.clientY < r.top ||
        event.clientY > r.bottom);
  });
  dialog.addEventListener("click", (event) => {
    const shouldClose = backdropPointerDown;
    backdropPointerDown = false;
    if (!shouldClose || event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    ) {
      dialog.close();
    }
  });
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
      ${summary.retire < 65 ? `<line x1="${retireX}" y1="${padT}" x2="${retireX}" y2="${H - padB}" stroke="#E83E8C" stroke-width="1.6" stroke-dasharray="4,3" /><text x="${retireX}" y="${padT - 20}" text-anchor="${markerAnchor(retireX)}" font-size="11.5" font-weight="600" fill="#E83E8C">Retire ${summary.retire}</text>` : ""}
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
      <line x1="${retireX}" y1="${padT}" x2="${retireX}" y2="${H - padB}" stroke="#E83E8C" stroke-width="1.6" stroke-dasharray="4,3" />
      <text x="${retireX}" y="${padT - 18}" text-anchor="${markerAnchor(retireX)}" font-size="11.5" font-weight="600" fill="#E83E8C">Retire ${summary.retire}</text>
      <circle cx="${dX(peakPt.age)}" cy="${dY(peakPt.portfolioBalance)}" r="3.5" fill="#2563EB" />
      <text x="${dX(peakPt.age)}" y="${Math.max(padT + 14, dY(peakPt.portfolioBalance) - 10)}" text-anchor="${markerAnchor(dX(peakPt.age))}" font-size="11.5" font-weight="700" fill="#2563EB" paint-order="stroke" stroke="var(--surface)" stroke-width="3" stroke-linejoin="round">Peak ${svgCompactMoney(peakPt.portfolioBalance)}</text>`;
    legend = `
      <span class="legend-item"><i class="legend-swatch" style="background:#2563EB;"></i> Outside Portfolio Balance</span>
      <span class="legend-item"><i class="legend-swatch" style="background:#E83E8C;"></i> Target Retirement Age ${summary.retire}</span>`;
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
      title: fire.age < 55 ? "CPF Consolidation" : "RA Locked Floor",
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
      badge: String(pt95?.age ?? 95),
      tag: `Age 75→${pt95?.age ?? 95}`,
      title: fire.fireNumber.fullyFundedTo95
        ? "Age 95+ Runway"
        : `Funded to ${Math.floor(fire.fireNumber.depletionAge ?? 90)}`,
      metric: m(pt95?.today?.totalNetWorth ?? 0),
      pill: fire.fireNumber.fullyFundedTo95 ? "Sustained" : "Watch Gap",
      sub: `Spend ${money(pt75?.today?.monthlySpend ?? r.spend75)}/mo · CPF ${money(s.payout)}/mo`,
      color: fire.fireNumber.fullyFundedTo95 ? "#7C3AED" : "#B91C1C",
      softBg: fire.fireNumber.fullyFundedTo95 ? "#F5F3FF" : "#FEF2F2",
    },
  ];
}

function buildFundingSourcesList(taps, r, s, cpfCovPct) {
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
        icon: svgWrap("<path d=\"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z\"/><path d=\"m9 12 2 2 4-4\"/>", 16),
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
        icon: svgWrap("<rect x=\"3\" y=\"4\" width=\"18\" height=\"16\" rx=\"2\"/><path d=\"M3 10h18\"/><path d=\"M8 2v4\"/><path d=\"M16 2v4\"/>", 16),
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
        icon: svgWrap("<polyline points=\"22 7 13.5 15.5 8.5 10.5 2 17\"/><polyline points=\"16 7 22 7 22 13\"/>", 16),
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
        icon: svgWrap("<path d=\"M3 21h18\"/><path d=\"M3 10h18\"/><path d=\"M5 6l7-3 7 3\"/><path d=\"M4 10v11\"/><path d=\"M20 10v11\"/><path d=\"M8 14v3\"/><path d=\"M12 14v3\"/><path d=\"M16 14v3\"/>", 16),
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
        icon: svgWrap("<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M9 15l6-6\"/><circle cx=\"9.5\" cy=\"9.5\" r=\".5\" fill=\"currentColor\"/><circle cx=\"14.5\" cy=\"14.5\" r=\".5\" fill=\"currentColor\"/>", 16),
      },
    ],
  };
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
  expenseData = null,
  masRates = null,
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
    masRates,
    basis,
  });

  const pipeRows = pm.paycheck.rows;
  const grossPlusEmp = pm.paycheck.grossPlusEmployer;
  const milestones = getMilestoneNodes(fire, r, s, simulation);
  const pt95 = fire?.points?.[fire.points.length - 1];
  const pt55 =
    fire?.points?.find((pt) => pt.age === (fire.age < 55 ? 55 : fire.age)) ||
    fire?.points?.[0];
  const sa = pm.startingAssets;
  const startingCpf = sa.cpfTotal;
  const startingLiquid = sa.liquidOutside;
  const startingSrs = sa.srs;
  const startingTotalAssets = sa.totalAssets;
  const yearsToRetire = Math.max(0, fire.retire - fire.age);
  const takeHomePctOfGross =
    r.salary > 0 ? Math.round((r.afterCpf / r.salary) * 100) : 0;
  const selectedPathName =
    s.key === "salary"
      ? "Salary CPF"
      : s.key === "frs"
        ? "FRS Path"
        : "ERS Path";
  const isCustomBudget = Boolean(pm.isCustomBudget);
  const isItemizedTarget = Boolean(
    p?.itemizedActive || expenseData?.itemizedActive,
  );
  const srsAnnualVal = Math.max(0, Number(p?.srsAnnual || 0));
  const annualBonusVal = Math.max(0, Number(p?.annualBonus || 0));
  const maSpendVal = Math.max(0, Number(p?.maSpend || 0));
  const existingReliefsVal = Number(p?.existingReliefs ?? 1000);
  const reserveReturnNum = Number(p?.reserveReturn || 0);
  const srsLockAge = Number(p?.srsAge || 63);
  const srsInvestLabel =
    p?.srsInvestedIn === "cash"
      ? "0.05% Cash!"
      : p?.srsInvestedIn === "ssb"
        ? "SSB"
        : p?.srsInvestedIn === "balanced"
          ? "60/40"
          : "Global ETF";

  const taps = pm.taps;
  const { fundingSources } = buildFundingSourcesList(taps, r, s, pm.cpfCovPct);

  const fn = fire.fireNumber || {};
  const projFireAge = fn.projectedFireAge;
  const diffYears = projFireAge == null ? null : fire.retire - projFireAge;
  const depletionAgeDisplay =
    fn.depletionAge != null ? Math.floor(fn.depletionAge) : 90;
  const survivalAnswer = fn.fullyFundedTo95
    ? "Lasts past age 95+"
    : `Lasts to age ${depletionAgeDisplay}`;
  const safeAgeAnswer =
    diffYears == null
      ? "After age 80"
      : diffYears > 0
        ? `Age ${projFireAge} (-${diffYears} yr${diffYears > 1 ? "s" : ""} early)`
        : diffYears === 0
          ? `Age ${projFireAge} (on target)`
          : `Age ${projFireAge} (+${-diffYears} yr${-diffYears > 1 ? "s" : ""})`;
  const deltaLine = `${pm.pctFunded}% of age-95 goal`;
  const deltaColor =
    diffYears != null && diffYears >= 0 && pm.onTrack ? "#047857" : "#B45309";

  const ep =
    expenseData ||
    RetirementModel.expensePlan({
      lifestyle: r.lifestyle,
      spend: r.todaySpend,
      itemizedActive: false,
      customExpenses: [],
      afterCpf: r.afterCpf,
      customActive: isCustomBudget,
    });

  const formatCheckpointSub = (mn, idx) => {
    if (idx === 1 && fire.age < 55) {
      return `Age 55 · NW ${compactMoney(pt55?.today?.totalNetWorth ?? 0)}`;
    }
    if (idx === 3 && !pm.fullyFundedTo95) {
      const liq95 =
        (pt95?.today?.liquidEquities ?? 0) + (pt95?.today?.ssbCash ?? 0);
      const cpf95 = pt95?.today?.cpfTotal ?? 0;
      return liq95 <= 1
        ? `Liquid $0 · ${compactMoney(cpf95)} CPF`
        : `${mn.tag} · ${mn.sub}`;
    }
    return `${mn.tag}`;
  };

  const budgetHeaderSub =
    r.retire < 65
      ? `Age ${r.retire}: ${money(r.futureSpend)}/mo · Age 65: ${money(r.spend65)}/mo`
      : `Age 65 est: ${money(r.spend65)}/mo`;

  const assetBreakdownItems = [];
  assetBreakdownItems.push(
    `<span><b>CPF ${compactMoney(startingCpf)}</b> (OA ${compactMoney(sa.oa)} · SA ${compactMoney(sa.sa)} · MA ${compactMoney(sa.ma)}${sa.saInvested > 0 ? ` · CPFIS-SA ${compactMoney(sa.saInvested)} room` : ""})</span>`,
  );
  assetBreakdownItems.push(
    `<span><b>Outside ${compactMoney(sa.outsideTotal)}</b> (Global Eq ${compactMoney(sa.equities)} · SG Div ${compactMoney(sa.sgDividends)} · Cash/SSB ${compactMoney(sa.ssbCash)}${startingSrs > 0 ? ` · SRS ${compactMoney(startingSrs)}` : ""})</span>`,
  );

  printContainer.innerHTML = `
    <div class="poster-sheet">
      <header class="poster-masthead">
        <div class="poster-brand-row">
          <div class="poster-title-block">
            <div class="poster-brand-lockup">
              <span class="poster-brand-badge" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 2.5l7.5 3.3v5.7c0 5-3.2 9.4-7.5 11-4.3-1.6-7.5-6-7.5-11V5.8L12 2.5z" />
                  <path d="M9 14.5v-3M12 14.5V9.5M15 14.5V7.5" />
                </svg>
              </span>
              <span class="poster-wordmark">Retirement<strong>Shield</strong></span>
              <span class="poster-kicker">SINGAPORE RETIREMENT &amp; CPF BLUEPRINT</span>
            </div>
            <h1>Retirement Readiness &amp; CPF Overview</h1>
            <div class="poster-chips">
              <span>Age ${r.age} → ${r.retire}</span>
              <span>Gross ${money(r.salary)} · Net ${money(r.afterCpf)}/mo${annualBonusVal > 0 ? ` · Bonus ${money(annualBonusVal)}/yr` : ""}</span>
              <span>${pm.budgetChipLabel}</span>
              <span>CPF LIFE ${r.plan === "escalating" ? "Escalating +2%" : "Standard"}</span>
              <span>${pm.housingChipLabel}</span>
              ${srsAnnualVal > 0 || startingSrs > 0 ? `<span class="${sa.srsIdleActive ? "is-warn-chip" : ""}">SRS ${srsAnnualVal > 0 ? `${money(srsAnnualVal)}/yr` : compactMoney(startingSrs)} · ${srsInvestLabel} · Age ${srsLockAge}</span>` : ""}
              ${maSpendVal > 0 ? `<span>MA deduct ${money(maSpendVal)}/yr${r.maShortfallToday > 0 ? ` (Shortfall ${compactMoney(r.maShortfallToday)})` : ""}</span>` : ""}
              ${existingReliefsVal !== 1000 ? `<span>Reliefs ${money(existingReliefsVal)}/yr</span>` : ""}
              ${reserveReturnNum > 0 ? `<span>Reserve +${(reserveReturnNum * 100).toFixed(1).replace(/\.0$/, "")}%</span>` : ""}
            </div>
          </div>
          <div class="poster-verdict-badge is-${pm.statusTone}">
            <small>PLAN STATUS</small>
            <strong>${pm.pctFunded}% · ${pm.statusText}</strong>
            <span>${pm.verdictSub}</span>
          </div>
        </div>
      </header>

      <section class="poster-snapshot-banner" aria-label="Plan Snapshot">
        <div class="poster-kpi-strips">
          <div class="poster-stat-strip">
            <small>Your Age</small>
            <div><strong>${fire.age} yrs</strong><span class="poster-pill">${p?.dob ? `DOB ${formatDobShort(p.dob)}` : "Current"}</span></div>
          </div>
          <div class="poster-stat-strip">
            <small>Target Retire Age</small>
            <div><strong>Age ${fire.retire}</strong><span class="poster-pill">${r.retiringNow ? "Now" : `${yearsToRetire} yrs`} · ${fire.retire < 65 ? `${65 - fire.retire}-yr bridge` : fire.retire === 65 ? "CPF LIFE" : "Deferred"}</span></div>
          </div>
          <div class="poster-stat-strip">
            <small>Take-Home Pay</small>
            <div><strong>${m(r.afterCpf, "/mo")}</strong><span class="poster-pill">${takeHomePctOfGross}% net on ${money(r.salary)}</span></div>
          </div>
          <div class="poster-stat-strip">
            <small>Total Assets</small>
            <div><strong>${m(startingTotalAssets)}</strong><span class="poster-pill">${compactMoney(startingCpf)} CPF · ${compactMoney(startingLiquid)} liq${startingSrs > 0 ? ` · ${compactMoney(startingSrs)} SRS` : ""}</span></div>
          </div>
          <div class="poster-stat-strip">
            <small>Retire Budget</small>
            <div><strong>${m(r.todaySpend, "/mo")}</strong><span class="poster-pill">${selectedPathName} · ${isItemizedTarget ? "Itemized" : isCustomBudget ? "Custom" : r.lifestyle === "cca" ? "CCA" : "Helper"}</span></div>
          </div>
        </div>
        <div class="poster-balances-strip" aria-label="Starting Asset Breakdown">
          <span class="poster-balances-tag">Starting Balances</span>
          ${assetBreakdownItems.join(`<span class="poster-balances-sep" aria-hidden="true">·</span>`)}
        </div>
      </section>

      <section class="poster-discover-row">
        <div class="poster-chart-card poster-nw-card">
          <div class="poster-panel-head">
            <h3>Net Worth Trajectory (Age ${r.age}–95)</h3>
            <div class="poster-swell-keys">
              <span><i class="is-pink"></i>55+ Wealth</span>
              <span><i class="is-slate"></i>Pre-55 Base</span>
              <span><i class="is-line"></i>Trend</span>
            </div>
          </div>
          <div class="poster-nw-kpis">
            <div class="poster-nw-kpi">
              <small>Net Worth at Age ${pm.retireAge}</small>
              <strong>${m(pm.projectedAtRetire)}</strong>
              <span class="poster-nw-delta">${pm.pctFunded}% funded to 95</span>
            </div>
            <div class="poster-nw-kpi">
              <small>${pm.savingKpiLabel}</small>
              <strong>${m(pm.monthlySave, r.retiringNow ? " now" : "/mo")}</strong>
              <span class="poster-nw-delta">${pm.savingKpiPill}</span>
            </div>
            <div class="poster-nw-kpi">
              <small>CPF LIFE from 65</small>
              <strong class="is-emerald">${m(pm.cpfFloor65, "/mo")}</strong>
              <span class="poster-nw-delta">${pm.cpfCovPct}% of budget</span>
            </div>
          </div>
          <div id="print-nw-chart" class="poster-chart-svg"></div>
          <div id="print-nw-legend" class="poster-chart-legend"></div>
        </div>

        <div class="poster-panel poster-sources-card">
          <div class="poster-panel-head">
            <h3>Top Funding Sources</h3>
            <small>4-Tap Architecture</small>
          </div>
          <ul class="poster-source-list">
            ${fundingSources
              .map(
                (src) => `<li class="poster-source-row">
                  <span class="poster-source-badge" style="background:${src.softBg};color:${src.color};border:1px solid ${src.border};">${src.icon || src.letter}</span>
                  <div class="poster-source-copy">
                    <strong style="color:${src.color};">${src.name}</strong>
                    <small>${src.count}</small>
                  </div>
                  <span class="poster-slate-pill">${src.score}</span>
                </li>`,
              )
              .join("")}
          </ul>
          <div class="poster-cov-box">
            <div class="poster-cov-head">
              <span>Age-65 income split</span>
              <strong>${m(r.spend65, "/mo")} need</strong>
            </div>
            <div class="poster-cov-track">
              <span style="width:${pm.cpfCovPct}%;background:#10B981;"></span>
              <span style="width:${Math.max(0, 100 - pm.cpfCovPct)}%;background:#2563EB;"></span>
            </div>
            <div class="poster-cov-legend">
              <span><i style="background:#10B981;"></i><b>${m(s.payout, "/mo")}</b> CPF LIFE (${pm.cpfCovPct}%)</span>
              <span><i style="background:#2563EB;"></i><b>${m(s.gap65, "/mo")}</b> savings (${Math.max(0, 100 - pm.cpfCovPct)}%)</span>
            </div>
          </div>
        </div>

        <div class="poster-panel poster-readiness-card">
          <div class="poster-panel-head">
            <h3>Retirement Readiness</h3>
            <span class="poster-pill">Goal: Age ${fire.retire}</span>
          </div>
          ${buildFinReadinessGaugeSVG(
            pm.pctFunded,
            "Earliest Safe Retirement Age",
            pm.earliestSafeAgeText,
            deltaLine,
            deltaColor,
            pm.onTrack,
            "print-swell",
          )}
          <div class="poster-gauge-facts">
            <div class="poster-gauge-fact">
              <span>Retiring at ${fire.retire}</span>
              <strong class="${fn.fullyFundedTo95 ? "is-good" : "is-warn"}">${survivalAnswer}</strong>
            </div>
            <div class="poster-gauge-fact">
              <span>Safe age (to 95)</span>
              <strong>${safeAgeAnswer}</strong>
            </div>
          </div>
        </div>
      </section>

      <section class="poster-bottom-grid">
        <div class="poster-panel poster-strategy-panel">
          <div class="poster-panel-head">
            <h3>CPF Path &amp; Action Plan</h3>
            <small>Today’s $ · ${pm.customSavingNote ? "Custom save" : "Target"}</small>
          </div>
          <table class="poster-mini-table">
            <thead><tr><th>Strategy Path</th><th>Age-55 CPF</th><th>Extra CPF</th><th>Outside Save</th><th>CPF LIFE (65+)</th></tr></thead>
            <tbody>
              ${r.scenarios
                .map(
                  (sc) => `<tr class="${sc.key === s.key ? "is-active" : ""}">
                    <td>${sc.key === "salary" ? "Salary CPF" : sc.key.toUpperCase()}${sc.key === s.key ? " ★" : ""}</td>
                    <td>${m(sc.balance)}</td>
                    <td>${m(sc.cpfFunding, r.retiringNow ? " now" : "/mo")}</td>
                    <td>${m(sc.privateSaving, r.retiringNow ? " now" : "/mo")}</td>
                    <td>${m(sc.payout, "/mo")}</td>
                  </tr>`,
                )
                .join("")}
            </tbody>
          </table>
          ${pm.customSavingNote ? `<p class="poster-override-note">${pm.customSavingNote}</p>` : ""}
          <div class="poster-subhead">
            <span>Priority Action Checklist</span>
            <small>5-Step Plan</small>
          </div>
          <ul class="poster-tiers">
            ${pm.actionRows
              .map(
                (row) =>
                  `<li><span>${row.label} <em class="poster-tier-tag">${row.tag}</em></span><b>${row.value}</b></li>`,
              )
              .join("")}
          </ul>
        </div>

        <div class="poster-panel poster-cashflow-panel">
          <div class="poster-panel-head">
            <h3>Paycheck Split &amp; Checkpoints</h3>
            <small>${m(grossPlusEmp, "/mo")} incl. Emp CPF</small>
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
                    <b>${m(pr.amt)} (${w}%)</b>
                  </div>
                  <div class="poster-pipe-track"><span style="width:${pr.amt > 0 ? Math.max(3, w) : 0}%;background:${pr.color};"></span></div>
                </div>`;
              })
              .join("")}
          </div>
          ${
            milestones.length
              ? `<div class="poster-checkpoints-grid">
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
                        </div>
                      </div>`,
                    )
                    .join("")}
                </div>`
              : ""
          }
        </div>

        <div class="poster-panel poster-budget-panel">
          <div class="poster-panel-head">
            <h3>Retirement Living Budget</h3>
            <small>${budgetHeaderSub}</small>
          </div>
          <div class="poster-budget-body">
            ${buildExpensePieSVG(ep, { isPrint: true })}
            <div class="poster-budget-cats">
              ${(ep.categories || [])
                .map((cat) => {
                  const barW =
                    ep.total > 0 && cat.amount > 0
                      ? Math.max(4, Math.round(cat.pct))
                      : 0;
                  return `<div class="poster-cat-row">
                    <div class="poster-cat-meta">
                      <span><i style="background:${cat.color};"></i>${cat.label}</span>
                      <b>${m(cat.amount)} (${Math.round(cat.pct)}%)</b>
                    </div>
                    <div class="poster-pipe-track"><span style="width:${barW}%;background:${cat.color};"></span></div>
                  </div>`;
                })
                .join("")}
            </div>
          </div>
          <div class="poster-gauge-facts poster-budget-facts">
            <div class="poster-gauge-fact">
              <span>Today’s monthly target</span>
              <strong>${m(r.todaySpend, "/mo")} (${isItemizedTarget ? "Itemized" : isCustomBudget ? "Custom" : r.lifestyle === "cca" ? "Community Care" : "Home + Helper"})</strong>
            </div>
            <div class="poster-gauge-fact">
              <span>Age-65 need (${Number((r.inflation * 100).toFixed(1))}% infl.)</span>
              <strong>${m(r.spend65, "/mo")} nominal (${m(s.payout, "/mo")} CPF LIFE)</strong>
            </div>
          </div>
        </div>
      </section>

      <footer class="poster-colophon">
        <span><sup>1</sup> ${basis === "nominal" ? "Future nominal dollars" : "Today’s purchasing power"} (${Number((r.inflation * 100).toFixed(1))}% inflation, ${Number((r.investmentReturn * 100).toFixed(1))}% net return, ${r.post55Work ? "post-55 CPF included" : "post-55 CPF excluded"}). <sup>2</sup> ${pm.colophonRulesText}</span>
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
      swellCombo: true,
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
  const isDashCombo =
    Boolean(opts.swellCombo) ||
    chartArea.id === "dash-networth-chart" ||
    chartArea.id === "print-nw-chart";
  const isOverviewHero = chartArea.id === "dash-networth-chart";
  const W = compactPrint ? 680 : isOverviewHero ? 720 : 860,
    H = compactPrint ? 176 : isOverviewHero ? 386 : 322,
    padL = compactPrint ? 54 : isOverviewHero ? 58 : 76,
    padR = compactPrint ? 16 : isOverviewHero ? 20 : 34,
    padT = compactPrint ? 42 : isOverviewHero ? 54 : 70,
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
  const rawMilestones = [
    {
      age: fire.retire,
      label: `Retire ${fire.retire}`,
      color: "#BE185D",
      bg: "#FDF2F8",
      border: "#FBCFE8",
    },
    {
      age: 55,
      label: "55 SA Closure",
      color: "#047857",
      bg: "#ECFDF5",
      border: "#A7F3D0",
    },
    ...(showSrs
      ? [
          {
            age: fire.srsWithdrawalAge,
            label: `${fire.srsWithdrawalAge} SRS`,
            color: "#6D28D9",
            bg: "#F5F3FF",
            border: "#DDD6FE",
          },
        ]
      : []),
    {
      age: 65,
      label: "65 CPF LIFE",
      color: "#047857",
      bg: "#ECFDF5",
      border: "#A7F3D0",
    },
  ]
    .filter((mItem) => mItem.age >= minAge && mItem.age <= maxAge)
    .sort((a, b) => a.age - b.age);

  const milestones = [];
  for (const item of rawMilestones) {
    const existing = milestones.find((x) => x.age === item.age);
    if (existing) {
      if (item.age === 65 && existing.label.startsWith("Retire")) {
        existing.label = "65 Retire · CPF LIFE";
        existing.color = "#BE185D";
        existing.bg = "#FDF2F8";
        existing.border = "#FBCFE8";
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
  const rowYs = compactPrint ? [15, 28, 41, 52] : [18, 34, 50, 66];
  const milestoneSVG = milestones
    .map((mItem) => {
      const x = dX(mItem.age);
      const anchor =
        x < padL + 54 ? "start" : x > W - padR - 54 ? "end" : "middle";
      const pillW = Math.max(54, mItem.label.length * (compactPrint ? 6.8 : 6.1) + 14);
      const pillH = compactPrint ? 17 : 16;
      const x1 =
        anchor === "start" ? x : anchor === "end" ? x - pillW : x - pillW / 2;
      const x2 = x1 + pillW;
      let chosenRow = rowBoxes.findIndex((boxes) =>
        boxes.every((b) => x2 + 10 <= b.x1 || x1 - 10 >= b.x2),
      );
      if (chosenRow === -1) chosenRow = rowBoxes.length - 1;
      rowBoxes[chosenRow].push({ x1, x2 });
      const labelY = rowYs[chosenRow];
      const pillY = labelY - (compactPrint ? 12 : 11.5);
      const textX = (x1 + pillW / 2).toFixed(1);
      return `<g class="nw-milestone-flag">
        <line x1="${x}" y1="${(pillY + pillH).toFixed(1)}" x2="${x}" y2="${H - padB}" stroke="${mItem.color}" stroke-width="1.25" stroke-dasharray="3,3" stroke-opacity="0.6" />
        <rect x="${x1.toFixed(1)}" y="${pillY.toFixed(1)}" width="${pillW.toFixed(1)}" height="${pillH}" rx="4.5" fill="${mItem.bg || "#FFFFFF"}" stroke="${mItem.border || mItem.color}" stroke-width="1" />
        <text x="${textX}" y="${labelY}" text-anchor="middle" font-size="${compactPrint ? 11.5 : 10}" font-weight="650" fill="${mItem.color}">${mItem.label}</text>
      </g>`;
    })
    .join("");

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

  chartArea.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid meet">
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
    if (chartArea.id === "dash-networth-chart") {
      const printNw = $("#print-nw-chart");
      const printLeg = $("#print-nw-legend");
      if (printNw) {
        renderStackedNetWorthSVG(printNw, null, printLeg, fire, basis, {
          interactive: false,
          forcedSeries: netWorthSelectedSeries,
          showSrsMilestone: opts.showSrsMilestone,
          compactPrint: true,
          swellCombo: true,
        });
      }
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
    svg.querySelectorAll(".swell-bar-col").forEach((col) => {
      col.classList.toggle("is-scrub-active", Number(col.dataset.age) === pt.age);
    });
    if (chartArea.id === "dash-networth-chart") {
      const heroTitleEl = document.getElementById("ember-traj-title");
      const heroValEl = document.getElementById("hero-nw-live");
      const heroSubEl = document.getElementById("hero-nw-sub-live");
      if (heroTitleEl && heroValEl && heroSubEl) {
        if (!heroTitleEl.dataset.defaultHtml) heroTitleEl.dataset.defaultHtml = heroTitleEl.innerHTML;
        if (!heroValEl.dataset.defaultHtml) heroValEl.dataset.defaultHtml = heroValEl.innerHTML;
        if (!heroSubEl.dataset.defaultHtml) heroSubEl.dataset.defaultHtml = heroSubEl.innerHTML;
        const dispVal = soloSeries ? pt[soloSeries.key] : pt.total;
        heroTitleEl.innerHTML = `Age ${pt.age} (${pt.year}) <span class="nw-live-scrub-pill">Live Scrub</span>`;
        heroValEl.innerHTML = m(dispVal);
        heroSubEl.innerHTML = `<span class="nw-live-breakdown">CPF <b>${compactMoney(pt.cpf)}</b> · Eq <b>${compactMoney(pt.eq)}</b> · Cash <b>${compactMoney(pt.ssb)}</b></span>`;
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
      if (heroTitleEl?.dataset.defaultHtml) heroTitleEl.innerHTML = heroTitleEl.dataset.defaultHtml;
      if (heroValEl?.dataset.defaultHtml) heroValEl.innerHTML = heroValEl.dataset.defaultHtml;
      if (heroSubEl?.dataset.defaultHtml) heroSubEl.innerHTML = heroSubEl.dataset.defaultHtml;
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
          color: "#6D28D9",
          bg: "#F5F3FF",
          border: "#DDD6FE",
        }
      : null,
    idx65 >= 0
      ? {
          idx: idx65,
          label: "CPF LIFE (65)",
          color: "#047857",
          bg: "#ECFDF5",
          border: "#A7F3D0",
        }
      : null,
  ]
    .filter(Boolean)
    .map((mk, j) => {
      const mx = centerX(mk.idx);
      const closeToPrev =
        j === 1 && idxSrs >= 0 && Math.abs(idx65 - idxSrs) <= 5;
      const my = closeToPrev ? padT - 18 : padT - 6;
      const anchor =
        mx < padL + 48 ? "start" : mx > W - padR - 48 ? "end" : "middle";
      const pillW = Math.max(54, mk.label.length * 6.2 + 14);
      const pillH = 16;
      const x1 =
        anchor === "start" ? mx : anchor === "end" ? mx - pillW : mx - pillW / 2;
      const pillY = my - 11.5;
      return `<g class="nw-milestone-flag">
        <line x1="${mx}" y1="${padT}" x2="${mx}" y2="${H - padB}" stroke="${mk.color}" stroke-width="1.3" stroke-dasharray="3,3" stroke-opacity="0.65" />
        <rect x="${x1.toFixed(1)}" y="${pillY.toFixed(1)}" width="${pillW.toFixed(1)}" height="${pillH}" rx="4.5" fill="${mk.bg}" stroke="${mk.border}" stroke-width="1" />
        <text x="${(x1 + pillW / 2).toFixed(1)}" y="${my}" text-anchor="middle" font-size="10" font-weight="650" fill="${mk.color}">${mk.label}</text>
      </g>`;
    })
    .join("");

  chartArea.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid meet">
      ${yTicks}${xLabels}${bars}
      <path d="${spendLine}" fill="none" stroke="var(--ink)" stroke-width="2" stroke-dasharray="6,3" />
      ${markers}
      <line class="wf-scrub-line" x1="0" y1="${padT}" x2="0" y2="${H - padB}" stroke="var(--swell-pink)" stroke-width="1.6" stroke-dasharray="3,3" style="display:none;" />
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
let expCardExpanded = false;

function buildFinActivityBarsSVG(fire, fn) {
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
      const labelFill = isRetire ? "#1E293B" : "#475569";
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
  onTrack = pctFunded >= 100,
  uid = "swell",
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
      <text x="120" y="108" text-anchor="middle" fill="#64748B" font-size="9.5" font-weight="600" letter-spacing="0.03em">FUNDED TO 95</text>
    </svg>
    <div class="swell-gauge-status" style="color:${statusColor};">${statusWord}</div>
    <div class="fin-gauge-center swell-gauge-readout">
      <strong>${readyText}</strong>
      <span class="fin-gauge-eyebrow">${eyebrowText}</span>
      <span class="fin-gauge-delta" style="color:${deltaColor};">${deltaLine}</span>
    </div>
  </div>`;
}

function buildOverviewPageHeader(fire) {
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

function describePieSlicePath(cx, cy, outerR, innerR, startDeg, endDeg) {
  const full = endDeg - startDeg >= 359.9;
  if (full) {
    return `M ${cx} ${cy - outerR} A ${outerR} ${outerR} 0 1 1 ${cx - 0.01} ${cy - outerR} Z M ${cx} ${cy - innerR} A ${innerR} ${innerR} 0 1 0 ${cx - 0.01} ${cy - innerR} Z`;
  }
  const toRad = (d) => ((d - 90) * Math.PI) / 180;
  const x1 = cx + outerR * Math.cos(toRad(startDeg));
  const y1 = cy + outerR * Math.sin(toRad(startDeg));
  const x2 = cx + outerR * Math.cos(toRad(endDeg));
  const y2 = cy + outerR * Math.sin(toRad(endDeg));
  const x3 = cx + innerR * Math.cos(toRad(endDeg));
  const y3 = cy + innerR * Math.sin(toRad(endDeg));
  const x4 = cx + innerR * Math.cos(toRad(startDeg));
  const y4 = cy + innerR * Math.sin(toRad(startDeg));
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${outerR} ${outerR} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${x3.toFixed(2)} ${y3.toFixed(2)} A ${innerR} ${innerR} 0 ${large} 0 ${x4.toFixed(2)} ${y4.toFixed(2)} Z`;
}

function buildExpensePieSVG(ep, opts = {}) {
  const isPrint = Boolean(opts.isPrint);
  const cats = (ep?.categories || []).filter((c) => c.amount > 0);
  const total = Math.max(0, Number(ep?.total || 0));
  const cx = 92;
  const cy = 92;
  const outerR = 83;
  const innerR = 54;
  let cursor = 0;
  const activeCount = cats.length;
  const gapDeg = activeCount > 1 ? 2.2 : 0;

  const slices =
    total <= 0 || !cats.length
      ? `<circle cx="${cx}" cy="${cy}" r="${(outerR + innerR) / 2}" fill="none" stroke="var(--border)" stroke-width="${outerR - innerR}" />`
      : cats
          .map((cat) => {
            const sweep = (cat.amount / total) * 360;
            const start = cursor + gapDeg / 2;
            const end = Math.max(start + 0.5, cursor + sweep - gapDeg / 2);
            cursor += sweep;
            const d = describePieSlicePath(cx, cy, outerR, innerR, start, end);
            return `<path class="exp-pie-slice" data-exp-cat="${cat.key}" d="${d}" fill="${cat.color}" fill-rule="evenodd"${isPrint ? "" : ' tabindex="0" role="img"'} aria-label="${cat.label}: ${money(cat.amount)} per month (${cat.pct.toFixed(0)}%)"><title>${cat.label}: ${money(cat.amount)}/mo (${cat.pct.toFixed(1)}%)</title></path>`;
          })
          .join("");

  return `<div class="exp-pie-stage${isPrint ? " is-print-pie" : ""}">
    <svg class="exp-pie-svg" viewBox="0 0 184 184" width="${isPrint ? 104 : 184}" height="${isPrint ? 104 : 184}" role="img" aria-label="Monthly living expense breakdown pie chart totaling ${money(total)} per month">
      ${slices}
    </svg>
    <div class="exp-pie-center" aria-hidden="true">
      <small>Retire Need</small>
      <strong>${isPrint ? m(total) : m(total, "", "exp-pie-total")}</strong>
      <span>per month</span>
    </div>
    ${isPrint ? "" : `<div class="exp-pie-hover-pill" id="exp-pie-hover-pill" hidden></div>`}
  </div>`;
}

function escapeAttr(val) {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatExpSharePct(pct) {
  const num = Number(pct || 0);
  if (num <= 0) return "0%";
  if (num < 1) return "<1%";
  return `${Math.round(num)}%`;
}

function renderReadOnlyExpenseTable(
  items,
  catLabelMap,
  ariaLabel,
  catColorMap = {},
) {
  return `
    <div class="exp-items-table is-readonly" role="region" aria-label="${ariaLabel}">
      <div class="exp-items-head" aria-hidden="true">
        <span>Category</span>
        <span>Expense item</span>
        <span>Monthly ($)</span>
        <span>Share</span>
      </div>
      <div class="exp-items-body">
        ${items
          .map(
            (it) => `<div class="exp-ro-row">
              <span class="exp-ro-cat"><i class="exp-cat-dot" style="background:${catColorMap[it.category] || "#64748b"}" aria-hidden="true"></i>${escapeAttr(catLabelMap[it.category] || it.category)}</span>
              <span class="exp-ro-name">${escapeAttr(it.name)}</span>
              <strong class="exp-ro-amt">${m(it.amount, "/mo")}</strong>
              <span class="exp-ro-pct">${formatExpSharePct(it.pct)}</span>
            </div>`,
          )
          .join("")}
      </div>
    </div>`;
}

function buildExpenseModalBodyHTML(ep, r, newlyAddedId = null, s = null) {
  const isCustom = Boolean(ep.isCustom);
  const catList = RetirementModel.EXPENSE_CATEGORIES || [];
  const catLabelMap = Object.fromEntries(catList.map((c) => [c.key, c.label]));
  const catColorMap = Object.fromEntries(catList.map((c) => [c.key, c.color]));
  const catOptions = (selectedKey) =>
    catList
      .map(
        (cat) =>
          `<option value="${cat.key}"${cat.key === selectedKey ? " selected" : ""}>${cat.label}</option>`,
      )
      .join("");
  const planVal = r?.plan === "escalating" ? "escalating" : "standard";
  const retireAge = Number(r?.retire || 65);
  const targetSpend65 = Number(r?.spend65 ?? ep.total);
  const targetSpendRetire =
    retireAge < 65 ? Number(r?.futureSpend ?? ep.total) : targetSpend65;
  const cpfPayout65 = Number(s?.payout ?? r?.income ?? 0);
  const cpfCov65 =
    targetSpend65 > 0
      ? Math.min(100, Math.round((cpfPayout65 / targetSpend65) * 100))
      : 100;
  const outsideNeed = s?.privateSaving ?? r?.saving ?? null;

  const sourceBar = `<div class="exp-modal-source-bar" role="group" aria-label="Living budget preset or Custom">
    <button type="button" class="exp-modal-source-btn${!isCustom && ep.lifestyle === "cca" ? " is-active" : ""}" data-exp-load="cca" aria-pressed="${!isCustom && ep.lifestyle === "cca"}">
      <strong>Community Care</strong>
      <span>$2,800/mo · Fixed preset</span>
    </button>
    <button type="button" class="exp-modal-source-btn${!isCustom && ep.lifestyle === "home-helper" ? " is-active" : ""}" data-exp-load="home-helper" aria-pressed="${!isCustom && ep.lifestyle === "home-helper"}">
      <strong>Home + Helper</strong>
      <span>$3,900/mo · Fixed preset</span>
    </button>
    <button type="button" class="exp-modal-source-btn${isCustom ? " is-active" : ""}" data-exp-enter-custom aria-pressed="${isCustom}">
      <strong>Custom</strong>
      <span>${isCustom ? `${m(ep.total, "/mo")} · ${ep.itemizedActive ? `${ep.items.length} item${ep.items.length === 1 ? "" : "s"}` : "Single figure"}` : "Single figure or items"}</span>
    </button>
  </div>`;

  const impactStrip = `<div class="exp-impact-strip" id="exp-impact-slot" aria-label="Live retirement budget impact and CPF LIFE plan">
    <div class="exp-impact-metrics">
      <div class="exp-impact-kpi">
        <span>${retireAge < 65 ? `Age-${retireAge} Retire Need` : "Age-65 Retire Need"}</span>
        <strong>${m(targetSpendRetire, "/mo")}</strong>
        <small>Today’s $ · HealthShield curve</small>
      </div>
      <div class="exp-impact-kpi">
        <span>CPF LIFE Coverage (65)</span>
        <strong class="is-emerald">${cpfCov65}%</strong>
        <small>${m(cpfPayout65, "/mo")} projected</small>
      </div>
      <div class="exp-impact-kpi">
        <span>Outside Saving Target</span>
        <strong>${outsideNeed == null ? "—" : r?.retiringNow ? m(outsideNeed) : m(outsideNeed, "/mo")}</strong>
        <small>${r?.retiringNow ? "Capital needed now" : "Suggested monthly"}</small>
      </div>
    </div>
    <div class="exp-plan-inline-box">
      <span class="exp-plan-inline-label">CPF LIFE Payout Plan</span>
      <div class="cpf-plan-inline-toggle" role="group" aria-label="CPF LIFE payout plan">
        <button type="button" class="cpf-plan-chip${planVal === "standard" ? " is-active" : ""}" data-exp-set-plan="standard" aria-pressed="${planVal === "standard"}">Standard</button>
        <button type="button" class="cpf-plan-chip${planVal === "escalating" ? " is-active" : ""}" data-exp-set-plan="escalating" aria-pressed="${planVal === "escalating"}">Escalating +2%/yr</button>
      </div>
    </div>
  </div>`;

  const catSummaryBar = (ep.categories || [])
    .filter((cat) => cat.amount > 0)
    .map(
      (cat) =>
        `<span class="exp-cat-summary-pill"><i class="exp-cat-dot" style="background:${cat.color}" aria-hidden="true"></i>${escapeAttr(cat.label.split(",")[0].split("&")[0].trim())} · ${m(cat.amount)} (${formatExpSharePct(cat.pct)})</span>`,
    )
    .join("");

  const quickTotals = [2200, 2800, 3500, 4500];
  const roundedTotal = Math.round(Number(ep.total || 0));

  const mainSection = !isCustom
    ? `<div class="exp-modal-section">
        <div class="exp-readonly-banner">
          <span><strong>${ep.lifestyleLabel}</strong> is a fixed preset (${m(ep.total, "/mo")}) for today’s budget; projections step up HealthShield premiums with age. Switch to Custom to edit items.</span>
          <button type="button" class="button button-small button-accent" data-exp-enter-custom>Switch to Custom →</button>
        </div>
        ${catSummaryBar ? `<div class="exp-cat-summary-pills" aria-label="Category summary">${catSummaryBar}</div>` : ""}
        ${renderReadOnlyExpenseTable(ep.items, catLabelMap, `${ep.lifestyleLabel} preset monthly expense breakdown`, catColorMap)}
      </div>`
    : `<div class="exp-modal-section">
        <div class="exp-editor-toolbar">
          <div class="fin-segmented-tabs exp-mode-tabs" data-seg-idx="${ep.itemizedActive ? 1 : 0}" style="--seg-idx:${ep.itemizedActive ? 1 : 0};--seg-count:2" role="group" aria-label="Custom budget entry mode">
            <button type="button" class="fin-seg-tab${!ep.itemizedActive ? " is-active" : ""}" data-exp-custom-mode="figure" aria-pressed="${!ep.itemizedActive}">Single figure</button>
            <button type="button" class="fin-seg-tab${ep.itemizedActive ? " is-active" : ""}" data-exp-custom-mode="itemized" aria-pressed="${ep.itemizedActive}">Break down &amp; add items</button>
          </div>
        </div>
        ${
          !ep.itemizedActive
            ? `<div class="exp-figure-panel">
                <div class="exp-figure-hero">
                  <label class="exp-figure-field" for="exp-total-input">
                    <span>Custom monthly retirement budget (today’s $)</span>
                    <div class="input-wrap">
                      <span>$</span>
                      <input type="number" id="exp-total-input" min="0" max="1000000" step="any" inputmode="decimal" value="${ep.total}" />
                    </div>
                    <small>Scales all ${ep.items.length} retirement items proportionally in today’s dollars.</small>
                  </label>
                  <div class="exp-figure-controls" aria-label="Quick budget adjustments">
                    <div class="exp-step-row">
                      <button type="button" class="exp-step-btn" data-exp-step-delta="-200">−$200</button>
                      <button type="button" class="exp-step-btn" data-exp-step-delta="-100">−$100</button>
                      <button type="button" class="exp-step-btn" data-exp-step-delta="100">+$100</button>
                      <button type="button" class="exp-step-btn" data-exp-step-delta="200">+$200</button>
                    </div>
                    <div class="exp-quick-chips">
                      <span class="exp-quick-label">Anchors:</span>
                      ${quickTotals
                        .map(
                          (amt) =>
                            `<button type="button" class="exp-quick-chip${roundedTotal === amt ? " is-active" : ""}" data-exp-quick-total="${amt}">$${amt.toLocaleString("en-SG")}</button>`,
                        )
                        .join("")}
                    </div>
                  </div>
                </div>
                <div id="exp-figure-table-slot" class="exp-modal-section">
                  <div class="exp-breakdown-subhead">
                    <div class="exp-cat-summary-pills" aria-label="Category summary">${catSummaryBar}</div>
                    <button type="button" class="text-button" data-exp-custom-mode="itemized">Customize individual items →</button>
                  </div>
                  ${renderReadOnlyExpenseTable(ep.items, catLabelMap, "Proportionally scaled custom monthly expense breakdown", catColorMap)}
                </div>
              </div>`
            : `<div class="exp-itemized-bar">
                <span class="exp-itemized-sum">Total: <strong id="exp-editor-sum">${m(ep.total, "/mo")}</strong> <small>(updates Retire Budget)</small></span>
                <button type="button" class="button button-small button-accent" data-exp-add>+ Add item</button>
              </div>
              <div class="exp-items-table" role="region" aria-label="Editable monthly expense items">
                <div class="exp-items-head" aria-hidden="true">
                  <span>Category</span>
                  <span>Expense item</span>
                  <span>Monthly ($)</span>
                  <span>Share</span>
                  <span></span>
                </div>
                <div class="exp-items-body" id="exp-items-body">
                  ${ep.items
                    .map(
                      (
                        it,
                        idx,
                      ) => `<div class="exp-item-row${newlyAddedId && it.id === newlyAddedId ? " is-new-row" : ""}" data-exp-row="${idx}">
                        <div class="input-wrap select-wrap exp-cat-select-wrap">
                          <select name="exp-cat-${idx}" data-exp-field="category" data-exp-idx="${idx}" aria-label="Category for item ${idx + 1}">
                            ${catOptions(it.category)}
                          </select>
                        </div>
                        <div class="input-wrap">
                          <input type="text" name="exp-name-${idx}" data-exp-field="name" data-exp-idx="${idx}" value="${escapeAttr(it.name)}" placeholder="e.g. Groceries, WiFi" maxlength="60" aria-label="Expense item name ${idx + 1}" />
                        </div>
                        <div class="input-wrap">
                          <span>$</span>
                          <input type="number" name="exp-amt-${idx}" min="0" max="1000000" step="any" inputmode="decimal" data-exp-field="amount" data-exp-idx="${idx}" value="${it.amount}" aria-label="Monthly amount for ${escapeAttr(it.name)}" />
                        </div>
                        <span class="exp-item-pct" data-exp-pct="${idx}">${formatExpSharePct(it.pct)}</span>
                        <button type="button" class="exp-remove-btn" data-exp-remove="${idx}" aria-label="Remove ${escapeAttr(it.name)}" title="Remove item">×</button>
                      </div>`,
                    )
                    .join("")}
                </div>
              </div>`
        }
      </div>`;

  const cpfPlanRow = `<div class="exp-modal-plan-row">
    <div class="qe-field">
      <label for="exp-modal-plan">CPF LIFE payout plan</label>
      <div class="input-wrap select-wrap">
        <select id="exp-modal-plan">
          <option value="standard"${planVal === "standard" ? " selected" : ""}>Standard Plan (Level payouts)</option>
          <option value="escalating"${planVal === "escalating" ? " selected" : ""}>Escalating Plan (+2% yearly)</option>
        </select>
      </div>
      <p class="qe-hint">Escalating starts ~20% lower and rises +2%/yr on payout anniversaries, overtaking Standard around age 77–78.</p>
    </div>
  </div>`;

  return `${sourceBar}${impactStrip}${mainSection}${cpfPlanRow}`;
}

function buildExpenseCardHTML(ep, r) {
  const isCustom = Boolean(ep.isCustom);
  const modeLabel = !isCustom
    ? `${ep.lifestyleLabel} preset · Fixed`
    : ep.itemizedActive
      ? `Custom · ${ep.items.length} item${ep.items.length === 1 ? "" : "s"}`
      : "Custom · Single figure";
  const dropdownLabel = isCustom
    ? `Custom (${money(ep.total)}/mo)`
    : ep.lifestyle === "cca"
      ? `Community Care (${money(ep.total)}/mo)`
      : `Home + Helper (${money(ep.total)}/mo)`;
  const customSubLabel = isCustom
    ? `${money(ep.total)}/mo · Click to edit budget or items`
    : "Set custom monthly budget or items…";
  const ageNeedLabel =
    r.retire < 65
      ? `Age ${r.retire} est: ${money(r.futureSpend)}/mo`
      : `Age 65 est: ${money(r.spend65)}/mo`;
  const captionText = `Models what you need per month in retirement (<strong>${m(ep.total, "/mo", "kpi-budget")}</strong> today’s $). Separate from today’s take-home pay.`;
  const topPreview = ep.items
    .filter((it) => it.amount > 0)
    .slice()
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 4);

  return `<section class="fin-card fin-expense-card card-surface" id="expense-breakdown-card" aria-labelledby="expense-card-title">
    <div class="fin-expense-head">
      <div class="fin-expense-title-col">
        <div class="fin-expense-title-row">
          <h2 id="expense-card-title">Retirement Living Budget</h2>
          <span class="fin-inline-meta" id="exp-mode-pill">${modeLabel}</span>
          <span class="fin-inline-meta is-sep" aria-hidden="true">·</span>
          <span class="fin-inline-meta" id="exp-takehome-pill">${ageNeedLabel}</span>
        </div>
        <p id="exp-sync-caption">${captionText}</p>
      </div>
      <div class="fin-expense-actions">
        <div class="exp-card-dropdown-wrap" id="exp-card-dropdown-wrap">
          <button
            type="button"
            class="header-account-pill exp-card-dropdown-pill"
            id="exp-card-dropdown-btn"
            aria-haspopup="menu"
            aria-expanded="false"
            aria-controls="exp-card-dropdown-menu"
          >
            <span class="header-account-avatar" data-tone="${isCustom ? "custom" : ep.lifestyle}" aria-hidden="true">${isCustom ? "$" : ep.lifestyle === "cca" ? "C" : "H"}</span>
            <span id="exp-card-dropdown-label">${dropdownLabel}</span>
            <svg class="header-account-caret" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          <div class="header-account-menu exp-card-dropdown-menu" id="exp-card-dropdown-menu" role="menu" hidden>
            <button
              type="button"
              role="menuitemradio"
              class="header-menu-item${!isCustom && ep.lifestyle === "cca" ? " is-active" : ""}"
              data-switch-lifestyle="cca"
              aria-checked="${!isCustom && ep.lifestyle === "cca"}"
            >
              <div>
                <strong>Community Care Apartments</strong>
                <small>$2,800/mo baseline · assisted living from 55</small>
              </div>
            </button>
            <button
              type="button"
              role="menuitemradio"
              class="header-menu-item${!isCustom && ep.lifestyle === "home-helper" ? " is-active" : ""}"
              data-switch-lifestyle="home-helper"
              aria-checked="${!isCustom && ep.lifestyle === "home-helper"}"
            >
              <div>
                <strong>Home + Helper</strong>
                <small>$3,900/mo baseline · ageing in place</small>
              </div>
            </button>
            <button
              type="button"
              role="menuitemradio"
              class="header-menu-item${isCustom ? " is-active" : ""}"
              data-select-custom
              aria-checked="${isCustom}"
            >
              <div>
                <strong>Custom</strong>
                <small id="exp-card-custom-sub">${customSubLabel}</small>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="fin-expense-body" id="exp-card-body">
      <div class="fin-expense-chart-col" id="exp-pie-slot">
        ${buildExpensePieSVG(ep)}
      </div>
      <div class="fin-expense-summary-col">
        <div class="fin-expense-cats" id="exp-cats-slot">
          ${ep.categories
            .map((cat) => {
              const barW =
                ep.total > 0 && cat.amount > 0
                  ? Math.max(4, Math.round(cat.pct))
                  : 0;
              return `<div class="exp-cat-row" data-exp-cat="${cat.key}">
                <div class="exp-cat-meta">
                  <span class="exp-cat-name"><i style="background:${cat.color};"></i>${cat.label} <small>(${cat.items.length})</small></span>
                  <strong class="exp-cat-val">${m(cat.amount, "/mo")} <span>${Math.round(cat.pct)}%</span></strong>
                </div>
                <div class="exp-cat-track" aria-hidden="true">
                  <span style="width:${barW}%;background:${cat.color};"></span>
                </div>
              </div>`;
            })
            .join("")}
        </div>
        <div class="exp-preview-strip" id="exp-preview-slot">
          <span class="exp-preview-label">Top items:</span>
          ${
            topPreview.length
              ? topPreview
                  .map(
                    (it) =>
                      `<span class="exp-item-chip">${escapeAttr(it.name)} · <b>${money(it.amount)}</b></span>`,
                  )
                  .join("")
              : '<span class="exp-item-chip">No expense items ($0/mo)</span>'
          }
        </div>
      </div>
    </div>
  </section>`;
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

  // Housing & IRAS tax monthly figures
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
  const margTaxRate = tax?.taxBefore?.marginalRate || 0;
  const activeTaxSavedYr =
    Math.min(tax?.rstuTaxSaved || 0, Math.round((simulation.cpfExtra || 0) * 12 * margTaxRate)) +
    Math.min(tax?.srsTaxSavedAfterRstu || 0, Math.round((p.srsAnnual || 0) * margTaxRate));
  const monthlyTax = Math.max(
    0,
    Math.round(((tax?.taxBefore?.annualTax || 0) - activeTaxSavedYr) / 12),
  );
  const livingAndTaxMo = Math.max(
    0,
    Math.round(r.afterCpf - contribution - housingCashMo),
  );
  const discretionaryCashMo = Math.max(0, livingAndTaxMo - monthlyTax);

  // Cashflow bar shares out of take-home pay
  const takeHomeDenom = Math.max(1, r.afterCpf);
  const saveW = Math.min(
    100,
    Math.max(0, Math.round((contribution / takeHomeDenom) * 100)),
  );
  const taxAndHousingCash = Math.round(monthlyTax + housingCashMo);

  const housingMetaLabel =
    hMode === "paid-up"
      ? "Paid-up property ($0 OA)"
      : hMode === "all-oa"
        ? `Up to ${m(housingOaMo)} CPF OA ($0 cash)`
        : housingCashMo > 0
          ? `${m(housingCashMo)} cash + ${m(housingOaMo)} CPF OA`
          : `${m(housingOaMo)} via CPF OA`;

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
  const fixedOutMo = Math.round(monthlyTax + housingCashMo + recurringTotal);
  const fixedOutW = Math.min(
    100 - saveW,
    Math.max(0, Math.round((fixedOutMo / takeHomeDenom) * 100)),
  );
  const livingW = Math.max(0, 100 - saveW - fixedOutW);
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
      shortTitle = [parenMatch[1], parenMatch[3]].filter(Boolean).join(" ").trim();
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
            <h3 class="fin-bento-title">${m(netWorthAfterDebt)} <small>${userLoanShare > 0 ? "net of loan" : "debt-free"}</small></h3>
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
            <h3 class="fin-bento-title">${m(r.afterCpf, "/mo")} <small>take-home (${pctOfPay}% saved)</small></h3>
          </div>
          <button type="button" class="fin-link-pill" data-quick-edit="salary">Edit income</button>
        </div>
        <div class="fin-bento-bar" aria-hidden="true">
          <span data-bento-seg="0" style="width:${saveW}%;background:var(--sem-cpf);" title="Saved &amp; Invested (${saveW}%)"></span>
          <span data-bento-seg="1" style="width:${fixedOutW}%;background:var(--sem-cash);" title="Tax, Housing &amp; Fixed Bills (${fixedOutW}%)"></span>
          <span data-bento-seg="2" style="width:${livingW}%;background:var(--sem-equities-sg);" title="Unallocated Cash Surplus (${livingW}%)"></span>
        </div>
        <ul class="fin-bento-list">
          <li data-bento-seg="0">
            <span class="fin-bento-item-label"><i style="background:var(--sem-cpf);"></i>Saved &amp; Invested</span>
            <span class="fin-bento-item-meta">${m(simulation.invest)} Inv · ${m(simulation.cashSaving || 0)} Cash · ${m(simulation.cpfExtra || 0)} CPF</span>
            <strong class="is-emerald">${m(contribution, "/mo")}</strong>
          </li>
          <li>
            <span class="fin-bento-item-label"><i style="background:var(--primary);"></i>Mandatory CPF + Mortgage</span>
            <span class="fin-bento-item-meta">${m(r.employeeCpf + r.employerCpf)} CPF · ${housingMetaLabel}</span>
            <strong>${m(r.employeeCpf + r.employerCpf + housingTotalMo, "/mo")}</strong>
          </li>
          <li data-bento-seg="1">
            <span class="fin-bento-item-label"><i style="background:var(--sem-cash);"></i>IRAS Tax &amp; Fixed Bills</span>
            <span class="fin-bento-item-meta">${m(monthlyTax, "/mo")} tax · ${m(recurringTotal, "/mo")} fixed bills</span>
            <strong>${m(monthlyTax + recurringTotal, "/mo")}</strong>
          </li>
          <li class="is-spare-cash-row" data-bento-seg="2">
            <span class="fin-bento-item-label"><i style="background:var(--sem-equities-sg);"></i>Unallocated Cash Surplus</span>
            <span class="fin-bento-item-meta">${r.afterCpf - contribution - housingCashMo - monthlyTax - recurringTotal < 0 ? `Exceeds take-home by ${m(Math.abs(Math.round(r.afterCpf - contribution - housingCashMo - monthlyTax - recurringTotal)), "/mo")}` : "After savings, tax &amp; fixed bills"}</span>
            <strong class="${discretionaryCashMo - recurringTotal > 0 ? "is-emerald" : r.afterCpf - contribution - housingCashMo - monthlyTax - recurringTotal < 0 ? "is-danger-text" : ""}" id="bento-spare-cash-val">${m(Math.max(0, discretionaryCashMo - recurringTotal), "/mo")}</strong>
          </li>
        </ul>
      </article>

      <!-- 3. Portfolio Distribution & Passive Yield -->
      <article class="fin-bento-card card-surface">
        <div class="fin-bento-head">
          <div>
            <span class="fin-bento-eyebrow">Portfolio Distribution &amp; Yield</span>
            <h3 class="fin-bento-title">+${centsHtml(passiveMoNow)}<span>/mo</span> <small>passive yield now</small></h3>
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
              const isInsItem = it.category === "care" || /insurance|healthshield|life|accident/i.test(it.name);
              const segIdx = isInsItem ? "0" : "1";
              const itemSharePct = Math.round(((it.amount || 0) / expTotal) * 100);
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
  const margRate = tax?.taxBefore?.marginalRate || 0;
  const activeTaxSavedYr =
    Math.min(tax?.rstuTaxSaved || 0, Math.round((simulation.cpfExtra || 0) * 12 * margRate)) +
    Math.min(tax?.srsTaxSavedAfterRstu || 0, Math.round((p.srsAnnual || 0) * margRate));
  const monthlyTax = Math.max(
    0,
    Math.round(((tax?.taxBefore?.annualTax || 0) - activeTaxSavedYr) / 12),
  );
  const fixedMatcher =
    /insurance|healthshield|multiplier life|accident|term|utilities|s&cc|town council|wifi|mobile|streaming|subscription|broadband|telco|levy|helper/i;
  const recurringTotal = Math.round(
    (expenseData?.items || [])
      .filter(
        (it) =>
          it.category === "housing" ||
          it.category === "digital" ||
          fixedMatcher.test(it.name),
      )
      .reduce((acc, it) => acc + (it.amount || 0), 0),
  );
  const rawSurplusMo = Math.round(
    r.afterCpf - contribution - housingCashMo - monthlyTax - recurringTotal,
  );
  const unallocatedSurplusMo = Math.max(0, rawSurplusMo);
  const maxAffordableSaveMo = Math.max(
    0,
    Math.round(r.afterCpf - housingCashMo - monthlyTax - recurringTotal),
  );

  // 0. Cashflow Over-Commitment Guardrail (when planned savings + tax + fixed bills exceed take-home pay)
  if (!r.retiringNow && rawSurplusMo < -10 && contribution > maxAffordableSaveMo) {
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
  if ((!fn.fullyFundedTo95 || fn.pctFunded < 100) && unallocatedSurplusMo >= 50) {
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
  const fullTargetCpfMo = Math.ceil((tax?.maxRstu || 8000) / 12);
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
    tax?.maxSrsAfterRstu || 15300,
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
  } else if (tax?.srsTrapStatus === "balloon-trap" && curSrsYr > safeSrsTargetYr) {
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
    const extraSrsYr = Math.max(50, Math.round(srsBal * 0.0495));
    moves.push({
      score: 2650 + extraSrsYr,
      badge: `0.05% → 5.0% p.a.`,
      tone: "is-amber",
      title: `Invest idle SRS cash into Global ETFs`,
      desc: `Uninvested SRS cash earns 0.05% p.a. Deploying into low-cost indexed funds compounds tax-deferred until age 63.`,
      ctaHtml: `<button type="button" class="fin-move-cta" data-money-move="invest-srs">Invest SRS in Global ETFs →</button>`,
      subHtml: `<button type="button" class="fin-move-link" data-go-tab="tax">Tax Relief</button>`,
    });
  }

  // 5. Cash Stack Overflow Sweep (when base-tier 0.05% bank overflow exists)
  const cashBd = taps.tap4Ssb.cashBreakdown;
  if (cashBd && cashBd.sweepAnnualGain > 20 && cashBd.totalOverflowBalance > 0) {
    const gainYr = Math.round(cashBd.sweepAnnualGain);
    moves.push({
      score: 2500 + gainYr,
      badge: `+${m(gainYr, "/yr")} risk-free`,
      tone: "is-blue",
      title: `Sweep ${m(cashBd.totalOverflowBalance)} overflow to MAS SSB`,
      desc: `Moving 0.05% base-tier bank cash into MAS 10Y SSB (${taps.tap4Ssb.ssb10YRatePct.toFixed(2)}%) lifts your cash EIR to ${cashBd.sweptEffectiveRatePct.toFixed(2)}%.`,
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
        subHtml: `<button type="button" class="fin-move-link" data-go-tab="cpf-milestones">Milestones</button>`,
      });
    }
  }

  // 7. Portfolio Rebalance (only deploy cash above the 6-month / $20k emergency reserve floor)
  const hol = bogle.holistic || {};
  const curEqPct = Math.round(hol.effectiveEquityPct || 0);
  const tgtEqPct = Math.round(p.targetEquityPct ?? 80);
  const eqDriftPct = Math.abs(curEqPct - tgtEqPct);
  const curCashBucket = Math.round(bogle.buckets.ssbCash || 0);
  const emergencyReserveFloor = Math.max(20000, Math.round((r.todaySpend || 2800) * 6));
  const deployableExcessCash = Math.max(0, curCashBucket - emergencyReserveFloor);
  const liqTotal = Math.round(
    (bogle.buckets.equities || 0) +
      (bogle.buckets.sgDividends || 0) +
      curCashBucket,
  );
  if (liqTotal >= 5000 && eqDriftPct >= 5) {
    const holTot = Math.max(1, Math.round(hol.totalNetWorth || liqTotal));
    const targetTotalEq = Math.round(holTot * (tgtEqPct / 100));
    const srsEq = Math.round(bogle.buckets.srsGrowth || 0);
    const rawNewLiqEq = Math.min(liqTotal, Math.max(0, targetTotalEq - srsEq));
    const curLiqEq = Math.round(
      (bogle.buckets.equities || 0) + (bogle.buckets.sgDividends || 0),
    );
    const isUnderweightEq = rawNewLiqEq > curLiqEq;
    const shiftAmt = isUnderweightEq
      ? Math.min(rawNewLiqEq - curLiqEq, deployableExcessCash)
      : curLiqEq - rawNewLiqEq;
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
            <span class="fin-moves-done-badge">Cashflow Fully Committed ($0/mo surplus)</span>
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

function buildFinOverviewGrid(
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
  const pct = Math.min(150, Math.max(0, fn.pctFunded));
  const onTrack = pct >= 100 && fn.fullyFundedTo95;
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
    fn.depletionAge != null ? Math.floor(fn.depletionAge) : 90;
  const survivalAnswer = fn.fullyFundedTo95
    ? "Lasts past age 95+"
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
      ? `Can retire ${diffYears} yr${diffYears > 1 ? "s" : ""} earlier · ${fn.pctFunded}% funded`
      : `${fn.pctFunded}% of age-95 goal`;
  const deltaColor =
    diffYears != null && diffYears >= 0 && onTrack ? "#047857" : "#B45309";

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
  const startingSrs = startPt?.srs ?? 0;
  const startingOutside = startPt?.totalOutside ?? 0;
  const startingLiquid = Math.max(0, startingOutside - startingSrs);
  const startingTotalAssets = startingCpf + startingOutside;
  const yearsToRetire = Math.max(0, fire.retire - fire.age);
  const selectedPathName =
    s.key === "salary"
      ? "Salary CPF"
      : s.key === "frs"
        ? "FRS Path"
        : "ERS Path";
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
    salary: {
      name: "Salary CPF",
      tag: "Baseline",
      accent: "#475569",
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

  const activeCoverage = finActivityTab === "coverage";
  const activePaycheck = finActivityTab === "paycheck";
  const activeMilestones = finActivityTab === "milestones";
  const activeSegIdx = activePaycheck ? 1 : activeMilestones ? 2 : 0;
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
        <span class="fin-kpi-sub"><b class="swell-delta is-up">${compactMoney(startingCpf)} CPF</b> · ${compactMoney(startingOutside)} liquid</span>
      </button>
    </div>
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
    </div>
    <div class="fin-saving-trio-grid" role="region" aria-label="Monthly CPF, savings, and investment plan">
      <button type="button" class="fin-card fin-saving-card fin-planned-cpf-card card-surface is-interactive" data-quick-edit="cpf-extra" data-qe-focus="#qe-cpf-extra" aria-label="Edit extra CPF saving each month">
        ${(() => {
          const cpfExtraMo = simulation.cpfExtra || 0;
          const rstuYr = Math.min(8000, Math.round(cpfExtraMo * 12));
          return `<div class="fin-saving-top">
              <span class="fin-saving-title">Extra CPF saving</span>
              <span class="status-pill is-good">4.0% p.a. SA / RA</span>
            </div>
            <div class="fin-saving-val-row">
              <strong>${m(cpfExtraMo, "", "saving-cpf-extra")}</strong>
              <span class="fin-curr">SGD/mo</span>
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
              <strong>${m(taps.tap4Ssb.monthlyCashSaving, "", "saving-cash")}</strong>
              <span class="fin-curr">SGD/mo</span>
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
                <span class="fin-curr">SGD now</span>
              </div>
              <div class="fin-saving-meta">
                <span>Immediate portfolio requirement</span>
                <small>Follows your ${taps.tap3Equities.targetEquityPct}% Equity / ${taps.tap3Equities.targetBondPct}% Bond outside investment split</small>
              </div>`;
          }
          const glPct = taps.tap3Equities.globalSplitPct;
          const sgPct = taps.tap3Equities.sgDividendSplitPct;
          const curInvestBal = taps.tap3Equities.currentEquities;
          const projInvestAtRetire = taps.tap3Equities.projectedInvestAtRetireToday;
          return `<div class="fin-saving-top">
              <span class="fin-saving-title is-invest-tone">Monthly planned investment</span>
              <span class="status-pill is-good">${taps.tap3Equities.targetEquityPct}% Eq / ${taps.tap3Equities.targetBondPct}% Bond</span>
            </div>
            <div class="fin-saving-val-row">
              <strong>${m(taps.tap3Equities.monthlyInvest, "", "saving-outside")}</strong>
              <span class="fin-curr">SGD/mo</span>
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
      const exactPct = r.afterCpf > 0 ? (contribution / r.afterCpf) * 100 : 0;
      const clampedPct = Math.min(100, Math.max(0, exactPct));
      const leftAfterSave = r.afterCpf - contribution;
      const exceedsPay = leftAfterSave < 0;
      const isCritical = exceedsPay || pctOfPay > 85;
      const isStretched = !isCritical && pctOfPay > 50;
      const pillTone = isCritical ? "danger" : isStretched ? "warn" : "good";
      const bandLabel = exceedsPay
        ? "Exceeds pay"
        : pctOfPay > 85
          ? "Critical"
          : pctOfPay > 50
            ? "Stretched"
            : pctOfPay > 30
              ? "Healthy"
              : "Comfortable";
      const pillText = `${bandLabel} · ${pctOfPay}% of take-home`;

      const healthyFill =
        Math.round(Math.min(100, (Math.min(clampedPct, 50) / 50) * 100) * 10) / 10;
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
      const monthlyChipLabel = hasMonthlyShortfall ? "Invest more / mo" : "Cap saving";
      const shortfallLine = hasMonthlyShortfall
        ? ` <span class="fin-saving-gap-note">Currently investing ${m(s.chosenInvest, "/mo")} — ${m(s.contributionShortfall, "/mo")} below target.</span>`
        : "";

      const statusHtml = exceedsPay
        ? `<div class="fin-saving-alert is-danger" role="status">
            <p>Exceeds your <strong>${m(r.afterCpf)}</strong> take-home by <strong>${m(-leftAfterSave, "/mo")}</strong>.${shortfallLine}</p>
            <div class="fin-saving-actions">
              <button type="button" class="fin-action-chip" data-quick-edit="balances">Invest assets</button>
              <button type="button" class="fin-action-chip" commandfor="plan-settings" command="show-modal" aria-haspopup="dialog">Boost return</button>
              <button type="button" class="fin-action-chip" data-quick-edit="invest">${monthlyChipLabel}</button>
              <button type="button" class="fin-action-chip" data-quick-edit="goal">Retire later</button>
              <button type="button" class="fin-action-chip" data-quick-edit="budget">Trim retire budget</button>
            </div>
          </div>`
        : isCritical
          ? `<div class="fin-saving-alert is-danger" role="status">
              <p>Above the <strong>85%</strong> critical threshold — leaves <strong>${m(leftAfterSave, "/mo")}</strong> (${leftSharePct}%) of take-home for living &amp; tax.${shortfallLine}</p>
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
                <p>Above the <strong>50%</strong> healthy threshold — leaves <strong>${m(leftAfterSave, "/mo")}</strong> (${leftSharePct}%) of take-home for living &amp; tax.${shortfallLine}</p>
                <div class="fin-saving-actions">
                  ${hasMonthlyShortfall ? `<button type="button" class="fin-action-chip" data-quick-edit="invest">Invest more / mo</button>` : ""}
                  <button type="button" class="fin-action-chip" data-quick-edit="balances">Invest assets</button>
                  <button type="button" class="fin-action-chip" commandfor="plan-settings" command="show-modal" aria-haspopup="dialog">Boost return</button>
                  <button type="button" class="fin-action-chip" data-quick-edit="invest" data-qe-focus="#qe-target-equity">Adjust split</button>
                </div>
              </div>`
            : `<div class="fin-saving-ok-row">
                <p class="fin-saving-ok">Within the <strong>≤50%</strong> healthy threshold — leaves <strong>${m(leftAfterSave, "/mo")}</strong> (${leftSharePct}%) for living &amp; tax.${shortfallLine}</p>
              </div>`;

      return `<section class="fin-card fin-saving-health-bar card-surface" aria-label="Monthly take-home saving health">
        <div class="fin-saving-health-left">
          <div class="fin-saving-health-head">
            <span class="fin-saving-health-title">Monthly Take-Home Saving Health</span>
            <span class="status-pill is-${pillTone}">${pillText}</span>
          </div>
          <p class="fin-saving-health-sub">
            Total planned saving <strong>${m(contribution, "/mo", "saving-monthly")}</strong> (${m(simulation.cpfExtra || 0)} CPF · ${m(cashSavingMo)} Savings · ${m(simulation.invest)} Investment)
            ${exceedsPay ? `exceeds ${m(r.afterCpf)} take-home by <strong>${m(-leftAfterSave, "/mo", "saving-left")}</strong>` : `leaves <strong>${m(leftAfterSave, "/mo", "saving-left")}</strong> of ${m(r.afterCpf)} take-home`}
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
            <span class="swell-sub-delta" id="hero-nw-sub-live"><b class="swell-delta ${onTrack ? "is-up" : "is-warn"}">${fn.pctFunded}% funded</b> to age 95</span>
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
          const ssbMoFloor = Math.round(taps.tap4Ssb.currentSsbCash > 0 ? (taps.tap4Ssb.currentMonthlyYield ?? taps.tap4Ssb.monthlyYieldAt150k) : taps.tap4Ssb.monthlyYieldAt150k);
          const guaranteedFloorMo = Math.round(s.payout + ssbMoFloor);
          const guaranteedPct = Math.min(100, Math.round((guaranteedFloorMo / Math.max(1, r.spend65)) * 100));
          const marketDrawMo = Math.max(0, Math.round(r.spend65 - guaranteedFloorMo));
          const marketPct = Math.max(0, 100 - guaranteedPct);
          return `<div class="fin-security-split-bar" aria-label="Age-65 Guaranteed Sovereign Floor versus Market Drawdown">
            <div class="fin-security-split-meta">
              <span><i style="background:var(--sem-cpf);"></i>Guaranteed Floor (CPF LIFE + SSB): <strong>${money(guaranteedFloorMo)}/mo (${guaranteedPct}%)</strong></span>
              <span><i style="background:var(--primary);"></i>Market Portfolio Draw: <strong>${money(marketDrawMo)}/mo (${marketPct}%)</strong></span>
            </div>
            <div class="fin-security-split-track" aria-hidden="true">
              <span style="width:${guaranteedPct}%;background:var(--sem-cpf);"></span>
              <span style="width:${marketPct}%;background:var(--primary);"></span>
            </div>
          </div>`;
        })()}
        <div class="swell-chart-subbar">
          <div class="swell-inline-keys" aria-hidden="true">
            <span class="swell-inline-key"><i class="swell-key-swatch is-pink"></i>55+ Wealth</span>
            <span class="swell-inline-key"><i class="swell-key-swatch is-slate"></i>Pre-55 Base</span>
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

      <section class="fin-card fin-activity-card card-surface" aria-label="Top funding sources, paycheck allocation, and milestones">
        <div class="fin-activity-head">
          <h2>Top Funding Sources</h2>
          <button type="button" class="fin-link-pill" data-quick-edit="budget">Edit budget</button>
        </div>
        <div class="fin-segmented-tabs" id="fin-activity-tabs" data-seg-idx="${activeSegIdx}" style="--seg-idx:${activeSegIdx};--seg-count:3" role="tablist" aria-label="Cashflow views">
          <button type="button" role="tab" class="fin-seg-tab${activeCoverage ? " is-active" : ""}" data-fin-activity="coverage" aria-selected="${activeCoverage}">Coverage</button>
          <button type="button" role="tab" class="fin-seg-tab${activePaycheck ? " is-active" : ""}" data-fin-activity="paycheck" aria-selected="${activePaycheck}">Paycheck</button>
          <button type="button" role="tab" class="fin-seg-tab${activeMilestones ? " is-active" : ""}" data-fin-activity="milestones" aria-selected="${activeMilestones}">Milestones</button>
        </div>

        <div class="fin-activity-pane" ${activeCoverage ? "" : "hidden"}>
          <ul class="swell-source-list" aria-label="Key retirement funding and asset sources">
            ${fundingSources
              .map(
                (
                  src,
                  idx,
                ) => `<li class="swell-source-row" style="--item-idx:${idx}">
                  <span class="swell-source-badge" style="background:${src.softBg};color:${src.color};border-color:${src.border};" aria-hidden="true">${src.icon || src.letter}</span>
                  <span class="swell-source-label">
                    <strong style="color:${src.color};">${src.name}</strong>
                    <small>${src.count}</small>
                  </span>
                  <span class="swell-slate-pill">${src.score}</span>
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
                  Math.round((row.amt / grossPlusEmployer) * 100),
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
        )}
        <div class="fin-gauge-facts">
          <div class="fin-gauge-fact-row">
            <span>Retiring at ${fire.retire}</span>
            <strong class="${fn.fullyFundedTo95 ? "is-good" : "is-warn"}">${survivalAnswer}</strong>
          </div>
          <div class="fin-gauge-fact-row">
            <span>Safe age (to 95)</span>
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
          <p>${r.retiringNow ? "With retirement set to now, FRS and ERS model lump-sum funding today; Salary CPF uses existing balances only." : "Compare relying on mandatory salary CPF versus funding FRS or ERS for higher lifelong CPF LIFE income."}</p>
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
            ${r.scenarios
              .map((path) => {
                const meta = pathMeta[path.key] || pathMeta.salary;
                const isSelected = path.key === selected;
                const rowBal = isSelected ? s.balance : path.balance;
                const rowCpf = isSelected && !r.retiringNow ? (simulation.cpfExtra || 0) : path.cpfFunding;
                const rowOut = isSelected && !r.retiringNow ? (simulation.invest || 0) : path.privateSaving;
                const rowLife = isSelected ? s.payout : path.payout;
                const cpfDiffers = isSelected && !r.retiringNow && Math.abs(rowCpf - path.cpfFunding) > 1;
                const outDiffers = isSelected && !r.retiringNow && Math.abs(rowOut - s.privateSaving) > 1;
                return `<tr class="ledger-selectable-row${isSelected ? " is-selected" : ""}" data-path="${path.key}" tabindex="0" role="button" aria-pressed="${isSelected}" aria-label="${meta.name} (${meta.tag}): Age-55 CPF ${money(rowBal)}, CPF LIFE ${money(rowLife)}/mo${isSelected ? ", currently selected" : ""}">
                  <td>
                    <div class="fin-table-path">
                      <span class="ledger-row-radio${isSelected ? " is-active" : ""}" aria-hidden="true"></span>
                      <span class="fin-path-icon" style="background:${meta.softBg};color:${meta.accent};">${meta.icon}</span>
                      <div>
                        <div class="ledger-path-cell">
                          <strong>${meta.name}</strong>
                          <span class="ledger-tag">${meta.tag}</span>
                          ${isSelected ? '<span class="ledger-active-pill">Active Path</span>' : ""}
                        </div>
                        <small class="ledger-sub">${meta.note}</small>
                      </div>
                    </div>
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
          <span class="disclaimer-preview">Today’s dollars · ${Number((r.inflation * 100).toFixed(1))}% inflation · ${Math.round(r.investmentReturn * 100)}% outside return</span>
          <span class="disclaimer-toggle" aria-hidden="true">
            <span class="disclaimer-toggle-label">Details</span>
            <svg class="disclaimer-toggle-icon" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round">
              <path class="line-h" d="M3.5 8h9" />
              <path class="line-v" d="M8 3.5v9" />
            </svg>
          </span>
        </summary>
        <div class="ember-disclaimer-body">
          <ul>
            <li><strong>Purchasing power &amp; return:</strong> Shows today’s dollars (${Number((r.inflation * 100).toFixed(1))}% inflation, ${Math.round(r.investmentReturn * 100)}% blended net outside return including ETFs/SSB; ${r.post55Work ? "post-55 salary CPF included" : "post-55 work contributions excluded"}).</li>
            <li><strong>2026 CPF &amp; IRAS rules:</strong> OW ceiling $8,000/mo, Basic Healthcare Sum $79,000, FRS $220,400, ERS $440,800, and $80,000 personal relief cap.</li>
            <li><strong>Irreversible actions:</strong> Cash RSTU and OA-to-SA transfers before 55 cannot be reversed and receive $0 tax relief once SA/RA hits FRS. <button type="button" class="footnote-link-btn" commandfor="plan-settings" command="show-modal" aria-haspopup="dialog">Review assumptions ↗</button></li>
          </ul>
        </div>
      </details>
    </section>

    <section class="fin-card card-surface swell-taps-card" id="retirement-taps-card" aria-labelledby="taps-blueprint-title">
      <div class="ember-card-head">
        <div>
          <h2 id="taps-blueprint-title">4-Tap Retirement Income Architecture &amp; Guardrails</h2>
          <p>How your CPF LIFE floor, SRS 10-year tax-concession bridge, 85/15 Global &amp; SG Dividend portfolio, and $150k SSB buffer stack together.</p>
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

  const targetGlobalPct =
    hol.targetGlobalPct ??
    Math.round(hol.targetEquityPct * ((100 - hol.sgSleevePct) / 100));
  const targetSgPct =
    hol.targetSgPct ?? Math.max(0, hol.targetEquityPct - targetGlobalPct);
  const globalSplitPct = hol.globalEquitySplitPct ?? 100 - hol.sgSleevePct;
  const sgSplitPct = hol.sgEquitySplitPct ?? hol.sgSleevePct;
  const bondLabel =
    hol.cpfTotal > 0 && hol.liquidBonds > 0
      ? "Bond/CPF"
      : hol.cpfTotal > 0
        ? "CPF"
        : "SSB/Cash";
  const targetBondColor = hol.cpfTotal > 0 ? "#059669" : "#D97706";
  const targetBondTitle =
    hol.cpfTotal > 0 ? "Target Bond / CPF Floor" : "Target SSB / Cash Floor";
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

  return `<nav class="ui-breadcrumb" aria-label="Breadcrumb">
    <button type="button" class="ui-breadcrumb-link" data-go-tab="overview">Overview</button>
    <span class="ui-breadcrumb-sep" aria-hidden="true">/</span>
    <span class="ui-breadcrumb-cur" aria-current="page">Portfolio Allocator</span>
  </nav>
  <header class="ember-page-header fin-page-header">
    <div class="fin-header-copy">
      <h1>Portfolio Allocator</h1>
    </div>
    <div class="ember-header-meta">
      <span class="status-pill ${gapBadge.cls === "is-good" ? "is-good" : "is-info"}">${gapBadge.text}</span>
    </div>
  </header>
  <section class="bogle-card card-surface" id="boglehead-allocator" aria-labelledby="bogle-title">
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
          <span class="donut-tag swell-slate-pill">${m(liq.total, "", "bogle-liq-tot")} today</span>
        </div>
        <div class="donut-row">
          ${liqDonut}
          <ul class="donut-legend">
            <li><i style="background:#2563EB;"></i><span>Global UCITS</span><b>${m(liq.globalEquities, "", "bogle-liq-eq")}</b></li>
            <li><i style="background:#60A5FA;"></i><span>SG Dividends</span><b>${m(liq.sgDividends, "", "bogle-liq-sg")}</b></li>
            <li><i style="background:#D97706;"></i><span>SSB / Cash</span><b>${m(liq.bondsCash, "", "bogle-liq-cash")}</b></li>
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
            <h3>Target Mix &amp; Outside Investment Split</h3>
            <p>Choose a preset or enter your exact % split below — your monthly outside investment and projection follow this split directly.</p>
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

      <div class="bogle-sliders bogle-funnel">
        <div class="bogle-funnel-stage is-stage-1">
          <div class="bogle-funnel-head">
            <div class="bogle-funnel-title-wrap">
              <span class="bogle-step-badge">Step 1 · Total Split</span>
              <label for="bogle-target-slider">Target Equity / Bond Split</label>
            </div>
            <strong class="bogle-funnel-readout" id="bogle-target-readout">${hol.targetEquityPct}% Equity · ${hol.targetBondPct}% Bond</strong>
          </div>
          <div class="bogle-stage1-bar" aria-hidden="true">
            <span id="bogle-stage1-eq-bar" style="width:${hol.targetEquityPct}%;background:var(--primary);"></span>
            <span id="bogle-stage1-bond-bar" style="width:${hol.targetBondPct}%;background:#D97706;"></span>
          </div>
          <div class="bogle-funnel-controls">
            <div class="saving-stepper bogle-stepper">
              <button type="button" data-bogle-step="bogle-target-slider" data-delta="-5" aria-label="Decrease target equity percentage by 5%">−</button>
              <div class="input-wrap">
                <input id="bogle-target-slider" type="number" min="0" max="100" step="1" value="${hol.targetEquityPct}" inputmode="numeric" />
                <span>% Equity (${hol.targetBondPct}% Bond)</span>
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

        <div class="bogle-funnel-connector" aria-hidden="true">
          <span class="bogle-connector-elbow"></span>
          <span class="bogle-connector-badge" id="bogle-funnel-connector-text">${
            hol.targetEquityPct > 0
              ? `Subdivides your <strong>${hol.targetEquityPct}% Equity Sleeve (${money(reb.buyGlobalMonthly + reb.buySgMonthly)}/mo)</strong> into Global vs SG Dividend`
              : `Target Equity is <strong>0%</strong> (100% Bond) — increase Equity above 0% to activate Global / SG sleeve`
          }</span>
        </div>

        <div class="bogle-funnel-stage is-stage-2${hol.targetEquityPct === 0 ? " is-disabled-sleeve" : ""}" id="bogle-funnel-stage-2">
          <div class="bogle-funnel-head">
            <div class="bogle-funnel-title-wrap">
              <span class="bogle-step-badge is-sub" id="bogle-stage2-badge">Step 2 · Inside ${hol.targetEquityPct}% Equity</span>
              <label for="bogle-sg-slider">Equity Sleeve Split (Global / SG Dividend)</label>
            </div>
            <div class="bogle-funnel-readout-group">
              <strong class="bogle-funnel-readout" id="bogle-sg-readout">${globalSplitPct}% Global / ${sgSplitPct}% SG <span class="bogle-of-eq">of Eq</span></strong>
              <span class="bogle-effective-pill" id="bogle-sg-effective-pill">= ${Math.round(hol.targetGlobalPct * 10) / 10}% Global · ${Math.round(hol.targetSgPct * 10) / 10}% SG of total</span>
            </div>
          </div>
          <div class="bogle-funnel-controls">
            <div class="saving-stepper bogle-stepper">
              <button type="button" data-bogle-step="bogle-sg-slider" data-delta="-5" aria-label="Decrease SG dividend sleeve by 5%">−</button>
              <div class="input-wrap">
                <input id="bogle-sg-slider" type="number" min="0" max="100" step="1" value="${hol.sgSleevePct}" inputmode="numeric" />
                <span>% SG (${globalSplitPct}% Global)</span>
              </div>
              <button type="button" data-bogle-step="bogle-sg-slider" data-delta="5" aria-label="Increase SG dividend sleeve by 5%">+</button>
            </div>
            <div class="qe-picker-chips bogle-preset-chips bogle-funnel-chips" role="group" aria-label="SG dividend sleeve presets">
              ${[0, 10, 15, 20, 30, 50, 100]
                .map(
                  (v) =>
                    `<button type="button" class="qe-picker-chip${hol.sgSleevePct === v ? " is-active" : ""}" data-bogle-sg-preset="${v}" aria-pressed="${hol.sgSleevePct === v}">${100 - v}/${v}</button>`,
                )
                .join("")}
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
          <span class="pill-eq"><i class="sem-dot" style="background:#2563EB;"></i><b>${m(reb.buyGlobalMonthly, "/mo", "bogle-reb-eq")}</b> Global UCITS</span>
          <span class="pill-sg"><i class="sem-dot" style="background:#60A5FA;"></i><b>${m(reb.buySgMonthly, "/mo", "bogle-reb-sg")}</b> SG Dividends</span>
          <span class="pill-cash"><i class="sem-dot" style="background:#D97706;"></i><b>${m(reb.buyBondMonthly, "/mo", "bogle-reb-bond")}</b> SSB / T-Bills</span>
          <button type="button" class="fin-link-pill cash-crosslink-btn" data-go-tab="cash-parking">Compare SSB, HYSA &amp; MMFs →</button>
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
        <dd>${m(tax.chargeableIncome, "/yr", "tax-chargeable")}</dd>
        <small>${marginalPct} marginal bracket · ${money(tax.taxBefore.annualTax)}/yr tax</small>
      </div>
      <div class="tax-metric-box">
        <dt>CPF RSTU ($8k cap to FRS)</dt>
        <dd>${m(tax.rstuTaxSaved, "/yr saved", "tax-rstu-saved")}</dd>
        <small>Eligible room: ${money(tax.maxRstu)}/yr (SA room ${money(tax.saRoom)})</small>
      </div>
      <div class="tax-metric-box">
        <dt>SRS ($15.3k Citizen/PR cap)</dt>
        <dd>${m(tax.srsTaxSavedAfterRstu, "/yr saved", "tax-srs-saved")}</dd>
        <small>After RSTU (${money(tax.srsStandaloneTaxSaved)}/yr standalone) · Lock-in age ${tax.srsLockInAge}</small>
      </div>
      <div class="tax-metric-box">
        <dt>$80k Relief Cap Used</dt>
        <dd>${m(tax.reliefCapUsed, "", "tax-cap-used")} <span class="curr-muted">/ $80,000</span></dd>
        <div class="tap-progress-track tax-cap-progress" role="progressbar" aria-valuenow="${capPct}" aria-valuemin="0" aria-valuemax="100" aria-label="${capPct}% of $80,000 personal income tax relief cap used">
          <span class="tap-progress-fill ${capPct >= 95 ? "is-danger" : "is-tap1"}" style="width:${capPct}%"></span>
        </div>
        <small>${capPct}% used by CPF + reliefs (${money(tax.reliefCapRemaining)} left)</small>
      </div>
    </dl>
    <div class="srs-trap-panel is-${tax.srsTrapStatus || "safe"}" role="region" aria-label="Tap 2 SRS Mechanics and Age-${tax.srsLockInAge} Ballooning Trap Guardrail">
      <div class="srs-trap-head">
        <div class="srs-trap-copy">
          <strong>Tap 2 (SRS) Mechanics &amp; Age-${tax.srsLockInAge} Ballooning Guardrail</strong>
          <p>${tax.srsTrapGuidance}</p>
        </div>
        <span class="status-pill ${tax.srsTrapTone || (tax.srsTrapStatus === "balloon-trap" ? "is-danger" : tax.srsTrapStatus === "near-cap" ? "is-warn" : "is-info")}">${tax.srsTrapHeadline}</span>
      </div>
      <dl class="tax-metrics-grid srs-trap-metrics">
        <div class="tax-metric-box">
          <dt>Projected SRS at Age ${tax.srsLockInAge}</dt>
          <dd>${m(tax.srsProjectedAt63, "", "tax-srs-proj63")}</dd>
          <small>${tax.srsProjectedAt63 > 0 ? `${((tax.srsReturnRate ?? 0) * 100).toFixed(2).replace(/\.00$/, "")}% p.a. (${tax.srsInvestedIn === "cash" ? "idle cash" : tax.srsInvestedIn === "ssb" ? "SSB" : tax.srsInvestedIn === "balanced" ? "60/40" : "Global ETFs"}) · ${money(tax.srsBalanceToday)} now + ${money(tax.srsAnnualPlanned)}/yr` : `$0 balance · $0/yr planned (${((tax.srsReturnRate ?? 0) * 100).toFixed(2).replace(/\.00$/, "")}% ${tax.srsInvestedIn === "cash" ? "idle cash" : tax.srsInvestedIn === "ssb" ? "SSB" : tax.srsInvestedIn === "balanced" ? "60/40" : "Global ETFs"} assumed)`}</small>
        </div>
        <div class="tax-metric-box">
          <dt>10-Yr Drawdown (${tax.srsLockInAge}–${tax.srsLockInAge + 10})</dt>
          <dd>${m(tax.srsTenYearAnnualDraw, "/yr", "tax-srs-draw")}</dd>
          <small>${tax.srsProjectedAt63 > 0 ? `${money(tax.srsTenYearMonthlyDraw)}/mo nominal · Tax-free ≤ $40k/yr` : `Up to $40,000/yr ($3,333/mo) tax-free at $400k pot`}</small>
        </div>
        <div class="tax-metric-box">
          <dt>Safe Annual Pace to $400k</dt>
          <dd>${m(tax.srsMaxSafeAnnualTo400k, "/yr", "tax-srs-safe-pace")}</dd>
          <small>${tax.srsFullCapProjectedAt63 > tax.srsTrapFloorAt63 && tax.srsMaxSafeAnnualTo400k < 15250 ? `Over ${tax.srsYearsToLockIn ?? Math.max(0, tax.srsLockInAge - 35)} yrs @ ${((tax.srsReturnRate ?? 0) * 100).toFixed(2).replace(/\.00$/, "")}% · $15.3k/yr max → ${compactMoney(tax.srsFullCapProjectedAt63)} pot` : `Statutory cap $15,300/yr · Direct excess to brokerage`}</small>
        </div>
        <div class="tax-metric-box">
          <dt>Est. Withdrawal Tax (50% Rule)</dt>
          <dd>${m(tax.srsWithdrawalTaxAt63?.annualTax || 0, "/yr", "tax-srs-wdtax")}</dd>
          <small>${tax.srsProjectedAt63 > 0 ? `50% taxable (${money(tax.srsTaxableAnnualAt63)}/yr vs $20k IRAS 0% threshold)` : `50% taxable · $0 tax when draw ≤ $40k/yr ($20k chargeable)`}</small>
        </div>
      </dl>
    </div>
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
    item.category === "sovereign" ||
    item.category === "mmf"
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
      label: item.category === "sovereign" ? "SG Gov Backed" : "SDIC $100k",
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
    return `<div class="cash-empty-state card-surface" role="status">
      <p>No cash parking mediums match <strong>"${q || tagFilter}"</strong>.</p>
      <button type="button" class="button button-small fin-pill-btn" data-cash-reset-filters>Reset search &amp; tags</button>
    </div>`;
  }

  return `<div class="cash-cards-grid">
    ${visibleItems
      .map((item, idx) => {
        const tiers = Array.isArray(item.rateTiers) ? item.rateTiers : [];
        const tierRows = tiers.length
          ? `<div class="cash-rate-rows">${tiers
              .map(
                (t) =>
                  `<div class="cash-rate-row${t.tone ? ` is-${t.tone}` : ""}">
                    <span class="cash-rate-label">${t.label}</span>
                    <strong class="cash-rate-fig">${t.value}</strong>
                  </div>`,
              )
              .join("")}</div>`
          : `<strong class="cash-rate-val">${item.rateHeadline}</strong>`;
        const metaRow =
          item.metaBadge || item.syncBadge
            ? `<div class="cash-rate-meta">
                ${item.metaBadge ? `<span class="cash-tranche-tag">${item.metaBadge}</span>` : "<span></span>"}
                ${item.syncBadge ? `<span class="cash-sync-tag">${item.syncBadge}</span>` : ""}
              </div>`
            : "";

        return `<a class="cash-card card-surface${entering ? " is-entering" : ""}" style="--stagger:${Math.min(idx, 6)}" href="${item.url}" target="_blank" rel="noopener noreferrer" aria-label="${item.name} — ${item.rateHeadline}, ${item.capLabel}. Opens ${item.urlDomain} in a new tab">
          <div class="cash-card-top">
            <span class="cash-cat-tag">${item.categoryLabel}</span>
            <span class="cash-safety-pill is-${item.protectionTone}">${item.protection}</span>
          </div>
          <div class="cash-card-title">
            <h3>${item.name}</h3>
            <span class="cash-provider">${item.provider}</span>
          </div>
          <div class="cash-rate-box">
            ${metaRow}
            ${tierRows}
            <small class="cash-rate-note">${item.rateDetail}</small>
          </div>
          ${
            item.rateContext
              ? (() => {
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
                  return `<div class="cash-hist-box">
                  <div class="cash-hist-head">
                    <span class="cash-hist-verdict is-${rc.tone}">${rc.verdict}</span>
                    ${rc.prevLabel ? `<span class="cash-hist-delta ${rc.deltaPrev >= 0 ? "is-up" : "is-down"}">${rc.deltaText} ${rc.prevLabel}</span>` : ""}
                  </div>
                  <div class="cash-hist-range">
                    <div class="cash-hist-range-labels">
                      <span>12M low ${rc.yr1.min.toFixed(2)}%</span>
                      <span>12M avg ${rc.yr1.avg.toFixed(2)}%</span>
                      <span>high ${rc.yr1.max.toFixed(2)}%</span>
                    </div>
                    <div class="cash-hist-track" aria-hidden="true">
                      <span class="cash-hist-avg-mark" style="left:${minAvgPos}%" title="12M avg"></span>
                      <span class="cash-hist-dot" style="left:${rc.yr1.posPct}%"></span>
                    </div>
                    ${rc.longTerm ? `<div class="cash-hist-long">${rc.longTerm.label}: ${rc.longTerm.min.toFixed(2)}%–${rc.longTerm.max.toFixed(2)}% (avg ${rc.longTerm.avg.toFixed(2)}% · ${rc.longTerm.pctText || rc.longTerm.percentile + "th pct"})</div>` : ""}
                  </div>
                  ${
                    bars.length
                      ? `<div class="cash-hist-spark" aria-label="Last ${bars.length} tranches">
                        ${bars
                          .map((b, bi) => {
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
                            return `<div class="cash-spark-col${isCur ? " is-current" : ""}" title="${b.code}: ${b.rate.toFixed(2)}%">
                              <span class="cash-spark-val">${b.rate.toFixed(2)}</span>
                              <span class="cash-spark-bar-wrap"><span class="cash-spark-bar" style="height:${hPct}%"></span></span>
                              <span class="cash-spark-lbl">${b.label}</span>
                            </div>`;
                          })
                          .join("")}
                      </div>`
                      : ""
                  }
                  <p class="cash-hist-action">${rc.action}</p>
                </div>`;
                })()
              : ""
          }
          <div class="cash-card-tags" aria-label="Vehicle attributes">
            ${getCashItemTags(item)
              .map((t) => `<span class="ui-tag is-${t.key}">${t.label}</span>`)
              .join("")}
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
        </a>`;
      })
      .join("")}
  </div>`;
}

function buildCashAccountReadoutHTML(acc) {
  if (!acc) return "";
  const isUncapped = acc.bonusCap <= 0;
  let breakdownStr = "";
  let badgeTone = "info";
  let badgeDetail = `${money(acc.monthlyInterest)}/mo · ${money(acc.annualInterest)}/yr`;

  if (acc.hasOverflow) {
    breakdownStr = `First <strong>${money(acc.tier1Balance)}</strong> @ <strong>${acc.bonusRatePct.toFixed(2)}%</strong> (${money(acc.tier1AnnualInterest)}/yr) + <strong class="is-overflow-text">${money(acc.overflowBalance)} excess @ ${acc.baseRatePct.toFixed(2)}%</strong> (${money(acc.overflowAnnualInterest)}/yr)`;
    badgeTone = "warn";
    badgeDetail = `${money(acc.monthlyInterest)}/mo · −${acc.rateDragPct.toFixed(2)}% drag`;
  } else if (!isUncapped) {
    const roomLeft = Math.max(0, acc.bonusCap - acc.balance);
    breakdownStr = `Within ${money(acc.bonusCap)} bonus cap @ <strong>${acc.bonusRatePct.toFixed(2)}%</strong> (${money(roomLeft)} cap room left)`;
    badgeTone = "good";
  } else if (acc.category === "sovereign") {
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
  const hasOverflow = bd.totalOverflowBalance > 0;
  const hasSdicWarn = bd.sdicOverflowTotal > 0;
  return `
    <div class="cash-acc-kpi">
      <span>Total Cash &amp; SSB</span>
      <strong>${m(bd.totalBalance)}</strong>
      <small>${bd.accountCount} account${bd.accountCount === 1 ? "" : "s"} synced to plan</small>
    </div>
    <div class="cash-acc-kpi">
      <span>Blended Effective Yield</span>
      <strong class="${hasOverflow ? "is-amber" : "is-emerald"}">${bd.effectiveRatePct.toFixed(2)}% EIR</strong>
      <small>${hasOverflow ? `Dragged down by ${money(bd.totalOverflowBalance)} over cap` : "Compounds cash bucket in FIRE plan"}</small>
    </div>
    <div class="cash-acc-kpi">
      <span>Passive Cash Interest</span>
      <strong>${m(bd.totalMonthlyInterest, "/mo")}</strong>
      <small>${m(bd.totalAnnualInterest, "/yr")} total annual interest</small>
    </div>
    <div class="cash-acc-kpi">
      <span>Bonus Cap &amp; SDIC Status</span>
      <strong class="${hasOverflow || hasSdicWarn ? "is-amber" : "is-emerald"}">${
        hasOverflow
          ? `${m(bd.totalOverflowBalance)} over cap`
          : hasSdicWarn
            ? `${m(bd.sdicOverflowTotal)} over SDIC`
            : "Within all caps ✓"
      }</strong>
      <small>${
        hasOverflow
          ? `Excess earns ${bd.overflowAvgBaseRatePct.toFixed(2)}% · Sweep adds +${money(bd.sweepAnnualGain)}/yr`
          : hasSdicWarn
            ? `Exceeds $100k/bank in ${bd.sdicExceededBanks.map((b) => b.bankLabel).join(", ")}`
            : "All accounts within bonus & $100k SDIC caps"
      }</small>
    </div>`;
}

function buildCashAccountsAlertsHTML(bd) {
  if (!bd) return "";
  const parts = [];
  if (bd.totalOverflowBalance > 0) {
    const overList = bd.accounts
      .filter((a) => a.hasOverflow)
      .map(
        (a) =>
          `<strong>${escapeAttr(a.name)}</strong> has <strong>${money(a.overflowBalance)}</strong> above its ${money(a.bonusCap)} cap earning <strong>${a.baseRatePct.toFixed(2)}%</strong> (dragging account EIR from ${a.bonusRatePct.toFixed(2)}% down to <strong>${a.effectiveRatePct.toFixed(2)}%</strong>)`,
      )
      .join("; ");
    parts.push(`<div class="cash-acc-alert is-warn" role="status">
      <div class="cash-acc-alert-copy">
        <strong>Bonus Cap Overflow Detected (${money(bd.totalOverflowBalance)} earning ${bd.overflowAvgBaseRatePct.toFixed(2)}% base):</strong>
        <span>${overList}. Sweeping the overflow into MAS SSB / T-Bills (${bd.ssb10YrPct.toFixed(2)}%) lifts your blended cash EIR to <strong>${bd.sweptEffectiveRatePct.toFixed(2)}%</strong> (<strong>+${money(bd.sweepAnnualGain)}/yr</strong> extra interest).</span>
      </div>
      ${
        bd.sweepAnnualGain > 0
          ? `<button type="button" class="button button-small button-accent cash-acc-sweep-btn" data-cash-acc-sweep>Sweep ${money(bd.totalOverflowBalance)} overflow to MAS SSB (+${money(bd.sweepAnnualGain)}/yr) →</button>`
          : ""
      }
    </div>`);
  }
  if (bd.sdicOverflowTotal > 0) {
    const sdicList = bd.sdicExceededBanks
      .map(
        (b) =>
          `<strong>${escapeAttr(b.bankLabel)}</strong> combined deposits (<strong>${money(b.balance)}</strong>) exceed the $100,000 SDIC insured limit by <strong>${money(b.uninsured)}</strong>`,
      )
      .join("; ");
    parts.push(`<div class="cash-acc-alert is-info" role="status">
      <div class="cash-acc-alert-copy">
        <strong>Per-Bank $100k SDIC Coverage Notice:</strong>
        <span>${sdicList}. Note that DBS and POSB share a single $100,000 SDIC limit.</span>
      </div>
    </div>`);
  }
  if (bd.ssbTotal > bd.ssbCap) {
    parts.push(`<div class="cash-acc-alert is-warn" role="status">
      <div class="cash-acc-alert-copy">
        <strong>MAS $200,000 Individual SSB Limit Exceeded:</strong>
        <span>Your SSB rows total <strong>${money(bd.ssbTotal)}</strong> (${money(bd.ssbOverflow)} above the $200,000 MAS individual holding cap). Route excess into 6-Month MAS T-Bills or a secondary bank.</span>
      </div>
    </div>`);
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
          `<option value="${pr.key}"${pr.key === selectedKey ? " selected" : ""}>${escapeAttr(pr.name || pr.label)}</option>`,
      )
      .join("");

  return `<div class="cash-acc-editor" data-cash-acc-context="${context}">
    <div class="cash-acc-mode-bar">
      <div class="cash-acc-mode-copy">
        <h3>${isQe ? "SSB / T-Bills / High-Yield Cash Accounts" : "Multi-Account Tiered Cash &amp; SSB Breakdown"}</h3>
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
              <button type="button" class="button button-small button-accent" data-cash-acc-mode="itemized">Break down accounts →</button>
              ${quickPresets
                .slice(0, 5)
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
          <div class="cash-acc-list" role="region" aria-label="Itemized bank and SSB accounts">
            ${bd.accounts
              .map((acc, idx) => {
                const isFlatVehicle =
                  acc.preset === "ssb" ||
                  acc.preset === "tbills" ||
                  acc.preset === "mmf";
                const isCustomPreset = acc.preset === "custom";
                return `<div class="cash-acc-row${acc.hasOverflow ? " is-overflow" : ""}" data-cash-acc-row="${idx}">
                  <div class="cash-acc-row-top${isCustomPreset ? " is-custom-preset" : ""}">
                    <div class="cash-acc-col is-preset">
                      <label for="cash-acc-preset-${context}-${idx}">Bank / Vehicle</label>
                      <div class="input-wrap select-wrap">
                        <select id="cash-acc-preset-${context}-${idx}" data-cash-acc-field="preset" data-cash-acc-idx="${idx}">
                          ${presetOptions(acc.preset)}
                        </select>
                      </div>
                    </div>
                    ${
                      isCustomPreset
                        ? `<div class="cash-acc-col is-name">
                            <label for="cash-acc-name-${context}-${idx}">Bank / Account Name</label>
                            <div class="input-wrap">
                              <input id="cash-acc-name-${context}-${idx}" type="text" maxlength="50" data-cash-acc-field="name" data-cash-acc-idx="${idx}" value="${escapeAttr(acc.name)}" placeholder="e.g. HSBC / CIMB" />
                            </div>
                          </div>`
                        : ""
                    }
                    <div class="cash-acc-col is-balance">
                      <label for="cash-acc-bal-${context}-${idx}">Balance ($)</label>
                      <div class="input-wrap">
                        <span>$</span>
                        <input id="cash-acc-bal-${context}-${idx}" type="number" min="0" max="100000000" step="any" inputmode="decimal" data-cash-acc-field="balance" data-cash-acc-idx="${idx}" value="${acc.balance}" />
                      </div>
                    </div>
                    <div class="cash-acc-col is-remove">
                      <button type="button" class="exp-remove-btn cash-acc-remove-btn" data-cash-acc-remove="${idx}" aria-label="Remove ${escapeAttr(acc.name)}" title="Remove account">×</button>
                    </div>
                  </div>
                  <div class="cash-acc-row-rules${isFlatVehicle ? " is-flat" : ""}">
                    ${
                      isFlatVehicle
                        ? `<div class="cash-acc-col is-rate">
                            <label for="cash-acc-bonus-${context}-${idx}">${acc.preset === "ssb" ? "10-Yr Avg Yield" : "Annual Yield"}</label>
                            <div class="input-wrap">
                              <input id="cash-acc-bonus-${context}-${idx}" type="number" min="0" max="20" step="0.05" inputmode="decimal" data-cash-acc-field="bonusRatePct" data-cash-acc-idx="${idx}" value="${acc.bonusRatePct}" />
                              <span>%</span>
                            </div>
                          </div>
                          <div class="cash-acc-flat-meta">
                            <span>${
                              acc.preset === "ssb"
                                ? "AAA Singapore Gov · $200,000 MAS individual holding limit across all SSB tranches"
                                : acc.preset === "tbills"
                                  ? "AAA Singapore Gov · No individual holding limit · 6M / 1Y auction cut-off"
                                  : "Institutional SGD Money Market Fund · Uncapped (non-SDIC custodian)"
                            }</span>
                          </div>`
                        : `<div class="cash-acc-col is-cap">
                            <label for="cash-acc-cap-${context}-${idx}" title="Max balance earning the bonus rate (enter 0 for uncapped)">Bonus Cap ($)</label>
                            <div class="input-wrap">
                              <span>$</span>
                              <input id="cash-acc-cap-${context}-${idx}" type="number" min="0" max="100000000" step="1000" inputmode="numeric" data-cash-acc-field="bonusCap" data-cash-acc-idx="${idx}" value="${acc.bonusCap}" placeholder="0 = none" />
                            </div>
                          </div>
                          <div class="cash-acc-col is-rate">
                            <label for="cash-acc-bonus-${context}-${idx}" title="Interest rate on balance up to the bonus cap">Rate up to Cap</label>
                            <div class="input-wrap">
                              <input id="cash-acc-bonus-${context}-${idx}" type="number" min="0" max="20" step="0.05" inputmode="decimal" data-cash-acc-field="bonusRatePct" data-cash-acc-idx="${idx}" value="${acc.bonusRatePct}" />
                              <span>%</span>
                            </div>
                          </div>
                          <div class="cash-acc-col is-rate">
                            <label for="cash-acc-base-${context}-${idx}" title="Base interest rate on any excess balance above the bonus cap">Rate &gt; Cap</label>
                            <div class="input-wrap">
                              <input id="cash-acc-base-${context}-${idx}" type="number" min="0" max="20" step="0.05" inputmode="decimal" data-cash-acc-field="baseRatePct" data-cash-acc-idx="${idx}" value="${acc.baseRatePct}" />
                              <span>%</span>
                            </div>
                          </div>`
                    }
                  </div>
                  <div class="cash-acc-row-readout" data-cash-acc-readout="${idx}">
                    ${buildCashAccountReadoutHTML(acc)}
                  </div>
                </div>`;
              })
              .join("")}
          </div>
          <div class="cash-acc-quick-bar" aria-label="Quick-add Singapore bank or sovereign cash account">
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
        <p>${cp.positionNote}</p>
      </div>
      <span class="status-pill is-${cp.positionTone}">${cp.positionHeadline}</span>
    </div>

    <dl class="tax-metrics-grid cash-kpi-grid">
      <div class="tax-metric-box">
        <dt>6–12m Emergency Target</dt>
        <dd>${m(cp.emergencyMin, "", "cash-em-min")}–${m(cp.emergencyMax, "", "cash-em-max")}</dd>
        <small>6–12m × ${money(cp.emergencyMonthlyBase)}/mo retire budget</small>
      </div>
      <div class="tax-metric-box">
        <dt>Entered SSB / Cash Bucket</dt>
        <dd>${m(cp.currentCash, "", "cash-entered")}</dd>
        <small>${
          cp.cashAccountsActive && bd
            ? `${bd.accountCount} account${bd.accountCount === 1 ? "" : "s"} · <strong>${bd.effectiveRatePct.toFixed(2)}% blended EIR</strong> (~${money(bd.totalMonthlyInterest)}/mo)`
            : `Target $150,000 SSB after buffer (max ${money(cp.ssbCap)} MAS cap · ${money(cp.sdicCap)} SDIC/bank)`
        }</small>
      </div>
      <div class="tax-metric-box">
        <dt>Monthly Cash / Bond Slice</dt>
        <dd>${m(cp.monthlyCashSlice > 0 ? cp.monthlyCashSlice : 0, "/mo", "cash-monthly-slice")}</dd>
        <small>${
          cp.monthlyCashSaving > 0
            ? `${money(cp.monthlyCashSaving)}/mo planned savings + ${money(cp.monthlyBondSlice || 0)}/mo bond slice`
            : cp.hasSrs
              ? "Idle SRS earns 0.05% — park in T-Bills/MMFs"
              : "From Allocator SSB / T-Bills target"
        }</small>
      </div>
    </dl>

    ${buildCashAccountsEditorHTML(cp, "page")}

    <div class="cash-ladder-grid" aria-label="Suggested cash parking waterfall">
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
    <nav class="ui-breadcrumb" aria-label="Breadcrumb">
      <button type="button" class="ui-breadcrumb-link" data-go-tab="overview">Overview</button>
      <span class="ui-breadcrumb-sep" aria-hidden="true">/</span>
      <span class="ui-breadcrumb-cur" aria-current="page">Cash Parking &amp; Yield Mediums</span>
    </nav>
    <header class="ember-page-header fin-page-header">
      <div class="fin-header-copy">
        <h1>Cash Parking &amp; Yield Mediums</h1>
        <p class="cash-page-sub">Compare Singapore cash vehicles, holding limits, and SDIC coverage. Click any card to view live rates on the official provider site.</p>
      </div>
      <div class="cash-header-sync">
        <span class="fin-target-pill cash-sync-pill">${syncText}</span>
        <button type="button" class="button button-small cash-sync-btn" data-cash-sync title="Check latest SSB tranche &amp; T-Bill auction cut-off">↻ Sync MAS</button>
      </div>
    </header>

    <div class="cash-plan-slot">${buildCashPlanCardHTML(cp)}</div>

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
          <input type="search" id="cash-search-input" class="cash-search-input" placeholder="Search SSB, MariBank, UOB, SRS, T+0…" aria-label="Search cash parking vehicles" value="${String(searchQuery || "").replace(/"/g, "&quot;")}" />
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
    pinPct = 18 + ((rPct - ssbFloor) / Math.max(0.05, divModel.inflationPct - ssbFloor)) * 14;
  } else if (rPct < 4.0) {
    pinPct = 32 + ((rPct - divModel.inflationPct) / Math.max(0.1, 4.0 - divModel.inflationPct)) * 17;
  } else if (rPct <= 6.0) {
    pinPct = 49 + ((rPct - 4.0) / 2.0) * 20;
  } else if (rPct <= 7.5) {
    pinPct = 69 + ((rPct - 6.0) / 1.5) * 15;
  } else {
    pinPct = Math.min(98, 84 + ((rPct - 7.5) / 4.5) * 16);
  }
  const zones = [
    { key: "sub-floor", label: "<2.2% Bank", width: "18%" },
    { key: "capital-preserve", label: "2.2–2.5% SSB", width: "14%" },
    { key: "safe-floor", label: "2.5–4% CPF", width: "17%" },
    { key: "sweet-spot", label: "4–6% SG Div", width: "20%" },
    { key: "elevated", label: "6–7.5% High", width: "15%" },
    { key: "yield-trap", label: ">7.5% Trap", width: "16%" },
  ];

  return `
    <div class="div-payout-hero">
      <div class="div-payout-main">
        <span class="div-payout-eyebrow">Monthly Passive Income</span>
        <strong class="div-payout-amount" id="div-monthly-readout">${centsHtml(divModel.monthlyPayout)}<span>/mo</span></strong>
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
        <h3 id="div-verdict-headline">${divModel.headline}</h3>
      </div>
      <p class="div-verdict-summary" id="div-verdict-summary">${divModel.summary}</p>
      <div class="div-spectrum-wrap" aria-label="Singapore yield benchmark spectrum from 0% to 10%+">
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
                    ? `+${centsHtml(tierVsYours)}/mo`
                    : `−${centsHtml(Math.abs(tierVsYours))}/mo`;
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
                <td class="num-col"><strong class="div-mo-val">${centsHtml(b.monthlyPayout)}<span>/mo</span></strong></td>
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
        ? "Cannot reach goal at $0/mo contribution"
        : `Saving ${m(targetModel.monthlyContribution, "/mo")} at ${targetModel.ratePct.toFixed(2)}% p.a.`;

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
        <h3>${targetModel.headline}</h3>
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
              (row) => `<tr class="${row.isSelected ? "is-selected is-active-row" : ""}">
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
  const vsCpfDelta = Math.round(annuityModel.diyCpfSa.monthlyPayout - annuityModel.quotedMonthlyPayout);
  const vsDiyDelta = Math.round(annuityModel.diyBench.monthlyPayout - annuityModel.quotedMonthlyPayout);

  return `
    <div class="div-payout-hero">
      <div class="div-payout-main">
        <span class="div-payout-eyebrow">Implied Annualized Return (IRR)</span>
        <strong class="div-payout-amount ${irrTone}" id="div-annuity-irr-readout">${irrStr}</strong>
        <p class="div-payout-sub"><strong>${m(annuityModel.monthlyContribution, "/mo")}</strong> × <strong>${annuityModel.contributeYears} yrs</strong>${annuityModel.deferYears > 0 ? ` · <strong>${annuityModel.deferYears} yrs</strong> deferment` : ""} → <strong>${m(annuityModel.quotedMonthlyPayout, "/mo")}</strong> × <strong>${annuityModel.payoutYears} yrs</strong></p>
      </div>
      <div class="div-payout-subgrid">
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
        <h3>${annuityModel.headline}</h3>
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
                <td class="num-col"><strong class="div-mo-val">${m(Math.round(c.monthlyPayout))}<span>/mo</span></strong></td>
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
    { val: Number(divModel.ssbRatePct.toFixed(2)), label: `${divModel.ssbRatePct.toFixed(2)}% MAS SSB` },
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
    mode === "target"
      ? targetModel.tone
      : mode === "annuity"
        ? annuityModel.tone
        : divModel.tone;
  const hdrText =
    mode === "target"
      ? `${targetModel.badge} · ${m(targetModel.requiredCapital)} needed`
      : mode === "annuity"
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
                const active = Math.round(targetModel.currentCapital) === cp.val;
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
                const active = Math.round(targetModel.monthlyContribution) === sp.val;
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
      <div class="div-subcontrols-grid">
        <div class="div-control-block">
          <div class="div-control-label-row">
            <label for="div-annuity-mo-save" id="div-calc-heading">Monthly Premium</label>
            <span class="div-control-hint">Regular contribution</span>
          </div>
          <div class="input-prefix div-cap-input-wrap">
            <span>$</span>
            <input id="div-annuity-mo-save" type="number" inputmode="numeric" min="50" max="500000" step="50" value="${Math.round(annuityModel.monthlyContribution)}" aria-label="Monthly contribution to annuity plan" />
          </div>
          <div class="div-chip-row" role="group" aria-label="Monthly pay-in presets">
            ${saveMoPresets
              .slice(0, 5)
              .map((sp) => {
                const active = Math.round(annuityModel.monthlyContribution) === sp.val;
                return `<button type="button" class="div-preset-chip${active ? " is-active" : ""}" data-div-annuity-save-pick="${sp.val}" aria-pressed="${active}">${sp.label}</button>`;
              })
              .join("")}
          </div>
        </div>

        <div class="div-control-block">
          <div class="div-control-label-row">
            <label for="div-annuity-quoted-mo">Quoted Monthly Payout</label>
            <span class="div-control-hint">Projected monthly income</span>
          </div>
          <div class="input-prefix div-cap-input-wrap">
            <span>$</span>
            <input id="div-annuity-quoted-mo" type="number" inputmode="numeric" min="0" max="1000000" step="50" value="${Math.round(annuityModel.quotedMonthlyPayout)}" aria-label="Quoted monthly payout from annuity" />
          </div>
          <div class="div-chip-row" role="group" aria-label="Quoted monthly payout presets">
            ${[800, 1000, 1150, 1350, 1800]
              .map((qp) => {
                const active = Math.round(annuityModel.quotedMonthlyPayout) === qp;
                return `<button type="button" class="div-preset-chip${active ? " is-active" : ""}" data-div-annuity-payout-pick="${qp}" aria-pressed="${active}">$${qp.toLocaleString("en-SG")}/mo</button>`;
              })
              .join("")}
          </div>
        </div>
      </div>

      <div class="div-subcontrols-grid is-three-cols">
        <div class="div-control-block">
          <div class="div-control-label-row">
            <label for="div-annuity-pay-yrs">Premium Term</label>
          </div>
          <div class="input-suffix div-rate-num-wrap">
            <input id="div-annuity-pay-yrs" type="number" inputmode="numeric" min="1" max="50" step="1" value="${annuityModel.contributeYears}" aria-label="Number of years paying premiums" />
            <span>yrs</span>
          </div>
          <div class="div-chip-row">
            ${[5, 10, 15, 20]
              .map(
                (y) =>
                  `<button type="button" class="div-preset-chip${annuityModel.contributeYears === y ? " is-active" : ""}" data-div-annuity-pay-yrs="${y}">${y}y</button>`,
              )
              .join("")}
          </div>
        </div>

        <div class="div-control-block">
          <div class="div-control-label-row">
            <label for="div-annuity-defer-yrs">Deferment Period</label>
          </div>
          <div class="input-suffix div-rate-num-wrap">
            <input id="div-annuity-defer-yrs" type="number" inputmode="numeric" min="0" max="30" step="1" value="${annuityModel.deferYears}" aria-label="Deferment years before payout starts" />
            <span>yrs</span>
          </div>
          <div class="div-chip-row">
            ${[0, 5, 10, 15]
              .map(
                (y) =>
                  `<button type="button" class="div-preset-chip${annuityModel.deferYears === y ? " is-active" : ""}" data-div-annuity-defer-yrs="${y}">${y}y</button>`,
              )
              .join("")}
          </div>
        </div>

        <div class="div-control-block">
          <div class="div-control-label-row">
            <label for="div-annuity-draw-yrs">Payout Duration</label>
          </div>
          <div class="input-suffix div-rate-num-wrap">
            <input id="div-annuity-draw-yrs" type="number" inputmode="numeric" min="1" max="50" step="1" value="${annuityModel.payoutYears}" aria-label="Number of years receiving payouts" />
            <span>yrs</span>
          </div>
          <div class="div-chip-row">
            ${[10, 15, 20, 30]
              .map(
                (y) =>
                  `<button type="button" class="div-preset-chip${annuityModel.payoutYears === y ? " is-active" : ""}" data-div-annuity-draw-yrs="${y}">${y}y</button>`,
              )
              .join("")}
          </div>
        </div>
      </div>`;
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
    <nav class="ui-breadcrumb" aria-label="Breadcrumb">
      <button type="button" class="ui-breadcrumb-link" data-go-tab="overview">Overview</button>
      <span class="ui-breadcrumb-sep" aria-hidden="true">/</span>
      <span class="ui-breadcrumb-cur" aria-current="page">Dividend &amp; Yield Calculator</span>
    </nav>
    <header class="ember-page-header fin-page-header">
      <div class="fin-header-copy">
        <h1>Dividend, Target Income &amp; Annuity Calculator</h1>
        <p class="cash-page-sub">Standalone Singapore calculator for lump-sum yield, target monthly passive income, and retirement annuity evaluation.</p>
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
        <div class="div-calc-controls">
          ${controlsHTML}
        </div>

        <div class="div-calc-results" id="div-calc-results-pane">
          ${resultsHTML}
        </div>
      </div>
    </section>

    <section class="card-surface rules-card div-bench-card" id="dividend-benchmarks-card" aria-labelledby="div-bench-title">
      ${benchHTML}
    </section>
  `;
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
    cashSaving: "known-cash-saving",
    cashReturnRate: "known-cash-return",
    invest: "known-invest",
    plan: "known-plan",
    returnRate: "known-return",
    inflationRate: "known-inflation",
    post55Work: "known-post55",
  };
  const planRoot = $("#retirement-plan");
  const overviewSlot = $("#overview-slot");
  const allocatorSlot = $("#allocator-slot");
  const cashParkingSlot = $("#cash-parking-slot");
  const dividendCalcSlot = $("#dividend-calc-slot");
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
  let currentAfterCpfCap = 0;
  let currentCashPlan = null;
  let liveMasRates = null;
  let cashParkingFilter = "all";
  let divCalcMode = "lump"; // "lump" | "target" | "annuity"
  let divCalcCapital = 100000;
  let divCalcRatePct = 5.0;
  let divTargetMonthly = 10000;
  let divTargetRatePct = 5.0;
  let divTargetCurrCap = 100000;
  let divTargetMoSave = 2000;
  let divAnnuityMoSave = 1000;
  let divAnnuityPayYears = 10;
  let divAnnuityDeferYears = 5;
  let divAnnuityDrawYears = 15;
  let divAnnuityQuotedMo = 1150;
  let divAnnuityBenchRatePct = 5.0;
  let cashParkingSearch = "";
  let cashParkingTag = "all";
  let cashAnimFrame = 0;
  let toastTimer = null;
  const showToast = (msg, ms = 2600) => {
    const toastEl = $("#ui-toast");
    const textEl = $("#ui-toast-text");
    if (!toastEl || !textEl) return;
    textEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.hidden = true;
    }, ms);
  };
  const expDialog = $("#expense-modal");
  const expModalBody = $("#expense-modal-body");
  let lastExpInvoker = null;
  let customBudgetActive = false;
  let useItemizedExpenses = false;
  let customExpenseItems = [];
  const clearCustomBudgetState = () => {
    customBudgetActive = false;
    useItemizedExpenses = false;
    customExpenseItems = [];
  };
  const sumCustomExpenseItems = () =>
    Math.round(customExpenseItems.reduce((s, it) => s + it.amount, 0) * 100) /
    100;
  let newlyAddedExpId = null;
  let useItemizedCashAccounts = false;
  let customCashAccounts = [];
  const clearCustomCashAccountsState = () => {
    useItemizedCashAccounts = false;
    customCashAccounts = [];
  };
  const sumCustomCashAccounts = () =>
    Math.round(
      customCashAccounts.reduce(
        (s, acc) => s + Math.max(0, Number(acc.balance) || 0),
        0,
      ) * 100,
    ) / 100;
  let hasCompletedInitialRender = false;
  let prevActivitySegIdx = 0;
  let prevExpSegIdx = null;
  const prevAnimNums = new Map();
  const curAnimNums = new Map();
  const prevMeters = new Map();
  let numAnimFrame = 0;
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
      localStorage.setItem("rs_plan_version", "2");
    }
  } catch (_) {}

  const applyStateParams = (params, { resetFirst = false } = {}) => {
    if (!params) return false;
    if (
      params.get("version") !== "2" ||
      !["cca", "home-helper"].includes(params.get("lifestyle"))
    ) {
      return false;
    }
    if (resetFirst) {
      clearCustomBudgetState();
      clearCustomCashAccountsState();
      Object.values(fields).forEach((id) => {
        const el = $("#" + id);
        if (el) el.value = el.defaultValue ?? "";
      });
      if ($("#person-dob")) $("#person-dob").value = DEFAULT_DOB;
      selected = "salary";
      learningTarget = "frs";
      ["#sim-cash-saving", "#sim-invest", "#qe-cpf-extra", "#qe-cash-saving", "#qe-cash-return", "#qe-invest"].forEach((sel) => {
        const el = $(sel);
        if (el) el.value = "";
      });
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
          } else if (
            [
              "annualBonus",
              "oa",
              "sa",
              "ma",
              "maSpend",
              "saInvested",
              "srs",
              "srsAnnual",
            ].includes(key) &&
            Number(params.get(key)) === 0
          ) {
            el.value = "";
          } else {
            el.value = params.get(key);
          }
        }
      } else if (resetFirst) {
        const el = $("#" + id);
        if (el && ["cpfExtra", "cashSaving", "cashReturnRate", "invest", "spend", "housing"].includes(key)) {
          el.value = "";
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
    if ($("#sim-cash-saving") && $("#known-cash-saving")) {
      $("#sim-cash-saving").value = $("#known-cash-saving").value;
    }
    if ($("#sim-invest") && $("#known-invest")) {
      $("#sim-invest").value = $("#known-invest").value;
    }
    if ($("#bogle-target-slider") && $("#known-target-equity")) {
      $("#bogle-target-slider").value = $("#known-target-equity").value || "80";
    }
    if ($("#bogle-sg-slider") && $("#known-sg-sleeve")) {
      $("#bogle-sg-slider").value = $("#known-sg-sleeve").value || "15";
    }
    if (params.get("expMode") === "itemized" && params.get("expItems")) {
      try {
        const parsed = JSON.parse(params.get("expItems"));
        if (Array.isArray(parsed) && parsed.length > 0) {
          customExpenseItems = parsed
            .filter((row) => Array.isArray(row) && row.length >= 3)
            .map((row, idx) => ({
              id: "exp-" + (idx + 1),
              name: String(row[0] || "Expense " + (idx + 1)),
              category: String(row[1] || "food"),
              amount: Math.max(0, Number(row[2]) || 0),
            }));
          if (customExpenseItems.length > 0) {
            customBudgetActive = true;
            useItemizedExpenses = true;
            const tot = sumCustomExpenseItems();
            if ($("#known-spend")) $("#known-spend").value = String(tot);
          }
        }
      } catch (_) {}
    } else {
      const restoredLife = params.get("lifestyle") || "cca";
      const presetBudget =
        RetirementModel.lifestyles[restoredLife]?.budget || 2800;
      const rawSpend = (params.get("spend") || "").trim();
      if (
        params.get("expMode") === "figure" ||
        (rawSpend !== "" &&
          Number.isFinite(Number(rawSpend)) &&
          Math.round(Number(rawSpend) * 100) !==
            Math.round(presetBudget * 100))
      ) {
        customBudgetActive = true;
        useItemizedExpenses = false;
      }
    }
    if (params.get("cashMode") === "itemized" && params.get("cashItems")) {
      try {
        const parsedCash = JSON.parse(params.get("cashItems"));
        if (Array.isArray(parsedCash) && parsedCash.length > 0) {
          customCashAccounts = parsedCash
            .filter((row) => Array.isArray(row) && row.length >= 3)
            .map((row, idx) => {
              const presetKey = String(row[0] || "custom");
              const preset =
                RetirementModel.resolveCashAccountPreset(presetKey);
              return {
                id: "cash-acc-" + (idx + 1),
                preset: preset.key,
                name: String(row[1] || preset.name),
                balance: Math.max(0, Number(row[2]) || 0),
                bonusCap:
                  row[3] != null && Number.isFinite(Number(row[3]))
                    ? Math.max(0, Number(row[3]))
                    : preset.bonusCap,
                bonusRatePct:
                  row[4] != null && Number.isFinite(Number(row[4]))
                    ? Math.max(0, Number(row[4]))
                    : preset.bonusRatePct,
                baseRatePct:
                  row[5] != null && Number.isFinite(Number(row[5]))
                    ? Math.max(0, Number(row[5]))
                    : preset.baseRatePct,
              };
            });
          if (customCashAccounts.length > 0) {
            useItemizedCashAccounts = true;
            const totCash = sumCustomCashAccounts();
            if ($("#known-ssb-cash"))
              $("#known-ssb-cash").value = String(totCash);
          }
        }
      } catch (_) {}
    }
    return true;
  };

  const restoreSavedState = () => {
    try {
      let params = null;
      if (
        location.hash &&
        location.hash.length > 2 &&
        location.hash.includes("=")
      ) {
        params = new URLSearchParams(location.hash.slice(1));
        history.replaceState(history.state, "", location.pathname + location.search);
      } else {
        const saved = localStorage.getItem("rs_plan_state");
        if (saved) params = new URLSearchParams(JSON.parse(saved));
      }
      if (!params) return;
      if (localStorage.getItem("rs_taps_85_15") !== "1") {
        localStorage.setItem("rs_taps_85_15", "1");
        if (params.get("sgSleevePct") === "10") {
          params.set("sgSleevePct", "15");
        }
      }
      if (!applyStateParams(params, { resetFirst: false })) {
        localStorage.removeItem("rs_plan_state");
        if (location.hash.includes("="))
          history.replaceState(null, "", location.pathname + location.search);
      }
    } catch (_) {}
  };
  restoreSavedState();
  window.addEventListener("hashchange", () => {
    if (location.hash && location.hash.includes("=")) {
      restoreSavedState();
      render();
    }
  });

  let initialAnchorBoot = Boolean(
    location.hash && location.hash.length > 1 && !location.hash.includes("="),
  );
  const persistState = (p) => {
    if (!savingEnabled) return;
    try {
      const data = {
        ...p,
        selected,
        learningTarget,
        version: 2,
      };
      delete data.cashAccounts;
      delete data.cashAccountsActive;
      if (customBudgetActive) {
        if (useItemizedExpenses && customExpenseItems.length > 0) {
          data.expMode = "itemized";
          data.expItems = JSON.stringify(
            customExpenseItems.map((it) => [it.name, it.category, it.amount]),
          );
        } else {
          data.expMode = "figure";
        }
      }
      if (useItemizedCashAccounts && customCashAccounts.length > 0) {
        data.cashMode = "itemized";
        data.cashItems = JSON.stringify(
          customCashAccounts.map((acc) => [
            acc.preset || "custom",
            acc.name || "Cash Account",
            Math.round((Number(acc.balance) || 0) * 100) / 100,
            Math.round((Number(acc.bonusCap) || 0) * 100) / 100,
            Math.round((Number(acc.bonusRatePct) || 0) * 100) / 100,
            Math.round((Number(acc.baseRatePct) || 0) * 100) / 100,
          ]),
        );
      }
      const search = new URLSearchParams();
      for (const [k, v] of Object.entries(data)) {
        if (v != null && v !== "") search.set(k, String(v));
      }
      localStorage.setItem(
        "rs_plan_state",
        JSON.stringify(Object.fromEntries(search.entries())),
      );
      if (initialAnchorBoot) {
        initialAnchorBoot = false;
      } else if (location.hash && location.hash.includes("=")) {
        history.replaceState(history.state, "", location.pathname + location.search);
      }
    } catch (_) {}
  };

  const lastValidFieldValues = {};
  let lastCustomSpend = "";
  let lastCustomLifestyle = "";
  const qePanelForSrc = {
    "person-dob": { panel: "age", qeId: "qe-dob" },
    "known-retire": { panel: "goal", qeId: "qe-retire" },
    "known-lifestyle": { panel: "budget", qeId: null },
    "known-spend": { panel: "budget", qeId: null },
    "known-plan": { panel: "budget", qeId: null },
    "person-salary": { panel: "salary", qeId: "qe-salary" },
    "known-annual-bonus": { panel: "salary", qeId: "qe-annual-bonus" },
    "known-housing": { panel: "income", qeId: "qe-housing" },
    "known-housing-mode": { panel: "income", qeId: "qe-housing-mode" },
    "known-housing-balance": { panel: "income", qeId: "qe-housing-balance" },
    "known-housing-years": { panel: "income", qeId: "qe-housing-years" },
    "known-housing-rate": { panel: "income", qeId: "qe-housing-rate" },
    "known-housing-parties": { panel: "income", qeId: "qe-housing-parties" },
    "known-cpf-extra": { panel: "cpf-extra", qeId: "qe-cpf-extra" },
    "known-cash-saving": { panel: "cash-saving", qeId: "qe-cash-saving" },
    "sim-cash-saving": { panel: "cash-saving", qeId: "qe-cash-saving" },
    "known-cash-return": { panel: "cash-saving", qeId: "qe-cash-return" },
    "known-invest": { panel: "invest", qeId: "qe-invest" },
    "sim-invest": { panel: "invest", qeId: "qe-invest" },
    "known-target-equity": { panel: "invest", qeId: "qe-target-equity" },
    "known-sg-sleeve": { panel: "invest", qeId: "qe-sg-sleeve" },
    "known-oa": { panel: "balances", qeId: "qe-oa" },
    "known-sa": { panel: "balances", qeId: "qe-sa" },
    "known-ma": { panel: "balances", qeId: "qe-ma" },
    "known-sa-invested": { panel: "balances", qeId: "qe-sa-invested" },
    "known-equities": { panel: "balances", qeId: "qe-equities" },
    "known-sg-dividends": { panel: "balances", qeId: "qe-sg-dividends" },
    "known-ssb-cash": { panel: "balances", qeId: "qe-ssb-cash" },
    "known-srs": { panel: "balances", qeId: "qe-srs" },
    "known-srs-invested": { panel: "balances", qeId: "qe-srs-invested" },
  };
  const getCustomSpendState = (rLifestyle = null) => {
    const lifestyleKey = rLifestyle || $("#known-lifestyle")?.value || "cca";
    const presetBudget =
      RetirementModel.lifestyles[lifestyleKey]?.budget || 2800;
    const spendEl = $("#known-spend");
    const raw = (spendEl?.value || "").trim();
    const hasNumericOverride =
      raw !== "" &&
      Boolean(spendEl?.validity?.valid) &&
      Number.isFinite(Number(raw));
    const differsFromPreset =
      hasNumericOverride &&
      Math.round(Number(raw) * 100) !== Math.round(presetBudget * 100);
    const isCustom = Boolean(customBudgetActive || differsFromPreset);
    return {
      lifestyleKey,
      presetBudget,
      isCustom,
      spend: hasNumericOverride ? Number(raw) : presetBudget,
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
      if (cashParkingSlot) cashParkingSlot.innerHTML = "";
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
    $$("[data-print-trigger]").forEach((btn) => {
      btn.disabled = true;
    });
    const printEl = $("#print-sheet");
    if (printEl && !hasRenderedView) {
      printEl.innerHTML = `<div class="poster-sheet"><div class="poster-panel"><h3>Input check needed before printing</h3><p>${escapeAttr(message)}</p></div></div>`;
    }
    $("#start-plan-error").textContent = message;
    const startErrActions = $("#settings-error-actions");
    if (startErrActions) {
      startErrActions.replaceChildren();
      if (message && errorBanner) {
        errorBanner
          .querySelectorAll("[data-clamp-field], [data-sg-reset]")
          .forEach((btn) => {
            startErrActions.append(btn.cloneNode(true));
          });
      }
      startErrActions.hidden = !startErrActions.childElementCount;
    }
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
    if ($("#exp-modal-live-summary")) {
      $("#exp-modal-live-summary").textContent =
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
      const val = String(learningPlan.monthly);
      $("#known-cpf-extra").value = val;
      if ($("#qe-cpf-extra")) $("#qe-cpf-extra").value = val;
      if ($("#known-invest")) $("#known-invest").value = "";
      if ($("#sim-invest")) $("#sim-invest").value = "";
      if ($("#qe-invest")) $("#qe-invest").value = "";
      render();
      return;
    }
    const togglePlanBtn = event.target.closest("[data-toggle-cpf-plan]");
    if (togglePlanBtn) {
      const nextPlan = togglePlanBtn.dataset.toggleCpfPlan || "standard";
      if ($("#known-plan") && $("#known-plan").value !== nextPlan) {
        $("#known-plan").value = nextPlan;
        render();
        showToast(
          nextPlan === "escalating"
            ? "CPF LIFE switched to Escalating Plan (+2%/yr)"
            : "CPF LIFE switched to Standard Plan (level payout)",
        );
      }
      return;
    }
    const pathBtn = event.target.closest("[data-path]");
    if (pathBtn) {
      selected = pathBtn.dataset.path;
      $("#known-cpf-extra").value = "";
      if ($("#qe-cpf-extra")) $("#qe-cpf-extra").value = "";
      if ($("#known-invest")) $("#known-invest").value = "";
      if ($("#sim-invest")) $("#sim-invest").value = "";
      if ($("#qe-invest")) $("#qe-invest").value = "";
      render();
      $(`[data-path="${selected}"]`)?.focus({ preventScroll: true });
      const label =
        selected === "frs"
          ? "FRS Target ($220.4k)"
          : selected === "ers"
            ? "ERS Maximum ($440.8k)"
            : "Salary CPF Baseline";
      showToast(`Active strategy path: ${label}`);
    }
  });
  overviewSlot?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const pathRow = event.target.closest("tr.ledger-selectable-row[data-path]");
    if (pathRow) {
      event.preventDefault();
      pathRow.click();
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

  const animateOverviewTransitions = (slot) => {
    if (!slot) return;
    if (numAnimFrame) {
      cancelAnimationFrame(numAnimFrame);
      numAnimFrame = 0;
    }
    const reducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    )?.matches;
    const tabsEl = slot.querySelector("#fin-activity-tabs");
    const nextSegIdx = tabsEl ? Number(tabsEl.dataset.segIdx || 0) : 0;

    if (!hasCompletedInitialRender) {
      document.querySelectorAll("[data-anim-key]").forEach((el) => {
        const val = Number(el.dataset.animVal || 0);
        prevAnimNums.set(el.dataset.animKey, val);
        curAnimNums.set(el.dataset.animKey, val);
      });
      document.querySelectorAll("[data-meter-key]").forEach((el) => {
        const val =
          el.dataset.meterW != null ? el.dataset.meterW : el.dataset.meterLeft;
        prevMeters.set(el.dataset.meterKey, val);
      });
      prevActivitySegIdx = nextSegIdx;
      if (!reducedMotion) {
        slot.classList.add("is-initial-stagger");
        setTimeout(() => slot.classList.remove("is-initial-stagger"), 600);
      }
      hasCompletedInitialRender = true;
      return;
    }

    if (tabsEl) {
      if (!reducedMotion && nextSegIdx !== prevActivitySegIdx) {
        tabsEl.style.setProperty("--seg-idx", String(prevActivitySegIdx));
        void tabsEl.offsetWidth;
        tabsEl.style.setProperty("--seg-idx", String(nextSegIdx));
        const activePane = slot.querySelector(
          ".fin-activity-pane:not([hidden])",
        );
        activePane?.classList.add("is-pane-entering");
      }
      prevActivitySegIdx = nextSegIdx;
    }

    const meterDiffs = [];
    document.querySelectorAll("[data-meter-key]").forEach((el) => {
      const key = el.dataset.meterKey;
      const isLeft = el.dataset.meterLeft != null;
      const nextVal = isLeft ? el.dataset.meterLeft : el.dataset.meterW;
      const prevVal = prevMeters.get(key);
      prevMeters.set(key, nextVal);
      if (prevVal != null && prevVal !== nextVal) {
        meterDiffs.push({ el, isLeft, prevVal, nextVal });
      }
    });
    if (!reducedMotion && meterDiffs.length > 0) {
      for (const mItem of meterDiffs) {
        mItem.el.style.transition = "none";
        if (mItem.isLeft) {
          mItem.el.style.left = `clamp(6px, ${mItem.prevVal}%, calc(100% - 6px))`;
        } else {
          mItem.el.style.width = `${mItem.prevVal}%`;
        }
      }
      void slot.offsetWidth;
      for (const mItem of meterDiffs) {
        mItem.el.style.transition = "";
        if (mItem.isLeft) {
          mItem.el.style.left = `clamp(6px, ${mItem.nextVal}%, calc(100% - 6px))`;
        } else {
          mItem.el.style.width = `${mItem.nextVal}%`;
        }
      }
    }

    const numDiffs = [];
    document.querySelectorAll("[data-anim-key]").forEach((el) => {
      const key = el.dataset.animKey;
      const toVal = Number(el.dataset.animVal || 0);
      const fromVal = curAnimNums.has(key)
        ? curAnimNums.get(key)
        : prevAnimNums.get(key);
      prevAnimNums.set(key, toVal);
      if (fromVal != null && Math.round(fromVal) !== Math.round(toVal)) {
        const numNode = el.querySelector(".curr-num");
        if (numNode) {
          numDiffs.push({ key, el, numNode, fromVal, toVal });
          return;
        }
      }
      curAnimNums.set(key, toVal);
    });

    if (!reducedMotion && numDiffs.length > 0) {
      for (const item of numDiffs) item.el.classList.add("is-morphing");
      const t0 = performance.now();
      const duration = 320;
      const step = (now) => {
        const prog = Math.min(1, (now - t0) / duration);
        const ease = 1 - Math.pow(1 - prog, 3);
        for (const item of numDiffs) {
          if (!item.numNode.isConnected) continue;
          const cur = item.fromVal + (item.toVal - item.fromVal) * ease;
          curAnimNums.set(item.key, prog >= 1 ? item.toVal : cur);
          item.numNode.textContent = fmtInt(prog >= 1 ? item.toVal : cur);
          if (prog >= 1) item.el.classList.remove("is-morphing");
        }
        if (prog < 1) {
          numAnimFrame = requestAnimationFrame(step);
        } else {
          numAnimFrame = 0;
        }
      };
      numAnimFrame = requestAnimationFrame(step);
    }
  };

  const render = () => {
    if (errorBanner) {
      errorBanner.hidden = true;
      errorBanner.replaceChildren();
    }
    $$("[aria-invalid='true']").forEach((el) =>
      el.removeAttribute("aria-invalid"),
    );
    const activeCashBdPreview =
      useItemizedCashAccounts && customCashAccounts.length > 0
        ? RetirementModel.computeCashAccountsBreakdown(
            customCashAccounts,
            liveMasRates,
          )
        : null;
    syncCustomBudgetReset({
      customBudgetActive,
      useItemizedExpenses,
      itemizedCount: customExpenseItems.length,
      useItemizedCashAccounts: Boolean(
        useItemizedCashAccounts && customCashAccounts.length > 0,
      ),
      cashAccountsCount: customCashAccounts.length,
      cashEffectiveRatePct: activeCashBdPreview?.effectiveRatePct ?? null,
    });
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
    const curAgeVal =
      dobAgeInfo.valid && dobAgeInfo.age >= 18 && dobAgeInfo.age <= 54
        ? dobAgeInfo.age
        : 35;
    const lifeMinAge = $("#known-lifestyle").value === "cca" ? 55 : 40;
    const minRetireBound = Math.max(lifeMinAge, curAgeVal);
    $("#known-retire").min = String(minRetireBound);
    if (
      dobAgeInfo.valid &&
      dobAgeInfo.age >= 18 &&
      dobAgeInfo.age <= 54 &&
      document.activeElement?.id !== "known-retire" &&
      document.activeElement?.id !== "qe-retire" &&
      !(qeDialog?.open && activeQeTab === "goal")
    ) {
      const retEl = $("#known-retire");
      const rawRet = (retEl?.value || "").trim();
      if (rawRet !== "" && !retEl.validity.valid) {
        const numRet = Number(rawRet);
        const clampedRet = String(
          Math.min(
            80,
            Math.max(
              minRetireBound,
              Number.isFinite(numRet) ? Math.round(numRet) : 65,
            ),
          ),
        );
        retEl.value = clampedRet;
        if ($("#qe-retire")) $("#qe-retire").value = clampedRet;
      }
    }
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
            : key === "cashReturnRate"
              ? Number(val) > 0.3
                ? Number(val) / 100
                : Number(val)
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

    if (useItemizedCashAccounts && customCashAccounts.length > 0) {
      p.cashAccountsActive = true;
      p.cashAccounts = customCashAccounts.map((acc) => ({ ...acc }));
      p.ssbCash = sumCustomCashAccounts();
    }

    let r, simulation, fire, bogle, tax;
    try {
      const pWithMas = liveMasRates ? { ...p, masRates: liveMasRates } : p;
      const summary = RetirementModel.calculate(p);
      simulation = RetirementModel.simulate(p, selected, { summary });
      r = RetirementModel.todayPlan(summary);
      fire = RetirementModel.firePlan(pWithMas, selected, {
        summary,
        simulation,
      });
      bogle = RetirementModel.bogleheadAllocation(p, simulation.invest);
      tax = RetirementModel.taxSweetSpot(pWithMas);
    } catch (e) {
      setError(e.message);
      return;
    }
    currentFirePlan = fire;

    const simExtraForCpf = r.retiringNow ? 0 : simulation.cpfExtra;
    const keepOA = RetirementModel.projectCPF(p, simExtraForCpf, selected);
    const moveOA = RetirementModel.projectCPF(
      p,
      simExtraForCpf,
      selected,
      null,
      {
        transferOA: true,
      },
    );
    const roomNow = Math.max(
      0,
      RetirementModel.C.frs - Number(p.sa || 0) - Number(p.saInvested || 0),
    );
    const toToday55 = (val) =>
      RetirementModel.todayValue(val, 55, r.age, r.inflation);
    const oaNow = Math.max(0, Number(p.oa || 0));
    const saNow = Math.max(0, Number(p.sa || 0));
    const maNow = Math.max(0, Number(p.ma || 0));
    const oaExtraEligibleNow = Math.min(20000, oaNow);
    const combinedExtraEligibleNow = Math.min(
      60000,
      oaExtraEligibleNow + saNow + maNow,
    );
    const cohortFrsToday = Math.max(1, r.frs || RetirementModel.C.frs);
    const transferDiffNominal = Math.abs(
      moveOA.availableAt55 - keepOA.availableAt55,
    );
    const transferDiffToday = toToday55(transferDiffNominal);
    const oaTransferSummaryTable = `<div class="timing-comparison">${[
      ["Keep OA as-is", keepOA, false],
      ["Transfer eligible OA to SA", moveOA, true],
    ]
      .map(([label, x, isTransfer]) => {
        const oaLeftNom = Math.max(
          0,
          x.oaAfter55 ?? x.availableAt55 - x.cpfAt55,
        );
        const frsPct = Math.min(
          100,
          Math.round((toToday55(x.fundedRA) / cohortFrsToday) * 100),
        );
        return `<div class="timing-col">
            <div class="timing-col-head">
              <h3>${label}</h3>
              <span class="swell-slate-pill">${frsPct}% of cohort FRS</span>
            </div>
            <div class="timing-payout-bar" role="progressbar" aria-valuenow="${frsPct}" aria-valuemin="0" aria-valuemax="100" aria-label="${label}: ${frsPct}% of cohort FRS funded at age 55"><span style="width:${frsPct}%"></span></div>
            <dl>
              <div><dt>Transferred now</dt><dd>${centsHtml(x.oaTransfer)}</dd></div>
              <div><dt>OA + SA just before 55</dt><dd>${m(toToday55(x.oa + x.sa))} <small>(${m(x.oa + x.sa)} at 55)</small></dd></div>
              <div><dt>RA funded at 55</dt><dd>${m(toToday55(x.fundedRA))} <small>(${m(x.fundedRA)} at 55)</small></dd></div>
              <div><dt>OA left after RA creation</dt><dd>${m(toToday55(oaLeftNom))} <small>(${m(oaLeftNom)} at 55)</small></dd></div>
              <div><dt>Net interest gain at 55</dt><dd>${isTransfer && moveOA.oaTransfer > 0 ? `+${m(transferDiffToday)} <small>(+${m(transferDiffNominal)} at 55)</small>` : "$0"}</dd></div>
              <div><dt>Extra housing cash needed</dt><dd>${m(x.housingShortfallToday)} (today’s $)</dd></div>
            </dl>
          </div>`;
      })
      .join("")}</div>`;

    const oaLeft55Nominal = Math.max(
      0,
      keepOA.oaAfter55 ?? keepOA.availableAt55 - keepOA.cpfAt55,
    );
    const oaLeft55Today = toToday55(oaLeft55Nominal);
    const oaInterest55Nominal =
      (oaLeft55Nominal * RetirementModel.C.oaRate) / 12;
    const oaInterest55Today = (oaLeft55Today * RetirementModel.C.oaRate) / 12;
    const rstuBracketStr = (tax.taxBefore.marginalRate * 100)
      .toFixed(1)
      .replace(/\.0$/, "");
    const cpfDetailsHTML = `<section id="cpf-position-details" class="card-surface rules-card" aria-labelledby="cpf-pos-title">
      <div class="rules-card-head">
        <div>
          <h2 id="cpf-pos-title">CPF today → age 55, OA Interest Tap &amp; Voluntary Housing Refund</h2>
          <p>Active <strong>${selected === "salary" ? "Salary CPF" : selected.toUpperCase()}</strong> path${simExtraForCpf > 0 ? ` (+${m(simExtraForCpf, "/mo")} extra CPF)` : ""} · +1% extra interest on first $60k ($20k OA cap) · ${rstuBracketStr}% tax bracket.</p>
        </div>
        <span class="fin-target-pill">Today’s $ · Age-55 nominal</span>
      </div>
      <dl class="tax-metrics-grid">
        <div class="tax-metric-box"><dt>OA today</dt><dd>${centsHtml(oaNow)}<small>2.5% base + 1% extra on first $20k → SA (${m(oaExtraEligibleNow)} / $20k used)</small></dd></div>
        <div class="tax-metric-box"><dt>SA today</dt><dd>${centsHtml(saNow)}<small>4.0% base + 1% on first $60k combined (${m(combinedExtraEligibleNow)} / $60k used)</small></dd></div>
        <div class="tax-metric-box"><dt>SA top-up room to 2026 FRS</dt><dd>${centsHtml(roomNow)}<small>Eligible self RSTU: ${m(tax.maxRstu, "/yr")} (saves ${m(tax.rstuTaxSaved, "/yr")})</small></dd></div>
        <div class="tax-metric-box"><dt>OA transferable to SA now</dt><dd>${centsHtml(Math.min(oaNow, roomNow))}<small>Irreversible · $0 tax relief · Earns 4%–5% in SA</small></dd></div>
      </dl>
      ${oaTransferSummaryTable}
      <div class="cpf-vhr-grid">
        <div class="timing-col cpf-vhr-box">
          <div class="timing-col-head">
            <h3>Post-55 OA Interest Tap</h3>
            <span class="swell-slate-pill">2.5% p.a. liquid</span>
          </div>
          <dl>
            <div><dt>Excess OA at 55 (${selected === "salary" ? "Salary CPF" : selected.toUpperCase()})</dt><dd>${m(oaLeft55Today)} <small>(${m(oaLeft55Nominal)} at 55)</small></dd></div>
            <div><dt>Withdrawable OA interest</dt><dd>${m(oaInterest55Today, "/mo")} <small>(${m(oaInterest55Nominal, "/mo")} at 55)</small></dd></div>
            <div><dt>$500k OA benchmark</dt><dd>$1,042/mo <small>($12,500/yr)</small></dd></div>
            <div><dt>Withdrawal rule</dt><dd>On-demand once RA meets FRS</dd></div>
          </dl>
        </div>
        <div class="timing-col cpf-vhr-box">
          <div class="timing-col-head">
            <h3>Voluntary Housing Refund vs. Cash RSTU</h3>
            <span class="tap-verdict-pill ${tax.maxRstu > 0 && tax.rstuTaxSaved > 0 ? "is-good" : "is-neutral"}">${tax.maxRstu > 0 && tax.rstuTaxSaved > 0 ? `RSTU Saves ${m(tax.rstuTaxSaved, "/yr")}` : "OA Liquidity"}</span>
          </div>
          <dl>
            <div><dt>Eligible Cash RSTU (${rstuBracketStr}% bracket)</dt><dd>${m(tax.maxRstu, "/yr")} <small>(saves ${m(tax.rstuTaxSaved, "/yr")})</small></dd></div>
            <div><dt>Remaining $80k relief cap</dt><dd>${m(tax.reliefCapRemaining)}</dd></div>
            <div><dt>Voluntary Housing Refund (VHR)</dt><dd>2.5% OA <small>($0 tax relief)</small></dd></div>
            <div><dt>Lock-in vs liquidity</dt><dd>RSTU locks to 55 · VHR liquid at 55</dd></div>
          </dl>
        </div>
      </div>
    </section>`;

    persistState(p);
    $("#print-plan-btn").disabled = false;
    $$("[data-print-trigger]").forEach((btn) => {
      btn.disabled = false;
    });
    $("#start-plan-error").textContent = "";
    if ($("#settings-error-actions")) {
      $("#settings-error-actions").replaceChildren();
      $("#settings-error-actions").hidden = true;
    }
    $("#settings-error").textContent = "";

    const s = RetirementModel.todayPlan({
      ...simulation.summary,
      scenarios: [simulation.selectedScenario],
    }).scenarios[0];
    const simMoneyHtml = (value, age, suffix = "", animKey = "") =>
      m(
        RetirementModel.todayValue(value, age, r.age, r.inflation),
        suffix,
        animKey,
      );
    const rangeNote = simulation.payoutCapped
      ? `<div class="payout-range-note"><p><strong>Payout reference boundary reached (${m(s.payout, "/mo")} today’s value).</strong> Published CPF LIFE anchors stop at ERS; extra CPF reserve (${m(simulation.cpfResult.reserve65)} future cash at 65) stays separate. <a href="https://www.cpf.gov.sg/member/retirement-income/about-cpf-planner-retirement-income" target="_blank" rel="noopener">Check CPF’s official planner ↗</a></p></div>`
      : "";
    const simGuide = RetirementModel.outsideAllocationGuide(
      simulation.summary,
      simulation,
      p,
    );
    const cashSavingVal = simulation.cashSaving || 0;
    const combined = simulation.cpfExtra + cashSavingVal + simulation.invest;
    const left = r.afterCpf - combined;
    const takeHomePct =
      r.afterCpf > 0 ? Math.round((combined / r.afterCpf) * 100) : 0;
    currentAfterCpfCap = Math.max(0, Math.floor(r.afterCpf));
    const maxStr = String(currentAfterCpfCap);
    $("#known-cpf-extra").max = maxStr;
    if ($("#sim-cash-saving")) $("#sim-cash-saving").max = maxStr;
    if ($("#known-cash-saving")) $("#known-cash-saving").max = maxStr;
    $("#sim-invest").max = maxStr;
    $("#known-invest").max = maxStr;
    $("#known-cpf-extra").placeholder = String(Math.ceil(simulation.cpfExtra));
    if ($("#sim-cash-saving")) {
      $("#sim-cash-saving").value = $("#known-cash-saving")?.value || "";
      $("#sim-cash-saving").placeholder = "0";
      $("#sim-cash-saving").disabled = r.retiringNow;
    }
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
          <span>${r.retiringNow ? "Retirement set to now — future monthly saving is paused" : `Total monthly saving: <strong>${m(combined, "/mo", "sim-total-save")}</strong> (${takeHomePct}% of ${m(r.afterCpf)} pay after CPF)`}</span>
          <span class="affordability-right">
            <span class="status-pill is-${simGuide.state.tone}">${simStateIcon}<span>${simGuide.state.label}</span></span>
            <span>${r.retiringNow ? `Gap: ${m(s.remainingPortfolioGap)}` : left < 0 ? `Exceeds take-home by ${m(-left)}` : `${m(left, "/mo")} left before ~${m(simGuide.tax.monthlyTax)} tax`}</span>
          </span>
        </div>
        ${r.retiringNow ? "" : `<div class="affordability-track" role="progressbar" aria-valuenow="${Math.min(100, takeHomePct)}" aria-valuemin="0" aria-valuemax="100" aria-label="Share of take-home pay saved"><span class="affordability-fill ${barTone}" data-meter-key="sim-afford" data-meter-w="${Math.min(100, takeHomePct)}" style="width:${Math.min(100, takeHomePct)}%"></span></div>`}
      </div>
      ${simulation.cpfResult.ra65 > 0 && simulation.cpfResult.ra65 < 60000 ? '<p class="estimate-note">Projected RA at 65 is below the $60,000 automatic CPF LIFE threshold; assumes voluntary CPF LIFE enrolment at 65.</p>' : ""}
      <dl class="simulation-metrics simulation-metrics-4">
        <div><dt>${simulation.payoutCapped ? "CPF boundary from 65" : "CPF LIFE from 65"}</dt><dd>${m(s.payout, "/mo", "sim-cpf-life")}<small>Today’s dollars · ${selected === "salary" ? "salary CPF path" : selected.toUpperCase() + " target"}</small></dd></div>
        <div><dt>Outside portfolio at ${r.retire}</dt><dd>${simMoneyHtml(simulation.portfolioAtRetire, r.retire, "", "sim-port-retire")}<small>At retirement age ${r.retire}</small></dd></div>
        <div><dt>Funding status through 90</dt><dd>${simulation.fullyFunded ? `${m(0, "", "sim-gap")} gap` : `${m(s.remainingPortfolioGap, "", "sim-gap")} gap`}<small>${simulation.fullyFunded ? "Funded through age 90." : `Depletes around ${simulation.depletionAge == null ? r.retire : ageLabel(simulation.depletionAge)}.`}</small></dd></div>
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
      cashSaving: simulation.cashSaving,
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

    learningPlan = RetirementModel.milestonePlan(
      { ...p, cpfExtra: r.retiringNow ? 0 : simulation.cpfExtra },
      learningTarget,
    );
    const lesson = learningPlan;
    const cohortYear55 = RetirementModel.C.year + 55 - r.age;
    const planLabelShort =
      r.plan === "escalating" ? "Escalating +2%/yr" : "Standard";
    const lessonHTML = `<section id="cpf-goal-guide" class="card-surface rules-card" aria-labelledby="cpf-goal-title">
      <div class="rules-card-head">
        <div>
          <h2 id="cpf-goal-title">How to reach BRS, FRS or ERS at 55</h2>
          <p>Age ${r.age} cohort (turning 55 in ${cohortYear55}) · <strong>${planLabelShort}</strong> Plan · ${(r.inflation * 100).toFixed(1).replace(/\.0$/, "")}% inflation.</p>
        </div>
        <span class="fin-target-pill">Today’s $ · Age-55 nominal</span>
      </div>
      <div class="goal-choices" role="group" aria-label="CPF milestone to learn about">${[
        "brs",
        "frs",
        "ers",
      ]
        .map((key) => {
          const cm = lesson.cohortMilestones[key];
          return `<button type="button" data-learn="${key}" aria-pressed="${key === learningTarget}"><strong>${key.toUpperCase()}</strong><span>${m(cm.sumToday)} today’s $<small>${m(cm.sumAt55)} nominal at 55 · 2026 ref ${m(cm.sum2026)}</small></span><span>~${m(cm.payoutToday, "/mo")} from 65 (${r.plan === "escalating" ? "Escalating" : "Standard"})</span></button>`;
        })
        .join("")}</div>
      <dl class="tax-metrics-grid">
        <div class="tax-metric-box"><dt>Target ${learningTarget.toUpperCase()} at age 55</dt><dd>${m(lesson.targetToday, "", "lesson-target")}<small>Nominal at 55: ${m(lesson.target)}</small></dd></div>
        <div class="tax-metric-box"><dt>OA + SA at 55 (${r.awBonusAnnual > 0 ? "salary + bonus" : "salary"} only)</dt><dd>${m(lesson.availableToday, "", "lesson-avail")}<small>Nominal at 55: ${m(lesson.available)}</small></dd></div>
        <div class="tax-metric-box"><dt>${lesson.plannedCpfExtra > 0 ? `Remaining gap after ${m(lesson.plannedCpfExtra, "/mo")} extra` : `Gap to ${learningTarget.toUpperCase()} at 55`}</dt><dd>${m(lesson.plannedCpfExtra > 0 ? lesson.withPlanned.remainingGapToday : lesson.gapToday, "", "lesson-gap")}<small>${lesson.plannedCpfExtra > 0 ? `Nominal remaining: ${m(lesson.withPlanned.remainingGap)} (before extra: ${m(lesson.gapToday)} today’s $)` : `Nominal gap at 55: ${m(lesson.gap)}`}</small></dd></div>
        <div class="tax-metric-box"><dt>Extra CPF saving to hit ${learningTarget.toUpperCase()}</dt><dd>${lesson.monthly === null ? "Lump sum only" : m(lesson.monthly, "/mo", "lesson-monthly")}<small>${lesson.monthly === null ? "Retiring before/at current age" : lesson.plannedCpfExtra > 0 ? (lesson.withPlanned.hitsTarget ? `✓ Covered by your ${m(lesson.plannedCpfExtra, "/mo")} extra CPF` : `+${m(lesson.withPlanned.additionalMonthlyNeeded, "/mo")} above your ${m(lesson.plannedCpfExtra, "/mo")}`) : `Until age ${lesson.untilAge} (total monthly top-up)`}</small></dd></div>
      </dl>
      <ul class="compact-list">
        <li><strong>Before 55:</strong> Cash RSTU and OA-to-SA transfers share SA room up to 2026 FRS (${centsHtml(lesson.currentRoom)} today) and are irreversible.</li>
        <li><strong>At 55:</strong> SA closes; SA then OA fund RA up to cohort FRS (${m(lesson.cohortMilestones.frs.sumAt55)} nominal). ERS top-ups open from 55 ($0 RSTU tax relief above FRS).</li>
        ${learningTarget === "brs" ? "<li><strong>BRS property rule:</strong> Withdrawing RA above BRS requires pledging a property whose lease covers you to age 95+.</li>" : ""}
      </ul>
    </section>`;

    const contribution = r.retiringNow
      ? simulation.cpfExtra + s.privateSaving
      : simulation.cpfExtra + cashSavingVal + simulation.invest;
    const pctOfPay =
      r.afterCpf > 0 ? Math.round((contribution / r.afterCpf) * 100) : 0;

    Object.values(fields).forEach((id) => {
      const el = $("#" + id);
      if (el) lastValidFieldValues[id] = el.value;
    });
    if ($("#sim-cash-saving"))
      lastValidFieldValues["sim-cash-saving"] = $("#sim-cash-saving").value;
    if ($("#sim-invest"))
      lastValidFieldValues["sim-invest"] = $("#sim-invest").value;

    const { isCustom: isCustomSpend, spend: customSpendVal } =
      getCustomSpendState(r.lifestyle);
    if (isCustomSpend) {
      lastCustomSpend = String(Math.round(customSpendVal * 100) / 100);
      lastCustomLifestyle = r.lifestyle;
    }
    const overviewHeaderHTML = buildOverviewPageHeader(fire);
    const expenseData = RetirementModel.expensePlan({
      lifestyle: r.lifestyle,
      spend: r.todaySpend,
      itemizedActive: useItemizedExpenses,
      customExpenses: customExpenseItems,
      afterCpf: r.afterCpf,
      customActive: isCustomSpend,
    });
    const finGridHTML = buildFinOverviewGrid(
      fire,
      r,
      s,
      p,
      simulation,
      bogle,
      pctOfPay,
      selected,
      isCustomSpend,
      expenseData,
      liveMasRates,
      tax,
    );

    const bogleHTML = buildBogleheadSection(bogle);
    const taxSweetHTML = buildTaxSweetSpotSection(tax);

    overviewSlot.innerHTML = `
      ${overviewHeaderHTML}
      ${rangeNote}
      ${finGridHTML}`;

    if (expDialog && expModalBody) {
      const activeEl = document.activeElement;
      const editingExpenseInput =
        activeEl &&
        expModalBody.contains(activeEl) &&
        ((activeEl.matches?.(
          'input[data-exp-field="name"], input[data-exp-field="amount"]',
        ) &&
          expenseData.isCustom &&
          expenseData.itemizedActive) ||
          (activeEl.id === "exp-total-input" &&
            expenseData.isCustom &&
            !expenseData.itemizedActive));
      if (editingExpenseInput) {
        const tmp = document.createElement("div");
        tmp.innerHTML = buildExpenseModalBodyHTML(expenseData, r, null, s);
        for (const idSel of [
          "#exp-impact-slot",
          ".exp-quick-chips",
          "#exp-editor-sum",
          "#exp-figure-table-slot",
        ]) {
          const oldPart = expModalBody.querySelector(idSel);
          const newPart = tmp.querySelector(idSel);
          if (oldPart && newPart) oldPart.replaceWith(newPart);
        }
        const customSourceSub = expModalBody.querySelector(
          ".exp-modal-source-btn[data-exp-enter-custom] span",
        );
        const newCustomSourceSub = tmp.querySelector(
          ".exp-modal-source-btn[data-exp-enter-custom] span",
        );
        if (customSourceSub && newCustomSourceSub) {
          customSourceSub.textContent = newCustomSourceSub.textContent;
        }
        expenseData.items.forEach((it, idx) => {
          const pctNode = expModalBody.querySelector(`[data-exp-pct="${idx}"]`);
          if (pctNode) pctNode.textContent = formatExpSharePct(it.pct);
        });
      } else {
        const activePlanSelect = activeEl?.id === "exp-modal-plan";
        const activeCatIdx = activeEl?.matches?.(
          'select[data-exp-field="category"]',
        )
          ? activeEl.dataset.expIdx
          : null;
        expModalBody.innerHTML = buildExpenseModalBodyHTML(
          expenseData,
          r,
          newlyAddedExpId,
          s,
        );
        newlyAddedExpId = null;
        const expTabsEl = expModalBody.querySelector(".exp-mode-tabs");
        if (expTabsEl) {
          const nextExpSeg = Number(expTabsEl.dataset.segIdx || 0);
          const reducedMotion = window.matchMedia?.(
            "(prefers-reduced-motion: reduce)",
          )?.matches;
          if (
            !reducedMotion &&
            prevExpSegIdx != null &&
            nextExpSeg !== prevExpSegIdx
          ) {
            expTabsEl.style.setProperty("--seg-idx", String(prevExpSegIdx));
            void expTabsEl.offsetWidth;
            expTabsEl.style.setProperty("--seg-idx", String(nextExpSeg));
          }
          prevExpSegIdx = nextExpSeg;
        } else {
          prevExpSegIdx = null;
        }
        if (activePlanSelect) {
          $("#exp-modal-plan")?.focus({ preventScroll: true });
        } else if (activeCatIdx != null) {
          expModalBody
            .querySelector(
              `select[data-exp-field="category"][data-exp-idx="${activeCatIdx}"]`,
            )
            ?.focus({ preventScroll: true });
        }
      }
      if ($("#exp-modal-live-summary")) {
        $("#exp-modal-live-summary").textContent =
          `Retire Budget ${money(r.todaySpend)}/mo · CPF LIFE ${r.plan === "escalating" ? "Escalating" : "Standard"}`;
      }
    }

    $$("[data-switch-lifestyle]").forEach((item) => {
      const active =
        !isCustomSpend && item.dataset.switchLifestyle === r.lifestyle;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    $$("[data-select-custom]").forEach((item) => {
      item.classList.toggle("is-active", isCustomSpend);
      item.setAttribute("aria-pressed", String(isCustomSpend));
    });

    currentCashPlan = RetirementModel.cashParkingPlan({
      summary: r,
      guide: simGuide,
      params: p,
      bogle,
      masRates: liveMasRates,
    });

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
      const newHeaderMeta = tmp.querySelector(".ember-header-meta");
      const newHead = tmp.querySelector(".bogle-head");
      const newDonuts = tmp.querySelector(".bogle-donuts-grid");
      const newCompare = tmp.querySelector(".mix-compare-wrap");
      const newRebal = tmp.querySelector(".rebalance-directive");
      const oldHeaderMeta = allocatorSlot.querySelector(".ember-header-meta");
      const oldHead = allocatorSlot.querySelector(".bogle-head");
      const oldDonuts = allocatorSlot.querySelector(".bogle-donuts-grid");
      const oldCompare = allocatorSlot.querySelector(".mix-compare-wrap");
      const oldRebal = allocatorSlot.querySelector(".rebalance-directive");
      if (newHeaderMeta && oldHeaderMeta)
        oldHeaderMeta.replaceWith(newHeaderMeta);
      if (newHead && oldHead) oldHead.replaceWith(newHead);
      if (newDonuts && oldDonuts) oldDonuts.replaceWith(newDonuts);
      if (newCompare && oldCompare) oldCompare.replaceWith(newCompare);
      if (newRebal && oldRebal) oldRebal.replaceWith(newRebal);
      const tRead = $("#bogle-target-readout");
      if (tRead)
        tRead.textContent = `${bogle.holistic.targetEquityPct}% Equity · ${bogle.holistic.targetBondPct}% Bond`;
      if ($("#bogle-stage1-eq-bar")) $("#bogle-stage1-eq-bar").style.width = `${bogle.holistic.targetEquityPct}%`;
      if ($("#bogle-stage1-bond-bar")) $("#bogle-stage1-bond-bar").style.width = `${bogle.holistic.targetBondPct}%`;
      if ($("#bogle-stage2-badge")) $("#bogle-stage2-badge").textContent = `Step 2 · Inside ${bogle.holistic.targetEquityPct}% Equity`;
      if ($("#bogle-funnel-stage-2")) $("#bogle-funnel-stage-2").classList.toggle("is-disabled-sleeve", bogle.holistic.targetEquityPct === 0);
      if ($("#bogle-funnel-connector-text")) {
        const eqMo = bogle.monthlyRebalance.buyGlobalMonthly + bogle.monthlyRebalance.buySgMonthly;
        $("#bogle-funnel-connector-text").innerHTML = bogle.holistic.targetEquityPct > 0
          ? `Subdivides your <strong>${bogle.holistic.targetEquityPct}% Equity Sleeve (${money(eqMo)}/mo)</strong> into Global vs SG Dividend`
          : `Target Equity is <strong>0%</strong> (100% Bond) — increase Equity above 0% to activate Global / SG sleeve`;
      }
      const tSpan = $("#bogle-target-slider")?.parentElement?.querySelector("span");
      if (tSpan)
        tSpan.textContent = `% Equity (${bogle.holistic.targetBondPct}% Bond)`;
      $$("[data-bogle-eq-preset]").forEach((btn) => {
        const active = Number(btn.dataset.bogleEqPreset) === bogle.holistic.targetEquityPct;
        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-pressed", String(active));
      });
      const sRead = $("#bogle-sg-readout");
      if (sRead)
        sRead.innerHTML = `${bogle.holistic.globalEquitySplitPct}% Global / ${bogle.holistic.sgEquitySplitPct}% SG <span class="bogle-of-eq">of Eq</span>`;
      if ($("#bogle-sg-effective-pill")) {
        $("#bogle-sg-effective-pill").textContent = `= ${Math.round(bogle.holistic.targetGlobalPct * 10) / 10}% Global · ${Math.round(bogle.holistic.targetSgPct * 10) / 10}% SG of total`;
      }
      const sSpan = $("#bogle-sg-slider")?.parentElement?.querySelector("span");
      if (sSpan)
        sSpan.textContent = `% SG (${bogle.holistic.globalEquitySplitPct}% Global)`;
      $$("[data-bogle-sg-preset]").forEach((btn) => {
        const active = Number(btn.dataset.bogleSgPreset) === bogle.holistic.sgSleevePct;
        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-pressed", String(active));
      });
    } else {
      allocatorSlot.innerHTML = bogleHTML;
    }

    if (cashParkingSlot) {
      const existingBar = cashParkingSlot.querySelector(".cash-filter-bar");
      const existingWrap = cashParkingSlot.querySelector(".cash-cards-wrap");
      const existingPlanSlot = cashParkingSlot.querySelector(".cash-plan-slot");
      const syncPill = cashParkingSlot.querySelector(".cash-sync-pill");
      const activeCashEl = document.activeElement;
      const editingCashAccInPage =
        activeCashEl &&
        existingPlanSlot?.contains(activeCashEl) &&
        activeCashEl.matches?.("input[data-cash-acc-field]");
      if (existingBar && existingWrap && existingPlanSlot) {
        if (editingCashAccInPage && currentCashPlan.cashBreakdown) {
          const bd = currentCashPlan.cashBreakdown;
          const tmp = document.createElement("div");
          tmp.innerHTML = buildCashPlanCardHTML(currentCashPlan);
          for (const sel of [
            ".rules-card-head",
            ".cash-kpi-grid",
            ".cash-ladder-grid",
            "#cash-acc-summary-page",
            "#cash-acc-alerts-page",
          ]) {
            const oldNode = existingPlanSlot.querySelector(sel);
            const newNode = tmp.querySelector(sel);
            if (oldNode && newNode) oldNode.replaceWith(newNode);
          }
          bd.accounts.forEach((acc, idx) => {
            const rowEl = existingPlanSlot.querySelector(
              `[data-cash-acc-row="${idx}"]`,
            );
            if (rowEl) {
              rowEl.classList.toggle("is-overflow", Boolean(acc.hasOverflow));
            }
            const readoutEl = existingPlanSlot.querySelector(
              `[data-cash-acc-readout="${idx}"]`,
            );
            if (readoutEl) {
              readoutEl.innerHTML = buildCashAccountReadoutHTML(acc);
            }
          });
        } else {
          existingPlanSlot.innerHTML = buildCashPlanCardHTML(currentCashPlan);
        }
        if (syncPill && currentCashPlan.masSyncLabel) {
          syncPill.textContent = currentCashPlan.masSyncLabel;
        }
        existingWrap.innerHTML = buildCashCardsMarkup(
          currentCashPlan,
          cashParkingFilter,
          false,
          cashParkingSearch,
          cashParkingTag,
        );
        syncCashFilterGlider(existingBar, true);
      } else {
        cashParkingSlot.innerHTML = buildCashParkingSection(
          currentCashPlan,
          cashParkingFilter,
          cashParkingSearch,
          cashParkingTag,
        );
        syncCashFilterGlider(
          cashParkingSlot.querySelector(".cash-filter-bar"),
          true,
        );
      }
    }

    const marginalTaxPct = `${(tax.taxBefore.marginalRate * 100).toFixed(1).replace(/\.0$/, "")}%`;
    const ssbRefPct = liveMasRates?.ssb?.tenYearAvgReturn;
    const divModel = RetirementModel.evaluateDividendYield({
      capital: divCalcCapital,
      ratePct: divCalcRatePct,
      inflationRate: r.inflation,
      ssbRatePct: ssbRefPct,
    });
    const targetModel = RetirementModel.evaluateTargetMonthlyIncome({
      targetMonthly: divTargetMonthly,
      ratePct: divTargetRatePct,
      currentCapital: divTargetCurrCap,
      monthlyContribution: divTargetMoSave,
      inflationPct: Math.round((r.inflation || 0.025) * 1000) / 10,
      masRates: liveMasRates,
    });
    const annuityModel = RetirementModel.evaluateAnnuityPlan({
      monthlyContribution: divAnnuityMoSave,
      contributeYears: divAnnuityPayYears,
      deferYears: divAnnuityDeferYears,
      payoutYears: divAnnuityDrawYears,
      quotedMonthlyPayout: divAnnuityQuotedMo,
      benchmarkRatePct: divAnnuityBenchRatePct,
      masRates: liveMasRates,
    });
    if (dividendCalcSlot) {
      const activeDivEl = document.activeElement;
      const divInputIds = [
        "div-calc-capital",
        "div-calc-rate",
        "div-calc-rate-slider",
        "div-target-monthly",
        "div-target-rate",
        "div-target-rate-slider",
        "div-target-cur-cap",
        "div-target-mo-save",
        "div-annuity-mo-save",
        "div-annuity-quoted-mo",
        "div-annuity-pay-yrs",
        "div-annuity-defer-yrs",
        "div-annuity-draw-yrs",
      ];
      const editingDivControl =
        activeDivEl &&
        dividendCalcSlot.contains(activeDivEl) &&
        divInputIds.includes(activeDivEl.id);
      const resPane = dividendCalcSlot.querySelector("#div-calc-results-pane");
      const benchCard = dividendCalcSlot.querySelector(
        "#dividend-benchmarks-card",
      );
      if (editingDivControl && resPane && benchCard) {
        const hdrBadge = dividendCalcSlot.querySelector("#div-header-badge");
        if (divCalcMode === "target") {
          resPane.innerHTML = buildTargetResultsHTML(targetModel);
          benchCard.innerHTML = buildTargetBenchmarksHTML(targetModel);
          if (hdrBadge) {
            hdrBadge.className = `status-pill is-${targetModel.tone}`;
            hdrBadge.textContent = `${targetModel.badge} · ${m(targetModel.requiredCapital)} needed`;
          }
          if (activeDivEl.id !== "div-target-rate") {
            const rInp = dividendCalcSlot.querySelector("#div-target-rate");
            if (rInp) rInp.value = String(Number(targetModel.ratePct.toFixed(2)));
          }
          if (activeDivEl.id !== "div-target-rate-slider") {
            const rSl = dividendCalcSlot.querySelector("#div-target-rate-slider");
            if (rSl) rSl.value = String(Math.min(12, Math.max(0.5, targetModel.ratePct)));
          }
        } else if (divCalcMode === "annuity") {
          resPane.innerHTML = buildAnnuityResultsHTML(annuityModel);
          benchCard.innerHTML = buildAnnuityBenchmarksHTML(annuityModel);
          if (hdrBadge) {
            hdrBadge.className = `status-pill is-${annuityModel.tone}`;
            hdrBadge.textContent = `${annuityModel.badge} · ${annuityModel.impliedAnnualIrrPct.toFixed(2)}% IRR`;
          }
        } else {
          resPane.innerHTML = buildDividendResultsHTML(divModel);
          benchCard.innerHTML = buildDividendBenchmarksHTML(divModel);
          if (hdrBadge) {
            hdrBadge.className = `status-pill is-${divModel.tone}`;
            hdrBadge.textContent = `${divModel.badge} · ${divModel.ratePct.toFixed(2)}%`;
          }
          if (activeDivEl.id !== "div-calc-capital") {
            const capInp = dividendCalcSlot.querySelector("#div-calc-capital");
            if (capInp) capInp.value = String(Math.round(divModel.capital));
          }
          if (activeDivEl.id !== "div-calc-rate") {
            const rateInp = dividendCalcSlot.querySelector("#div-calc-rate");
            if (rateInp) rateInp.value = String(Number(divModel.ratePct.toFixed(2)));
          }
          if (activeDivEl.id !== "div-calc-rate-slider") {
            const rateSlider = dividendCalcSlot.querySelector(
              "#div-calc-rate-slider",
            );
            if (rateSlider) {
              rateSlider.value = String(Math.min(12, Math.max(0, divModel.ratePct)));
            }
          }
        }
      } else {
        dividendCalcSlot.innerHTML = buildDividendCalculatorSection({
          mode: divCalcMode,
          divModel,
          targetModel,
          annuityModel,
        });
      }
    }
    if ($("#nav-badge-dividend")) {
      $("#nav-badge-dividend").textContent = `${divModel.ratePct.toFixed(1)}%`;
    }
    taxSlot.innerHTML = `
      <header class="ember-page-header fin-page-header">
        <div class="fin-header-copy">
          <h1>Tax Relief Optimization</h1>
        </div>
        <div class="ember-header-meta">
          <span class="status-pill is-info">${marginalTaxPct} IRAS Bracket</span>
        </div>
      </header>
      ${taxSweetHTML}
      <section class="card-surface rules-card" id="salary-cpf-caps" aria-labelledby="salary-caps-title">
        <div class="rules-card-head">
          <div>
            <h2 id="salary-caps-title">Salary &amp; Bonus CPF Contributions (2026 Ceilings)</h2>
            <p>2026 Ordinary Wage ceiling: $8,000/mo · Annual CPF salary ceiling: $102,000/yr ($37,740 mandatory CPF cap).${r.awBonusAnnual > 0 ? ` Includes <strong>${m(r.awBonusAnnual, "/yr")}</strong> annual bonus (<strong>${m(r.awSubjectAnnual, "/yr")}</strong> subject to AW CPF).` : ""}</p>
          </div>
          <span class="fin-target-pill">Age ${r.age} · Under 55 rates</span>
        </div>
        <dl class="tax-metrics-grid">
          <div class="tax-metric-box"><dt>Employee CPF (20% OW)</dt><dd>${m(r.employeeCpf, "/mo")}${r.annualBonusEmployeeCpf > 0 ? `<small>+${m(r.annualBonusEmployeeCpf, "/yr")} on bonus</small>` : ""}</dd></div>
          <div class="tax-metric-box"><dt>Employer CPF (17% OW)</dt><dd>${m(r.employerCpf, "/mo")}${r.annualBonusEmployerCpf > 0 ? `<small>+${m(r.annualBonusEmployerCpf, "/yr")} on bonus</small>` : ""}</dd></div>
          <div class="tax-metric-box"><dt>Total Mandatory CPF</dt><dd>${m(r.employeeCpf + r.employerCpf, "/mo")}${r.annualBonusTotalCpf > 0 ? `<small>+${m(r.annualBonusTotalCpf, "/yr")} AW bonus CPF</small>` : ""}</dd></div>
          <div class="tax-metric-box"><dt>Take-home after Employee CPF</dt><dd>${m(r.afterCpf, "/mo")}${r.awBonusAnnual > 0 ? `<small>+${m(r.awBonusAnnual - r.annualBonusEmployeeCpf, "/yr")} net bonus</small>` : ""}</dd></div>
        </dl>
      </section>`;

    if (cpfRulesSlot) {
      cpfRulesSlot.innerHTML = `
        <header class="ember-page-header fin-page-header">
          <div class="fin-header-copy">
            <h1>CPF Milestones &amp; Age-55 Rules</h1>
          </div>
          <div class="ember-header-meta">
            <span class="fin-target-pill">Age 55 → 65</span>
          </div>
        </header>
        ${lessonHTML}
        ${cpfDetailsHTML}`;
    }

    if ($("#nav-badge-overview")) {
      $("#nav-badge-overview").textContent =
        `${Math.min(100, Math.round(fire.fireNumber.pctFunded || 0))}%`;
    }
    if ($("#nav-badge-trajectory")) {
      $("#nav-badge-trajectory").textContent = `Age ${fire.retire}`;
    }
    if ($("#nav-badge-allocator")) {
      $("#nav-badge-allocator").textContent =
        `${Math.round(bogle.holistic.effectiveEquityPct)}/${Math.round(bogle.holistic.effectiveBondPct)}`;
    }
    if ($("#nav-badge-cash")) {
      $("#nav-badge-cash").textContent = String(
        currentCashPlan?.catalog?.items?.length || 7,
      );
    }
    if ($("#nav-badge-tax")) {
      $("#nav-badge-tax").textContent = marginalTaxPct;
    }
    if ($("#nav-badge-cpf")) {
      $("#nav-badge-cpf").textContent =
        selected === "salary" ? "Sal" : selected.toUpperCase();
    }
    const post55Switch = $("#post55-toggle-switch");
    if (post55Switch) {
      const isPost55On = $("#known-post55")?.value === "true";
      post55Switch.setAttribute("aria-checked", String(isPost55On));
      const stateLbl = post55Switch.querySelector(".ui-toggle-state");
      if (stateLbl) stateLbl.textContent = isPost55On ? "Included" : "Excluded";
    }
    animateOverviewTransitions(overviewSlot);

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
      p: {
        ...p,
        isCustomBudget: isCustomSpend,
        itemizedActive: Boolean(expenseData?.itemizedActive),
      },
      expenseData,
      masRates: liveMasRates,
      basis: dashChartBasis,
    });
  };

  const loadMasRates = async (force = false, triggerBtn = null) => {
    if (triggerBtn) {
      triggerBtn.disabled = true;
      triggerBtn.textContent = "Syncing…";
    }
    try {
      const url = "./assets/mas-rates.json";
      const res = await fetch(url, { cache: force ? "no-store" : "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json?.ssb?.issueCode && json?.tbills?.sixMonth?.cutoffYield != null) {
        liveMasRates = json;
        render();
      }
      if (triggerBtn) {
        triggerBtn.textContent = "✓ MAS Synced";
        setTimeout(() => {
          if (triggerBtn.isConnected) {
            triggerBtn.textContent = "↻ Sync MAS";
            triggerBtn.disabled = false;
          }
        }, 1600);
      }
    } catch {
      if (triggerBtn) {
        triggerBtn.textContent = "Offline snapshot";
        setTimeout(() => {
          if (triggerBtn.isConnected) {
            triggerBtn.textContent = "↻ Sync MAS";
            triggerBtn.disabled = false;
          }
        }, 1800);
      }
    }
  };
  loadMasRates(false);

  window.addEventListener("rs:tabchange", (ev) => {
    if (ev.detail?.tab === "cash-parking" && !ev.detail?.profileOpen) {
      requestAnimationFrame(() => {
        syncCashFilterGlider(
          cashParkingSlot?.querySelector(".cash-filter-bar"),
          true,
        );
      });
    }
  });
  window.addEventListener("resize", () => {
    syncCashFilterGlider(
      cashParkingSlot?.querySelector(".cash-filter-bar"),
      true,
    );
  });
  cashParkingSlot?.addEventListener("keydown", (event) => {
    const btn = event.target.closest("[data-cash-filter]");
    if (!btn) return;
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const btns = [...cashParkingSlot.querySelectorAll("[data-cash-filter]")];
    const idx = btns.indexOf(btn);
    if (idx === -1) return;
    event.preventDefault();
    let nextIdx = idx;
    if (event.key === "ArrowRight") nextIdx = (idx + 1) % btns.length;
    else if (event.key === "ArrowLeft")
      nextIdx = (idx - 1 + btns.length) % btns.length;
    else if (event.key === "Home") nextIdx = 0;
    else if (event.key === "End") nextIdx = btns.length - 1;
    btns[nextIdx]?.focus();
    btns[nextIdx]?.click();
  });

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
  const syncCashAccountsToBucket = () => {
    const tot = sumCustomCashAccounts();
    if ($("#known-ssb-cash")) $("#known-ssb-cash").value = String(tot);
    if ($("#qe-ssb-cash")) $("#qe-ssb-cash").value = String(tot);
    syncBucketsToTotal();
  };
  const clearBucketsOnDirectTotalEdit = () => {
    clearCustomCashAccountsState();
    bucketIds.forEach((id) => {
      if ($("#" + id)) $("#" + id).value = "";
    });
  };

  Object.values(fields).forEach((id) => {
    const el = $("#" + id);
    if (el) {
      el.addEventListener("input", () => {
        if (id === "person-dob") {
          if (el.validity.badInput) return;
          const dobInfo = RetirementModel.computeAgeFromDob(el.value);
          if (dobInfo.valid && dobInfo.age >= 18 && dobInfo.age <= 54) {
            const minR = getMinRetireAge();
            const retEl = $("#known-retire");
            const curR = Number(retEl?.value);
            if (
              retEl &&
              retEl.value.trim() !== "" &&
              (!Number.isFinite(curR) || curR < minR || curR > 80)
            ) {
              const clampedR = String(
                Math.min(
                  80,
                  Math.max(minR, Number.isFinite(curR) ? Math.round(curR) : 65),
                ),
              );
              retEl.value = clampedR;
              if ($("#qe-retire")) $("#qe-retire").value = clampedR;
            }
          }
        }
        if (id === "known-spend") {
          const trimmed = el.value.trim();
          if (trimmed === "") {
            clearCustomBudgetState();
          } else {
            customBudgetActive = true;
            useItemizedExpenses = false;
          }
        } else if (id === "known-lifestyle") {
          clearCustomBudgetState();
        }
        if (id === "known-ssb-cash") {
          useItemizedCashAccounts = false;
        }
        if (bucketIds.includes(id)) {
          syncBucketsToTotal();
        } else if (id === "known-savings") {
          clearBucketsOnDirectTotalEdit();
        } else if (id === "known-cpf-extra") {
          const clamped = clampSavingToTakeHome(el, [
            $("#known-cash-saving"),
            $("#known-invest"),
          ]);
          const help = $("#cpf-extra-help");
          if (help) {
            help.textContent =
              clamped !== false
                ? `Capped at ${money(clamped)}/mo (within your ${money(currentAfterCpfCap)}/mo take-home pay).`
                : "On top of salary CPF. Stops by 55 or retirement. Leave blank for the suggested amount.";
          }
        }
        render();
      });
      el.addEventListener("change", () => {
        render();
      });
    }
  });

  const zeroPlaceholderKeys = new Set([
    "annualBonus",
    "oa",
    "sa",
    "ma",
    "maSpend",
    "saInvested",
    "srs",
    "srsAnnual",
  ]);
  const applyPlanObject = (planObj) => {
    if (!planObj || typeof planObj !== "object")
      throw new Error("Invalid plan format.");
    Object.values(fields).forEach((id) => resetControl($("#" + id), true));
    for (const [key, id] of Object.entries(fields)) {
      const el = $("#" + id);
      if (!el || planObj[key] == null) continue;
      if (zeroPlaceholderKeys.has(key) && Number(planObj[key]) === 0) {
        el.value = "";
        continue;
      }
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
    ...RetirementModel.SG_DEFAULT_PLAN,
    dob: DEFAULT_DOB,
  };

  const flashConfirmButton = (btn, label = "✓ Done", ms = 1400) => {
    if (!btn || btn.dataset.confirmTimer) return;
    const origText = btn.textContent;
    btn.classList.add("is-confirmed");
    btn.textContent = label;
    btn.dataset.confirmTimer = String(
      setTimeout(() => {
        delete btn.dataset.confirmTimer;
        if (btn.isConnected) {
          btn.classList.remove("is-confirmed");
          btn.textContent = origText;
        }
      }, ms),
    );
  };

  const resetSgDefaults = (triggerBtn = null) => {
    lastCustomSpend = "";
    lastCustomLifestyle = "";
    clearCustomBudgetState();
    clearCustomCashAccountsState();
    applyPlanObject(SG_DEFAULT_PLAN);
    selected = "salary";
    learningTarget = "frs";
    finActivityTab = "coverage";
    netWorthSelectedSeries = "all";
    chartMode = "cashflow";
    cashParkingFilter = "all";
    cashParkingSearch = "";
    cashParkingTag = "all";
    $$("[data-chart-mode]").forEach((b) => {
      const active = b.dataset.chartMode === "cashflow";
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-pressed", String(active));
    });
    render();
    if ($("#plan-status")) {
      $("#plan-status").textContent =
        "Reset to typical Singapore age-35 defaults.";
    }
    flashConfirmButton(triggerBtn, "✓ Defaults restored");
    showToast("Restored typical Singapore age-35 defaults");
  };

  const confirmResetDialog = $("#confirm-reset-modal");
  let pendingResetTrigger = null;
  let lastConfirmInvoker = null;
  if (confirmResetDialog) {
    bindDialogBackdropDismiss(confirmResetDialog);
    confirmResetDialog.addEventListener("close", () => {
      if (lastConfirmInvoker?.isConnected) {
        lastConfirmInvoker.focus({ preventScroll: true });
      }
      lastConfirmInvoker = null;
    });
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-toast-dismiss]")) {
      const toastEl = $("#ui-toast");
      if (toastEl) toastEl.hidden = true;
      clearTimeout(toastTimer);
      return;
    }
    const post55Btn = event.target.closest("#post55-toggle-switch");
    if (post55Btn && $("#known-post55")) {
      const nextOn = $("#known-post55").value !== "true";
      $("#known-post55").value = String(nextOn);
      render();
      showToast(
        nextOn
          ? "Post-55 work CPF contributions included"
          : "Post-55 work CPF contributions excluded",
      );
      return;
    }
    const resetTrigger = event.target.closest("[data-sg-reset]");
    if (resetTrigger) {
      if (
        confirmResetDialog &&
        typeof confirmResetDialog.showModal === "function"
      ) {
        pendingResetTrigger = resetTrigger;
        lastConfirmInvoker = resetTrigger;
        confirmResetDialog.showModal();
      } else {
        resetSgDefaults(resetTrigger);
      }
      return;
    }
    if (event.target.closest("[data-confirm-reset-accept]")) {
      confirmResetDialog?.close();
      resetSgDefaults(pendingResetTrigger);
      pendingResetTrigger = null;
      return;
    }
    if (event.target.closest("[data-confirm-reset-cancel]")) {
      confirmResetDialog?.close();
      pendingResetTrigger = null;
      return;
    }
    const moneyMoveBtn = event.target.closest("[data-money-move]");
    if (moneyMoveBtn) {
      const moveType = moneyMoveBtn.dataset.moneyMove;
      const moveVal = moneyMoveBtn.dataset.moveVal;
      if (moveType === "cap-affordable-save" && moveVal != null) {
        const capTotal = Math.max(0, Math.round(Number(moveVal) || 0));
        selected = "salary";
        let rem = capTotal;
        const curInv = Math.max(0, Math.round(Number($("#known-invest")?.value || 0)));
        const curCashSav = Math.max(0, Math.round(Number($("#known-cash-saving")?.value || 0)));
        const curCpfEx = Math.max(0, Math.round(Number($("#known-cpf-extra")?.value || 0)));
        const nextInv = Math.min(curInv, rem);
        rem = Math.max(0, rem - nextInv);
        const nextCashSav = Math.min(curCashSav, rem);
        rem = Math.max(0, rem - nextCashSav);
        const nextCpfEx = Math.min(curCpfEx, rem);
        if ($("#known-invest")) $("#known-invest").value = String(nextInv);
        if ($("#sim-invest")) $("#sim-invest").value = String(nextInv);
        if ($("#qe-invest")) $("#qe-invest").value = String(nextInv);
        if ($("#known-cash-saving")) $("#known-cash-saving").value = String(nextCashSav);
        if ($("#sim-cash-saving")) $("#sim-cash-saving").value = String(nextCashSav);
        if ($("#qe-cash-saving")) $("#qe-cash-saving").value = String(nextCashSav);
        if ($("#known-cpf-extra")) $("#known-cpf-extra").value = String(nextCpfEx);
        if ($("#qe-cpf-extra")) $("#qe-cpf-extra").value = String(nextCpfEx);
        render();
        showToast(`Capped monthly savings to ${money(nextInv + nextCashSav + nextCpfEx)}/mo within take-home cashflow`);
      } else if (moveType === "match-save" && moveVal != null) {
        if ($("#known-invest")) $("#known-invest").value = String(moveVal);
        if ($("#sim-invest")) $("#sim-invest").value = String(moveVal);
        if ($("#qe-invest")) $("#qe-invest").value = String(moveVal);
        render();
        showToast(`Updated monthly investment to ${money(Number(moveVal))}/mo`);
      } else if (moveType === "apply-rstu" && moveVal != null) {
        if ($("#known-cpf-extra")) $("#known-cpf-extra").value = String(moveVal);
        if ($("#qe-cpf-extra")) $("#qe-cpf-extra").value = String(moveVal);
        render();
        showToast(`Applied +${money(Number(moveVal))}/mo CPF SA top-up (RSTU tax relief)`);
      } else if (moveType === "apply-srs" && moveVal != null) {
        if ($("#known-srs-annual")) $("#known-srs-annual").value = String(moveVal);
        if ($("#qe-srs-annual")) $("#qe-srs-annual").value = String(moveVal);
        render();
        showToast(
          Number(moveVal) > 0
            ? `Applied ${money(Number(moveVal))}/yr SRS contribution`
            : "Set planned annual SRS contribution to $0/yr",
        );
      } else if (moveType === "invest-srs") {
        if ($("#known-srs-invested")) $("#known-srs-invested").value = "global";
        if ($("#qe-srs-invested")) $("#qe-srs-invested").value = "global";
        render();
        showToast("Switched SRS balance from 0.05% cash to Global ETFs");
      } else if (moveType === "transfer-oa-sa" && moveVal != null) {
        const amt = Math.max(0, Math.round(Number(moveVal) || 0));
        const curOa = Math.max(0, Number($("#known-oa")?.value || 0));
        const curSa = Math.max(0, Number($("#known-sa")?.value || 0));
        const nextOa = Math.max(0, curOa - amt);
        const nextSa = curSa + (curOa - nextOa);
        if ($("#known-oa")) $("#known-oa").value = String(nextOa);
        if ($("#qe-oa")) $("#qe-oa").value = String(nextOa);
        if ($("#known-sa")) $("#known-sa").value = String(nextSa);
        if ($("#qe-sa")) $("#qe-sa").value = String(nextSa);
        render();
        showToast(`Transferred ${money(curOa - nextOa)} excess CPF OA to SA (4.0% p.a.)`);
      } else if (moveType === "rebalance-portfolio") {
        const curEq = Math.max(0, Number($("#known-equities")?.value || 0));
        const curSg = Math.max(0, Number($("#known-sg-dividends")?.value || 0));
        const curCash = useItemizedCashAccounts && customCashAccounts.length
          ? sumCustomCashAccounts()
          : Math.max(0, Number($("#known-ssb-cash")?.value || 0));
        const curOa = Math.max(0, Number($("#known-oa")?.value || 0));
        const curSa = Math.max(0, Number($("#known-sa")?.value || 0));
        const curMa = Math.max(0, Number($("#known-ma")?.value || 0));
        const curSrs = Math.max(0, Number($("#known-srs")?.value || 0));
        const srsMode = $("#known-srs-invested")?.value || "global";
        const srsEq = srsMode === "global" ? curSrs : srsMode === "balanced" ? Math.round(curSrs * 0.6) : 0;
        const liqTot = curEq + curSg + curCash;
        const holTot = liqTot + curOa + curSa + curMa + curSrs;
        const tgtEqPct = Math.max(0, Math.min(100, Number($("#known-target-equity")?.value || 80)));
        const sgSleevePct = Math.max(0, Math.min(100, Number($("#known-sg-sleeve")?.value || 15)));
        const emergencyFloor = Math.max(20000, Math.round((currentFirePlan?.todaySpend || 2800) * 6));
        const maxLiqEqPreservingReserve = Math.max(curEq + curSg, liqTot - Math.min(curCash, emergencyFloor));
        const targetHolEq = Math.round(holTot * (tgtEqPct / 100));
        const nextLiqEq = Math.min(maxLiqEqPreservingReserve, Math.max(0, targetHolEq - srsEq));
        const nextSg = Math.round(nextLiqEq * (sgSleevePct / 100));
        const nextGlobal = Math.max(0, nextLiqEq - nextSg);
        const nextCash = Math.max(0, liqTot - nextLiqEq);
        useItemizedCashAccounts = false;
        if ($("#known-equities")) $("#known-equities").value = String(nextGlobal);
        if ($("#qe-equities")) $("#qe-equities").value = String(nextGlobal);
        if ($("#known-sg-dividends")) $("#known-sg-dividends").value = String(nextSg);
        if ($("#qe-sg-dividends")) $("#qe-sg-dividends").value = String(nextSg);
        if ($("#known-ssb-cash")) $("#known-ssb-cash").value = String(nextCash);
        if ($("#qe-ssb-cash")) $("#qe-ssb-cash").value = String(nextCash);
        syncBucketsToTotal();
        render();
        showToast(`Rebalanced liquid portfolio to ${tgtEqPct}/${100 - tgtEqPct} target (${money(nextGlobal)} Global · ${money(nextSg)} SG · ${money(nextCash)} Cash)`);
      } else if (moveType === "sweep-cash") {
        if (!customCashAccounts.length) {
          const curCash = Math.max(0, Number($("#known-ssb-cash")?.value || 20000));
          customCashAccounts = RetirementModel.defaultCashAccounts(curCash, liveMasRates);
        }
        customCashAccounts = RetirementModel.sweepCashAccountsOverflow(customCashAccounts, liveMasRates);
        useItemizedCashAccounts = true;
        syncCashAccountsToBucket();
        render();
        showToast("Swept overflow cash into MAS 10Y SSB");
      }
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
      $("#known-cpf-extra").value = "";
      if ($("#qe-cpf-extra")) $("#qe-cpf-extra").value = "";
      if ($("#known-invest")) $("#known-invest").value = "";
      if ($("#sim-invest")) $("#sim-invest").value = "";
      if ($("#qe-invest")) $("#qe-invest").value = "";
      render();
      return;
    }
    const cashFilterBtn = event.target.closest("[data-cash-filter]");
    if (cashFilterBtn) {
      const nextFilter = cashFilterBtn.dataset.cashFilter || "all";
      if (nextFilter === cashParkingFilter) return;
      cashParkingFilter = nextFilter;
      if (cashParkingSlot && currentCashPlan) {
        const bar = cashParkingSlot.querySelector(".cash-filter-bar");
        const wrap = cashParkingSlot.querySelector(".cash-cards-wrap");
        if (!bar || !wrap) {
          cashParkingSlot.innerHTML = buildCashParkingSection(
            currentCashPlan,
            cashParkingFilter,
          );
          syncCashFilterGlider(
            cashParkingSlot.querySelector(".cash-filter-bar"),
            true,
          );
          return;
        }
        bar.querySelectorAll("[data-cash-filter]").forEach((btn) => {
          const isMatch =
            (btn.dataset.cashFilter || "all") === cashParkingFilter;
          btn.classList.toggle("is-active", isMatch);
          btn.setAttribute("aria-pressed", String(isMatch));
        });
        syncCashFilterGlider(bar, false);

        if (cashAnimFrame) {
          cancelAnimationFrame(cashAnimFrame);
          cashAnimFrame = 0;
          wrap.style.height = "";
          wrap.style.overflow = "";
        }

        const reducedMotion = window.matchMedia?.(
          "(prefers-reduced-motion: reduce)",
        )?.matches;
        const startHeight = wrap.getBoundingClientRect().height;
        const startScrollY = window.scrollY;
        const docHeightBefore = document.documentElement.scrollHeight;

        if (!reducedMotion && startHeight > 0) {
          wrap.style.height = `${startHeight.toFixed(1)}px`;
          wrap.style.overflow = "hidden";
        }

        wrap.innerHTML = buildCashCardsMarkup(
          currentCashPlan,
          cashParkingFilter,
          !reducedMotion,
          cashParkingSearch,
          cashParkingTag,
        );
        const endGrid = wrap.querySelector(".cash-cards-grid");
        const endHeight = endGrid ? endGrid.getBoundingClientRect().height : 0;
        const heightDelta = endHeight - startHeight;

        if (reducedMotion || Math.abs(heightDelta) < 2) {
          wrap.style.height = "";
          wrap.style.overflow = "";
          return;
        }

        const newMaxScroll = Math.max(
          0,
          docHeightBefore + heightDelta - window.innerHeight,
        );
        const targetScrollY =
          heightDelta < 0 && startScrollY > newMaxScroll
            ? newMaxScroll
            : startScrollY;

        const duration = 340;
        const t0 = performance.now();

        const step = (now) => {
          const p = Math.min(1, (now - t0) / duration);
          const ease = 1 - Math.pow(1 - p, 3);
          const h = startHeight + heightDelta * ease;
          wrap.style.height = `${Math.max(0, h).toFixed(1)}px`;
          if (targetScrollY !== startScrollY) {
            window.scrollTo({
              top: startScrollY + (targetScrollY - startScrollY) * ease,
              behavior: "instant",
            });
          }
          if (p < 1) {
            cashAnimFrame = requestAnimationFrame(step);
          } else {
            wrap.style.height = "";
            wrap.style.overflow = "";
            cashAnimFrame = 0;
          }
        };
        cashAnimFrame = requestAnimationFrame(step);
      }
      return;
    }
    const cashTagBtn = event.target.closest("[data-cash-tag]");
    if (cashTagBtn) {
      const nextTag = cashTagBtn.dataset.cashTag || "all";
      cashParkingTag =
        cashParkingTag === nextTag && nextTag !== "all" ? "all" : nextTag;
      if (cashParkingSlot && currentCashPlan) {
        cashParkingSlot.querySelectorAll("[data-cash-tag]").forEach((btn) => {
          const active = (btn.dataset.cashTag || "all") === cashParkingTag;
          btn.classList.toggle("is-active", active);
          btn.setAttribute("aria-pressed", String(active));
        });
        const wrap = cashParkingSlot.querySelector(".cash-cards-wrap");
        if (wrap) {
          wrap.innerHTML = buildCashCardsMarkup(
            currentCashPlan,
            cashParkingFilter,
            true,
            cashParkingSearch,
            cashParkingTag,
          );
        }
      }
      return;
    }
    if (event.target.closest("[data-cash-search-clear]")) {
      cashParkingSearch = "";
      const inp = $("#cash-search-input");
      if (inp) {
        inp.value = "";
        inp.focus();
      }
      const clearBtn = cashParkingSlot?.querySelector(
        "[data-cash-search-clear]",
      );
      if (clearBtn) clearBtn.hidden = true;
      const wrap = cashParkingSlot?.querySelector(".cash-cards-wrap");
      if (wrap && currentCashPlan) {
        wrap.innerHTML = buildCashCardsMarkup(
          currentCashPlan,
          cashParkingFilter,
          true,
          cashParkingSearch,
          cashParkingTag,
        );
      }
      return;
    }
    if (event.target.closest("[data-cash-reset-filters]")) {
      cashParkingFilter = "all";
      cashParkingSearch = "";
      cashParkingTag = "all";
      if (cashParkingSlot && currentCashPlan) {
        cashParkingSlot.innerHTML = buildCashParkingSection(
          currentCashPlan,
          cashParkingFilter,
          cashParkingSearch,
          cashParkingTag,
        );
        syncCashFilterGlider(
          cashParkingSlot.querySelector(".cash-filter-bar"),
          true,
        );
      }
      return;
    }
    const useSpareBtn = event.target.closest("[data-use-spare-cash]");
    if (useSpareBtn) {
      const spareVal = Math.max(0, Math.round(Number(useSpareBtn.dataset.useSpareCash) || 0));
      if (spareVal > 0) {
        divTargetMoSave = spareVal;
        divAnnuityMoSave = spareVal;
      }
      divCalcMode = "target";
      render();
      document.querySelector(`button[data-tab="dividend-calc"]`)?.click();
      showToast(`Loaded ${money(spareVal)}/mo Spare Cash into Utility Calculator`);
      return;
    }
    const divModeBtn = event.target.closest("[data-div-mode]");
    if (divModeBtn) {
      const nextMode = divModeBtn.dataset.divMode;
      if (["lump", "target", "annuity"].includes(nextMode)) {
        divCalcMode = nextMode;
        render();
      }
      return;
    }
    const divCapPickBtn = event.target.closest("[data-div-cap-pick]");
    if (divCapPickBtn) {
      divCalcCapital = Math.min(
        50000000,
        Math.max(0, Math.round(Number(divCapPickBtn.dataset.divCapPick) || 0)),
      );
      render();
      return;
    }
    const divCapStepBtn = event.target.closest("[data-div-cap-step]");
    if (divCapStepBtn) {
      const delta = Number(divCapStepBtn.dataset.divCapStep || 0);
      divCalcCapital = Math.min(
        50000000,
        Math.max(0, Math.round(divCalcCapital + delta)),
      );
      render();
      return;
    }
    const divRatePickBtn = event.target.closest("[data-div-rate-pick]");
    if (divRatePickBtn) {
      divCalcRatePct = Math.min(
        25,
        Math.max(
          0,
          Math.round((Number(divRatePickBtn.dataset.divRatePick) || 0) * 100) /
            100,
        ),
      );
      render();
      return;
    }
    const divTargetPickBtn = event.target.closest("[data-div-target-pick]");
    if (divTargetPickBtn) {
      divTargetMonthly = Math.min(
        500000,
        Math.max(100, Math.round(Number(divTargetPickBtn.dataset.divTargetPick) || 10000)),
      );
      render();
      return;
    }
    const divTargetStepBtn = event.target.closest("[data-div-target-step]");
    if (divTargetStepBtn) {
      const delta = Number(divTargetStepBtn.dataset.divTargetStep || 0);
      divTargetMonthly = Math.min(
        500000,
        Math.max(100, Math.round(divTargetMonthly + delta)),
      );
      render();
      return;
    }
    const divTargetRatePickBtn = event.target.closest("[data-div-target-rate-pick]");
    if (divTargetRatePickBtn) {
      divTargetRatePct = Math.min(
        25,
        Math.max(0.1, Math.round((Number(divTargetRatePickBtn.dataset.divTargetRatePick) || 5) * 100) / 100),
      );
      render();
      return;
    }
    const divTargetCapPickBtn = event.target.closest("[data-div-target-cap-pick]");
    if (divTargetCapPickBtn) {
      divTargetCurrCap = Math.min(
        50000000,
        Math.max(0, Math.round(Number(divTargetCapPickBtn.dataset.divTargetCapPick) || 0)),
      );
      render();
      return;
    }
    const divTargetSavePickBtn = event.target.closest("[data-div-target-save-pick]");
    if (divTargetSavePickBtn) {
      divTargetMoSave = Math.min(
        500000,
        Math.max(0, Math.round(Number(divTargetSavePickBtn.dataset.divTargetSavePick) || 0)),
      );
      render();
      return;
    }
    const divAnnuitySavePickBtn = event.target.closest("[data-div-annuity-save-pick]");
    if (divAnnuitySavePickBtn) {
      divAnnuityMoSave = Math.min(
        500000,
        Math.max(50, Math.round(Number(divAnnuitySavePickBtn.dataset.divAnnuitySavePick) || 1000)),
      );
      render();
      return;
    }
    const divAnnuityPayoutPickBtn = event.target.closest("[data-div-annuity-payout-pick]");
    if (divAnnuityPayoutPickBtn) {
      divAnnuityQuotedMo = Math.min(
        1000000,
        Math.max(0, Math.round(Number(divAnnuityPayoutPickBtn.dataset.divAnnuityPayoutPick) || 1200)),
      );
      render();
      return;
    }
    const divAnnuityPayYrsBtn = event.target.closest("[data-div-annuity-pay-yrs]");
    if (divAnnuityPayYrsBtn) {
      divAnnuityPayYears = Math.min(50, Math.max(1, Math.round(Number(divAnnuityPayYrsBtn.dataset.divAnnuityPayYrs) || 15)));
      render();
      return;
    }
    const divAnnuityDeferYrsBtn = event.target.closest("[data-div-annuity-defer-yrs]");
    if (divAnnuityDeferYrsBtn) {
      divAnnuityDeferYears = Math.min(30, Math.max(0, Math.round(Number(divAnnuityDeferYrsBtn.dataset.divAnnuityDeferYrs) || 0)));
      render();
      return;
    }
    const divAnnuityDrawYrsBtn = event.target.closest("[data-div-annuity-draw-yrs]");
    if (divAnnuityDrawYrsBtn) {
      divAnnuityDrawYears = Math.min(50, Math.max(1, Math.round(Number(divAnnuityDrawYrsBtn.dataset.divAnnuityDrawYrs) || 20)));
      render();
      return;
    }
    const cashSyncBtn = event.target.closest("[data-cash-sync]");
    if (cashSyncBtn) {
      loadMasRates(true, cashSyncBtn);
      showToast("Checked latest MAS SSB & T-Bill reference yields");
      return;
    }
    const openCashBdBtn = event.target.closest("[data-open-cash-breakdown]");
    if (openCashBdBtn) {
      event.preventDefault();
      if (!customCashAccounts.length) {
        const curCash = Math.max(
          0,
          Number($("#known-ssb-cash")?.value || 20000),
        );
        customCashAccounts = RetirementModel.defaultCashAccounts(
          curCash,
          liveMasRates,
        );
      }
      useItemizedCashAccounts = true;
      syncCashAccountsToBucket();
      if (qeDialog && typeof qeDialog.showModal === "function") {
        lastQeInvoker = openCashBdBtn;
        setQuickEditPanel("balances", false);
        if (!qeDialog.open) qeDialog.showModal();
        render();
        requestAnimationFrame(() => {
          $("#qe-cash-accounts-slot")?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
        });
      } else {
        render();
      }
      return;
    }
    const cashToggleQeBtn = event.target.closest("[data-cash-acc-toggle-qe]");
    if (cashToggleQeBtn) {
      if (useItemizedCashAccounts && customCashAccounts.length > 0) {
        const tot = sumCustomCashAccounts();
        useItemizedCashAccounts = false;
        if ($("#known-ssb-cash")) $("#known-ssb-cash").value = String(tot);
        if ($("#qe-ssb-cash")) $("#qe-ssb-cash").value = String(tot);
        syncBucketsToTotal();
        render();
      } else {
        if (!customCashAccounts.length) {
          const curCash = Math.max(
            0,
            Number($("#known-ssb-cash")?.value || 20000),
          );
          customCashAccounts = RetirementModel.defaultCashAccounts(
            curCash,
            liveMasRates,
          );
        }
        useItemizedCashAccounts = true;
        syncCashAccountsToBucket();
        render();
        requestAnimationFrame(() => {
          $("#qe-cash-accounts-slot")?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
        });
      }
      return;
    }
    const cashModeBtn = event.target.closest("[data-cash-acc-mode]");
    if (cashModeBtn) {
      const nextMode = cashModeBtn.dataset.cashAccMode;
      if (nextMode === "itemized") {
        if (!customCashAccounts.length) {
          const curCash = Math.max(
            0,
            Number($("#known-ssb-cash")?.value || 20000),
          );
          customCashAccounts = RetirementModel.defaultCashAccounts(
            curCash,
            liveMasRates,
          );
        }
        useItemizedCashAccounts = true;
        syncCashAccountsToBucket();
        render();
      } else {
        const curTot =
          useItemizedCashAccounts && customCashAccounts.length
            ? sumCustomCashAccounts()
            : Math.max(0, Number($("#known-ssb-cash")?.value || 0));
        useItemizedCashAccounts = false;
        if ($("#known-ssb-cash")) $("#known-ssb-cash").value = String(curTot);
        if ($("#qe-ssb-cash")) $("#qe-ssb-cash").value = String(curTot);
        syncBucketsToTotal();
        render();
      }
      return;
    }
    const cashAddBtn = event.target.closest("[data-cash-acc-add]");
    if (cashAddBtn) {
      const presetKey = cashAddBtn.dataset.cashAccAdd || "custom";
      const preset = RetirementModel.resolveCashAccountPreset(
        presetKey,
        liveMasRates,
      );
      if (!useItemizedCashAccounts || !customCashAccounts.length) {
        const curCash = Math.max(0, Number($("#known-ssb-cash")?.value || 0));
        customCashAccounts = [
          {
            id: "cash-acc-" + Date.now(),
            preset: preset.key,
            name: preset.name,
            balance: curCash > 0 ? curCash : 10000,
            bonusCap: preset.bonusCap,
            bonusRatePct: preset.bonusRatePct,
            baseRatePct: preset.baseRatePct,
          },
        ];
      } else {
        customCashAccounts.push({
          id: "cash-acc-" + Date.now(),
          preset: preset.key,
          name: preset.name,
          balance: 10000,
          bonusCap: preset.bonusCap,
          bonusRatePct: preset.bonusRatePct,
          baseRatePct: preset.baseRatePct,
        });
      }
      useItemizedCashAccounts = true;
      syncCashAccountsToBucket();
      render();
      showToast(`Added ${preset.name}`);
      return;
    }
    const cashRemBtn = event.target.closest("[data-cash-acc-remove]");
    if (cashRemBtn) {
      const idx = Number(cashRemBtn.dataset.cashAccRemove);
      if (
        Number.isInteger(idx) &&
        idx >= 0 &&
        idx < customCashAccounts.length
      ) {
        const removed = customCashAccounts[idx];
        customCashAccounts.splice(idx, 1);
        if (customCashAccounts.length > 0) {
          useItemizedCashAccounts = true;
          syncCashAccountsToBucket();
        } else {
          useItemizedCashAccounts = false;
          if ($("#known-ssb-cash"))
            $("#known-ssb-cash").value = String(removed?.balance || 0);
          if ($("#qe-ssb-cash"))
            $("#qe-ssb-cash").value = String(removed?.balance || 0);
          syncBucketsToTotal();
        }
        render();
      }
      return;
    }
    const cashSweepBtn = event.target.closest("[data-cash-acc-sweep]");
    if (cashSweepBtn) {
      if (customCashAccounts.length > 0) {
        const beforeBd = RetirementModel.computeCashAccountsBreakdown(
          customCashAccounts,
          liveMasRates,
        );
        customCashAccounts = RetirementModel.sweepCashAccountsOverflow(
          customCashAccounts,
          liveMasRates,
        );
        useItemizedCashAccounts = true;
        syncCashAccountsToBucket();
        render();
        showToast(
          `Swept ${money(beforeBd.totalOverflowBalance)} overflow to MAS SSB (+${money(beforeBd.sweepAnnualGain)}/yr → ${beforeBd.sweptEffectiveRatePct.toFixed(2)}% EIR)`,
        );
      }
      return;
    }
    const toggleExpBodyBtn = event.target.closest("[data-toggle-exp-body]");
    if (toggleExpBodyBtn) {
      expCardExpanded = !expCardExpanded;
      const bodyEl = $("#exp-card-body");
      if (bodyEl) bodyEl.hidden = !expCardExpanded;
      const miniRowEl = $("#exp-mini-row");
      if (miniRowEl) miniRowEl.hidden = expCardExpanded;
      toggleExpBodyBtn.setAttribute("aria-expanded", String(expCardExpanded));
      const lbl = toggleExpBodyBtn.querySelector("span");
      if (lbl) lbl.textContent = expCardExpanded ? "Hide" : "Breakdown";
      const caret = toggleExpBodyBtn.querySelector(".exp-expand-caret");
      if (caret) caret.classList.toggle("is-open", expCardExpanded);
      return;
    }
    const openExpModalBtn = event.target.closest("[data-open-expense-modal]");
    if (openExpModalBtn) {
      event.preventDefault();
      openExpenseModal(
        openExpModalBtn.dataset.openExpenseModal || "auto",
        openExpModalBtn,
      );
      return;
    }
    const expEnterCustomBtn = event.target.closest("[data-exp-enter-custom]");
    if (expEnterCustomBtn) {
      const insideModal = Boolean(expDialog?.contains(expEnterCustomBtn));
      enterCustomExpenseMode(insideModal ? lastExpInvoker : expEnterCustomBtn);
      return;
    }
    const expModeBtn = event.target.closest("[data-exp-custom-mode]");
    if (expModeBtn) {
      const nextMode = expModeBtn.dataset.expCustomMode;
      const life = $("#known-lifestyle")?.value || "cca";
      const curSpend = getCustomSpendState(life).spend;
      customBudgetActive = true;
      if (nextMode === "itemized") {
        customExpenseItems = customExpenseItems.length
          ? RetirementModel.scaleExpenseItems(
              customExpenseItems,
              curSpend,
              life,
            )
          : RetirementModel.defaultExpenseItems(life, curSpend);
        useItemizedExpenses = true;
        const tot = sumCustomExpenseItems();
        if ($("#known-spend")) $("#known-spend").value = String(tot);
        render();
        requestAnimationFrame(() => {
          expModalBody
            ?.querySelector('[data-exp-custom-mode="itemized"]')
            ?.focus({ preventScroll: true });
        });
      } else {
        const curTotal =
          useItemizedExpenses && customExpenseItems.length
            ? sumCustomExpenseItems()
            : curSpend;
        useItemizedExpenses = false;
        if ($("#known-spend")) $("#known-spend").value = String(curTotal);
        render();
        requestAnimationFrame(() => {
          const totalInput = $("#exp-total-input");
          totalInput?.focus({ preventScroll: true });
          totalInput?.select();
        });
      }
      return;
    }
    const expAddBtn = event.target.closest("[data-exp-add]");
    if (expAddBtn) {
      if (!customExpenseItems.length) {
        const life = $("#known-lifestyle")?.value || "cca";
        customExpenseItems = RetirementModel.defaultExpenseItems(
          life,
          getCustomSpendState(life).spend,
        );
      }
      const newExpId = "exp-" + Date.now();
      newlyAddedExpId = newExpId;
      customExpenseItems.push({
        id: newExpId,
        name: "New expense",
        category: "food",
        amount: 0,
      });
      customBudgetActive = true;
      useItemizedExpenses = true;
      const tot = sumCustomExpenseItems();
      if ($("#known-spend")) $("#known-spend").value = String(tot);
      render();
      requestAnimationFrame(() => {
        const inputs =
          expModalBody?.querySelectorAll('[data-exp-field="name"]') || [];
        const last = inputs[inputs.length - 1];
        last?.focus();
        last?.select();
      });
      return;
    }
    const expRemBtn = event.target.closest("[data-exp-remove]");
    if (expRemBtn) {
      const idx = Number(expRemBtn.dataset.expRemove);
      if (
        Number.isInteger(idx) &&
        idx >= 0 &&
        idx < customExpenseItems.length
      ) {
        customExpenseItems.splice(idx, 1);
        customBudgetActive = true;
        useItemizedExpenses = customExpenseItems.length > 0;
        const tot = customExpenseItems.length ? sumCustomExpenseItems() : 0;
        if ($("#known-spend")) $("#known-spend").value = String(tot);
        render();
      }
      return;
    }
    const expLoadBtn = event.target.closest("[data-exp-load]");
    if (expLoadBtn) {
      const curCustom = getCustomSpendState();
      if (curCustom.isCustom) {
        lastCustomSpend = String(Math.round(curCustom.spend * 100) / 100);
        lastCustomLifestyle = $("#known-lifestyle")?.value || "cca";
      }
      const targetLife =
        expLoadBtn.dataset.expLoad === "home-helper" ? "home-helper" : "cca";
      if ($("#known-lifestyle")) $("#known-lifestyle").value = targetLife;
      if (
        targetLife === "cca" &&
        Number($("#known-retire")?.value || 65) < 55
      ) {
        if ($("#known-retire")) $("#known-retire").value = "55";
        if ($("#qe-retire")) $("#qe-retire").value = "55";
      }
      clearCustomBudgetState();
      if ($("#known-spend")) $("#known-spend").value = "";
      render();
      if (expDialog?.open) {
        requestAnimationFrame(() => {
          expModalBody
            ?.querySelector(`[data-exp-load="${targetLife}"]`)
            ?.focus({ preventScroll: true });
        });
      }
      return;
    }
    const activityTabBtn = event.target.closest("[data-fin-activity]");
    if (activityTabBtn) {
      finActivityTab = activityTabBtn.dataset.finActivity || "coverage";
      render();
      return;
    }
    const expDropBtn = event.target.closest("#exp-card-dropdown-btn");
    const expDropMenu = $("#exp-card-dropdown-menu");
    if (expDropBtn && expDropMenu) {
      const nextOpen = expDropMenu.hidden;
      expDropMenu.hidden = !nextOpen;
      expDropBtn.setAttribute("aria-expanded", String(nextOpen));
      return;
    }
    const selectCustomBtn = event.target.closest("[data-select-custom]");
    if (selectCustomBtn) {
      if (expDropMenu) expDropMenu.hidden = true;
      $("#exp-card-dropdown-btn")?.setAttribute("aria-expanded", "false");
      enterCustomExpenseMode($("#exp-card-dropdown-btn") || selectCustomBtn);
      return;
    }
    const switchLifeBtn = event.target.closest("[data-switch-lifestyle]");
    if (switchLifeBtn) {
      const nextVal = switchLifeBtn.dataset.switchLifestyle;
      if ($("#known-lifestyle") && nextVal) {
        const curCustom = getCustomSpendState();
        if (curCustom.isCustom) {
          lastCustomSpend = String(Math.round(curCustom.spend * 100) / 100);
          lastCustomLifestyle = $("#known-lifestyle")?.value || "cca";
        }
        clearCustomBudgetState();
        $("#known-lifestyle").value = nextVal;
        $("#known-spend").value = "";
        if (nextVal === "cca" && Number($("#known-retire")?.value || 65) < 55) {
          $("#known-retire").value = "55";
          if ($("#qe-retire")) $("#qe-retire").value = "55";
        }
      }
      if (expDropMenu) expDropMenu.hidden = true;
      $("#exp-card-dropdown-btn")?.setAttribute("aria-expanded", "false");
      render();
      showToast(
        nextVal === "cca"
          ? "Switched to Community Care ($2,800/mo preset)"
          : "Switched to Home + Helper ($3,900/mo preset)",
      );
      return;
    }
    if (
      expDropMenu &&
      !expDropMenu.hidden &&
      !event.target.closest("#exp-card-dropdown-wrap")
    ) {
      expDropMenu.hidden = true;
      $("#exp-card-dropdown-btn")?.setAttribute("aria-expanded", "false");
    }
  });

  function openExpenseModal(mode = "auto", invoker = null) {
    if (!expDialog) return;
    if (invoker) lastExpInvoker = invoker;
    else if (!expDialog.open) lastExpInvoker = document.activeElement;
    if (!expDialog.open) {
      const scroller = expDialog.querySelector(".settings-scroll-body");
      if (scroller) scroller.scrollTop = 0;
      expDialog.showModal();
    }
    render();
    if (expModalBody && !expModalBody.innerHTML.trim()) {
      const life = $("#known-lifestyle")?.value || "cca";
      const customSt = getCustomSpendState(life);
      const fallbackPlan = RetirementModel.expensePlan({
        lifestyle: life,
        spend: customSt.spend,
        itemizedActive: useItemizedExpenses,
        customExpenses: customExpenseItems,
        afterCpf: Number($("#person-salary")?.value || 5500) * 0.8,
        customActive: customSt.isCustom,
      });
      expModalBody.innerHTML = buildExpenseModalBodyHTML(fallbackPlan, {
        plan: $("#known-plan")?.value || "standard",
      });
    }
    requestAnimationFrame(() => {
      if (mode === "custom") {
        if (!useItemizedExpenses) {
          const totalInput = $("#exp-total-input");
          totalInput?.focus({ preventScroll: true });
          totalInput?.select();
        } else {
          expModalBody
            ?.querySelector('[data-exp-custom-mode="itemized"]')
            ?.focus({ preventScroll: true });
        }
      } else if (!expDialog.contains(document.activeElement)) {
        expModalBody
          ?.querySelector(".exp-modal-source-btn.is-active, [data-exp-load]")
          ?.focus({ preventScroll: true });
      }
    });
  }

  function enterCustomExpenseMode(invoker = null) {
    const life = $("#known-lifestyle")?.value || "cca";
    const curState = getCustomSpendState(life);
    if (!curState.isCustom) {
      customBudgetActive = true;
      if (
        lastCustomSpend &&
        lastCustomLifestyle === life &&
        Math.round(Number(lastCustomSpend) * 100) !==
          Math.round(curState.presetBudget * 100)
      ) {
        useItemizedExpenses = false;
        customExpenseItems = RetirementModel.defaultExpenseItems(
          life,
          Number(lastCustomSpend),
        );
        if ($("#known-spend")) $("#known-spend").value = lastCustomSpend;
      } else {
        useItemizedExpenses = true;
        customExpenseItems = RetirementModel.defaultExpenseItems(
          life,
          curState.presetBudget,
        );
        if ($("#known-spend"))
          $("#known-spend").value = String(curState.presetBudget);
      }
    }
    openExpenseModal("custom", invoker);
  }

  if (expDialog) {
    bindDialogBackdropDismiss(expDialog);
    expDialog.addEventListener("click", (event) => {
      const planBtn = event.target.closest("[data-exp-set-plan]");
      if (planBtn) {
        const nextPlan =
          planBtn.dataset.expSetPlan === "escalating"
            ? "escalating"
            : "standard";
        if ($("#known-plan")) $("#known-plan").value = nextPlan;
        if ($("#exp-modal-plan")) $("#exp-modal-plan").value = nextPlan;
        render();
        return;
      }
      const stepBtn = event.target.closest("[data-exp-step-delta]");
      if (stepBtn) {
        const delta = Number(stepBtn.dataset.expStepDelta || 0);
        const life = $("#known-lifestyle")?.value || "cca";
        const cur = getCustomSpendState(life).spend;
        const nextVal = Math.min(1000000, Math.max(0, Math.round(cur + delta)));
        customBudgetActive = true;
        useItemizedExpenses = false;
        if ($("#known-spend")) $("#known-spend").value = String(nextVal);
        render();
        return;
      }
      const quickBtn = event.target.closest("[data-exp-quick-total]");
      if (quickBtn) {
        const nextVal = Math.min(
          1000000,
          Math.max(0, Math.round(Number(quickBtn.dataset.expQuickTotal || 0))),
        );
        customBudgetActive = true;
        useItemizedExpenses = false;
        if ($("#known-spend")) $("#known-spend").value = String(nextVal);
        render();
        return;
      }
      if (event.target.closest("#exp-modal-open-settings")) {
        expDialog.dataset.flowNavigation = "true";
        expDialog.close();
        document.querySelector("[data-open-profile]")?.click();
        return;
      }
      if (event.target.closest("[data-exp-modal-close]")) {
        expDialog.close();
      }
    });

    expDialog.addEventListener("change", (event) => {
      if (event.target.id === "exp-modal-plan") {
        if ($("#known-plan")) $("#known-plan").value = event.target.value;
        render();
        return;
      }
      const expField = event.target.dataset?.expField;
      if (expField === "category") {
        const idx = Number(event.target.dataset.expIdx);
        if (!customExpenseItems.length) {
          const life = $("#known-lifestyle")?.value || "cca";
          customExpenseItems = RetirementModel.defaultExpenseItems(
            life,
            getCustomSpendState(life).spend,
          );
        }
        if (customExpenseItems[idx]) {
          customExpenseItems[idx].category = event.target.value;
          customBudgetActive = true;
          useItemizedExpenses = true;
          const tot = sumCustomExpenseItems();
          if ($("#known-spend")) $("#known-spend").value = String(tot);
          render();
        }
      }
    });

    expDialog.addEventListener("input", (event) => {
      if (event.target.id === "exp-total-input") {
        const raw = event.target.value.trim();
        if (raw === "") {
          clearCustomBudgetState();
          if ($("#known-spend")) $("#known-spend").value = "";
        } else {
          customBudgetActive = true;
          useItemizedExpenses = false;
          if ($("#known-spend")) $("#known-spend").value = raw;
        }
        scheduleRender();
        return;
      }
      const expField = event.target.dataset?.expField;
      if (expField === "name" || expField === "amount") {
        const idx = Number(event.target.dataset.expIdx);
        if (!customExpenseItems.length) {
          const life = $("#known-lifestyle")?.value || "cca";
          customExpenseItems = RetirementModel.defaultExpenseItems(
            life,
            getCustomSpendState(life).spend,
          );
        }
        if (customExpenseItems[idx]) {
          if (expField === "name") {
            customExpenseItems[idx].name = event.target.value;
          } else {
            const raw = event.target.value.trim();
            const num = raw === "" ? 0 : Math.max(0, Number(raw) || 0);
            customExpenseItems[idx].amount = Math.round(num * 100) / 100;
          }
          customBudgetActive = true;
          useItemizedExpenses = true;
          const tot = sumCustomExpenseItems();
          if ($("#known-spend")) $("#known-spend").value = String(tot);
          scheduleRender();
        }
      }
    });

    expDialog.addEventListener("close", () => {
      const spendEl = $("#known-spend");
      if (spendEl) {
        const raw = spendEl.value.trim();
        if (spendEl.validity.badInput) {
          spendEl.value = lastValidFieldValues["known-spend"] ?? "";
          render();
        } else if (raw !== "" && !spendEl.validity.valid) {
          const minV = Number(spendEl.min || 0);
          const maxV = spendEl.max !== "" ? Number(spendEl.max) : Infinity;
          spendEl.value = String(Math.min(maxV, Math.max(minV, Number(raw))));
          render();
        }
      }
      if (expDialog.dataset.flowNavigation) {
        delete expDialog.dataset.flowNavigation;
        return;
      }
      if (lastExpInvoker?.isConnected) {
        lastExpInvoker.focus({ preventScroll: true });
      }
    });
  }

  planRoot.addEventListener("mouseover", (event) => {
    const bentoSegEl = event.target.closest(".fin-bento-card [data-bento-seg]");
    if (bentoSegEl) {
      const bCard = bentoSegEl.closest(".fin-bento-card");
      const segKey = bentoSegEl.dataset.bentoSeg;
      if (bCard) {
        bCard.classList.add("has-bento-hover");
        bCard.querySelectorAll("[data-bento-seg]").forEach((el) => {
          el.classList.toggle("is-seg-hl", el.dataset.bentoSeg === segKey);
        });
      }
    }
    const target = event.target.closest(
      "#expense-breakdown-card [data-exp-cat]",
    );
    const card = $("#expense-breakdown-card");
    if (!card) return;
    card
      .querySelectorAll("[data-exp-cat]")
      .forEach((el) => el.classList.remove("is-hl"));
    const pill = card.querySelector("#exp-pie-hover-pill");
    if (!target) {
      if (pill) pill.hidden = true;
      return;
    }
    const catKey = target.dataset.expCat;
    card
      .querySelectorAll(`[data-exp-cat="${catKey}"]`)
      .forEach((el) => el.classList.add("is-hl"));
    const row = card.querySelector(`.exp-cat-row[data-exp-cat="${catKey}"]`);
    if (pill && row) {
      const name =
        row
          .querySelector(".exp-cat-name")
          ?.textContent?.replace(/\(\d+\)/, "")
          .trim() || "";
      const val = row.querySelector(".exp-cat-val")?.textContent?.trim() || "";
      pill.textContent = `${name}: ${val}`;
      pill.hidden = false;
    }
  });
  planRoot.addEventListener("mouseout", (event) => {
    const bentoCard = event.target.closest(".fin-bento-card");
    if (bentoCard && (!event.relatedTarget || !bentoCard.contains(event.relatedTarget.closest?.("[data-bento-seg]") || event.relatedTarget))) {
      bentoCard.classList.remove("has-bento-hover");
      bentoCard.querySelectorAll("[data-bento-seg].is-seg-hl").forEach((el) => {
        el.classList.remove("is-seg-hl");
      });
    }
    const card = $("#expense-breakdown-card");
    if (!card || (event.relatedTarget && card.contains(event.relatedTarget)))
      return;
    card
      .querySelectorAll("[data-exp-cat].is-hl")
      .forEach((el) => el.classList.remove("is-hl"));
    const pill = card.querySelector("#exp-pie-hover-pill");
    if (pill) pill.hidden = true;
  });

  const handleCashAccountFieldEvent = (event) => {
    const field = event.target?.dataset?.cashAccField;
    if (!field) return false;
    const idx = Number(event.target.dataset.cashAccIdx);
    if (!Number.isInteger(idx) || idx < 0 || idx >= customCashAccounts.length) {
      return false;
    }
    const acc = customCashAccounts[idx];
    if (field === "preset") {
      const preset = RetirementModel.resolveCashAccountPreset(
        event.target.value,
        liveMasRates,
      );
      acc.preset = preset.key;
      acc.name = preset.name;
      acc.bonusCap = preset.bonusCap;
      acc.bonusRatePct = preset.bonusRatePct;
      acc.baseRatePct = preset.baseRatePct;
      useItemizedCashAccounts = true;
      syncCashAccountsToBucket();
      render();
      return true;
    }
    if (field === "name") {
      acc.name = event.target.value;
    } else if (field === "balance") {
      const raw = event.target.value.trim();
      acc.balance =
        raw === "" ? 0 : Math.round(Math.max(0, Number(raw) || 0) * 100) / 100;
    } else if (field === "bonusCap") {
      const raw = event.target.value.trim();
      acc.bonusCap =
        raw === "" ? 0 : Math.round(Math.max(0, Number(raw) || 0) * 100) / 100;
    } else if (field === "bonusRatePct") {
      const raw = event.target.value.trim();
      acc.bonusRatePct =
        raw === ""
          ? 0
          : Math.round(Math.min(20, Math.max(0, Number(raw) || 0)) * 100) / 100;
    } else if (field === "baseRatePct") {
      const raw = event.target.value.trim();
      acc.baseRatePct =
        raw === ""
          ? 0
          : Math.round(Math.min(20, Math.max(0, Number(raw) || 0)) * 100) / 100;
    }
    useItemizedCashAccounts = true;
    syncCashAccountsToBucket();
    if (event.type === "change") {
      render();
    } else {
      scheduleRender();
    }
    return true;
  };
  document.addEventListener("change", (event) => {
    handleCashAccountFieldEvent(event);
  });
  document.addEventListener("input", (event) => {
    handleCashAccountFieldEvent(event);
  });

  planRoot.addEventListener("input", (event) => {
    if (event.target.id === "cash-search-input") {
      cashParkingSearch = event.target.value || "";
      const clearBtn = cashParkingSlot?.querySelector(
        "[data-cash-search-clear]",
      );
      if (clearBtn) clearBtn.hidden = !cashParkingSearch;
      const wrap = cashParkingSlot?.querySelector(".cash-cards-wrap");
      if (wrap && currentCashPlan) {
        wrap.innerHTML = buildCashCardsMarkup(
          currentCashPlan,
          cashParkingFilter,
          false,
          cashParkingSearch,
          cashParkingTag,
        );
      }
      return;
    }
    if (event.target.id === "div-calc-capital") {
      const raw = event.target.value.trim();
      divCalcCapital =
        raw === ""
          ? 0
          : Math.min(50000000, Math.max(0, Math.round(Number(raw) || 0)));
      scheduleRender();
      return;
    }
    if (
      event.target.id === "div-calc-rate" ||
      event.target.id === "div-calc-rate-slider"
    ) {
      const raw = event.target.value.trim();
      divCalcRatePct =
        raw === ""
          ? 0
          : Math.min(
              25,
              Math.max(0, Math.round((Number(raw) || 0) * 100) / 100),
            );
      scheduleRender();
      return;
    }
    if (event.target.id === "div-target-monthly") {
      const raw = event.target.value.trim();
      divTargetMonthly =
        raw === ""
          ? 0
          : Math.min(500000, Math.max(0, Math.round(Number(raw) || 0)));
      scheduleRender();
      return;
    }
    if (
      event.target.id === "div-target-rate" ||
      event.target.id === "div-target-rate-slider"
    ) {
      const raw = event.target.value.trim();
      divTargetRatePct =
        raw === ""
          ? 0.1
          : Math.min(
              25,
              Math.max(0.1, Math.round((Number(raw) || 0.1) * 100) / 100),
            );
      scheduleRender();
      return;
    }
    if (event.target.id === "div-target-cur-cap") {
      const raw = event.target.value.trim();
      divTargetCurrCap =
        raw === ""
          ? 0
          : Math.min(50000000, Math.max(0, Math.round(Number(raw) || 0)));
      scheduleRender();
      return;
    }
    if (event.target.id === "div-target-mo-save") {
      const raw = event.target.value.trim();
      divTargetMoSave =
        raw === ""
          ? 0
          : Math.min(500000, Math.max(0, Math.round(Number(raw) || 0)));
      scheduleRender();
      return;
    }
    if (event.target.id === "div-annuity-mo-save") {
      const raw = event.target.value.trim();
      divAnnuityMoSave =
        raw === ""
          ? 100
          : Math.min(500000, Math.max(1, Math.round(Number(raw) || 100)));
      scheduleRender();
      return;
    }
    if (event.target.id === "div-annuity-quoted-mo") {
      const raw = event.target.value.trim();
      divAnnuityQuotedMo =
        raw === ""
          ? 0
          : Math.min(1000000, Math.max(0, Math.round(Number(raw) || 0)));
      scheduleRender();
      return;
    }
    if (event.target.id === "div-annuity-pay-yrs") {
      const raw = event.target.value.trim();
      divAnnuityPayYears =
        raw === ""
          ? 1
          : Math.min(50, Math.max(1, Math.round(Number(raw) || 1)));
      scheduleRender();
      return;
    }
    if (event.target.id === "div-annuity-defer-yrs") {
      const raw = event.target.value.trim();
      divAnnuityDeferYears =
        raw === ""
          ? 0
          : Math.min(30, Math.max(0, Math.round(Number(raw) || 0)));
      scheduleRender();
      return;
    }
    if (event.target.id === "div-annuity-draw-yrs") {
      const raw = event.target.value.trim();
      divAnnuityDrawYears =
        raw === ""
          ? 1
          : Math.min(50, Math.max(1, Math.round(Number(raw) || 1)));
      scheduleRender();
      return;
    }
    if (event.target.id === "bogle-target-slider") {
      const raw = event.target.value.trim();
      if (raw === "") return;
      const val = Math.min(100, Math.max(0, Math.round(Number(raw) || 0)));
      $("#known-target-equity").value = String(val);
      scheduleRender();
    } else if (event.target.id === "bogle-sg-slider") {
      const raw = event.target.value.trim();
      if (raw === "") return;
      const val = Math.min(100, Math.max(0, Math.round(Number(raw) || 0)));
      $("#known-sg-sleeve").value = String(val);
      scheduleRender();
    }
  });

  const clampSavingToTakeHome = (input, otherInputs) => {
    const raw = input.value.trim();
    if (raw === "") return false;
    const val = Number(raw);
    if (!Number.isFinite(val) || val < 0) return false;
    const list = Array.isArray(otherInputs) ? otherInputs : [otherInputs];
    const otherManual = list.reduce(
      (sum, el) =>
        sum +
        Math.max(0, el && el.value.trim() !== "" ? Number(el.value) || 0 : 0),
      0,
    );
    const maxAllowed = Math.max(0, currentAfterCpfCap - otherManual);
    if (val > maxAllowed) {
      input.value = String(maxAllowed);
      return maxAllowed;
    }
    return false;
  };

  if ($("#sim-cash-saving")) {
    $("#sim-cash-saving").addEventListener("input", () => {
      const clamped = clampSavingToTakeHome($("#sim-cash-saving"), [
        $("#known-cpf-extra"),
        $("#known-invest"),
      ]);
      if (clamped === false && !$("#sim-cash-saving").validity.valid) {
        setError(
          "Enter a monthly cash savings amount within your take-home pay, without commas or dollar signs.",
        );
        return;
      }
      if ($("#known-cash-saving")) {
        $("#known-cash-saving").value = $("#sim-cash-saving").value;
      }
      render();
      if (clamped !== false) {
        const help = $("#sim-cash-saving-help");
        if (help) {
          help.textContent = `Capped at ${money(clamped)}/mo (within your ${money(currentAfterCpfCap)}/mo take-home pay).`;
        }
      }
    });
  }
  $("#sim-invest").addEventListener("input", () => {
    const clamped = clampSavingToTakeHome($("#sim-invest"), [
      $("#known-cpf-extra"),
      $("#known-cash-saving"),
    ]);
    if (clamped === false && !$("#sim-invest").validity.valid) {
      setError(
        "Enter a monthly investment amount within your take-home pay, without commas or dollar signs.",
      );
      return;
    }
    $("#known-invest").value = $("#sim-invest").value;
    render();
    if (clamped !== false) {
      const help = $("#sim-invest-help");
      if (help) {
        help.textContent = `Capped at ${money(clamped)}/mo (within your ${money(currentAfterCpfCap)}/mo take-home pay).`;
      }
    }
  });
  allocatorSlot.addEventListener("click", (event) => {
    const eqPreset = event.target.closest("[data-bogle-eq-preset]");
    if (eqPreset) {
      const val = Number(eqPreset.dataset.bogleEqPreset);
      $("#known-target-equity").value = String(val);
      if ($("#bogle-target-slider")) $("#bogle-target-slider").value = String(val);
      render();
      return;
    }
    const sgPreset = event.target.closest("[data-bogle-sg-preset]");
    if (sgPreset) {
      const val = Number(sgPreset.dataset.bogleSgPreset);
      $("#known-sg-sleeve").value = String(val);
      if ($("#bogle-sg-slider")) $("#bogle-sg-slider").value = String(val);
      render();
      return;
    }
    const stepBtn = event.target.closest("[data-bogle-step]");
    if (stepBtn) {
      const targetId = stepBtn.dataset.bogleStep;
      const delta = Number(stepBtn.dataset.delta || 0);
      if (targetId === "bogle-target-slider") {
        const cur = Number($("#known-target-equity").value || 80);
        const next = Math.min(100, Math.max(0, cur + delta));
        $("#known-target-equity").value = String(next);
        if ($("#bogle-target-slider")) $("#bogle-target-slider").value = String(next);
        render();
      } else if (targetId === "bogle-sg-slider") {
        const cur = Number($("#known-sg-sleeve").value || 15);
        const next = Math.min(100, Math.max(0, cur + delta));
        $("#known-sg-sleeve").value = String(next);
        if ($("#bogle-sg-slider")) $("#bogle-sg-slider").value = String(next);
        render();
      }
    }
  });
  $("#savings-simulator").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-adjust]");
    if (!button) return;
    const input = $("#" + button.dataset.adjust);
    const others = [
      $("#known-cpf-extra"),
      $("#sim-cash-saving"),
      $("#sim-invest"),
    ].filter((el) => el && el.id !== input.id);
    const otherManual = others.reduce(
      (sum, el) =>
        sum + (el.value.trim() !== "" ? Math.max(0, Number(el.value) || 0) : 0),
      0,
    );
    const maxAllowed = Math.max(0, currentAfterCpfCap - otherManual);
    const current =
      input.value === "" ? Number(input.placeholder) : Number(input.value);
    input.value = String(
      Math.min(
        maxAllowed,
        Math.max(
          0,
          Math.round((current + Number(button.dataset.delta)) * 100) / 100,
        ),
      ),
    );
    if (input.id === "sim-invest") $("#known-invest").value = input.value;
    if (input.id === "sim-cash-saving" && $("#known-cash-saving")) {
      $("#known-cash-saving").value = input.value;
    }
    render();
  });
  $("#sim-use-target").addEventListener("click", (event) => {
    $("#known-cpf-extra").value = "";
    if ($("#known-cash-saving")) $("#known-cash-saving").value = "";
    if ($("#sim-cash-saving")) $("#sim-cash-saving").value = "";
    $("#known-invest").value = "";
    render();
    flashConfirmButton(event.currentTarget, "✓ Reset to suggested");
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
      if (currentTrajectory) {
        renderTrajectoryChart(
          currentTrajectory,
          chartMode,
          currentFirePlan,
          dashChartBasis,
        );
        const chartEl = $("#trajectory-chart");
        if (
          chartEl &&
          !window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
        ) {
          chartEl.classList.remove("is-chart-entering");
          void chartEl.offsetWidth;
          chartEl.classList.add("is-chart-entering");
        }
      }
    }),
  );

  const triggerPrintPoster = () => {
    if (rafHandle != null) {
      cancelAnimationFrame(rafHandle);
      rafHandle = null;
      render();
    }
    window.print();
  };
  window.addEventListener("beforeprint", () => {
    if (rafHandle != null) {
      cancelAnimationFrame(rafHandle);
      rafHandle = null;
      render();
    }
  });
  $("#print-plan-btn")?.addEventListener("click", triggerPrintPoster);

  const exportPlanJson = (btn) => {
    if (rafHandle != null) {
      cancelAnimationFrame(rafHandle);
      rafHandle = null;
      render();
    }
    try {
      const savedRaw = localStorage.getItem("rs_plan_state");
      const stateObj = savedRaw ? JSON.parse(savedRaw) : {};
      const jsonText = JSON.stringify(stateObj, null, 2);
      const blob = new Blob([jsonText], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const now = new Date();
      const dateStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const a = document.createElement("a");
      a.href = url;
      a.download = `retirement-shield-plan-${dateStamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (btn) {
        const labelSpan = btn.querySelector("span");
        flashConfirmButton(labelSpan || btn, "✓ Exported");
      }
      showToast("Exported retirement plan JSON");
    } catch (_) {
      showToast("Could not export retirement plan JSON");
    }
  };

  $("#export-json-btn")?.addEventListener("click", (event) => {
    exportPlanJson(event.currentTarget);
  });

  const importJsonInput = $("#import-json-file");
  $("#import-json-btn")?.addEventListener("click", () => {
    if (importJsonInput) {
      importJsonInput.value = "";
      importJsonInput.click();
    }
  });

  importJsonInput?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const rawText = await file.text();
      const parsed = JSON.parse(rawText);
      const rawObj =
        parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? parsed.state && typeof parsed.state === "object"
            ? parsed.state
            : parsed
          : null;
      if (!rawObj) throw new Error("Invalid JSON object");
      const normalized = {};
      for (const [k, v] of Object.entries(rawObj)) {
        if (v == null || v === "") continue;
        if ((k === "expItems" || k === "cashItems") && Array.isArray(v)) {
          normalized[k] = JSON.stringify(v);
        } else {
          normalized[k] = String(v);
        }
      }
      if (!normalized.version) normalized.version = "2";
      if (!normalized.lifestyle) normalized.lifestyle = "cca";
      const params = new URLSearchParams(normalized);
      if (!applyStateParams(params, { resetFirst: true })) {
        throw new Error("Unsupported plan format");
      }
      localStorage.setItem("rs_plan_version", "2");
      localStorage.setItem(
        "rs_plan_state",
        JSON.stringify(Object.fromEntries(params.entries())),
      );
      if (! bucketIds.some((id) => ($("#" + id)?.value || "").trim() !== "") && ($("#known-savings")?.value || "").trim() !== "") {
        // Direct total savings preserved
      } else {
        syncBucketsToTotal();
      }
      render();
      const importBtn = $("#import-json-btn");
      if (importBtn) {
        const labelSpan = importBtn.querySelector("span");
        flashConfirmButton(labelSpan || importBtn, "✓ Imported");
      }
      showToast("Imported retirement plan into local storage");
    } catch (_) {
      showToast("Invalid retirement plan JSON file");
    } finally {
      event.target.value = "";
    }
  });
  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-print-trigger]")) {
      triggerPrintPoster();
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

  $("#reset-settings")?.addEventListener("click", (event) => {
    const assumptionDefaults = {
      "known-plan": String(SG_DEFAULT_PLAN.plan || "standard"),
      "known-return": String(SG_DEFAULT_PLAN.returnRate ?? 0.05),
      "known-inflation": String(SG_DEFAULT_PLAN.inflationRate ?? 0.025),
      "known-reserve-return": String(SG_DEFAULT_PLAN.reserveReturn ?? 0),
      "known-post55": String(Boolean(SG_DEFAULT_PLAN.post55Work ?? false)),
    };
    for (const [id, val] of Object.entries(assumptionDefaults)) {
      const el = $("#" + id);
      if (el) el.value = val;
    }
    render();
    flashConfirmButton(event.currentTarget, "✓ Assumptions reset");
    showToast("Model assumptions reset to 2026 baseline");
  });

  const qeDialog = $("#quick-edit-modal");
  const qeBindings = [
    ["qe-dob", "person-dob"],
    ["qe-retire", "known-retire"],
    ["qe-salary", "person-salary"],
    ["qe-annual-bonus", "known-annual-bonus"],
    ["qe-housing-mode", "known-housing-mode"],
    ["qe-housing-balance", "known-housing-balance"],
    ["qe-housing-years", "known-housing-years"],
    ["qe-housing-rate", "known-housing-rate"],
    ["qe-housing-parties", "known-housing-parties"],
    ["qe-housing", "known-housing"],
    ["qe-cpf-extra", "known-cpf-extra"],
    ["qe-cash-saving", "known-cash-saving"],
    ["qe-cash-return", "known-cash-return"],
    ["qe-invest", "known-invest"],
    ["qe-target-equity", "known-target-equity"],
    ["qe-sg-sleeve", "known-sg-sleeve"],
    ["qe-oa", "known-oa"],
    ["qe-sa", "known-sa"],
    ["qe-ma", "known-ma"],
    ["qe-sa-invested", "known-sa-invested"],
    ["qe-equities", "known-equities"],
    ["qe-sg-dividends", "known-sg-dividends"],
    ["qe-ssb-cash", "known-ssb-cash"],
    ["qe-srs", "known-srs"],
    ["qe-srs-invested", "known-srs-invested"],
  ];
  let lastQeInvoker = null;
  let activeQeTab = "goal";

  function getMinRetireAge() {
    const dobInfo = RetirementModel.computeAgeFromDob(
      $("#person-dob")?.value || "",
    );
    const curAge =
      dobInfo.valid && dobInfo.age >= 18 && dobInfo.age <= 54
        ? dobInfo.age
        : 35;
    const lifeMin = $("#known-lifestyle")?.value === "cca" ? 55 : 40;
    return Math.max(lifeMin, curAge);
  }

  function syncQuickEditState(r = null, fire = null, simulation = null) {
    if (!qeDialog) return;
    const minRetire = getMinRetireAge();
    const qeRetire = $("#qe-retire");
    if (qeRetire) qeRetire.min = String(minRetire);

    for (const [qeId, srcId] of qeBindings) {
      const qeEl = $("#" + qeId);
      const srcEl = $("#" + srcId);
      if (!qeEl || !srcEl) continue;
      if (document.activeElement !== qeEl) {
        qeEl.value = srcEl.value;
      }
    }

    const curRetire = Number($("#known-retire")?.value || 65);
    $$("[data-qe-retire-delta]").forEach((btn) => {
      const delta = Number(btn.dataset.qeRetireDelta);
      btn.disabled =
        (delta < 0 && curRetire <= minRetire) || (delta > 0 && curRetire >= 80);
    });
    $$("[data-qe-pick-age]").forEach((chip) => {
      const ageVal = Number(chip.dataset.qePickAge);
      const active = ageVal === curRetire;
      chip.disabled = ageVal < minRetire;
      chip.classList.toggle("is-active", active);
      chip.setAttribute("aria-pressed", String(active));
    });
    const curSalary = Number($("#person-salary")?.value || 5500);
    $$("[data-qe-salary-delta]").forEach((btn) => {
      const delta = Number(btn.dataset.qeSalaryDelta);
      btn.disabled =
        (delta < 0 && curSalary <= 751) || (delta > 0 && curSalary >= 1000000);
    });
    $$("[data-qe-pick-salary]").forEach((chip) => {
      const salVal = Number(chip.dataset.qePickSalary);
      const active = Math.round(curSalary) === salVal;
      chip.classList.toggle("is-active", active);
      chip.setAttribute("aria-pressed", String(active));
    });

    if (r && simulation) {
      const capStr = String(Math.max(0, Math.floor(r.afterCpf)));
      if ($("#qe-cpf-extra")) {
        $("#qe-cpf-extra").max = capStr;
        $("#qe-cpf-extra").placeholder = String(Math.ceil(simulation.cpfExtra));
        $("#qe-cpf-extra").disabled = r.retiringNow;
      }
      if ($("#qe-cash-saving")) {
        $("#qe-cash-saving").max = capStr;
        $("#qe-cash-saving").placeholder = "0";
        $("#qe-cash-saving").disabled = r.retiringNow;
      }
      if ($("#qe-cash-return") && fire) {
        $("#qe-cash-return").placeholder = String(
          Number(((fire.cashReturnRate ?? 0.0239) * 100).toFixed(2)),
        );
      }
      if ($("#qe-invest")) {
        $("#qe-invest").max = capStr;
        $("#qe-invest").placeholder = String(Math.ceil(simulation.invest));
        $("#qe-invest").disabled = r.retiringNow;
      }
      $$("[data-qe-step]").forEach((btn) => {
        btn.disabled = r.retiringNow;
      });

      const rawCpfExtra = ($("#known-cpf-extra")?.value || "").trim();
      $$("[data-qe-pick-cpf-extra]").forEach((chip) => {
        const pick = chip.dataset.qePickCpfExtra;
        const active =
          pick === ""
            ? rawCpfExtra === ""
            : rawCpfExtra !== "" && Math.round(Number(rawCpfExtra)) === Number(pick);
        chip.classList.toggle("is-active", active);
        chip.setAttribute("aria-pressed", String(active));
      });

      const rawCashSaving = ($("#known-cash-saving")?.value || "").trim();
      const curCashSaving = rawCashSaving === "" ? 0 : Math.round(Number(rawCashSaving) || 0);
      $$("[data-qe-pick-cash-saving]").forEach((chip) => {
        const pick = Number(chip.dataset.qePickCashSaving || 0);
        const active = curCashSaving === pick;
        chip.classList.toggle("is-active", active);
        chip.setAttribute("aria-pressed", String(active));
      });

      const rawCashRate = ($("#known-cash-return")?.value || "").trim();
      $$("[data-qe-pick-cash-rate]").forEach((chip) => {
        const pick = chip.dataset.qePickCashRate;
        const active =
          pick === ""
            ? rawCashRate === ""
            : rawCashRate !== "" && Math.abs(Number(rawCashRate) - Number(pick)) < 0.01;
        chip.classList.toggle("is-active", active);
        chip.setAttribute("aria-pressed", String(active));
      });

      const rawInvest = ($("#known-invest")?.value || "").trim();
      $$("[data-qe-pick-invest]").forEach((chip) => {
        const pick = chip.dataset.qePickInvest;
        const active =
          pick === ""
            ? rawInvest === ""
            : rawInvest !== "" && Math.round(Number(rawInvest)) === Number(pick);
        chip.classList.toggle("is-active", active);
        chip.setAttribute("aria-pressed", String(active));
      });

      const rawEqVal = $("#known-target-equity")?.value;
      const curEqPct = Math.min(100, Math.max(0, Number(rawEqVal !== undefined && rawEqVal !== "" ? rawEqVal : 80)));
      const rawSgVal = $("#known-sg-sleeve")?.value;
      const curSgPct = Math.min(100, Math.max(0, Number(rawSgVal !== undefined && rawSgVal !== "" ? rawSgVal : 15)));
      const effGlobalPct = Math.round(curEqPct * (100 - curSgPct)) / 100;
      const effSgPct = Math.round(curEqPct * curSgPct) / 100;
      if ($("#qe-target-equity-readout")) {
        $("#qe-target-equity-readout").textContent = `${curEqPct}% Equity · ${100 - curEqPct}% Bond`;
      }
      if ($("#qe-stage1-eq-bar")) {
        $("#qe-stage1-eq-bar").style.width = `${curEqPct}%`;
      }
      if ($("#qe-stage1-bond-bar")) {
        $("#qe-stage1-bond-bar").style.width = `${100 - curEqPct}%`;
      }
      if ($("#qe-target-equity-suffix")) {
        $("#qe-target-equity-suffix").textContent = `% Equity (${100 - curEqPct}% Bond)`;
      }
      if ($("#qe-stage2-badge")) {
        $("#qe-stage2-badge").textContent = `Step 2 · Inside ${curEqPct}% Equity`;
      }
      if ($("#qe-funnel-stage-2")) {
        $("#qe-funnel-stage-2").classList.toggle("is-disabled-sleeve", curEqPct === 0);
      }
      if ($("#qe-sg-sleeve-readout")) {
        $("#qe-sg-sleeve-readout").innerHTML = `${100 - curSgPct}% Global / ${curSgPct}% SG <span class="bogle-of-eq">of Eq</span>`;
      }
      if ($("#qe-sg-effective-pill")) {
        $("#qe-sg-effective-pill").textContent = `= ${effGlobalPct}% Global · ${effSgPct}% SG of total`;
      }
      if ($("#qe-sg-sleeve-suffix")) {
        $("#qe-sg-sleeve-suffix").textContent = `% SG (${100 - curSgPct}% Global)`;
      }
      $$("#quick-edit-modal [data-bogle-preset]").forEach((chip) => {
        const field = chip.dataset.boglePreset;
        const val = Number(chip.dataset.val);
        const active =
          field === "known-target-equity" ? curEqPct === val : curSgPct === val;
        chip.classList.toggle("is-active", active);
        chip.setAttribute("aria-pressed", String(active));
      });

      const cpfResetBtn = $("#qe-cpf-extra-reset");
      if (cpfResetBtn) {
        cpfResetBtn.disabled = rawCpfExtra === "";
      }
      const cashResetBtn = $("#qe-cash-saving-reset");
      if (cashResetBtn) {
        cashResetBtn.disabled = (rawCashSaving === "" || curCashSaving === 0) && rawCashRate === "";
      }
      const invResetBtn = $("#qe-invest-reset");
      if (invResetBtn) {
        invResetBtn.disabled = rawInvest === "" && curEqPct === 80 && curSgPct === 15;
      }

      const cpfSumEl = $("#qe-cpf-extra-summary");
      if (cpfSumEl && fire) {
        const sPath = simulation.selectedScenario
          ? RetirementModel.todayPlan({
              ...simulation.summary,
              scenarios: [simulation.selectedScenario],
            }).scenarios[0]
          : r.scenarios.find((sc) => sc.key === selected) || r.scenarios[0];
        const cpfExtraMo = simulation.cpfExtra || 0;
        const annualTopUp = Math.round(cpfExtraMo * 12);
        const rstuAnnual = Math.min(8000, annualTopUp);
        const rstuPct = Math.min(100, Math.round((rstuAnnual / 8000) * 100));
        cpfSumEl.innerHTML = `
          <div class="qe-rstu-head">
            <span>IRAS RSTU Tax Relief</span>
            <strong>${money(rstuAnnual)} / $8,000 (${rstuPct}%)</strong>
          </div>
          <div class="qe-split-bar qe-rstu-bar" role="progressbar" aria-valuenow="${rstuAnnual}" aria-valuemin="0" aria-valuemax="8000" aria-label="IRAS RSTU tax relief ${money(rstuAnnual)} of $8,000 annual cap">
            <span style="width:${rstuPct}%;background:var(--sem-cpf);"></span>
          </div>
          <div class="qe-rstu-scale" aria-hidden="true">
            <span>$0</span>
            <span>$4,000</span>
            <span>$8,000</span>
          </div>
          <div class="qe-split-legend">
            <span><i style="background:var(--sem-cpf);"></i><span>Max CPF tax relief is <strong>$8,000/yr</strong> ($667/mo) for cash top-ups to SA / RA (up to FRS).</span></span>
            <span><i style="background:var(--primary);"></i><span>Age-55 CPF <strong>${money(sPath.balance)}</strong> · CPF LIFE (65+) <strong>${money(sPath.payout)}/mo</strong></span></span>
          </div>`;
      }

      const cashSumEl = $("#qe-cash-saving-summary");
      if (cashSumEl && fire) {
        const hysaRateAnnual = fire.cashReturnRate ?? 0.0239;
        const hysaRatePct = Number((hysaRateAnnual * 100).toFixed(2));
        const curCash = fire.points?.[0]?.ssbCash ?? Number($("#known-ssb")?.value || 0);
        const monthsToRet = Math.max(0, Math.round((fire.retire - fire.age) * 12));
        const mRateCash = Math.pow(1 + hysaRateAnnual, 1 / 12) - 1;
        const fvCashNominal =
          mRateCash > 0
            ? curCash * Math.pow(1 + mRateCash, monthsToRet) +
              (simulation.cashSaving || 0) *
                ((Math.pow(1 + mRateCash, monthsToRet) - 1) / mRateCash)
            : curCash + (simulation.cashSaving || 0) * monthsToRet;
        const infDisc = Math.pow(1 + (r.inflation || 0.025), Math.max(0, fire.retire - fire.age));
        const projCash = Math.round(fvCashNominal / infDisc);
        cashSumEl.innerHTML = `
          <div class="qe-cash-proj-grid">
            <div class="qe-cash-proj-item">
              <span>Today's HYSA / SSB</span>
              <strong>${money(curCash)}</strong>
            </div>
            <div class="qe-cash-proj-item">
              <span>Monthly Addition</span>
              <strong>+${money(simulation.cashSaving || 0)}/mo</strong>
            </div>
            <div class="qe-cash-proj-item is-highlight">
              <span>Age ${fire.retire} Projection (${hysaRatePct}% p.a.)</span>
              <strong>${money(projCash)}</strong>
            </div>
          </div>`;
      }

      const invSumEl = $("#qe-invest-summary");
      if (invSumEl) {
        const invMo = simulation.invest || 0;
        const eqShare = Math.max(0, Math.min(100, curEqPct)) / 100;
        const sgShare = Math.max(0, Math.min(100, curSgPct)) / 100;
        const eqPool = invMo * eqShare;
        const buySg = Math.round(eqPool * sgShare);
        const buyGlobal = Math.max(0, Math.round(eqPool) - buySg);
        const buyBond = Math.max(0, Math.round(invMo) - buyGlobal - buySg);
        const glBarPct = Math.round(eqShare * (1 - sgShare) * 100);
        const sgBarPct = Math.round(eqShare * sgShare * 100);
        const bdBarPct = Math.max(0, 100 - glBarPct - sgBarPct);
        if ($("#qe-funnel-connector-text")) {
          $("#qe-funnel-connector-text").innerHTML = curEqPct > 0
            ? `Subdivides your <strong>${curEqPct}% Equity Sleeve (${money(buyGlobal + buySg)}/mo)</strong> into Global vs SG Dividend`
            : `Target Equity is <strong>0%</strong> (100% Bond) — increase Equity above 0% to activate Global / SG sleeve`;
        }
        invSumEl.innerHTML = `
          <div class="qe-rstu-head">
            <span>Final 3-Way Monthly Routing</span>
            <strong>${money(invMo)}/mo total</strong>
          </div>
          <div class="qe-split-bar" aria-hidden="true">
            <span style="width:${glBarPct}%;background:var(--primary);"></span>
            <span style="width:${sgBarPct}%;background:#38bdf8;"></span>
            <span style="width:${bdBarPct}%;background:var(--sem-cpf);"></span>
          </div>
          <div class="qe-cash-proj-grid qe-invest-route-grid">
            <div class="qe-cash-proj-item">
              <span><i class="qe-route-dot" style="background:var(--primary);"></i>Global Equity (${glBarPct}%)</span>
              <strong>${money(buyGlobal)}/mo</strong>
              <small class="qe-route-formula">${curEqPct}% Eq × ${100 - curSgPct}% Global</small>
            </div>
            <div class="qe-cash-proj-item">
              <span><i class="qe-route-dot" style="background:#38bdf8;"></i>SG Dividend (${sgBarPct}%)</span>
              <strong>${money(buySg)}/mo</strong>
              <small class="qe-route-formula">${curEqPct}% Eq × ${curSgPct}% SG</small>
            </div>
            <div class="qe-cash-proj-item">
              <span><i class="qe-route-dot" style="background:var(--sem-cpf);"></i>Bond / SSB (${bdBarPct}%)</span>
              <strong>${money(buyBond)}/mo</strong>
              <small class="qe-route-formula">Step 1 Bond floor</small>
            </div>
          </div>`;
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
          readyBtn.dataset.readyInvest = String(Math.round(simulation?.invest || 0));
          readyBtn.textContent = `Use ready age ${fn.projectedFireAge}`;
        }
      }
      const salaryTakeHomeEl = $("#qe-salary-takehome");
      if (salaryTakeHomeEl) {
        const netPct =
          r.salary > 0
            ? Math.min(100, Math.round((r.afterCpf / r.salary) * 100))
            : 80;
        const cpfPct = Math.max(0, 100 - netPct);
        salaryTakeHomeEl.innerHTML = `
          <div class="qe-split-bar" aria-hidden="true">
            <span class="qe-split-net" data-meter-key="qe-net-bar" data-meter-w="${netPct}" style="width:${netPct}%"></span>
            <span class="qe-split-cpf" data-meter-key="qe-cpf-bar" data-meter-w="${cpfPct}" style="width:${cpfPct}%"></span>
          </div>
          <div class="qe-split-legend">
            <span><i style="background:var(--primary);"></i>Take-home <strong>${m(r.afterCpf, "/mo", "qe-net-pay")}</strong> (${netPct}%)</span>
            <span><i style="background:var(--sem-cpf);"></i>Employee CPF <strong>−${m(r.employeeCpf, "/mo", "qe-emp-cpf")}</strong> (${cpfPct}%)</span>
          </div>`;
      }
      const breakdownEl = $("#qe-balances-breakdown");
      if (breakdownEl) {
        const startPt = fire.points[0];
        const cpfTot = startPt?.cpfTotal ?? 0;
        const outTot = startPt?.totalOutside ?? 0;
        const oaV = Math.max(0, Number($("#known-oa")?.value || 0));
        const saV = Math.max(0, Number($("#known-sa")?.value || 0));
        const maV = Math.max(0, Number($("#known-ma")?.value || 0));
        const saInvV = Math.max(0, Number($("#known-sa-invested")?.value || 0));
        const eqV = Math.max(0, Number($("#known-equities")?.value || 0));
        const sgV = Math.max(0, Number($("#known-sg-dividends")?.value || 0));
        const ssbV = Math.max(0, Number($("#known-ssb-cash")?.value || 0));
        const srsV = Math.max(0, Number($("#known-srs")?.value || 0));
        const bucketSum = eqV + sgV + ssbV + srsV;
        const outDetail =
          bucketSum > 0
            ? `Global ${m(eqV)} · SG ${m(sgV)} · Cash ${m(ssbV)}${srsV > 0 ? ` · SRS ${m(srsV)}` : ""}`
            : `Direct total ${m(outTot)}`;
        breakdownEl.innerHTML = `
          <div class="qe-bd-top">
            <span>Total Assets</span>
            <strong>${m(cpfTot + outTot, "", "qe-bd-total")}</strong>
          </div>
          <div class="qe-bd-rows">
            <div><span>CPF (${m(cpfTot)})</span><small>OA ${m(oaV)} · SA ${m(saV)} · MA ${m(maV)}${saInvV > 0 ? ` · CPFIS-SA ${m(saInvV)}` : ""}</small></div>
            <div><span>Outside (${m(outTot)})</span><small>${outDetail}</small></div>
          </div>`;
      }
      const activeCashInQe =
        useItemizedCashAccounts && customCashAccounts.length > 0;
      const qeSingleWrap = $("#qe-cash-single-wrap");
      if (qeSingleWrap) {
        qeSingleWrap.hidden = activeCashInQe;
      }
      const qeCashBtn = $("#qe-cash-breakdown-btn");
      if (qeCashBtn) {
        qeCashBtn.textContent = "Break down by bank & SSB accounts →";
      }
      const qeCashSlot = $("#qe-cash-accounts-slot");
      if (qeCashSlot && currentCashPlan) {
        const activeCash =
          useItemizedCashAccounts && customCashAccounts.length > 0;
        const activeEl = document.activeElement;
        const editingCashAccInQe =
          activeEl &&
          qeCashSlot.contains(activeEl) &&
          activeEl.matches?.("input[data-cash-acc-field]");
        if (editingCashAccInQe && currentCashPlan.cashBreakdown) {
          const bd = currentCashPlan.cashBreakdown;
          const summaryEl = qeCashSlot.querySelector("#cash-acc-summary-qe");
          if (summaryEl) summaryEl.innerHTML = buildCashAccountsSummaryHTML(bd);
          const alertsEl = qeCashSlot.querySelector("#cash-acc-alerts-qe");
          if (alertsEl) alertsEl.innerHTML = buildCashAccountsAlertsHTML(bd);
          bd.accounts.forEach((acc, idx) => {
            const rowEl = qeCashSlot.querySelector(
              `[data-cash-acc-row="${idx}"]`,
            );
            if (rowEl) {
              rowEl.classList.toggle("is-overflow", Boolean(acc.hasOverflow));
            }
            const readoutEl = qeCashSlot.querySelector(
              `[data-cash-acc-readout="${idx}"]`,
            );
            if (readoutEl) {
              readoutEl.innerHTML = buildCashAccountReadoutHTML(acc);
            }
          });
        } else {
          qeCashSlot.innerHTML = activeCash
            ? buildCashAccountsEditorHTML(currentCashPlan, "qe")
            : "";
        }
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
        qeSummary.textContent = `${funded} · ${horizon}`;
      }
    }
  }

  const qePanelMeta = {
    age: { title: "Date of Birth & Age", focus: "#qe-dob" },
    goal: { title: "Target Retirement Age", focus: "#qe-retire" },
    salary: { title: "Monthly Salary & Take-Home", focus: "#qe-salary" },
    "cpf-extra": { title: "Extra CPF Saving", focus: "#qe-cpf-extra" },
    "cash-saving": {
      title: "Monthly Planned Savings (HYSA / SSB)",
      focus: "#qe-cash-saving",
    },
    invest: {
      title: "Monthly Planned Investment (Outside Investment)",
      focus: "#qe-invest",
    },
    income: { title: "CPF OA Housing Loan", focus: "#qe-housing-mode" },
    balances: { title: "CPF & Investment Balances", focus: "#qe-oa" },
  };

  function setQuickEditPanel(
    panelKey,
    focusInput = false,
    focusOverride = null,
  ) {
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
      const focusSel = focusOverride || qePanelMeta[activeQeTab].focus;
      requestAnimationFrame(() => $(focusSel)?.focus());
    }
  }

  if (qeDialog) {
    document.addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-quick-edit]");
      if (!trigger) return;
      event.preventDefault();
      if (trigger.dataset.quickEdit === "budget") {
        openExpenseModal("auto", trigger);
        return;
      }
      lastQeInvoker = trigger;
      syncQuickEditState(null, currentFirePlan, null);
      setQuickEditPanel(
        trigger.dataset.quickEdit || "goal",
        true,
        trigger.dataset.qeFocus || null,
      );
      const scroller = qeDialog.querySelector(".settings-scroll-body");
      if (scroller) scroller.scrollTop = 0;
      if (!qeDialog.open) qeDialog.showModal();
      render();
    });

    bindDialogBackdropDismiss(qeDialog);
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
        if (qeDialog.dataset.investAutoLocked === "true") {
          delete qeDialog.dataset.investAutoLocked;
          if ($("#known-invest")) $("#known-invest").value = "";
          if ($("#qe-invest")) $("#qe-invest").value = "";
          if ($("#sim-invest")) $("#sim-invest").value = "";
        }
        $("#known-retire").value = String(next);
        if ($("#qe-retire")) $("#qe-retire").value = String(next);
        render();
        return;
      }
      const pickAgeBtn = event.target.closest("[data-qe-pick-age]");
      if (pickAgeBtn) {
        const minRetire = getMinRetireAge();
        const next = Math.min(
          80,
          Math.max(minRetire, Number(pickAgeBtn.dataset.qePickAge || 65)),
        );
        if (qeDialog.dataset.investAutoLocked === "true") {
          delete qeDialog.dataset.investAutoLocked;
          if ($("#known-invest")) $("#known-invest").value = "";
          if ($("#qe-invest")) $("#qe-invest").value = "";
          if ($("#sim-invest")) $("#sim-invest").value = "";
        }
        $("#known-retire").value = String(next);
        if ($("#qe-retire")) $("#qe-retire").value = String(next);
        render();
        return;
      }
      const salDeltaBtn = event.target.closest("[data-qe-salary-delta]");
      if (salDeltaBtn) {
        const curSal = Number($("#person-salary")?.value || 5500);
        const nextSal = Math.min(
          1000000,
          Math.max(
            751,
            Math.round(curSal + Number(salDeltaBtn.dataset.qeSalaryDelta)),
          ),
        );
        $("#person-salary").value = String(nextSal);
        if ($("#qe-salary")) $("#qe-salary").value = String(nextSal);
        render();
        return;
      }
      const pickSalBtn = event.target.closest("[data-qe-pick-salary]");
      if (pickSalBtn) {
        const nextSal = Math.min(
          1000000,
          Math.max(751, Number(pickSalBtn.dataset.qePickSalary || 5500)),
        );
        $("#person-salary").value = String(nextSal);
        if ($("#qe-salary")) $("#qe-salary").value = String(nextSal);
        render();
        return;
      }
      if (event.target.closest("#qe-use-ready-age")) {
        const readyBtn = $("#qe-use-ready-age");
        const age = readyBtn?.dataset.readyAge;
        const readyInvest = readyBtn?.dataset.readyInvest;
        if (age) {
          if (
            readyInvest &&
            Number(readyInvest) > 0 &&
            (($("#known-invest")?.value || "").trim() === "" ||
              qeDialog.dataset.investAutoLocked === "true")
          ) {
            qeDialog.dataset.investAutoLocked = "true";
            $("#known-invest").value = readyInvest;
            if ($("#qe-invest")) $("#qe-invest").value = readyInvest;
            if ($("#sim-invest")) $("#sim-invest").value = readyInvest;
          }
          $("#known-retire").value = age;
          if ($("#qe-retire")) $("#qe-retire").value = age;
          render();
        }
        return;
      }

      const stepBtn = event.target.closest("[data-qe-step]");
      if (stepBtn) {
        const qeId = stepBtn.dataset.qeStep;
        const qeEl = $("#" + qeId);
        const srcId =
          qeId === "qe-invest"
            ? "known-invest"
            : qeId === "qe-cash-saving"
              ? "known-cash-saving"
              : "known-cpf-extra";
        const srcEl = $("#" + srcId);
        const otherQes = [
          $("#qe-cpf-extra"),
          $("#qe-cash-saving"),
          $("#qe-invest"),
        ].filter((el) => el && el.id !== qeId);
        if (qeEl && srcEl) {
          const otherVal = otherQes.reduce(
            (sum, el) =>
              sum +
              (el.value.trim() !== "" ? Math.max(0, Number(el.value) || 0) : 0),
            0,
          );
          const maxAllowed = Math.max(0, currentAfterCpfCap - otherVal);
          const base =
            qeEl.value.trim() === ""
              ? Number(qeEl.placeholder || 0)
              : Number(qeEl.value || 0);
          const next = Math.min(
            maxAllowed,
            Math.max(
              0,
              Math.round((base + Number(stepBtn.dataset.delta || 0)) * 100) /
                100,
            ),
          );
          qeEl.value = String(next);
          srcEl.value = String(next);
          render();
        }
        return;
      }
      const pickCpfBtn = event.target.closest("[data-qe-pick-cpf-extra]");
      if (pickCpfBtn) {
        const raw = pickCpfBtn.dataset.qePickCpfExtra;
        const val =
          raw === ""
            ? ""
            : String(Math.min(currentAfterCpfCap, Math.max(0, Number(raw) || 0)));
        if ($("#known-cpf-extra")) $("#known-cpf-extra").value = val;
        if ($("#qe-cpf-extra")) $("#qe-cpf-extra").value = val;
        render();
        return;
      }
      const pickCashBtn = event.target.closest("[data-qe-pick-cash-saving]");
      if (pickCashBtn) {
        const raw = pickCashBtn.dataset.qePickCashSaving;
        const val = String(
          Math.min(currentAfterCpfCap, Math.max(0, Number(raw) || 0)),
        );
        if ($("#known-cash-saving")) $("#known-cash-saving").value = val;
        if ($("#sim-cash-saving")) $("#sim-cash-saving").value = val;
        if ($("#qe-cash-saving")) $("#qe-cash-saving").value = val;
        render();
        return;
      }
      const pickCashRateBtn = event.target.closest("[data-qe-pick-cash-rate]");
      if (pickCashRateBtn) {
        const val = pickCashRateBtn.dataset.qePickCashRate || "";
        if ($("#known-cash-return")) $("#known-cash-return").value = val;
        if ($("#qe-cash-return")) $("#qe-cash-return").value = val;
        render();
        return;
      }
      const cashRateDeltaBtn = event.target.closest("[data-qe-cash-rate-delta]");
      if (cashRateDeltaBtn) {
        const qeEl = $("#qe-cash-return");
        const srcEl = $("#known-cash-return");
        if (qeEl && srcEl) {
          const base =
            qeEl.value.trim() === ""
              ? Number(qeEl.placeholder || 2.39)
              : Number(qeEl.value || 0);
          const next = Math.min(
            15,
            Math.max(
              0,
              Math.round((base + Number(cashRateDeltaBtn.dataset.qeCashRateDelta || 0)) * 100) / 100,
            ),
          );
          qeEl.value = String(next);
          srcEl.value = String(next);
          render();
        }
        return;
      }
      const pickInvestBtn = event.target.closest("[data-qe-pick-invest]");
      if (pickInvestBtn) {
        const raw = pickInvestBtn.dataset.qePickInvest;
        const val =
          raw === ""
            ? ""
            : String(Math.min(currentAfterCpfCap, Math.max(0, Number(raw) || 0)));
        if ($("#known-invest")) $("#known-invest").value = val;
        if ($("#sim-invest")) $("#sim-invest").value = val;
        if ($("#qe-invest")) $("#qe-invest").value = val;
        render();
        return;
      }
      const boglePresetBtn = event.target.closest("[data-bogle-preset]");
      if (boglePresetBtn) {
        const field = boglePresetBtn.dataset.boglePreset;
        const val = String(Number(boglePresetBtn.dataset.val || 0));
        if ($("#" + field)) $("#" + field).value = val;
        if (field === "known-target-equity" && $("#qe-target-equity")) {
          $("#qe-target-equity").value = val;
        }
        if (field === "known-sg-sleeve" && $("#qe-sg-sleeve")) {
          $("#qe-sg-sleeve").value = val;
        }
        render();
        return;
      }
      const bogleStepBtn = event.target.closest("[data-bogle-step]");
      if (bogleStepBtn) {
        const field = bogleStepBtn.dataset.bogleStep;
        const delta = Number(bogleStepBtn.dataset.delta || 0);
        if (field === "known-target-equity") {
          const rawCur = $("#known-target-equity")?.value; const cur = Number(rawCur !== undefined && rawCur !== "" ? rawCur : 80);
          const next = Math.min(100, Math.max(0, cur + delta));
          if ($("#known-target-equity")) $("#known-target-equity").value = String(next);
          if ($("#qe-target-equity")) $("#qe-target-equity").value = String(next);
          render();
        } else if (field === "known-sg-sleeve") {
          const rawCur = $("#known-sg-sleeve")?.value; const cur = Number(rawCur !== undefined && rawCur !== "" ? rawCur : 15);
          const next = Math.min(100, Math.max(0, cur + delta));
          if ($("#known-sg-sleeve")) $("#known-sg-sleeve").value = String(next);
          if ($("#qe-sg-sleeve")) $("#qe-sg-sleeve").value = String(next);
          render();
        }
        return;
      }
      if (event.target.closest("#qe-cpf-extra-reset")) {
        if ($("#known-cpf-extra")) $("#known-cpf-extra").value = "";
        if ($("#qe-cpf-extra")) $("#qe-cpf-extra").value = "";
        render();
        showToast("Extra CPF saving reset to path suggestion");
        return;
      }
      if (event.target.closest("#qe-cash-saving-reset")) {
        if ($("#known-cash-saving")) $("#known-cash-saving").value = "";
        if ($("#sim-cash-saving")) $("#sim-cash-saving").value = "";
        if ($("#known-cash-return")) $("#known-cash-return").value = "";
        if ($("#qe-cash-saving")) $("#qe-cash-saving").value = "";
        if ($("#qe-cash-return")) $("#qe-cash-return").value = "";
        render();
        showToast("Monthly planned savings & HYSA rate reset to default");
        return;
      }
      if (event.target.closest("#qe-invest-reset")) {
        const defEq = String(SG_DEFAULT_PLAN.targetEquityPct ?? 80);
        const defSg = String(SG_DEFAULT_PLAN.sgSleevePct ?? 15);
        if ($("#known-invest")) $("#known-invest").value = "";
        if ($("#sim-invest")) $("#sim-invest").value = "";
        if ($("#qe-invest")) $("#qe-invest").value = "";
        if ($("#known-target-equity")) $("#known-target-equity").value = defEq;
        if ($("#qe-target-equity")) $("#qe-target-equity").value = defEq;
        if ($("#bogle-target-slider")) $("#bogle-target-slider").value = defEq;
        if ($("#known-sg-sleeve")) $("#known-sg-sleeve").value = defSg;
        if ($("#qe-sg-sleeve")) $("#qe-sg-sleeve").value = defSg;
        if ($("#bogle-sg-slider")) $("#bogle-sg-slider").value = defSg;
        render();
        showToast("Outside investment & split reset to default");
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
      }
    });

    qeBindings.forEach(([qeId, srcId]) => {
      const qeEl = $("#" + qeId);
      const srcEl = $("#" + srcId);
      if (!qeEl || !srcEl) return;
      const syncBack = () => {
        if (qeId === "qe-dob" && qeEl.validity.badInput) {
          return;
        }
        if (
          qeId === "qe-invest" ||
          qeId === "qe-cash-saving" ||
          qeId === "qe-cpf-extra"
        ) {
          const otherQes = [
            $("#qe-cpf-extra"),
            $("#qe-cash-saving"),
            $("#qe-invest"),
          ].filter((el) => el && el.id !== qeId);
          const capped = clampSavingToTakeHome(qeEl, otherQes);
          const hintEl = $(
            qeId === "qe-invest"
              ? "#qe-invest-hint"
              : qeId === "qe-cash-saving"
                ? "#qe-cash-saving-hint"
                : "#qe-cpf-extra-hint",
          );
          if (hintEl) {
            hintEl.textContent =
              capped !== false
                ? `Capped at ${money(capped)}/mo (within your ${money(currentAfterCpfCap)}/mo take-home pay).`
                : qeId === "qe-invest"
                  ? "Leave blank for suggested saving target."
                  : qeId === "qe-cash-saving"
                    ? "Stays in cash / SSB. Separate from outside investments."
                    : "Leave blank for target path suggestion.";
            hintEl.classList.toggle("is-capped", capped !== false);
          }
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
          if (dobInfo.valid && dobInfo.age >= 18 && dobInfo.age <= 54) {
            const minR = getMinRetireAge();
            const retEl = $("#known-retire");
            const curR = Number(retEl?.value);
            if (
              retEl &&
              retEl.value.trim() !== "" &&
              (!Number.isFinite(curR) || curR < minR || curR > 80)
            ) {
              const clampedR = String(
                Math.min(
                  80,
                  Math.max(minR, Number.isFinite(curR) ? Math.round(curR) : 65),
                ),
              );
              retEl.value = clampedR;
              if ($("#qe-retire")) $("#qe-retire").value = clampedR;
            }
          }
        }
        if (srcId === "known-ssb-cash") {
          useItemizedCashAccounts = false;
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
      let corrected = false;
      const minRetire = getMinRetireAge();
      for (const [qeId, srcId] of qeBindings) {
        if (qeId === "qe-housing-mode" || qeId === "qe-housing-parties")
          continue;
        const qeEl = $("#" + qeId);
        const srcEl = $("#" + srcId);
        if (!qeEl || !srcEl) continue;
        const raw = srcEl.value.trim();
        if (srcId === "person-dob") {
          const dobInfo = RetirementModel.computeAgeFromDob(raw);
          if (
            srcEl.validity.badInput ||
            !dobInfo.valid ||
            dobInfo.age < 18 ||
            dobInfo.age > 54
          ) {
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
  bindDialogBackdropDismiss(dialog);
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
  const TABS = [
    "overview",
    "trajectory",
    "allocator",
    "cash-parking",
    "dividend-calc",
    "tax",
    "cpf-rules",
  ];
  const TAB_LABELS = {
    overview: "Overview",
    trajectory: "Trajectory",
    allocator: "Allocator",
    "cash-parking": "Cash Parking",
    "dividend-calc": "Dividend & Yield",
    tax: "Tax Relief",
    "cpf-rules": "CPF Milestones",
  };
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
    $("#known-spend").dispatchEvent(new Event("input", { bubbles: true }));
    $("#known-spend").focus({ preventScroll: true });
  });
  lifestyle?.addEventListener("change", (event) => {
    if (!event.isTrusted) return;
    $("#known-spend").value = "";
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
    const returnLabel = TAB_LABELS[activeTab] || "Overview";
    if ($("#settings-breadcrumb-back")) {
      $("#settings-breadcrumb-back").textContent = returnLabel;
    }
    if ($("#settings-header-back")) {
      $("#settings-header-back").textContent = `← Back to ${returnLabel}`;
    }
    if ($("#settings-footer-done")) {
      $("#settings-footer-done").textContent =
        `Done — Return to ${returnLabel}`;
    }

    window.dispatchEvent(
      new CustomEvent("rs:tabchange", {
        detail: { tab: activeTab, profileOpen },
      }),
    );

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
    if ($("#expense-modal")?.open) {
      $("#expense-modal").dataset.flowNavigation = "true";
      $("#expense-modal").close();
    }
    const nextTab = TABS.includes(tab) ? tab : "overview";
    const viewChanged =
      nextTab !== activeTab || Boolean(profile) !== profileOpen;
    activeTab = nextTab;
    profileOpen = profile;
    applyViewState(focus, true);
    if (
      viewChanged &&
      !window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
    ) {
      const targetPanel = profileOpen
        ? $("#top")
        : $(`#tab-panel-${activeTab}`);
      if (targetPanel) {
        targetPanel.classList.remove("is-tab-entering");
        void targetPanel.offsetWidth;
        targetPanel.classList.add("is-tab-entering");
      }
    }
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
    navigateTo({ tab: activeTab, profile: false });
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
    if (
      [
        "retirement-plan",
        "tab-panel-overview",
        "retirement-budget",
        "expense-breakdown-card",
        "retirement-taps-card",
      ].includes(id)
    ) {
      profileOpen = false;
      activeTab = "overview";
      applyViewState(false, false);
      const targetId =
        id === "retirement-budget" ? "expense-breakdown-card" : id;
      const targetEl = $("#" + targetId);
      if (targetEl && id !== "retirement-plan" && id !== "tab-panel-overview") {
        requestAnimationFrame(() => targetEl.scrollIntoView());
      }
      return;
    }
    if (["cash-parking", "tab-panel-cash-parking"].includes(id)) {
      profileOpen = false;
      activeTab = "cash-parking";
      applyViewState(false, false);
      return;
    }
    if (
      [
        "dividend-calc",
        "tab-panel-dividend-calc",
        "dividend-calculator-card",
      ].includes(id)
    ) {
      profileOpen = false;
      activeTab = "dividend-calc";
      applyViewState(false, false);
      return;
    }
    if (
      [
        "savings-simulator",
        "trajectory-section",
        "tab-panel-trajectory",
      ].includes(id)
    ) {
      profileOpen = false;
      activeTab = "trajectory";
      applyViewState(false, false);
      const targetEl = $("#" + id);
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
  const supportsCssAnchor =
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    CSS.supports("position-area", "block-end");
  $$(".field").forEach((field) => {
    const label = field.querySelector(
      ":scope > label, :scope > .dob-label-row > label, :scope > .toggle-label-row > label",
    );
    const help = field.querySelector(":scope > small");
    const input = label && document.getElementById(label.htmlFor);
    if (!input || !help) return;
    const panel = document.createElement("div");
    panel.id = `${input.id}-more-info`;
    panel.className = "field-help-panel";
    panel.append(help);
    const title = label.textContent.replace(/\s+/g, " ").trim();
    const inHeaderRow = Boolean(
      label.parentElement?.matches(".dob-label-row, .toggle-label-row"),
    );
    const row = document.createElement("div");
    row.className = inHeaderRow ? "field-label is-inline" : "field-label";
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
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 10.5v6M12 7v1"/></svg>';
      panel.setAttribute("popover", "auto");
      panel.setAttribute("role", "tooltip");
      panel.addEventListener("toggle", (event) => {
        const isOpen = event.newState === "open";
        button.setAttribute("aria-expanded", String(isOpen));
        if (isOpen && !supportsCssAnchor) {
          const rect = button.getBoundingClientRect();
          const pW = Math.min(340, window.innerWidth - 24);
          const left = Math.max(
            12,
            Math.min(window.innerWidth - pW - 12, rect.left - 8),
          );
          const top = Math.min(window.innerHeight - 140, rect.bottom + 8);
          panel.style.position = "fixed";
          panel.style.margin = "0";
          panel.style.left = `${Math.round(left)}px`;
          panel.style.top = `${Math.round(top)}px`;
        }
      });
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
      if (event.target.closest(".brand")) closeHelp();
    });
    $("#plan-settings").addEventListener("close", closeHelp);
    window.addEventListener("popstate", closeHelp);
  }
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

setupServiceWorkerUpdates();

setupSimplePlan();
setupSettings();
setupDeepLinks();
setupGuidedFlow();
setupFieldHelp();
