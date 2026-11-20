/**
 * Quick Edit modal controller: panel switching, live state sync, chip/stepper/input bindings.
 */
import {
  $,
  $$,
  formatFundedPct,
  money,
  m,
  html,
  raw,
  bindDialogBackdropDismiss,
} from "./format.js";
import {
  buildCashAccountsSummaryHTML,
  buildCashAccountsAlertsHTML,
  buildCashAccountsEditorHTML,
} from "./views-cash-div.js";

export const QE_BINDINGS = [
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

const QE_CURRENCY_IDS = new Set([
  "qe-oa",
  "qe-sa",
  "qe-ma",
  "qe-sa-invested",
  "qe-equities",
  "qe-sg-dividends",
  "qe-ssb-cash",
  "qe-srs",
]);

function parseQeCurrency(el) {
  if (!el) return "";
  const rawValue = el.value.trim().replace(/,/g, "");
  if (rawValue === "") return "";
  const numeric = Number(rawValue);
  return Number.isFinite(numeric) ? String(Math.round(numeric * 100) / 100) : "";
}

function formatQeCurrency(el) {
  if (!el || !QE_CURRENCY_IDS.has(el.id)) return;
  const rawValue = el.value.trim().replace(/,/g, "");
  if (rawValue === "") return;
  const numeric = Number(rawValue);
  if (!Number.isFinite(numeric)) return;
  el.value = numeric.toLocaleString("en-SG", {
    maximumFractionDigits: 2,
  });
}

function syncQeSrsDisclosure() {
  const srsBalance = Number(
    ($("#qe-srs")?.value || "").replace(/,/g, "") || 0,
  );
  const srsSection = $("#qe-srs-section");
  const allocationWrap = $("#qe-srs-invested-wrap");
  if (allocationWrap) allocationWrap.hidden = srsBalance <= 0;
  if (srsSection) srsSection.classList.toggle("is-empty", srsBalance <= 0);
}

const QE_PANEL_META = {
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

export function getMinRetireAge() {
  const dobInfo = RetirementModel.computeAgeFromDob(
    $("#person-dob")?.value || "",
  );
  const curAge =
    dobInfo.valid && dobInfo.age >= 18 && dobInfo.age <= 54
      ? dobInfo.age
      : RetirementModel.SG_DEFAULT_PLAN.age;
  const lifeMin = $("#known-lifestyle")?.value === "cca" ? 55 : 40;
  return Math.max(lifeMin, curAge);
}

export function createQuickEditController(ctx) {
  const {
    qeDialog,
    DEFAULT_DOB,
    SG_DEFAULT_PLAN,
    bucketIds,
    lastValidFieldValues,
    getSelected,
    getCurrentFirePlan,
    getCurrentCashPlan,
    getCurrentAfterCpfCap,
    getUseItemizedCashAccounts,
    getCustomCashAccounts,
    clearItemizedCashAccounts,
    setLastBankLoanRate,
    getQeModalSnap,
    setQeModalSnap,
    captureModalSnapshot,
    restoreModalSnapshot,
    bindRevertibleDialog,
    restoreInvokerFocus,
    openExpenseModal,
    clampSavingToTakeHome,
    handleHousingModeSwitch,
    syncBucketsToTotal,
    patchCashAccountRows,
    render,
    scheduleRender,
    showToast,
  } = ctx;

  const defaultSsbReturnPct =
    RetirementModel.DEFAULT_MAS_LIVE_RATES.ssb.year10Return;
  const defaultSsbReturnDec = defaultSsbReturnPct / 100;
  const rstuCap = RetirementModel.C.rstuReliefCap;
  const defEqPct = SG_DEFAULT_PLAN.targetEquityPct;
  const defSgPct = SG_DEFAULT_PLAN.sgSleevePct;
  const defSalary = SG_DEFAULT_PLAN.salary;
  const defRetire = SG_DEFAULT_PLAN.retire;
  const defInflation = SG_DEFAULT_PLAN.inflationRate;

  let lastQeInvoker = null;
  let activeQeTab = "goal";

  function syncQuickEditState(
    r = null,
    fire = null,
    simulation = null,
    bogle = null,
    tax = null,
  ) {
    if (!qeDialog || !qeDialog.open) return;
    const minRetire = getMinRetireAge();
    const qeRetire = $("#qe-retire");
    if (qeRetire) qeRetire.min = String(minRetire);

    for (const [qeId, srcId] of QE_BINDINGS) {
      const qeEl = $("#" + qeId);
      const srcEl = $("#" + srcId);
      if (!qeEl || !srcEl) continue;
      if (document.activeElement !== qeEl) {
        qeEl.value = srcEl.value;
        formatQeCurrency(qeEl);
      }
    }
    syncQeSrsDisclosure();

    const curRetire = Number($("#known-retire")?.value || defRetire);
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
    const curSalary = Number($("#person-salary")?.value || defSalary);
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
          Number(
            ((fire.cashReturnRate ?? defaultSsbReturnDec) * 100).toFixed(2),
          ),
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
            : rawCpfExtra !== "" &&
              Math.round(Number(rawCpfExtra)) === Number(pick);
        chip.classList.toggle("is-active", active);
        chip.setAttribute("aria-pressed", String(active));
      });

      const rawCashSaving = ($("#known-cash-saving")?.value || "").trim();
      const curCashSaving =
        rawCashSaving === "" ? 0 : Math.round(Number(rawCashSaving) || 0);
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
            : rawCashRate !== "" &&
              Math.abs(Number(rawCashRate) - Number(pick)) < 0.01;
        chip.classList.toggle("is-active", active);
        chip.setAttribute("aria-pressed", String(active));
      });

      const rawInvest = ($("#known-invest")?.value || "").trim();
      $$("[data-qe-pick-invest]").forEach((chip) => {
        const pick = chip.dataset.qePickInvest;
        const active =
          pick === ""
            ? rawInvest === ""
            : rawInvest !== "" &&
              Math.round(Number(rawInvest)) === Number(pick);
        chip.classList.toggle("is-active", active);
        chip.setAttribute("aria-pressed", String(active));
      });

      const rawEqVal = $("#known-target-equity")?.value;
      const curEqPct = Math.min(
        100,
        Math.max(
          0,
          Number(
            rawEqVal !== undefined && rawEqVal !== "" ? rawEqVal : defEqPct,
          ),
        ),
      );
      const rawSgVal = $("#known-sg-sleeve")?.value;
      const curSgPct = Math.min(
        100,
        Math.max(
          0,
          Number(
            rawSgVal !== undefined && rawSgVal !== "" ? rawSgVal : defSgPct,
          ),
        ),
      );
      const effGlobalPct = Math.round(curEqPct * (100 - curSgPct)) / 100;
      const effSgPct = Math.round(curEqPct * curSgPct) / 100;
      if ($("#qe-target-equity-readout")) {
        $("#qe-target-equity-readout").textContent =
          `${curEqPct}% Equity · ${100 - curEqPct}% Bond`;
      }
      if ($("#qe-stage1-eq-bar")) {
        $("#qe-stage1-eq-bar").style.width = `${curEqPct}%`;
      }
      if ($("#qe-stage1-bond-bar")) {
        $("#qe-stage1-bond-bar").style.width = `${100 - curEqPct}%`;
      }
      if ($("#qe-target-equity-suffix")) {
        $("#qe-target-equity-suffix").textContent =
          `% Equity (${100 - curEqPct}% Bond)`;
      }
      if ($("#qe-stage2-badge")) {
        $("#qe-stage2-badge").textContent =
          `Step 2 · Inside ${curEqPct}% Equity`;
      }
      if ($("#qe-funnel-stage-2")) {
        $("#qe-funnel-stage-2").classList.toggle(
          "is-disabled-sleeve",
          curEqPct === 0,
        );
      }
      if ($("#qe-sg-sleeve-readout")) {
        $("#qe-sg-sleeve-readout").innerHTML = html`${100 - curSgPct}% Global /
          ${curSgPct}% SG <span class="bogle-of-eq">of Eq</span>`;
      }
      if ($("#qe-sg-effective-pill")) {
        $("#qe-sg-effective-pill").textContent =
          `= ${effGlobalPct}% Global · ${effSgPct}% SG of total`;
      }
      if ($("#qe-sg-sleeve-suffix")) {
        $("#qe-sg-sleeve-suffix").textContent =
          `% SG (${100 - curSgPct}% Global)`;
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
        cashResetBtn.disabled =
          (rawCashSaving === "" || curCashSaving === 0) && rawCashRate === "";
      }
      const invResetBtn = $("#qe-invest-reset");
      if (invResetBtn) {
        invResetBtn.disabled =
          rawInvest === "" && curEqPct === defEqPct && curSgPct === defSgPct;
      }

      const cpfSumEl = $("#qe-cpf-extra-summary");
      if (cpfSumEl && fire) {
        const selected = getSelected();
        const sPath = simulation.selectedScenario
          ? RetirementModel.todayPlan({
              ...simulation.summary,
              scenarios: [simulation.selectedScenario],
            }).scenarios[0]
          : r.scenarios.find((sc) => sc.key === selected) || r.scenarios[0];
        const cpfExtraMo = simulation.cpfExtra || 0;
        const annualTopUp = Math.round(cpfExtraMo * 12);
        const rstuAnnual = Math.round(
          tax?.activeSelfRstu ?? Math.min(rstuCap, annualTopUp),
        );
        const rstuPct = Math.min(100, Math.round((rstuAnnual / rstuCap) * 100));
        const rstuMid = Math.round(rstuCap / 2);
        const rstuMonthlyMax = Math.round(rstuCap / 12);
        cpfSumEl.innerHTML = html`
          <div class="qe-rstu-head">
            <span>IRAS RSTU Tax Relief</span>
            <strong
              >${raw(m(rstuAnnual))} / ${raw(m(rstuCap))} (${rstuPct}%)</strong
            >
          </div>
          <div
            class="qe-split-bar qe-rstu-bar"
            role="progressbar"
            aria-valuenow="${rstuAnnual}"
            aria-valuemin="0"
            aria-valuemax="${rstuCap}"
            aria-label="IRAS RSTU tax relief ${money(rstuAnnual)} of ${money(rstuCap)} annual cap"
          >
            <span style="width:${rstuPct}%;background:var(--sem-cpf);"></span>
          </div>
          <div class="qe-rstu-scale" aria-hidden="true">
            <span>${raw(m(0))}</span>
            <span>${raw(m(rstuMid))}</span>
            <span>${raw(m(rstuCap))}</span>
          </div>
          <div class="qe-split-legend">
            <span
              ><i style="background:var(--sem-cpf);"></i
              ><span
                >Max CPF tax relief is
                <strong>${raw(m(rstuCap, "/yr"))}</strong>
                (${raw(m(rstuMonthlyMax, "/mo"))}) for cash top-ups to SA / RA
                (up to FRS).</span
              ></span
            >
            <span
              ><i style="background:var(--primary);"></i
              ><span
                >Age-55 CPF <strong>${raw(m(sPath.balance))}</strong> · CPF LIFE
                (65+) <strong>${raw(m(sPath.payout, "/mo"))}</strong></span
              ></span
            >
          </div>
        `;
      }

      const cashSumEl = $("#qe-cash-saving-summary");
      if (cashSumEl && fire) {
        const hysaRateAnnual = fire.cashReturnRate ?? defaultSsbReturnDec;
        const hysaRatePct = Number((hysaRateAnnual * 100).toFixed(2));
        const curCash =
          fire.points?.[0]?.ssbCash ?? Number($("#known-ssb-cash")?.value || 0);
        const bondSliceMo = bogle?.monthlyRebalance?.buyBondMonthly || 0;
        const totalCashInflowMo = (simulation.cashSaving || 0) + bondSliceMo;
        const retPt = fire.points?.find((pt) => pt.age === fire.retire);
        let projCash = retPt?.today?.ssbCash;
        if (projCash == null) {
          projCash = RetirementModel.projectCashBucketAtRetire({
            currentBalance: curCash,
            monthlyInflow: totalCashInflowMo,
            annualRate: hysaRateAnnual,
            yearsToRetire: Math.max(0, fire.retire - fire.age),
            inflationRate: r.inflation ?? defInflation,
          }).today;
        }
        projCash = Math.round(projCash);
        const bondNote =
          bondSliceMo > 0
            ? raw(
                html`<small class="qe-route-formula"
                  >${raw(m(simulation.cashSaving || 0))} cash +
                  ${raw(m(bondSliceMo))} bond slice</small
                >`,
              )
            : "";
        cashSumEl.innerHTML = html`
          <div class="qe-cash-proj-grid">
            <div class="qe-cash-proj-item">
              <span>Today's HYSA / SSB</span>
              <strong>${raw(m(curCash))}</strong>
            </div>
            <div class="qe-cash-proj-item">
              <span>Monthly Cash + Bond Inflow</span>
              <strong>+${raw(m(totalCashInflowMo, "/mo"))}</strong>
              ${bondNote}
            </div>
            <div class="qe-cash-proj-item is-highlight">
              <span>Age ${fire.retire} Projection (${hysaRatePct}% p.a.)</span>
              <strong>${raw(m(projCash))}</strong>
            </div>
          </div>
        `;
      }

      const invSumEl = $("#qe-invest-summary");
      if (invSumEl) {
        const invMo = simulation.invest || 0;
        const mr =
          bogle?.monthlyRebalance ||
          RetirementModel.bogleheadAllocation(
            {
              ...SG_DEFAULT_PLAN,
              targetEquityPct: curEqPct,
              sgSleevePct: curSgPct,
              srsAnnual: Number($("#known-srs-annual")?.value || 0),
            },
            invMo,
          ).monthlyRebalance;
        const buyGlobal = mr?.buyGlobalMonthly || 0;
        const buySg = mr?.buySgMonthly || 0;
        const buyBond = mr?.buyBondMonthly || 0;
        const srsMo = Math.round(mr?.srsMonthly || 0);
        const eqShare = Math.max(0, Math.min(100, curEqPct)) / 100;
        const sgShare = Math.max(0, Math.min(100, curSgPct)) / 100;
        const glBarPct = Math.round(eqShare * (1 - sgShare) * 100);
        const sgBarPct = Math.round(eqShare * sgShare * 100);
        const bdBarPct = Math.max(0, 100 - glBarPct - sgBarPct);
        if ($("#qe-funnel-connector-text")) {
          $("#qe-funnel-connector-text").innerHTML =
            curEqPct > 0
              ? html`Subdivides your
                  <strong
                    >${curEqPct}% Equity Sleeve
                    (${raw(m(buyGlobal + buySg, "/mo"))})</strong
                  >
                  into Global vs SG Dividend`
              : html`Target Equity is <strong>0%</strong> (100% Bond) — increase
                  Equity above 0% to activate Global / SG sleeve`;
        }
        const srsSuffix =
          srsMo > 0 ? html` (after ${raw(m(srsMo, "/mo"))} SRS)` : "";
        invSumEl.innerHTML = html`
          <div class="qe-rstu-head">
            <span>Final 3-Way Monthly Routing</span>
            <strong>${raw(m(invMo, "/mo"))} total${raw(srsSuffix)}</strong>
          </div>
          <div class="qe-split-bar" aria-hidden="true">
            <span
              style="width:${glBarPct}%;background:var(--sem-equities);"
            ></span>
            <span
              style="width:${sgBarPct}%;background:var(--sem-equities-sg);"
            ></span>
            <span style="width:${bdBarPct}%;background:var(--sem-cash);"></span>
          </div>
          <div class="qe-cash-proj-grid qe-invest-route-grid">
            <div class="qe-cash-proj-item">
              <span
                ><i
                  class="qe-route-dot"
                  style="background:var(--sem-equities);"
                ></i
                >Global Equity (${glBarPct}%)</span
              >
              <strong>${raw(m(buyGlobal, "/mo"))}</strong>
              <small class="qe-route-formula"
                >${curEqPct}% Eq × ${100 - curSgPct}% Global</small
              >
            </div>
            <div class="qe-cash-proj-item">
              <span
                ><i
                  class="qe-route-dot"
                  style="background:var(--sem-equities-sg);"
                ></i
                >SG Dividend (${sgBarPct}%)</span
              >
              <strong>${raw(m(buySg, "/mo"))}</strong>
              <small class="qe-route-formula"
                >${curEqPct}% Eq × ${curSgPct}% SG</small
              >
            </div>
            <div class="qe-cash-proj-item">
              <span
                ><i class="qe-route-dot" style="background:var(--sem-cash);"></i
                >Bond / SSB (${bdBarPct}%)</span
              >
              <strong>${raw(m(buyBond, "/mo"))}</strong>
              <small class="qe-route-formula">Step 1 Bond floor</small>
            </div>
          </div>
        `;
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
          readyBtn.dataset.readyInvest = String(
            Math.round(simulation?.invest || 0),
          );
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
        salaryTakeHomeEl.innerHTML = html`
          <div class="qe-split-bar" aria-hidden="true">
            <span
              class="qe-split-net"
              data-meter-key="qe-net-bar"
              data-meter-w="${netPct}"
              style="width:${netPct}%"
            ></span>
            <span
              class="qe-split-cpf"
              data-meter-key="qe-cpf-bar"
              data-meter-w="${cpfPct}"
              style="width:${cpfPct}%"
            ></span>
          </div>
          <div class="qe-split-legend">
            <span
              ><i style="background:var(--primary);"></i>Take-home
              <strong>${raw(m(r.afterCpf, "/mo", "qe-net-pay"))}</strong>
              (${netPct}%)</span
            >
            <span
              ><i style="background:var(--sem-cpf);"></i>Employee CPF
              <strong>−${raw(m(r.employeeCpf, "/mo", "qe-emp-cpf"))}</strong>
              (${cpfPct}%)</span
            >
          </div>
        `;
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
            ? html`Global ${raw(m(eqV))} · SG ${raw(m(sgV))} · Cash
              ${raw(m(ssbV))}${
                srsV > 0 ? raw(html` · SRS ${raw(m(srsV))}`) : ""
              }`
            : html`Direct total ${raw(m(outTot))}`;
        const cpfDetail = html`OA ${raw(m(oaV))} · SA ${raw(m(saV))} · MA
        ${raw(m(maV))}${
          saInvV > 0 ? raw(html` · CPFIS-SA ${raw(m(saInvV))}`) : ""
        }`;
        breakdownEl.innerHTML = html`
          <div class="qe-bd-top">
            <span>Total Assets</span>
            <strong>${raw(m(cpfTot + outTot, "", "qe-bd-total"))}</strong>
          </div>
          <div
            class="qe-bd-split"
            role="img"
            aria-label="CPF ${raw(m(cpfTot))}, Outside ${raw(m(outTot))}"
          >
            <span
              class="qe-bd-split-cpf"
              style="width:${cpfTot + outTot > 0 ? Math.max(0, Math.min(100, (cpfTot / (cpfTot + outTot)) * 100)) : 0}%"
            ></span>
            <span
              class="qe-bd-split-outside"
              style="width:${cpfTot + outTot > 0 ? Math.max(0, Math.min(100, (outTot / (cpfTot + outTot)) * 100)) : 0}%"
            ></span>
          </div>
          <div class="qe-bd-rows">
            <div>
              <span>CPF (${raw(m(cpfTot))})</span
              ><small>${raw(cpfDetail)}</small>
            </div>
            <div>
              <span>Outside (${raw(m(outTot))})</span
              ><small>${raw(outDetail)}</small>
            </div>
          </div>
        `;
      }
      const activeCashInQe =
        getUseItemizedCashAccounts() && getCustomCashAccounts().length > 0;
      const qeSingleWrap = $("#qe-cash-single-wrap");
      if (qeSingleWrap) {
        qeSingleWrap.hidden = activeCashInQe;
      }
      const qeCashBtn = $("#qe-cash-breakdown-btn");
      if (qeCashBtn) {
        qeCashBtn.textContent = "Break down by bank & SSB accounts →";
      }
      const qeCashSlot = $("#qe-cash-accounts-slot");
      const currentCashPlan = getCurrentCashPlan();
      if (qeCashSlot && currentCashPlan) {
        const activeCash =
          getUseItemizedCashAccounts() && getCustomCashAccounts().length > 0;
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
          const countEl = qeCashSlot.querySelector("#cash-acc-count-qe");
          if (countEl) {
            countEl.innerHTML = html`<strong>${bd.accountCount}</strong>
              ${bd.accountCount === 1 ? "account" : "accounts"} · Total
              <strong>${raw(m(bd.totalBalance))}</strong>`;
          }
          patchCashAccountRows(qeCashSlot, bd);
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
            : `${formatFundedPct(fn.pctFunded)} Funded`;
        const horizon = fn.fullyFundedTo95
          ? `Sustained to ${fire.endAge}+`
          : `Funded to ${Math.floor(fn.depletionAge ?? fire.endAge)}`;
        qeSummary.textContent = `${funded} · ${horizon}`;
      }
    }
  }

  function setQuickEditPanel(
    panelKey,
    focusInput = false,
    focusOverride = null,
  ) {
    const validPanels = Object.keys(QE_PANEL_META);
    activeQeTab = validPanels.includes(panelKey) ? panelKey : "goal";
    qeDialog.dataset.qePanel = activeQeTab;
    const titleEl = $("#quick-edit-title");
    if (titleEl) titleEl.textContent = QE_PANEL_META[activeQeTab].title;
    validPanels.forEach((key) => {
      const panel = $(`#qe-panel-${key}`);
      if (panel) panel.hidden = key !== activeQeTab;
    });
    if (focusInput) {
      const focusSel = focusOverride || QE_PANEL_META[activeQeTab].focus;
      requestAnimationFrame(() => $(focusSel)?.focus());
    }
  }

  if (qeDialog) {
    document.addEventListener("click", (event) => {
      const trigger = event.target?.closest?.("[data-quick-edit]");
      if (!trigger) return;
      event.preventDefault();
      if (trigger.dataset.quickEdit === "budget") {
        openExpenseModal("auto", trigger);
        return;
      }
      lastQeInvoker = trigger;
      if (!qeDialog.open) {
        setQeModalSnap(captureModalSnapshot());
      }
      const scroller = qeDialog.querySelector(".settings-scroll-body");
      if (scroller) scroller.scrollTop = 0;
      if (!qeDialog.open) qeDialog.showModal();
      syncQuickEditState(null, getCurrentFirePlan(), null);
      setQuickEditPanel(
        trigger.dataset.quickEdit || "goal",
        true,
        trigger.dataset.qeFocus || null,
      );
      render();
    });

    bindDialogBackdropDismiss(qeDialog);
    qeDialog.addEventListener("click", (event) => {
      const deltaBtn = event.target.closest("[data-qe-retire-delta]");
      if (deltaBtn) {
        const minRetire = getMinRetireAge();
        const cur = Number($("#known-retire")?.value || defRetire);
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
          Math.max(
            minRetire,
            Number(pickAgeBtn.dataset.qePickAge || defRetire),
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
      const salDeltaBtn = event.target.closest("[data-qe-salary-delta]");
      if (salDeltaBtn) {
        const curSal = Number($("#person-salary")?.value || defSalary);
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
          Math.max(751, Number(pickSalBtn.dataset.qePickSalary || defSalary)),
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

      const getQeMaxAllowed = (qeId) => {
        const otherQes = [
          $("#qe-cpf-extra"),
          $("#qe-cash-saving"),
          $("#qe-invest"),
        ].filter((el) => el && el.id !== qeId);
        const otherVal = otherQes.reduce(
          (sum, el) =>
            sum +
            (el.value.trim() !== "" ? Math.max(0, Number(el.value) || 0) : 0),
          0,
        );
        return Math.max(0, getCurrentAfterCpfCap() - otherVal);
      };
      const updateQeHint = (qeId, wasCapped, cappedVal) => {
        const hintEl = $(
          qeId === "qe-invest"
            ? "#qe-invest-hint"
            : qeId === "qe-cash-saving"
              ? "#qe-cash-saving-hint"
              : "#qe-cpf-extra-hint",
        );
        if (!hintEl) return;
        hintEl.textContent = wasCapped
          ? `Capped at ${money(cappedVal)}/mo (within your ${money(getCurrentAfterCpfCap())}/mo take-home pay).`
          : qeId === "qe-invest"
            ? "Leave blank for suggested saving target."
            : qeId === "qe-cash-saving"
              ? "Stays in cash / SSB. Separate from outside investments."
              : "Leave blank for target path suggestion.";
        hintEl.classList.toggle("is-capped", wasCapped);
      };

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
        if (qeEl && srcEl) {
          const maxAllowed = getQeMaxAllowed(qeId);
          const base =
            qeEl.value.trim() === ""
              ? Number(qeEl.placeholder || 0)
              : Number(qeEl.value || 0);
          const rawNext = Math.max(
            0,
            Math.round((base + Number(stepBtn.dataset.delta || 0)) * 100) / 100,
          );
          const next = Math.min(maxAllowed, rawNext);
          if (qeId === "qe-invest") delete qeDialog.dataset.investAutoLocked;
          qeEl.value = String(next);
          srcEl.value = String(next);
          updateQeHint(qeId, rawNext > maxAllowed, next);
          render();
        }
        return;
      }
      const pickCpfBtn = event.target.closest("[data-qe-pick-cpf-extra]");
      if (pickCpfBtn) {
        const rawVal = pickCpfBtn.dataset.qePickCpfExtra;
        const maxAllowed = getQeMaxAllowed("qe-cpf-extra");
        const numRaw = Math.max(0, Number(rawVal) || 0);
        const cappedVal = Math.min(maxAllowed, numRaw);
        const val = rawVal === "" ? "" : String(cappedVal);
        if ($("#known-cpf-extra")) $("#known-cpf-extra").value = val;
        if ($("#qe-cpf-extra")) $("#qe-cpf-extra").value = val;
        updateQeHint(
          "qe-cpf-extra",
          rawVal !== "" && numRaw > maxAllowed,
          cappedVal,
        );
        render();
        return;
      }
      const pickCashBtn = event.target.closest("[data-qe-pick-cash-saving]");
      if (pickCashBtn) {
        const rawVal = pickCashBtn.dataset.qePickCashSaving;
        const maxAllowed = getQeMaxAllowed("qe-cash-saving");
        const numRaw = Math.max(0, Number(rawVal) || 0);
        const cappedVal = Math.min(maxAllowed, numRaw);
        const val = String(cappedVal);
        if ($("#known-cash-saving")) $("#known-cash-saving").value = val;
        if ($("#sim-cash-saving")) $("#sim-cash-saving").value = val;
        if ($("#qe-cash-saving")) $("#qe-cash-saving").value = val;
        updateQeHint("qe-cash-saving", numRaw > maxAllowed, cappedVal);
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
      const cashRateDeltaBtn = event.target.closest(
        "[data-qe-cash-rate-delta]",
      );
      if (cashRateDeltaBtn) {
        const qeEl = $("#qe-cash-return");
        const srcEl = $("#known-cash-return");
        if (qeEl && srcEl) {
          const base =
            qeEl.value.trim() === ""
              ? Number(qeEl.placeholder || defaultSsbReturnPct)
              : Number(qeEl.value || 0);
          const next = Math.min(
            15,
            Math.max(
              0,
              Math.round(
                (base + Number(cashRateDeltaBtn.dataset.qeCashRateDelta || 0)) *
                  100,
              ) / 100,
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
        const rawVal = pickInvestBtn.dataset.qePickInvest;
        const maxAllowed = getQeMaxAllowed("qe-invest");
        const numRaw = Math.max(0, Number(rawVal) || 0);
        const cappedVal = Math.min(maxAllowed, numRaw);
        const val = rawVal === "" ? "" : String(cappedVal);
        delete qeDialog.dataset.investAutoLocked;
        if ($("#known-invest")) $("#known-invest").value = val;
        if ($("#sim-invest")) $("#sim-invest").value = val;
        if ($("#qe-invest")) $("#qe-invest").value = val;
        updateQeHint(
          "qe-invest",
          rawVal !== "" && numRaw > maxAllowed,
          cappedVal,
        );
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
          const rawCur = $("#known-target-equity")?.value;
          const cur = Number(
            rawCur !== undefined && rawCur !== "" ? rawCur : defEqPct,
          );
          const next = Math.min(100, Math.max(0, cur + delta));
          if ($("#known-target-equity"))
            $("#known-target-equity").value = String(next);
          if ($("#qe-target-equity"))
            $("#qe-target-equity").value = String(next);
          render();
        } else if (field === "known-sg-sleeve") {
          const rawCur = $("#known-sg-sleeve")?.value;
          const cur = Number(
            rawCur !== undefined && rawCur !== "" ? rawCur : defSgPct,
          );
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
        delete qeDialog.dataset.investAutoLocked;
        const defEqStr = String(defEqPct);
        const defSgStr = String(defSgPct);
        if ($("#known-invest")) $("#known-invest").value = "";
        if ($("#sim-invest")) $("#sim-invest").value = "";
        if ($("#qe-invest")) $("#qe-invest").value = "";
        if ($("#known-target-equity"))
          $("#known-target-equity").value = defEqStr;
        if ($("#qe-target-equity")) $("#qe-target-equity").value = defEqStr;
        if ($("#bogle-target-slider"))
          $("#bogle-target-slider").value = defEqStr;
        if ($("#known-sg-sleeve")) $("#known-sg-sleeve").value = defSgStr;
        if ($("#qe-sg-sleeve")) $("#qe-sg-sleeve").value = defSgStr;
        if ($("#bogle-sg-slider")) $("#bogle-sg-slider").value = defSgStr;
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
      if (event.target.closest("[data-qe-cancel]")) {
        qeDialog.dataset.cancelled = "true";
        const snap = getQeModalSnap();
        if (snap) {
          restoreModalSnapshot(snap);
          setQeModalSnap(null);
        }
        qeDialog.close();
        showToast("Discarded changes");
        return;
      }
      if (event.target.closest("[data-qe-close]")) {
        qeDialog.close();
      }
    });

    QE_BINDINGS.forEach(([qeId, srcId]) => {
      const qeEl = $("#" + qeId);
      const srcEl = $("#" + srcId);
      if (!qeEl || !srcEl) return;
      const syncBack = (useImmediate = false) => {
        if (qeId === "qe-dob" && qeEl.validity.badInput) {
          return;
        }
        if (qeId === "qe-retire" && qeDialog.dataset.investAutoLocked) {
          delete qeDialog.dataset.investAutoLocked;
          if ($("#known-invest")) $("#known-invest").value = "";
          if ($("#qe-invest")) $("#qe-invest").value = "";
          if ($("#sim-invest")) $("#sim-invest").value = "";
        }
        if (
          qeId === "qe-invest" ||
          qeId === "qe-cash-saving" ||
          qeId === "qe-cpf-extra"
        ) {
          if (qeId === "qe-invest") delete qeDialog.dataset.investAutoLocked;
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
                ? `Capped at ${money(capped)}/mo (within your ${money(getCurrentAfterCpfCap())}/mo take-home pay).`
                : qeId === "qe-invest"
                  ? "Leave blank for suggested saving target."
                  : qeId === "qe-cash-saving"
                    ? "Stays in cash / SSB. Separate from outside investments."
                    : "Leave blank for target path suggestion.";
            hintEl.classList.toggle("is-capped", capped !== false);
          }
        }
        const normalized = QE_CURRENCY_IDS.has(qeId)
          ? parseQeCurrency(qeEl)
          : qeEl.value;
        srcEl.value = normalized;
        if (QE_CURRENCY_IDS.has(qeId) && normalized !== "") {
          qeEl.value = Number(normalized).toLocaleString("en-SG", {
            maximumFractionDigits: 2,
          });
        }
        if (qeId === "qe-srs") syncQeSrsDisclosure();
        if (qeId === "qe-housing-mode") {
          handleHousingModeSwitch(qeEl.value);
        }
        if (
          qeId === "qe-housing-rate" &&
          $("#known-housing-mode")?.value === "bank" &&
          qeEl.value.trim() !== ""
        ) {
          setLastBankLoanRate(qeEl.value.trim());
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
                  Math.max(
                    minR,
                    Number.isFinite(curR) ? Math.round(curR) : defRetire,
                  ),
                ),
              );
              retEl.value = clampedR;
              if ($("#qe-retire")) $("#qe-retire").value = clampedR;
            }
          }
        }
        if (srcId === "known-ssb-cash") {
          clearItemizedCashAccounts();
        }
        if (bucketIds.includes(srcId)) {
          syncBucketsToTotal();
        }
        if (useImmediate) render();
        else scheduleRender();
      };
      qeEl.addEventListener("input", () => syncBack(false));
      qeEl.addEventListener("change", () => syncBack(true));
      if (QE_CURRENCY_IDS.has(qeId)) {
        qeEl.addEventListener("blur", () => formatQeCurrency(qeEl));
      }
    });

    bindRevertibleDialog(qeDialog, {
      getSnap: () => getQeModalSnap(),
      clearSnap: () => {
        delete qeDialog.dataset.investAutoLocked;
        setQeModalSnap(null);
      },
      onCancelled: () => {
        restoreInvokerFocus(
          lastQeInvoker,
          `[data-quick-edit="${activeQeTab}"]`,
        );
      },
      onCommit: () => {
        let corrected = false;
        const minRetire = getMinRetireAge();
        for (const [qeId, srcId] of QE_BINDINGS) {
          if (qeId === "qe-housing-mode" || qeId === "qe-housing-parties")
            continue;
          const qeEl = $("#" + qeId);
          const srcEl = $("#" + srcId);
          if (!qeEl || !srcEl) continue;
          const rawVal = srcEl.value.trim();
          // Validate against qeEl when srcEl is a hidden input (HTML5 bars hidden inputs from constraint validation)
          const validatorEl = srcEl.type === "hidden" ? qeEl : srcEl;
          if (srcId === "person-dob") {
            const dobInfo = RetirementModel.computeAgeFromDob(rawVal);
            if (
              validatorEl.validity.badInput ||
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
          if (validatorEl.validity.badInput) {
            srcEl.value =
              lastValidFieldValues[srcId] ?? srcEl.defaultValue ?? "";
            qeEl.value = srcEl.value;
            corrected = true;
          } else if (srcId === "person-salary" && rawVal === "") {
            srcEl.value = lastValidFieldValues[srcId] || String(defSalary);
            qeEl.value = srcEl.value;
            corrected = true;
          } else if (rawVal !== "" && !validatorEl.validity.valid) {
            const minV =
              srcId === "known-retire"
                ? minRetire
                : Number(validatorEl.min || 0);
            const maxV =
              validatorEl.max !== "" ? Number(validatorEl.max) : Infinity;
            let clamped = Math.min(maxV, Math.max(minV, Number(rawVal)));
            if (validatorEl.step === "1") clamped = Math.round(clamped);
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
        restoreInvokerFocus(
          lastQeInvoker,
          `[data-quick-edit="${activeQeTab}"]`,
        );
      },
    });
  }

  return {
    getMinRetireAge,
    syncQuickEditState,
    setQuickEditPanel,
    getActiveQeTab: () => activeQeTab,
    setLastQeInvoker: (el) => {
      lastQeInvoker = el;
    },
  };
}
