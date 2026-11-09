const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const money = (value) =>
  `$${Math.round(Math.max(0, value) || 0).toLocaleString("en-SG")}`;
const compactMoney = (value) => {
  const v = Math.round(Math.max(0, value) || 0);
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
  if (v >= 1000) return `$${Math.round(v / 1000)}k`;
  return `$${v}`;
};

function setupCareBreakdown() {
  const range = (values) =>
    `S$${Math.round(values[0]).toLocaleString("en-SG")}–${Math.round(values[1]).toLocaleString("en-SG")}`;
  const laterToday = (values) =>
    values.map((value) => RetirementModel.todayValue(value, 75, 65));
  $("#care-later-range").textContent = range(
    laterToday(RetirementModel.careTotals("later")),
  );
  $("#care-later-total").textContent = $("#care-later-range").textContent;
  $("#care-concession-range").textContent = range(
    laterToday(RetirementModel.careTotals("later").map((value) => value - 240)),
  );
  $("#care-health-midpoint").textContent =
    `Healthcare midpoint: S$325 → ${money(RetirementModel.todayValue(675, 75, 65))} in today’s dollars.`;
  $("#care-cost-rows").innerHTML = RetirementModel.careRows
    .map(
      (row) =>
        `<article class="care-cost-row" role="listitem"><h4>${row.name}</h4><div><small>Age 65 · today</small><strong>${range(row.now)}</strong></div><div><small>Age 75 · today’s value</small><strong>${range(laterToday(row.later))}</strong></div><p>${row.note}</p></article>`,
    )
    .join("");
}

function renderLifestyle(r) {
  const cca = r.lifestyle === "cca";
  $("#lifestyle-summary").textContent =
    `${r.lifestyleLabel} · monthly living costs`;
  $("#budget-title").textContent = cca
    ? "Your CCA living budget"
    : "Your Home + Helper budget";
  $("#budget-summary-title").textContent =
    `How your ${cca ? "CCA" : "Home + Helper"} budget breaks down`;
  $("#budget-intro").textContent = cca
    ? "A planning allowance for one person, including basic services and extra help. Apartment purchase and move-in costs need separate funding."
    : "One person, a paid-up 2-room flat and one live-in helper. The ranges below are a reference example; your custom budget scales the personalised calculation.";
  $("#cca-budget").hidden = !cca;
  $("#helper-budget").hidden = cca;
  $("#known-spend").placeholder = String(
    RetirementModel.lifestyles[r.lifestyle].budget,
  );
  $("#budget-default-note").textContent =
    `Blank uses ${money(RetirementModel.lifestyles[r.lifestyle].budget)}, including healthcare and ${cca ? "extra help" : "a live-in helper"}.`;
  $("#lifestyle-assumptions").textContent = cca
    ? "CCA starts at $2,500/month; apartment purchase/lease, service deposit and move-in costs need separate funding. No subsidy is automatically included. In the reference example starting at 65 today, care provisions bring the total to $3,340 at 75 in today’s prices. The care trend grows smoothly after 65 and is extrapolated beyond 75. A custom budget scales all provisions. This is a planning estimate, not an official CCA price."
    : "Home + Helper starts at $3,500/month, including a cushion above the $3,090 category midpoint. The model keeps the nominal $300 levy fixed and adds an age-related care allowance after 65 calibrated to the original category trend. The trend is extrapolated beyond 75. Housing purchase, rent and mortgage are excluded. These are planning provisions, not promised costs.";
  const breakdown = RetirementModel.budgetBreakdown(r.lifestyle, r.todaySpend);
  const chart = `<figure class="budget-figure"><div class="budget-stack" aria-hidden="true">${breakdown.groups.map((group) => `<span class="budget-segment budget-${group.key}" style="width:${breakdown.total ? (group.amount / breakdown.total) * 100 : 0}%"></span>`).join("")}</div><figcaption class="budget-group-labels">${breakdown.groups.map((group) => `<span><span class="budget-group-name"><i class="budget-dot budget-${group.key}" aria-hidden="true"></i>${group.label}</span><b>${money(group.amount)}</b></span>`).join("")}</figcaption></figure>`;
  const categories = `<dl class="budget-category-list">${breakdown.rows.map((row) => `<div><dt>${row.name}</dt><dd>${money(row.amount)}</dd></div>`).join("")}</dl><p class="budget-rounding">Monthly amounts in today’s dollars, rounded. This is the starting budget; care needs can change it later.</p>`;
  $("#preset-budget-summary").textContent =
    `What’s in your ${money(r.todaySpend)}/month ${cca ? "CCA" : "Home + Helper"} budget?`;
  $("#preset-budget-content").innerHTML = chart + categories;
  $("#drawer-budget-caption").textContent =
    `${money(r.todaySpend)}/month · ${r.lifestyleLabel}`;
  $("#drawer-budget-chart").innerHTML = chart;
  $("#drawer-budget-categories").innerHTML = categories;
  const scale = r.todaySpend / 2500;
  $("#cca-now-total").textContent = money(r.todaySpend);
  $("#cca-later-total").textContent = money(3340 * scale);
  $("#cca-cost-rows").innerHTML = RetirementModel.ccaRows
    .map(
      (row) =>
        `<article class="care-cost-row" role="listitem"><h4>${row.name}</h4><div><small>Age 65 · today’s value</small><strong>${money(row.now * scale)}</strong></div><div><small>Age 75 · today’s value</small><strong>${money(row.later * scale)}</strong></div></article>`,
    )
    .join("");
}

