import {
  $,
  $$,
  fmtInt,
  formatFundedPct,
  money,
  formatMoneyInput,
  m,
  centsHtml,
  ageLabel,
  ICONS,
  resetControl,
  bindDialogBackdropDismiss,
  escapeAttr,
  html,
  raw,
  formatExpSharePct,
  formatDobShort,
  formatAnnuityIrr,
} from "./src/app/format.js";
import { handleDividendPresetClick } from "./src/app/dividend-presets.js";
import {
  captureModalSnapshot as captureModalSnapshotHelper,
  restoreModalSnapshot as restoreModalSnapshotHelper,
  restoreInvokerFocus,
} from "./src/app/modals.js";
import {
  createQuickEditController,
  getMinRetireAge,
} from "./src/app/quick-edit.js";
import {
  buildExpenseCardHTML,
  buildExpenseModalBodyHTML,
} from "./src/app/views-expense.js";
import {
  buildCpfRulesTabHTML,
  buildTaxTabHTML,
} from "./src/app/views-cpf-tax.js";
import {
  PLAN_STORAGE_VERSION,
  SUPPORTED_PLAN_VERSIONS,
  isPlanShareHash,
  buildShareDefaultEntries,
  encodeShareToken as encodeShareTokenWithDefaults,
  decodeShareHashToParams as decodeShareHashWithDefaults,
} from "./src/app/share-codec.js";
import {
  buildCashCardsMarkup,
  buildCashAccountReadoutHTML,
  buildCashAccountInterestHTML,
  buildCashFreshnessHTML,
  buildCashAccountsEditorHTML,
  buildCashPlanCardHTML,
  buildCashOptionsView,
} from "./src/app/views-cash-options.js";
import {
  buildDividendResultsHTML,
  buildDividendBenchmarksHTML,
  buildTargetResultsHTML,
  buildTargetBenchmarksHTML,
  buildAnnuityResultsHTML,
  buildAnnuityBenchmarksHTML,
  formatAnnuityBadge,
  buildDividendCalculatorSection,
} from "./src/app/views-dividend-yield.js";
import {
  renderTrajectoryChart,
  renderStackedNetWorthSVG,
  getTrajectoryInspectedAge,
  setTrajectoryInspectedAge,
  setOnTrajectoryInspectAge,
} from "./src/app/charts.js";
import {
  getCappedSavings,
  buildFinOverviewGrid,
  computeRebalanceTargets,
  setFinActivityTab,
} from "./src/app/views-overview.js";
import { renderPrintSheet } from "./src/app/print-sheet.js";
import { syncDatePickers } from "./src/app/date-picker.js";
import { buildAllocatorView } from "./src/app/views-allocator.js";
import { buildPriorityGuideView } from "./src/app/views-priority-guide.js";
import {
  setupInlineSettings,
  syncSettingsCashBalance,
} from "./src/app/settings-editor.js";
import { setupServiceWorkerUpdates } from "./src/app/pwa-updates.js";

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
  ["#person-dob"].forEach((sel) => {
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
    familyRstuAnnual: "known-family-rstu",
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
    longevityAge: "known-longevity",
    bridgeIncome: "known-bridge-income",
  };
  const planRoot = $("#retirement-plan");
  const overviewSlot = $("#overview-slot");
  const budgetSlot = $("#budget-slot");
  const cashAccounts = $("#cash-accounts");
  const allocatorSlot = $("#allocator-slot");
  const priorityGuideSlot = $("#priority-guide-slot");
  if (priorityGuideSlot) priorityGuideSlot.innerHTML = buildPriorityGuideView();
  let allocatorIncludesCpf = true;
  let allocatorDrag;
  const cashParkingSlot = $("#cash-parking-slot");
  const dividendCalcSlot = $("#dividend-calc-slot");
  const taxSlot = $("#tax-slot");
  const cpfRulesSlot = $("#cpf-rules-slot");
  const errorBanner = $("#plan-error-banner");

  let selected = "frs";
  let learningTarget = "frs";
  let learningPlan = null;
  let chartMode = "cashflow";
  const dashChartBasis = "today";
  let trajectoryBasis = "today";
  let isSharedSandbox = false;
  let savedBrowserStateRaw = null;
  let currentSimulation = null;
  let currentSummaryToday = null;
  let currentTrajectory = null;
  let currentFirePlan = null;
  let currentAfterCpfCap = 0;
  let currentCashPlan = null;
  let renderDividendTabOnly = null;
  const prevAnimNums = new Map();
  const curAnimNums = new Map();
  const prevMeters = new Map();
  const seedAnimStateIn = (root) => {
    if (!root) return;
    root.querySelectorAll("[data-anim-key]").forEach((el) => {
      const val = Number(el.dataset.animVal || 0);
      prevAnimNums.set(el.dataset.animKey, val);
      curAnimNums.set(el.dataset.animKey, val);
    });
    root.querySelectorAll("[data-meter-key]").forEach((el) => {
      const val =
        el.dataset.meterW != null ? el.dataset.meterW : el.dataset.meterLeft;
      prevMeters.set(el.dataset.meterKey, val);
    });
  };
  const dirtyTabRenderers = new Map();
  const getCurrentViewTab = () => document.body.dataset.view || "overview";
  const flushDirtyTab = (tabName) => {
    const fn = dirtyTabRenderers.get(tabName);
    if (!fn) return;
    dirtyTabRenderers.delete(tabName);
    fn();
    seedAnimStateIn($(`#tab-panel-${tabName}`));
  };
  const renderOrDeferTab = (tabName, fn) => {
    if (getCurrentViewTab() === tabName) {
      dirtyTabRenderers.delete(tabName);
      fn();
    } else {
      dirtyTabRenderers.set(tabName, fn);
    }
  };
  window.addEventListener("rs:tabchange", (event) => {
    const tab = event.detail?.tab;
    if (tab) flushDirtyTab(tab);
  });
  let liveMasRates = null;
  const cashComparison = {
    filter: "all",
    search: "",
    tag: "all",
    view: "table",
    sort: "",
    direction: 1,
    expanded: new Set(),
  };
  const refreshCashProducts = (focusProduct) => {
    const wrap = $(".cash-cards-wrap", cashParkingSlot);
    if (!wrap || !currentCashPlan) return;
    const active = document.activeElement;
    const sort = active?.dataset.cashSort;
    const product = focusProduct || active?.dataset.cashProduct;
    wrap.innerHTML = buildCashCardsMarkup(currentCashPlan, cashComparison);
    const selector = sort
      ? `[data-cash-sort="${sort}"]`
      : product
        ? `[data-cash-product="${CSS.escape(product)}"]`
        : null;
    if (selector)
      $$(selector, wrap)
        .find((button) => button.getClientRects().length)
        ?.focus({ preventScroll: true });
  };
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
  let divAnnuityMonthlyDividends = 0;
  let divAnnuityStepUpPct = 5;
  let divAnnuityTerminalDividend = 0;
  let divAnnuityPaymentMode = "monthly";
  let divAnnuityBonusRealization = 1;
  let divAnnuityInflationPct = 2.5;
  let divAnnuityBenchRatePct = 5.0;
  let toastTimer = null;
  let undoToastAction = null;
  const showToast = (msg, ms = 2600, undo = null) => {
    const toastEl = $("#ui-toast");
    const textEl = $("#ui-toast-text");
    if (!toastEl || !textEl) return;
    if (!undo && undoToastAction && !toastEl.hidden) return;
    textEl.textContent = msg;
    undoToastAction = undo;
    $("[data-toast-undo]").hidden = !undo;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.hidden = true;
      undoToastAction = null;
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
  let cashAccUid = 0;
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
  let numAnimFrame = 0;
  let rafHandle = null;

  let savingEnabled = true;
  let readinessAge = null;
  try {
    savingEnabled = sessionStorage.getItem("rs_private_mode") !== "true";
    const storedVersion = localStorage.getItem("rs_plan_version");
    if (storedVersion && !SUPPORTED_PLAN_VERSIONS.has(storedVersion)) {
      localStorage.removeItem("rs_plan_state");
    }
    if (storedVersion !== PLAN_STORAGE_VERSION) {
      localStorage.setItem("rs_plan_version", PLAN_STORAGE_VERSION);
    }
  } catch (err) {
    console.warn("Unable to initialize plan storage:", err);
  }

  const applyStateParams = (params, { resetFirst = false } = {}) => {
    if (!params) return false;
    if (
      !["2", "3"].includes(params.get("version")) ||
      !["cca", "home-helper"].includes(params.get("lifestyle"))
    ) {
      return false;
    }
    if (resetFirst) {
      clearCustomBudgetState();
      clearCustomCashAccountsState();
      Object.values(fields).forEach((id) => {
        const el = $("#" + id);
        if (el) resetControl(el, false);
      });
      if ($("#person-dob")) $("#person-dob").value = DEFAULT_DOB;
      selected = "frs";
      learningTarget = "frs";
      [
        "#sim-cash-saving",
        "#sim-invest",
        "#sim-bridge-income",
        "#qe-cpf-extra",
        "#qe-cash-saving",
        "#qe-invest",
      ].forEach((sel) => {
        const el = $(sel);
        if (el) el.value = "";
      });
    }
    for (const [key, id] of Object.entries(fields)) {
      if (params.has(key)) {
        const el = $("#" + id);
        if (el) {
          if (key === "longevityAge" && params.get(key) === "95") {
            el.value = "";
          } else if (
            key === "housingYears" &&
            params.get(key) === "0" &&
            Number(params.get("housingBalance") || 0) === 0
          ) {
            el.value = "";
          } else if (key === "housingParties") {
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
              "familyRstuAnnual",
              "bridgeIncome",
            ].includes(key) &&
            Number(params.get(key)) === 0
          ) {
            el.value = "";
          } else if (key === "cashReturnRate") {
            const rawCr = params.get(key);
            const numCr = Number(rawCr);
            const stateVer = Number(params.get("version") || 0);
            // Migrate legacy v2 decimal storage (e.g. 0.025 -> 2.5%) while preserving v3 percentage points (e.g. 0.05%).
            if (
              rawCr != null &&
              rawCr !== "" &&
              Number.isFinite(numCr) &&
              stateVer < 3 &&
              numCr > 0 &&
              numCr < 0.3
            ) {
              el.value = String(Math.round(numCr * 10000) / 100);
            } else {
              el.value = rawCr;
            }
          } else if (el.tagName === "SELECT") {
            const rawSel = params.get(key);
            if ([...el.options].some((o) => o.value === rawSel)) {
              el.value = rawSel;
            }
          } else {
            el.value = params.get(key);
          }
        }
      } else {
        const el = $("#" + id);
        if (
          el &&
          (resetFirst
            ? [
                "cpfExtra",
                "cashSaving",
                "cashReturnRate",
                "invest",
                "spend",
                "housing",
                "equities",
                "sgDividends",
                "ssbCash",
                "existingReliefs",
                "familyRstuAnnual",
                "bridgeIncome",
                "longevityAge",
              ].includes(key)
            : [
                "equities",
                "sgDividends",
                "ssbCash",
                "existingReliefs",
              ].includes(key))
        ) {
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
    const paramSelected = params.get("selected");
    if (["brs", "frs", "ers"].includes(paramSelected)) {
      selected = paramSelected;
    } else if (paramSelected === "salary") {
      selected = "frs";
    }
    if ($("#sim-cash-saving") && $("#known-cash-saving")) {
      $("#sim-cash-saving").value = $("#known-cash-saving").value;
    }
    if ($("#sim-invest") && $("#known-invest")) {
      $("#sim-invest").value = $("#known-invest").value;
    }
    if ($("#sim-bridge-income") && $("#known-bridge-income")) {
      $("#sim-bridge-income").value = $("#known-bridge-income").value;
    }
    if (params.get("expMode") === "itemized" && params.get("expItems")) {
      try {
        const parsed = JSON.parse(params.get("expItems"));
        if (Array.isArray(parsed) && parsed.length > 0) {
          customExpenseItems = parsed
            .filter((row) => Array.isArray(row) && row.length >= 3)
            .slice(0, 50)
            .map((row, idx) => ({
              id: "exp-" + (idx + 1),
              name: String(row[0] || "Expense " + (idx + 1)).slice(0, 60),
              category: String(row[1] || "food"),
              amount: Math.min(1000000, Math.max(0, Number(row[2]) || 0)),
            }));
          if (customExpenseItems.length > 0) {
            customBudgetActive = true;
            useItemizedExpenses = true;
            const tot = sumCustomExpenseItems();
            if ($("#known-spend")) $("#known-spend").value = String(tot);
          }
        }
      } catch (err) {
        console.warn("Failed to parse itemized expenses from state:", err);
      }
    } else {
      const restoredLife = params.get("lifestyle") || "cca";
      const presetBudget =
        RetirementModel.lifestyles[restoredLife]?.budget ||
        RetirementModel.lifestyles.cca.budget;
      const rawSpend = (params.get("spend") || "").trim();
      if (
        params.get("expMode") === "figure" ||
        (rawSpend !== "" &&
          Number.isFinite(Number(rawSpend)) &&
          Math.round(Number(rawSpend) * 100) !== Math.round(presetBudget * 100))
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
            .slice(0, 50)
            .map((row, idx) => {
              const presetKey = String(row[0] || "custom");
              const preset =
                RetirementModel.resolveCashAccountPreset(presetKey);
              return {
                id: "cash-acc-" + (idx + 1),
                preset: preset.key,
                name: String(row[1] || preset.name).slice(0, 50),
                balance: Math.min(1e9, Math.max(0, Number(row[2]) || 0)),
                bonusCap:
                  row[3] != null && Number.isFinite(Number(row[3]))
                    ? Math.min(1e9, Math.max(0, Number(row[3])))
                    : preset.bonusCap,
                bonusRatePct:
                  row[4] != null && Number.isFinite(Number(row[4]))
                    ? Math.min(20, Math.max(0, Number(row[4])))
                    : preset.bonusRatePct,
                baseRatePct:
                  row[5] != null && Number.isFinite(Number(row[5]))
                    ? Math.min(20, Math.max(0, Number(row[5])))
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
      } catch (err) {
        console.warn("Failed to parse itemized cash accounts from state:", err);
      }
    }
    return true;
  };

  let lastSerializedSearch = null;
  const SHARE_DEFAULT_ENTRIES = buildShareDefaultEntries(
    RetirementModel.SG_DEFAULT_PLAN,
    DEFAULT_DOB,
  );
  const encodeShareToken = (search) =>
    encodeShareTokenWithDefaults(search, SHARE_DEFAULT_ENTRIES);
  const decodeShareHashToParams = (hash) =>
    decodeShareHashWithDefaults(hash, SHARE_DEFAULT_ENTRIES);
  let sharedBaseline = null;
  const setSaveStatus = (text) => {
    $$("[data-plan-save-status]").forEach((status) => {
      if (status.textContent !== text) status.textContent = text;
    });
  };
  const restoreSavedState = () => {
    try {
      let params = null;
      let loadedFromHash = false;
      const existingSaved = localStorage.getItem("rs_plan_state");
      if (isPlanShareHash(location.hash)) {
        params = decodeShareHashToParams(location.hash);
        loadedFromHash = Boolean(params);
        history.replaceState(
          history.state,
          "",
          location.pathname + location.search,
        );
        if (loadedFromHash && existingSaved) {
          isSharedSandbox = true;
          savedBrowserStateRaw = existingSaved;
          sharedBaseline = null;
        } else if (!loadedFromHash) {
          if (existingSaved) {
            try {
              params = new URLSearchParams(JSON.parse(existingSaved));
            } catch (_) {
              params = null;
            }
          }
          showToast(
            existingSaved
              ? "Invalid share link — loaded your saved plan."
              : "Invalid share link — loaded defaults.",
          );
        }
      } else if (existingSaved) {
        params = new URLSearchParams(JSON.parse(existingSaved));
      }
      if (!params) return;
      if (
        !loadedFromHash &&
        !isSharedSandbox &&
        localStorage.getItem("rs_taps_85_15") !== "1"
      ) {
        localStorage.setItem("rs_taps_85_15", "1");
        if (params.get("sgSleevePct") === "10") {
          params.set("sgSleevePct", "15");
        }
      }
      if (
        !applyStateParams(params, {
          resetFirst: isSharedSandbox || loadedFromHash,
        })
      ) {
        if (!isSharedSandbox) localStorage.removeItem("rs_plan_state");
        isSharedSandbox = false;

        if (isPlanShareHash(location.hash))
          history.replaceState(null, "", location.pathname + location.search);
      }
    } catch (err) {
      console.warn("Failed to restore saved plan state:", err);
    }
  };
  restoreSavedState();
  window.addEventListener("hashchange", () => {
    if (isPlanShareHash(location.hash)) {
      restoreSavedState();
      render();
    }
  });

  let initialAnchorBoot = Boolean(
    location.hash &&
    location.hash.length > 1 &&
    !isPlanShareHash(location.hash),
  );
  const buildSerializedParams = (p) => {
    const data = {
      ...p,
      selected,
      learningTarget,
      version: 3,
    };
    // Keep cashReturnRate serialized in percentage points matching DOM inputs (e.g. 2.5 for 2.5%).
    if (data.cashReturnRate != null && data.cashReturnRate !== "") {
      const rawCashInput = ($("#known-cash-return")?.value || "").trim();
      data.cashReturnRate =
        rawCashInput !== ""
          ? rawCashInput
          : String(Math.round(Number(data.cashReturnRate) * 10000) / 100);
    }
    if (data.housingMode === "hdb" || data.housingMode === "bank") {
      data.housingYears = $("#known-housing-years").value;
    }
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
    return search;
  };
  let persistTimer = null;
  let pendingPersistSearch = null;
  const flushPersistState = () => {
    if (persistTimer != null) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    if (!pendingPersistSearch || !savingEnabled || isSharedSandbox) return;
    const search = pendingPersistSearch;
    pendingPersistSearch = null;
    try {
      localStorage.setItem(
        "rs_plan_state",
        JSON.stringify(Object.fromEntries(search.entries())),
      );
      if (initialAnchorBoot) {
        initialAnchorBoot = false;
      } else if (isPlanShareHash(location.hash)) {
        history.replaceState(
          history.state,
          "",
          location.pathname + location.search,
        );
      }
      setSaveStatus("Saved");
    } catch (err) {
      setSaveStatus("Could not save");
      console.warn("Failed to flush plan state to localStorage:", err);
    }
  };
  const saveBeforeLeaving = () => {
    flushPendingRender();
    flushPersistState();
  };
  window.addEventListener("pagehide", saveBeforeLeaving);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") saveBeforeLeaving();
  });
  const persistState = (p) => {
    try {
      const search = buildSerializedParams(p);
      lastSerializedSearch = search;
      if (!savingEnabled) {
        setSaveStatus("Session only");
        return;
      }
      if (isSharedSandbox) {
        const signature = new URLSearchParams(search);
        signature.sort();
        const serialized = signature.toString();
        if (sharedBaseline === null) sharedBaseline = serialized;
        if (sharedBaseline === serialized) {
          setSaveStatus("Shared plan preview");
          return;
        }
        const previous = savedBrowserStateRaw;
        isSharedSandbox = false;
        savedBrowserStateRaw = null;
        showToast("Shared plan saved in this browser", 12000, () => {
          applyStateParams(new URLSearchParams(JSON.parse(previous)), {
            resetFirst: true,
          });
          render();
          flushPersistState();
        });
      }
      setSaveStatus("Saving…");
      pendingPersistSearch = search;
      if (persistTimer != null) clearTimeout(persistTimer);
      persistTimer = setTimeout(flushPersistState, 120);
    } catch (err) {
      console.warn("Failed to serialize plan state:", err);
    }
  };

  const lastValidFieldValues = {};
  let lastCustomSpend = "";
  let lastCustomLifestyle = "";
  let latestPrintPayload = null;
  const flushPrintSheet = () => {
    if (latestPrintPayload) renderPrintSheet(latestPrintPayload);
  };
  const captureModalSnapshot = () =>
    captureModalSnapshotHelper({
      fields,
      getState: () => ({
        selected,
        learningTarget,
        lastBankLoanRate,
        lastCustomSpend,
        lastCustomLifestyle,
        customBudgetActive,
        useItemizedExpenses,
        customExpenseItems,
        useItemizedCashAccounts,
        customCashAccounts,
      }),
    });
  const restoreModalSnapshot = (snap) =>
    restoreModalSnapshotHelper(snap, {
      cancelPendingRender: () => {
        if (rafHandle != null) {
          cancelAnimationFrame(rafHandle);
          rafHandle = null;
        }
      },
      applyState: (next) => {
        selected = next.selected;
        learningTarget = next.learningTarget;
        lastBankLoanRate = next.lastBankLoanRate;
        lastCustomSpend = next.lastCustomSpend;
        lastCustomLifestyle = next.lastCustomLifestyle;
        customBudgetActive = next.customBudgetActive;
        useItemizedExpenses = next.useItemizedExpenses;
        customExpenseItems = next.customExpenseItems;
        useItemizedCashAccounts = next.useItemizedCashAccounts;
        customCashAccounts = next.customCashAccounts;
      },
      syncHousingDisplay,
      render,
    });
  const qePanelForSrc = {
    "known-retire": { panel: "goal", qeId: "qe-retire" },
    "known-lifestyle": { panel: "budget", qeId: null },
    "known-spend": { panel: "budget", qeId: null },
    "known-cpf-extra": { panel: "cpf-extra", qeId: "qe-cpf-extra" },
    "known-cash-saving": { panel: "cash-saving", qeId: "qe-cash-saving" },
    "sim-cash-saving": { panel: "cash-saving", qeId: "qe-cash-saving" },
    "known-invest": { panel: "invest", qeId: "qe-invest" },
    "sim-invest": { panel: "invest", qeId: "qe-invest" },
  };
  const getCustomSpendState = (rLifestyle = null) => {
    const lifestyleKey = rLifestyle || $("#known-lifestyle")?.value || "cca";
    const presetBudget =
      RetirementModel.lifestyles[lifestyleKey]?.budget ||
      RetirementModel.lifestyles.cca.budget;
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
    const disclosure = invalidEl?.closest(
      ".settings-disclosure, #trajectory-saving-controls",
    );
    if (disclosure) disclosure.open = true;
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
        if (qeMap.qeId) fixBtn.dataset.qeFocus = `#${qeMap.qeId}`;
        fixBtn.textContent = "Fix value";
        actions.append(fixBtn);
      } else {
        const settingsBtn = document.createElement("button");
        settingsBtn.type = "button";
        settingsBtn.className = "button button-small fin-pill-btn";
        if (invalidEl && $("#top").contains(invalidEl)) {
          settingsBtn.dataset.openSettingsField = invalidEl.id;
        } else if (invalidEl && $("#plan-settings").contains(invalidEl)) {
          settingsBtn.setAttribute("commandfor", "plan-settings");
          settingsBtn.setAttribute("command", "show-modal");
        } else {
          settingsBtn.setAttribute("data-open-profile", "");
        }
        settingsBtn.textContent = "Edit plan inputs";
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
      errorBanner.append(copyWrap, actions);
      errorBanner.hidden = false;
    }
    $("#print-plan-btn").disabled = true;
    $$("[data-print-trigger]").forEach((btn) => {
      btn.disabled = true;
    });
    const printEl = $("#print-sheet");
    if (printEl && !hasRenderedView) {
      printEl.innerHTML = html`<div class="poster-sheet">
        <div class="poster-panel">
          <h3>Input check needed before printing</h3>
          <p>${message}</p>
        </div>
      </div>`;
    }
    $("#start-plan-error").textContent = message;
    const startErrActions = $("#settings-error-actions");
    if (startErrActions) {
      startErrActions.replaceChildren();
      if (message && errorBanner) {
        errorBanner
          .querySelectorAll(
            "[data-quick-edit], [data-clamp-field], [data-open-settings-field]",
          )
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
    setSaveStatus(savingEnabled ? "Changes pending" : "Session only");
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
    if (event.target.closest("label.ledger-path-select-btn")) return;
    const pathBtn = event.target.closest("[data-path]");
    if (pathBtn) {
      const nextPath = pathBtn.dataset.path;
      if (nextPath === selected) return;
      selected = nextPath;
      $("#known-cpf-extra").value = "";
      if ($("#qe-cpf-extra")) $("#qe-cpf-extra").value = "";
      if ($("#known-invest")) $("#known-invest").value = "";
      if ($("#sim-invest")) $("#sim-invest").value = "";
      if ($("#qe-invest")) $("#qe-invest").value = "";
      render();
      (
        $(`input.ledger-path-selector[data-path="${selected}"]`) ||
        $(`[data-path="${selected}"]`)
      )?.focus({ preventScroll: true });
      const label =
        selected === "brs"
          ? "BRS Property Pledge (50% FRS)"
          : selected === "ers"
            ? "ERS Maximum (2026 ref $440.8k)"
            : "FRS Target (2026 ref $220.4k)";
      showToast(`Active strategy path: ${label}`);
    }
  });
  overviewSlot.addEventListener(
    "toggle",
    (event) => {
      const details = event.target;
      details
        .querySelector(":scope > .overview-disclosure-summary")
        ?.setAttribute("aria-expanded", String(details.open));
    },
    true,
  );
  $("#trajectory-values")?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const row = event.target.closest("tr[data-inspect-age]");
    if (row) {
      event.preventDefault();
      row.click();
    }
  });

  let lastBankLoanRate = "2.5";
  const syncHousingDisplay = () => {
    const mode = $("#known-housing-mode")?.value || "all-oa";
    const isLoan = mode === "hdb" || mode === "bank";
    const isCustom = mode === "custom";
    const rateEl = $("#known-housing-rate");
    if (rateEl) {
      rateEl.disabled = mode === "hdb";
      if (mode === "hdb") rateEl.value = "2.6";
      if (mode === "bank" && rateEl.value.trim() === "")
        rateEl.value = lastBankLoanRate;
    }
    $("#known-housing-loan-fields").hidden = !isLoan;
    $("#known-housing-custom-field").hidden = !isCustom;

    let previewHtml = "";
    if (mode === "all-oa") {
      previewHtml =
        "Assumes all incoming salary OA goes to housing (conservative baseline if loan details are unknown).";
    } else if (mode === "paid-up") {
      previewHtml =
        "<strong>$0/mo</strong> deducted from OA — all new OA builds CPF retirement savings at 2.5%.";
    } else if (mode === "custom") {
      const mVal = Math.max(0, Number($("#known-housing")?.value || 0));
      previewHtml = `Deducting <strong>${m(mVal, "/mo")}</strong> from OA across projection.`;
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
            ? `Est. total mortgage ${m(hp.totalMonthly, "/mo")} ÷ ${parties} parties = <strong>${m(hp.monthlyShare, "/mo")}</strong> from OA for ${yrs} yrs (then $0).`
            : `Est. monthly mortgage: <strong>${m(hp.monthlyShare, "/mo")}</strong> from OA for ${yrs} yrs (then $0).`;
      } else {
        previewHtml =
          "Enter remaining loan balance &amp; years left above (currently <strong>$0/mo</strong> from OA).";
      }
    }
    if ($("#known-housing-preview"))
      $("#known-housing-preview").innerHTML = previewHtml;
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
      seedAnimStateIn(document);
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
      void document.body.offsetWidth;
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
          const isSigned = el.dataset.animSigned === "1";
          const prefixNode = isSigned ? el.querySelector(".curr-prefix") : null;
          numDiffs.push({
            key,
            el,
            numNode,
            prefixNode,
            isSigned,
            fromVal,
            toVal,
          });
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
          const displayVal = prog >= 1 ? item.toVal : cur;
          curAnimNums.set(item.key, displayVal);
          if (item.isSigned) {
            const rounded = Math.round(displayVal);
            if (item.prefixNode) {
              item.prefixNode.textContent = rounded < 0 ? "−$" : "$";
            }
            item.numNode.textContent =
              Math.abs(rounded).toLocaleString("en-SG");
          } else {
            item.numNode.textContent = fmtInt(displayVal);
          }
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

  const getTrajectoryForBasis = () =>
    trajectoryBasis === "nominal" && currentSimulation
      ? { ...currentSimulation, summary: currentSimulation.summary }
      : currentTrajectory;

  const renderTrajectoryYearInspector = () => {
    const inspectorEl = $("#trajectory-year-inspector");
    if (!inspectorEl) return;
    const inspectedAge = getTrajectoryInspectedAge();
    if (inspectedAge == null || !currentFirePlan?.points?.length) {
      inspectorEl.hidden = true;
      inspectorEl.innerHTML = "";
      return;
    }
    const pts = currentFirePlan.points;
    const pt = pts.find((item) => item.age === inspectedAge) || pts[0];
    setTrajectoryInspectedAge(pt.age);
    const idx = pts.indexOf(pt);
    const hasPrev = idx > 0;
    const hasNext = idx < pts.length - 1;
    const src = trajectoryBasis === "nominal" ? pt : pt.today;
    const basisTag =
      trajectoryBasis === "nominal" ? "Future Nominal $" : "Today’s $";
    const isAccum = pt.phase === "accumulating";
    const phaseLabel = isAccum
      ? "Accumulating"
      : pt.age < 65
        ? "Pre-65 Bridge"
        : "CPF LIFE + Drawdown";
    const phaseTone = isAccum ? "info" : pt.age < 65 ? "warn" : "good";
    const inflowParts = [];
    if (isAccum) {
      inflowParts.push(`Outside save ${m(src.monthlyOutsideSave || 0, "/mo")}`);
      if ((src.monthlyExtraCpf || 0) > 0.5) {
        inflowParts.push(`Extra CPF ${m(src.monthlyExtraCpf, "/mo")}`);
      }
    } else {
      if (src.monthlyCpfLife > 0.5) {
        inflowParts.push(`CPF LIFE ${m(src.monthlyCpfLife, "/mo")}`);
      }
      if ((src.monthlyBridge || 0) > 0.5) {
        inflowParts.push(`Bridge work ${m(src.monthlyBridge, "/mo")}`);
      }
      if ((src.monthlySrsDraw || 0) > 0.5) {
        inflowParts.push(`SRS draw ${m(src.monthlySrsDraw, "/mo")}`);
      }
      if ((src.monthlyLiquidDraw || 0) > 0.5) {
        inflowParts.push(`Portfolio draw ${m(src.monthlyLiquidDraw, "/mo")}`);
      }
      if ((src.monthlyShortfall || 0) > 0.5) {
        inflowParts.push(
          `<strong class="text-danger">Gap ${m(src.monthlyShortfall, "/mo")}</strong>`,
        );
      }
    }
    inspectorEl.hidden = false;
    inspectorEl.innerHTML = html`
      <div class="traj-inspector-card">
        <div class="traj-inspector-head">
          <div class="traj-inspector-title-group">
            <strong>Age ${pt.age} (${pt.year}) Audit Breakdown</strong>
            <span class="status-pill is-${phaseTone}">${phaseLabel}</span>
            <span class="swell-slate-pill">${basisTag}</span>
          </div>
          <div class="traj-inspector-actions">
            <button
              type="button"
              class="button button-small fin-pill-btn"
              data-inspect-step="-1"
              ${raw(hasPrev ? "" : "disabled")}
              aria-label="Inspect previous age"
            >
              ← Age ${hasPrev ? pts[idx - 1].age : pt.age}
            </button>
            <button
              type="button"
              class="button button-small fin-pill-btn"
              data-inspect-step="1"
              ${raw(hasNext ? "" : "disabled")}
              aria-label="Inspect next age"
            >
              Age ${hasNext ? pts[idx + 1].age : pt.age} →
            </button>
            <button
              type="button"
              class="button button-small fin-pill-btn"
              data-inspect-close
              aria-label="Close year inspector"
            >
              ✕ Close
            </button>
          </div>
        </div>
        <dl class="tax-metrics-grid traj-inspector-grid">
          <div class="tax-metric-box">
            <dt>Total Net Worth</dt>
            <dd>
              ${raw(m(src.totalNetWorth))}<small
                >CPF ${raw(m(src.cpfTotal))} · Outside
                ${raw(m(src.totalOutside))}</small
              >
            </dd>
          </div>
          <div class="tax-metric-box">
            <dt>CPF Accounts</dt>
            <dd>
              ${raw(m(src.cpfTotal))}<small
                >OA ${raw(m(src.cpfOA))} ·
                ${raw(
                  pt.age < 55 ? `SA ${m(src.cpfSARA)}` : `RA ${m(src.cpfSARA)}`,
                )}
                · MA ${raw(m(src.cpfMA))}</small
              >
            </dd>
          </div>
          <div class="tax-metric-box">
            <dt>Outside Portfolio</dt>
            <dd>
              ${raw(m(src.totalOutside))}<small
                >Equities ${raw(m(src.liquidEquities))} · Cash/SSB
                ${raw(m(src.ssbCash))}${raw(
                  src.srs > 0.5 ? ` · SRS ${m(src.srs)}` : "",
                )}</small
              >
            </dd>
          </div>
          <div class="tax-metric-box">
            <dt>
              ${isAccum ? "Monthly Saving Flow" : "Monthly Retirement Cashflow"}
            </dt>
            <dd>
              ${raw(
                isAccum
                  ? m(
                      (src.monthlyOutsideSave || 0) +
                        (src.monthlyExtraCpf || 0),
                      "/mo",
                    )
                  : m(src.monthlySpend, "/mo"),
              )}<small>${raw(inflowParts.join(" · ") || "Covered")}</small>
            </dd>
          </div>
        </dl>
      </div>
    `;
  };

  setOnTrajectoryInspectAge((age) => {
    setTrajectoryInspectedAge(age);
    renderOrDeferTab("trajectory", () => {
      renderTrajectoryChart(
        getTrajectoryForBasis(),
        chartMode,
        currentFirePlan,
        trajectoryBasis,
      );
    });
    renderTrajectoryYearInspector();
  });

  /** Replace targeted subtrees from freshly rendered HTML without disturbing focused inputs. */
  const patchSubtrees = (host, htmlStr, selectors) => {
    const tmp = document.createElement("div");
    tmp.innerHTML = htmlStr;
    for (const sel of selectors) {
      const oldNode = host.querySelector(sel);
      const newNode = tmp.querySelector(sel);
      if (oldNode && newNode) oldNode.replaceWith(newNode);
    }
    return tmp;
  };

  /** Live-patch per-account overflow state and yield readouts inside a cash accounts container. */
  const patchCashAccountRows = (host, bd) => {
    bd.accounts.forEach((acc, idx) => {
      const readout = host.querySelector(`[data-cash-acc-readout="${idx}"]`);
      if (readout) readout.innerHTML = buildCashAccountReadoutHTML(acc);
      const interest = host.querySelector(`[data-cash-acc-interest="${idx}"]`);
      if (interest) interest.innerHTML = buildCashAccountInterestHTML(acc);
    });
  };

  const setOverviewSavingsEditing = (input, editing) => {
    const button = document.getElementById(
      `overview-edit-${input.dataset.overviewSaving}`,
    );
    input.parentElement.hidden = !editing;
    button.hidden = editing;
    button.setAttribute("aria-expanded", String(editing));
    return button;
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
    syncSettingsCashBalance({
      useItemizedCashAccounts: Boolean(
        useItemizedCashAccounts && customCashAccounts.length > 0,
      ),
      cashAccountsCount: customCashAccounts.length,
      cashEffectiveRatePct: activeCashBdPreview?.effectiveRatePct ?? null,
    });
    const syncDobAgeUi = (dobValue) => {
      const info = RetirementModel.computeAgeFromDob(dobValue || "");
      const badge = $("#person-dob-age-badge");
      badge.hidden = !info.valid;
      if (info.valid) {
        badge.textContent = `Age ${info.age}`;
        badge.classList.toggle("is-warn", info.age < 18 || info.age > 54);
      }
      return info;
    };

    const dobAgeInfo = syncDobAgeUi($("#person-dob")?.value || "");
    syncDatePickers();
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
      !(qeDialog?.open && getActiveQeTab() === "goal")
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
      // HTML5 bars <input type="hidden"> from constraint validation, so enforce explicit
      // numeric bounds for canonical hidden fields (cashSaving, cashReturnRate, invest,
      // savings, targetEquityPct, sgSleevePct).
      if (input.type === "hidden") {
        const hiddenBounds = {
          cashSaving: [0, 1e9],
          cashReturnRate: [0, 15],
          invest: [0, 1e9],
          savings: [0, 1e9],
          targetEquityPct: [0, 100],
          sgSleevePct: [0, 100],
        };
        const bounds = hiddenBounds[key];
        if (bounds) {
          const numVal = Number(val);
          if (
            !Number.isFinite(numVal) ||
            numVal < bounds[0] ||
            numVal > bounds[1]
          ) {
            setError(
              key === "cashReturnRate"
                ? "Enter a cash return rate between 0% and 15%."
                : `Enter a valid amount between ${bounds[0].toLocaleString("en-SG")} and ${bounds[1].toLocaleString("en-SG")}.`,
              input,
            );
            return;
          }
        }
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
              ? Number(val) / 100
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
      const solved = RetirementModel.solveBucketAwareSimulation(
        pWithMas,
        selected,
      );
      const summary = solved.summary;
      simulation = solved.simulation;
      r = RetirementModel.todayPlan(summary);
      fire = solved.fire;
      bogle = RetirementModel.bogleheadAllocation(pWithMas, simulation.invest);
      tax = RetirementModel.taxSweetSpot(pWithMas, { simulation });
    } catch (e) {
      setError(e.message);
      return;
    }
    currentFirePlan = fire;
    currentSimulation = simulation;
    currentSummaryToday = r;

    const simExtraForCpf = r.retiringNow ? 0 : simulation.cpfExtra;
    const keepOA =
      simulation.cpfResult ||
      RetirementModel.projectCPF(p, simExtraForCpf, selected);

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
    const suggested = {
      "known-cpf-extra": s.cpfFunding,
      "known-cash-saving": 0,
      "known-invest": s.privateSaving,
      "known-bridge-income": 0,
    };
    const simMoneyHtml = (value, age, suffix = "", animKey = "") =>
      m(
        RetirementModel.todayValue(value, age, r.age, r.inflation),
        suffix,
        animKey,
      );
    const cpfPlannerLink =
      '<a href="https://www.cpf.gov.sg/member/retirement-income/about-cpf-planner-retirement-income" target="_blank" rel="noopener">';
    const overviewRangeNote = simulation.payoutCapped
      ? `<p class="overview-payout-note"><strong>Payout reference boundary reached at ERS.</strong> ${m(s.payout, "/mo")} in today’s dollars · ${m(simulation.cpfResult.reserve65)} separate reserve at 65 (future dollars) ${cpfPlannerLink}Official CPF planner ↗</a></p>`
      : "";
    const rangeNote = simulation.payoutCapped
      ? `<div class="payout-range-note"><p><strong>Payout reference boundary reached (${m(s.payout, "/mo")} today’s value).</strong> Published CPF LIFE anchors stop at ERS; extra CPF reserve (${m(simulation.cpfResult.reserve65)} future cash at 65) stays separate. ${cpfPlannerLink}Check CPF’s official planner ↗</a></p></div>`
      : "";
    const simGuide = RetirementModel.outsideAllocationGuide(
      simulation.summary,
      simulation,
      p,
    );
    const cashSavingVal = simulation.cashSaving || 0;
    const combined = simulation.cpfExtra + cashSavingVal + simulation.invest;
    $("#trajectory-saving-total").innerHTML = r.retiringNow
      ? "Monthly savings paused"
      : `<strong>${m(combined, "/mo")}</strong> total monthly savings`;
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
    if ($("#sim-bridge-income")) {
      $("#sim-bridge-income").value = $("#known-bridge-income")?.value || "";
      $("#sim-bridge-income").placeholder = "0";
      $("#sim-bridge-income").disabled = r.retiringNow || r.retire >= 65;
    }
    $("#known-cpf-extra").disabled = r.retiringNow;
    $("#sim-invest").disabled = r.retiringNow;
    for (const button of $$("[data-adjust]")) {
      if (button.dataset.adjust === "sim-bridge-income") {
        button.disabled = r.retiringNow || r.retire >= 65;
      } else {
        button.disabled = r.retiringNow;
      }
    }

    const barTone =
      takeHomePct > 85 ? "is-danger" : takeHomePct > 50 ? "is-warn" : "is-good";
    const simStateIcon =
      simGuide.state.tone === "good" ? ICONS.checkTiny : ICONS.alertTriangle;
    $("#simulation-results").innerHTML = `
      <p class="fixed-retirement">Target retirement age: <strong>${r.retire}</strong></p>
      <div class="affordability-card">
        <div class="affordability-head">
          <span>${r.retiringNow ? "Retirement set to now — future monthly saving is paused" : `Saving ${takeHomePct}% of ${m(r.afterCpf)} pay after CPF`}</span>
          <span class="affordability-right">
            <span class="status-pill is-${simGuide.state.tone}">${simStateIcon}<span>${simGuide.state.label}</span></span>
            <span>${r.retiringNow ? `Gap: ${m(s.remainingPortfolioGap)}` : left < 0 ? `Exceeds take-home by ${m(-left)}` : `${m(left, "/mo")} left before ~${m(simGuide.regularActiveTax?.monthlyTax ?? simGuide.tax.monthlyTax)} tax`}</span>
          </span>
        </div>
        ${r.retiringNow ? "" : `<div class="affordability-track" role="progressbar" aria-valuenow="${Math.min(100, takeHomePct)}" aria-valuemin="0" aria-valuemax="100" aria-label="Share of take-home pay saved"><span class="affordability-fill ${barTone}" data-meter-key="sim-afford" data-meter-w="${Math.min(100, takeHomePct)}" style="width:${Math.min(100, takeHomePct)}%"></span></div>`}
      </div>
      ${simulation.cpfResult.ra65 > 0 && simulation.cpfResult.ra65 < 60000 ? '<p class="estimate-note">Projected RA at 65 is below the $60,000 automatic CPF LIFE threshold; assumes voluntary CPF LIFE enrolment at 65.</p>' : ""}
      <dl class="simulation-metrics simulation-metrics-4">
        <div><dt>${simulation.payoutCapped ? "CPF boundary from 65" : "CPF LIFE from 65"}</dt><dd>${m(s.payout, "/mo", "sim-cpf-life")}<small>Today’s dollars · ${selected === "brs" ? "BRS property pledge" : selected.toUpperCase() + " target"}</small></dd></div>
        <div><dt>Outside portfolio at ${r.retire}</dt><dd>${simMoneyHtml(simulation.portfolioAtRetire, r.retire, "", "sim-port-retire")}<small>At retirement age ${r.retire}${r.bridgeIncome > 0 && r.retire < 65 ? ` · +${m(r.bridgeIncome, "/mo")} bridge income` : ""}</small></dd></div>
        <div><dt>Funding status through ${simulation.endAge || 95}</dt><dd>${simulation.fullyFunded ? `${m(0, "", "sim-gap")} gap` : `${m(s.remainingPortfolioGap, "", "sim-gap")} gap`}<small>${simulation.fullyFunded ? `Funded through age ${simulation.endAge || 95}.` : `Depletes around ${simulation.depletionAge == null ? r.retire : ageLabel(simulation.depletionAge)}.`}</small></dd></div>
        <div><dt>Earliest modelled retirement</dt><dd id="readiness-result">Calculating…</dd></div>
      </dl>
      <details class="result-details">
        <summary>See withdrawal rate, reserve &amp; yearly CPF ledger</summary>
        <dl class="simulation-metrics">
          <div><dt>Level portfolio withdrawal (${r.retire}–${simulation.endAge || 95})</dt><dd>${simMoneyHtml(simulation.monthlyPortfolioIncome, r.retire, "/mo")}<small>Estimated sustainable monthly drawdown</small></dd></div>
          <div><dt>${selected.toUpperCase()} milestone age</dt><dd>${simulation.cpfGoalAge == null ? "Not reached by 65" : ageLabel(simulation.cpfGoalAge)}<small>Includes earmarked reserve before 55</small></dd></div>
          <div><dt>CPF reserve outside CPF at 55</dt><dd>${simMoneyHtml(simulation.cpfResult.remainingReserve, 55)}<small>Kept separate from outside portfolio</small></dd></div>
          <div><dt>Current SA cash top-up room</dt><dd>${m(simulation.cpfResult.currentTopupRoom)}<small>${simulation.cpfResult.maShortfallToday > 0 ? `MA cash shortfall: ${m(simulation.cpfResult.maShortfallToday)}` : "2026 FRS less SA & CPFIS-SA"}</small></dd></div>
        </dl>
        <div class="table-scroll"><table class="trajectory-table"><caption>Projected CPF balances by age in nominal future dollars (stops at 65 when CPF LIFE starts)</caption><thead><tr><th scope="col">Age</th><th scope="col">OA</th><th scope="col">SA</th><th scope="col">MA</th><th scope="col">RA</th><th scope="col">Reserve</th><th scope="col">Extra deposits</th><th scope="col">CPF interest</th></tr></thead><tbody>${simulation.cpfResult.ledger.map((row) => `<tr><th scope="row">${row.age}</th>${["oa", "sa", "ma", "ra", "reserve", "totalExtra", "totalInterest"].map((key) => `<td>${m(row[key])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
      </details>
      ${rangeNote}`;

    currentTrajectory = RetirementModel.todayTrajectory(simulation);
    readinessAge = fire.fireNumber.projectedFireAge;
    const showReadiness = () => {
      const node = $("#readiness-result");
      if (!node) return;
      node.innerHTML = `${ageLabel(readinessAge)}<small>${readinessAge == null ? "Increase savings or adjust budget to reach readiness by 80." : readinessAge <= r.retire ? `On track for your age-${r.retire} goal.` : `Reaches readiness by age ${Math.floor(readinessAge)}.`}</small>`;
    };
    showReadiness();
    $("#simulation-status").textContent =
      `Retirement stays at ${r.retire}. Estimated CPF ${money(s.payout)}/mo from 65.`;

    const summaryText = r.retiringNow
      ? `Outside retirement savings: ${money(s.privateSaving)} needed now.`
      : `${s.key === "brs" ? "BRS Pledge" : s.key.toUpperCase()}: CPF LIFE ${money(s.payout)}/mo · save ${money(s.privateSaving)}/mo outside CPF.`;
    $("#settings-live-summary").dataset.budget = summaryText;
    $("#settings-live-summary").textContent = summaryText;

    const renderCpfRulesTab = () => {
      if (!cpfRulesSlot) return;
      learningPlan = RetirementModel.milestonePlan(
        { ...p, cpfExtra: r.retiringNow ? 0 : simulation.cpfExtra },
        learningTarget,
      );
      cpfRulesSlot.innerHTML = buildCpfRulesTabHTML({
        r,
        p,
        selected,
        simExtraForCpf,
        keepOA,
        tax,
        learningPlan,
        learningTarget,
      });
    };

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
    if ($("#sim-bridge-income"))
      lastValidFieldValues["sim-bridge-income"] = $("#sim-bridge-income").value;

    const { isCustom: isCustomSpend, spend: customSpendVal } =
      getCustomSpendState(r.lifestyle);
    if (isCustomSpend) {
      lastCustomSpend = String(Math.round(customSpendVal * 100) / 100);
      lastCustomLifestyle = r.lifestyle;
    }
    const expenseData = RetirementModel.expensePlan({
      lifestyle: r.lifestyle,
      spend: r.todaySpend,
      itemizedActive: useItemizedExpenses,
      customExpenses: customExpenseItems,
      afterCpf: r.afterCpf,
      customActive: isCustomSpend,
    });
    const planSummary = {
      budget: expenseData.total,
      housing: p.housing ?? r.currentOA,
    };
    for (const output of $$("[data-plan-value]")) {
      const key = output.dataset.planValue;
      const field = document.getElementById(key);
      const value = planSummary[key] ?? field?.value;
      switch (output.dataset.valueFormat) {
        case "date":
          output.textContent = formatDobShort(value);
          break;
        case "option":
          output.textContent =
            field?.selectedOptions[0]?.textContent.trim() || "—";
          break;
        case "money":
        case "monthly":
        case "yearly":
          output.textContent =
            money(Number(value || 0)) +
            ({ monthly: "/mo", yearly: "/yr" }[output.dataset.valueFormat] ||
              "");
          break;
        default:
          output.textContent = value || "—";
      }
    }
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
      overviewRangeNote,
      suggested,
    );

    const bogleHTML = buildAllocatorView(bogle, allocatorIncludesCpf);

    const overviewDisclosures = [
      ".exp-breakdown-disclosure",
      "#overview-saving-details",
      "#overview-portfolio-details",
      "#overview-methodology",
      "#retirement-taps-card",
    ].filter((selector) => $(selector)?.open);
    const activeSavingsField = document.activeElement?.matches(
      "[data-overview-saving]",
    )
      ? document.activeElement
      : null;
    const draftSavings =
      activeSavingsField &&
      (activeSavingsField.value !== activeSavingsField.defaultValue ||
        activeSavingsField.validity.badInput)
        ? activeSavingsField.value
        : null;
    const activeSavingsButtonId = document.activeElement?.matches(
      "[data-overview-saving-edit]",
    )
      ? document.activeElement.id
      : null;
    overviewSlot.innerHTML = finGridHTML;
    $("#cpf-strategy-slot").replaceChildren($("#cpf-strategy-comparison"));
    budgetSlot.innerHTML = buildExpenseCardHTML(expenseData);
    if (activeSavingsField) {
      const replacement = document.getElementById(activeSavingsField.id);
      if (replacement) {
        if (draftSavings !== null) replacement.value = draftSavings;
        setOverviewSavingsEditing(replacement, true);
        replacement.focus({ preventScroll: true });
      }
    } else if (activeSavingsButtonId) {
      document
        .getElementById(activeSavingsButtonId)
        ?.focus({ preventScroll: true });
    }
    $$("[data-use-suggested]").forEach((button) => {
      const id = button.dataset.useSuggested;
      const value = document.getElementById(id).value;
      const unavailable =
        id === "known-bridge-income" ? r.retire >= 65 : r.retiringNow;
      button.hidden =
        unavailable ||
        value.trim() === "" ||
        Math.abs(Number(value) - suggested[id]) < 0.005;
    });
    for (const selector of overviewDisclosures) {
      const details = $(selector);
      if (details) details.open = true;
    }
    overviewSlot
      .querySelectorAll(".overview-disclosure-summary")
      .forEach((summary) => {
        summary.setAttribute(
          "aria-expanded",
          String(summary.parentElement.open),
        );
      });

    if (expDialog && expDialog.open && expModalBody) {
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
        patchSubtrees(
          expModalBody,
          buildExpenseModalBodyHTML(expenseData, r, null, s),
          [
            "#exp-impact-slot",
            "#exp-modal-total",
            "#exp-modal-custom-detail",
            ".exp-quick-chips",
          ],
        );
        expenseData.items.forEach((it, idx) => {
          const pctNode = expModalBody.querySelector(`[data-exp-pct="${idx}"]`);
          if (pctNode) pctNode.textContent = formatExpSharePct(it.pct);
        });
      } else {
        const impactWasOpen = $(".exp-budget-impact")?.open;
        const itemsWereOpen = $(".exp-preset-items")?.open;
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
        if (impactWasOpen) $(".exp-budget-impact").open = true;
        if (itemsWereOpen && $(".exp-preset-items"))
          $(".exp-preset-items").open = true;
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
        if (activeCatIdx != null) {
          expModalBody
            .querySelector(
              `select[data-exp-field="category"][data-exp-idx="${activeCatIdx}"]`,
            )
            ?.focus({ preventScroll: true });
        }
      }
      if ($("#exp-modal-live-summary")) {
        $("#exp-modal-live-summary").textContent =
          `Retirement budget ${money(r.todaySpend)} per month`;
      }
    }

    let cashPlanComputedThisRender = false;
    const ensureCashPlan = () => {
      if (!cashPlanComputedThisRender) {
        currentCashPlan = RetirementModel.cashParkingPlan({
          summary: r,
          guide: simGuide,
          params: p,
          bogle,
          masRates: liveMasRates,
        });
        cashPlanComputedThisRender = true;
      }
      return currentCashPlan;
    };

    const qeErrClear = $("#qe-error");
    if (qeErrClear) {
      qeErrClear.textContent = "";
      qeErrClear.hidden = true;
    }
    if (qeDialog?.open) {
      ensureCashPlan();
      syncQuickEditState(r, fire, simulation, bogle, tax);
    }

    if (allocatorSlot.querySelector(".allocator-sheet")) {
      patchSubtrees(allocatorSlot, bogleHTML, [
        ".allocator-status",
        ".allocator-comparison",
        ".allocator-target-track",
        ".allocator-target-readout",
        ".allocator-paycheck-values",
      ]);
    } else {
      allocatorSlot.innerHTML = bogleHTML;
      if (!("popover" in HTMLElement.prototype)) {
        const help = $("#allocator-help");
        const details = document.createElement("details");
        const summary = document.createElement("summary");
        summary.className = "text-button";
        summary.textContent = "About the split";
        help.removeAttribute("popover");
        $(".allocator-info", allocatorSlot).replaceWith(details);
        details.append(summary, help);
      }
    }
    const { targetEquityPct, sgSleevePct } = bogle.holistic;
    const targetSlider = $("#allocator-slider");
    targetSlider.style.setProperty("--equity-position", `${targetEquityPct}%`);
    targetSlider.style.setProperty(
      "--sg-position",
      `${(targetEquityPct * (100 - sgSleevePct)) / 100}%`,
    );
    for (const [field, value, inputId] of [
      ["equity", targetEquityPct, "bogle-target-slider"],
      ["sg", sgSleevePct, "bogle-sg-slider"],
    ]) {
      const disabled = field === "sg" && targetEquityPct === 0;
      const handle = targetSlider.querySelector(
        `[data-allocator-handle="${field}"]`,
      );
      handle.setAttribute("aria-valuenow", String(value));
      handle.setAttribute("aria-valuetext", `${value}%`);
      handle.setAttribute("aria-disabled", String(disabled));
      handle.tabIndex = disabled ? -1 : 0;
      const input = document.getElementById(inputId);
      input.disabled = disabled;
      if (input !== document.activeElement) input.value = String(value);
      $$(`[data-allocator-nudge="${field}"]`, allocatorSlot).forEach(
        (button) => {
          button.disabled = disabled;
        },
      );
    }
    $$("[data-allocator-preset]", allocatorSlot).forEach((button) => {
      const selected =
        Number(button.dataset.allocatorPreset) === targetEquityPct;
      button.setAttribute("aria-pressed", String(selected));
    });
    $$("[data-allocator-basis]", allocatorSlot).forEach((button) => {
      const selected =
        (button.dataset.allocatorBasis === "cpf") === allocatorIncludesCpf;
      button.setAttribute("aria-pressed", String(selected));
    });

    renderOrDeferTab("cash-parking", () => {
      ensureCashPlan();
      if (!cashParkingSlot) return;
      const planSlot = $(".cash-plan-slot", cashParkingSlot);
      if (!planSlot) {
        cashParkingSlot.innerHTML = buildCashOptionsView(
          currentCashPlan,
          cashComparison,
        );
        return;
      }
      planSlot.innerHTML = buildCashPlanCardHTML(currentCashPlan);
      $(".cash-sync-pill", cashParkingSlot).innerHTML =
        buildCashFreshnessHTML(currentCashPlan);
      refreshCashProducts();
    });
    renderOrDeferTab("cash-accounts", () => {
      ensureCashPlan();
      const accounts = cashAccounts;
      const active = document.activeElement;
      const editor = $(".cash-accounts-page-slot", accounts);
      const editorHTML = buildCashAccountsEditorHTML(currentCashPlan);
      const isEditing =
        accounts.contains(active) &&
        active.matches("input[data-cash-acc-field]");
      if (isEditing && currentCashPlan.cashAccountsActive) {
        patchSubtrees(editor, editorHTML, [
          "#cash-acc-summary-page",
          "#cash-acc-alerts-page",
        ]);
        patchCashAccountRows(editor, currentCashPlan.cashBreakdown);
      } else {
        const openRates = new Set(
          $$("[data-cash-customize][open]", editor).map(
            (details) => details.dataset.cashCustomize,
          ),
        );
        const presetIdx =
          active?.dataset.cashAccField === "preset"
            ? active.dataset.cashAccIdx
            : null;
        const mode = editor.contains(active)
          ? active.dataset.cashAccMode
          : null;
        editor.innerHTML = editorHTML;
        if (mode)
          $(`[data-cash-acc-mode="${mode}"]`, editor)?.focus({
            preventScroll: true,
          });
        $$("[data-cash-customize]", editor).forEach((details) => {
          details.open = openRates.has(details.dataset.cashCustomize);
        });
        if (presetIdx != null)
          $(
            `[data-cash-acc-field="preset"][data-cash-acc-idx="${presetIdx}"]`,
            editor,
          )?.focus({ preventScroll: true });
      }
    });

    const marginalTaxPct = `${(tax.taxBefore.marginalRate * 100).toFixed(1).replace(/\.0$/, "")}%`;
    const animateDividendUpdate = () => {
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches)
        return;
      const targets = [
        dividendCalcSlot?.querySelector("#div-calc-results-pane"),
        dividendCalcSlot?.querySelector("#dividend-benchmarks-card"),
      ].filter(Boolean);
      requestAnimationFrame(() => {
        targets.forEach((target) => {
          target.classList.remove("is-div-updating");
          void target.offsetWidth;
          target.classList.add("is-div-updating");
        });
      });
    };
    const renderDividendTabNow = () => {
      if (!dividendCalcSlot) return;
      const ssbRefPct =
        liveMasRates?.ssb?.year10Return ?? liveMasRates?.ssb?.tenYearAvgReturn;
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
        inflationPct: Math.round((r.inflation ?? 0.025) * 1000) / 10,
        masRates: liveMasRates,
      });
      const annuityModel = RetirementModel.evaluateAnnuityPlan({
        monthlyContribution: divAnnuityMoSave,
        contributeYears: divAnnuityPayYears,
        deferYears: divAnnuityDeferYears,
        payoutYears: divAnnuityDrawYears,
        quotedMonthlyPayout: divAnnuityQuotedMo,
        nonGuaranteedMonthlyDividends: divAnnuityMonthlyDividends,
        dividendStepUpRatePct: divAnnuityStepUpPct,
        terminalDividend: divAnnuityTerminalDividend,
        paymentMode: divAnnuityPaymentMode,
        bonusRealization: divAnnuityBonusRealization,
        inflationRatePct: divAnnuityInflationPct,
        benchmarkRatePct: divAnnuityBenchRatePct,
        masRates: liveMasRates,
      });
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
        "div-annuity-monthly-dividends",
        "div-annuity-terminal",
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
            hdrBadge.textContent = `${targetModel.badge} · ${money(targetModel.requiredCapital)} needed`;
          }
          if (activeDivEl.id !== "div-target-rate") {
            const rInp = dividendCalcSlot.querySelector("#div-target-rate");
            if (rInp)
              rInp.value = String(Number(targetModel.ratePct.toFixed(2)));
          }
          if (activeDivEl.id !== "div-target-rate-slider") {
            const rSl = dividendCalcSlot.querySelector(
              "#div-target-rate-slider",
            );
            if (rSl)
              rSl.value = String(
                Math.min(12, Math.max(0.5, targetModel.ratePct)),
              );
          }
        } else if (divCalcMode === "annuity") {
          resPane.innerHTML = buildAnnuityResultsHTML(annuityModel);
          benchCard.innerHTML = buildAnnuityBenchmarksHTML(annuityModel);
          if (hdrBadge) {
            hdrBadge.className = `status-pill is-${annuityModel.tone}`;
            hdrBadge.textContent = formatAnnuityBadge(annuityModel);
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
            if (rateInp)
              rateInp.value = String(Number(divModel.ratePct.toFixed(2)));
          }
          if (activeDivEl.id !== "div-calc-rate-slider") {
            const rateSlider = dividendCalcSlot.querySelector(
              "#div-calc-rate-slider",
            );
            if (rateSlider) {
              rateSlider.value = String(
                Math.min(12, Math.max(0, divModel.ratePct)),
              );
            }
          }
        }
        // Sync preset chip active states on live partial updates.
        dividendCalcSlot.querySelectorAll(".div-preset-chip").forEach((btn) => {
          const isMatch =
            (btn.dataset.divCapPick != null &&
              Math.round(Number(btn.dataset.divCapPick)) ===
                Math.round(divModel.capital)) ||
            (btn.dataset.divRatePick != null &&
              Math.abs(Number(btn.dataset.divRatePick) - divModel.ratePct) <
                0.015) ||
            (btn.dataset.divTargetPick != null &&
              Math.round(Number(btn.dataset.divTargetPick)) ===
                Math.round(targetModel.targetMonthly)) ||
            (btn.dataset.divTargetRatePick != null &&
              Math.abs(
                Number(btn.dataset.divTargetRatePick) - targetModel.ratePct,
              ) < 0.015) ||
            (btn.dataset.divTargetCapPick != null &&
              Math.round(Number(btn.dataset.divTargetCapPick)) ===
                Math.round(targetModel.currentCapital)) ||
            (btn.dataset.divTargetSavePick != null &&
              Math.round(Number(btn.dataset.divTargetSavePick)) ===
                Math.round(targetModel.monthlyContribution));
          btn.classList.toggle("is-active", isMatch);
          btn.setAttribute("aria-pressed", String(isMatch));
        });
      } else {
        dividendCalcSlot.innerHTML = buildDividendCalculatorSection({
          mode: divCalcMode,
          divModel,
          targetModel,
          annuityModel,
        });
      }
      if ($("#nav-badge-dividend")) {
        $("#nav-badge-dividend").textContent =
          divCalcMode === "target"
            ? `${money(divTargetMonthly)}/m`
            : divCalcMode === "annuity"
              ? formatAnnuityIrr(annuityModel.impliedAnnualIrrPct, {
                  digits: 1,
                })
              : `${Number(divCalcRatePct || 0).toFixed(1)}%`;
      }
      animateDividendUpdate();
    };
    renderDividendTabOnly = renderDividendTabNow;
    renderOrDeferTab("dividend-calc", renderDividendTabNow);
    if ($("#nav-badge-dividend") && divCalcMode !== "annuity") {
      $("#nav-badge-dividend").textContent =
        divCalcMode === "target"
          ? `${money(divTargetMonthly)}/m`
          : `${Number(divCalcRatePct || 0).toFixed(1)}%`;
    }
    renderOrDeferTab("tax", () => {
      taxSlot.innerHTML = buildTaxTabHTML({ r, tax, marginalTaxPct });
    });

    renderOrDeferTab("cpf-rules", renderCpfRulesTab);

    if ($("#nav-badge-overview")) {
      $("#nav-badge-overview").textContent = formatFundedPct(
        fire.fireNumber.pctFunded,
      );
    }
    if ($("#nav-badge-trajectory")) {
      $("#nav-badge-trajectory").textContent = `Age ${fire.retire}`;
    }
    if ($("#nav-badge-allocator")) {
      $("#nav-badge-allocator").textContent =
        `${Math.round(bogle.holistic.effectiveEquityPct)}/${Math.round(bogle.holistic.effectiveBondPct)}`;
    }
    if ($("#nav-badge-cash")) {
      const cashBadgePct =
        (fire.cashReturnRate ??
          RetirementModel.DEFAULT_MAS_LIVE_RATES.ssb.year10Return / 100) * 100;
      $("#nav-badge-cash").textContent = `${Number(cashBadgePct).toFixed(2)}%`;
    }
    if ($("#nav-badge-tax")) {
      $("#nav-badge-tax").textContent = marginalTaxPct;
    }
    if ($("#nav-badge-cpf")) {
      $("#nav-badge-cpf").textContent = selected.toUpperCase();
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

    renderOrDeferTab("trajectory", () => {
      renderTrajectoryChart(
        getTrajectoryForBasis(),
        chartMode,
        currentFirePlan,
        trajectoryBasis,
      );
    });
    renderTrajectoryYearInspector();
    latestPrintPayload = {
      r,
      s,
      simulation,
      fire,
      bogle,
      tax,
      guide: simGuide,
      p: {
        ...p,
        masRates: liveMasRates,
        isCustomBudget: isCustomSpend,
        itemizedActive: Boolean(expenseData?.itemizedActive),
      },
      expenseData,
      masRates: liveMasRates,
      basis: dashChartBasis,
    };
  };

  const loadMasRates = async (force = false, triggerBtn = null) => {
    const getLiveBtn = () =>
      triggerBtn?.isConnected
        ? triggerBtn
        : document.querySelector("[data-cash-sync]");
    const initialBtn = getLiveBtn();
    if (initialBtn) {
      initialBtn.disabled = true;
      initialBtn.textContent = "Syncing…";
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
      const postBtn = getLiveBtn();
      if (postBtn) {
        postBtn.disabled = true;
        postBtn.textContent = "✓ MAS Synced";
        setTimeout(() => {
          const btnNow = getLiveBtn();
          if (btnNow) {
            btnNow.textContent = "Sync MAS";
            btnNow.disabled = false;
          }
        }, 1600);
      }
      return true;
    } catch (err) {
      console.warn("MAS rates fetch failed, using offline snapshot:", err);
      const postBtn = getLiveBtn();
      if (postBtn) {
        postBtn.textContent = "Offline snapshot";
        setTimeout(() => {
          const btnNow = getLiveBtn();
          if (btnNow) {
            btnNow.textContent = "Sync MAS";
            btnNow.disabled = false;
          }
        }, 1800);
      }
      return false;
    }
  };
  loadMasRates(false);

  let lastChartResizeW = window.innerWidth;
  let chartResizeTimer = null;
  window.addEventListener("resize", () => {
    const currW = window.innerWidth;
    if (Math.abs(currW - lastChartResizeW) >= 24) {
      clearTimeout(chartResizeTimer);
      chartResizeTimer = setTimeout(() => {
        chartResizeTimer = null;
        if (Math.abs(window.innerWidth - lastChartResizeW) >= 24) {
          lastChartResizeW = window.innerWidth;
          scheduleRender();
        }
      }, 120);
    }
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

  let inputDebounceHandle = null;
  const scheduleRender = () => {
    if (savingEnabled) setSaveStatus("Saving…");
    if (inputDebounceHandle != null) {
      clearTimeout(inputDebounceHandle);
      inputDebounceHandle = null;
    }
    if (rafHandle != null) return;
    rafHandle = requestAnimationFrame(() => {
      rafHandle = null;
      render();
    });
  };
  const scheduleDebouncedRender = (delay = 110) => {
    if (savingEnabled) setSaveStatus("Saving…");
    if (inputDebounceHandle != null) clearTimeout(inputDebounceHandle);
    inputDebounceHandle = setTimeout(() => {
      inputDebounceHandle = null;
      scheduleRender();
    }, delay);
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
          if ($("#known-spend")) $("#known-spend").value = "";
          if (
            el.value === "cca" &&
            Number($("#known-retire")?.value || 65) < 55
          ) {
            if ($("#known-retire")) $("#known-retire").value = "55";
            if ($("#qe-retire")) $("#qe-retire").value = "55";
          }
        }
        if (id === "known-ssb-cash") {
          useItemizedCashAccounts = false;
          customCashAccounts = [];
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
          if (clamped !== false) {
            showToast(
              `Capped at ${money(clamped)}/mo (within ${money(currentAfterCpfCap)}/mo take-home pay)`,
            );
          }
        }
        if (el.type === "range" || el.tagName === "SELECT") scheduleRender();
        else scheduleDebouncedRender(110);
      });
      el.addEventListener("change", () => {
        if (inputDebounceHandle != null) {
          clearTimeout(inputDebounceHandle);
          inputDebounceHandle = null;
        }
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
    "familyRstuAnnual",
    "bridgeIncome",
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
      const strVal = String(planObj[key]);
      if (el.tagName === "SELECT") {
        if ([...el.options].some((o) => o.value === strVal)) {
          el.value = strVal;
        }
      } else {
        el.value = strVal;
      }
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

  const replacementDialog = $("#replace-plan-dialog");
  let replacement;
  const confirmPlanReplacement = (message, label, invoker, apply) => {
    if (replacementDialog.open) return;
    $("#replace-plan-message").textContent = message;
    $('button[value="replace"]', replacementDialog).textContent = label;
    replacement = { invoker, apply };
    replacementDialog.returnValue = "cancel";
    replacementDialog.showModal();
  };
  replacementDialog.addEventListener("close", () => {
    const pending = replacement;
    replacement = null;
    if (!pending) return;
    restoreInvokerFocus(
      pending.invoker?.getClientRects().length ? pending.invoker : null,
      "#plan-overflow summary",
    );
    if (replacementDialog.returnValue === "replace") pending.apply();
  });

  const captureReplacementUndo = () => {
    flushPendingRender();
    flushPersistState();
    const plan = captureModalSnapshot();
    const persona = $("[data-persona-preset].is-active")?.dataset.personaPreset;
    const share = { isSharedSandbox, savedBrowserStateRaw, sharedBaseline };
    return () => {
      if (
        share.isSharedSandbox &&
        savingEnabled &&
        share.savedBrowserStateRaw
      ) {
        try {
          localStorage.setItem("rs_plan_state", share.savedBrowserStateRaw);
        } catch (error) {
          console.warn("Could not restore the saved browser plan", error);
        }
      }
      ({ isSharedSandbox, savedBrowserStateRaw, sharedBaseline } = share);
      restoreModalSnapshot(plan);
      markStarterPlan(persona);
      flushPersistState();
    };
  };
  const markStarterPlan = (key) => {
    $$("[data-persona-preset]").forEach((button) => {
      const active = button.dataset.personaPreset === key;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  };

  const resetSgDefaults = () => {
    isSharedSandbox = false;
    savedBrowserStateRaw = null;

    if (isPlanShareHash(location.hash)) {
      history.replaceState(
        history.state,
        "",
        location.pathname + location.search,
      );
    }
    lastCustomSpend = "";
    lastCustomLifestyle = "";
    clearCustomBudgetState();
    clearCustomCashAccountsState();
    applyPlanObject(SG_DEFAULT_PLAN);
    selected = "frs";
    learningTarget = "frs";
    $$("[data-persona-preset]").forEach((button) => {
      button.classList.remove("is-active");
      button.setAttribute("aria-pressed", "false");
    });
    render();
    if ($("#plan-status")) {
      $("#plan-status").textContent =
        "Reset to typical Singapore age-35 defaults.";
    }
  };

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest("[data-toast-dismiss]")) {
      const toastEl = $("#ui-toast");
      if (toastEl) toastEl.hidden = true;
      undoToastAction = null;
      clearTimeout(toastTimer);
      return;
    }
    if (event.target.closest("[data-toast-undo]")) {
      const undo = undoToastAction;
      undoToastAction = null;
      clearTimeout(toastTimer);
      $("#ui-toast").hidden = true;
      undo?.();
      $("#plan-overflow summary").focus();
      showToast("Previous plan restored");
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
    if (event.target.closest("[data-sg-reset]")) {
      const snapshot = captureModalSnapshot();
      resetSgDefaults();
      flushPersistState();
      showToast("Plan reset to defaults", 12000, () => {
        restoreModalSnapshot(snapshot);
        flushPersistState();
      });
      return;
    }
    const suggested = event.target.closest("[data-use-suggested]");
    if (suggested) {
      const id = suggested.dataset.useSuggested;
      const focusBySource = {
        "known-cpf-extra": ["#qe-cpf-extra", "#known-cpf-extra"],
        "known-cash-saving": ["#qe-cash-saving", "#sim-cash-saving"],
        "known-invest": ["#qe-invest", "#sim-invest"],
        "known-bridge-income": ["#known-bridge-income", "#sim-bridge-income"],
      };
      document.getElementById(id).value = "";
      if (id === "known-invest") delete qeDialog.dataset.investAutoLocked;
      if (suggested.closest("#overview-slot")) {
        render();
        document
          .getElementById(`overview-edit-${id}`)
          ?.focus({ preventScroll: true });
        return;
      }
      const focus = $(focusBySource[id][qeDialog.open ? 0 : 1]);
      if (focus) focus.value = "";
      render();
      focus?.focus();
      return;
    }
    const moneyMoveBtn = event.target.closest("[data-money-move]");
    if (moneyMoveBtn) {
      const moveType = moneyMoveBtn.dataset.moneyMove;
      const moveVal = moneyMoveBtn.dataset.moveVal;
      const fromOverviewHero = Boolean(
        moneyMoveBtn.closest(".overview-verdict"),
      );
      if (moveType === "cap-affordable-save" && moveVal != null) {
        if (selected === "salary") selected = "frs";
        const savingsOverrides = Object.fromEntries(
          [
            ["invest", "known-invest"],
            ["cashSaving", "known-cash-saving"],
            ["cpfExtra", "known-cpf-extra"],
          ]
            .map(([key, id]) => [key, document.getElementById(id).value.trim()])
            .filter(([, value]) => value !== ""),
        );
        const {
          invest: nextInv,
          cashSaving: nextCashSav,
          cpfExtra: nextCpfEx,
        } = getCappedSavings(moveVal, savingsOverrides, currentSimulation);
        if ($("#known-invest")) $("#known-invest").value = String(nextInv);
        if ($("#sim-invest")) $("#sim-invest").value = String(nextInv);
        if ($("#qe-invest")) $("#qe-invest").value = String(nextInv);
        if ($("#known-cash-saving"))
          $("#known-cash-saving").value = String(nextCashSav);
        if ($("#sim-cash-saving"))
          $("#sim-cash-saving").value = String(nextCashSav);
        if ($("#qe-cash-saving"))
          $("#qe-cash-saving").value = String(nextCashSav);
        if ($("#known-cpf-extra"))
          $("#known-cpf-extra").value = String(nextCpfEx);
        if ($("#qe-cpf-extra")) $("#qe-cpf-extra").value = String(nextCpfEx);
        render();
        if (fromOverviewHero)
          $(".overview-verdict")?.focus({ preventScroll: true });
        showToast(
          `Capped monthly savings to ${money(nextInv + nextCashSav + nextCpfEx)}/mo within take-home cashflow`,
        );
      } else if (moveType === "match-save" && moveVal != null) {
        if ($("#known-invest")) $("#known-invest").value = String(moveVal);
        if ($("#sim-invest")) $("#sim-invest").value = String(moveVal);
        if ($("#qe-invest")) $("#qe-invest").value = String(moveVal);
        render();
        if (fromOverviewHero)
          $(".overview-verdict")?.focus({ preventScroll: true });
        showToast(`Updated monthly investment to ${money(Number(moveVal))}/mo`);
      } else if (moveType === "apply-rstu" && moveVal != null) {
        if ($("#known-cpf-extra"))
          $("#known-cpf-extra").value = String(moveVal);
        if ($("#qe-cpf-extra")) $("#qe-cpf-extra").value = String(moveVal);
        render();
        showToast(
          `Applied +${money(Number(moveVal))}/mo CPF SA top-up (RSTU tax relief)`,
        );
      } else if (moveType === "apply-srs" && moveVal != null) {
        if ($("#known-srs-annual"))
          $("#known-srs-annual").value = String(moveVal);
        render();
        showToast(
          Number(moveVal) > 0
            ? `Applied ${money(Number(moveVal))}/yr SRS contribution`
            : "Set planned annual SRS contribution to $0/yr",
        );
      } else if (moveType === "invest-srs") {
        if ($("#known-srs-invested")) $("#known-srs-invested").value = "global";
        render();
        showToast("Switched SRS balance from 0.05% cash to Global ETFs");
      } else if (moveType === "transfer-oa-sa" && moveVal != null) {
        const amt = Math.max(0, Math.round(Number(moveVal) || 0));
        const curOa = Math.max(0, Number($("#known-oa")?.value || 0));
        const curSa = Math.max(0, Number($("#known-sa")?.value || 0));
        const nextOa = Math.max(0, curOa - amt);
        const nextSa = curSa + (curOa - nextOa);
        if ($("#known-oa")) $("#known-oa").value = String(nextOa);
        if ($("#known-sa")) $("#known-sa").value = String(nextSa);
        render();
        showToast(
          `Transferred ${money(curOa - nextOa)} excess CPF OA to SA (4.0% p.a.)`,
        );
      } else if (moveType === "rebalance-portfolio") {
        const hadItemizedCash =
          useItemizedCashAccounts && customCashAccounts.length > 0;
        const eqRaw = ($("#known-equities")?.value || "").trim();
        const sgRaw = ($("#known-sg-dividends")?.value || "").trim();
        const cashRaw = ($("#known-ssb-cash")?.value || "").trim();
        const srsRaw = ($("#known-srs")?.value || "").trim();
        const curCash = hadItemizedCash
          ? sumCustomCashAccounts()
          : cashRaw !== ""
            ? Math.max(0, Number(cashRaw) || 0)
            : undefined;
        const curP = {
          savings: Math.max(0, Number($("#known-savings")?.value || 0)),
          ...(eqRaw !== ""
            ? { equities: Math.max(0, Number(eqRaw) || 0) }
            : {}),
          ...(sgRaw !== ""
            ? { sgDividends: Math.max(0, Number(sgRaw) || 0) }
            : {}),
          ...(curCash !== undefined ? { ssbCash: curCash } : {}),
          ...(srsRaw !== "" ? { srs: Math.max(0, Number(srsRaw) || 0) } : {}),
          oa: Math.max(0, Number($("#known-oa")?.value || 0)),
          sa: Math.max(0, Number($("#known-sa")?.value || 0)),
          ma: Math.max(0, Number($("#known-ma")?.value || 0)),
          srsInvestedIn: $("#known-srs-invested")?.value || "global",
          targetEquityPct: (() => {
            const raw = ($("#known-target-equity")?.value ?? "").trim();
            const parsed = raw === "" ? 80 : Number(raw);
            return Math.max(
              0,
              Math.min(100, Number.isFinite(parsed) ? parsed : 80),
            );
          })(),
          sgSleevePct: (() => {
            const raw = ($("#known-sg-sleeve")?.value ?? "").trim();
            const parsed = raw === "" ? 15 : Number(raw);
            return Math.max(
              0,
              Math.min(100, Number.isFinite(parsed) ? parsed : 15),
            );
          })(),
        };
        const bogleNow = RetirementModel.bogleheadAllocation(curP, 0);
        const reb = computeRebalanceTargets(
          bogleNow,
          curP,
          currentSummaryToday,
        );
        const nextLiqEq = reb.newLiqEq;
        const nextSg = Math.round(nextLiqEq * (curP.sgSleevePct / 100));
        const nextGlobal = Math.max(0, nextLiqEq - nextSg);
        const nextCash = reb.newCash;
        useItemizedCashAccounts = false;
        customCashAccounts = [];
        if ($("#known-equities"))
          $("#known-equities").value = String(nextGlobal);
        if ($("#known-sg-dividends"))
          $("#known-sg-dividends").value = String(nextSg);
        if ($("#known-ssb-cash")) $("#known-ssb-cash").value = String(nextCash);
        syncBucketsToTotal();
        render();
        showToast(
          `Rebalanced liquid portfolio to ${reb.tgtEqPct}/${100 - reb.tgtEqPct} target (${money(nextGlobal)} Global · ${money(nextSg)} SG · ${money(nextCash)} Cash)${hadItemizedCash ? " · switched cash to single total" : ""}`,
        );
      } else if (moveType === "sweep-cash") {
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
        customCashAccounts = RetirementModel.sweepCashAccountsOverflow(
          customCashAccounts,
          liveMasRates,
        );
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
    const cashFilter = event.target.closest(
      "[data-cash-filter], [data-cash-tag], [data-cash-view]",
    );
    if (cashFilter) {
      const {
        cashFilter: filter,
        cashTag: tag,
        cashView: view,
      } = cashFilter.dataset;
      if (filter) cashComparison.filter = filter;
      if (view) cashComparison.view = view;
      if (tag) cashComparison.tag = cashComparison.tag === tag ? "all" : tag;
      $$(
        "[data-cash-filter], [data-cash-tag], [data-cash-view]",
        cashParkingSlot,
      ).forEach((button) => {
        const data = button.dataset;
        const pressed =
          data.cashFilter === cashComparison.filter ||
          data.cashTag === cashComparison.tag ||
          data.cashView === cashComparison.view;
        button.setAttribute("aria-pressed", String(pressed));
      });
      refreshCashProducts();
      return;
    }
    const sortCash = event.target.closest("[data-cash-sort]");
    if (sortCash) {
      const key = sortCash.dataset.cashSort;
      cashComparison.direction =
        cashComparison.sort === key
          ? -cashComparison.direction
          : key === "rate"
            ? -1
            : 1;
      cashComparison.sort = key;
      refreshCashProducts();
      return;
    }
    const cashProduct =
      event.target.closest("[data-cash-product]") ||
      event.target
        .closest("[data-cash-product-row]")
        ?.querySelector("[data-cash-product]");
    if (cashProduct) {
      const id = cashProduct.dataset.cashProduct;
      if (cashComparison.expanded.has(id)) cashComparison.expanded.delete(id);
      else cashComparison.expanded.add(id);
      refreshCashProducts(id);
      return;
    }
    const resetCashFilters = event.target.closest("[data-cash-reset-filters]");
    if (resetCashFilters || event.target.closest("[data-cash-search-clear]")) {
      const search = $("#cash-search-input");
      search.value = "";
      cashComparison.search = "";
      $("[data-cash-search-clear]", cashParkingSlot).hidden = true;
      if (resetCashFilters) {
        cashComparison.filter = "all";
        cashComparison.tag = "all";
        $$("[data-cash-filter], [data-cash-tag]", cashParkingSlot).forEach(
          (button) => {
            button.setAttribute(
              "aria-pressed",
              String(button.dataset.cashFilter === "all"),
            );
          },
        );
      }
      refreshCashProducts();
      search.focus();
      return;
    }
    const realizationBtn = event.target.closest(
      "[data-div-annuity-realization]",
    );
    if (realizationBtn) {
      const realization = Number(realizationBtn.dataset.divAnnuityRealization);
      if ([0, 0.5, 1].includes(realization)) {
        divAnnuityBonusRealization = realization;
        dividendCalcSlot
          ?.querySelectorAll("[data-div-annuity-realization]")
          .forEach((button) => {
            const active =
              Number(button.dataset.divAnnuityRealization) === realization;
            button.classList.toggle("is-active", active);
            button.setAttribute("aria-pressed", String(active));
          });
        if (renderDividendTabOnly) renderDividendTabOnly();
        else scheduleRender();
      }
      return;
    }
    if (
      handleDividendPresetClick(
        event.target,
        {
          get divCalcMode() {
            return divCalcMode;
          },
          set divCalcMode(v) {
            divCalcMode = v;
          },
          get divCalcCapital() {
            return divCalcCapital;
          },
          set divCalcCapital(v) {
            divCalcCapital = v;
          },
          get divCalcRatePct() {
            return divCalcRatePct;
          },
          set divCalcRatePct(v) {
            divCalcRatePct = v;
          },
          get divTargetMonthly() {
            return divTargetMonthly;
          },
          set divTargetMonthly(v) {
            divTargetMonthly = v;
          },
          get divTargetRatePct() {
            return divTargetRatePct;
          },
          set divTargetRatePct(v) {
            divTargetRatePct = v;
          },
          get divTargetCurrCap() {
            return divTargetCurrCap;
          },
          set divTargetCurrCap(v) {
            divTargetCurrCap = v;
          },
          get divTargetMoSave() {
            return divTargetMoSave;
          },
          set divTargetMoSave(v) {
            divTargetMoSave = v;
          },
          get divAnnuityMoSave() {
            return divAnnuityMoSave;
          },
          set divAnnuityMoSave(v) {
            divAnnuityMoSave = v;
          },
          get divAnnuityQuotedMo() {
            return divAnnuityQuotedMo;
          },
          set divAnnuityQuotedMo(v) {
            divAnnuityQuotedMo = v;
          },
          get divAnnuityMonthlyDividends() {
            return divAnnuityMonthlyDividends;
          },
          set divAnnuityMonthlyDividends(v) {
            divAnnuityMonthlyDividends = v;
          },
          get divAnnuityStepUpPct() {
            return divAnnuityStepUpPct;
          },
          set divAnnuityStepUpPct(v) {
            divAnnuityStepUpPct = v;
          },
          get divAnnuityTerminalDividend() {
            return divAnnuityTerminalDividend;
          },
          set divAnnuityTerminalDividend(v) {
            divAnnuityTerminalDividend = v;
          },
          get divAnnuityPaymentMode() {
            return divAnnuityPaymentMode;
          },
          set divAnnuityPaymentMode(v) {
            divAnnuityPaymentMode = v;
          },
          get divAnnuityBonusRealization() {
            return divAnnuityBonusRealization;
          },
          set divAnnuityBonusRealization(v) {
            divAnnuityBonusRealization = v;
          },
          get divAnnuityPayYears() {
            return divAnnuityPayYears;
          },
          set divAnnuityPayYears(v) {
            divAnnuityPayYears = v;
          },
          get divAnnuityDeferYears() {
            return divAnnuityDeferYears;
          },
          set divAnnuityDeferYears(v) {
            divAnnuityDeferYears = v;
          },
          get divAnnuityDrawYears() {
            return divAnnuityDrawYears;
          },
          set divAnnuityDrawYears(v) {
            divAnnuityDrawYears = v;
          },
        },
        render,
      )
    ) {
      return;
    }
    const cashSyncBtn = event.target.closest("[data-cash-sync]");
    if (cashSyncBtn) {
      loadMasRates(true, cashSyncBtn).then((ok) => {
        showToast(
          ok
            ? "Synced latest MAS SSB & T-Bill reference yields"
            : "Offline — using bundled MAS reference yields",
        );
      });
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
        syncBucketsToTotal();
        render();
      }
      return;
    }
    const cashAddBtn = event.target.closest("[data-cash-acc-add]");
    if (cashAddBtn) {
      let presetKey = cashAddBtn.dataset.cashAccAdd || "custom";
      if (presetKey === "smart") {
        const used = new Set(customCashAccounts.map((a) => a.preset));
        const smartOrder = [
          "ocbc-360",
          "dbs-multiplier",
          "uob-one",
          "ssb",
          "maribank",
          "gxs",
          "tbills",
          "custom",
        ];
        presetKey = smartOrder.find((k) => !used.has(k)) || "custom";
      }
      const preset = RetirementModel.resolveCashAccountPreset(
        presetKey,
        liveMasRates,
      );
      if (!useItemizedCashAccounts || !customCashAccounts.length) {
        const curCash = Math.max(0, Number($("#known-ssb-cash")?.value || 0));
        customCashAccounts = [
          {
            id: "cash-acc-" + Date.now() + "-" + ++cashAccUid,
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
          id: "cash-acc-" + Date.now() + "-" + ++cashAccUid,
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
      const newIdx = customCashAccounts.length - 1;
      requestAnimationFrame(() => {
        const host = cashAccounts;
        const row = host?.querySelector(`[data-cash-acc-row="${newIdx}"]`);
        row?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        const focusEl =
          row?.querySelector(
            `[data-cash-acc-field="${preset.key === "custom" ? "name" : "balance"}"]`,
          ) || row?.querySelector(`[data-cash-acc-field="balance"]`);
        focusEl?.focus({ preventScroll: true });
        focusEl?.select?.();
      });
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
      setFinActivityTab(activityTabBtn.dataset.finActivity || "milestones");
      render();
      return;
    }
    const inspectRow = event.target.closest("tr[data-inspect-age]");
    if (inspectRow) {
      const ageVal = Number(inspectRow.dataset.inspectAge);
      if (Number.isFinite(ageVal)) {
        setTrajectoryInspectedAge(
          getTrajectoryInspectedAge() === ageVal ? null : ageVal,
        );
        renderTrajectoryChart(
          getTrajectoryForBasis(),
          chartMode,
          currentFirePlan,
          trajectoryBasis,
        );
        renderTrajectoryYearInspector();
      }
      return;
    }
    const inspectStepBtn = event.target.closest("[data-inspect-step]");
    if (inspectStepBtn && currentFirePlan?.points?.length) {
      const stepDelta = Number(inspectStepBtn.dataset.inspectStep || 0);
      const pts = currentFirePlan.points;
      const curAge = getTrajectoryInspectedAge();
      const curIdx = pts.findIndex((pItem) => pItem.age === curAge);
      const nextIdx = Math.min(
        pts.length - 1,
        Math.max(0, (curIdx === -1 ? 0 : curIdx) + stepDelta),
      );
      setTrajectoryInspectedAge(pts[nextIdx].age);
      renderTrajectoryChart(
        getTrajectoryForBasis(),
        chartMode,
        currentFirePlan,
        trajectoryBasis,
      );
      renderTrajectoryYearInspector();
      return;
    }
    if (event.target.closest("[data-inspect-close]")) {
      setTrajectoryInspectedAge(null);
      renderTrajectoryChart(
        getTrajectoryForBasis(),
        chartMode,
        currentFirePlan,
        trajectoryBasis,
      );
      renderTrajectoryYearInspector();
      return;
    }
    const famRstuBtn = event.target.closest("[data-apply-family-rstu]");
    if (famRstuBtn) {
      const amt = Math.max(
        0,
        Math.min(
          RetirementModel.C.rstuReliefCap,
          Math.round(Number(famRstuBtn.dataset.applyFamilyRstu) || 0),
        ),
      );
      if ($("#known-family-rstu")) {
        $("#known-family-rstu").value = amt > 0 ? String(amt) : "";
      }
      render();
      showToast(
        amt > 0
          ? `Applied ${money(amt)}/yr Spouse / Family CPF top-up relief`
          : "Cleared Spouse / Family CPF top-up",
      );
      return;
    }
    const shareBtn = event.target.closest("[data-share-plan]");
    if (shareBtn) {
      flushPendingRender();
      const params = lastSerializedSearch || buildSerializedParams({});
      const shareToken = encodeShareToken(params);
      const shareUrl = `${location.origin}${location.pathname}#p=${shareToken}`;
      const onCopied = () => {
        const spanEl = shareBtn.querySelector("span") || shareBtn;
        flashConfirmButton(spanEl, "✓ Link copied");
        showToast("Shareable plan link copied to clipboard");
      };
      if (navigator.clipboard?.writeText) {
        navigator.clipboard
          .writeText(shareUrl)
          .then(onCopied)
          .catch(() => {
            window.prompt(
              "Copy your shareable retirement plan link:",
              shareUrl,
            );
          });
      } else {
        window.prompt("Copy your shareable retirement plan link:", shareUrl);
      }
      return;
    }
    const personaBtn = event.target.closest("[data-persona-preset]");
    if (personaBtn) {
      const key = personaBtn.dataset.personaPreset;
      const preset = (RetirementModel.SG_PERSONA_PRESETS || []).find(
        (item) => item.id === key,
      );
      if (preset) {
        const title = $("strong", personaBtn).textContent;
        confirmPlanReplacement(
          `Loading ${title} will replace your current plan.`,
          "Load and replace",
          personaBtn,
          () => {
            const undo = captureReplacementUndo();
            clearCustomBudgetState();
            clearCustomCashAccountsState();
            const presetPlan = {
              ...SG_DEFAULT_PLAN,
              ...preset.params,
              dob: RetirementModel.defaultDobForAge(preset.params.age || 35),
            };
            applyPlanObject(presetPlan);
            selected = ["brs", "frs", "ers"].includes(preset.params.selected)
              ? preset.params.selected
              : "frs";
            if ($("#sim-bridge-income")) {
              $("#sim-bridge-income").value =
                preset.params.bridgeIncome > 0
                  ? String(preset.params.bridgeIncome)
                  : "";
            }
            markStarterPlan(key);
            $("#starter-plan-dialog").close();
            render();
            flushPersistState();
            showToast(`Loaded ${title}`, 12000, undo);
          },
        );
      }
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
      if (expDropMenu) expDropMenu.hidden = true;
      $("#exp-card-dropdown-btn")?.setAttribute("aria-expanded", "false");
      selectLifestylePreset(nextVal);
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
    if (invoker || !expDialog.open)
      lastExpInvoker = invoker || document.activeElement;
    $("#exp-modal-open-settings").hidden = Boolean(
      lastExpInvoker?.closest("#top"),
    );

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

  function selectLifestylePreset(nextVal) {
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
    render();
    showToast(
      nextVal === "cca"
        ? "Switched to Community Care ($2,800/mo preset)"
        : "Switched to Home + Helper ($3,900/mo preset)",
    );
  }

  function enterCustomExpenseMode(invoker = null) {
    const life = $("#known-lifestyle")?.value || "cca";
    const curState = getCustomSpendState(life);
    if (!curState.isCustom) {
      customBudgetActive = true;
      useItemizedExpenses = false;
      const spend =
        lastCustomSpend && lastCustomLifestyle === life
          ? Number(lastCustomSpend)
          : curState.presetBudget;
      customExpenseItems = RetirementModel.defaultExpenseItems(life, spend);
      $("#known-spend").value = String(spend);
    }
    openExpenseModal("custom", invoker);
  }

  if (expDialog) {
    bindDialogBackdropDismiss(expDialog);
    expDialog.addEventListener("click", (event) => {
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
        $("#section-profile").click();
        return;
      }
      if (event.target.closest("[data-exp-modal-close]")) {
        expDialog.close();
      }
    });

    expDialog.addEventListener("change", (event) => {
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
        // Keep custom mode active while typing so clearing the input doesn't
        // destroy focus mid-edit by switching back to the preset view.
        customBudgetActive = true;
        useItemizedExpenses = false;
        if ($("#known-spend")) $("#known-spend").value = raw;
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
      let corrected = false;
      const spendEl = $("#known-spend");
      if (spendEl) {
        const raw = spendEl.value.trim();
        if (spendEl.validity.badInput) {
          spendEl.value = lastValidFieldValues["known-spend"] ?? "";
          corrected = true;
        } else if (raw !== "" && !spendEl.validity.valid) {
          const minV = Number(spendEl.min || 0);
          const maxV = spendEl.max !== "" ? Number(spendEl.max) : Infinity;
          spendEl.value = String(Math.min(maxV, Math.max(minV, Number(raw))));
          corrected = true;
        }
      }
      if (!flushPendingRender() && corrected) render();
      if (expDialog.dataset.flowNavigation) {
        delete expDialog.dataset.flowNavigation;
        return;
      }
      restoreInvokerFocus(lastExpInvoker, '[data-quick-edit="budget"]');
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
    if (
      bentoCard &&
      (!event.relatedTarget ||
        !bentoCard.contains(
          event.relatedTarget.closest?.("[data-bento-seg]") ||
            event.relatedTarget,
        ))
    ) {
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
    } else if (field === "balance" || field === "bonusCap") {
      const entered = event.target.value.trim();
      if (event.type === "input" && entered === "") return true;
      const raw = entered.replaceAll(",", "");
      const grouped =
        !entered.includes(",") ||
        /^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d*)?(?:e[-+]?\d+)?$/i.test(entered);
      if (
        !grouped ||
        (raw !== "" &&
          (!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?$/i.test(raw) ||
            !Number.isFinite(Number(raw))))
      ) {
        if (event.type === "change")
          event.target.value = formatMoneyInput(acc[field]);
        return true;
      }
      acc[field] =
        raw === "" ? 0 : Math.round(Math.max(0, Number(raw) || 0) * 100) / 100;
      if (event.type === "change")
        event.target.value = formatMoneyInput(acc[field]);
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
  cashAccounts.addEventListener("focusin", (event) => {
    const input = event.target;
    if (input.hasAttribute("data-cash-money"))
      input.value = input.value.replaceAll(",", "");
  });
  cashAccounts.addEventListener("focusout", (event) => {
    const input = event.target;
    if (!input.hasAttribute("data-cash-money")) return;
    const account = customCashAccounts[Number(input.dataset.cashAccIdx)];
    if (account)
      input.value = formatMoneyInput(account[input.dataset.cashAccField]);
  });
  document.addEventListener("change", (event) => {
    handleCashAccountFieldEvent(event);
  });
  document.addEventListener("input", (event) => {
    handleCashAccountFieldEvent(event);
  });

  planRoot.addEventListener("input", (event) => {
    if (event.target.id === "cash-search-input") {
      cashComparison.search = event.target.value;
      $("[data-cash-search-clear]", cashParkingSlot).hidden =
        !cashComparison.search;
      refreshCashProducts();
      return;
    }
    const scheduleDividendOnlyRender = () => {
      if (renderDividendTabOnly) renderDividendTabOnly();
      else scheduleRender();
    };
    if (event.target.id === "div-calc-capital") {
      const raw = event.target.value.trim();
      divCalcCapital =
        raw === ""
          ? 0
          : Math.min(50000000, Math.max(0, Math.round(Number(raw) || 0)));
      scheduleDividendOnlyRender();
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
      scheduleDividendOnlyRender();
      return;
    }
    if (event.target.id === "div-target-monthly") {
      const raw = event.target.value.trim();
      divTargetMonthly =
        raw === ""
          ? 0
          : Math.min(500000, Math.max(0, Math.round(Number(raw) || 0)));
      scheduleDividendOnlyRender();
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
      scheduleDividendOnlyRender();
      return;
    }
    if (event.target.id === "div-target-cur-cap") {
      const raw = event.target.value.trim();
      divTargetCurrCap =
        raw === ""
          ? 0
          : Math.min(50000000, Math.max(0, Math.round(Number(raw) || 0)));
      scheduleDividendOnlyRender();
      return;
    }
    if (event.target.id === "div-target-mo-save") {
      const raw = event.target.value.trim();
      divTargetMoSave =
        raw === ""
          ? 0
          : Math.min(500000, Math.max(0, Math.round(Number(raw) || 0)));
      scheduleDividendOnlyRender();
      return;
    }
    if (event.target.id === "div-annuity-mo-save") {
      const raw = event.target.value.trim();
      divAnnuityMoSave =
        raw === ""
          ? 100
          : Math.min(
              500000,
              Math.max(1, Math.round(Number(raw.replace(/,/g, "")) || 100)),
            );
      scheduleDividendOnlyRender();
      return;
    }
    if (event.target.id === "div-annuity-quoted-mo") {
      const raw = event.target.value.trim();
      divAnnuityQuotedMo =
        raw === ""
          ? 0
          : Math.min(
              1000000,
              Math.max(0, Math.round(Number(raw.replace(/,/g, "")) || 0)),
            );
      scheduleDividendOnlyRender();
      return;
    }
    if (event.target.id === "div-annuity-monthly-dividends") {
      const raw = event.target.value.trim();
      divAnnuityMonthlyDividends =
        raw === ""
          ? 0
          : Math.min(
              10000000,
              Math.max(0, Math.round(Number(raw.replace(/,/g, "")) || 0)),
            );
      scheduleDividendOnlyRender();
      return;
    }
    if (event.target.id === "div-annuity-terminal") {
      const raw = event.target.value.trim();
      divAnnuityTerminalDividend =
        raw === ""
          ? 0
          : Math.min(
              100000000,
              Math.max(0, Math.round(Number(raw.replace(/,/g, "")) || 0)),
            );
      scheduleDividendOnlyRender();
      return;
    }
    if (event.target.id === "div-annuity-pay-yrs") {
      const raw = event.target.value.trim();
      divAnnuityPayYears =
        raw === ""
          ? 1
          : Math.min(50, Math.max(1, Math.round(Number(raw) || 1)));
      scheduleDividendOnlyRender();
      return;
    }
    if (event.target.id === "div-annuity-defer-yrs") {
      const raw = event.target.value.trim();
      divAnnuityDeferYears =
        raw === ""
          ? 0
          : Math.min(30, Math.max(0, Math.round(Number(raw) || 0)));
      scheduleDividendOnlyRender();
      return;
    }
    if (event.target.id === "div-annuity-draw-yrs") {
      const raw = event.target.value.trim();
      divAnnuityDrawYears =
        raw === ""
          ? 1
          : Math.min(50, Math.max(1, Math.round(Number(raw) || 1)));
      scheduleDividendOnlyRender();
      return;
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

  overviewSlot.addEventListener("change", (event) => {
    const input = event.target.closest("[data-overview-saving]");
    if (!input) return;
    const id = input.dataset.overviewSaving;
    const message = $("#overview-saving-message");
    if (input.validity.badInput || input.validity.rangeUnderflow) {
      input.setAttribute("aria-invalid", "true");
      message.textContent = "Enter a savings amount of $0 or more.";
      return;
    }
    const otherInputs = ["known-cpf-extra", "known-cash-saving", "known-invest"]
      .filter((field) => field !== id)
      .map((field) => document.getElementById(field));
    const clamped = clampSavingToTakeHome(input, otherInputs);
    input.removeAttribute("aria-invalid");
    message.textContent = "";
    document.getElementById(id).value = input.value;
    input.defaultValue = input.value;
    if (id === "known-invest") delete qeDialog.dataset.investAutoLocked;
    if (clamped !== false)
      showToast("Amount adjusted to fit monthly pay after CPF");
    scheduleRender();
  });

  overviewSlot.addEventListener("click", (event) => {
    const button = event.target.closest("[data-overview-saving-edit]");
    if (!button) return;
    const editor = document.getElementById(
      button.getAttribute("aria-controls"),
    );
    const input = editor.querySelector("input");
    setOverviewSavingsEditing(input, true);
    input.focus();
    input.select();
  });

  let overviewViewportTimer;
  const keepSavingsEditorVisible = () => {
    if (!document.activeElement?.matches("[data-overview-saving]")) return;
    clearTimeout(overviewViewportTimer);
    overviewViewportTimer = setTimeout(() => {
      const input = document.activeElement;
      if (
        !input?.matches("[data-overview-saving]") ||
        !window.matchMedia("(max-width: 960px)").matches
      )
        return;
      const viewport = window.visualViewport;
      const bounds = input.getBoundingClientRect();
      const visibleTop = (viewport?.offsetTop ?? 0) + 80;
      const visibleBottom =
        (viewport?.offsetTop ?? 0) +
        (viewport?.height ?? window.innerHeight) -
        16;
      if (bounds.top < visibleTop || bounds.bottom > visibleBottom) {
        window.scrollBy({
          top: (bounds.top + bounds.bottom - visibleTop - visibleBottom) / 2,
          behavior: "instant",
        });
      }
    }, 180);
  };
  window.visualViewport?.addEventListener("resize", keepSavingsEditorVisible);
  window.addEventListener("resize", keepSavingsEditorVisible);

  overviewSlot.addEventListener("focusout", (event) => {
    const input = event.target.closest("[data-overview-saving]");
    if (input && !input.hasAttribute("aria-invalid")) {
      setOverviewSavingsEditing(input, false);
    }
  });

  overviewSlot.addEventListener("keydown", (event) => {
    const input = event.target.closest("[data-overview-saving]");
    if (!input || !["Enter", "Escape"].includes(event.key)) return;
    event.preventDefault();
    if (event.key === "Escape") {
      input.value = input.defaultValue;
      input.removeAttribute("aria-invalid");
      $("#overview-saving-message").textContent = "";
    }
    input.blur();
    if (input.hasAttribute("aria-invalid")) {
      input.focus();
    } else {
      setOverviewSavingsEditing(input, false).focus({ preventScroll: true });
    }
  });

  if ($("#sim-cash-saving")) {
    $("#sim-cash-saving").addEventListener("input", () => {
      const clamped = clampSavingToTakeHome($("#sim-cash-saving"), [
        $("#known-cpf-extra"),
        $("#known-invest"),
      ]);
      if (clamped === false && !$("#sim-cash-saving").validity.valid) {
        setError(
          "Enter a monthly cash savings amount within your take-home pay, without commas or dollar signs.",
          $("#sim-cash-saving"),
        );
        return;
      }
      if ($("#known-cash-saving")) {
        $("#known-cash-saving").value = $("#sim-cash-saving").value;
      }
      scheduleDebouncedRender(110);
      const help = $("#sim-cash-saving-help");
      if (help) {
        help.textContent =
          clamped !== false
            ? `Capped at ${money(clamped)}/mo (within your ${money(currentAfterCpfCap)}/mo take-home pay).`
            : "Compounds at your projected HYSA / SSB interest rate.";
      }
      if (clamped !== false) {
        showToast(
          `Capped at ${money(clamped)}/mo (within ${money(currentAfterCpfCap)}/mo take-home pay)`,
        );
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
        $("#sim-invest"),
      );
      return;
    }
    $("#known-invest").value = $("#sim-invest").value;
    scheduleDebouncedRender(110);
    const help = $("#sim-invest-help");
    if (help) {
      help.textContent =
        clamped !== false
          ? `Capped at ${money(clamped)}/mo (within your ${money(currentAfterCpfCap)}/mo take-home pay).`
          : "Separate from CPF (HYSA, SSBs, SRS, ETFs). Leave blank for the suggested amount.";
    }
    if (clamped !== false) {
      showToast(
        `Capped at ${money(clamped)}/mo (within ${money(currentAfterCpfCap)}/mo take-home pay)`,
      );
    }
  });
  if ($("#sim-bridge-income")) {
    $("#sim-bridge-income").addEventListener("input", () => {
      if (!$("#sim-bridge-income").validity.valid) {
        setError(
          "Enter a valid monthly bridge income ($0–$1,000,000) without commas or dollar signs.",
          $("#sim-bridge-income"),
        );
        return;
      }
      if ($("#known-bridge-income")) {
        $("#known-bridge-income").value = $("#sim-bridge-income").value;
      }
      scheduleDebouncedRender(110);
    });
  }
  const allocatorFields = {
    equity: $("#known-target-equity"),
    sg: $("#known-sg-sleeve"),
  };
  const allocatorValue = (field) => {
    const { targetEquityPct, sgSleevePct } = RetirementModel.SG_DEFAULT_PLAN;
    const { value } = allocatorFields[field];
    return value === ""
      ? field === "equity"
        ? targetEquityPct
        : sgSleevePct
      : Number(value);
  };
  const setAllocatorValue = (field, value) => {
    const settings = allocatorFields[field];
    const next = Math.min(100, Math.max(0, Math.round(value)));
    if (settings.value === String(next)) return;
    settings.value = String(next);
    scheduleRender();
  };

  allocatorSlot.addEventListener("input", (event) => {
    const { value, dataset } = event.target;
    if (
      dataset.allocatorExact &&
      value !== "" &&
      Number.isFinite(Number(value))
    ) {
      setAllocatorValue(dataset.allocatorExact, Number(value));
    }
  });
  allocatorSlot.addEventListener("focusout", (event) => {
    const field = event.target.dataset.allocatorExact;
    if (field) event.target.value = String(allocatorValue(field));
  });
  allocatorSlot.addEventListener("click", (event) => {
    const exact = event.target.closest(".allocator-exact-toggle");
    if (exact) {
      const fields = $("#allocator-exact-fields");
      fields.hidden = !fields.hidden;
      exact.setAttribute("aria-expanded", String(!fields.hidden));
      return;
    }
    const basis = event.target.closest("[data-allocator-basis]");
    if (basis) {
      allocatorIncludesCpf = basis.dataset.allocatorBasis === "cpf";
      render();
      return;
    }
    const preset = event.target.closest("[data-allocator-preset]");
    if (preset) {
      setAllocatorValue("equity", Number(preset.dataset.allocatorPreset));
      return;
    }
    const nudge = event.target.closest("[data-allocator-nudge]");
    if (nudge && !nudge.disabled) {
      const field = nudge.dataset.allocatorNudge;
      setAllocatorValue(
        field,
        allocatorValue(field) + Number(nudge.dataset.delta),
      );
    }
  });
  allocatorSlot.addEventListener("keydown", (event) => {
    const handle = event.target.closest("[data-allocator-handle]");
    if (!handle || handle.getAttribute("aria-disabled") === "true") return;
    const field = handle.dataset.allocatorHandle;
    const current = allocatorValue(field);
    const nextByKey = {
      ArrowLeft: current - 1,
      ArrowDown: current - 1,
      ArrowRight: current + 1,
      ArrowUp: current + 1,
      Home: 0,
      End: 100,
    };
    if (!Object.hasOwn(nextByKey, event.key)) return;
    event.preventDefault();
    setAllocatorValue(field, nextByKey[event.key]);
  });
  allocatorSlot.addEventListener("pointerdown", (event) => {
    const handle = event.target.closest("[data-allocator-handle]");
    if (
      !handle ||
      handle.getAttribute("aria-disabled") === "true" ||
      event.button !== 0 ||
      allocatorDrag
    )
      return;
    const track = $("#allocator-slider").getBoundingClientRect();
    const thumb = handle.getBoundingClientRect();
    allocatorDrag = {
      pointerId: event.pointerId,
      field: handle.dataset.allocatorHandle,
      left: track.left,
      width: track.width,
      offset: event.clientX - (thumb.left + thumb.width / 2),
    };
    handle.setPointerCapture(event.pointerId);
  });
  allocatorSlot.addEventListener("pointermove", (event) => {
    if (allocatorDrag?.pointerId !== event.pointerId) return;
    const { left, width, offset, field } = allocatorDrag;
    const position = ((event.clientX - offset - left) / width) * 100;
    const equity = allocatorValue("equity");
    if (field === "sg" && equity === 0) return;
    setAllocatorValue(
      field,
      field === "equity" ? position : 100 - (position / equity) * 100,
    );
  });
  allocatorSlot.addEventListener("lostpointercapture", (event) => {
    if (allocatorDrag?.pointerId === event.pointerId) allocatorDrag = null;
  });
  $("#savings-simulator").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-adjust]");
    if (!button) return;
    const input = $("#" + button.dataset.adjust);
    if (!input) return;
    if (input.id === "sim-bridge-income") {
      const current =
        input.value === ""
          ? Number(input.placeholder || 0)
          : Number(input.value);
      const nextVal = Math.min(
        1000000,
        Math.max(
          0,
          Math.round((current + Number(button.dataset.delta)) * 100) / 100,
        ),
      );
      input.value = nextVal > 0 ? String(nextVal) : "";
      if ($("#known-bridge-income")) {
        $("#known-bridge-income").value = input.value;
      }
      render();
      return;
    }
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
  const handleHousingModeSwitch = (modeVal) => {
    if (modeVal === "bank") {
      if (
        $("#known-housing-rate") &&
        ($("#known-housing-rate").value === "2.6" ||
          $("#known-housing-rate").value.trim() === "")
      ) {
        $("#known-housing-rate").value = lastBankLoanRate;
      }
    } else if (modeVal === "hdb") {
      if ($("#known-housing-rate")) $("#known-housing-rate").value = "2.6";
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
          getTrajectoryForBasis(),
          chartMode,
          currentFirePlan,
          trajectoryBasis,
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

  $$("[data-traj-basis]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const nextBasis =
        btn.dataset.trajBasis === "nominal" ? "nominal" : "today";
      if (nextBasis === trajectoryBasis) return;
      trajectoryBasis = nextBasis;
      $$("[data-traj-basis]").forEach((other) => {
        const active = other.dataset.trajBasis === trajectoryBasis;
        other.classList.toggle("is-active", active);
        other.setAttribute("aria-pressed", String(active));
      });
      if (currentTrajectory) {
        renderTrajectoryChart(
          getTrajectoryForBasis(),
          chartMode,
          currentFirePlan,
          trajectoryBasis,
        );
        renderTrajectoryYearInspector();
      }
    }),
  );

  const flushPendingRender = () => {
    let flushed = false;
    if (inputDebounceHandle != null) {
      clearTimeout(inputDebounceHandle);
      inputDebounceHandle = null;
      flushed = true;
    }
    if (rafHandle != null) {
      cancelAnimationFrame(rafHandle);
      rafHandle = null;
      flushed = true;
    }
    if (flushed) render();
    return flushed;
  };

  const triggerPrintSummary = () => {
    flushPendingRender();
    flushPrintSheet();
    window.print();
  };
  window.addEventListener("beforeprint", () => {
    flushPendingRender();
    flushPrintSheet();
  });
  $("#print-plan-btn")?.addEventListener("click", triggerPrintSummary);

  const exportPlanJson = (btn) => {
    flushPendingRender();
    try {
      let stateObj = {};
      if (lastSerializedSearch) {
        stateObj = Object.fromEntries(lastSerializedSearch.entries());
      } else {
        const savedRaw = localStorage.getItem("rs_plan_state");
        stateObj = savedRaw ? JSON.parse(savedRaw) : {};
      }
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
    } catch (err) {
      console.warn("Failed to export retirement plan JSON:", err);
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
    let params = null;
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
      const unsafeKeys = new Set(["__proto__", "constructor", "prototype"]);
      const normalized = Object.create(null);
      for (const [k, v] of Object.entries(rawObj)) {
        if (unsafeKeys.has(k) || v == null || v === "") continue;
        if ((k === "expItems" || k === "cashItems") && Array.isArray(v)) {
          normalized[k] = JSON.stringify(v);
        } else {
          normalized[k] = String(v);
        }
      }
      if (!normalized.version) normalized.version = "3";
      if (!normalized.lifestyle) normalized.lifestyle = "cca";
      params = new URLSearchParams(normalized);
    } catch (err) {
      console.warn("Failed to import retirement plan JSON:", err);
      showToast("Invalid retirement plan JSON file");
      event.target.value = "";
      return;
    }
    event.target.value = "";
    confirmPlanReplacement(
      `Importing ${file.name} will replace your current plan.`,
      "Import and replace",
      $("#import-json-btn"),
      () => applyImportedPlan(params),
    );
  });

  const applyImportedPlan = (params) => {
    const undo = captureReplacementUndo();
    try {
      if (!applyStateParams(params, { resetFirst: true })) {
        undo();
        showToast(
          "Unsupported plan format. Your current plan is still active.",
        );
        return;
      }
      if (
        !bucketIds.some((id) => ($("#" + id)?.value || "").trim() !== "") &&
        ($("#known-savings")?.value || "").trim() !== ""
      ) {
        // Direct total savings preserved
      } else {
        syncBucketsToTotal();
      }
      render();
      if (errorBanner && !errorBanner.hidden) {
        const errMsg =
          $("#settings-error")?.textContent?.trim() ||
          errorBanner
            .querySelector(".plan-error-copy span")
            ?.textContent?.trim() ||
          "Imported plan contains invalid values";
        undo();
        showToast(`${errMsg} — kept your current plan`);
        return;
      }
      isSharedSandbox = false;
      savedBrowserStateRaw = null;

      if (isPlanShareHash(location.hash)) {
        history.replaceState(
          history.state,
          "",
          location.pathname + location.search,
        );
      }
      if (savingEnabled) {
        try {
          localStorage.setItem("rs_plan_version", PLAN_STORAGE_VERSION);
          localStorage.setItem(
            "rs_plan_state",
            JSON.stringify(Object.fromEntries(params.entries())),
          );
        } catch (err) {
          console.warn("Unable to persist imported plan:", err);
        }
      }
      const importBtn = $("#import-json-btn");
      if (importBtn) {
        const labelSpan = importBtn.querySelector("span");
        flashConfirmButton(labelSpan || importBtn, "✓ Imported");
      }
      markStarterPlan(null);
      showToast(
        savingEnabled
          ? "Imported retirement plan into local storage"
          : "Imported retirement plan for this session (Private Mode)",
        12000,
        undo,
      );
    } catch (err) {
      console.error("Failed to render imported retirement plan:", err);
      undo();
      showToast("Imported plan failed to apply — kept your current plan");
    }
  };
  document.addEventListener("click", (event) => {
    if (event.target?.closest?.("[data-print-trigger]")) {
      triggerPrintSummary();
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

  const cashYield = $("#cash-yield-assumption");
  const savedCashYield = $("#known-cash-return");
  const cashYieldError = $("#cash-yield-error");
  let cashYieldEdited = false;
  const syncCashYield = () => {
    cashYieldEdited = false;
    cashYield.value = savedCashYield.value;
    cashYield.removeAttribute("aria-invalid");
    cashYieldError.hidden = true;
  };
  document.addEventListener("click", (event) => {
    if (
      event.target?.closest?.(
        '[commandfor="plan-settings"][command="show-modal"]',
      )
    ) {
      syncCashYield();
    }
  });
  cashYield.addEventListener("input", () => {
    cashYieldEdited = true;
    const valid = cashYield.validity.valid;
    cashYieldError.hidden = valid;
    if (!valid) {
      cashYield.setAttribute("aria-invalid", "true");
      setSaveStatus(savingEnabled ? "Changes pending" : "Session only");
      return;
    }
    cashYield.removeAttribute("aria-invalid");
    savedCashYield.value = cashYield.value;
    scheduleRender();
  });
  $("#plan-settings").addEventListener("close", () => {
    const bridge = $("#known-bridge-income");
    if (!bridge.validity.valid) {
      bridge.value = lastValidFieldValues[bridge.id] ?? "";
      render();
    }
    if (
      cashYieldEdited &&
      !cashYield.validity.valid &&
      !cashYield.validity.badInput
    ) {
      savedCashYield.value = String(
        Math.min(15, Math.max(0, Number(cashYield.value))),
      );
      render();
    }
    if (
      !flushPendingRender() &&
      cashYieldEdited &&
      cashYield.validity.badInput
    ) {
      render();
    }
    syncCashYield();
  });

  const qeDialog = $("#quick-edit-modal");
  const { syncQuickEditState, getActiveQeTab } = createQuickEditController({
    qeDialog,
    SG_DEFAULT_PLAN,
    lastValidFieldValues,
    getSelected: () => selected,
    getCurrentFirePlan: () => currentFirePlan,
    getCurrentAfterCpfCap: () => currentAfterCpfCap,
    restoreInvokerFocus,
    openExpenseModal,
    clampSavingToTakeHome,
    render,
    scheduleRender,
    flushPendingRender,
    showToast,
  });

  const finishSettingsEdit = setupInlineSettings(fields, formatFieldRangeError);
  if (
    !($("#known-savings")?.value || "").trim() &&
    bucketIds.some((id) => ($("#" + id)?.value || "").trim() !== "")
  ) {
    syncBucketsToTotal();
  }
  render();
  return finishSettingsEdit;
}

function setupSettings() {
  const dialog = $("#plan-settings");
  const starterDialog = $("#starter-plan-dialog");
  bindDialogBackdropDismiss(starterDialog);
  starterDialog.addEventListener("close", () => {
    if (!$("#replace-plan-dialog").open) $("#plan-overflow summary").focus();
  });
  document.addEventListener("click", (event) => {
    const starterAction = event.target?.closest?.(
      '[commandfor="starter-plan-dialog"]',
    );
    if (!starterAction) return;
    event.preventDefault();
    if (starterAction.getAttribute("command") === "close")
      starterDialog.close();
    else starterDialog.showModal();
  });
  let lastInvoker = null;

  document.addEventListener("click", (event) => {
    const button = event.target?.closest?.(
      'button[commandfor="plan-settings"]',
    );
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
    const target =
      lastInvoker?.closest("#plan-overflow")?.querySelector("summary") ||
      (lastInvoker?.isConnected ? lastInvoker : $("#plan-overflow summary"));
    target?.focus({ preventScroll: true });
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
    const details = ["tab-panel-cash-parking", "top"].includes(target.id)
      ? null
      : target.matches("details")
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
    const link = event.target?.closest?.('a[href^="#"]');
    if (link) revealHash(link.getAttribute("href"));
  });
  window.addEventListener("hashchange", () => revealHash(location.hash));
  revealHash(location.hash);
}

function setupGuidedFlow(finishSettingsEdit) {
  const destinations = {
    overview: ["overview"],
    plan: ["profile", "budget", "trajectory"],
    accounts: ["balances", "cash-accounts", "cash-parking"],
    invest: ["allocator", "dividend-calc", "priority-guide"],
    "cpf-tax": ["cpf-rules", "tax"],
  };
  const destinationByTab = new Map(
    Object.entries(destinations).flatMap(([destination, tabs]) =>
      tabs.map((tab) => [tab, destination]),
    ),
  );
  const inputSlots = {
    profile: "#plan-inputs-slot",
    balances: "#balances-inputs-slot",
    tax: "#tax-inputs-slot",
  };
  let activeTab = "overview";
  const form = $("#quick-form");

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
  const applyViewState = (focus = true, push = false) => {
    const currentDestination = destinationByTab.get(activeTab);
    document.body.dataset.view = activeTab;
    for (const destination of Object.keys(destinations)) {
      $(`#workspace-${destination}`).hidden =
        destination !== currentDestination;
    }
    for (const tab of destinationByTab.keys()) {
      $(`#tab-panel-${tab}`).hidden = tab !== activeTab;
    }

    for (const button of $$("[data-destination], [data-tab]")) {
      const selected = button.dataset.destination
        ? button.dataset.destination === currentDestination
        : button.dataset.tab === activeTab;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
    }

    const inputs = $("#top");
    const inputSlot = inputSlots[activeTab] && $(inputSlots[activeTab]);
    inputs.hidden = !inputSlot;
    if (inputSlot && inputs.parentElement !== inputSlot)
      inputSlot.append(inputs);
    for (const group of $$("[data-settings-scope]", inputs)) {
      group.hidden = group.dataset.settingsScope !== activeTab;
    }

    if (applyViewState.lastTab !== activeTab) {
      applyViewState.lastTab = activeTab;
      window.dispatchEvent(
        new CustomEvent("rs:tabchange", { detail: { tab: activeTab } }),
      );
    }
    if (push) {
      const url = new URL(location.href);
      if (!isPlanShareHash(url.hash)) url.hash = activeTab;
      history.pushState(
        { ...history.state, plannerTab: activeTab, profileOpen: false },
        "",
        url,
      );
    }

    if (focus) {
      const targetEl = $(`#tab-panel-${activeTab}`);
      targetEl?.setAttribute("tabindex", "-1");
      targetEl?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  };

  const navigateTo = ({ tab = activeTab } = {}, focus = true) => {
    if (!finishSettingsEdit()) return false;
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
    const nextTab = destinationByTab.has(tab) ? tab : "overview";
    const viewChanged = nextTab !== activeTab;
    activeTab = nextTab;
    applyViewState(focus, viewChanged);
    if (
      viewChanged &&
      !window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
    ) {
      const targetPanel = $(`#tab-panel-${activeTab}`);
      if (targetPanel) {
        targetPanel.classList.remove("is-tab-entering");
        void targetPanel.offsetWidth;
        targetPanel.classList.add("is-tab-entering");
      }
    }
    return true;
  };

  // WAI-ARIA Tabs Pattern keyboard arrow navigation & roving tabindex across all role="tablist" controls
  document.addEventListener("keydown", (event) => {
    const tab = event.target?.closest?.('[role="tab"]');
    if (!tab) return;
    const tablist = tab.closest('[role="tablist"]');
    if (!tablist) return;
    const isVertical =
      tablist.getAttribute("aria-orientation") === "vertical" ||
      tablist.classList.contains("sidebar-nav");
    const prevKey = isVertical ? "ArrowUp" : "ArrowLeft";
    const nextKey = isVertical ? "ArrowDown" : "ArrowRight";
    if (![prevKey, nextKey, "Home", "End"].includes(event.key)) return;
    const tabs = [
      ...tablist.querySelectorAll('[role="tab"]:not([disabled])'),
    ].filter((el) => !el.hidden && el.offsetParent !== null);
    if (tabs.length < 2) return;
    const curIdx = tabs.indexOf(tab);
    if (curIdx === -1) return;
    event.preventDefault();
    let nextIdx = curIdx;
    if (event.key === nextKey) nextIdx = (curIdx + 1) % tabs.length;
    else if (event.key === prevKey)
      nextIdx = (curIdx - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") nextIdx = 0;
    else if (event.key === "End") nextIdx = tabs.length - 1;
    const targetTab = tabs[nextIdx];
    const destinationTab = destinations[targetTab.dataset.destination]?.[0];
    if (targetTab.dataset.tab || destinationTab) {
      if (navigateTo({ tab: targetTab.dataset.tab || destinationTab }, false))
        targetTab.focus();
    } else {
      tabs.forEach((t) =>
        t.setAttribute("tabindex", t === targetTab ? "0" : "-1"),
      );
      targetTab.focus();
      targetTab.click();
    }
  });

  // Unified click handlers for tabs, deep links inside cards, and Profile Editor
  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const tabBtn = event.target.closest(
      "button[data-tab], button[data-destination]",
    );
    if (tabBtn) {
      event.preventDefault();
      const tabs = destinations[tabBtn.dataset.destination];
      navigateTo({
        tab:
          tabBtn.dataset.tab ||
          (tabs.includes(activeTab) ? activeTab : tabs[0]),
      });
      return;
    }

    const cashEditorLink = event.target.closest(
      "[data-open-page-cash-accounts]",
    );
    if (cashEditorLink) {
      event.preventDefault();
      navigateTo({ tab: "cash-accounts" });
      return;
    }

    const goTabBtn = event.target.closest("[data-go-tab]");
    if (goTabBtn) {
      if (
        goTabBtn.matches("a[href]") &&
        (event.button !== 0 ||
          event.altKey ||
          event.ctrlKey ||
          event.metaKey ||
          event.shiftKey)
      )
        return;
      event.preventDefault();
      navigateTo({ tab: goTabBtn.dataset.goTab });
      return;
    }

    const settingsField = event.target.closest("[data-open-settings-field]");
    if (settingsField) {
      const field = document.getElementById(
        settingsField.dataset.openSettingsField,
      );
      if (field) {
        const row = $$("[data-settings-sources]", form)
          .find((editor) =>
            editor.dataset.settingsSources.split(" ").includes(field.id),
          )
          ?.closest("[data-settings-row]");
        const tab =
          row?.closest("[data-settings-scope]")?.dataset.settingsScope ||
          "profile";
        if (!navigateTo({ tab }, false)) return;
        const disclosure = $("#top").closest("details");
        if (disclosure) disclosure.open = true;
        if (row) {
          const edit = $("[data-settings-edit]", row);
          if (edit?.hidden && $("[data-settings-sources]", row).hidden) {
            $(".settings-row-extra button", row)?.focus();
          } else {
            if (edit && !edit.hidden) edit.click();
            const draft = $(`[data-settings-draft="${field.id}"]`, row);
            const choice = $(
              `[data-choice-for="${field.id}"] input:checked`,
              row,
            );
            (choice || draft)?.focus();
          }
          row.scrollIntoView({ block: "nearest", behavior: "instant" });
          return;
        }
        const details = field.closest("details");
        if (details) details.open = true;
        const target =
          document.getElementById(`${field.id}-display`) ||
          document.querySelector(
            `[data-choice-for="${field.id}"] [aria-pressed="true"]`,
          ) ||
          field;
        target.focus();
        target.scrollIntoView({ block: "nearest" });
      }
      return;
    }

    if (event.target.closest("[data-open-profile]")) {
      event.preventDefault();
      navigateTo({ tab: "profile" });
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

  form.addEventListener("submit", (event) => event.preventDefault());

  document.addEventListener("plan-rendered", () =>
    applyViewState(false, false),
  );

  $$(".brand").forEach((brand) =>
    brand.addEventListener("click", (event) => {
      event.preventDefault();
      navigateTo({ tab: "overview" });
    }),
  );

  const hashAliases = {
    top: ["profile"],
    "retirement-plan": ["overview"],
    "retirement-budget": ["budget", "expense-breakdown-card"],
    "expense-breakdown-card": ["budget", "expense-breakdown-card"],
    "retirement-taps-card": ["overview", "retirement-taps-card"],
    "savings-simulator": ["trajectory", "savings-simulator"],
    "trajectory-section": ["trajectory", "trajectory-section"],
    "cash-accounts": ["cash-accounts", "cash-accounts"],
    "boglehead-allocator": ["allocator", "boglehead-allocator"],
    "dividend-calculator-card": ["dividend-calc", "dividend-calculator-card"],
    "tax-sweet-spot": ["tax", "tax-sweet-spot"],
    "salary-cpf-caps": ["tax", "salary-cpf-caps"],
    "cpf-goal-guide": ["cpf-rules", "cpf-goal-guide"],
    "cpf-position-details": ["cpf-rules", "cpf-position-details"],
    "overview-methodology": ["cpf-rules", "overview-methodology"],
    "cpf-strategy-comparison": ["cpf-rules", "cpf-strategy-comparison"],
  };
  const openRoute = () => {
    const id = location.hash.slice(1);
    if (!id || id.includes("=")) return false;
    const [tab, targetId] = hashAliases[id] || [
      destinations[id.replace(/^workspace-/, "")]?.[0] ||
        id.replace(/^tab-panel-/, ""),
    ];
    if (!destinationByTab.has(tab)) return false;
    activeTab = tab;
    applyViewState(false, false);
    if (targetId) {
      const target = document.getElementById(targetId);
      if (target instanceof HTMLDetailsElement) target.open = true;
      const budgetDetails = target?.querySelector(".exp-breakdown-disclosure");
      if (budgetDetails) budgetDetails.open = true;
      requestAnimationFrame(() => target?.scrollIntoView());
    }
    return true;
  };
  window.addEventListener("popstate", (event) => {
    const storedTab = event.state?.plannerTab;
    if (!storedTab && openRoute()) return;
    activeTab = event.state?.profileOpen
      ? "profile"
      : destinationByTab.has(storedTab)
        ? storedTab
        : "overview";
    applyViewState(false, false);
  });
  window.addEventListener("hashchange", openRoute);
  applyViewState(false, false);
  openRoute();
}

function setupPlanControls() {
  {
    const overflow = $("#plan-overflow");
    const overflowToggle = overflow.querySelector("summary");
    document.addEventListener("click", (event) => {
      if (!overflow.open) return;
      if (
        event.target?.closest?.("button") &&
        overflow.contains(event.target)
      ) {
        overflow.open = false;
        if (document.activeElement === document.body) overflowToggle.focus();
      } else if (!overflow.contains(event.target)) {
        overflow.open = false;
      }
    });
    document.addEventListener("focusin", (event) => {
      if (overflow.open && !overflow.contains(event.target))
        overflow.open = false;
    });
    overflow.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && overflow.open) {
        event.preventDefault();
        overflow.open = false;
        overflowToggle.focus();
      }
    });
  }

  const choiceGroups = [
    [
      "known-housing-mode",
      ["Use new OA", "HDB loan", "Bank loan", "Paid up / cash", "Manual OA"],
    ],
    ["known-plan", ["Standard", "Escalating"]],
    ["known-longevity", ["85", "90", "95 (default)", "100"]],
    ["known-srs-age", ["63", "64"]],
  ];
  for (const [id, labels] of choiceGroups) {
    const source =
      $(`[data-settings-draft="${id}"]`) || document.getElementById(id);
    const group = document.createElement("div");
    group.className = "option-chips";
    group.dataset.choiceFor = id;
    group.setAttribute("role", "radiogroup");
    const title = document.querySelector(`label[for="${source.id}"]`);
    if (!title.id) title.id = `${id}-label`;
    group.setAttribute("aria-labelledby", title.id);
    const chips = Array.from(source.options, (option, index) => {
      const label = document.createElement("label");
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = `${id}-option`;
      radio.value = option.value;
      const text = document.createElement("span");
      text.textContent = labels[index];
      label.append(radio, text);
      group.append(label);
      return radio;
    });
    const sync = () => {
      chips.forEach((radio) => {
        radio.checked = radio.value === source.value;
      });
    };
    group.addEventListener("change", (event) => {
      source.value = event.target.value;
      source.dispatchEvent(new Event("input", { bubbles: true }));
      source.dispatchEvent(new Event("change", { bubbles: true }));
    });
    source.parentElement.after(group);
    if (id === "known-housing-mode") {
      const descriptions = {
        "all-oa":
          "If unsure, assume new salary OA goes to housing until you enter loan details.",
        hdb: "Uses the HDB concessionary rate. Enter the remaining balance and loan term below.",
        bank: "Enter the remaining balance, loan term and your bank’s interest rate below.",
        "paid-up":
          "No housing deduction from OA; new OA contributions remain in CPF.",
        custom: "Set the monthly amount deducted from OA for housing.",
      };
      const helper = document.createElement("small");
      helper.className = "housing-mode-description";
      helper.id = "known-housing-mode-description";
      helper.dataset.modeHelperFor = id;
      source.setAttribute("aria-describedby", helper.id);
      group.after(helper);
      const syncHelper = () => {
        helper.textContent = descriptions[source.value] || "";
        helper.hidden = !helper.textContent;
      };
      group.addEventListener("change", syncHelper);
      source.addEventListener("settings-draft-ready", syncHelper);
      document.addEventListener("plan-rendered", syncHelper);
      syncHelper();
    }
    source.parentElement.hidden = true;
    document.addEventListener("plan-rendered", sync);
    source.addEventListener("settings-draft-ready", sync);
    sync();
  }
}

// Supplemental field guidance stays available without filling every form row.
function setupFieldHelp() {
  const nativePopover = "popover" in HTMLElement.prototype;
  const closeHelp = () =>
    $$(".field-help-panel:popover-open").forEach((panel) =>
      panel.hidePopover(),
    );
  const supportsCssAnchor =
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    CSS.supports("position-area", "block-end");
  $$(".field, .qe-field").forEach((field) => {
    if (field.closest("[data-settings-storage]")) return;
    const label = field.querySelector(
      ":scope > label, :scope > .dob-label-row > label, :scope > .toggle-label-row > label",
    );
    const help = field.querySelector(":scope > small, :scope > .qe-hint");
    const input = label && document.getElementById(label.htmlFor);
    if (!input || !help) return;
    const panel = document.createElement("div");
    panel.id = `${input.id}-more-info`;
    panel.className = "field-help-panel";
    panel.append(help);
    const title = (label.dataset.settingsFullLabel || label.textContent)
      .replace(/\s+/g, " ")
      .trim();
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
    const inline = field.closest("[data-settings-sources]");
    if (inline && !inline.dataset.settingsSources.includes(" ")) {
      const titleSlot = $(
        ".settings-row-label",
        inline.closest("[data-settings-row]"),
      );
      const helpControl =
        $(".field-help-trigger", row) || $(".field-help-fallback", field);
      titleSlot.append(helpControl);
      if (nativePopover) titleSlot.append(panel);
    }
    const describedBy = (input.getAttribute("aria-describedby") || "")
      .split(/\s+/)
      .filter((id) => id && id !== help.id);
    if (describedBy.length)
      input.setAttribute("aria-describedby", describedBy.join(" "));
    else input.removeAttribute("aria-describedby");
  });
  if (nativePopover) {
    document.addEventListener("click", (event) => {
      if (event.target?.closest?.(".brand")) closeHelp();
    });
    $("#plan-settings")?.addEventListener("close", closeHelp);
    window.addEventListener("popstate", closeHelp);
  }
}

setupServiceWorkerUpdates();

const finishSettingsEdit = setupSimplePlan();
setupSettings();
setupDeepLinks();
setupGuidedFlow(finishSettingsEdit);
setupFieldHelp();
setupPlanControls();
