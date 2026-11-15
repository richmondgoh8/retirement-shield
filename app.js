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
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
  if (v >= 1000) return `$${Math.round(v / 1000)}k`;
  return `$${v}`;
};
const svgCompactMoney = (value) => {
  const v = Math.round(Math.max(0, value) || 0);
  const body =
    v >= 1000000
      ? `${(v / 1000000).toFixed(1).replace(/\.0$/, "")}M`
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

function populateAgeSelect(select, minimum, defaultAge) {
  if (!select || select.dataset.minimum === String(minimum)) return;
  const previous = Number(select.value);
  select.replaceChildren(
    ...Array.from({ length: 66 - minimum }, (_, i) => {
      const age = minimum + i;
      return new Option(String(age), String(age), age === defaultAge);
    }),
  );
  select.value = String(
    Math.min(65, Math.max(minimum, previous || defaultAge)),
  );
  select.dataset.minimum = String(minimum);
}

function setupCareBreakdown() {
  const range = (values) =>
    `$${Math.round(values[0]).toLocaleString("en-SG")}–${Math.round(values[1]).toLocaleString("en-SG")}`;
  const laterToday = (values) =>
    values.map((value) => RetirementModel.todayValue(value, 75, 65));
  const laterRange = range(laterToday(RetirementModel.careTotals("later")));
  $("#care-later-range").textContent = laterRange;
  $("#care-later-total").textContent = laterRange;
  $("#care-concession-range").textContent = range(
    laterToday(RetirementModel.careTotals("later").map((value) => value - 240)),
  );
  $("#care-health-midpoint").textContent =
    `Healthcare midpoint: $325 → ${money(RetirementModel.todayValue(675, 75, 65))} in today’s dollars.`;
  $("#care-cost-rows").innerHTML = RetirementModel.careRows
    .map(
      (row) =>
        `<li class="care-cost-row"><h4>${row.name}</h4><div><small>Age 65 · today</small><strong>${range(row.now)}</strong></div><div><small>Age 75 · today’s value</small><strong>${range(laterToday(row.later))}</strong></div><p>${row.note}</p></li>`,
    )
    .join("");
}

function syncPresetChoice() {
  const selected = $("#known-lifestyle").value;
  $$("input[name='lifestyle-choice']").forEach(
    (input) => (input.checked = input.value === selected),
  );
  const amount = RetirementModel.lifestyles[selected].budget;
  const custom = $("#known-spend");
  const hasCustom = custom.value !== "" && custom.validity.valid;
  const effectiveSpend = hasCustom ? Math.max(0, Number(custom.value)) : amount;
  $("#preset-context").textContent =
    selected === "cca"
      ? "CCA assumes moving in at retirement, from age 55."
      : "Assumes a paid-up flat. Rent and mortgage need separate funding.";
  $("#budget-choice-status").hidden = !hasCustom;
  $("#budget-choice-status").textContent = hasCustom
    ? `Using your custom budget: ${money(effectiveSpend)}/month.`
    : "";
  const reset = $("#use-preset-budget");
  reset.hidden = !hasCustom || effectiveSpend === amount;
  reset.textContent = `Reset to ${money(amount)} preset budget`;

  const barNode = $("#preset-budget-bar");
  if (barNode) {
    const breakdown = RetirementModel.budgetBreakdown(selected, effectiveSpend);
    barNode.innerHTML = `<div class="budget-stack" aria-hidden="true">${breakdown.groups
      .map(
        (group) =>
          `<span class="budget-segment budget-${group.key}" style="width:${breakdown.total ? (group.amount / breakdown.total) * 100 : 0}%"></span>`,
      )
      .join("")}</div><div class="preset-bar-labels">${breakdown.groups
      .map(
        (group) =>
          `<span><i class="budget-dot budget-${group.key}" aria-hidden="true"></i>${group.label} <b>${money(group.amount)}</b></span>`,
      )
      .join("")}</div>`;
  }
}

function renderLifestyle(r) {
  const cca = r.lifestyle === "cca";
  const defaultBudget = RetirementModel.lifestyles[r.lifestyle].budget;
  $("#budget-title").textContent = cca
    ? "Your CCA living budget"
    : "Your Home + Helper budget";
  $("#budget-summary-title").textContent =
    `How your ${cca ? "CCA" : "Home + Helper"} budget breaks down (${money(r.spend65)} → ${money(r.spend75)}/mo)`;
  $("#budget-intro").textContent = cca
    ? "A planning allowance for one person, including basic services and extra help. Apartment purchase and move-in costs need separate funding."
    : "One person, a paid-up 2-room flat and one live-in helper. Your custom budget scales the personalised calculation.";
  $("#cca-budget").hidden = !cca;
  $("#helper-budget").hidden = cca;
  $("#known-spend").placeholder = String(defaultBudget);
  $("#budget-default-note").textContent =
    `Blank uses ${money(defaultBudget)}, including healthcare and ${cca ? "extra help" : "a live-in helper"}.`;
  if ($("#lifestyle-assumptions")) {
    $("#lifestyle-assumptions").textContent = cca
      ? "CCA starts at $2,500/mo ($3,340 at 75 in today’s prices as care provisions grow). Apartment lease, service deposit and move-in setup stay excluded; no subsidies assumed."
      : "Home + Helper starts at $3,500/mo (above the $3,090 midpoint), keeping the $300 nominal levy fixed while scaling late-life care after 65. Flat purchase/mortgage excluded.";
  }
  const scale = r.todaySpend / 2500;
  $("#cca-now-total").textContent = money(r.todaySpend);
  $("#cca-later-total").textContent = money(3340 * scale);
  $("#cca-cost-rows").innerHTML = RetirementModel.ccaRows
    .map(
      (row) =>
        `<li class="care-cost-row"><h4>${row.name}</h4><div><small>Age 65 · today’s value</small><strong>${money(row.now * scale)}</strong></div><div><small>Age 75 · today’s value</small><strong>${money(row.later * scale)}</strong></div></li>`,
    )
    .join("");
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
    H = 300,
    padL = 74,
    padR = 26,
    padT = 32,
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
      ${summary.retire < 65 ? `<line x1="${retireX}" y1="${padT}" x2="${retireX}" y2="${H - padB}" stroke="#D97706" stroke-width="1.6" stroke-dasharray="4,3" /><text x="${retireX}" y="${padT - 10}" text-anchor="${markerAnchor(retireX)}" font-size="11.5" font-weight="600" fill="#D97706">Retire ${summary.retire}</text>` : ""}
      <line x1="${age65X}" y1="${padT}" x2="${age65X}" y2="${H - padB}" stroke="#059669" stroke-width="1.6" stroke-dasharray="4,3" />
      <text x="${age65X}" y="${closeTogether && summary.retire < 65 ? padT + 14 : padT - 10}" text-anchor="${markerAnchor(age65X)}" font-size="11.5" font-weight="600" fill="#059669">CPF LIFE 65</text>`;
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
      <text x="${retireX}" y="${padT - 10}" text-anchor="${markerAnchor(retireX)}" font-size="11.5" font-weight="600" fill="#D97706">Retire ${summary.retire}</text>
      <circle cx="${dX(peakPt.age)}" cy="${dY(peakPt.portfolioBalance)}" r="3.5" fill="#2563EB" />
      <text x="${dX(peakPt.age)}" y="${Math.max(padT + 12, dY(peakPt.portfolioBalance) - 10)}" text-anchor="${markerAnchor(dX(peakPt.age))}" font-size="11.5" font-weight="700" fill="#2563EB">Peak ${svgCompactMoney(peakPt.portfolioBalance)}</text>`;
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
    const tooltipLeft =
      svgRect.left + (svgX / W) * svgRect.width - wrapRect.left;
    const tooltipTop =
      svgRect.top - wrapRect.top + (padT / H) * svgRect.height - 8;
    tooltipEl.hidden = false;
    tooltipEl.style.left = `${tooltipLeft}px`;
    tooltipEl.style.top = `${tooltipTop}px`;
    tooltipEl.style.transform =
      tooltipLeft < 115
        ? "translate(0%, -100%)"
        : tooltipLeft > wrapRect.width - 115
          ? "translate(-100%, -100%)"
          : "translate(-50%, -100%)";
    tooltipEl.innerHTML = `
      <div class="tt-head">Age ${pt.age} (${pt.year}) · ${pt.phase.toUpperCase()}</div>
      <div class="tt-row"><span>Spend</span><b>${m(pt.monthlySpend, "/mo")}</b></div>
      <div class="tt-row"><span>CPF LIFE</span><b class="sem-cpf">${m(pt.monthlyCPF, "/mo")}</b></div>
      ${pt.monthlyGap > 0 ? `<div class="tt-row"><span>Outside gap</span><b class="sem-eq">${m(pt.monthlyGap, "/mo")}</b></div>` : ""}
      <div class="tt-row"><span>Portfolio</span><b>${m(pt.portfolioBalance)}</b></div>`;
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

function renderDrawdownSummary(r, drawdown) {
  const container = $("#dynamic-drawdown-summary");
  if (!container) return;
  const { gap, cashReserve, ssbLadder, equityCore } = drawdown;
  const totalPot = cashReserve + ssbLadder + equityCore;
  const pct = (val) => (totalPot > 0 ? (val / totalPot) * 100 : 0);
  container.innerHTML = `
    ${
      totalPot > 0
        ? `<figure class="drawdown-bar-figure">
            <div class="drawdown-bar-track" aria-hidden="true">
              <span class="drawdown-seg seg-cash" style="width:${pct(cashReserve)}%"></span>
              <span class="drawdown-seg seg-ssb" style="width:${pct(ssbLadder)}%"></span>
              <span class="drawdown-seg seg-core" style="width:${pct(equityCore)}%"></span>
            </div>
            <figcaption class="drawdown-bar-legend">
              <span><i class="swatch seg-cash"></i>Years 1–2 Cash (${Math.round(pct(cashReserve))}%)</span>
              <span><i class="swatch seg-ssb"></i>Years 3–7 SSB/Bonds (${Math.round(pct(ssbLadder))}%)</span>
              <span><i class="swatch seg-core"></i>Years 8+ Growth Core (${Math.round(pct(equityCore))}%)</span>
            </figcaption>
          </figure>`
        : ""
    }
    <div class="drawdown-metrics-grid">
      <div class="drawdown-metric">
        <span>Bucket 1 · Liquid cash (Yrs 1–2)</span>
        <strong>${m(cashReserve)}</strong>
        <small>24 months of the retirement-start gap (${m(gap, "/mo")}) in instant-access HYSA deposits.</small>
      </div>
      <div class="drawdown-metric">
        <span>Bucket 2 · SSB / T-Bill ladder (Yrs 3–7)</span>
        <strong>${m(ssbLadder)}</strong>
        <small>Five-year sovereign reserve in today’s dollars, respecting the $200,000 SSB cap.</small>
      </div>
      <div class="drawdown-metric">
        <span>Bucket 3 · Long-term core (Yrs 8+)</span>
        <strong>${m(equityCore)}</strong>
        <small>Diversified global portfolio kept invested for later decades and care inflation.</small>
      </div>
    </div>
    <p class="result-footnote">Illustrative bucket split of your funded portfolio at age ${r.retire} (today’s dollars), not personal financial advice.</p>`;

  const stepCopy = {
    "#drawdown-step1-desc": `Your modelled post-CPF gap at age ${r.retire} is ${money(gap)}/mo in today’s dollars. Let CPF LIFE cover predictable baseline bills while protecting liquid cash for emergencies and healthcare.`,
    "#drawdown-step2-desc": `Keep ~${money(cashReserve)} (up to 24 months of withdrawals) in one SDIC-insured bank account ($100k cap per bank) with automated monthly transfers to your spending account.`,
    "#drawdown-step3-desc": `Hold ~${money(ssbLadder)} in Singapore Savings Bonds and T-Bills matched to upcoming years. Submit SSB redemptions a month ahead (paid 2nd business day of next month).`,
    "#drawdown-step4-desc": `Consolidate scattered brokerage/SRS accounts before later life. Rebalance once a year and refill your cash bucket after positive equity years rather than selling during market drawdowns.`,
  };
  for (const [selector, text] of Object.entries(stepCopy)) {
    const el = $(selector);
    if (el) el.textContent = text;
  }
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
      color: "#E0533C",
      softBg: "#FCEEEB",
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
      tag: `Ages 75 → ${pt95?.age ?? 95}`,
      title: fire.fireNumber.fullyFundedTo95
        ? "Age 95+ Runway"
        : `Funded to ${fire.depletionAge ?? 90}`,
      metric: m(pt95?.today?.totalNetWorth ?? 0),
      pill: fire.fireNumber.fullyFundedTo95 ? "Sustained" : "Watch Gap",
      sub: `Age-75 spend ${money(pt75?.today?.monthlySpend ?? r.spend75)}/mo · CPF ${money(s.payout)}/mo`,
      color: fire.fireNumber.fullyFundedTo95 ? "#7C3AED" : "#DC2626",
      softBg: fire.fireNumber.fullyFundedTo95 ? "#F5F3FF" : "#FEF2F2",
    },
  ];
}

