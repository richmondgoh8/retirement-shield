import { m, centsHtml, compactMoney, ICONS } from "./format.js";

/** Render the CPF position, OA-to-SA transfer comparison, Post-55 OA tap, and VHR section. */
export function buildCpfDetailsHTML({
  p,
  r,
  selected,
  simExtraForCpf,
  keepOA,
  tax,
}) {
  const moveOA = RetirementModel.projectCPF(p, simExtraForCpf, selected, null, {
    transferOA: true,
  });
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
  const renderMetrics = (metrics) =>
    `<dl class="cpf-choice-metrics">${metrics
      .map(
        ([label, amount]) => `<div><dt>${label}</dt><dd>${amount}</dd></div>`,
      )
      .join("")}</dl>`;
  const renderNominal = (
    key,
    metrics,
  ) => `<details id="cpf-${key}-nominal" class="cpf-choice-nominal">
    <summary class="overview-disclosure-summary">Amounts in future dollars at 55</summary>
    ${renderMetrics(metrics)}
  </details>`;
  const oaTransferCards = [
    ["Keep OA as-is", keepOA, false],
    ["Transfer eligible OA to SA", moveOA, true],
  ]
    .map(([label, projection, isTransfer]) => {
      const oaLeft = Math.max(
        0,
        projection.oaAfter55 ?? projection.availableAt55 - projection.cpfAt55,
      );
      const oaSa = projection.oa + projection.sa;
      const ra = projection.fundedRA;
      const frsPct = Math.min(
        100,
        Math.round((toToday55(ra) / cohortFrsToday) * 100),
      );
      const transferred = isTransfer && projection.oaTransfer > 0;
      return `<article class="cpf-choice-card">
        <h3>${label}</h3>
        <div class="cpf-choice-key">
          <span>Retirement Account at 55</span>
          <strong>${m(toToday55(ra))}</strong>
          <div class="cpf-choice-track" aria-hidden="true"><span style="width:${frsPct}%"></span></div>
          <span>${frsPct}% of your cohort’s Full Retirement Sum</span>
        </div>
        ${renderMetrics([
          ["OA + SA before age 55", m(toToday55(oaSa))],
          ["OA left after funding RA", m(toToday55(oaLeft))],
          ["Extra housing cash needed", m(projection.housingShortfallToday)],
          ...(transferred
            ? [
                ["OA transferred today", centsHtml(projection.oaTransfer)],
                ["Projected interest gain at 55", `+${m(transferDiffToday)}`],
              ]
            : []),
        ])}
        ${isTransfer && !transferred ? "<p>No eligible OA to transfer in this projection.</p>" : ""}
        ${renderNominal(isTransfer ? "transfer-oa" : "keep-oa", [
          ["Retirement Account", m(ra)],
          ["OA + SA before age 55", m(oaSa)],
          ["OA left after funding RA", m(oaLeft)],
          ...(transferred
            ? [["Projected interest gain", `+${m(transferDiffNominal)}`]]
            : []),
        ])}
      </article>`;
    })
    .join("");

  const oaLeft55Nominal = Math.max(
    0,
    keepOA.oaAfter55 ?? keepOA.availableAt55 - keepOA.cpfAt55,
  );
  const oaLeft55Today = toToday55(oaLeft55Nominal);
  const oaAnnualRate = RetirementModel.C.oaRate;
  const oaRateLabel = `${(oaAnnualRate * 100).toFixed(1)}% p.a.`;
  const oaInterest55Nominal = (oaLeft55Nominal * oaAnnualRate) / 12;
  const oaInterest55Today = (oaLeft55Today * oaAnnualRate) / 12;
  const annualBenchmarkInterest = 500000 * oaAnnualRate;
  const rstuBracketStr = (tax.taxBefore.marginalRate * 100)
    .toFixed(1)
    .replace(/\.0$/, "");
  const pathName =
    selected === "brs"
      ? "BRS Target"
      : selected === "ers"
        ? "ERS Maximum"
        : selected === "salary"
          ? "CPF Salary Only"
          : "FRS Target";
  return `<section id="cpf-position-details" class="card-surface rules-card" aria-labelledby="cpf-pos-title">
        <div class="rules-card-head">
          <div>
            <h2 id="cpf-pos-title">CPF balances and housing choices through age 55</h2>
            <p>Active <strong>${pathName}</strong> path${simExtraForCpf > 0 ? ` (+${m(simExtraForCpf, "/mo")} extra CPF)` : ""} · +1% extra interest on first $60k ($20k OA cap) · ${rstuBracketStr}% tax bracket.</p>
          </div>
          <span class="fin-target-pill">Today’s dollars · Nominal amounts at age 55</span>
        </div>
        <dl class="tax-metrics-grid">
          <div class="tax-metric-box"><dt>OA today</dt><dd>${centsHtml(oaNow)}<small>2.5% base + 1% extra on first $20k → SA (${m(oaExtraEligibleNow)} / $20k used)</small></dd></div>
          <div class="tax-metric-box"><dt>SA today</dt><dd>${centsHtml(saNow)}<small>4.0% base + 1% on first $60k combined (${m(combinedExtraEligibleNow)} / $60k used)</small></dd></div>
          <div class="tax-metric-box"><dt>SA top-up room to ${RetirementModel.C.year} FRS</dt><dd>${centsHtml(roomNow)}<small>Self RSTU: ${m(tax.maxRstu, "/yr")} (saves ${m(tax.rstuTaxSaved, "/yr")})</small></dd></div>
          <div class="tax-metric-box"><dt>OA transferable to SA now</dt><dd>${centsHtml(Math.min(oaNow, roomNow))}<small>Irreversible · $0 tax relief · Compounds at 4%–5% in SA</small></dd></div>
        </dl>
        <div class="cpf-choice-grid">
          ${oaTransferCards}
          <article class="cpf-choice-card">
            <h3>OA interest from age 55</h3>
            <div class="cpf-choice-key">
              <span>Estimated monthly interest</span>
              <strong>${m(oaInterest55Today, "/mo")}</strong>
              <span>${oaRateLabel} on the projected OA balance</span>
            </div>
            ${renderMetrics([
              ["OA left at 55 under your plan", m(oaLeft55Today)],
              [
                "Interest on $500,000 in OA",
                `${m(annualBenchmarkInterest / 12, "/mo")} <small>(${m(annualBenchmarkInterest, "/yr")})</small>`,
              ],
            ])}
            <p>From age 55, you can withdraw the remaining OA balance once you’ve set aside the Full Retirement Sum.</p>
            ${renderNominal("oa-interest", [
              ["OA balance", m(oaLeft55Nominal)],
              ["Estimated monthly interest", m(oaInterest55Nominal, "/mo")],
            ])}
          </article>
          <article class="cpf-choice-card">
            <h3>Housing refund or CPF cash top-up</h3>
            <div class="cpf-choice-options">
              <div>
                <h4>Cash top-up to retirement savings (RSTU)</h4>
                <div class="cpf-choice-key">
                  <span>Estimated tax savings</span>
                  <strong>${m(tax.rstuTaxSaved, "/yr")}</strong>
                </div>
                ${renderMetrics([
                  ["Top-up eligible for relief", m(tax.maxRstu, "/yr")],
                  [
                    `Relief cap remaining (of ${m(RetirementModel.C.personalReliefCap)})`,
                    m(tax.reliefCapRemaining),
                  ],
                ])}
                <p>Cash top-ups are committed to retirement payouts.</p>
              </div>
              <div>
                <h4>Voluntary Housing Refund (VHR)</h4>
                <div class="cpf-choice-key">
                  <span>Tax relief</span>
                  <strong>${m(0)}</strong>
                </div>
                <p>Refunds generally go back to OA, which earns ${oaRateLabel} in base interest. From age 55, refunds can go toward an unmet Full Retirement Sum.</p>
              </div>
            </div>
          </article>
        </div>
      </section>`;
}

