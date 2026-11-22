/**
 * Quick Edit modal controller: panel switching, live state sync, chip/stepper/input bindings.
 */
import {
  $,
  $$,
  buildAllocationMix,
  money,
  m,
  html,
  raw,
  bindDialogBackdropDismiss,
} from "./format.js";
export const QE_BINDINGS = [
  ["qe-retire", "known-retire"],
  ["qe-cpf-extra", "known-cpf-extra"],
  ["qe-cash-saving", "known-cash-saving"],
  ["qe-invest", "known-invest"],
];

const QE_PANEL_META = {
  goal: { title: "Target Retirement Age", focus: "#qe-retire" },
  "cpf-extra": { title: "Extra CPF Saving", focus: "#qe-cpf-extra" },
  "cash-saving": {
    title: "Monthly Planned Savings (HYSA / SSB)",
    focus: "#qe-cash-saving",
  },
  invest: {
    title: "Monthly Investment",
    focus: "#qe-invest",
  },
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
    SG_DEFAULT_PLAN,
    lastValidFieldValues,
    getSelected,
    getCurrentFirePlan,
    getCurrentAfterCpfCap,
    restoreInvokerFocus,
    openExpenseModal,
    clampSavingToTakeHome,
    render,
    scheduleRender,
    flushPendingRender,
    showToast,
  } = ctx;

  const defaultSsbReturnPct =
    RetirementModel.DEFAULT_MAS_LIVE_RATES.ssb.year10Return;
  const defaultSsbReturnDec = defaultSsbReturnPct / 100;
  const rstuCap = RetirementModel.C.rstuReliefCap;
  const defEqPct = SG_DEFAULT_PLAN.targetEquityPct;
  const defSgPct = SG_DEFAULT_PLAN.sgSleevePct;
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
    savingsProgressLabel = "",
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
      }
    }

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
      $("#qe-allocation-mix").innerHTML = buildAllocationMix(
        curEqPct,
        curSgPct,
      );
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
        const srsSuffix =
          srsMo > 0 ? html` (after ${raw(m(srsMo, "/mo"))} SRS)` : "";
        invSumEl.innerHTML = html`
          <div class="qe-rstu-head">
            <span>Monthly investment split</span>
            <strong>${raw(m(invMo, "/mo"))} total${raw(srsSuffix)}</strong>
          </div>
          <div class="qe-cash-proj-grid qe-invest-route-grid">
            <div class="qe-cash-proj-item">
              <span
                ><i
                  class="qe-route-dot"
                  style="background:var(--sem-equities);"
                ></i
                >Global Equity</span
              >
              <strong>${raw(m(buyGlobal, "/mo"))}</strong>
            </div>
            <div class="qe-cash-proj-item">
              <span
                ><i
                  class="qe-route-dot"
                  style="background:var(--sem-equities-sg);"
                ></i
                >SG Dividends</span
              >
              <strong>${raw(m(buySg, "/mo"))}</strong>
            </div>
            <div class="qe-cash-proj-item">
              <span
                ><i class="qe-route-dot" style="background:var(--sem-cash);"></i
                >Bond / SSB</span
              >
              <strong>${raw(m(buyBond, "/mo"))}</strong>
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
      const qeSummary = $("#qe-live-summary");
      if (qeSummary && savingsProgressLabel) {
        const horizon = fn.fullyFundedTo95
          ? `Sustained to ${fire.endAge}+`
          : `Funded to ${Math.floor(fn.depletionAge ?? fire.endAge)}`;
        qeSummary.textContent = `${savingsProgressLabel} · ${horizon}`;
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

  function updateSavingWarning(id, wasCapped, value) {
    const warning = $(`#${id}-warning`);
    warning.textContent = wasCapped
      ? `Capped at ${money(value)}/mo to fit within your ${money(getCurrentAfterCpfCap())}/mo pay after CPF.`
      : "";
    warning.hidden = !wasCapped;
  }

  if (qeDialog) {
    document.addEventListener("click", (event) => {
      const trigger = event.target?.closest?.("[data-quick-edit]");
      if (!trigger) return;
      event.preventDefault();
      if (trigger.dataset.quickEdit === "budget") {
        openExpenseModal(
          trigger.matches(".exp-edit-items") ? "items" : "auto",
          trigger,
        );
        return;
      }
      lastQeInvoker = trigger;
      $("#qe-open-full-settings").hidden = Boolean(trigger.closest("#top"));
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
          updateSavingWarning(qeId, rawNext > maxAllowed, next);
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
        updateSavingWarning(
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
        updateSavingWarning("qe-cash-saving", numRaw > maxAllowed, cappedVal);
        render();
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
        updateSavingWarning(
          "qe-invest",
          rawVal !== "" && numRaw > maxAllowed,
          cappedVal,
        );
        render();
        return;
      }
      if (event.target.closest("#qe-open-full-settings")) {
        qeDialog.dataset.flowNavigation = "true";
        qeDialog.close();
        $("#section-profile").click();
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
          updateSavingWarning(qeId, capped !== false, capped);
        }
        srcEl.value = qeEl.value;
        if (useImmediate) render();
        else scheduleRender();
      };
      qeEl.addEventListener("input", () => syncBack(false));
      qeEl.addEventListener("change", () => syncBack(true));
    });

    qeDialog.addEventListener("close", () => {
      $$(".qe-saving-warning").forEach((warning) => {
        warning.hidden = true;
      });
      delete qeDialog.dataset.investAutoLocked;
      let corrected = false;
      const minRetire = getMinRetireAge();
      for (const [qeId, srcId] of QE_BINDINGS) {
        const qeEl = $("#" + qeId);
        const srcEl = $("#" + srcId);
        if (!qeEl || !srcEl) continue;
        const rawVal = srcEl.value.trim();
        // Validate against qeEl when srcEl is a hidden input (HTML5 bars hidden inputs from constraint validation)
        const validatorEl = srcEl.type === "hidden" ? qeEl : srcEl;
        if (validatorEl.validity.badInput) {
          srcEl.value = lastValidFieldValues[srcId] ?? srcEl.defaultValue ?? "";
          qeEl.value = srcEl.value;
          corrected = true;
        } else if (rawVal !== "" && !validatorEl.validity.valid) {
          const minV =
            srcId === "known-retire" ? minRetire : Number(validatorEl.min || 0);
          const maxV =
            validatorEl.max !== "" ? Number(validatorEl.max) : Infinity;
          let clamped = Math.min(maxV, Math.max(minV, Number(rawVal)));
          if (validatorEl.step === "1") clamped = Math.round(clamped);
          srcEl.value = String(clamped);
          qeEl.value = srcEl.value;
          corrected = true;
        }
      }
      if (!flushPendingRender() && corrected) render();
      if (qeDialog.dataset.flowNavigation) {
        delete qeDialog.dataset.flowNavigation;
        return;
      }
      restoreInvokerFocus(lastQeInvoker, `[data-quick-edit="${activeQeTab}"]`);
    });
  }

  return {
    syncQuickEditState,
    getActiveQeTab: () => activeQeTab,
  };
}
