/**
 * Revertible modal snapshot, focus restoration, and dialog lifecycle helpers.
 */
import { $ } from "./format.js";

const EXTRA_SNAPSHOT_IDS = [
  "sim-cash-saving",
  "sim-invest",
  "sim-bridge-income",
  "bogle-target-slider",
  "bogle-sg-slider",
];

export function captureModalSnapshot({ fields, getState }) {
  const fieldValues = {};
  for (const id of Object.values(fields)) {
    const el = $("#" + id);
    if (el) fieldValues[id] = el.value;
  }
  for (const extraId of EXTRA_SNAPSHOT_IDS) {
    const el = $("#" + extraId);
    if (el) fieldValues[extraId] = el.value;
  }
  const s = getState();
  return {
    fieldValues,
    selected: s.selected,
    lastBankLoanRate: s.lastBankLoanRate,
    lastCustomSpend: s.lastCustomSpend,
    lastCustomLifestyle: s.lastCustomLifestyle,
    customBudgetActive: s.customBudgetActive,
    useItemizedExpenses: s.useItemizedExpenses,
    customExpenseItems: s.customExpenseItems.map((it) => ({ ...it })),
    useItemizedCashAccounts: s.useItemizedCashAccounts,
    customCashAccounts: s.customCashAccounts.map((acc) => ({ ...acc })),
  };
}

export function restoreModalSnapshot(
  snap,
  { cancelPendingRender, applyState, syncHousingDisplay, render },
) {
  if (!snap) return;
  cancelPendingRender?.();
  for (const [id, val] of Object.entries(snap.fieldValues)) {
    const el = $("#" + id);
    if (el) el.value = val;
  }
  applyState({
    selected: snap.selected,
    lastBankLoanRate: snap.lastBankLoanRate,
    lastCustomSpend: snap.lastCustomSpend,
    lastCustomLifestyle: snap.lastCustomLifestyle,
    customBudgetActive: snap.customBudgetActive,
    useItemizedExpenses: snap.useItemizedExpenses,
    customExpenseItems: snap.customExpenseItems.map((it) => ({ ...it })),
    useItemizedCashAccounts: snap.useItemizedCashAccounts,
    customCashAccounts: snap.customCashAccounts.map((acc) => ({ ...acc })),
  });
  const qeElRef = $("#quick-edit-modal");
  if (qeElRef) delete qeElRef.dataset.investAutoLocked;
  syncHousingDisplay();
  render();
}

export function restoreInvokerFocus(invoker, fallbackSelector = null) {
  if (invoker?.isConnected) {
    invoker.focus({ preventScroll: true });
    return;
  }
  const target =
    (fallbackSelector
      ? Array.from(document.querySelectorAll(fallbackSelector)).find(
          (element) => element.getClientRects().length > 0,
        )
      : null) || $("#fire-hero-title");
  target?.focus({ preventScroll: true });
}