/** Render the CPF Milestones & Age-55 Rules tab body. */
export function buildCpfRulesTabHTML({
  r,
  p,
  selected,
  simExtraForCpf,
  keepOA,
  tax,
  learningPlan,
  strategyTarget,
  cpfProgress,
}) {
  const lesson = learningPlan;
  const cohortYear55 = RetirementModel.C.year + 55 - r.age;
  const planLabelShort =
    r.plan === "escalating" ? "Escalating +2%/yr" : "Standard";
  const targetFundPct = cpfProgress.pct;
  const ersGap = Math.max(
    0,
    cpfProgress.targetToday - cpfProgress.balanceToday,
  );
  const projectedFundingAboveFrs = Math.max(
    0,
    cpfProgress.balanceToday - lesson.cohortMilestones.frs.sumToday,
  );
  const gapZero =
    (lesson.plannedCpfExtra > 0
      ? lesson.withPlanned.remainingGapToday
      : lesson.gapToday) <= 1;
  const lessonHTML = `<section id="cpf-goal-guide" class="card-surface rules-card" aria-labelledby="cpf-goal-title">
      <div class="rules-card-head">
        <div>
          <h2 id="cpf-goal-title">Retirement sum for this plan</h2>
          <p>Age ${r.age} cohort (turning 55 in ${cohortYear55}) · <strong>${planLabelShort}</strong> Plan · ${(r.inflation * 100).toFixed(1).replace(/\.0$/, "")}% inflation.</p>
        </div>
        <span class="fin-target-pill">Today’s dollars · Nominal amounts at age 55</span>
      </div>
      <p id="cpf-strategy-milestone-help" class="cpf-strategy-help">Before 55, voluntary SA top-ups are capped at the prevailing FRS. At 55, automatic transfers into your Retirement Account are capped at your cohort FRS. Choosing ERS models a voluntary top-up at 55 using available Ordinary Account (OA) savings and cash you set aside for CPF. That can leave less OA for housing. Each option shows the monthly payout if you reach that sum.</p>
      <div class="goal-choices" id="milestone-cpf-strategy" data-cpf-strategy-group role="group" aria-labelledby="cpf-goal-title" aria-describedby="cpf-strategy-milestone-help">${[
        ["brs", "Basic Retirement Sum"],
        ["frs", "Full Retirement Sum"],
        ["ers", "Enhanced Retirement Sum · Optional from 55"],
      ]
        .map(([key, tag]) => {
          const cm = lesson.cohortMilestones[key];
          return `<button type="button" data-cpf-strategy="${key}" aria-pressed="${key === selected}">
            <div class="goal-choice-top">
              <strong>${key.toUpperCase()}</strong>
              <span class="goal-choice-payout">${m(cm.payoutToday, "/mo")}</span>
            </div>
            <div class="goal-choice-sum">${m(cm.sumToday)} <span>today’s $</span></div>
            <small>${tag} · ${m(cm.sumAt55)} nom. at 55</small>
            <span class="goal-choice-action" aria-hidden="true">${key === selected ? "Selected for this plan" : key === "ers" ? "Model an ERS top-up from 55" : `Use ${key.toUpperCase()} in my plan`}</span>
          </button>`;
        })
        .join("")}</div>
      <div class="tap-progress-wrap">
        <div class="tap-progress-meta">
          <span>Projected Retirement Account at 55 · ${m(cpfProgress.balanceToday)} of ${m(cpfProgress.targetToday)} in today’s dollars</span>
          <strong>${cpfProgress.percent} of ${cpfProgress.strategy} funded</strong>
        </div>
        <div class="tap-progress-track" role="progressbar" aria-valuenow="${targetFundPct}" aria-valuemin="0" aria-valuemax="100" aria-label="${cpfProgress.strategy} funded at age 55">
          <span class="tap-progress-fill is-tap1" data-meter-key="cpf-milestone-fill" data-meter-w="${targetFundPct}" style="width:${targetFundPct}%"></span>
        </div>
      </div>
      ${strategyTarget === "ers" ? `<p id="cpf-ers-funding-note" class="cpf-strategy-help">Your current plan projects ${m(cpfProgress.balanceToday)} in RA at 55${projectedFundingAboveFrs >= 0.5 ? `, including ${m(projectedFundingAboveFrs)} in voluntary funding above FRS` : ""}.${ersGap >= 0.5 ? ` The projected gap to ERS is ${m(ersGap)} in today’s dollars.` : " That covers the modelled ERS target."}</p>` : ""}
      <dl class="tax-metrics-grid">
        <div class="tax-metric-box"><dt>Target ${strategyTarget.toUpperCase()} at age 55</dt><dd>${m(lesson.targetToday, "", "lesson-target")}<small>Nominal at 55: ${m(lesson.target, "", "lesson-target-nom")}</small></dd></div>
        <div class="tax-metric-box"><dt>OA + SA at 55 (${r.awBonusAnnual > 0 ? "salary + bonus" : "salary"} only)</dt><dd>${m(lesson.availableToday, "", "lesson-avail")}<small>Nominal at 55: ${m(lesson.available)}</small></dd></div>
        <div class="tax-metric-box"><dt>${lesson.plannedCpfExtra > 0 ? `Remaining gap after ${m(lesson.plannedCpfExtra, "/mo")} extra` : `Gap to ${strategyTarget.toUpperCase()} at 55`}</dt><dd>${m(lesson.plannedCpfExtra > 0 ? lesson.withPlanned.remainingGapToday : lesson.gapToday, "", "lesson-gap")}<small>${lesson.plannedCpfExtra > 0 ? `Nominal remaining: ${m(lesson.withPlanned.remainingGap, "", "lesson-gap-nom")} (before extra: ${m(lesson.gapToday)} today’s $)` : `Nominal gap at 55: ${m(lesson.gap, "", "lesson-gap-nom")}`}</small></dd></div>
        <div class="tax-metric-box"><dt>Extra savings for ${strategyTarget.toUpperCase()}</dt><dd>${lesson.monthly === null ? "Lump sum only" : m(lesson.monthly, "/mo", "lesson-monthly")}<small>${lesson.monthly === null ? "Monthly saving is paused" : lesson.plannedCpfExtra > 0 ? (lesson.withPlanned.hitsTarget ? `Covered by your ${m(lesson.plannedCpfExtra, "/mo")} extra CPF savings` : `+${m(lesson.withPlanned.additionalMonthlyNeeded, "/mo")} above your ${m(lesson.plannedCpfExtra, "/mo")}`) : `Save until age ${lesson.untilAge}`}${strategyTarget === "ers" ? " · Reserve savings above SA top-up room for age 55" : ""}</small></dd></div>
      </dl>
      <button type="button" class="text-button" data-quick-edit="cpf-extra">Edit extra CPF savings</button>
      <ul class="compact-list cpf-rules-notes cpf-milestone-timeline">
        <li><strong>Before 55</strong><span>Cash RSTU and OA-to-SA transfers share your remaining SA room of <strong>${centsHtml(lesson.currentRoom)}</strong> (to reach the ${RetirementModel.C.year} FRS cap of ${m(RetirementModel.C.frs)}) and are irreversible.</span></li>
        <li><strong>At 55</strong><span>SA closes; SA then OA fund RA up to cohort FRS (${m(lesson.cohortMilestones.frs.sumAt55)} nominal). Voluntary ERS top-ups into RA open from age 55 ($0 RSTU tax relief above FRS); any pre-55 extra saving beyond SA room is held aside until 55.</span></li>
        <li><strong>From 65</strong><span>CPF LIFE payouts support your monthly spending. The payout estimates above reflect the retirement sum you select.</span></li>
      </ul>
    </section>`;
  return `
    <header class="ember-page-header fin-page-header">
      <div class="fin-header-copy">
        <h1>CPF milestones</h1>
        <p class="fin-page-sub">See what happens to your CPF accounts at 55 and how savings affect CPF LIFE payouts.</p>
      </div>
      <div class="ember-header-meta">
        <button type="button" class="button button-small" data-open-settings-field="known-oa">Edit CPF balances</button>
        <span class="fin-target-pill">Age 55 → 65</span>
      </div>
    </header>
    ${lessonHTML}
    ${buildCpfDetailsHTML({ p, r, selected, simExtraForCpf, keepOA, tax })}`;
}