function setupDrawdownSteps() {
  const steps = $$(".drawdown-steps > article");
  let current = 0;
  const show = (focus = false) => {
    steps.forEach((step, i) => {
      step.hidden = i !== current;
    });
    $("#drawdown-progress").textContent =
      `Action ${current + 1} of ${steps.length} · explore at your own pace`;
    $("#drawdown-back").hidden = current === 0;
    $("#drawdown-next").textContent =
      current === steps.length - 1 ? "Revisit the actions" : "Next action";
    if (focus) {
      const heading = steps[current].querySelector("h3");
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  };
  $("#drawdown-next").addEventListener("click", () => {
    current = (current + 1) % steps.length;
    show(true);
  });
  $("#drawdown-back").addEventListener("click", () => {
    current = Math.max(0, current - 1);
    show(true);
  });
  show();
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
    housing: "known-housing",
    retire: "known-retire",
    invest: "known-invest",
    plan: "known-plan",
    returnRate: "known-return",
    inflationRate: "known-inflation",
    post55Work: "known-post55",
  };

  const out = $("#simple-results");
  let selected = "salary";
  let chartMode = "cashflow"; // "cashflow" | "portfolio"
  let currentTrajectory = null;
  let savingEnabled = true;
  let guideStep = 0;
  try {
    savingEnabled = sessionStorage.getItem("rs_private_mode") !== "true";
    if (localStorage.getItem("rs_plan_version") !== "2") {
      localStorage.removeItem("rs_plan_state");
      localStorage.removeItem("rs_guide_step");
      localStorage.setItem("rs_plan_version", "2");
    }
    guideStep = Math.max(
      0,
      Math.min(5, Number(localStorage.getItem("rs_guide_step")) || 0),
    );
  } catch (_) {}

  // Restore state from URL Hash or localStorage
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
        localStorage.removeItem("rs_guide_step");
        guideStep = 0;
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
      if (["salary", "frs", "ers"].includes(params.get("selected"))) {
        selected = params.get("selected");
      }
    } catch (_) {}
  };
  restoreSavedState();

  const persistState = (p) => {
    if (!savingEnabled) return;
    try {
      const data = { ...p, selected, version: 2 };
      const search = new URLSearchParams();
      for (const [k, v] of Object.entries(data)) {
        if (v != null && v !== "") search.set(k, String(v));
      }
      localStorage.setItem(
        "rs_plan_state",
        JSON.stringify(Object.fromEntries(search.entries())),
      );
      // Keep section deep links intact; financial links remain versioned.
      if (!location.hash || location.hash.includes("="))
        history.replaceState(null, "", "#" + search.toString());
    } catch (_) {}
  };

  const setError = (message) => {
    out.innerHTML = "";
    const p = document.createElement("p");
    p.className = "next-action";
    p.textContent = message;
    out.append(p);
    currentTrajectory = null;
    $("#print-plan-btn").disabled = true;
    $("#trajectory-chart").replaceChildren();
    $("#trajectory-values").replaceChildren();
    $("#chart-legend").replaceChildren();
    $("#chart-tooltip").hidden = true;
    $("#dynamic-drawdown-summary").replaceChildren();
    $("#print-sheet").replaceChildren();
    if (Number($("#person-age").value) >= 55) {
      const link = document.createElement("a");
      link.href =
        "https://www.cpf.gov.sg/member/tools-and-services/calculators";
      link.className = "text-link dark-link";
      link.textContent = "Explore CPF’s personalised planning tools ↗";
      out.append(link);
    }
    $("#settings-error").textContent = message;
    $("#plan-status").textContent = message;
  };

  // Trajectory SVG Renderer with precision pointer tracking
  const renderTrajectoryChart = (trajectoryData) => {
    if (!trajectoryData || !trajectoryData.points.length) return;
    const { points, summary } = trajectoryData;
    $("#trajectory-values").innerHTML = points
      .map(
        (pt) =>
          `<tr><th scope="row">${pt.age} / ${pt.year}</th><td>${money(pt.monthlySpend)}</td><td>${money(pt.monthlyCPF)}</td><td>${money(pt.monthlyGap)}</td><td>${money(pt.portfolioBalance)}</td></tr>`,
      )
      .join("");
    $("#trajectory-caption").textContent =
      `${trajectoryData.selectedScenario.label}: yearly figures in today’s dollars`;
    $("#trajectory-chart").setAttribute(
      "aria-label",
      `${chartMode === "cashflow" ? "Monthly spending and CPF income" : "Outside portfolio balance"} from age ${summary.age} to 90. Explore the yearly figures below for all values.`,
    );
    const chartArea = $("#trajectory-chart");
    const legendEl = $("#chart-legend");
    const tooltipEl = $("#chart-tooltip");
    const chartWrapper = $(".chart-wrapper");

    const W = 760,
      H = 300,
      padL = 65,
      padR = 30,
      padT = 25,
      padB = 40;
    const plotW = W - padL - padR,
      plotH = H - padT - padB;

    const minAge = points[0].age,
      maxAge = points[points.length - 1].age;
    const dX = (age) => padL + ((age - minAge) / (maxAge - minAge)) * plotW;

    if (chartMode === "cashflow") {
      const maxVal =
        Math.max(
          1000,
          ...points.map((pt) => Math.max(pt.monthlySpend, pt.monthlyCPF)),
        ) * 1.15;
      const dY = (val) => padT + (1 - Math.max(0, val) / maxVal) * plotH;

      let spendPath = `M ${dX(points[0].age)} ${dY(points[0].monthlySpend)}`;
      for (let i = 1; i < points.length; i++) {
        spendPath += ` L ${dX(points[i].age)} ${dY(points[i].monthlySpend)}`;
      }

      let cpfArea = `M ${dX(points[0].age)} ${dY(0)}`;
      for (let i = 0; i < points.length; i++) {
        cpfArea += ` L ${dX(points[i].age)} ${dY(points[i].monthlyCPF)}`;
      }
      cpfArea += ` L ${dX(maxAge)} ${dY(0)} Z`;

      const retireX = dX(summary.retire);
      const age65X = dX(65);

      const yTicks = [0, maxVal * 0.33, maxVal * 0.66, maxVal].map((v) => ({
        val: v,
        y: dY(v),
        label: money(v),
      }));
      const xTicks = [35, 45, 55, 65, 75, 85, 90]
        .filter((a) => a >= minAge && a <= maxAge)
        .map((a) => ({ age: a, x: dX(a) }));

      chartArea.innerHTML = `
        <svg viewBox="0 0 ${W} ${H}" width="100%" height="auto" preserveAspectRatio="none">
          <defs>
            <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#f2d2c4" stop-opacity="0.6"/>
              <stop offset="100%" stop-color="#f2d2c4" stop-opacity="0.05"/>
            </linearGradient>
            <linearGradient id="cpfGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#69bbae" stop-opacity="0.8"/>
              <stop offset="100%" stop-color="#69bbae" stop-opacity="0.15"/>
            </linearGradient>
          </defs>
          ${yTicks
            .map(
              (t) => `
            <line x1="${padL}" y1="${t.y}" x2="${W - padR}" y2="${t.y}" stroke="#e0e8ef" stroke-dasharray="3,3" />
            <text x="${padL - 10}" y="${t.y + 4}" text-anchor="end" font-size="14" fill="#536475">${t.label}</text>
          `,
            )
            .join("")}
          ${xTicks
            .map(
              (t) => `
            <line x1="${t.x}" y1="${padT}" x2="${t.x}" y2="${H - padB}" stroke="#edf2f7" />
            <text x="${t.x}" y="${H - padB + 20}" text-anchor="middle" font-size="14" fill="#536475">Age ${t.age}</text>
          `,
            )
            .join("")}
          
          <!-- Spending Curve Area -->
          <path d="${spendPath} L ${dX(maxAge)} ${dY(0)} L ${dX(minAge)} ${dY(0)} Z" fill="url(#spendGrad)" />
          <path d="${spendPath}" fill="none" stroke="#805a44" stroke-width="2.5" stroke-dasharray="7,3" />

          <!-- CPF Income Area -->
          <path d="${cpfArea}" fill="url(#cpfGrad)" />
          <path d="${points
            .map(
              (pt, i) =>
                `${i === 0 ? "M" : "L"} ${dX(pt.age)} ${dY(pt.monthlyCPF)}`,
            )
            .join(" ")}" fill="none" stroke="#176a65" stroke-width="2.5" />

          <!-- Milestones -->
          ${
            summary.retire < 65
              ? `
            <line x1="${retireX}" y1="${padT}" x2="${retireX}" y2="${H - padB}" stroke="#d97706" stroke-width="2" stroke-dasharray="4,4" />
            <text x="${retireX}" y="${padT + 12}" text-anchor="middle" font-size="13" font-weight="bold" fill="#d97706">Retire (${summary.retire})</text>
          `
              : ""
          }
          <line x1="${age65X}" y1="${padT}" x2="${age65X}" y2="${H - padB}" stroke="#0369a1" stroke-width="2" stroke-dasharray="4,4" />
          <text x="${age65X}" y="${padT + 24}" text-anchor="middle" font-size="13" font-weight="bold" fill="#0369a1">CPF LIFE (65)</text>

          <!-- Interactive Scrubber Line -->
          <line id="scrub-line" x1="0" y1="${padT}" x2="0" y2="${H - padB}" stroke="#11253d" stroke-width="1.8" stroke-dasharray="3,3" style="display:none;" />
        </svg>
      `;

      legendEl.innerHTML = `
        <span class="legend-item"><i class="legend-swatch" style="background:#805a44;"></i> Total Monthly Spend</span>
        <span class="legend-item"><i class="legend-swatch" style="background:#176a65;"></i> CPF LIFE Payout (${summary.plan === "escalating" ? "Escalating +2%/yr" : "Standard Flat"})</span>
        <span class="legend-item"><i class="legend-swatch" style="background:#f2d2c4;"></i> Outside Investment Gap</span>
      `;
    } else {
      // Portfolio Balance view
      const maxVal =
        Math.max(1000, ...points.map((pt) => pt.portfolioBalance)) * 1.15;
      const dY = (val) => padT + (1 - Math.max(0, val) / maxVal) * plotH;

      let balPath = `M ${dX(points[0].age)} ${dY(points[0].portfolioBalance)}`;
      for (let i = 1; i < points.length; i++) {
        balPath += ` L ${dX(points[i].age)} ${dY(points[i].portfolioBalance)}`;
      }

      const yTicks = [0, maxVal * 0.33, maxVal * 0.66, maxVal].map((v) => ({
        val: v,
        y: dY(v),
        label: compactMoney(v),
      }));
      const xTicks = [35, 45, 55, 65, 75, 85, 90]
        .filter((a) => a >= minAge && a <= maxAge)
        .map((a) => ({ age: a, x: dX(a) }));

      chartArea.innerHTML = `
        <svg viewBox="0 0 ${W} ${H}" width="100%" height="auto" preserveAspectRatio="none">
          <defs>
            <linearGradient id="portGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#11253d" stop-opacity="0.7"/>
              <stop offset="100%" stop-color="#11253d" stop-opacity="0.05"/>
            </linearGradient>
          </defs>
          ${yTicks
            .map(
              (t) => `
            <line x1="${padL}" y1="${t.y}" x2="${W - padR}" y2="${t.y}" stroke="#e0e8ef" stroke-dasharray="3,3" />
            <text x="${padL - 10}" y="${t.y + 4}" text-anchor="end" font-size="14" fill="#536475">${t.label}</text>
          `,
            )
            .join("")}
          ${xTicks
            .map(
              (t) => `
            <line x1="${t.x}" y1="${padT}" x2="${t.x}" y2="${H - padB}" stroke="#edf2f7" />
            <text x="${t.x}" y="${H - padB + 20}" text-anchor="middle" font-size="14" fill="#536475">Age ${t.age}</text>
          `,
            )
            .join("")}

          <path d="${balPath} L ${dX(maxAge)} ${dY(0)} L ${dX(minAge)} ${dY(0)} Z" fill="url(#portGrad)" />
          <path d="${balPath}" fill="none" stroke="#11253d" stroke-width="2.5" />

          <line x1="${dX(summary.retire)}" y1="${padT}" x2="${dX(summary.retire)}" y2="${H - padB}" stroke="#176a65" stroke-width="2" stroke-dasharray="4,4" />
          <text x="${dX(summary.retire)}" y="${padT + 12}" text-anchor="middle" font-size="13" font-weight="bold" fill="#176a65">Retire (${summary.retire})</text>

          <!-- Interactive Scrubber Line -->
          <line id="scrub-line" x1="0" y1="${padT}" x2="0" y2="${H - padB}" stroke="#11253d" stroke-width="1.8" stroke-dasharray="3,3" style="display:none;" />
        </svg>
      `;

      legendEl.innerHTML = `
        <span class="legend-item"><i class="legend-swatch" style="background:#11253d;"></i> Outside Portfolio Balance ($)</span>
        <span class="legend-item"><i class="legend-swatch" style="background:#176a65;"></i> Target Peak at Age ${summary.retire}</span>
      `;
    }

    // Attach precision pointer scrubber event on the chartWrapper
    const scrubLine = $("#scrub-line");
    if (chartWrapper && scrubLine) {
      const handlePointer = (e) => {
        const svgEl = $("#trajectory-chart svg");
        if (!svgEl) return;
        const svgRect = svgEl.getBoundingClientRect();
        const wrapRect = chartWrapper.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;

        // Pixel bounds of the plot area on screen
        const plotScreenLeft = svgRect.left + (padL / W) * svgRect.width;
        const plotScreenWidth = (plotW / W) * svgRect.width;

        // Fraction clamped strictly between 0 and 1
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

        const screenLineX = svgRect.left + (svgX / W) * svgRect.width;
        const tooltipLeft = screenLineX - wrapRect.left;
        const tooltipTop =
          svgRect.top - wrapRect.top + (padT / H) * svgRect.height - 12;

        tooltipEl.hidden = false;
        tooltipEl.style.left = `${tooltipLeft}px`;
        tooltipEl.style.top = `${tooltipTop}px`;

        if (tooltipLeft < 110) {
          tooltipEl.style.transform = "translate(0%, -100%)";
        } else if (tooltipLeft > wrapRect.width - 110) {
          tooltipEl.style.transform = "translate(-100%, -100%)";
        } else {
          tooltipEl.style.transform = "translate(-50%, -100%)";
        }

        tooltipEl.innerHTML = `
          <b>Age ${pt.age} (${pt.year}) · TODAY’S DOLLARS · ${pt.phase.toUpperCase()}</b><br/>
          Spend: <b>${money(pt.monthlySpend)}/mo</b><br/>
          CPF LIFE: <b>${money(pt.monthlyCPF)}/mo</b><br/>
          ${pt.monthlyGap > 0 ? `Gap: <b style="color:#f2d2c4;">${money(pt.monthlyGap)}/mo</b><br/>` : "No income gap<br/>"}
          Portfolio: <b>${money(pt.portfolioBalance)}</b>
        `;
      };

      const handleLeave = () => {
        if (scrubLine) scrubLine.style.display = "none";
        if (tooltipEl) tooltipEl.hidden = true;
      };

      chartWrapper.onmousemove = handlePointer;
      chartWrapper.ontouchmove = (e) => handlePointer(e);
      chartWrapper.onmouseleave = handleLeave;
      chartWrapper.ontouchend = handleLeave;
    }
  };

  // Dynamic Drawdown Sizing
  const renderDrawdownSummary = (r, s, drawdown) => {
    const drawdownContainer = $("#dynamic-drawdown-summary");
    if (!drawdownContainer) return;

    const { gap, cashReserve, ssbLadder, equityCore } = drawdown;

    drawdownContainer.innerHTML = `
      <div class="drawdown-metric">
        <span>Example accessible reserve</span>
        <strong>${money(cashReserve)}</strong>
        <small>Illustrative reserve: 24 months of the retirement-start gap (${money(gap)}/mo) held in accessible high-yield deposits.</small>
      </div>
      <div class="drawdown-metric">
        <span>Example government-bond reserve</span>
        <strong>${money(ssbLadder)}</strong>
        <small>Illustrative five-year allocation in today’s dollars, allowing for the current nominal SSB limit. Allow for existing holdings, inflation and redemption timing.</small>
      </div>
      <div class="drawdown-metric">
        <span>Unallocated longer-term balance</span>
        <strong>${money(equityCore)}</strong>
        <small>How to invest this balance needs a separate risk decision. The model does not simulate an investment transition.</small>
      </div>
      <p class="result-footnote">An illustrative division of the portfolio target, not a recommended asset allocation. Start with the practical actions below.</p>
    `;

    const step1Desc = $("#drawdown-step1-desc");
    if (step1Desc) {
      step1Desc.textContent = `Start with essential bills and review what CPF LIFE and other dependable income can cover. Your modelled total-budget gap at retirement (${r.retire}) is ${money(gap)}/month in today’s dollars; it is not a separate estimate of essential bills. Before committing more to lifelong income, protect accessible money for housing, care and emergencies.`;
    }
    const step2Desc = $("#drawdown-step2-desc");
    if (step2Desc) {
      step2Desc.textContent =
        "List the accounts and investments you actually use. Consider consolidating unnecessary platforms and overlapping holdings, but check transfer costs, tax, surrender charges and access restrictions first. Keep accounts needed for SRS, CPF or essential payments; simplify gradually rather than selling everything at once.";
    }
    const step3Desc = $("#drawdown-step3-desc");
    if (step3Desc) {
      step3Desc.textContent = `Use one main spending account and scheduled monthly transfers, with essential bills on arrangements you can easily review. This illustration sets aside ${money(cashReserve)} as an accessible reserve; choose an amount suited to your needs. Match future maturities to spending dates. SSB redemption is monthly, not instant, and existing holdings use part of the limit.`;
    }
    const step4Desc = $("#drawdown-step4-desc");
    if (step4Desc) {
      step4Desc.textContent =
        "Consider fewer diversified holdings or a suitable service offering automatic rebalancing or withdrawals. Compare fees, risks, withdrawal rules and how easy it is to use. Dividend shares still require monitoring and dividends can fall. No particular stock, platform, allocation or forced sale age is the default.";
    }
  };

  // Printable 1-Page Action Sheet Generator
  const renderPrintSheet = (r, s, drawdown) => {
    const printContainer = $("#print-sheet");
    if (!printContainer) return;

    const { gap, cashReserve, ssbLadder, equityCore } = drawdown;

    printContainer.innerHTML = `
      <div class="print-header">
        <h1 class="print-title">Retirement Shield — Action Plan</h1>
        <p class="print-subtitle">All projections in today’s dollars · ${r.lifestyleLabel} plan · Age ${r.age} · Current Salary ${money(r.salary)}/mo · Target Retirement Age ${r.retire}</p>
      </div>

      <p class="print-funding-summary">At 65: salary CPF path ${money(r.scenarios[0].payout)}/month · budget ${money(r.spend65)}/month · gap ${money(r.scenarios[0].gap65)}/month. All in today’s dollars. Start the savings amounts below from today.</p>
      <div class="print-grid">
        <div class="print-box">
          <h4>Illustrative Funding Target</h4>
          <div class="val">${money(s.totalFunding)}/mo</div>
          <p>${money(s.cpfFunding)}/month saved for higher CPF payouts, starting now until ${Math.min(55, r.retire)}; ${money(s.privateSaving)}/month invested for uncovered spending until ${r.retire}.</p>
        </div>
        <div class="print-box">
          <h4>Outside Portfolio Target</h4>
          <div class="val">${money(s.privateTarget)}</div>
          <p>Today’s purchasing-power equivalent at age ${r.retire}, to fund spending through age 90 (at ${Math.round(r.investmentReturn * 100)}% net return).</p>
        </div>
      </div>

      <table class="print-table">
        <thead>
          <tr>
            <th>Scenario</th>
            <th>CPF funding · 55-equivalent, today’s value</th>
            <th>Payout at 65 · today’s value</th>
            <th>Spending Gap at 65</th>
            <th>Save for higher CPF payouts</th>
            <th>Invest for spending CPF won’t cover</th>
          </tr>
        </thead>
        <tbody>
          ${r.scenarios
            .map(
              (sc) => `
            <tr style="${sc.key === s.key ? "font-weight:bold; background:#edf3f7;" : ""}">
              <td>${sc.label} ${sc.key === s.key ? "★ (Selected)" : ""}</td>
              <td>${money(sc.balance)}</td>
              <td>${money(sc.payout)}/mo</td>
              <td>${money(sc.gap65)}/mo</td>
              <td>${money(sc.cpfFunding)}/mo</td>
              <td>${money(sc.privateSaving)}/mo</td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>

      <h3 style="font-size:12pt; margin-top:16px; margin-bottom:8px;">Illustrative Drawdown Plan</h3><p>Reserve lengths are examples, not recommendations. Allow for existing SSB holdings and future inflation.</p>
      <div class="print-grid">
        <div class="print-box">
          <h4>1. Cash Reserve (24 Months)</h4>
          <div class="val">${money(cashReserve)}</div>
          <p>Liquid cash buffer for immediate living bills and care costs.</p>
        </div>
        <div class="print-box">
          <h4>2. SSB Ladder (Years 3–7)</h4>
          <div class="val">${money(ssbLadder)}</div>
          <p>Safe fixed-income tranche redeemable without capital penalty.</p>
        </div>
      </div>

      <h3 style="font-size:12pt; margin-top:16px;">Make money easier to manage later</h3><p>Cover essential bills with dependable income; consolidate unnecessary accounts after checking costs; automate spending transfers; simplify diversified holdings; review annually. These actions are guidance, not investment changes simulated by the constant-return projection.</p>
      <h3 style="font-size:12pt; margin-top:16px;">Your path to peaceful retirement</h3>
      <ol><li>Refine CPF balances, housing and your retirement budget.</li><li>Choose a sustainable contribution after bills, tax, emergency money and care commitments.</li><li>Review healthcare funding, long-term care cover and backup help.</li><li>Prepare accessible reserves, payout choices, nominations, LPA and will arrangements.</li><li>Trial the budget, plan social contact and review annually.</li></ol>
      <div class="print-disclaimer">
        <b>Planning Assumptions:</b> Projections are in today’s purchasing power, discounted with the selected inflation; monthly saving amounts start now and stay fixed in cash. Core rules checked 9 Nov 2026. 2026 CPF baseline with wage ceiling $8,000. Male-member payout references, interpolated and scaled approximately. ${r.post55Work ? "Post-55 illustration uses announced 2027 rates held constant, capped RA additions discounted to a 55-equivalent; OA excluded." : "Post-55 contributions excluded."} CPF LIFE ${r.plan.toUpperCase()} plan. ${Number((r.inflation * 100).toFixed(2))}% inflation p.a. ${r.lifestyle === "cca" ? "CCA monthly living provision; apartment purchase and move-in costs excluded. Basic-service and additional-care amounts are planning allowances, without automatic subsidies." : "Home + Helper: paid-up 2-room flat with one live-in helper; $300 normal levy retained."} Model illustrations are not official CPF Board quotes or financial advice.
      </div>
    `;
  };

  const guideSteps = [
    {
      title: "Make this estimate yours",
      body: "Check your current CPF balances, housing deduction and a realistic retirement budget. Unknown balances are excluded, so the first answer is a starting point.",
      detail:
        '<button type="button" class="text-button" commandfor="plan-settings" command="show-modal" data-panel="cpf">Review CPF and housing details</button><p>Then use Budget to review spending. In your 20s/30s, building a sustainable habit matters more than meeting a distant projection immediately.</p>',
    },
    {
      title: "Choose a sustainable amount",
      body: "Protect essential bills, tax, emergency money and care for parents. Enter what you can comfortably invest, then review the illustration without pressure to close the whole gap today.",
      detail:
        '<button type="button" class="text-button" commandfor="plan-settings" command="show-modal" data-panel="invest">Review my monthly amount</button><p>In your 40s, reconcile retirement saving with housing, dependants and possible career breaks. Self-employed and platform-worker CPF rules differ; this employee salary model may not fit.</p><a href="https://www.cpf.gov.sg/member/growing-your-savings/cpf-contributions" target="_blank" rel="noreferrer">Explore CPF contribution guidance ↗</a>',
    },
    {
      title: "Check protection and care",
      body: "Review premiums, out-of-pocket treatment costs, mobility and backup care if your usual support is unavailable. Neither preset covers every possible care need.",
      detail:
        '<p>An Integrated Shield Plan includes MediShield Life: count each component once. Review cash and MediSave funding separately. CareShield Life supports severe disability, rather than routine medical bills; check your own coverage.</p><a href="https://www.moh.gov.sg/managing-expenses/schemes-and-subsidies/careshield-life/" target="_blank" rel="noreferrer">Explore long-term care cover ↗</a><p>Review preventive care through Healthier SG, fall prevention and home safety. AIC can help reassess support if daily activities or memory become harder.</p><a href="https://www.aic.sg/Age-Well-Neighbourhood/Plan-Your-Care-Journey" target="_blank" rel="noreferrer">AIC: plan your care journey ↗</a><p>Housing proceeds and government support are excluded from this model. Silver Support eligibility is assessed automatically. Do not assume a two-room flat can produce bedroom-rental income; check HDB eligibility for any monetisation option.</p><a href="https://www.cpf.gov.sg/member/retirement-income/government-support/silver-support-scheme" target="_blank" rel="noreferrer">Explore Silver Support ↗</a><p><a href="https://www.hdb.gov.sg/apply-manage-and-renew-rental-of-bedroom/terms-and-conditions" target="_blank" rel="noreferrer">Check HDB bedroom-rental conditions ↗</a></p>',
    },
    {
      title: "Prepare access and decisions",
      body: "In your 50s, replace generic estimates with personalised CPF figures. Plan accessible spending reserves, SRS access dates and who can help make decisions if you cannot.",
      detail:
        '<p>Advance Care Planning records your health and care preferences; it is separate from the LPA and financial estate arrangements.</p><a href="https://www.healthhub.sg/support-and-tools/support-and-care-programmes/advance-care-planning" target="_blank" rel="noreferrer">Explore Advance Care Planning ↗</a><p>Review CPF payout choices using your actual balances. Keep CPF nominations, a Lasting Power of Attorney and will arrangements as separate preparation tasks.</p><a href="https://www.cpf.gov.sg/member/tools-and-services/calculators" target="_blank" rel="noreferrer">Check personalised CPF figures ↗</a><p><a href="https://www.msf.gov.sg/what-we-do/opg/lasting-power-of-attorney" target="_blank" rel="noreferrer">Explore LPA preparation ↗</a></p><p><a href="https://www.cpf.gov.sg/member/account-services/providing-for-your-loved-ones/making-a-cpf-nomination" target="_blank" rel="noreferrer">Explore CPF nominations ↗</a></p>',
    },
    {
      title: "Practise and review",
      body: "Trial your retirement budget. Make room for friendships, meaningful activity and a trusted contact. Review your plan annually and after changes to work, health or family commitments.",
      detail:
        '<p>Look for activities and regular social contact through a nearby Active Ageing Centre. Connection, mobility and meaningful routines belong in the plan alongside money.</p><a href="https://www.aic.sg/Care-Services" target="_blank" rel="noreferrer">Explore local care and active ageing services ↗</a><p>In your 60s and beyond, review payout timing, care needs and access to spending money. Use Drawdown below as a starting guide and personalise the cash reserve to your circumstances.</p><a href="#later-life">Explore drawdown guidance</a>',
    },
  ];
  const renderGuide = () => {
    const content = $("#guide-content");
    if (!content) return;
    const step = guideSteps[guideStep];
    content.innerHTML = step
      ? `<p class="guide-progress">Step ${guideStep + 1} of 5 · move at your own pace</p><h4 tabindex="-1" id="guide-step-title">${step.title}</h4><p>${step.body}</p><details><summary>Explore this step</summary>${step.detail}</details><div class="guide-actions"><button type="button" class="button button-dark" data-guide="next">Done — next step</button><button type="button" class="text-button" data-guide="skip">Skip for now</button></div>${guideStep ? '<details><summary>Revisit an earlier step</summary><button type="button" class="text-button" data-guide="back">Previous step</button></details>' : ""}`
      : '<h4 tabindex="-1" id="guide-step-title">Your next review is yours to choose.</h4><p>You have reached the end of the guide. Skipped steps may still need attention. Revisit the guide whenever circumstances change.</p><button type="button" class="text-button" data-guide="restart">Revisit the steps</button>';
  };
  out.addEventListener("click", (event) => {
    const action = event.target.closest("[data-guide]")?.dataset.guide;
    if (!action) return;
    guideStep =
      action === "restart"
        ? 0
        : action === "back"
          ? Math.max(0, guideStep - 1)
          : Math.min(5, guideStep + 1);
    if (savingEnabled)
      try {
        localStorage.setItem("rs_guide_step", String(guideStep));
      } catch (_) {}
    renderGuide();
    $("#guide-step-title")?.focus({ preventScroll: true });
  });

  const render = () => {
    $("#known-retire").min =
      $("#known-lifestyle").value === "cca" ? "55" : "40";
    const comparisonOpen = out.querySelector(".path-comparison")?.open || false;
    const guideOpen = out.querySelector("#retirement-guide")?.open || false;
    const p = {};
    for (const [key, id] of Object.entries(fields)) {
      const input = $("#" + id);
      if (!input) continue;
      const val = input.value.trim();
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
            "CCA currently requires age 55 or above. This preset assumes moving in at retirement: choose 55 or later, or Home + Helper for an earlier retirement illustration.",
          );
          return;
        }
        if (key === "age" && Number(val) >= 55) {
          setError(
            "This salary illustration supports ages 18–54. From 55, your Retirement Account and actual balances need a different calculation. You can still explore the spending and drawdown guidance below.",
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
      if (key === "plan" || key === "lifestyle") {
        p[key] = val;
      } else if (key === "post55Work") {
        p[key] = val === "true";
      } else {
        p[key] = Number(val);
      }
    }

    let r;
    try {
      r = RetirementModel.todayPlan(RetirementModel.calculate(p));
    } catch (e) {
      setError(e.message);
      return;
    }

    persistState(p);
    renderLifestyle(r);
    $("#print-plan-btn").disabled = false;

    $("#settings-error").textContent = "";
    $("#baseline-summary").textContent =
      `${money(r.todaySpend)}/month in today’s prices · retire at ${r.retire} · ${r.plan === "escalating" ? "Escalating CPF LIFE" : "Standard CPF LIFE"}`;
    const ers = r.scenarios.find((x) => x.key === "ers"),
      frs = r.scenarios.find((x) => x.key === "frs"),
      s = r.scenarios.find((x) => x.key === selected) || r.scenarios[0];
    const unit = r.retiringNow ? " now" : "/mo";
    const year65 = RetirementModel.C.year + 65 - r.age,
      year75 = year65 + 10;
    const pathName = {
      salary: "Salary CPF only",
      frs: "Build up to FRS",
      ers: "Build up to ERS",
    };
    const descriptions = {
      salary:
        "What salary contributions could build, without saving extra for higher CPF payouts.",
      frs: "Add savings to reach the Full Retirement Sum at 55.",
      ers: "Add savings to reach the Enhanced Retirement Sum at 55, subject to eligible transfers or top-ups.",
    };
    const incomeLabel = s.key === "salary" ? "Salary CPF" : s.key.toUpperCase();
    let verdict;
    if (s.gap65 > 0.005)
      verdict = `${s.key === "salary" ? "Salary CPF alone" : s.key.toUpperCase()} leaves a gap in this model.`;
    else if (s.gap75 > 0.005)
      verdict = `${incomeLabel} covers age 65, but falls behind by 75.`;
    else if (s.firstShortfallAge != null)
      verdict = `A spending gap appears around age ${Math.floor(s.firstShortfallAge)}.`;
    else verdict = `${incomeLabel} covers modelled spending from 65 to 90.`;

    const timeline = (age, year, spend, gap, payout) =>
      `<article><span>AGE ${age} · TODAY’S DOLLARS</span><div class="coverage-number"><b>${money(spend)}</b><small>spending / month · today’s value</small></div><div class="income-coverage" role="img" aria-label="CPF covers ${Math.round(spend ? Math.min(100, (payout / spend) * 100) : 100)} percent of spending"><i style="width:${spend ? Math.min(100, (payout / spend) * 100) : 100}%"></i></div><p>${incomeLabel} income <b>${money(payout)}/mo</b></p><strong>${gap > 0.005 ? `${money(gap)}/mo to fund outside CPF` : "No spending gap at this age"}</strong></article>`;
    const signedMoney = (value) =>
      value < 0 ? `−${money(-value)}` : money(value);
    const remaining = r.afterCpf - s.totalFunding;
    const salaryPath = r.scenarios[0];
    const fundingSnapshot = `<div class="funding-snapshot"><p>${r.refined ? "What your CPF details and salary path could cover" : "What salary CPF alone could cover"} at 65 · today’s dollars</p><dl><div><dt>${r.refined ? "CPF income with entered details" : "Income from salary CPF"}</dt><dd>${money(salaryPath.payout)}<small>/month from 65</small></dd></div><div><dt>Your retirement budget</dt><dd>${money(r.spend65)}<small>/month at 65</small></dd></div><div><dt>Monthly gap after salary CPF</dt><dd>${money(salaryPath.gap65)}<small>/month at 65</small></dd></div></dl><p class="snapshot-note">${s.key !== "salary" ? `Your selected ${s.key.toUpperCase()} path could instead provide ${money(s.payout)}/month from 65, leaving ${money(s.gap65)}/month to fund at that age. Its additional savings are below.` : "Your investment pot needs to fund this gap and changing costs through age 90."} ${r.retire < 65 ? `Retiring at ${r.retire} also requires funding the years before CPF LIFE starts at 65.` : ""}</p></div>`;

    const housingNote =
      p.housing == null
        ? "All future OA is assumed spent on housing."
        : `OA housing use: ${money(p.housing)}/month.`;
    const balanceNote =
      p.oa == null && p.sa == null
        ? "Current OA and SA balances are unknown and excluded."
        : `Starting OA ${money(p.oa || 0)} + SA ${money(p.sa || 0)}.`;

    $("#plan-status").textContent =
      `${verdict} Based on age ${r.age}, gross salary ${money(r.salary)} a month. ${pathName[s.key]}: ${money(s.privateSaving)} ${r.retiringNow ? "capital gap today" : "a month invested for retirement"}, plus ${money(s.cpfFunding)} ${r.retiringNow ? "capital reserved today" : "a month saved for higher CPF payouts"}.`;

    out.innerHTML = `<section class="salary-context card-surface" aria-labelledby="salary-context-title"><div class="context-heading"><div><p class="form-kicker">WHAT GOES INTO CPF AUTOMATICALLY</p><h3 id="salary-context-title">Age ${r.age} · ${money(r.salary)} gross salary / month</h3></div><a class="text-link dark-link" href="#quick-form">Edit age or salary ↑</a></div><div class="salary-flow"><div><span>Deducted from salary · 20%</span><strong>${money(r.employeeCpf)}</strong></div><div><span>Employer adds · 17%</span><strong>${money(r.employerCpf)}</strong></div><div><span>Total to CPF / month</span><strong>${money(r.contribution)}</strong></div><div><span>Salary after employee CPF</span><strong>${money(r.afterCpf)}</strong></div></div><p class="account-split">Current monthly split: <b>OA ${money(r.currentOA)}</b> · <b>SA ${money(r.currentSA)}</b> · <b>MA ${money(r.currentMA)}</b>. Rounded; allocations change with age. MA is reserved for healthcare.</p><div class="projection-context"><p><b>Salary CPF projected at 55: ${money(r.cpfAt55 || r.cpf)}</b> · ${r.cpfAt55 >= r.frs ? "FRS reached at 55 in this illustration" : `${money(r.frs - r.cpfAt55)} below FRS at 55`}.${r.extraPost55CPF ? ` Later RA additions add an age-55 funding equivalent of ${money(r.extraPost55CPF)}; this is not your actual balance at 55.` : ""}${r.post55Work ? ` Post-55 OA of ${money(r.post55OA)} is excluded from payouts and outside investments.` : ""}</p><p>Age-55 targets (today’s purchasing power): FRS ${money(r.frs)} · ERS ${money(r.ers)}.</p><p>${balanceNote} ${housingNote} <button type="button" class="text-button" commandfor="plan-settings" command="show-modal" data-panel="cpf">Add balances / change housing ↗</button></p></div><details class="context-details"><summary>How this salary projection works</summary><p>Full citizen/third-year PR rates; CPF wages capped at $8,000/month. Salary is held constant. Contributions are modelled until 55 by default. The optional senior illustration includes RA additions up to age 65 or retirement, whichever comes first; OA stays separate. Under 2025/2026 CPF rules, your Special Account (SA) closes at age 55; balances up to FRS form your Retirement Account (RA) earning at least 4% p.a., with any excess funds moving to OA (2.5%) unless topped up to the Enhanced Retirement Sum (ERS). Extra interest, bonuses, and MA overflow are excluded for conservative planning.</p><a class="text-link dark-link" href="https://www.cpf.gov.sg/employer/employer-obligations/how-much-cpf-contributions-to-pay" target="_blank" rel="noreferrer">CPF contribution rules ↗</a></details></section>
    <div class="verdict-card"><p class="form-kicker">YOUR CPF FOUNDATION</p><h3>CPF could provide ${money(s.payout)}/month in today’s dollars at 65.</h3><p>${verdict} Your next step is to check the balances and budget behind this estimate.</p><p>All projections below are in <b>today’s purchasing power</b> (rounded; totals may differ slightly), so spending and income can be compared directly. Your starting budget is <b>${money(r.todaySpend)}/month today</b>. CPF LIFE follows the <b>${r.plan === "escalating" ? "Escalating" : "Standard"}</b> plan.</p><div class="gap-timeline">${timeline(65, year65, r.spend65, s.gap65, s.payout)}${timeline(75, year75, r.spend75, s.gap75, s.payout75 || s.payout)}</div><details class="verdict-calculation"><summary>How are today’s-dollar amounts calculated?</summary><p>Each future amount is divided by (1 + ${(r.inflation * 100).toFixed(1)}% inflation) for every year from your current age to the age shown. Both spending and CPF income use the same conversion.</p><p>At 65, the purchasing-power equivalent of your living budget is ${money(r.spend65)}/month. ${r.lifestyle === "home-helper" ? "It can be below your starting budget because the model holds the nominal helper levy fixed." : "CCA has no helper levy; the full budget rises with general inflation, and the care allowance rises after 65."} After 65, an age-related care allowance can raise real spending. Standard CPF LIFE stays flat in cash, so its purchasing power falls; Escalating rises by 2% in cash each year and can still lag inflation.</p><p>Monthly savings targets are the actual amounts to start with now. The model keeps those cash contributions unchanged; it does not assume annual increases. Investment return is nominal, after fees. Future balances and payout comparisons are converted to today’s dollars for display only.</p></details><p class="verdict-note">Viewing: <b>${pathName[s.key]}</b>. ${s.key === "salary" ? "This uses projected salary CPF up to FRS. Compare the fully funded FRS or ERS scenarios below." : "This assumes the CPF target is fully funded. The extra savings required are shown below."} Actual balances, future rules and pricing can change the answer.</p></div>
    <details class="path-comparison" ${comparisonOpen ? "open" : ""}><summary>What if I save extra to reach FRS or ERS?</summary><div class="comparison-heading"><h3>Same salary. Three ways to fund retirement.</h3><p>All three use age ${r.age}, gross salary ${money(r.salary)}/month and the same budget. Your automatic ${money(r.contribution)}/month CPF contribution is already included. Amounts labelled extra come from your ${money(r.afterCpf)} salary after employee CPF.</p></div>
    <div class="scenario-grid">${r.scenarios.map((path) => `<article class="scenario-card${path.key === selected ? " is-selected" : ""}"><span class="scenario-title">${pathName[path.key]}</span><p>${descriptions[path.key]}</p><strong>${money(path.payout)}<small>/month at 65 · today’s dollars</small></strong><dl><div><dt>CPF funding · age-55 equivalent, today’s value</dt><dd>${money(path.balance)}</dd></div><div><dt>Spending gap at 65</dt><dd>${money(path.gap65)}/mo</dd></div><div><dt>Save for higher CPF payouts</dt><dd>${money(path.cpfFunding)}<small>${r.retiringNow ? "needed now" : `per month, starting now until age ${Math.min(55, r.retire)}`}</small></dd></div><div class="outside-goal"><dt>Invest for spending CPF won’t cover</dt><dd>${money(path.privateSaving)}<small>${r.retiringNow ? "needed now" : `per month, starting now until age ${r.retire}`}</small></dd></div></dl><button type="button" class="scenario-select" data-path="${path.key}" aria-pressed="${path.key === selected}">${path.key === selected ? "Viewing this path" : "Explore this path"} →</button></article>`).join("")}</div></details>
    <section class="selected-funding card-surface" id="funding-steps" aria-labelledby="selected-path-title"><div class="funding-heading"><div><p class="form-kicker">YOUR FUNDING TARGET</p><h3 id="selected-path-title">What to do from today</h3></div><button type="button" class="text-button" commandfor="plan-settings" command="show-modal" data-panel="invest">Set an affordable monthly amount ↗</button></div>
      ${fundingSnapshot}
      <p class="funding-start">${r.retiringNow ? `For your selected ${pathName[s.key]} path, the model needs ${money(s.totalFunding)} in additional capital today.` : `Start with an illustrative target of <b>${money(s.totalFunding)}/month saved from today</b> for this plan (${pathName[s.key]}), split below.`} Amounts are additional to payroll CPF.</p>
      ${p.invest != null && !r.retiringNow ? `<p class="funding-start">Your entered ${money(p.invest)}/month investment already counts towards the investment target. ${s.contributionShortfall > 0.005 ? `Increase it by about ${money(s.contributionShortfall)}/month to reach that target.` : "No increase is needed to reach the illustrated investment target."} ${s.cpfFunding > 0.005 ? "The CPF-target provision below is separate." : ""}</p>` : ""}
      <div class="funding-pots"><article><span>Save for higher CPF payouts</span><strong>${money(s.cpfFunding)}<small>${s.cpfFunding <= 0.005 ? "No additional CPF saving in this path" : r.retiringNow ? "capital needed now" : `per month, starting now until age ${Math.min(55, r.retire)}`}</small></strong><p>${s.cpfGap > 0.005 ? `Build money earmarked for your ${s.key.toUpperCase()} CPF target. This is a savings provision, not a compulsory monthly CPF top-up.${s.key === "ers" ? " ERS money may need to stay outside CPF until an eligible transfer from 55." : ""}` : "No extra CPF saving is assumed for this path. Your salary CPF contributions fund its modelled payouts."}</p></article><article><span>Invest for spending CPF won’t cover</span><strong>${money(s.privateSaving)}<small>${r.retiringNow ? "capital shortfall now" : `per month, starting now until age ${r.retire}`}</small></strong><p>Build a pot worth ${money(s.privateTarget)} in today’s dollars by age ${r.retire}, to pay the spending left after CPF through age 90.${s.gap65 <= 0.005 && s.privateSaving > 0.005 ? " Although CPF covers the modelled budget at 65, this pot helps fund rising costs later." : ""}</p></article></div>
      <div class="funding-total"><span>${r.retiringNow ? "Additional capital required today" : "Your starting monthly saving target"}</span><strong>${money(s.totalFunding)}${unit}</strong><small>${r.retiringNow ? "Compare these capital needs with available assets." : `${money(s.cpfFunding)} towards CPF and ${money(s.privateSaving)} invested for retirement each month. This does not include the ${money(r.employeeCpf)} already deducted as employee CPF.`}</small></div>
      ${r.retiringNow ? "" : `<div class="take-home-check"><span>What that leaves for today’s bills and tax</span><p>${money(r.afterCpf)} salary after CPF − ${money(s.totalFunding)} extra savings = <b>${signedMoney(remaining)}/month</b></p><small>${remaining < 0 ? "This plan exceeds the salary available. Review the target, balances, spending or retirement age." : "This is the amount left before your current living costs, income tax and emergency savings."}</small></div><p class="funding-phase">${s.cpfFunding <= 0.005 ? `This path uses salary CPF without additional CPF-target savings. Keep the separate investment amount going until retirement at ${r.retire}, then review your withdrawals.` : r.retire > 55 ? `At 55, the ${money(s.cpfFunding)}/month CPF-target provision ends. Continue the ${money(s.privateSaving)}/month investment until retirement at ${r.retire}.` : `Savings stop at retirement (${r.retire}); any CPF-target reserve is assumed to grow until 55.`}</p>`}
      <details class="result-details"><summary>What to check before using this target</summary>      <p class="funding-caution">Monthly amounts below are what to start saving now; the model keeps them fixed in cash. Future balances are shown in today’s purchasing power. This is a planning target, not an amount you must invest now. ${!r.refined ? "Existing CPF is excluded and future OA is assumed used for housing." : "Your entered balances are included."} Protect current bills, tax, emergency savings and care for parents before choosing a monthly amount.</p>
      <p class="funding-caution">${r.scenarios[0].firstShortfallAge === null ? "Your salary path already covers modelled spending from 65 to 90. A higher CPF target is optional; compare the extra lock-in and liquidity before funding it." : s.totalFunding > r.afterCpf && !r.retiringNow ? "This exceeds salary after employee CPF. Add actual balances, review the budget or retirement date, and check affordability before using these contribution amounts." : !r.refined ? "This starts from salary alone: existing CPF is excluded and future OA is assumed used for housing. Add known balances in Settings to refine any apparent target shortfall." : "Your entered CPF and housing details refine the salary projection. Check the two funding pots against your emergency reserve and current bills."}</p>
<p>${s.gap65 <= 0.005 ? "Even with no gap at 65, rising care costs and inflation can still require investment withdrawals later." : "The monthly saving builds capital over time; the monthly spending gap is what that capital helps fund after retirement."} Future balances use today’s purchasing power, and the model keeps your monthly cash contributions fixed.</p></details>
      <div class="investment-impact"><span class="form-kicker">WHAT OUTSIDE INVESTING ADDS</span><h4>${r.retiringNow ? "Compare your portfolio with the gap today" : `Starting with ${money(s.chosenInvest)}/month could build ${money(s.illustratedPortfolio)} in today’s dollars by ${r.retire}.`}</h4><p>${r.retiringNow ? `Your entered portfolio is ${money(s.illustratedPortfolio)} against a ${money(s.privateTarget)} target.` : `This includes ${money(Number(p.savings || 0))} already invested and assumes ${Math.round(r.investmentReturn * 100)}% nominal net annual growth. Portfolio values shown are in today’s dollars. The CPF-target reserve is excluded from this portfolio.`}</p><p><b>${s.remainingPortfolioGap > 0.5 ? `${money(s.remainingPortfolioGap)} portfolio shortfall remains${!r.retiringNow && p.invest != null ? `; roughly ${money(s.contributionShortfall)}/month more than your entered amount is needed` : ""}.` : "That reaches this portfolio target in the steady-return illustration."}</b></p><small>Investment withdrawals fund a finite period, not guaranteed lifelong income. Market falls, tax, fees and living beyond 90 can change the result.</small></div>
      ${selected === "ers" ? `<details class="result-details"><summary>What choosing ERS changes compared with FRS</summary><p class="result-detail-copy">ERS lowers the outside-investment target by ${money(Math.max(0, frs.privateSaving - ers.privateSaving))}${unit}, while requiring ${money(Math.max(0, ers.cpfFunding - frs.cpfFunding))}${unit} more earmarked for CPF. More CPF income needs funding first; compare liquidity and the combined commitment, not the payout alone.</p></details>` : ""}
      <details class="result-details"><summary>How to use this funding path</summary><ol class="personal-steps"><li>Keep emergency cash and housing money accessible before funding long-term targets.</li><li>Check your CPF dashboard to refine the projected target gap (${money(s.cpfGap)} in today’s purchasing power at 55). The reserve is a funding equivalent, not an instruction to top up that amount every month. ERS may require holding money outside CPF until an eligible RA top-up or transfer after 55.</li><li>Fund the separate outside-CPF investment pot. If using SRS, count those investments once and allow for access dates and withdrawal tax.</li><li>Review annually. Match the next spending years with cash and bond maturities as retirement gets closer.</li></ol><p class="result-footnote">An illustrative ${money(r.topup)} cash top-up now could compound to ${money(r.early)} in today’s dollars by 55, versus ${money(r.later)} if delayed ${r.delay} years at 4% nominal growth, after removing general inflation for display. (Under the CPF Retirement Sum Topping-Up Scheme, you can enjoy tax relief on cash top-ups of up to S$8,000 per calendar year for yourself). Actual eligibility and liquidity come first.</p>${r.housingShortfall ? `<p class="result-footnote">Your housing entry exceeds available OA by ${money(r.housingShortfall)} in today’s purchasing power across the projection; that needs another funding source.</p>` : ""}<a class="text-link dark-link" href="https://www.cpf.gov.sg/member/tools-and-services/calculators" target="_blank" rel="noreferrer">Check personalised CPF payouts ↗</a></details>
    </section>
    <p class="comparison-footnote">Income references use CPF Board’s male-member examples starting at 65; interpolated and future-scaled payouts are approximate. CPF and investment results are illustrations, not personalised quotes or promised returns. CPF LIFE continues for life; the portfolio models spending only to 90. ${r.retire < 65 ? `Your portfolio target includes the bridge from age ${r.retire} to 65.` : ""}</p>`;

    // Answer first; keep payroll mechanics available under progressive disclosure.
    const salary = out.querySelector(".salary-context");
    const payroll = document.createElement("details");
    payroll.className = "result-details payroll-details";
    const payrollSummary = document.createElement("summary");
    payrollSummary.textContent =
      "Explore your salary CPF and housing assumptions";
    payroll.append(payrollSummary, salary);
    out.querySelector(".verdict-card").after(payroll);
    const guide = document.createElement("details");
    guide.className = "result-details retirement-guide";
    guide.id = "retirement-guide";
    guide.innerHTML =
      '<summary>Your path to peaceful retirement</summary><div id="guide-content"></div>';
    out.querySelector("#funding-steps").append(guide);
    guide.open = guideOpen;
    renderGuide();

    // Trajectory generation and chart update
    currentTrajectory = RetirementModel.todayTrajectory(
      RetirementModel.generateTrajectory(p, selected),
    );
    renderTrajectoryChart(currentTrajectory);

    // Dynamic drawdown update
    const nominal = currentTrajectory.summary;
    const nominalScenario = currentTrajectory.selectedScenario;
    const drawdown = RetirementModel.drawdownToday(nominal, nominalScenario);
    renderDrawdownSummary(r, s, drawdown);

    // Printable action plan update
    renderPrintSheet(r, s, drawdown);
  };

  Object.values(fields).forEach((id) => {
    const el = $("#" + id);
    if (el) el.addEventListener("input", render);
  });

  out.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-path]");
    if (button) {
      selected = button.dataset.path;
      render();
      $(`button[data-path="${selected}"]`)?.focus({ preventScroll: true });
      return;
    }
  });

  $("#btn-zero-housing").addEventListener("click", () => {
    $("#known-housing").value = "0";
    render();
  });

  $("#btn-chart-cashflow")?.addEventListener("click", () => {
    chartMode = "cashflow";
    $("#btn-chart-cashflow").setAttribute("aria-pressed", "true");
    $("#btn-chart-portfolio").setAttribute("aria-pressed", "false");
    $("#btn-chart-cashflow").classList.add("is-active");
    $("#btn-chart-portfolio").classList.remove("is-active");
    if (currentTrajectory) renderTrajectoryChart(currentTrajectory);
  });

  $("#btn-chart-portfolio")?.addEventListener("click", () => {
    chartMode = "portfolio";
    $("#btn-chart-cashflow").setAttribute("aria-pressed", "false");
    $("#btn-chart-portfolio").setAttribute("aria-pressed", "true");
    $("#btn-chart-portfolio").classList.add("is-active");
    $("#btn-chart-cashflow").classList.remove("is-active");
    if (currentTrajectory) renderTrajectoryChart(currentTrajectory);
  });

  $("#print-plan-btn")?.addEventListener("click", () => {
    window.print();
  });

  $("#clear-saved-plan").addEventListener("click", () => {
    savingEnabled = false;
    guideStep = 0;
    try {
      localStorage.removeItem("rs_plan_state");
      localStorage.removeItem("rs_guide_step");
      sessionStorage.setItem("rs_private_mode", "true");
    } catch (_) {}
    history.replaceState(null, "", location.pathname + location.search);
    Object.values(fields).forEach((id) => {
      const el = $("#" + id);
      el.value =
        el.tagName === "SELECT"
          ? ([...el.options].find((o) => o.defaultSelected) || el.options[0])
              .value
          : el.defaultValue;
    });
    selected = "salary";
    render();
    $("#settings-error").textContent =
      "Saved plan cleared. The editable example is shown; saving is off for this visit.";
  });

  $("#reset-settings").addEventListener("click", () => {
    Object.values(fields)
      .filter((id) => id.startsWith("known-"))
      .forEach((id) => {
        const el = $("#" + id);
        if (el)
          el.value =
            el.tagName === "SELECT"
              ? (
                  [...el.options].find((option) => option.defaultSelected) ||
                  el.options[0]
                ).value
              : "";
      });
    selected = "salary";
    render();
  });

  render();
}

function setupSettings() {
  const dialog = $("#plan-settings"),
    tabs = $$('.settings-tabs [role="tab"]');
  let lastInvoker = null;
  let modalPagePosition = null;
  const rememberPagePosition = () => {
    modalPagePosition = { x: window.scrollX, y: window.scrollY };
  };
  dialog.addEventListener("beforetoggle", (event) => {
    if (event.newState === "open") rememberPagePosition();
  });
  window.addEventListener(
    "scroll",
    () => {
      if (
        dialog.open &&
        modalPagePosition &&
        (window.scrollX !== modalPagePosition.x ||
          window.scrollY !== modalPagePosition.y)
      )
        window.scrollTo({
          left: modalPagePosition.x,
          top: modalPagePosition.y,
          behavior: "instant",
        });
    },
    { passive: true },
  );
  // Native dialog keeps focus inert; contain gestures for browsers where
  // non-scrollable/backdrop overscroll containment is not yet enforced.
  // Do not change root overflow or remove the page scrollbar.
  const insideDialog = (point) => {
    const rect = dialog.getBoundingClientRect();
    return (
      point.clientX >= rect.left &&
      point.clientX <= rect.right &&
      point.clientY >= rect.top &&
      point.clientY <= rect.bottom
    );
  };
  const canScroll = (target, dx, dy) => {
    const vertical = Math.abs(dy) >= Math.abs(dx);
    const delta = vertical ? dy : dx;
    for (
      let el = target instanceof Element ? target : target?.parentElement;
      el && dialog.contains(el);
      el = el.parentElement
    ) {
      const style = getComputedStyle(el);
      const overflow = vertical ? style.overflowY : style.overflowX;
      const position = vertical ? el.scrollTop : el.scrollLeft;
      const maximum = vertical
        ? el.scrollHeight - el.clientHeight
        : el.scrollWidth - el.clientWidth;
      if (
        /auto|scroll/.test(overflow) &&
        maximum > 0 &&
        (delta < 0 ? position > 0 : position < maximum - 1)
      )
        return true;
      if (el === dialog) break;
    }
    return delta === 0;
  };
  document.addEventListener(
    "wheel",
    (event) => {
      if (!dialog.open || event.ctrlKey) return;
      if (
        !insideDialog(event) ||
        !canScroll(event.target, event.deltaX, event.deltaY)
      )
        event.preventDefault();
    },
    { passive: false },
  );
  document.addEventListener("keydown", (event) => {
    if (
      !dialog.open ||
      event.defaultPrevented ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    )
      return;
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest('input, textarea, select, [contenteditable="true"]')
    )
      return;
    if (
      event.key === " " &&
      target instanceof Element &&
      target.closest('button, a, summary, [role="button"]')
    )
      return;
    const direction = {
      ArrowDown: 1,
      PageDown: 1,
      End: 1,
      ArrowUp: -1,
      PageUp: -1,
      Home: -1,
      " ": event.shiftKey ? -1 : 1,
    }[event.key];
    if (direction && !canScroll(target, 0, direction)) event.preventDefault();
  });
  let touchPoint = null;
  document.addEventListener(
    "touchstart",
    (event) => {
      touchPoint =
        dialog.open && event.touches.length === 1 ? event.touches[0] : null;
    },
    { passive: true },
  );
  document.addEventListener(
    "touchmove",
    (event) => {
      if (!dialog.open || !touchPoint || event.touches.length !== 1) return;
      const next = event.touches[0];
      const dx = touchPoint.clientX - next.clientX,
        dy = touchPoint.clientY - next.clientY;
      if (!insideDialog(next) || !canScroll(event.target, dx, dy))
        event.preventDefault();
      touchPoint = next;
    },
    { passive: false },
  );
  document.addEventListener(
    "touchend",
    () => {
      touchPoint = null;
    },
    { passive: true },
  );

  const selectSettingsTab = (name) => {
    tabs.forEach((tab) => {
      const active = tab.id === "tab-" + name;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      const panel = $("#" + tab.getAttribute("aria-controls"));
      if (panel) panel.hidden = !active;
    });
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () =>
      selectSettingsTab(tab.id.replace("tab-", "")),
    );
    tab.addEventListener("keydown", (event) => {
      let i = index;
      if (event.key === "ArrowRight") i = (i + 1) % tabs.length;
      else if (event.key === "ArrowLeft")
        i = (i + tabs.length - 1) % tabs.length;
      else if (event.key === "Home") i = 0;
      else if (event.key === "End") i = tabs.length - 1;
      else return;
      event.preventDefault();
      selectSettingsTab(tabs[i].id.replace("tab-", ""));
      tabs[i].focus();
    });
  });
  document.addEventListener("click", (event) => {
    const button = event.target.closest('button[commandfor="plan-settings"]');
    if (!button) return;
    const command = button.getAttribute("command");
    if (command === "show-modal") {
      if (!dialog.open) rememberPagePosition();
      lastInvoker = button;
      if (button.dataset.panel) selectSettingsTab(button.dataset.panel);
      button.setAttribute("aria-expanded", "true");
    }
    if (!("commandForElement" in HTMLButtonElement.prototype)) {
      event.preventDefault();
      if (command === "show-modal") dialog.showModal();
      else dialog.close();
    }
  });
  dialog.addEventListener("close", () => {
    modalPagePosition = null;
    $$('button[command="show-modal"]').forEach((button) =>
      button.setAttribute("aria-expanded", "false"),
    );
    if (lastInvoker?.isConnected) lastInvoker.focus({ preventScroll: true });
    else $(".settings-trigger").focus({ preventScroll: true });
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
    button.setAttribute("aria-controls", "plan-settings");
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

function setupOfflineStatus() {
  const label = $("#offline-label");
  let prepared = false;
  const update = () => {
    label.textContent = !navigator.onLine
      ? "Offline mode"
      : prepared
        ? "Works offline"
        : "Preparing offline";
  };
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  update();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("sw.js", { updateViaCache: "none" })
      .then(() => navigator.serviceWorker.ready)
      .then(() => {
        prepared = true;
        update();
      })
      .catch(() => {
        label.textContent = "Browser mode";
      });
  } else label.textContent = "Browser mode";
}

setupCareBreakdown();
setupSimplePlan();
setupDrawdownSteps();
setupSettings();
setupDeepLinks();
setupOfflineStatus();
$$("form").forEach((form) =>
  form.addEventListener("submit", (event) => event.preventDefault()),
);
