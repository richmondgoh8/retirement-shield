import { $, money } from "./format.js";

export function createCashAccountsClickHandler(ctx) {
  const {
    RetirementModel,
    cashAccountsHost,
    getCustomCashAccounts,
    setCustomCashAccounts,
    getUseItemizedCashAccounts,
    setUseItemizedCashAccounts,
    nextCashAccUid,
    getLiveMasRates,
    loadMasRates,
    sumCustomCashAccounts,
    syncCashAccountsToBucket,
    syncBucketsToTotal,
    render,
    showToast,
  } = ctx;

  return function handleCashAccountClick(target) {
    const cashSyncBtn = target.closest("[data-cash-sync]");
    if (cashSyncBtn) {
      loadMasRates(true, cashSyncBtn).then((result) => {
        const { message, tone } = {
          updated: { message: "MAS rates updated.", tone: "success" },
          unchanged: {
            message: "The app’s MAS feed has no newer rates.",
            tone: "info",
          },
          unavailable: {
            message: "Could not check MAS rates. Keeping the current rates.",
            tone: "warning",
          },
        }[result];
        showToast(message, { tone, dedupeKey: "mas-sync" });
      });
      return true;
    }

    const cashModeBtn = target.closest("[data-cash-acc-mode]");
    if (cashModeBtn) {
      const nextMode = cashModeBtn.dataset.cashAccMode;
      const customCashAccounts = getCustomCashAccounts();
      const liveMasRates = getLiveMasRates();
      if (nextMode === "itemized") {
        if (!customCashAccounts.length) {
          const curCash = Math.max(
            0,
            Number($("#known-ssb-cash")?.value || 20000),
          );
          setCustomCashAccounts(
            RetirementModel.defaultCashAccounts(curCash, liveMasRates),
          );
        }
        setUseItemizedCashAccounts(true);
        syncCashAccountsToBucket();
        render();
      } else {
        const curTot =
          getUseItemizedCashAccounts() && customCashAccounts.length
            ? sumCustomCashAccounts()
            : Math.max(0, Number($("#known-ssb-cash")?.value || 0));
        setUseItemizedCashAccounts(false);
        if ($("#known-ssb-cash")) $("#known-ssb-cash").value = String(curTot);
        syncBucketsToTotal();
        render();
      }
      return true;
    }

    const cashAddBtn = target.closest("[data-cash-acc-add]");
    if (cashAddBtn) {
      const customCashAccounts = getCustomCashAccounts();
      const liveMasRates = getLiveMasRates();
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
      if (!getUseItemizedCashAccounts() || !customCashAccounts.length) {
        const curCash = Math.max(0, Number($("#known-ssb-cash")?.value || 0));
        setCustomCashAccounts([
          {
            id: "cash-acc-" + Date.now() + "-" + nextCashAccUid(),
            preset: preset.key,
            name: preset.name,
            balance: curCash > 0 ? curCash : 10000,
            bonusCap: preset.bonusCap,
            bonusRatePct: preset.bonusRatePct,
            baseRatePct: preset.baseRatePct,
          },
        ]);
      } else {
        customCashAccounts.push({
          id: "cash-acc-" + Date.now() + "-" + nextCashAccUid(),
          preset: preset.key,
          name: preset.name,
          balance: 10000,
          bonusCap: preset.bonusCap,
          bonusRatePct: preset.bonusRatePct,
          baseRatePct: preset.baseRatePct,
        });
      }
      setUseItemizedCashAccounts(true);
      syncCashAccountsToBucket();
      render();
      const newIdx = getCustomCashAccounts().length - 1;
      requestAnimationFrame(() => {
        const row = cashAccountsHost?.querySelector(
          `[data-cash-acc-row="${newIdx}"]`,
        );
        row?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        const focusEl =
          row?.querySelector(
            `[data-cash-acc-field="${preset.key === "custom" ? "name" : "balance"}"]`,
          ) || row?.querySelector(`[data-cash-acc-field="balance"]`);
        focusEl?.focus({ preventScroll: true });
        focusEl?.select?.();
      });
      showToast(`Added ${preset.name}`, { tone: "success" });
      return true;
    }

    const cashRemBtn = target.closest("[data-cash-acc-remove]");
    if (cashRemBtn) {
      const idx = Number(cashRemBtn.dataset.cashAccRemove);
      const customCashAccounts = getCustomCashAccounts();
      if (
        Number.isInteger(idx) &&
        idx >= 0 &&
        idx < customCashAccounts.length
      ) {
        const removed = customCashAccounts[idx];
        customCashAccounts.splice(idx, 1);
        if (customCashAccounts.length > 0) {
          setUseItemizedCashAccounts(true);
          syncCashAccountsToBucket();
        } else {
          setUseItemizedCashAccounts(false);
          if ($("#known-ssb-cash"))
            $("#known-ssb-cash").value = String(removed?.balance || 0);
          syncBucketsToTotal();
        }
        render();
        if (removed?.name) {
          showToast(`Removed ${removed.name}`, { tone: "info" });
        }
      }
      return true;
    }

    const cashSweepBtn = target.closest("[data-cash-acc-sweep]");
    if (cashSweepBtn) {
      const customCashAccounts = getCustomCashAccounts();
      const liveMasRates = getLiveMasRates();
      if (customCashAccounts.length > 0) {
        const beforeBd = RetirementModel.computeCashAccountsBreakdown(
          customCashAccounts,
          liveMasRates,
        );
        setCustomCashAccounts(
          RetirementModel.sweepCashAccountsOverflow(
            customCashAccounts,
            liveMasRates,
          ),
        );
        setUseItemizedCashAccounts(true);
        syncCashAccountsToBucket();
        render();
        showToast(
          `Swept ${money(beforeBd.totalOverflowBalance)} overflow to MAS SSB (+${money(beforeBd.sweepAnnualGain)}/yr → ${beforeBd.sweptEffectiveRatePct.toFixed(2)}% EIR)`,
          { tone: "success", ms: 5000, dedupeKey: "sweep-cash" },
        );
      }
      return true;
    }

    return false;
  };
}