/** Render the Tax Relief Optimization tab body. */
export function buildTaxTabHTML({ r, tax, marginalTaxPct }) {
  const C = RetirementModel.C;
  const fmtCpfRatePct = (rate) =>
    `${Number((Number(rate || 0) * 100).toFixed(2))}%`;
  const empCpfRatePct = fmtCpfRatePct(
    r.empCpfRate ?? (r.wage > 0 ? r.employeeCpf / r.wage : 0),
  );
  const emprCpfRatePct = fmtCpfRatePct(
    r.emprCpfRate ?? (r.wage > 0 ? r.employerCpf / r.wage : 0),
  );
  const grossPlusEmpr = Math.max(
    1,
    (r.afterCpf || 0) + (r.employeeCpf || 0) + (r.employerCpf || 0),
  );
  const takeHomePct = ((r.afterCpf || 0) / grossPlusEmpr) * 100;
  const empCpfPct = ((r.employeeCpf || 0) / grossPlusEmpr) * 100;
  const emprCpfPct = Math.max(0, 100 - takeHomePct - empCpfPct);
  return `
      <header class="ember-page-header fin-page-header">
        <div class="fin-header-copy">
          <h1>Tax &amp; SRS</h1>
          <p class="fin-page-sub">See how CPF cash top-ups and SRS contributions affect your tax relief for Year of Assessment ${C.year}.</p>
        </div>
        <div class="ember-header-meta">
          <button type="button" class="button button-small" data-open-settings-field="known-srs-annual">Edit planned SRS</button>
          <span class="status-pill is-info">${marginalTaxPct} IRAS Bracket</span>
        </div>
      </header>
      ${buildTaxSweetSpotSection(tax)}
      <section class="card-surface rules-card" id="salary-cpf-caps" aria-labelledby="salary-caps-title">
        <div class="rules-card-head">
          <div>
            <h2 id="salary-caps-title">CPF contributions on salary and bonus (${C.year} limits)</h2>
            <p>${C.year} Ordinary Wage ceiling: ${m(C.wageCap, "/mo")} · Annual CPF salary ceiling: ${m(C.annualWageCap, "/yr")} (${m(C.cpfAnnualLimit)} mandatory CPF cap).${r.awBonusAnnual > 0 ? ` Includes <strong>${m(r.awBonusAnnual, "/yr")}</strong> annual bonus (<strong>${m(r.awSubjectAnnual, "/yr")}</strong> subject to AW CPF).` : ""}</p>
          </div>
          <span class="fin-target-pill">Age ${r.age} · ${r.age >= 55 ? "Senior CPF rates" : "Under 55 rates"}</span>
        </div>
        <button type="button" class="text-button" data-open-settings-field="person-salary">Edit salary and bonus</button>
        <div class="fin-bento-bar" aria-hidden="true">
          <span style="width:${takeHomePct.toFixed(1)}%;background:var(--sem-equities);"></span>
          <span style="width:${empCpfPct.toFixed(1)}%;background:var(--sem-cpf);"></span>
          <span style="width:${emprCpfPct.toFixed(1)}%;background:var(--sem-emerald);"></span>
        </div>
        <ul class="fin-bento-list tax-bento-list-compact">
          <li>
            <span class="fin-bento-item-label"><i style="background:var(--sem-equities);"></i>Take-home after Employee CPF</span>
            <span class="fin-bento-item-meta">${r.awBonusAnnual > 0 ? `+${m(r.awBonusAnnual - r.annualBonusEmployeeCpf, "/yr")} net bonus` : "Monthly cash pay"}</span>
            <strong>${m(r.afterCpf, "/mo")} <small class="fin-bento-share-pill">${Math.round(takeHomePct)}%</small></strong>
          </li>
          <li>
            <span class="fin-bento-item-label"><i style="background:var(--sem-cpf);"></i>Employee CPF (${empCpfRatePct} OW)</span>
            <span class="fin-bento-item-meta">${r.annualBonusEmployeeCpf > 0 ? `+${m(r.annualBonusEmployeeCpf, "/yr")} on bonus` : "Deducted from salary"}</span>
            <strong>${m(r.employeeCpf, "/mo")} <small class="fin-bento-share-pill">${Math.round(empCpfPct)}%</small></strong>
          </li>
          <li>
            <span class="fin-bento-item-label"><i style="background:var(--sem-emerald);"></i>Employer CPF (${emprCpfPct > 0 ? emprCpfRatePct : "0%"} OW)</span>
            <span class="fin-bento-item-meta">${r.annualBonusEmployerCpf > 0 ? `+${m(r.annualBonusEmployerCpf, "/yr")} on bonus · Total CPF ${m(r.employeeCpf + r.employerCpf, "/mo")}` : `Total mandatory CPF ${m(r.employeeCpf + r.employerCpf, "/mo")}`}</span>
            <strong>${m(r.employerCpf, "/mo")} <small class="fin-bento-share-pill">${Math.round(emprCpfPct)}%</small></strong>
          </li>
        </ul>
      </section>`;
}

