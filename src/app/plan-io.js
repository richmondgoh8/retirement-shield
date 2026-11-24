import { $, bindDialogBackdropDismiss } from "./format.js";
import { isPlanShareHash } from "./share-codec.js";

export function createPlanIoController(ctx) {
  const {
    PLAN_STORAGE_VERSION,
    bucketIds,
    errorBanner,
    getLastSerializedSearch,
    getSavingEnabled,
    buildSerializedParams,
    encodeShareToken,
    applyStateParams,
    syncBucketsToTotal,
    flushPendingRender,
    render,
    captureReplacementUndo,
    clearSharedSandbox,
    markStarterPlan,
    clearExampleIntro,
    flashConfirmButton,
    restoreInvokerFocus,
    showToast,
  } = ctx;

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

  const shareDialog = $("#share-fallback-dialog");
  const shareInput = $("#share-fallback-url");
  const shareCopyBtn = $("#share-fallback-copy");
  let shareInvoker = null;
  if (shareDialog) {
    bindDialogBackdropDismiss(shareDialog);
    shareDialog.addEventListener("close", () => {
      const invoker = shareInvoker;
      shareInvoker = null;
      restoreInvokerFocus(
        invoker?.getClientRects().length ? invoker : null,
        "#plan-overflow summary",
      );
    });
  }

  const openShareFallback = (shareUrl, invoker) => {
    if (!shareDialog || !shareInput) return;
    shareInvoker = invoker;
    shareInput.value = shareUrl;
    if (!shareDialog.open) shareDialog.showModal();
    requestAnimationFrame(() => {
      shareInput.focus();
      shareInput.select();
    });
  };

  shareCopyBtn?.addEventListener("click", () => {
    if (!shareInput) return;
    const shareUrl = shareInput.value;
    const finishCopy = () => {
      flashConfirmButton(shareCopyBtn, "✓ Copied");
      showToast("Shareable plan link copied to clipboard", {
        tone: "success",
        dedupeKey: "share-copy",
      });
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(shareUrl)
        .then(finishCopy)
        .catch(() => {
          shareInput.focus();
          shareInput.select();
        });
    } else {
      shareInput.focus();
      shareInput.select();
    }
  });

  const sharePlan = (shareBtn) => {
    flushPendingRender();
    const params = getLastSerializedSearch() || buildSerializedParams({});
    const shareToken = encodeShareToken(params);
    const shareUrl = `${location.origin}${location.pathname}#p=${shareToken}`;
    const onCopied = () => {
      const spanEl = shareBtn.querySelector("span") || shareBtn;
      flashConfirmButton(spanEl, "✓ Link copied");
      showToast("Shareable plan link copied to clipboard", {
        tone: "success",
        dedupeKey: "share-copy",
      });
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(shareUrl)
        .then(onCopied)
        .catch(() => openShareFallback(shareUrl, shareBtn));
    } else {
      openShareFallback(shareUrl, shareBtn);
    }
  };

  const exportPlanJson = (btn) => {
    flushPendingRender();
    try {
      let stateObj = {};
      const lastSearch = getLastSerializedSearch();
      if (lastSearch) {
        stateObj = Object.fromEntries(lastSearch.entries());
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
      showToast("Exported retirement plan JSON", {
        tone: "success",
        dedupeKey: "export-json",
      });
    } catch (err) {
      console.warn("Failed to export retirement plan JSON:", err);
      showToast("Could not export retirement plan JSON", {
        tone: "error",
        dedupeKey: "export-json",
      });
    }
  };

  $("#export-json-btn")?.addEventListener("click", (event) => {
    exportPlanJson(event.currentTarget);
  });

  const applyImportedPlan = (params) => {
    const undo = captureReplacementUndo();
    const savingEnabled = getSavingEnabled();
    try {
      if (!applyStateParams(params, { resetFirst: true })) {
        undo();
        showToast("Unsupported plan format — kept your current plan", {
          tone: "error",
          dedupeKey: "import-json",
        });
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
        showToast(`${errMsg} — kept your current plan`, {
          tone: "error",
          dedupeKey: "import-json",
        });
        return;
      }
      clearSharedSandbox();

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
      clearExampleIntro();
      $("#overview-example-intro")?.remove();
      showToast(
        savingEnabled
          ? "Imported retirement plan into this browser"
          : "Imported retirement plan for this session (Private Mode)",
        { tone: "success", undo, dedupeKey: "import-json" },
      );
    } catch (err) {
      console.error("Failed to render imported retirement plan:", err);
      undo();
      showToast("Imported plan failed to apply — kept your current plan", {
        tone: "error",
        dedupeKey: "import-json",
      });
    }
  };

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
      showToast("Invalid retirement plan JSON file", {
        tone: "error",
        dedupeKey: "import-json",
      });
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

  return {
    confirmPlanReplacement,
    sharePlan,
  };
}
