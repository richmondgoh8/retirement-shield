import { m, centsHtml } from "./format.js";
import { buildTaxSweetSpotSection } from "./views-cash-div.js";

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
  const oaTransferSummaryTable = `<div class="timing-comparison">${[
    ["Keep OA as-is", keepOA, false],
    ["Transfer eligible OA to SA", moveOA, true],
  ]
    .map(([label, x, isTransfer]) => {
      const oaLeftNom = Math.max(0, x.oaAfter55 ?? x.availableAt55 - x.cpfAt55);
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
                <div><dt>Net interest gain at 55</dt><dd>${isTransfer && moveOA.oaTransfer > 0 ? `+${m(transferDiffToday)} <small>(+${m(transferDiffNominal)} at 55)</small>` : m(0)}</dd></div>
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
  const oaInterest55Nominal = (oaLeft55Nominal * RetirementModel.C.oaRate) / 12;
  const oaInterest55Today = (oaLeft55Today * RetirementModel.C.oaRate) / 12;
  const rstuBracketStr = (tax.taxBefore.marginalRate * 100)
    .toFixed(1)
    .replace(/\.0$/, "");
  const pathName =
    selected === "brs"
      ? "BRS (Property Pledge)"
      : selected === "ers"
        ? "ERS Maximum"
        : selected === "salary"
          ? "CPF Salary Only"
          : "FRS Target";
  return `<section id="cpf-position-details" class="card-surface rules-card" aria-labelledby="cpf-pos-title">
        <div class="rules-card-head">
          <div>
            <h2 id="cpf-pos-title">CPF today → age 55, OA Interest Tap &amp; Voluntary Housing Refund</h2>
            <p>Active <strong>${pathName}</strong> path${simExtraForCpf > 0 ? ` (+${m(simExtraForCpf, "/mo")} extra CPF)` : ""} · +1% extra interest on first $60k ($20k OA cap) · ${rstuBracketStr}% tax bracket.</p>
          </div>
          <span class="fin-target-pill">Today’s $ · Age-55 nominal</span>
        </div>
        <dl class="tax-metrics-grid">
          <div class="tax-metric-box"><dt>OA today</dt><dd>${centsHtml(oaNow)}<small>2.5% base + 1% extra on first $20k → SA (${m(oaExtraEligibleNow)} / $20k used)</small></dd></div>
          <div class="tax-metric-box"><dt>SA today</dt><dd>${centsHtml(saNow)}<small>4.0% base + 1% on first $60k combined (${m(combinedExtraEligibleNow)} / $60k used)</small></dd></div>
          <div class="tax-metric-box"><dt>SA top-up room to ${RetirementModel.C.year} FRS</dt><dd>${centsHtml(roomNow)}<small>Self RSTU: ${m(tax.maxRstu, "/yr")} (saves ${m(tax.rstuTaxSaved, "/yr")})</small></dd></div>
          <div class="tax-metric-box"><dt>OA transferable to SA now</dt><dd>${centsHtml(Math.min(oaNow, roomNow))}<small>Irreversible · $0 tax relief · Compounds at 4%–5% in SA</small></dd></div>
        </dl>
        ${oaTransferSummaryTable}
        <div class="cpf-vhr-grid">
          <div class="timing-col cpf-vhr-box">
            <div class="timing-col-head">
              <h3>Post-55 OA Interest Tap</h3>
              <span class="swell-slate-pill">2.5% p.a. liquid</span>
            </div>
            <dl>
              <div><dt>Excess OA at 55 (${selected === "brs" ? "BRS Pledge" : selected.toUpperCase()})</dt><dd>${m(oaLeft55Today)} <small>(${m(oaLeft55Nominal)} at 55)</small></dd></div>
              <div><dt>Withdrawable OA interest</dt><dd>${m(oaInterest55Today, "/mo")} <small>(${m(oaInterest55Nominal, "/mo")} at 55)</small></dd></div>
              <div><dt>$500k OA benchmark</dt><dd>${m(1042, "/mo")} <small>(${m(12500, "/yr")})</small></dd></div>
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
              <div><dt>Remaining ${m(RetirementModel.C.personalReliefCap)} relief cap</dt><dd>${m(tax.reliefCapRemaining)}</dd></div>
              <div><dt>Voluntary Housing Refund (VHR)</dt><dd>2.5% OA <small>($0 tax relief)</small></dd></div>
              <div><dt>Lock-in vs liquidity</dt><dd>RSTU locks to 55 · VHR liquid at 55</dd></div>
            </dl>
          </div>
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
  learningTarget,
}) {
  const lesson = learningPlan;
  const cohortYear55 = RetirementModel.C.year + 55 - r.age;
  const planLabelShort =
    r.plan === "escalating" ? "Escalating +2%/yr" : "Standard";
  const targetFundPct = Math.min(
    100,
    Math.round((lesson.availableToday / Math.max(1, lesson.targetToday)) * 100),
  );
  const gapZero =
    (lesson.plannedCpfExtra > 0
      ? lesson.withPlanned.remainingGapToday
      : lesson.gapToday) <= 1;
  const lessonHTML = `<section id="cpf-goal-guide" class="card-surface rules-card" aria-labelledby="cpf-goal-title">
      <div class="rules-card-head">
        <div>
          <h2 id="cpf-goal-title">How to reach BRS, FRS or ERS at 55</h2>
          <p>Age ${r.age} cohort (turning 55 in ${cohortYear55}) · <strong>${planLabelShort}</strong> Plan · ${(r.inflation * 100).toFixed(1).replace(/\.0$/, "")}% inflation.</p>
        </div>
        <span class="fin-target-pill">Today’s $ · Age-55 nominal</span>
      </div>
      <div class="goal-choices" role="group" aria-label="CPF milestone to learn about">${[
        ["brs", "Basic · Property Pledge"],
        ["frs", "Standard · Default"],
        ["ers", "Maximum · Post-55 Top-Up"],
      ]
        .map(([key, tag]) => {
          const cm = lesson.cohortMilestones[key];
          return `<button type="button" data-learn="${key}" aria-pressed="${key === learningTarget}">
            <div class="goal-choice-top">
              <strong>${key.toUpperCase()}</strong>
              <span class="goal-choice-payout">${m(cm.payoutToday, "/mo")}</span>
            </div>
            <div class="goal-choice-sum">${m(cm.sumToday)} <span>today’s $</span></div>
            <small>${tag} · ${m(cm.sumAt55)} nom. at 55</small>
          </button>`;
        })
        .join("")}</div>
      <div class="tap-progress-wrap">
        <div class="tap-progress-meta">
          <span>Projected age-55 OA + SA vs <strong>${learningTarget.toUpperCase()}</strong> target</span>
          <strong>${targetFundPct}% funded${targetFundPct >= 100 ? " ✓" : ""}</strong>
        </div>
        <div class="tap-progress-track" role="progressbar" aria-valuenow="${targetFundPct}" aria-valuemin="0" aria-valuemax="100" aria-label="${targetFundPct}% of ${learningTarget.toUpperCase()} funded by projected age-55 OA + SA">
          <span class="tap-progress-fill is-tap1" data-meter-key="cpf-milestone-fill" data-meter-w="${targetFundPct}" style="width:${targetFundPct}%"></span>
        </div>
      </div>
      <dl class="tax-metrics-grid">
        <div class="tax-metric-box"><dt>Target ${learningTarget.toUpperCase()} at age 55</dt><dd>${m(lesson.targetToday, "", "lesson-target")}<small>Nominal at 55: ${m(lesson.target, "", "lesson-target-nom")}</small></dd></div>
        <div class="tax-metric-box"><dt>OA + SA at 55 (${r.awBonusAnnual > 0 ? "salary + bonus" : "salary"} only)</dt><dd>${m(lesson.availableToday, "", "lesson-avail")}<small>Nominal at 55: ${m(lesson.available)}</small></dd></div>
        <div class="tax-metric-box"><dt>${lesson.plannedCpfExtra > 0 ? `Remaining gap after ${m(lesson.plannedCpfExtra, "/mo")} extra` : `Gap to ${learningTarget.toUpperCase()} at 55`}</dt><dd>${m(lesson.plannedCpfExtra > 0 ? lesson.withPlanned.remainingGapToday : lesson.gapToday, "", "lesson-gap")}<small>${lesson.plannedCpfExtra > 0 ? `Nominal remaining: ${m(lesson.withPlanned.remainingGap, "", "lesson-gap-nom")} (before extra: ${m(lesson.gapToday)} today’s $)` : `Nominal gap at 55: ${m(lesson.gap, "", "lesson-gap-nom")}`}</small></dd></div>
        <div class="tax-metric-box"><dt>Extra CPF saving to hit ${learningTarget.toUpperCase()}</dt><dd>${lesson.monthly === null ? "Lump sum only" : m(lesson.monthly, "/mo", "lesson-monthly")}<small>${lesson.monthly === null ? "Retiring before/at current age" : lesson.plannedCpfExtra > 0 ? (lesson.withPlanned.hitsTarget ? `✓ Covered by your ${m(lesson.plannedCpfExtra, "/mo")} extra CPF` : `+${m(lesson.withPlanned.additionalMonthlyNeeded, "/mo")} above your ${m(lesson.plannedCpfExtra, "/mo")}`) : `Until age ${lesson.untilAge} (total monthly top-up)`}</small></dd></div>
      </dl>
      <ul class="compact-list cpf-rules-notes">
        <li><strong>Before 55:</strong> Cash RSTU and OA-to-SA transfers share your remaining SA room of <strong>${centsHtml(lesson.currentRoom)}</strong> (to reach the ${RetirementModel.C.year} FRS cap of ${m(RetirementModel.C.frs)}) and are irreversible.</li>
        <li><strong>At 55:</strong> SA closes; SA then OA fund RA up to cohort FRS (${m(lesson.cohortMilestones.frs.sumAt55)} nominal). Voluntary ERS top-ups into RA open from age 55 ($0 RSTU tax relief above FRS); any pre-55 extra saving beyond SA room is held aside until 55.</li>
        ${learningTarget === "brs" ? "<li><strong>BRS property rule:</strong> Withdrawing RA above BRS requires pledging a property whose lease covers you to age 95+.</li>" : ""}
      </ul>
    </section>`;
  return `
    <header class="ember-page-header fin-page-header">
      <div class="fin-header-copy">
        <h1>CPF Milestones &amp; Age-55 Rules</h1>
        <p class="fin-page-sub">SA closure, RA formation, BRS/FRS/ERS thresholds, and CPF LIFE mechanics.</p>
      </div>
      <div class="ember-header-meta">
        <button type="button" class="fin-action-chip" data-quick-edit="balances">Edit CPF Balances</button>
        <button type="button" class="fin-action-chip" data-quick-edit="cpf-extra">Edit Extra CPF</button>
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
          <h1>Tax Relief Optimization</h1>
          <p class="fin-page-sub">IRAS YA ${C.year} relief waterfall across CPF RSTU, Family Top-Ups, and SRS.</p>
        </div>
        <div class="ember-header-meta">
          <button type="button" class="fin-action-chip" data-quick-edit="salary">Edit Salary</button>
          <button type="button" class="fin-action-chip" data-quick-edit="balances">Edit SRS</button>
          <span class="status-pill is-info">${marginalTaxPct} IRAS Bracket</span>
        </div>
      </header>
      ${buildTaxSweetSpotSection(tax)}
      <section class="card-surface rules-card" id="salary-cpf-caps" aria-labelledby="salary-caps-title">
        <div class="rules-card-head">
          <div>
            <h2 id="salary-caps-title">Salary &amp; Bonus CPF Contributions (${C.year} Ceilings)</h2>
            <p>${C.year} Ordinary Wage ceiling: ${m(C.wageCap, "/mo")} · Annual CPF salary ceiling: ${m(C.annualWageCap, "/yr")} (${m(C.cpfAnnualLimit)} mandatory CPF cap).${r.awBonusAnnual > 0 ? ` Includes <strong>${m(r.awBonusAnnual, "/yr")}</strong> annual bonus (<strong>${m(r.awSubjectAnnual, "/yr")}</strong> subject to AW CPF).` : ""}</p>
          </div>
          <span class="fin-target-pill">Age ${r.age} · ${r.age >= 55 ? "Senior CPF rates" : "Under 55 rates"}</span>
        </div>
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