function buildTaxSweetSpotSection(tax) {
  const C = RetirementModel.C;
  const marginalPct = `${(tax.taxBefore.marginalRate * 100).toFixed(1).replace(/\.0$/, "")}%`;
  const capTotal = Math.max(1, C.personalReliefCap);
  const baseReliefs = Math.max(0, Math.round(tax.reliefCapUsed || 0));
  const activeSelfRstu = Math.max(0, Math.round(tax.activeSelfRstu || 0));
  const activeFamRstu = Math.max(0, Math.round(tax.activeFamilyRstu || 0));
  const activeSrs = Math.max(0, Math.round(tax.activeSrs || 0));
  const totalClaimed = Math.min(
    capTotal,
    baseReliefs + activeSelfRstu + activeFamRstu + activeSrs,
  );
  const totalClaimedPct = Math.min(
    100,
    Math.round((totalClaimed / capTotal) * 100),
  );
  const remainingAfterActive = Math.max(0, capTotal - totalClaimed);
  const basePct = Math.min(100, (baseReliefs / capTotal) * 100);
  const selfRstuPct = Math.min(
    100 - basePct,
    (activeSelfRstu / capTotal) * 100,
  );
  const famRstuPct = Math.min(
    100 - basePct - selfRstuPct,
    (activeFamRstu / capTotal) * 100,
  );
  const srsPct = Math.min(
    100 - basePct - selfRstuPct - famRstuPct,
    (activeSrs / capTotal) * 100,
  );
  const tierTone =
    tax.tier === "max-both" || tax.tier === "rstu-first"
      ? "is-good"
      : "is-warn";

  return `<section class="tax-sweet-card card-surface" id="tax-sweet-spot" aria-labelledby="tax-sweet-title">
    <div class="tax-sweet-head">
      <div>
        <h2 id="tax-sweet-title">Compare CPF and SRS tax relief</h2>
        <p class="tax-guidance-copy">${tax.guidance}</p>
      </div>
      <span class="status-pill ${tierTone}">${tax.headline}</span>
    </div>
    <dl class="tax-metrics-grid">
      <div class="tax-metric-box">
        <dt>Chargeable Income (est.)</dt>
        <dd>${m(tax.chargeableIncome, "/yr", "tax-chargeable")}
          <small>${marginalPct} marginal bracket · ${m(tax.taxBefore.annualTax, "/yr")} tax</small>
        </dd>
      </div>
      <div class="tax-metric-box">
        <dt>CPF RSTU ($8k cap to FRS)</dt>
        <dd>${m(tax.rstuTaxSaved, "/yr saved", "tax-rstu-saved")}
          <small>Eligible room: ${m(tax.maxRstu, "/yr")} (SA room ${m(tax.saRoom)})</small>
        </dd>
      </div>
      <div class="tax-metric-box">
        <dt>SRS ($15.3k Citizen/PR cap)</dt>
        <dd>${m(tax.srsTaxSavedAfterRstu, "/yr saved", "tax-srs-saved")}
          <small>After RSTU (${m(tax.srsStandaloneTaxSaved, "/yr")} standalone) · Lock-in age ${tax.srsLockInAge}</small>
        </dd>
      </div>
      <div class="tax-metric-box">
        <dt>Reliefs before modeled top-ups</dt>
        <dd>${m(tax.reliefCapUsed, "", "tax-cap-used")} <span class="curr-muted">/ ${m(C.personalReliefCap)}</span>
          <small>Mandatory CPF and existing reliefs</small>
        </dd>
      </div>
    </dl>
    <article class="fin-bento-card card-surface tax-bento-embedded" aria-label="IRAS $80,000 personal relief cap waterfall">
      <div class="fin-bento-head">
        <div>
          <span class="fin-bento-eyebrow">YA ${C.year} IRAS $80,000 Relief Cap</span>
          <h3 class="fin-bento-title">${m(totalClaimed)} <small>including modeled top-ups · ${m(remainingAfterActive)} room left</small></h3>
        </div>
        <span class="fin-bento-share-pill">${totalClaimedPct}%</span>
      </div>
      <div class="fin-bento-bar" role="progressbar" aria-valuenow="${totalClaimedPct}" aria-valuemin="0" aria-valuemax="100" aria-label="${totalClaimedPct}% of $80,000 personal income tax relief cap used">
        <span data-meter-key="tax-wf-base" data-meter-w="${basePct.toFixed(1)}" style="width:${basePct.toFixed(1)}%;background:var(--sem-equities);"></span>
        <span data-meter-key="tax-wf-rstu" data-meter-w="${selfRstuPct.toFixed(1)}" style="width:${selfRstuPct.toFixed(1)}%;background:var(--sem-cpf);"></span>
        <span data-meter-key="tax-wf-fam" data-meter-w="${famRstuPct.toFixed(1)}" style="width:${famRstuPct.toFixed(1)}%;background:var(--sem-emerald);"></span>
        <span data-meter-key="tax-wf-srs" data-meter-w="${srsPct.toFixed(1)}" style="width:${srsPct.toFixed(1)}%;background:var(--sem-srs);"></span>
      </div>
      <ul class="fin-bento-list">
        <li>
          <span class="fin-bento-item-label"><i style="background:var(--sem-equities);"></i>CPF &amp; existing reliefs</span>
          <span class="fin-bento-item-meta">Base IRAS reliefs before voluntary top-ups</span>
          <strong>${m(baseReliefs)} <small class="fin-bento-share-pill">${Math.round(basePct)}%</small></strong>
        </li>
        <li>
          <span class="fin-bento-item-label"><i style="background:var(--sem-cpf);"></i>Self CPF RSTU${activeFamRstu > 0 ? " + Family RSTU" : ""}</span>
          <span class="fin-bento-item-meta">${activeSelfRstu > 0 || activeFamRstu > 0 ? `Saves ${m((tax.rstuTaxSaved || 0) + (tax.familyRstuTaxSaved || 0), "/yr")}` : `Up to ${m(tax.maxRstu, "/yr")} eligible room`}</span>
          <strong>${m(activeSelfRstu + activeFamRstu)} <small class="fin-bento-share-pill">${Math.round(selfRstuPct + famRstuPct)}%</small></strong>
        </li>
        <li>
          <span class="fin-bento-item-label"><i style="background:var(--sem-srs);"></i>SRS Contribution</span>
          <span class="fin-bento-item-meta">${activeSrs > 0 ? `Locked until age ${tax.srsLockInAge}` : `Up to ${m(tax.maxSrsAfterRstu, "/yr")} after RSTU`}</span>
          <strong>${m(activeSrs)} <small class="fin-bento-share-pill">${Math.round(srsPct)}%</small></strong>
        </li>
      </ul>
    </article>
    <div class="family-rstu-bar">
      <div class="family-rstu-copy">
        <strong>Spouse / Parents CPF Cash Top-Up (Family RSTU · Separate $8,000/yr Cap)</strong>
        <p>${
          tax.familyRstuPlanned > 0
            ? `Claiming <strong>${m(tax.eligibleFamilyRstu, "/yr")}</strong> family RSTU — saving an extra <strong>${m(tax.familyRstuTaxSaved, "/yr")}</strong> in IRAS tax on top of your own SA top-up.`
            : tax.potentialFamilyRstuTaxSaved > 0
              ? `Topping up a loved one’s CPF SA/RA unlocks up to <strong>${m(tax.maxFamilyRstuRoom, "/yr")}</strong> additional IRAS relief (saves <strong>${m(tax.potentialFamilyRstuTaxSaved, "/yr")}</strong> at ${marginalPct}).`
              : "Up to $8,000/yr separate IRAS tax relief when topping up a spouse, parent, or grandparent’s CPF SA/RA (subject to $80k personal relief cap)."
        }</p>
      </div>
      <div class="family-rstu-actions">
        ${
          tax.familyRstuPlanned > 0
            ? `<button type="button" class="button button-small" data-apply-family-rstu="0">Clear family RSTU</button>`
            : tax.maxFamilyRstuRoom > 0
              ? `<button type="button" class="button button-small" data-apply-family-rstu="${Math.round(tax.maxFamilyRstuRoom)}">Simulate +${m(tax.maxFamilyRstuRoom, "/yr")}</button>`
              : ""
        }
      </div>
    </div>
    ${(() => {
      const srsStartAge = tax.srsWithdrawalStartAge ?? tax.srsLockInAge;
      const srsZeroTaxCap =
        tax.srsZeroTaxCap || RetirementModel.C.srsSoftCapAt63;
      const srsZeroTaxCapCompact = compactMoney(srsZeroTaxCap);
      const srsCapFillPct = Math.min(
        100,
        Math.round((tax.srsProjectedAt63 / Math.max(1, srsZeroTaxCap)) * 100),
      );
      const srsBarTone =
        tax.srsTrapStatus === "balloon-trap"
          ? "is-danger"
          : tax.srsTrapStatus === "near-cap"
            ? "is-warn"
            : "is-srs";
      return `<div class="srs-trap-panel is-${tax.srsTrapStatus || "safe"}" role="region" aria-label="Projected SRS withdrawal tax from age ${srsStartAge}">
      <div class="srs-trap-head">
        <div class="srs-trap-copy">
          <strong>Projected SRS withdrawal tax from age ${srsStartAge}</strong>
          <p>${tax.srsTrapGuidance}</p>
        </div>
        <span class="status-pill ${tax.srsTrapTone || (tax.srsTrapStatus === "balloon-trap" ? "is-danger" : tax.srsTrapStatus === "near-cap" ? "is-warn" : "is-info")}">${
          tax.srsTrapStatus === "balloon-trap"
            ? `Estimated tax ${m(tax.srsWithdrawalTaxAt63.annualTax, "/yr")}`
            : tax.srsTrapHeadline
        }</span>
      </div>
      <div class="tap-progress-wrap">
        <div class="tap-progress-meta">
          <span>Projected age-${srsStartAge} pot vs ${srsZeroTaxCapCompact} $0-tax ceiling</span>
          <strong>${srsCapFillPct}%</strong>
        </div>
        <div class="tap-progress-track" role="progressbar" aria-valuenow="${srsCapFillPct}" aria-valuemin="0" aria-valuemax="100" aria-label="Projected SRS pot vs $0-tax ceiling">
          <span class="tap-progress-fill ${srsBarTone}" data-meter-key="tax-srs-cap-bar" data-meter-w="${srsCapFillPct}" style="width:${srsCapFillPct}%"></span>
        </div>
      </div>
      <dl class="tax-metrics-grid srs-trap-metrics">
        <div class="tax-metric-box">
          <dt>Projected SRS at Age ${srsStartAge}</dt>
          <dd>${m(tax.srsProjectedAt63, "", "tax-srs-proj63")}
            <small>${tax.srsProjectedAt63 > 0 ? `${((tax.srsReturnRate ?? 0) * 100).toFixed(2).replace(/\.00$/, "")}% p.a. (${tax.srsInvestedIn === "cash" ? "idle cash" : tax.srsInvestedIn === "ssb" ? "SSB" : tax.srsInvestedIn === "balanced" ? "60/40" : "Global ETFs"}) · ${m(tax.srsBalanceToday)} now + ${m(tax.srsAnnualPlanned, "/yr")}` : `$0 balance · $0/yr planned (${((tax.srsReturnRate ?? 0) * 100).toFixed(2).replace(/\.00$/, "")}% ${tax.srsInvestedIn === "cash" ? "idle cash" : tax.srsInvestedIn === "ssb" ? "SSB" : tax.srsInvestedIn === "balanced" ? "60/40" : "Global ETFs"} assumed)`}</small>
          </dd>
        </div>
        <div class="tax-metric-box">
          <dt>10-Yr Drawdown (${srsStartAge}–${srsStartAge + 10})</dt>
          <dd>${m(tax.srsTenYearAnnualDraw, "/yr", "tax-srs-draw")}
            <small>${tax.srsProjectedAt63 > 0 ? `${m(tax.srsTenYearMonthlyDraw, "/mo")} nominal · Tax-free ≤ $40k/yr` : `Up to $40,000/yr ($3,333/mo) tax-free at ${srsZeroTaxCapCompact} pot`}</small>
          </dd>
        </div>
        <div class="tax-metric-box">
          <dt>Safe Annual Pace to ${srsZeroTaxCapCompact}</dt>
          <dd>${m(tax.srsMaxSafeAnnualTo400k, "/yr", "tax-srs-safe-pace")}
            <small>${tax.srsFullCapProjectedAt63 > tax.srsTrapFloorAt63 && tax.srsMaxSafeAnnualTo400k < 15250 ? `Over ${tax.srsYearsToLockIn ?? Math.max(0, srsStartAge - 35)} yrs @ ${((tax.srsReturnRate ?? 0) * 100).toFixed(2).replace(/\.00$/, "")}% · $15.3k/yr max → ${compactMoney(tax.srsFullCapProjectedAt63)} pot` : `Statutory cap $15,300/yr · Direct excess to brokerage`}</small>
          </dd>
        </div>
        <div class="tax-metric-box">
          <dt>Est. Withdrawal Tax (50% Rule)</dt>
          <dd>${m(tax.srsWithdrawalTaxAt63?.annualTax || 0, "/yr", "tax-srs-wdtax")}
            <small>${tax.srsProjectedAt63 > 0 ? `50% taxable (${m(tax.srsTaxableAnnualAt63, "/yr")} vs $20k IRAS 0% threshold)` : `50% taxable · $0 tax when draw ≤ $40k/yr ($20k chargeable)`}</small>
          </dd>
        </div>
      </dl>
    </div>`;
    })()}
    <div class="srs-callout-bar" role="note">
      ${ICONS.warnTiny}
      <span>${tax.srsIdleWarning}</span>
    </div>
  </section>`;
}