function buildConcentricRingsSVG(rings, centerPct, centerSub, size = 176) {
  const cx = size / 2;
  const cy = size / 2;
  const radii = [
    Math.round(size * 0.415),
    Math.round(size * 0.305),
    Math.round(size * 0.195),
  ];
  const strokeW = size >= 160 ? 11 : 9;
  const arcs = rings
    .slice(0, 3)
    .map((ring, idx) => {
      const r = radii[idx];
      const circ = 2 * Math.PI * r;
      const pct = Math.max(0, Math.min(100, ring.pct || 0));
      const dash = (pct / 100) * circ;
      return `
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--border)" stroke-width="${strokeW}" />
        ${pct > 0 ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${ring.color}" stroke-width="${strokeW}" stroke-linecap="round" stroke-dasharray="${dash.toFixed(2)} ${circ.toFixed(2)}" transform="rotate(-90 ${cx} ${cy})" />` : ""}
      `;
    })
    .join("");
  return `<div class="ember-rings-wrap" style="--ring-size:${size}px;">
    <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="ember-rings-svg" aria-hidden="true">
      ${arcs}
    </svg>
    <div class="ember-rings-center">
      <strong>${centerPct}%</strong>
      <span>${centerSub}</span>
    </div>
  </div>`;
}

let cachedPrintExtras = null;

function renderPrintSheet(
  r,
  s,
  drawdown,
  simulationForPrint,
  readinessPending,
  readinessAge,
  extras = null,
) {
  const printContainer = $("#print-sheet");
  if (!printContainer) return;
  if (extras) cachedPrintExtras = extras;
  const ctx = extras || cachedPrintExtras || {};
  const fire = ctx.fire;
  const bogle = ctx.bogle;
  const tax = ctx.tax;
  const guide = ctx.guide;
  const { cashReserve, ssbLadder, equityCore } = drawdown;

  const fn = fire?.fireNumber;
  const pctFunded = fn ? Math.min(150, Math.max(0, fn.pctFunded)) : 100;
  const onTrack = fn ? pctFunded >= 100 && fn.fullyFundedTo95 : true;
  const nearTrack = fn ? pctFunded >= 80 && !onTrack : false;
  const statusText = onTrack
    ? "On Track"
    : nearTrack
      ? "Within Reach"
      : "Shortfall";
  const projFireText =
    fn?.projectedFireAge != null
      ? `Age ${fn.projectedFireAge}`
      : readinessPending
        ? "Calculating"
        : ageLabel(readinessAge);

  const outsideNeed = fn?.totalRequiredToday ?? s.privateTarget;
  const cpfAt65 = fire?.phase2?.projectedCpfAt65Today ?? s.balance;
  const totalAt65 =
    fire?.points?.find((pt) => pt.age === 65)?.today?.totalNetWorth ??
    outsideNeed + cpfAt65;
  const cpfCovPct = Math.min(
    100,
    Math.round(
      ((fire?.phase2?.cpfLife65Today ?? s.payout) / Math.max(1, r.spend65)) *
        100,
    ),
  );
  const builtTodayPct = Math.min(100, Math.max(0, fn?.currentFirePct ?? 0));

  const ringItems = [
    {
      label: `Plan Funded (${r.retire})`,
      pct: Math.min(100, pctFunded),
      val: `${pctFunded}%`,
      color: onTrack ? "#059669" : "#E0533C",
    },
    {
      label: "CPF LIFE vs Spend",
      pct: cpfCovPct,
      val: `${cpfCovPct}%`,
      color: "#0D9488",
    },
    {
      label: "Built Today",
      pct: builtTodayPct,
      val: `${builtTodayPct}%`,
      color: "#7C3AED",
    },
  ];

  const grossPlusEmp = Math.max(1, r.salary + r.employerCpf);
  const totalCpfMo = r.employeeCpf + r.employerCpf;
  const investPool = Math.round(bogle?.monthlyRebalance?.investPool || 0);
  const ssbMo = Math.round(bogle?.monthlyRebalance?.buyBondMonthly || 0);
  const eqMo = Math.round(
    (bogle?.monthlyRebalance?.buyGlobalMonthly || 0) +
      (bogle?.monthlyRebalance?.buySgMonthly || 0),
  );
  const extraTaxMo = Math.round(
    (guide?.cpfExtra || 0) + Math.max(0, Number(ctx.p?.srsAnnual || 0)) / 12,
  );
  const livingMo = Math.max(
    0,
    r.afterCpf - investPool - (guide?.cpfExtra || 0),
  );

  const pipeRows = [
    { label: "Living & IRAS Tax", amt: livingMo, color: "#64748B" },
    { label: "Mandatory CPF", amt: totalCpfMo, color: "#059669" },
    { label: "Global Equities", amt: eqMo, color: "#2563EB" },
    { label: "SSB / T-Bills", amt: ssbMo, color: "#D97706" },
    { label: "RSTU / SRS", amt: extraTaxMo, color: "#7C3AED" },
  ];

  const milestones = fire
    ? getMilestoneNodes(fire, r, s, simulationForPrint)
    : [];

  const monthlySave =
    (simulationForPrint?.cpfExtra || 0) + (simulationForPrint?.invest || 0);
  const pctOfPay =
    r.afterCpf > 0 ? Math.round((monthlySave / r.afterCpf) * 100) : 0;

  printContainer.innerHTML = `
    <div class="poster-sheet">
      <header class="poster-masthead">
        <div class="poster-brand-row">
          <div class="poster-title-block">
            <span class="poster-kicker">RETIREMENT SHIELD · SINGAPORE BLUEPRINT</span>
            <h1>Retirement Readiness &amp; CPF Overview</h1>
            <div class="poster-chips">
              <span>Age ${r.age} → ${r.retire}</span>
              <span>Gross ${money(r.salary)}/mo</span>
              <span>${r.lifestyleLabel}</span>
              <span>CPF LIFE ${r.plan === "escalating" ? "Escalating" : "Standard"}</span>
            </div>
          </div>
          <div class="poster-verdict-badge is-${onTrack ? "good" : nearTrack ? "warn" : "danger"}">
            <small>PLAN STATUS</small>
            <strong>${pctFunded}% · ${statusText}</strong>
            <span>Ready ${projFireText}</span>
          </div>
        </div>
      </header>

      <section class="poster-kpi-strips">
        <div class="poster-stat-strip" style="--strip-accent:#E0533C;">
          <small>Earliest Readiness</small>
          <div><strong>${projFireText}</strong><span class="poster-pill">${fn?.fullyFundedTo95 ? "Age 95+" : `To ${fire?.depletionAge ?? 90}`}</span></div>
        </div>
        <div class="poster-stat-strip" style="--strip-accent:#0D9488;">
          <small>Age-65 CPF Floor</small>
          <div><strong>${money(s.payout)}/mo</strong><span class="poster-pill">${cpfCovPct}% bills</span></div>
        </div>
        <div class="poster-stat-strip" style="--strip-accent:#059669;">
          <small>Monthly Saving Target</small>
          <div><strong>${money(monthlySave)}/mo</strong><span class="poster-pill">${pctOfPay}% pay</span></div>
        </div>
        <div class="poster-stat-strip" style="--strip-accent:#7C3AED;">
          <small>Projected at 65</small>
          <div><strong>${compactMoney(totalAt65)}</strong><span class="poster-pill">${money(r.spend65)}/mo</span></div>
        </div>
      </section>

      <section class="poster-charts-row">
        <div class="poster-chart-card">
          <h3>Net Worth Projection (Age ${fire?.age ?? r.age}–${fire?.endAge ?? 95})</h3>
          <div id="print-nw-chart" class="poster-chart-svg"></div>
          <div id="print-nw-legend" class="poster-chart-legend"></div>
        </div>
        <div class="poster-chart-card">
          <h3>Monthly Cashflow Waterfall (Ages 50–85)</h3>
          <div id="print-wf-chart" class="poster-chart-svg"></div>
          <div id="print-wf-legend" class="poster-chart-legend"></div>
        </div>
      </section>

      <section class="poster-bento-row">
        <div class="poster-panel poster-rings-panel">
          <h3>Readiness Breakdown</h3>
          <div class="poster-rings-inner">
            ${buildConcentricRingsSVG(ringItems, pctFunded, "FUNDED", 118)}
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
          <h3>Paycheck Allocation (${money(grossPlusEmp)}/mo)</h3>
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
        </div>

        ${
          milestones.length
            ? `<div class="poster-panel">
                <h3>Road to 95 Checkpoints</h3>
                <div class="poster-feed-list">
                  ${milestones
                    .map(
                      (mn) => `<div class="poster-feed-row">
                        <span class="poster-feed-avatar" style="background:${mn.softBg};color:${mn.color};">${mn.badge}</span>
                        <div class="poster-feed-copy">
                          <strong>${mn.title}</strong>
                          <small>${mn.tag}</small>
                        </div>
                        <div class="poster-feed-right">
                          <b>${mn.metric}</b>
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
          <h3>5-Tier Allocation Order</h3>
          <ul class="poster-tiers">
            <li><span>1 · HYSA Buffer</span><b>${money(guide?.emergencyMin ?? cashReserve)}–${money(guide?.emergencyMax ?? cashReserve)}</b></li>
            <li><span>2 · SSB / T-Bills</span><b>${money(ssbLadder)} ladder</b></li>
            <li><span>3 · CPF RSTU &amp; SRS</span><b>${tax?.combinedTaxSaved ? `Saves ${money(tax.combinedTaxSaved)}/yr` : "Check bracket"}</b></li>
            <li><span>4 · Global UCITS ETF</span><b>${money(equityCore)} core</b></li>
            <li><span>5 · CPF LIFE ERS Floor</span><b>${money(r.ers)} max sum</b></li>
          </ul>
        </div>

        <div class="poster-panel">
          <h3>CPF Strategy Comparison Ledger</h3>
          <table class="poster-mini-table">
            <thead><tr><th>Strategy</th><th>Age-55 CPF</th><th>65+ Payout</th><th>Save Outside</th></tr></thead>
            <tbody>
              ${r.scenarios
                .map(
                  (sc) => `<tr class="${sc.key === s.key ? "is-active" : ""}">
                    <td>${sc.key === "salary" ? "Salary CPF" : sc.key.toUpperCase()}${sc.key === s.key ? " · Active" : ""}</td>
                    <td>${money(sc.balance)}</td>
                    <td>${money(sc.payout)}/mo</td>
                    <td>${money(sc.privateSaving)}${r.retiringNow ? "" : "/mo"}</td>
                  </tr>`,
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </section>

      <footer class="poster-colophon">
        <span><sup>1</sup> Today’s purchasing power (${Number((r.inflation * 100).toFixed(1))}% inflation, ${Math.round(r.investmentReturn * 100)}% net return, ${r.post55Work ? "post-55 CPF included" : "post-55 CPF excluded"}). <sup>2</sup> 2026 SG Rules (FRS $220.4k, ERS $440.8k, BHS $79k, OW cap $8k).</span>
        <span>100% Local Calculation · Educational planning illustration only</span>
      </footer>
    </div>`;

  if (fire) {
    renderStackedNetWorthSVG(
      $("#print-nw-chart", printContainer),
      null,
      $("#print-nw-legend", printContainer),
      fire,
      ctx.basis || "today",
    );
    renderCashflowWaterfallSVG(
      $("#print-wf-chart", printContainer),
      null,
      $("#print-wf-legend", printContainer),
      fire,
      ctx.basis || "today",
    );
  }
}

function buildOutsideAvenuesSection(r, s, p, simulation) {
  const guide = RetirementModel.outsideAllocationGuide(
    simulation.summary,
    simulation,
  );
  const totalAfterCpf = Math.max(1, guide.afterCpf);
  const taxW = Math.min(100, (guide.tax.monthlyTax / totalAfterCpf) * 100);
  const cpfW = Math.min(100 - taxW, (guide.cpfExtra / totalAfterCpf) * 100);
  const outW = Math.min(
    100 - taxW - cpfW,
    (guide.outsideMonthly / totalAfterCpf) * 100,
  );
  const liveW = Math.max(0, 100 - taxW - cpfW - outW);

  const marginalPct = `${(guide.tax.marginalRate * 100).toFixed(1).replace(/\.0$/, "")}%`;
  const stateIcon =
    guide.state.tone === "good" ? ICONS.checkTiny : ICONS.warnTiny;

  const stretchCallout =
    guide.state.key === "stretched" || guide.state.key === "critical"
      ? `<div class="stretch-callout">
          <div>
            <strong>Why is the target ${guide.pctAfterCpf}% of your pay after CPF?</strong>
            <p>${
              p.oa == null && p.sa == null && Number(p.savings || 0) === 0
                ? "Your plan currently assumes $0 CPF balances and $0 existing investments, so it tries to build the entire retirement pot from future salary alone."
                : "Funding this retirement age and lifestyle from current pay alone leaves tight monthly cashflow."
            } Most Singapore households sustain <strong>20–30% of net take-home (${m(guide.sustainableMin)}–${m(guide.sustainableMax, "/mo")})</strong>.</p>
          </div>
          <div class="stretch-actions">
            <button type="button" class="text-button" data-go-tab="trajectory">Test a ${m(guide.allocPool, "/mo")} budget in Trajectory →</button>
          </div>
        </div>`
      : "";

  const tiers = [
    {
      rank: "Tier 1 · Foundation",
      semColor: "#D97706",
      name: "High-Yield Savings Accounts (HYSA)",
      examples: "UOB One, OCBC 360, DBS Multiplier, MariBank / GXS",
      state: "Instant · T+0",
      roi: "~2.0%–3.5% p.a.",
      taxRule: "SDIC $100k / bank",
      targetHead: `${m(guide.emergencyMin)}–${m(guide.emergencyMax)}`,
      targetSub: "6–12 mo cash buffer",
      gotchas: [
        "Bonus interest requires salary credit + card-spend hoops; banks cut promo tiers without notice.",
        "SDIC deposit insurance caps at $100,000 per bank per depositor—holding excess cash above 12 months loses to inflation.",
      ],
    },
    {
      rank: "Tier 2 · Safe Sovereign",
      semColor: "#D97706",
      name: "Singapore Savings Bonds (SSB), 6M/1Y T-Bills & MMFs",
      examples: "MAS SSB, SGS T-Bills, Fullerton SGD Cash / Mari Invest",
      state: "T+1 mo / 6M lock",
      roi: "~2.5%–3.2% p.a.",
      taxRule: "$200k SSB cap",
      targetHead: r.retiringNow
        ? "Up to $200k"
        : `${m(guide.split.safeMonthly, "/mo")}`,
      targetSub: r.retiringNow
        ? "SSB cap (Cash + SRS)"
        : "Safe reserve allocation",
      gotchas: [
        "SSB ($500 multiples, $200k cap across Cash + SRS) locks 10-yr step-up rates but redeems on the 2nd business day of next month—not instant cash.",
        "T-Bills lock cash to maturity and face reinvestment-rate risk when rates fall; money market funds (T+1/T+2) are NOT SDIC-insured.",
      ],
    },
    {
      rank: "Tier 3 · Tax Relief",
      semColor: "#7C3AED",
      name: "CPF Cash Top-Up (RSTU to FRS) & SRS Wrapper",
      examples: "CPF SA/RA top-up, SRS → Endowus / SSB / local ETFs",
      state: "Locked to 63–65",
      roi: "4.0% CPF + tax save",
      taxRule: "$80k total relief cap",
      targetHead: guide.taxWorthIt
        ? `${m(guide.split.srsMonthly, "/mo")}`
        : `${marginalPct} bracket`,
      targetSub: guide.taxWorthIt
        ? `SRS (saves ${m(guide.srsTaxSaved, "/yr")}) · RSTU ${m(guide.rstuTaxSaved, "/yr")}`
        : "Low tax — prioritize Tier 2 & 4",
      gotchas: [
        "Uninvested SRS cash earns just 0.05% p.a. and cannot directly buy US/UCITS ETFs; early withdrawal triggers a 5% penalty + 100% income tax (50% taxable over 10 yrs from statutory retirement age, up to $40k/yr tax-free if no other income).",
        "CPF RSTU ($8k/yr self + $8k family relief, within $80k total relief cap) is irreversible and gives $0 tax relief once SA/RA reaches FRS.",
      ],
    },
    {
      rank: "Tier 4 · Core Growth",
      semColor: "#2563EB",
      name: "Broad Low-Cost Global Equity ETFs",
      examples: "Ireland UCITS global index ETFs (VWRA / FWRA / ISAC)",
      state: "Liquid T+2 · volatile",
      roi: "~5.0%–7.0% p.a.",
      taxRule: "15% div tax · 0% cap gain",
      targetHead: r.retiringNow
        ? "Yrs 8+ growth"
        : `${m(guide.split.coreMonthly, "/mo")}`,
      targetSub: r.retiringNow
        ? "Long-horizon sleeve"
        : `Core DCA (${guide.horizon}-yr horizon)`,
      gotchas: [
        "Expect 20–40% temporary market drawdowns—never invest money needed within 5 years (sequence-of-returns risk near retirement).",
        "US-domiciled ETFs (VOO/VT) charge non-US investors 30% dividend withholding + US estate tax >US$60k; Ireland-domiciled UCITS ETFs halve US dividend tax to 15% with 0% Singapore capital-gains tax.",
      ],
    },
    {
      rank: "Tier 5 · Lifetime Floor",
      semColor: "#059669",
      name: "CPF LIFE ERS & Lifetime Annuities",
      examples:
        "CPF LIFE Standard / Escalating · Commercial annuities above ERS",
      state: "Lifelong payout",
      roi: "~3.5%–4.2% CPF",
      taxRule: "Sovereign longevity floor",
      targetHead: `${m(r.ers)}`,
      targetSub: "Optional ERS lifetime floor",
      gotchas: [
        "CPF LIFE provides sovereign-backed lifetime payouts, true longevity pooling, and zero advisory commissions.",
        "Consider commercial insurer annuities only after maxing ERS, as private plans often combine lower guaranteed payouts with discretionary bonuses and multi-year surrender charges.",
      ],
    },
  ];

  return `<section class="outside-section card-surface" id="outside-avenues" aria-labelledby="outside-title">
    <div id="srs-notes" aria-hidden="true"></div>
    <div class="outside-head">
      <div>
        <span class="hero-kicker">5-TIER ALLOCATION PRIORITY</span>
        <h2 id="outside-title">Where to put money outside CPF</h2>
        <p>Fund in priority order: lock in liquid safety first, capture worthwhile tax relief, then compound long-term growth.</p>
      </div>
      <div class="outside-badges">
        <span class="tax-pill">Est. IRAS marginal tax: <b>${marginalPct}</b> (~${m(guide.tax.monthlyTax, "/mo")})</span>
      </div>
    </div>

    <div class="takehome-panel">
      <div class="takehome-top">
        <div>
          <h3>Monthly pay after employee CPF: <strong>${m(guide.afterCpf, "/mo")}</strong></h3>
          <p class="takehome-sub">${
            r.retiringNow
              ? "Retirement is set to now — future monthly salary allocation is paused."
              : guide.usingBenchmark
                ? `Showing a sustainable <b>25% after-tax benchmark (${m(guide.allocPool, "/mo")})</b> alongside your ${m(guide.totalSaving, "/mo")} full-funding target.`
                : `Allocates <b>${m(guide.cpfExtra, "/mo")}</b> extra CPF and <b>${m(guide.outsideMonthly, "/mo")}</b> outside CPF (${guide.pctNet}% of ${m(guide.netTakeHome)} after-tax pay).`
          }</p>
        </div>
        <span class="status-pill is-${guide.state.tone}">${stateIcon}<span>${guide.state.label}</span></span>
      </div>
      ${
        r.retiringNow
          ? ""
          : `<div class="takehome-bar" role="img" aria-label="Breakdown of monthly pay after CPF: tax ${money(guide.tax.monthlyTax)}, extra CPF ${money(guide.cpfExtra)}, outside investments ${money(guide.outsideMonthly)}, remaining living cash ${money(Math.max(0, guide.leftForLiving))}">
              ${taxW > 0.5 ? `<span class="th-seg th-tax" style="width:${taxW}%"></span>` : ""}
              ${cpfW > 0.5 ? `<span class="th-seg th-cpf" style="width:${cpfW}%"></span>` : ""}
              ${outW > 0.5 ? `<span class="th-seg th-out" style="width:${outW}%"></span>` : ""}
              ${liveW > 0.5 ? `<span class="th-seg th-live" style="width:${liveW}%"></span>` : ""}
            </div>
            <div class="takehome-legend">
              <span><i class="swatch th-tax"></i>Est. Tax <b>${m(guide.tax.monthlyTax)}</b></span>
              <span><i class="swatch th-cpf"></i>Extra CPF <b>${m(guide.cpfExtra)}</b></span>
              <span><i class="swatch th-out"></i>Outside Invest <b>${m(guide.outsideMonthly)}</b></span>
              <span><i class="swatch th-live"></i>Living &amp; Bills <b>${guide.leftForLiving < 0 ? `−${m(-guide.leftForLiving)}` : m(guide.leftForLiving)}</b></span>
            </div>`
      }
      ${stretchCallout}
      ${
        r.retiringNow
          ? ""
          : `<div class="split-strip" role="group" aria-label="Suggested monthly outside-CPF split">
              <div class="split-strip-label">
                <strong>${guide.usingBenchmark ? `Suggested ${m(guide.allocPool, "/mo")} sustainable outside split` : `Suggested split for ${m(guide.allocPool, "/mo")} outside savings`}</strong>
                <small>Once Tier 1 buffer (${m(guide.emergencyMin)}–${m(guide.emergencyMax)}) is full · ${guide.horizon} yrs to retirement</small>
              </div>
              <div class="split-pills">
                <span><i class="sem-dot" style="background:#D97706;"></i><b>${m(guide.split.safeMonthly, "/mo")}</b> SSB / T-Bills</span>
                <span><i class="sem-dot" style="background:#7C3AED;"></i><b>${m(guide.split.srsMonthly, "/mo")}</b> SRS / Tax</span>
                <span><i class="sem-dot" style="background:#2563EB;"></i><b>${m(guide.split.coreMonthly, "/mo")}</b> Global UCITS</span>
              </div>
            </div>`
      }
    </div>

    <ol class="tier-list" aria-label="Outside-CPF investment priority tier list">
      ${tiers
        .map(
          (t) => `<li class="tier-card" style="--tier-color:${t.semColor};">
            <div class="tier-card-head">
              <div class="tier-title-group">
                <div>
                  <span class="tier-rank">${t.rank}</span>
                  <h3>${t.name}</h3>
                  <small class="tier-examples">${t.examples}</small>
                </div>
              </div>
              <div class="tier-target-box">
                <strong>${t.targetHead}</strong>
                <span>${t.targetSub}</span>
              </div>
            </div>
            <dl class="tier-facts-grid">
              <div><dt>Liquidity</dt><dd>${t.state}</dd></div>
              <div><dt>Est. Return</dt><dd>${t.roi}</dd></div>
              <div><dt>Rule / Tax</dt><dd>${t.taxRule}</dd></div>
            </dl>
            <details class="tier-rules">
              <summary>Key rules &amp; caveats (${t.gotchas.length})</summary>
              <ul class="tier-gotchas">
                ${t.gotchas.map((g) => `<li>${g}</li>`).join("")}
              </ul>
            </details>
          </li>`,
        )
        .join("")}
    </ol>
  </section>`;
}

function buildCoverageSection(r, s) {
  const maxSpend = Math.max(1, r.spend65, r.spend75);
  const rows = [
    {
      label: "Age 65",
      spend: r.spend65,
      cpf: s.payout,
      gap: s.gap65,
    },
    {
      label: "Age 75 (with higher care provision)",
      spend: r.spend75,
      cpf: s.payout75,
      gap: s.gap75,
    },
  ];
  return `<section class="coverage-card card-surface" aria-labelledby="coverage-title">
    <div class="coverage-head">
      <div>
        <span class="hero-kicker">RETIREMENT BILL COVERAGE</span>
        <h2 id="coverage-title">How monthly bills are covered at 65 vs 75</h2>
        <p>Today’s purchasing power · CPF LIFE (${r.plan === "escalating" ? "Escalating +2%/yr" : "Standard level cash"}) vs outside portfolio withdrawal.</p>
      </div>
      <div class="coverage-legend">
        <span><i class="swatch cov-cpf"></i>CPF LIFE</span>
        <span><i class="swatch cov-gap"></i>Outside portfolio needed</span>
      </div>
    </div>
    <div class="coverage-bars">
      ${rows
        .map((row) => {
          const coveredCpf = Math.min(row.spend, row.cpf);
          const cpfPct = (coveredCpf / maxSpend) * 100;
          const gapPct = (row.gap / maxSpend) * 100;
          const share =
            row.spend > 0 ? Math.round((coveredCpf / row.spend) * 100) : 100;
          return `<div class="coverage-row">
            <div class="coverage-row-top">
              <strong>${row.label}: ${m(row.spend, "/mo")}</strong>
              <span>CPF covers <b>${m(row.cpf, "/mo")}</b> (${share}%) · Outside gap <b>${m(row.gap, "/mo")}</b></span>
            </div>
            <div class="coverage-track" aria-hidden="true">
              <span class="cov-seg cov-cpf" style="width:${cpfPct}%"></span>
              <span class="cov-seg cov-gap" style="width:${gapPct}%"></span>
            </div>
          </div>`;
        })
        .join("")}
    </div>
  </section>`;
}

function renderStackedNetWorthSVG(
  chartArea,
  tooltipEl,
  legendEl,
  fire,
  basis = "today",
) {
  if (!chartArea || !fire?.points?.length) return;
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
  const W = 860,
    H = 296,
    padL = 74,
    padR = 32,
    padT = 46,
    padB = 40;
  const plotW = W - padL - padR,
    plotH = H - padT - padB;
  const minAge = pts[0].age,
    maxAge = pts[pts.length - 1].age;
  const dX = (age) =>
    padL + ((age - minAge) / Math.max(1, maxAge - minAge)) * plotW;
  const rawMax = Math.max(10000, ...pts.map((p) => p.total));
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

  const eqArea = areaPath(
    (p) => p.total,
    (p) => p.cpf + p.srs + p.ssb,
  );
  const ssbArea = areaPath(
    (p) => p.cpf + p.srs + p.ssb,
    (p) => p.cpf + p.srs,
  );
  const srsArea = areaPath(
    (p) => p.cpf + p.srs,
    (p) => p.cpf,
  );
  const cpfArea = areaPath(
    (p) => p.cpf,
    () => 0,
  );

  const rawMilestones = [
    {
      age: fire.retire,
      label: `Retire ${fire.retire}`,
      color: "#2563EB",
    },
    { age: 55, label: "55 SA Closure", color: "#059669" },
    {
      age: fire.srsWithdrawalAge,
      label: `${fire.srsWithdrawalAge} SRS`,
      color: "#7C3AED",
    },
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

  let lastRow0X = -999;
  let lastRow1X = -999;
  const milestoneSVG = milestones
    .map((mItem) => {
      const x = dX(mItem.age);
      let row = 0;
      if (x - lastRow0X < 92) {
        row = x - lastRow1X < 92 ? 2 : 1;
      }
      if (row === 0) lastRow0X = x;
      else if (row === 1) lastRow1X = x;
      const labelY = row === 0 ? padT - 20 : row === 1 ? padT - 5 : padT + 10;
      const anchor =
        x < padL + 44 ? "start" : x > W - padR - 44 ? "end" : "middle";
      return `<line x1="${x}" y1="${padT}" x2="${x}" y2="${H - padB}" stroke="${mItem.color}" stroke-width="1.5" stroke-dasharray="4,3" stroke-opacity="0.7" />
        <text x="${x}" y="${labelY}" text-anchor="${anchor}" font-size="11" font-weight="700" fill="${mItem.color}">${mItem.label}</text>`;
    })
    .join("");

  // Direct data labels for key milestones & end net worth
  const calloutAges = [fire.retire, 65, maxAge].filter(
    (a, idx, arr) => arr.indexOf(a) === idx && a >= minAge + 2 && a <= maxAge,
  );
  const calloutsSVG = calloutAges
    .map((ageTarget) => {
      const pt = pts.find((p) => p.age === ageTarget);
      if (!pt || pt.total <= 0) return "";
      const x = dX(pt.age);
      const y = Math.max(padT + 14, dY(pt.total) - 10);
      const anchor = x > W - padR - 48 ? "end" : "middle";
      return `<circle cx="${x}" cy="${dY(pt.total)}" r="3.5" fill="var(--ink)" stroke="var(--surface)" stroke-width="1.5" />
        <text x="${x}" y="${y}" text-anchor="${anchor}" font-size="11" font-weight="700" fill="var(--ink)">${svgCompactMoney(pt.total)}</text>`;
    })
    .join("");

  chartArea.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid meet">
      ${yTicks}${xTicks}
      <path d="${cpfArea}" fill="#059669" fill-opacity="0.82" />
      <path d="${srsArea}" fill="#7C3AED" fill-opacity="0.78" />
      <path d="${ssbArea}" fill="#D97706" fill-opacity="0.78" />
      <path d="${eqArea}" fill="#2563EB" fill-opacity="0.82" />
      ${milestoneSVG}
      ${calloutsSVG}
      <line class="nw-scrub-line" x1="0" y1="${padT}" x2="0" y2="${H - padB}" stroke="var(--ink)" stroke-width="1.5" stroke-dasharray="3,3" style="display:none;" />
    </svg>`;

  if (legendEl) {
    legendEl.innerHTML = `
      <span class="legend-item"><i class="legend-swatch" style="background:#2563EB;"></i> Global &amp; SG Equities</span>
      <span class="legend-item"><i class="legend-swatch" style="background:#D97706;"></i> SSB / T-Bills / Cash</span>
      <span class="legend-item"><i class="legend-swatch" style="background:#7C3AED;"></i> SRS</span>
      <span class="legend-item"><i class="legend-swatch" style="background:#059669;"></i> CPF (OA + SA/RA + MA)</span>`;
  }

  const wrap = chartArea.parentElement;
  const scrub = chartArea.querySelector(".nw-scrub-line");
  if (!wrap || !tooltipEl || !scrub) return;
  const onMove = (e) => {
    const svg = chartArea.querySelector("svg");
    if (!svg) return;
    const svgRect = svg.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const left = svgRect.left + (padL / W) * svgRect.width;
    const width = (plotW / W) * svgRect.width;
    const frac = Math.max(0, Math.min(1, (cx - left) / width));
    const targetAge = Math.round(minAge + frac * (maxAge - minAge));
    const pt = pts.find((p) => p.age === targetAge) || pts[0];
    const sx = dX(pt.age);
    scrub.setAttribute("x1", sx);
    scrub.setAttribute("x2", sx);
    scrub.style.display = "block";
    const tLeft = svgRect.left + (sx / W) * svgRect.width - wrapRect.left;
    const tTop = svgRect.top - wrapRect.top + (padT / H) * svgRect.height - 6;
    tooltipEl.hidden = false;
    tooltipEl.style.left = `${tLeft}px`;
    tooltipEl.style.top = `${tTop}px`;
    tooltipEl.style.transform =
      tLeft < 115
        ? "translate(0%, -100%)"
        : tLeft > wrapRect.width - 115
          ? "translate(-100%, -100%)"
          : "translate(-50%, -100%)";
    tooltipEl.innerHTML = `
      <div class="tt-head">Age ${pt.age} (${pt.year})</div>
      <div class="tt-row"><span>Total Net Worth</span><b>${m(pt.total)}</b></div>
      <div class="tt-row"><span>Equities</span><b class="sem-eq">${m(pt.eq)}</b></div>
      <div class="tt-row"><span>SSB / Cash</span><b class="sem-cash">${m(pt.ssb)}</b></div>
      <div class="tt-row"><span>SRS</span><b class="sem-srs">${m(pt.srs)}</b></div>
      <div class="tt-row"><span>CPF</span><b class="sem-cpf">${m(pt.cpf)}</b></div>`;
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

function renderCashflowWaterfallSVG(
  chartArea,
  tooltipEl,
  legendEl,
  fire,
  basis = "today",
) {
  if (!chartArea || !fire?.points?.length) return;
  const startAge = Math.max(fire.age, Math.min(50, fire.retire));
  const endAge = Math.min(85, fire.endAge);
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
  const W = 760,
    H = 304,
    padL = 74,
    padR = 26,
    padT = 32,
    padB = 40;
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

  const idx65 = pts.findIndex((p) => p.age === 65);
  const idxSrs = pts.findIndex((p) => p.age === fire.srsWithdrawalAge);
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
      const my =
        j === 1 && idxSrs >= 0 && Math.abs(idx65 - idxSrs) <= 2
          ? padT + 14
          : padT - 10;
      return `<line x1="${mx}" y1="${padT}" x2="${mx}" y2="${H - padB}" stroke="${mk.color}" stroke-width="1.4" stroke-dasharray="3,3" stroke-opacity="0.7" />
        <text x="${mx}" y="${my}" text-anchor="middle" font-size="11" font-weight="700" fill="${mk.color}">${mk.label}</text>`;
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
      <span class="legend-item"><i class="legend-swatch" style="background:#7C3AED;"></i> SRS 10-Yr Drawdown (${fire.srsWithdrawalAge}+)</span>
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
    const tLeft = svgRect.left + (sx / W) * svgRect.width - wrapRect.left;
    const tTop = svgRect.top - wrapRect.top + (padT / H) * svgRect.height - 6;
    tooltipEl.hidden = false;
    tooltipEl.style.left = `${tLeft}px`;
    tooltipEl.style.top = `${tTop}px`;
    tooltipEl.style.transform =
      tLeft < 115
        ? "translate(0%, -100%)"
        : tLeft > wrapRect.width - 115
          ? "translate(-100%, -100%)"
          : "translate(-50%, -100%)";
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

function buildOverviewPageHeader(fire, r, s) {
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
  const pathName =
    s.key === "salary"
      ? "Salary CPF"
      : s.key === "frs"
        ? "FRS Path"
        : "ERS Path";

  return `<header class="ember-page-header" aria-labelledby="fire-hero-title">
    <div class="ember-header-main">
      <h1 id="fire-hero-title" tabindex="-1">Retirement Readiness Overview</h1>
      <p>Age ${fire.age} → ${fire.retire} · ${r.lifestyleLabel} <span style="white-space:nowrap">(${money(r.futureSpend)}/mo target)</span> · ${pathName}, CPF LIFE ${r.plan === "escalating" ? "Escalating" : "Standard"}.</p>
    </div>
    <div class="ember-header-meta">
      <span class="status-pill ${statusClass}">${statusIcon}<span>${statusBadgeText}</span></span>
      <button type="button" class="button button-small mobile-balances-btn" data-open-profile>My Settings</button>
    </div>
  </header>`;
}

function buildEmberKpiStrip(fire, r, s, simulation, pctOfPay) {
  const fn = fire.fireNumber;
  const contribution = simulation.cpfExtra + s.privateSaving;
  const projFireAge = fn.projectedFireAge;
  const readyText = projFireAge == null ? "After 80" : `Age ${projFireAge}`;
  const diffYears = projFireAge == null ? null : fire.retire - projFireAge;
  const readyPill =
    diffYears == null
      ? "Raise saving"
      : diffYears > 0
        ? `+${diffYears} yr${diffYears > 1 ? "s" : ""} early`
        : diffYears === 0
          ? `On target ${fire.retire}`
          : `${-diffYears} yr${-diffYears > 1 ? "s" : ""} past`;

  const cpfCov65Pct = Math.min(
    100,
    Math.round((s.payout / Math.max(1, r.spend65)) * 100),
  );
  const ptAtRetire =
    fire.points.find((pt) => pt.age === fire.retire) ||
    fire.points[fire.points.length - 1];
  const retireNw = ptAtRetire?.today?.totalNetWorth ?? 0;

  return `<section class="ember-kpi-strip" aria-label="Key retirement metrics">
    <article class="ember-stat-card" style="--stat-accent:#E0533C;">
      <span class="ember-stat-label">Earliest Readiness Age</span>
      <div class="ember-stat-row">
        <strong>${readyText}</strong>
        <span class="ember-stat-pill">${readyPill}</span>
      </div>
      <small>Target ${fire.retire} · ${fn.fullyFundedTo95 ? "Sustained to 95+" : `Funded to ${fire.depletionAge ?? 90}`}</small>
    </article>

    <article class="ember-stat-card" style="--stat-accent:#0D9488;">
      <span class="ember-stat-label">Monthly Income Covered (65+)</span>
      <div class="ember-stat-row">
        <strong>${m(s.payout, "/mo")}</strong>
        <span class="ember-stat-pill">${cpfCov65Pct}% by CPF</span>
      </div>
      <small>Target spend ${m(r.spend65, "/mo")} · ${m(s.gap65, "/mo")} outside</small>
    </article>

    <article class="ember-stat-card" style="--stat-accent:#059669;">
      <span class="ember-stat-label">Monthly Saving Needed</span>
      <div class="ember-stat-row">
        <strong>${r.retiringNow ? m(s.privateSaving, " now") : m(contribution, "/mo")}</strong>
        <span class="ember-stat-pill">${r.retiringNow ? "Lump sum" : `${pctOfPay}% of pay`}</span>
      </div>
      <small>${r.retiringNow ? "Immediate portfolio requirement" : `${m(simulation.cpfExtra)} extra CPF + ${m(s.privateSaving)} outside`}</small>
    </article>

    <article class="ember-stat-card" style="--stat-accent:#7C3AED;">
      <span class="ember-stat-label">Projected Net Worth at ${fire.retire}</span>
      <div class="ember-stat-row">
        <strong>${compactMoney(retireNw)}</strong>
        <span class="ember-stat-pill">${fn.pctFunded}% goal</span>
      </div>
      <small>${m(fn.totalRequiredToday)} outside + ${m(fire.phase2.projectedCpfAt65Today)} CPF at 65</small>
    </article>
  </section>`;
}

function buildEmberHeroTrajectorySection(fire) {
  return `<section class="ember-hero-chart-card card-surface" aria-labelledby="ember-traj-title">
    <div class="ember-card-head">
      <div>
        <h2 id="ember-traj-title">Net Worth &amp; CPF Projection (Age ${fire.age}–${fire.endAge})</h2>
        <p>Equities, SSB/Cash, SRS, and CPF balances in today’s purchasing power with SA closure at 55 and CPF LIFE at 65.</p>
      </div>
      <button type="button" class="button button-small" data-go-tab="trajectory">Stress Test &amp; Cashflow →</button>
    </div>
    <div class="chart-wrapper">
      <div id="dash-networth-chart" class="chart-area" role="img" aria-label="Stacked net worth trajectory from age ${fire.age} to ${fire.endAge}"></div>
      <div id="dash-networth-tooltip" class="chart-tooltip" hidden></div>
    </div>
    <div class="chart-legend" id="dash-networth-legend"></div>
  </section>`;
}

function buildEmberBentoRow(
  fire,
  r,
  s,
  p,
  simulation,
  bogle,
  simGuide,
  tax,
  pctOfPay,
) {
  const fn = fire.fireNumber;
  const pct = Math.min(150, Math.max(0, fn.pctFunded));
  const onTrack = pct >= 100 && fn.fullyFundedTo95;
  const cpfCoveragePct = Math.min(
    100,
    Math.round((fire.phase2.cpfLife65Today / Math.max(1, r.spend65)) * 100),
  );
  const builtTodayPct = Math.min(100, Math.max(0, fn.currentFirePct));

  const ringsData = [
    {
      label: `Overall Funding at ${fire.retire}`,
      pct: Math.min(100, pct),
      text: `${pct}%`,
      color: onTrack ? "#059669" : "#E0533C",
    },
    {
      label: "CPF LIFE Core (65+ Bills)",
      pct: cpfCoveragePct,
      text: `${cpfCoveragePct}%`,
      color: "#0D9488",
    },
    {
      label: "Nest Egg Built Today",
      pct: builtTodayPct,
      text: `${builtTodayPct}%`,
      color: "#7C3AED",
    },
  ];

  const altPathKey =
    s.key === "salary" ? "frs" : s.key === "frs" ? "ers" : "salary";
  const altPathLabel =
    altPathKey === "salary"
      ? "Compare Salary CPF"
      : altPathKey === "frs"
        ? "Boost to FRS"
        : "Max to ERS";

  const grossPlusEmployer = Math.max(1, r.salary + r.employerCpf);
  const totalCpf = r.employeeCpf + r.employerCpf;
  const srsMonthly = Math.round(Math.max(0, Number(p?.srsAnnual || 0)) / 12);
  const rstuSrsPlanned = Math.round((simGuide.cpfExtra || 0) + srsMonthly);
  const investPool = Math.round(bogle.monthlyRebalance.investPool || 0);
  const emergencySsb = Math.round(bogle.monthlyRebalance.buyBondMonthly || 0);
  const globalEtf = Math.round(
    (bogle.monthlyRebalance.buyGlobalMonthly || 0) +
      (bogle.monthlyRebalance.buySgMonthly || 0),
  );
  const livingAndTax = Math.max(
    0,
    r.afterCpf - investPool - (simGuide.cpfExtra || 0),
  );

  const paycheckBars = [
    { label: "Living & IRAS Tax", amt: livingAndTax, color: "#64748B" },
    { label: "Mandatory CPF", amt: totalCpf, color: "#059669" },
    { label: "Global Equities (+SG)", amt: globalEtf, color: "#2563EB" },
    { label: "SSB / T-Bills", amt: emergencySsb, color: "#D97706" },
    { label: "Extra CPF / SRS", amt: rstuSrsPlanned, color: "#7C3AED" },
  ];

  const milestones = getMilestoneNodes(fire, r, s, simulation);

  return `<section class="ember-bento-row" aria-label="Readiness breakdown, paycheck allocation, and life-stage checkpoints">
    <article class="ember-bento-card ember-rings-card">
      <div class="ember-card-head">
        <div>
          <h2>Readiness Breakdown</h2>
          <p>Aggregate target coverage &amp; current progress</p>
        </div>
      </div>
      <div class="ember-rings-stage">
        ${buildConcentricRingsSVG(ringsData, pct, "FUNDED", 172)}
      </div>
      <ul class="ember-rings-legend">
        ${ringsData
          .map(
            (item) =>
              `<li><span><i style="background:${item.color};"></i>${item.label}</span><strong>${item.text}</strong></li>`,
          )
          .join("")}
      </ul>
      <div class="ember-card-actions">
        ${!onTrack && fn.projectedFireAge != null && fn.projectedFireAge !== fire.retire ? `<button type="button" class="goal-chip is-primary" data-goal-retire="${fn.projectedFireAge}" data-goal-invest="${Math.ceil(simulation?.invest || 0)}">Set Age ${fn.projectedFireAge}</button>` : ""}
        <button type="button" class="goal-chip" data-goal-path="${altPathKey}">${altPathLabel}</button>
        <button type="button" class="goal-chip" data-go-tab="tax">Tax Rules →</button>
      </div>
    </article>

    <article class="ember-bento-card ember-paycheck-card">
      <div class="ember-card-head">
        <div>
          <h2>Paycheck Allocation</h2>
          <p>${money(grossPlusEmployer)}/mo gross + employer CPF</p>
        </div>
        <button type="button" class="text-button" data-go-tab="allocator">Edit Split →</button>
      </div>
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
        <span>Savings rate: <strong>${pctOfPay}%</strong> of ${m(r.afterCpf)} net pay</span>
        ${tax.combinedTaxSaved > 0 ? `<span>RSTU/SRS relief: <strong>${m(tax.combinedTaxSaved, "/yr")}</strong></span>` : ""}
      </div>
    </article>

    <article class="ember-bento-card ember-feed-card">
      <div class="ember-card-head">
        <div>
          <h2>Road to 95 Checkpoints</h2>
          <p>Key wealth &amp; CPF milestones</p>
        </div>
      </div>
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
    </article>
  </section>`;
}

function buildEmberStrategyLedger(r, s, selected) {
  const pathMeta = {
    salary: {
      name: "Salary CPF",
      tag: "Baseline",
      accent: "#64748B",
      note: "Uses mandatory salary contributions only; highest liquid cashflow.",
    },
    frs: {
      name: "FRS Target",
      tag: "Standard Sum",
      accent: "#0D9488",
      note: "Targets $220.4k cohort FRS by 55 for steady baseline CPF LIFE.",
    },
    ers: {
      name: "ERS Maximum",
      tag: "Max Floor",
      accent: "#059669",
      note: "Voluntary RA top-ups from 55 toward $440.8k ERS; highest lifelong income.",
    },
  };

  return `<section class="ember-ledger-card card-surface" aria-labelledby="ledger-title">
    <div class="ember-card-head">
      <div>
        <h2 id="ledger-title">CPF Retirement Path Comparison</h2>
        <p>${r.retiringNow ? "With retirement set to now, FRS and ERS model lump-sum funding today; Salary CPF uses existing balances only." : "Compare relying on mandatory salary CPF versus funding FRS or ERS for higher lifelong CPF LIFE income."}</p>
      </div>
      <button type="button" class="button button-small" data-go-tab="trajectory">Open Interactive Simulator →</button>
    </div>
    <div class="table-scroll">
      <table class="ember-ledger-table">
        <thead>
          <tr>
            <th scope="col">Strategy Path</th>
            <th scope="col">Age-55 CPF Target</th>
            <th scope="col">Extra CPF Needed</th>
            <th scope="col">Outside Save Needed</th>
            <th scope="col">CPF LIFE (65+)</th>
            <th scope="col" class="col-action">Selection</th>
          </tr>
        </thead>
        <tbody>
          ${r.scenarios
            .map((path) => {
              const meta = pathMeta[path.key] || pathMeta.salary;
              const isSelected = path.key === selected;
              return `<tr class="${isSelected ? "is-selected" : ""}" style="--row-accent:${meta.accent};">
                <td>
                  <div class="ledger-path-cell">
                    <strong>${meta.name}</strong>
                    <span class="ledger-tag">${meta.tag}</span>
                  </div>
                  <small class="ledger-sub">${meta.note}</small>
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
    <footer class="ember-footnotes" aria-label="Model footnotes">
      <ol>
        <li>Figures are shown in <strong>today’s purchasing power</strong> (${Number((r.inflation * 100).toFixed(1))}% modelled inflation, ${Math.round(r.investmentReturn * 100)}% net outside return; ${r.post55Work ? "post-55 salary CPF included" : "post-55 work contributions excluded"}).</li>
        <li>2026 CPF &amp; IRAS parameters: Ordinary Wage ceiling $8,000/mo, Basic Healthcare Sum $79,000, FRS $220,400, ERS $440,800, and $80,000 total personal tax relief cap.</li>
        <li>Cash RSTU top-ups and OA-to-SA transfers before 55 are irreversible and do not qualify for tax relief once SA/RA reaches FRS. <button type="button" class="footnote-link-btn" commandfor="plan-settings" command="show-modal">Review assumptions ↗</button></li>
      </ol>
    </footer>
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
        <span class="hero-kicker">HOLISTIC ASSET ALLOCATION</span>
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
              <strong>${Math.round(hol.effectiveEquityPct)}% Eq · ${Math.round(hol.effectiveBondPct)}% Bond/CPF</strong>
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
              <strong>${targetGlobalPct}% Global · ${targetSgPct}% SG · ${hol.targetBondPct}% Bond/CPF</strong>
            </div>
            <div class="mix-track" aria-hidden="true">
              ${targetGlobalPct > 0.4 ? `<span style="width:${targetGlobalPct}%;background:#2563EB;" title="Target Global UCITS"></span>` : ""}
              ${targetSgPct > 0.4 ? `<span style="width:${targetSgPct}%;background:#60A5FA;" title="Target SG Dividends"></span>` : ""}
              ${hol.targetBondPct > 0.4 ? `<span style="width:${hol.targetBondPct}%;background:#059669;" title="Target Bond / CPF Floor"></span>` : ""}
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
      <div>
        <span class="hero-kicker">2026 IRAS RULES · $80,000 RELIEF CAP</span>
        <h2 id="tax-sweet-title">CPF RSTU vs. SRS Tax Sweet-Spot</h2>
        <p>${tax.guidance}</p>
      </div>
      <div class="tax-badges-stack">
        <span class="status-pill ${tierTone}">${tax.headline}</span>
        <span class="srs-warning-badge">${ICONS.warnTiny}<span>${tax.srsIdleWarning}</span></span>
      </div>
    </div>
    <dl class="simulation-metrics">
      <div><dt>Chargeable Income (est.)</dt><dd>${m(tax.chargeableIncome, "/yr")}<small>${marginalPct} marginal bracket · ${m(tax.taxBefore.annualTax, "/yr")} tax</small></dd></div>
      <div><dt>CPF RSTU ($8k cap to FRS)</dt><dd>${m(tax.rstuTaxSaved, "/yr saved")}<small>Eligible room: ${m(tax.maxRstu, "/yr")} (SA room ${m(tax.saRoom)})</small></dd></div>
      <div><dt>SRS ($15.3k Citizen/PR cap)</dt><dd>${m(tax.srsTaxSavedAfterRstu, "/yr saved")}<small>After RSTU (${m(tax.srsStandaloneTaxSaved, "/yr")} standalone) · Lock-in age ${tax.srsLockInAge}</small></dd></div>
      <div><dt>$80k Relief Cap Used</dt><dd>${m(tax.reliefCapUsed)} / <span class="curr-muted">$80,000</span><small>${capPct}% used by CPF + reliefs (${m(tax.reliefCapRemaining)} left)</small></dd></div>
    </dl>
  </section>`;
}

function setupSimplePlan() {
  const fields = {
    lifestyle: "known-lifestyle",
    age: "person-age",
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
    housing: "known-housing",
    retire: "known-retire",
    invest: "known-invest",
    plan: "known-plan",
    returnRate: "known-return",
    inflationRate: "known-inflation",
    post55Work: "known-post55",
  };
  const timingFields = [
    "timing-mode",
    "timing-target",
    "timing-early",
    "timing-late",
    "timing-amount",
  ];
  populateAgeSelect($("#timing-early"), 18, 55);
  populateAgeSelect($("#timing-late"), 18, 60);
  const resetTiming = () =>
    timingFields.forEach((id) => resetControl($("#" + id)));

  const planRoot = $("#retirement-plan");
  const overviewSlot = $("#overview-slot");
  const allocatorSlot = $("#allocator-slot");
  const taxSlot = $("#tax-slot");
  const errorBanner = $("#plan-error-banner");

  let selected = "salary";
  let learningTarget = "frs";
  let learningPlan = null;
  let chartMode = "cashflow";
  const dashChartBasis = "today";
  let currentTrajectory = null;
  let currentFirePlan = null;
  let timingParams = null;
  let rafHandle = null;

  const renderTiming = () => {
    if (!timingParams) return;
    const output = $("#timing-results");
    const target = $("#timing-target").value;
    const minimum = target === "ers" ? 55 : Number(timingParams.age);
    $("#timing-amount").placeholder = "50000";
    populateAgeSelect($("#timing-early"), minimum, 55);
    populateAgeSelect($("#timing-late"), minimum, 60);

    const numericInputs = [
      $("#timing-early"),
      $("#timing-late"),
      $("#timing-amount"),
    ];
    let invalid = false;
    numericInputs.forEach((input) => {
      const error = $("#" + input.id + "-error");
      const message = input.validity.valid
        ? ""
        : input.id === "timing-amount"
          ? "Enter a cash amount from $0 to $1 billion, or leave blank for automatic."
          : `Enter a whole age from ${minimum} to 65.${target === "ers" ? " ERS starts at 55; choose FRS for an earlier top-up." : ""}`;
      if (message) invalid = true;
      input.setAttribute("aria-invalid", String(Boolean(message)));
      error.textContent = message;
      error.hidden = !message;
    });
    const editing = $("#timing-editing");
    if (invalid) {
      editing.textContent = output.children.length
        ? "Showing your last valid comparison. Update the highlighted entry to recalculate."
        : "Complete the highlighted entry to see your comparison.";
      editing.hidden = false;
      return;
    }
    editing.hidden = true;
    try {
      const result = RetirementModel.compareTopupTiming(
        timingParams,
        Number($("#timing-early").value),
        Number($("#timing-late").value),
        $("#timing-amount").value === ""
          ? null
          : Number($("#timing-amount").value),
        target,
        $("#timing-mode").value,
      );
      const { earlier, later } = result;
      const maxPayout = Math.max(1, earlier.payout, later.payout);
      output.innerHTML = `<p class="timing-meta">2026 FRS: <strong>${m(220400)}</strong> · ERS: <strong>${m(440800)}</strong> · Retire at <strong>${result.retire}</strong> · Figures below are <strong>future cash at 65</strong>.</p>
        <div class="timing-comparison">${[earlier, later]
          .map(
            (
              x,
            ) => `<div class="timing-col"><h3>${target.toUpperCase()} top-up at age ${x.age}</h3>
          <div class="timing-payout-bar"><span style="width:${(x.payout / maxPayout) * 100}%"></span></div>
          <dl>
          <div><dt>Projected target limit</dt><dd>${m(x.limit)}</dd></div>
          <div><dt>Available top-up room</dt><dd>${m(x.room)}</dd></div>
          <div><dt>Cash top-up accepted</dt><dd>${m(x.cash)}</dd></div>
          <div><dt>Extra CPF interest by 65</dt><dd>${m(x.interest)}</dd></div>
          <div><dt>RA balance at 65</dt><dd>${m(x.ra65)}</dd></div>
          <div><dt>OA remaining at 65</dt><dd>${m(x.oa65)}</dd></div>
          <div><dt>Estimated payout from 65</dt><dd>${m(x.payout, "/mo")}${x.payoutCapped ? " (boundary)" : ""}</dd></div>
        </dl></div>`,
          )
          .join("")}</div>
        <p class="timing-takeaway">${
          Math.abs(earlier.cash - later.cash) > 0.01
            ? `Fills the ${target.toUpperCase()} target at different dates using different cash amounts (includes both deposit difference and compounding).`
            : `Same ${m(earlier.cash)} cash: topping up at age <strong>${earlier.age}</strong> yields <strong>${m(Math.abs(Math.round(earlier.payout) - Math.round(later.payout)), "/mo")}</strong> ${earlier.payout >= later.payout ? "more" : "less"} CPF LIFE payout from 65.`
        }</p>`;
    } catch (e) {
      editing.textContent = `${e.message} ${output.children.length ? "Showing your last valid comparison." : ""}`;
      editing.hidden = false;
    }
  };
  timingFields.forEach((id) =>
    $("#" + id).addEventListener("input", () => {
      renderTiming();
      if (timingParams) persistState(timingParams);
    }),
  );

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
          if (el) el.value = params.get(key);
        }
      }
      if (["brs", "frs", "ers"].includes(params.get("learningTarget")))
        learningTarget = params.get("learningTarget");
      timingFields.forEach((id) => {
        if (params.has(id)) $("#" + id).value = params.get(id);
      });
      if (["salary", "frs", "ers"].includes(params.get("selected"))) {
        selected = params.get("selected");
      }
    } catch (_) {}
  };
  restoreSavedState();
  if ($("#known-savings-step1")) {
    $("#known-savings-step1").value = $("#known-savings").value;
  }

  const persistState = (p) => {
    if (!savingEnabled) return;
    try {
      const data = {
        ...p,
        selected,
        learningTarget,
        version: 2,
        ...Object.fromEntries(
          timingFields.map((id) => [id, $("#" + id).value]),
        ),
      };
      const search = new URLSearchParams();
      for (const [k, v] of Object.entries(data)) {
        if (v != null && (v !== "" || timingFields.includes(k)))
          search.set(k, String(v));
      }
      localStorage.setItem(
        "rs_plan_state",
        JSON.stringify(Object.fromEntries(search.entries())),
      );
      if (!location.hash || location.hash.includes("="))
        history.replaceState(history.state, "", "#" + search.toString());
    } catch (_) {}
  };

  const setError = (message) => {
    timingParams = null;
    learningPlan = null;
    $("#timing-editing").hidden = true;
    $("#timing-results").textContent =
      "Enter valid plan details to compare top-ups.";
    clearTimeout(readinessTimer);
    readinessKey = "";
    readinessPending = true;
    $("#simulation-results").textContent =
      "Enter valid details to update your simulation.";
    if (errorBanner) {
      errorBanner.textContent = message;
      errorBanner.hidden = false;
      if (Number($("#person-age").value) >= 55) {
        const link = document.createElement("a");
        link.href =
          "https://www.cpf.gov.sg/member/tools-and-services/calculators";
        link.className = "text-link";
        link.textContent = " Explore CPF’s personalised planning tools ↗";
        errorBanner.append(link);
      }
    }
    overviewSlot.innerHTML = "";
    allocatorSlot.innerHTML = "";
    taxSlot.innerHTML = "";
    currentTrajectory = null;
    $("#print-plan-btn").disabled = true;
    $("#trajectory-chart").replaceChildren();
    $("#trajectory-values").replaceChildren();
    $("#chart-legend").replaceChildren();
    $("#chart-tooltip").hidden = true;
    $("#dynamic-drawdown-summary").replaceChildren();
    $("#print-sheet").replaceChildren();
    $("#start-plan-error").textContent = message;
    $("#settings-error").textContent = message;
    delete $("#settings-live-summary").dataset.budget;
    $("#settings-live-summary").textContent =
      "Enter valid details to update your estimate.";
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
    const stress = event.target.closest("button[data-stress]");
    if (stress) {
      const action = stress.dataset.stress;
      if (action === "reset") {
        $("#known-spend").value = "";
        resetControl($("#known-inflation"));
        resetControl($("#known-return"));
        resetControl($("#known-post55"));
      } else if (action === "budget") {
        const input = $("#known-spend");
        const current =
          input.value === ""
            ? RetirementModel.lifestyles[$("#known-lifestyle").value].budget
            : Number(input.value);
        input.value = String(Math.min(1e9, current + 500));
      } else {
        const stressValues = {
          inflation: ["known-inflation", "0.035"],
          return: ["known-return", "0.03"],
          senior: ["known-post55", "true"],
        };
        const [id, value] = stressValues[action];
        $("#" + id).value = value;
      }
      render();
      const replacement = $(`button[data-stress="${action}"]`);
      (replacement && !replacement.disabled
        ? replacement
        : $("#plan-resilience > summary")
      )?.focus({ preventScroll: true });
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

  const render = () => {
    if (errorBanner) {
      errorBanner.hidden = true;
      errorBanner.textContent = "";
    }
    syncPresetChoice();
    $("#known-retire").min =
      $("#known-lifestyle").value === "cca" ? "55" : "40";
    const cpfPosOpen =
      planRoot.querySelector("#cpf-position-details")?.open || false;
    const salaryCapOpen =
      planRoot.querySelector("#salary-cpf-caps")?.open || false;
    const learningOpen =
      planRoot.querySelector("#cpf-goal-guide")?.open || false;
    const resilienceOpen =
      planRoot.querySelector("#plan-resilience")?.open || false;
    const p = {};
    for (const [key, id] of Object.entries(fields)) {
      const input = $("#" + id);
      if (!input) continue;
      const val = input.value.trim();
      if (input.validity.badInput) {
        setError(
          "Enter a number without dollar signs or commas. Leave a field blank only if you want to use its starting assumption.",
        );
        return;
      }
      if (val === "") {
        if (key === "age" || key === "salary") {
          setError(
            "Enter your age and gross salary to see the CPF comparison.",
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
            "CCA currently requires age 55 or above. Choose 55 or later, or switch to Home + Helper for an earlier retirement illustration.",
          );
          return;
        }
        if (key === "age" && Number(val) >= 55) {
          setError(
            "This salary illustration supports ages 18–54. From 55, your Retirement Account and actual balances need CPF’s personalised retirement estimator.",
          );
          return;
        }
        setError(
          "Check the allowed range for " +
            (input.labels ? input.labels[0].textContent : key) +
            ".",
        );
        return;
      }
      p[key] =
        key === "plan" || key === "lifestyle" || key === "srsInvestedIn"
          ? val
          : key === "post55Work"
            ? val === "true"
            : Number(val);
    }
    const step1Savings = $("#known-savings-step1");
    if (step1Savings && step1Savings.validity.badInput) {
      setError(
        "Enter a valid non-negative number for outside retirement investments.",
      );
      return;
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

    timingParams = p;
    renderTiming();
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

    const cpfDetailsHTML = `<details id="cpf-position-details" class="result-details" ${cpfPosOpen || moveOA.oaTransfer > 0.01 ? "open" : ""}>
      <summary>CPF today → age 55 &amp; OA-to-SA transfer check <span class="summary-tag">Age-55 cash</span></summary>
      <dl class="simulation-metrics">
        <div><dt>OA today</dt><dd>${centsHtml(Number(p.oa || 0))}</dd></div>
        <div><dt>SA today</dt><dd>${centsHtml(Number(p.sa || 0))}</dd></div>
        <div><dt>SA top-up room to 2026 FRS</dt><dd>${centsHtml(roomNow)}</dd></div>
        <div><dt>OA transferable to SA now</dt><dd>${centsHtml(Math.min(Number(p.oa || 0), roomNow))}</dd></div>
      </dl>
      ${oaTransferSummaryTable}
    </details>`;

    persistState(p);
    renderLifestyle(r);
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
      <p class="fixed-retirement">Target retirement age: <strong>${r.retire}</strong>. Adjust amounts above or edit My Balances to test readiness and portfolio longevity.</p>
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
        renderPrintSheet(
          r,
          s,
          drawdown,
          simulation,
          readinessPending,
          readinessAge,
        );
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
    const lessonHTML = `<details id="cpf-goal-guide" class="result-details" ${learningOpen ? "open" : ""}><summary>How to reach BRS, FRS or ERS at 55 <span class="summary-tag">Age-55 cash</span></summary>
      <p>2026 CPF reference anchors (male turning 55 in 2026, Standard Plan from 65):</p>
      <div class="goal-choices" role="group" aria-label="CPF milestone to learn about">${Object.entries(
        references,
      )
        .map(
          ([key, [sum, payout]]) =>
            `<button type="button" data-learn="${key}" aria-pressed="${key === learningTarget}"><strong>${key.toUpperCase()}</strong><span>${m(sum)} at 55</span><span>~${m(payout, "/mo")} from 65</span></button>`,
        )
        .join("")}</div>
      <dl class="simulation-metrics">
        <div><dt>Projected ${learningTarget.toUpperCase()} at your age 55</dt><dd>${m(lesson.target)}</dd></div>
        <div><dt>OA + SA at 55 before extra saving</dt><dd>${m(lesson.available)}</dd></div>
        <div><dt>Gap to ${learningTarget.toUpperCase()} at 55</dt><dd>${m(lesson.gap)}</dd></div>
        <div><dt>Extra CPF saving to hit milestone</dt><dd>${lesson.monthly === null ? "Lump sum only" : m(lesson.monthly, "/mo")}</dd></div>
      </dl>
      <ul class="compact-list">
        <li><strong>Before 55:</strong> Cash RSTU and OA-to-SA transfers share SA room up to current FRS (${centsHtml(lesson.currentRoom)} today) and are irreversible.</li>
        <li><strong>At 55:</strong> SA closes; SA then OA fund RA up to cohort FRS. ERS top-ups open from 55 (no RSTU tax relief above FRS).</li>
        ${learningTarget === "brs" ? "<li><strong>BRS property rule:</strong> Withdrawing RA above BRS requires pledging a property whose lease covers you to age 95+.</li>" : ""}
      </ul>
      <div class="flow-actions"><button type="button" class="text-button" data-learn-apply data-go-tab="trajectory" ${lesson.monthly === null ? "disabled" : ""}>Simulate ${lesson.monthly ? m(lesson.monthly, "/mo") : "this"} CPF saving →</button><button type="button" class="text-button" data-go-tab="trajectory" data-reveal="timing">Compare earlier vs later lump-sum top-up →</button></div>
    </details>`;

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
            ? `Critical target: ${m(contribution, "/mo")} (${pctOfPay}% of pay after CPF)`
            : isTight
              ? `Stretch target: ${m(contribution, "/mo")} (${pctOfPay}% of pay after CPF)`
              : `On track saving ${m(contribution, "/mo")} (${pctOfPay}% of pay after CPF)`;

    const coverageHTML = buildCoverageSection(r, s);
    const outsideHTML = buildOutsideAvenuesSection(r, s, p, simulation);

    const isStressed =
      $("#known-spend").value !== "" ||
      r.inflation !== RetirementModel.C.inflation ||
      r.investmentReturn !== RetirementModel.C.investmentReturn ||
      r.post55Work;

    const overviewHeaderHTML = buildOverviewPageHeader(fire, r, s);
    const kpiStripHTML = buildEmberKpiStrip(fire, r, s, simulation, pctOfPay);
    const heroTrajectoryHTML = buildEmberHeroTrajectorySection(fire);
    const bentoRowHTML = buildEmberBentoRow(
      fire,
      r,
      s,
      p,
      simulation,
      bogle,
      simGuide,
      tax,
      pctOfPay,
    );
    const strategyLedgerHTML = buildEmberStrategyLedger(r, s, selected);

    const bogleHTML = buildBogleheadSection(bogle, r);
    const taxSweetHTML = buildTaxSweetSpotSection(tax);

    overviewSlot.innerHTML = `
      ${overviewHeaderHTML}
      ${kpiStripHTML}
      ${rangeNote}
      ${heroTrajectoryHTML}
      ${bentoRowHTML}
      ${strategyLedgerHTML}`;

    const fnHdr = fire.fireNumber;
    const hdrChip = $("#header-readiness-chip");
    if (hdrChip) {
      const hdrReady = fnHdr.pctFunded >= 100 && fnHdr.fullyFundedTo95;
      hdrChip.textContent = `Age ${r.age} → ${r.retire} · ${hdrReady ? "On Track" : `${fnHdr.pctFunded}% Funded`}`;
      hdrChip.className = `header-readiness-chip ${hdrReady ? "is-good" : fnHdr.pctFunded >= 80 ? "is-warn" : "is-danger"}`;
    }

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
      const existingOut = allocatorSlot.querySelector("#outside-avenues");
      const tmpOut = document.createElement("div");
      tmpOut.innerHTML = outsideHTML;
      if (existingOut && tmpOut.firstElementChild)
        existingOut.replaceWith(tmpOut.firstElementChild);
    } else {
      allocatorSlot.innerHTML = `${bogleHTML}${outsideHTML}`;
    }

    taxSlot.innerHTML = `
      ${taxSweetHTML}
      ${coverageHTML}
      <section class="reference-disclosures" aria-labelledby="ref-title">
        <h2 id="ref-title">CPF details, future-cash check &amp; stress tests</h2>
        ${cpfDetailsHTML}
        ${lessonHTML}
        <details id="salary-cpf-caps" class="result-details" ${salaryCapOpen ? "open" : ""}>
          <summary>Age-65 budget breakdown &amp; future-value reference</summary>
          <dl class="simulation-metrics">
            <div><dt>Employee CPF (20%)</dt><dd>${m(r.employeeCpf, "/mo")}</dd></div>
            <div><dt>Employer CPF (17%)</dt><dd>${m(r.employerCpf, "/mo")}</dd></div>
            <div><dt>Total salary CPF</dt><dd>${m(r.employeeCpf + r.employerCpf, "/mo")}</dd></div>
            <div><dt>Pay after employee CPF</dt><dd>${m(r.afterCpf, "/mo")}</dd></div>
          </dl>
          <p class="result-footnote">2026 Ordinary Wage ceiling: $8,000/mo ($102,000 annual salary ceiling; $37,740 mandatory CPF cap). Below is your age-65 monthly plan in today’s dollars and inflation-adjusted future dollars (${(r.inflation * 100).toFixed(1)}%/yr over ${65 - r.age} yrs):</p>
          <div class="table-scroll"><table class="trajectory-table"><caption>Age-65 monthly figures in today’s purchasing power vs future dollars</caption><thead><tr><th scope="col">Item</th><th scope="col">Today’s dollars</th><th scope="col">Future cash at 65</th></tr></thead><tbody>${[
            ["Living budget", r.spend65, simulation.summary.spend65],
            [
              "Estimated CPF LIFE",
              s.payout,
              simulation.selectedScenario.payout,
            ],
            [
              "Outside portfolio gap",
              s.gap65,
              simulation.selectedScenario.gap65,
            ],
          ]
            .map(
              ([label, today, cash]) =>
                `<tr><th scope="row">${label}</th><td>${m(today, "/mo")}</td><td>${m(cash, "/mo")}</td></tr>`,
            )
            .join("")}</tbody></table></div>
        </details>
        <details id="plan-resilience" class="result-details" ${resilienceOpen ? "open" : ""}>
          <summary>One-click stress tests (inflation, lower returns, +$500 spend)</summary>
          <p>Test how sensitive your roadmap is to tougher assumptions without opening settings:</p>
          <div class="stress-actions">
            <button type="button" class="text-button" data-stress="budget">+$500/mo higher budget</button>
            <button type="button" class="text-button" data-stress="inflation" ${r.inflation >= 0.035 ? "disabled" : ""}>${r.inflation >= 0.035 ? "Inflation at 3.5%" : "Test 3.5% inflation"}</button>
            <button type="button" class="text-button" data-stress="return" ${r.investmentReturn <= 0.03 ? "disabled" : ""}>${r.investmentReturn <= 0.03 ? "Net return at 3%" : "Test 3.0% net return"}</button>
            ${!r.post55Work && r.retire > 55 ? '<button type="button" class="text-button" data-stress="senior">Include post-55 salary CPF</button>' : ""}
            ${isStressed ? '<button type="button" class="text-button" data-stress="reset">Reset stress tests</button>' : ""}
          </div>
        </details>
      </section>`;

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
    renderDrawdownSummary(r, drawdown);
    renderPrintSheet(
      r,
      s,
      drawdown,
      simulation,
      readinessPending,
      readinessAge,
      { fire, bogle, tax, guide: simGuide, p, basis: dashChartBasis },
    );
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
    if ($("#known-savings-step1")) $("#known-savings-step1").value = val;
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
        if (bucketIds.includes(id)) {
          syncBucketsToTotal();
        } else if (id === "known-savings") {
          clearBucketsOnDirectTotalEdit();
          if ($("#known-savings-step1")) {
            $("#known-savings-step1").value = el.value;
          }
        }
        render();
      });
      el.addEventListener("change", () => {
        render();
      });
    }
  });
  if ($("#known-savings-step1")) {
    const syncStep1Savings = () => {
      clearBucketsOnDirectTotalEdit();
      $("#known-savings").value = $("#known-savings-step1").value;
      render();
    };
    $("#known-savings-step1").addEventListener("input", syncStep1Savings);
    $("#known-savings-step1").addEventListener("change", syncStep1Savings);
  }

  const setIoStatus = (msg) => {
    if ($("#data-io-status")) $("#data-io-status").textContent = msg;
    if ($("#plan-status")) $("#plan-status").textContent = msg;
  };

  const applyPlanObject = (planObj) => {
    if (!planObj || typeof planObj !== "object")
      throw new Error("Invalid plan format.");
    Object.values(fields).forEach((id) => resetControl($("#" + id), true));
    for (const [key, id] of Object.entries(fields)) {
      const el = $("#" + id);
      if (!el || planObj[key] == null) continue;
      el.value = String(planObj[key]);
    }
    if (
      planObj.savings == null &&
      bucketIds.some((id) => ($("#" + id)?.value || "").trim() !== "")
    ) {
      syncBucketsToTotal();
    } else if ($("#known-savings-step1")) {
      $("#known-savings-step1").value = $("#known-savings")?.value || "";
    }
  };

  const SG_DEFAULT_PLAN = {
    lifestyle: "cca",
    age: 35,
    salary: 5500,
    retire: 65,
    spend: 2500,
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
  };

  const resetSgDefaults = () => {
    applyPlanObject(SG_DEFAULT_PLAN);
    selected = "salary";
    learningTarget = "frs";
    resetTiming();
    render();
    setIoStatus("Reset to typical Singapore age-35 defaults.");
  };

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-sg-reset]")) {
      resetSgDefaults();
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
  $("#btn-zero-housing").addEventListener("click", () => {
    $("#known-housing").value = "0";
    render();
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

  $("#reset-settings")?.addEventListener("click", () => {
    resetSgDefaults();
  });

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
  dialog.addEventListener("click", (event) => {
    const r = dialog.getBoundingClientRect();
    if (
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
      : target.querySelector(".module-disclosure");
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
  const TABS = ["overview", "trajectory", "allocator", "tax"];
  let activeTab = "overview";
  let profileOpen = false;
  const form = $("#quick-form");
  const lifestyle = $("#known-lifestyle");
  const balances = $("#start-cpf-details");

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
  $("#use-preset-budget").addEventListener("click", () => {
    $("#known-spend").value = "";
    $("#known-spend").dispatchEvent(new Event("input", { bubbles: true }));
    $("#known-spend").focus({ preventScroll: true });
  });
  $(".preset-picker").addEventListener("change", (event) => {
    if (event.target.name !== "lifestyle-choice") return;
    lifestyle.value = event.target.value;
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
      const isSelected = !profileOpen && btn.dataset.tab === activeTab;
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
    if (
      !profile &&
      (!form.reportValidity() ||
        ($("#settings-error").textContent && $("#print-plan-btn").disabled))
    )
      return;
    if ($("#plan-settings").open)
      $("#plan-settings").dataset.flowNavigation = "true";
    $("#plan-settings").close();
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
      const targetTab = goTabBtn.dataset.goTab;
      navigateTo({ tab: targetTab, profile: false });
      if (goTabBtn.dataset.reveal === "timing") {
        const timingSection = $("#timing-section");
        if (timingSection) timingSection.open = true;
        $("#timing-section")?.scrollIntoView({
          block: "start",
          behavior: "instant",
        });
      }
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
        balances.open = true;
        $("#known-savings-step1")?.focus({ preventScroll: true });
        balances.scrollIntoView({ block: "start", behavior: "instant" });
      }
    } else if (stepNum === 3) {
      navigateTo({ tab: "trajectory", profile: false });
      if (stepBtn.dataset.reveal === "timing") {
        const timingSection = $("#timing-section");
        if (timingSection) timingSection.open = true;
        $("#timing-section")?.scrollIntoView({
          block: "start",
          behavior: "instant",
        });
      }
    } else {
      navigateTo({ tab: "overview", profile: false });
      if (stepBtn.dataset.reveal === "outside") {
        navigateTo({ tab: "allocator", profile: false });
        $("#outside-avenues")?.scrollIntoView({
          block: "start",
          behavior: "instant",
        });
      }
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

  const quickJump = $("#header-quick-jump");
  quickJump?.addEventListener("change", () => {
    const dest = quickJump.value;
    quickJump.value = "";
    if (!dest) return;
    if (dest === "profile") {
      navigateTo({ profile: true });
      return;
    }
    if (dest === "timing-section") {
      navigateTo({ tab: "trajectory", profile: false });
      const timingSection = $("#timing-section");
      if (timingSection) timingSection.open = true;
      requestAnimationFrame(() =>
        timingSection?.scrollIntoView({ block: "start", behavior: "instant" }),
      );
      return;
    }
    navigateTo({ tab: dest, profile: false });
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
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
        "timing-section",
        "tab-panel-trajectory",
      ].includes(id)
    ) {
      profileOpen = false;
      activeTab = "trajectory";
      applyViewState(false, false);
      const targetEl = $(
        "#" + (id === "funding-steps" ? "savings-simulator" : id),
      );
      const disc = targetEl?.matches("details")
        ? targetEl
        : targetEl?.querySelector("details.module-disclosure");
      if (disc) disc.open = true;
      requestAnimationFrame(() => targetEl?.scrollIntoView());
      return;
    }
    if (
      [
        "boglehead-allocator",
        "outside-avenues",
        "srs-notes",
        "retirement-budget",
        "later-life",
        "tab-panel-allocator",
      ].includes(id)
    ) {
      profileOpen = false;
      activeTab = "allocator";
      applyViewState(false, false);
      const targetEl = $("#" + id);
      const disc = targetEl?.matches("details")
        ? targetEl
        : targetEl?.querySelector("details.module-disclosure");
      if (disc) disc.open = true;
      requestAnimationFrame(() => targetEl?.scrollIntoView());
      return;
    }
    if (["tax-sweet-spot", "model-assumptions", "tab-panel-tax"].includes(id)) {
      profileOpen = false;
      activeTab = "tax";
      applyViewState(false, false);
      const targetEl = $("#" + id);
      const disc = targetEl?.matches("details")
        ? targetEl
        : targetEl?.querySelector("details.module-disclosure");
      if (disc) disc.open = true;
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
    "person-salary": "Exclude employer CPF and bonuses.",
    "known-housing": "Blank assumes future OA pays housing.",
    "known-cpf-extra": "Extra saving above salary CPF.",
    "sim-invest": "Separate from CPF savings.",
  };
  const closeHelp = () =>
    $$(".field-help-panel:popover-open").forEach((panel) =>
      panel.hidePopover(),
    );
  $$(".field").forEach((field) => {
    const label = field.querySelector(":scope > label");
    const help = field.querySelector(":scope > small:not(.timing-error)");
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

if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("sw.js", { updateViaCache: "none" })
    .catch(() => {});
}

setupCareBreakdown();
setupSimplePlan();
setupSettings();
setupDeepLinks();
setupGuidedFlow();
setupFieldHelp();
