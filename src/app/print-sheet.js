import {
  $,
  m,
  compactMoney,
  formatDobShort,
  getSavingsProgress,
  deriveReadinessSummary,
  html,
  raw,
} from "./format.js";
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
  cpfProgressLabel,
  savingsProgress: planSavingsProgress,
  expenseData = null,
  masRates = null,
  basis = "today",
}) {
  const printContainer = $("#print-sheet");
  if (!printContainer || !r || !s || !fire) return;
  const savingsProgress = planSavingsProgress ?? getSavingsProgress(fire);

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
  const milestones = getMilestoneNodes(fire, r, s, simulation, basis);
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
    s.key === "brs"
      ? "BRS Pledge"
      : s.key === "ers"
        ? "ERS Path"
        : s.key === "salary"
          ? "CPF Salary Only"
          : "FRS Path";
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
  const { fundingSources } = buildFundingSourcesList(
    taps,
    r,
    s,
    pm.cpfCovPct,
    basis,
  );

  const fn = fire.fireNumber || {};
  const printEndAge = pm.endAge || fire.endAge || 95;
  const {
    projFireAge,
    diffYears,
    depletionAgeDisplay,
    survivalAnswer,
    safeAgeAnswer,
    deltaColor,
  } = deriveReadinessSummary({
    fire,
    endAge: printEndAge,
    pctFunded: savingsProgress.pct,
    onTrack: pm.onTrack,
    compact: true,
  });

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
    const pt55Src = basis === "nominal" ? pt55 : pt55?.today;
    const pt95Src = basis === "nominal" ? pt95 : pt95?.today;
    if (idx === 1 && fire.age < 55) {
      return `Age 55 · NW ${compactMoney(pt55Src?.totalNetWorth ?? 0)}`;
    }
    if (idx === 3 && !pm.fullyFundedTo95) {
      const liq95 = (pt95Src?.liquidEquities ?? 0) + (pt95Src?.ssbCash ?? 0);
      const cpf95 = pt95Src?.cpfTotal ?? 0;
      return liq95 <= 1
        ? `Liquid $0 · ${compactMoney(cpf95)} CPF`
        : `${mn.tag} · ${mn.sub}`;
    }
    return `${mn.tag}`;
  };

  const isNominal = basis === "nominal";
  const toDisplayMoney = (val, targetAge) => {
    const factor = Math.pow(
      1 + (r.inflation || 0),
      Math.max(0, targetAge - r.age),
    );
    if (isNominal) return r.moneyBasis === "today" ? val * factor : val;
    return r.moneyBasis === "today" ? val : val / factor;
  };
  const spendAtRetireDisplay = toDisplayMoney(r.futureSpend, r.retire);
  const spendAt65Display = toDisplayMoney(r.spend65, 65);
  const payoutAt65Display = toDisplayMoney(s.payout, 65);
  const gapAt65Display = toDisplayMoney(s.gap65, 65);

  const budgetHeaderSub =
    r.retire < 65
      ? html`Age ${r.retire}: ${raw(m(spendAtRetireDisplay, "/mo"))} · Age 65:
        ${raw(m(spendAt65Display, "/mo"))}`
      : html`Age 65 est: ${raw(m(spendAt65Display, "/mo"))}`;

  const liquidOutsideTotal = Math.max(0, sa.outsideTotal - startingSrs);
  const assetBreakdownItems = [];
  assetBreakdownItems.push(
    html`<span
      ><b>CPF ${compactMoney(startingCpf)}</b> (OA ${compactMoney(sa.oa)} · SA
      ${compactMoney(sa.sa)} · MA
      ${compactMoney(sa.ma)}${
        sa.saInvested > 0
          ? ` · CPFIS-SA ${compactMoney(sa.saInvested)} room`
          : ""
      })</span
    >`,
  );
  assetBreakdownItems.push(
    html`<span
      ><b>Liquid Outside ${compactMoney(liquidOutsideTotal)}</b> (Global Eq
      ${compactMoney(sa.equities)} · SG Div ${compactMoney(sa.sgDividends)} ·
      Cash/SSB
      ${compactMoney(sa.ssbCash)})${
        startingSrs > 0
          ? raw(html` · <b>Locked SRS ${compactMoney(startingSrs)}</b>`)
          : ""
      }</span
    >`,
  );

  printContainer.innerHTML = html` <div class="poster-sheet">
    <header class="poster-masthead">
      <div class="poster-brand-row">
        <div class="poster-title-block">
          <div class="poster-brand-lockup">
            <span class="poster-brand-badge" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                width="15"
                height="15"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M12 2.5l7.5 3.3v5.7c0 5-3.2 9.4-7.5 11-4.3-1.6-7.5-6-7.5-11V5.8L12 2.5z"
                />
                <path d="M9 14.5v-3M12 14.5V9.5M15 14.5V7.5" />
              </svg>
            </span>
            <span class="poster-wordmark"
              >Retirement<strong>Shield</strong></span
            >
            <span class="poster-kicker"
              >SINGAPORE RETIREMENT &amp; CPF BLUEPRINT</span
            >
          </div>
          <h1>Retirement Readiness &amp; CPF Overview</h1>
          <div class="poster-chips">
            <span>Age ${r.age} → ${r.retire}</span>
            <span
              >Gross ${raw(m(r.salary))} · Net
              ${raw(m(r.afterCpf, "/mo"))}${annualBonusVal > 0 ? raw(html` · Bonus ${raw(m(annualBonusVal, "/yr"))}`) : ""}</span
            >
            <span>${pm.budgetChipLabel}</span>
            <span
              >CPF LIFE
              ${r.plan === "escalating" ? "Escalating +2%" : "Standard"}</span
            >
            <span>${pm.housingChipLabel}</span>
            ${srsAnnualVal > 0 || startingSrs > 0 ? raw(html`<span class="${sa.srsIdleActive ? "is-warn-chip" : ""}">SRS ${srsAnnualVal > 0 ? raw(m(srsAnnualVal, "/yr")) : compactMoney(startingSrs)} · ${srsInvestLabel} · Age ${srsLockAge}</span>`) : ""}
            ${maSpendVal > 0 ? raw(html`<span>MA deduct ${raw(m(maSpendVal, "/mo"))}${r.maShortfallToday > 0 ? ` (Shortfall ${compactMoney(r.maShortfallToday)})` : ""}</span>`) : ""}
            ${existingReliefsVal !== 1000 ? raw(html`<span>Reliefs ${raw(m(existingReliefsVal, "/yr"))}</span>`) : ""}
            ${reserveReturnNum > 0 ? raw(html`<span>Reserve +${(reserveReturnNum * 100).toFixed(1).replace(/\.0$/, "")}%</span>`) : ""}
          </div>
        </div>
        <div class="poster-verdict-badge is-${pm.statusTone}">
          <small>${savingsProgress.title}</small>
          <strong><span id="print-savings-progress">${savingsProgress.percent}</span> · ${pm.statusText}</strong>
          <span>${pm.verdictSub}</span>
        </div>
      </div>
    </header>

    <section class="poster-snapshot-banner" aria-label="Plan Snapshot">
      <div class="poster-kpi-strips">
        <div class="poster-stat-strip">
          <small>Your Age</small>
          <div>
            <strong>${fire.age} yrs</strong
            ><span class="poster-pill"
              >${p?.dob ? `DOB ${formatDobShort(p.dob)}` : "Current"}</span
            >
          </div>
        </div>
        <div class="poster-stat-strip">
          <small>Target Retire Age</small>
          <div>
            <strong>Age ${fire.retire}</strong
            ><span class="poster-pill"
              >${r.retiringNow ? "Now" : `${yearsToRetire} yrs`} ·
              ${fire.retire < 65 ? `${65 - fire.retire}-yr bridge` : fire.retire === 65 ? "CPF LIFE" : "Deferred"}</span
            >
          </div>
        </div>
        <div class="poster-stat-strip">
          <small>Take-Home Pay</small>
          <div>
            <strong>${raw(m(r.afterCpf, "/mo"))}</strong
            ><span class="poster-pill"
              >${takeHomePctOfGross}% net on ${raw(m(r.salary))}</span
            >
          </div>
        </div>
        <div class="poster-stat-strip">
          <small>Total Assets</small>
          <div>
            <strong>${raw(m(startingTotalAssets))}</strong
            ><span class="poster-pill"
              >${compactMoney(startingCpf)} CPF ·
              ${compactMoney(startingLiquid)}
              liq${startingSrs > 0 ? ` · ${compactMoney(startingSrs)} SRS` : ""}</span
            >
          </div>
        </div>
        <div class="poster-stat-strip">
          <small>Retire Budget</small>
          <div>
            <strong>${raw(m(r.todaySpend, "/mo"))}</strong
            ><span class="poster-pill"
              >${selectedPathName} ·
              ${isItemizedTarget ? "Itemized" : isCustomBudget ? "Custom" : r.lifestyle === "cca" ? "CCA" : "Helper"}</span
            >
          </div>
        </div>
      </div>
      <div
        class="poster-balances-strip"
        role="group"
        aria-label="Starting Asset Breakdown"
      >
        <span class="poster-balances-tag">Starting Balances</span>
        ${raw(assetBreakdownItems.join('<span class="poster-balances-sep" aria-hidden="true">·</span>'))}
      </div>
    </section>

    <section class="poster-discover-row">
      <div class="poster-chart-card poster-nw-card">
        <div class="poster-panel-head">
          <h2>Net Worth Trajectory (Age ${r.age}–${printEndAge})</h2>
          <div class="poster-swell-keys">
            <span
              ><i class="is-pink"></i>${Math.min(55, pm.retireAge)}+
              Wealth</span
            >
            <span
              ><i class="is-slate"></i>Pre-${Math.min(55, pm.retireAge)}
              Base</span
            >
            <span><i class="is-line"></i>Trend</span>
          </div>
        </div>
        <div class="poster-nw-kpis">
          <div class="poster-nw-kpi">
            <small>Net Worth at Age ${pm.retireAge}</small>
            <strong>${raw(m(pm.projectedAtRetire))}</strong>
          </div>
          <div class="poster-nw-kpi">
            <small>${pm.savingKpiLabel}</small>
            <strong
              >${raw(m(pm.monthlySave, r.retiringNow ? " now" : "/mo"))}</strong
            >
            <span class="poster-nw-delta">${pm.savingKpiPill}</span>
          </div>
          <div class="poster-nw-kpi">
            <small>CPF LIFE from 65</small>
            <strong class="is-emerald">${raw(m(pm.cpfFloor65, "/mo"))}</strong>
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
          ${fundingSources.map((src) =>
            raw(
              html`<li class="poster-source-row">
                <span
                  class="poster-source-badge"
                  style="background:${src.softBg};color:${src.color};border:1px solid ${src.border};"
                  >${src.icon ? raw(src.icon) : src.letter}</span
                >
                <div class="poster-source-copy">
                  <strong style="color:${src.color};">${src.name}</strong>
                  <small>${src.count}</small>
                </div>
                <span class="poster-slate-pill">${src.score}</span>
              </li>`,
            ),
          )}
        </ul>
        <div class="poster-cov-box">
          <div class="poster-cov-head">
            <span>Age-65 income split</span>
            <strong>${raw(m(spendAt65Display, "/mo"))} need</strong>
          </div>
          <div class="poster-cov-track">
            <span
              style="width:${pm.cpfCovPct}%;background:var(--sem-emerald);"
            ></span>
            <span
              style="width:${Math.max(0, 100 - pm.cpfCovPct)}%;background:var(--sem-equities);"
            ></span>
          </div>
          <div class="poster-cov-legend">
            <span
              ><i style="background:var(--sem-emerald);"></i
              ><b>${raw(m(payoutAt65Display, "/mo"))}</b> CPF LIFE
              (${pm.cpfCovPct}%)</span
            >
            <span
              ><i style="background:var(--sem-equities);"></i
              ><b>${raw(m(gapAt65Display, "/mo"))}</b> savings
              (${Math.max(0, 100 - pm.cpfCovPct)}%)</span
            >
          </div>
        </div>
      </div>

      <div class="poster-panel poster-readiness-card">
        <div class="poster-panel-head">
          <h2>Retirement Readiness</h2>
          <span class="poster-pill">Savings target at age ${fire.retire}</span>
        </div>
        ${raw(
          buildFinReadinessGaugeSVG(
            savingsProgress.pct,
            "Earliest Safe Retirement Age",
            pm.earliestSafeAgeText,
            `Projection through age ${printEndAge}`,
            deltaColor,
            pm.onTrack,
            "print-swell",
            printEndAge,
          ),
        )}
        <div class="poster-gauge-facts">
          <div class="poster-gauge-fact">
            <span>Retiring at ${fire.retire}</span>
            <strong class="${fn.fullyFundedTo95 ? "is-good" : "is-warn"}"
              >${survivalAnswer}</strong
            >
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
          <small
            >${cpfProgressLabel ? raw(html`<span id="print-cpf-progress">${cpfProgressLabel}</span><br />`) : ""}
            ${basis === "nominal" ? "Future Nominal $" : "Today’s $"} ·
            ${pm.customSavingNote ? "Custom save" : "Target"}</small
          >
        </div>
        <table class="poster-mini-table">
          <caption class="sr-only">
            CPF Path summary comparing Age-55 CPF, extra CPF, outside saving,
            and CPF LIFE payout
          </caption>
          <thead>
            <tr>
              <th scope="col">Strategy Path</th>
              <th scope="col" class="num-col">Age-55 CPF</th>
              <th scope="col" class="num-col">Extra CPF</th>
              <th scope="col" class="num-col">Outside Save</th>
              <th scope="col" class="num-col">CPF LIFE (65+)</th>
            </tr>
          </thead>
          <tbody>
            ${[
              ...(r.brsScenario ? [r.brsScenario] : []),
              ...r.scenarios.slice(1),
            ].map((sc) =>
              raw(
                html`<tr class="${sc.key === s.key ? "is-active" : ""}">
                  <td>
                    ${sc.key === "brs" ? "BRS (Pledge)" : sc.key === "salary" ? "CPF Salary" : sc.key.toUpperCase()}${sc.key === s.key ? " ★" : ""}
                  </td>
                  <td class="num-col">
                    ${raw(m(toDisplayMoney(sc.balance, 55)))}
                  </td>
                  <td class="num-col">
                    ${raw(m(sc.cpfFunding, r.retiringNow ? " now" : "/mo"))}
                  </td>
                  <td class="num-col">
                    ${raw(m(sc.privateSaving, r.retiringNow ? " now" : "/mo"))}
                  </td>
                  <td class="num-col">
                    ${raw(m(toDisplayMoney(sc.payout, 65), "/mo"))}
                  </td>
                </tr>`,
              ),
            )}
          </tbody>
        </table>
        ${pm.customSavingNote ? raw(html`<p class="poster-override-note">${pm.customSavingNote}</p>`) : ""}
        <div class="poster-subhead">
          <span>Priority Action Checklist</span>
          <small>5-Step Plan</small>
        </div>
        <ul class="poster-tiers">
          ${pm.actionRows.map((row) =>
            raw(
              html`<li>
                <span
                  >${row.label}
                  <em class="poster-tier-tag">${row.tag}</em></span
                ><b>${row.value}</b>
              </li>`,
            ),
          )}
        </ul>
      </div>

      <div class="poster-panel poster-cashflow-panel">
        <div class="poster-panel-head">
          <h2>Paycheck Split &amp; Checkpoints</h2>
          <small>${raw(m(grossPlusEmp, "/mo"))} incl. Emp CPF</small>
        </div>
        <div class="poster-pipes">
          ${pipeRows.map((pr) => {
            const w = Math.min(
              100,
              Math.round((pr.amt / Math.max(1, grossPlusEmp)) * 100),
            );
            return raw(
              html`<div class="poster-pipe-row">
                <div class="poster-pipe-head">
                  <span
                    ><i style="background:${pr.color};"></i>${pr.label}</span
                  >
                  <b>${raw(m(pr.amt))} (${w}%)</b>
                </div>
                <div class="poster-pipe-track">
                  <span
                    style="width:${pr.amt > 0 ? Math.max(3, w) : 0}%;background:${pr.color};"
                  ></span>
                </div>
              </div>`,
            );
          })}
        </div>
        ${
          milestones.length
            ? raw(
                html`<div class="poster-checkpoints-grid">
                  ${milestones.map((mn, idx) =>
                    raw(
                      html`<div class="poster-feed-row">
                        <span
                          class="poster-feed-avatar"
                          style="background:${mn.softBg};color:${mn.color};"
                          >${mn.badge}</span
                        >
                        <div class="poster-feed-copy">
                          <strong>${mn.title}</strong>
                          <small>${formatCheckpointSub(mn, idx)}</small>
                        </div>
                        <div class="poster-feed-right">
                          <b>${raw(mn.metric)}</b>
                        </div>
                      </div>`,
                    ),
                  )}
                </div>`,
              )
            : ""
        }
      </div>

      <div class="poster-panel poster-budget-panel">
        <div class="poster-panel-head">
          <h2>Retirement Living Budget</h2>
          <small>${raw(budgetHeaderSub)}</small>
        </div>
        <div class="poster-budget-body">
          ${raw(buildExpensePieSVG(ep, { isPrint: true }))}
          <div class="poster-budget-cats">
            ${(ep.categories || []).map((cat) => {
              const barW =
                ep.total > 0 && cat.amount > 0
                  ? Math.max(4, Math.round(cat.pct))
                  : 0;
              return raw(
                html`<div class="poster-cat-row">
                  <div class="poster-cat-meta">
                    <span
                      ><i style="background:${cat.color};"></i
                      >${cat.label}</span
                    >
                    <b>${raw(m(cat.amount))} (${Math.round(cat.pct)}%)</b>
                  </div>
                  <div class="poster-pipe-track">
                    <span
                      style="width:${barW}%;background:${cat.color};"
                    ></span>
                  </div>
                </div>`,
              );
            })}
          </div>
        </div>
        <div class="poster-gauge-facts poster-budget-facts">
          <div class="poster-gauge-fact">
            <span>Today’s monthly target</span>
            <strong
              >${raw(m(r.todaySpend, "/mo"))}
              (${isItemizedTarget ? "Itemized" : isCustomBudget ? "Custom" : r.lifestyle === "cca" ? "Community Care" : "Home + Helper"})</strong
            >
          </div>
          <div class="poster-gauge-fact">
            <span
              >Age-65 need (${Number((r.inflation * 100).toFixed(1))}%
              infl.)</span
            >
            <strong
              >${raw(m(spendAt65Display, "/mo"))}
              ${basis === "nominal" ? "nominal" : "today’s $"}
              (${raw(m(pm.cpfFloor65, "/mo"))} CPF LIFE)</strong
            >
          </div>
        </div>
      </div>
    </section>

    <footer class="poster-colophon">
      <span
        ><sup>1</sup>
        ${basis === "nominal" ? "Future nominal dollars" : "Today’s purchasing power"}
        (${Number((r.inflation * 100).toFixed(1))}% inflation,
        ${Number((r.investmentReturn * 100).toFixed(1))}% net return,
        ${r.post55Work ? "post-55 CPF included" : "post-55 CPF excluded"}).
        <sup>2</sup> ${pm.colophonRulesText}</span
      >
      <span
        >100% Local Calculation · Educational planning illustration only</span
      >
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
