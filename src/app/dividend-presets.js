/**
 * Declarative click-preset handlers for the Dividend Calculator tab.
 */

const DIVIDEND_PRESET_SPECS = [
  {
    selector: "[data-div-mode]",
    datasetKey: "divMode",
    field: "divCalcMode",
    type: "enum",
    allowed: ["lump", "target", "annuity"],
  },
  {
    selector: "[data-div-cap-pick]",
    datasetKey: "divCapPick",
    field: "divCalcCapital",
    type: "set",
    min: 0,
    max: 50000000,
    fallback: 0,
  },
  {
    selector: "[data-div-cap-step]",
    datasetKey: "divCapStep",
    field: "divCalcCapital",
    type: "step",
    min: 0,
    max: 50000000,
  },
  {
    selector: "[data-div-rate-pick]",
    datasetKey: "divRatePick",
    field: "divCalcRatePct",
    type: "set",
    min: 0,
    max: 25,
    decimals: 2,
    fallback: 0,
  },
  {
    selector: "[data-div-target-pick]",
    datasetKey: "divTargetPick",
    field: "divTargetMonthly",
    type: "set",
    min: 100,
    max: 500000,
    fallback: 10000,
  },
  {
    selector: "[data-div-target-step]",
    datasetKey: "divTargetStep",
    field: "divTargetMonthly",
    type: "step",
    min: 100,
    max: 500000,
  },
  {
    selector: "[data-div-target-rate-pick]",
    datasetKey: "divTargetRatePick",
    field: "divTargetRatePct",
    type: "set",
    min: 0.1,
    max: 25,
    decimals: 2,
    fallback: 5,
  },
  {
    selector: "[data-div-target-cap-pick]",
    datasetKey: "divTargetCapPick",
    field: "divTargetCurrCap",
    type: "set",
    min: 0,
    max: 50000000,
    fallback: 0,
  },
  {
    selector: "[data-div-target-save-pick]",
    datasetKey: "divTargetSavePick",
    field: "divTargetMoSave",
    type: "set",
    min: 0,
    max: 500000,
    fallback: 0,
  },
  {
    selector: "[data-div-annuity-save-pick]",
    datasetKey: "divAnnuitySavePick",
    field: "divAnnuityMoSave",
    type: "set",
    min: 50,
    max: 500000,
    fallback: 1000,
  },
  {
    selector: "[data-div-annuity-payout-pick]",
    datasetKey: "divAnnuityPayoutPick",
    field: "divAnnuityQuotedMo",
    type: "set",
    min: 0,
    max: 1000000,
    fallback: 1200,
  },
  {
    selector: "[data-div-annuity-dividend-pick]",
    datasetKey: "divAnnuityDividendPick",
    field: "divAnnuityMonthlyDividends",
    type: "set",
    min: 0,
    max: 10000000,
    fallback: 0,
  },
  {
    selector: "[data-div-annuity-pay-yrs]",
    datasetKey: "divAnnuityPayYrs",
    field: "divAnnuityPayYears",
    type: "set",
    min: 1,
    max: 50,
    fallback: 15,
  },
  {
    selector: "[data-div-annuity-defer-yrs]",
    datasetKey: "divAnnuityDeferYrs",
    field: "divAnnuityDeferYears",
    type: "set",
    min: 0,
    max: 30,
    fallback: 0,
  },
  {
    selector: "[data-div-annuity-step-up]",
    datasetKey: "divAnnuityStepUp",
    field: "divAnnuityStepUpPct",
    type: "set",
    min: 0,
    max: 100,
    decimals: 2,
    fallback: 5,
  },
  {
    selector: "[data-div-annuity-payment]",
    datasetKey: "divAnnuityPayment",
    field: "divAnnuityPaymentMode",
    type: "enum",
    allowed: ["monthly", "annual"],
  },
  {
    selector: "[data-div-annuity-realization]",
    datasetKey: "divAnnuityRealization",
    field: "divAnnuityBonusRealization",
    type: "set",
    min: 0,
    max: 1,
    decimals: 2,
    fallback: 1,
  },
  {
    selector: "[data-div-annuity-draw-yrs]",
    datasetKey: "divAnnuityDrawYrs",
    field: "divAnnuityDrawYears",
    type: "set",
    min: 1,
    max: 50,
    fallback: 20,
  },
];

function clampNumeric(value, spec) {
  const rounded = spec.decimals
    ? Math.round(value * 10 ** spec.decimals) / 10 ** spec.decimals
    : Math.round(value);
  return Math.min(spec.max, Math.max(spec.min, rounded));
}

export function handleDividendPresetClick(target, state, onChange) {
  if (!target?.closest) return false;
  for (const spec of DIVIDEND_PRESET_SPECS) {
    const btn = target.closest(spec.selector);
    if (!btn) continue;
    const rawVal = btn.dataset[spec.datasetKey];
    if (spec.type === "enum") {
      if (spec.allowed.includes(rawVal)) {
        state[spec.field] = rawVal;
        onChange();
      }
      return true;
    }
    if (spec.type === "step") {
      const delta = Number(rawVal);
      if (!Number.isFinite(delta)) return true;
      state[spec.field] = clampNumeric((state[spec.field] || 0) + delta, spec);
      onChange();
      return true;
    }
    const num = Number(rawVal);
    const parsed =
      rawVal !== "" && rawVal != null && Number.isFinite(num)
        ? num
        : (spec.fallback ?? 0);
    state[spec.field] = clampNumeric(parsed, spec);
    onChange();
    return true;
  }
  return false;
}
