import { $, m, compactMoney, formatDobShort } from "./format.js";
import { buildExpensePieSVG } from "./views-expense.js";
import { renderStackedNetWorthSVG } from "./charts.js";
import {
  getMilestoneNodes,
  buildFundingSourcesList,
  buildFinReadinessGaugeSVG,
} from "./views-overview.js";

export function renderPrintSheet({
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
    s.key === "brs" ? "BRS Pledge" : s.key === "ers" ? "ERS Path" : "FRS Path";
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
  const printEndAge = pm.endAge || fire.endAge || 95;
  const projFireAge = fn.projectedFireAge;
  const diffYears = projFireAge == null ? null : fire.retire - projFireAge;
  const depletionAgeDisplay =
    fn.depletionAge != null ? Math.floor(fn.depletionAge) : printEndAge;
  const survivalAnswer = fn.fullyFundedTo95
    ? `Lasts past age ${printEndAge}+`
    : `Lasts to age ${depletionAgeDisplay}`;
  const safeAgeAnswer =
    diffYears == null
      ? "After age 80"
      : diffYears > 0
        ? `Age ${projFireAge} (-${diffYears} yr${diffYears > 1 ? "s" : ""} early)`
        : diffYears === 0
          ? `Age ${projFireAge} (on target)`
          : `Age ${projFireAge} (+${-diffYears} yr${-diffYears > 1 ? "s" : ""})`;
  const deltaLine = `${pm.pctFunded}% of age-${printEndAge} goal`;
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
      ? `Age ${r.retire}: ${m(r.futureSpend, "/mo")} · Age 65: ${m(r.spend65, "/mo")}`
      : `Age 65 est: ${m(r.spend65, "/mo")}`;

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
              <span>Gross ${m(r.salary)} · Net ${m(r.afterCpf, "/mo")}${annualBonusVal > 0 ? ` · Bonus ${m(annualBonusVal, "/yr")}` : ""}</span>
              <span>${pm.budgetChipLabel}</span>
              <span>CPF LIFE ${r.plan === "escalating" ? "Escalating +2%" : "Standard"}</span>
              <span>${pm.housingChipLabel}</span>
              ${srsAnnualVal > 0 || startingSrs > 0 ? `<span class="${sa.srsIdleActive ? "is-warn-chip" : ""}">SRS ${srsAnnualVal > 0 ? m(srsAnnualVal, "/yr") : compactMoney(startingSrs)} · ${srsInvestLabel} · Age ${srsLockAge}</span>` : ""}
              ${maSpendVal > 0 ? `<span>MA deduct ${m(maSpendVal, "/mo")}${r.maShortfallToday > 0 ? ` (Shortfall ${compactMoney(r.maShortfallToday)})` : ""}</span>` : ""}
              ${existingReliefsVal !== 1000 ? `<span>Reliefs ${m(existingReliefsVal, "/yr")}</span>` : ""}
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
            <div><strong>${m(r.afterCpf, "/mo")}</strong><span class="poster-pill">${takeHomePctOfGross}% net on ${m(r.salary)}</span></div>
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
            <h2>Net Worth Trajectory (Age ${r.age}–${printEndAge})</h2>
            <div class="poster-swell-keys">
              <span><i class="is-pink"></i>${Math.min(55, pm.retireAge)}+ Wealth</span>
              <span><i class="is-slate"></i>Pre-${Math.min(55, pm.retireAge)} Base</span>
              <span><i class="is-line"></i>Trend</span>
            </div>
          </div>
          <div class="poster-nw-kpis">
            <div class="poster-nw-kpi">
              <small>Net Worth at Age ${pm.retireAge}</small>
              <strong>${m(pm.projectedAtRetire)}</strong>
              <span class="poster-nw-delta">${pm.pctFunded > 100 ? "100%+" : `${Math.max(0, Math.round(pm.pctFunded || 0))}%`} funded to ${printEndAge}</span>
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
            <h2>Top Funding Sources</h2>
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
            <h2>Retirement Readiness</h2>
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
            printEndAge,
          )}
          <div class="poster-gauge-facts">
            <div class="poster-gauge-fact">
              <span>Retiring at ${fire.retire}</span>
              <strong class="${fn.fullyFundedTo95 ? "is-good" : "is-warn"}">${survivalAnswer}</strong>
            </div>
            <div class="poster-gauge-fact">
              <span>Safe age (to ${printEndAge})</span>
              <strong>${safeAgeAnswer}</strong>
            </div>
          </div>
        </div>
      </section>

      <section class="poster-bottom-grid">
        <div class="poster-panel poster-strategy-panel">
          <div class="poster-panel-head">
            <h2>CPF Path &amp; Action Plan</h2>
            <small>Today’s $ · ${pm.customSavingNote ? "Custom save" : "Target"}</small>
          </div>
          <table class="poster-mini-table">
            <thead><tr><th scope="col">Strategy Path</th><th scope="col">Age-55 CPF</th><th scope="col">Extra CPF</th><th scope="col">Outside Save</th><th scope="col">CPF LIFE (65+)</th></tr></thead>
            <tbody>
              ${[
                ...(r.brsScenario ? [r.brsScenario] : []),
                ...r.scenarios.slice(1),
              ]
                .map(
                  (sc) => `<tr class="${sc.key === s.key ? "is-active" : ""}">
                    <td>${sc.key === "brs" ? "BRS (Pledge)" : sc.key.toUpperCase()}${sc.key === s.key ? " ★" : ""}</td>
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
            <h2>Paycheck Split &amp; Checkpoints</h2>
            <small>${m(grossPlusEmp, "/mo")} incl. Emp CPF</small>
          </div>
          <div class="poster-pipes">
            ${pipeRows
              .map((pr) => {
                const w = Math.min(
                  100,
                  Math.round((pr.amt / Math.max(1, grossPlusEmp)) * 100),
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
            <h2>Retirement Living Budget</h2>
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
              <strong>${m(basis === "nominal" ? r.spend65 * Math.pow(1 + r.inflation, Math.max(0, 65 - r.age)) : r.spend65, "/mo")} ${basis === "nominal" ? "nominal" : "today’s $"} (${m(pm.cpfFloor65, "/mo")} CPF LIFE)</strong>
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
