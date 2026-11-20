const $ = (selector, root = document) =>
  (root || document).querySelector(selector);
const $$ = (selector, root = document) => [
  ...(root || document).querySelectorAll(selector),
];
const fmtInt = (value) =>
  Math.round(Math.max(0, value) || 0).toLocaleString("en-SG");
const formatFundedPct = (pctFunded) => {
  const rounded = Math.max(0, Math.round(Number(pctFunded) || 0));
  return rounded > 100 ? "100%+" : `${rounded}%`;
};
const money = (value) => `$${fmtInt(value)}`;
const m = (value, suffix = "", animKey = "") => {
  const numVal = Math.round(Math.max(0, value) || 0);
  const animAttr = animKey
    ? ` data-anim-key="${animKey}" data-anim-val="${numVal}"`
    : "";
  return `<span class="curr-wrap"${animAttr}><span class="curr-prefix">$</span><span class="curr-num">${numVal.toLocaleString("en-SG")}</span>${suffix ? `<span class="curr-suffix">${suffix}</span>` : ""}</span>`;
};
const signedM = (value, suffix = "", animKey = "") => {
  const raw = Math.round(Number(value) || 0);
  const sign = raw < 0 ? "−" : "";
  const absVal = Math.abs(raw);
  const animAttr = animKey
    ? ` data-anim-key="${animKey}" data-anim-val="${raw}" data-anim-signed="1"`
    : "";
  return `<span class="curr-wrap"${animAttr}><span class="curr-prefix">${sign}$</span><span class="curr-num">${absVal.toLocaleString("en-SG")}</span>${suffix ? `<span class="curr-suffix">${suffix}</span>` : ""}</span>`;
};
const centsHtml = (value, suffix = "") => {
  const num = Math.max(0, Number(value) || 0);
  const parts = num
    .toLocaleString("en-SG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    .split(".");
  const hasCents = parts[1] !== "00";
  return `<span class="curr-wrap"><span class="curr-prefix">$</span><span class="curr-num">${parts[0]}</span>${hasCents ? `<span class="curr-dec">.${parts[1]}</span>` : ""}${suffix ? `<span class="curr-suffix">${suffix}</span>` : ""}</span>`;
};
const compactMoney = (value) => {
  const v = Math.round(Math.max(0, value) || 0);
  if (v >= 1000000)
    return `$${(v / 1000000).toFixed(2).replace(/\.?0+$/, "")}M`;
  if (v >= 1000) return `$${Math.round(v / 1000)}k`;
  return `$${v}`;
};
const svgCompactMoney = (value) => {
  const v = Math.round(Math.max(0, value) || 0);
  const body =
    v >= 1000000
      ? `${(v / 1000000).toFixed(2).replace(/\.?0+$/, "")}M`
      : v >= 1000
        ? `${Math.round(v / 1000)}k`
        : `${v}`;
  return `<tspan class="svg-curr-val"><tspan fill-opacity="0.72" font-size="0.86em">$</tspan>${body}</tspan>`;
};
const svgMoney = (value) =>
  `<tspan class="svg-curr-val"><tspan fill-opacity="0.72" font-size="0.86em">$</tspan>${fmtInt(value)}</tspan>`;
const ageLabel = (value) => {
  if (value == null) return "Not reached by 80";
  const totalMonths = Math.round(value * 12);
  return `${Math.floor(totalMonths / 12)} yrs ${totalMonths % 12} mos`;
};

const svgWrap = (paths, size = 16) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

const ICONS = {
  alertTriangle: svgWrap(
    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    18,
  ),
  checkTiny: svgWrap(
    '<circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.3 2.3 4.7-4.8"/>',
    15,
  ),
  warnTiny: svgWrap(
    '<circle cx="12" cy="12" r="9"/><path d="M12 8v4.5"/><path d="M12 16h.01"/>',
    15,
  ),
};

const KPI_ICONS = {
  age: svgWrap(
    '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v4.5l3 1.8"/>',
    16,
  ),
  goal: svgWrap(
    '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/>',
    16,
  ),
  salary: svgWrap(
    '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M7 9h.01M17 15h.01"/>',
    16,
  ),
  balances: svgWrap(
    '<path d="M12 21s7-3.5 7-9V5l-7-2.5L5 5v7c0 5.5 7 9 7 9z"/><path d="M9 14v-2.5"/><path d="M12 14v-4.5"/><path d="M15 14V8"/>',
    16,
  ),
};

function buildSmoothSpline(coords, minY, maxY) {
  if (!coords.length) return "";
  if (coords.length === 1) return `M ${coords[0].x} ${coords[0].y}`;
  const clampY = (y) => Math.max(minY, Math.min(maxY, y));
  let d = `M ${coords[0].x.toFixed(1)} ${clampY(coords[0].y).toFixed(1)}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[Math.max(0, i - 1)];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[Math.min(coords.length - 1, i + 2)];
    const tension = 0.22;
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = clampY(p1.y + (p2.y - p0.y) * tension);
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = clampY(p2.y - (p3.y - p1.y) * tension);
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${clampY(p2.y).toFixed(1)}`;
  }
  return d;
}

function niceAxis(rawMax, steps = 4) {
  const safeMax = Math.max(1000, rawMax);
  const rawStep = safeMax / steps;
  const mag = 10 ** Math.floor(Math.log10(rawStep));
  const norm = rawStep / mag;
  const niceNorm =
    norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  const step = niceNorm * mag;
  const maxVal = step * Math.ceil((safeMax * 1.05) / step);
  const actualSteps = Math.round(maxVal / step);
  const ticks = Array.from({ length: actualSteps + 1 }, (_, i) => i * step);
  return { maxVal, ticks };
}

function resetControl(el, clearTextInputs = false) {
  if (!el) return;
  el.value =
    el.tagName === "SELECT"
      ? ([...el.options].find((o) => o.defaultSelected) || el.options[0]).value
      : clearTextInputs && el.type !== "hidden"
        ? ""
        : el.defaultValue;
}

function syncCustomBudgetReset(opts = {}) {
  const selected = $("#known-lifestyle")?.value || "cca";
  const amount =
    RetirementModel.lifestyles[selected]?.budget ||
    RetirementModel.lifestyles.cca.budget;
  const custom = $("#known-spend");
  if (!custom) return;
  custom.placeholder = String(amount);
  const rawCustom = (custom.value || "").trim();
  const hasNumericDiff =
    rawCustom !== "" &&
    custom.validity.valid &&
    Number.isFinite(Number(rawCustom)) &&
    Math.round(Number(rawCustom) * 100) !== Math.round(amount * 100);
  const hasCustom = Boolean(
    hasNumericDiff || opts.customBudgetActive || opts.useItemizedExpenses,
  );
  const reset = $("#use-preset-budget");
  if (reset) {
    reset.hidden = !hasCustom;
    reset.textContent = `Reset to ${selected === "cca" ? "CCA ($2,800)" : "Home + Helper ($3,900)"} preset`;
  }
  const itemizedNote = $("#settings-itemized-note");
  if (itemizedNote) {
    const count = Number(opts.itemizedCount || 0);
    if (opts.useItemizedExpenses && count > 0) {
      const msg = `Driven by ${count} itemized expense item${count === 1 ? "" : "s"} (${money(Number(rawCustom || amount))}/mo).`;
      const span = itemizedNote.querySelector("span");
      if (span) span.textContent = msg;
      else itemizedNote.textContent = msg;
      itemizedNote.hidden = false;
    } else {
      const span = itemizedNote.querySelector("span");
      if (span) span.textContent = "";
      else itemizedNote.textContent = "";
      itemizedNote.hidden = true;
    }
  }
  const cashNote = $("#settings-cash-accounts-note");
  const cashOpenBtn = $("#open-cash-breakdown-settings");
  if (cashNote) {
    const active = Boolean(opts.useItemizedCashAccounts);
    const count = Number(opts.cashAccountsCount || 0);
    if (cashOpenBtn) {
      cashOpenBtn.textContent = active
        ? `Edit ${count || "custom"} bank & SSB account${count === 1 ? "" : "s"} →`
        : "Break down bank accounts & $100k caps →";
    }
    if (active && count > 0) {
      const rawCash = ($("#known-ssb-cash")?.value || "").trim();
      const eirStr =
        opts.cashEffectiveRatePct != null
          ? ` @ ${Number(opts.cashEffectiveRatePct).toFixed(2)}% EIR`
          : "";
      const msg = `Driven by ${count} cash & SSB account${count === 1 ? "" : "s"} (${money(Number(rawCash || 0))}${eirStr}).`;
      const span = cashNote.querySelector("span");
      if (span) span.textContent = msg;
      else cashNote.textContent = msg;
      cashNote.hidden = false;
    } else {
      const span = cashNote.querySelector("span");
      if (span) span.textContent = "";
      else cashNote.textContent = "";
      cashNote.hidden = true;
    }
  }
}

function bindDialogBackdropDismiss(dialog) {
  if (!dialog) return;
  let backdropPointerDown = false;
  dialog.addEventListener("pointerdown", (event) => {
    const r = dialog.getBoundingClientRect();
    backdropPointerDown =
      event.target === dialog &&
      (event.clientX < r.left ||
        event.clientX > r.right ||
        event.clientY < r.top ||
        event.clientY > r.bottom);
  });
  dialog.addEventListener("click", (event) => {
    const shouldClose = backdropPointerDown;
    backdropPointerDown = false;
    if (!shouldClose || event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    ) {
      dialog.close("cancel");
    }
  });
}

function escapeAttr(val) {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const escapeHtml = escapeAttr;
const RAW_HTML = Symbol("raw-html");

/** Mark a trusted HTML string so the `html` tagged template does not double-escape it. */
function raw(value) {
  return { [RAW_HTML]: true, value: String(value ?? "") };
}

/** Auto-escaping HTML tagged template helper; wrap trusted sub-templates with `raw()`. */
function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) {
    const val = values[i];
    if (val != null && typeof val === "object" && val[RAW_HTML]) {
      out += val.value;
    } else if (Array.isArray(val)) {
      out += val
        .map((item) =>
          item != null && typeof item === "object" && item[RAW_HTML]
            ? item.value
            : escapeHtml(item),
        )
        .join("");
    } else {
      out += escapeHtml(val);
    }
    out += strings[i + 1];
  }
  return out;
}

function formatExpSharePct(pct) {
  const num = Number(pct || 0);
  if (num <= 0) return "0%";
  if (num < 1) return "<1%";
  return `${Math.round(num)}%`;
}

function formatDobShort(dobStr) {
  const info = RetirementModel.computeAgeFromDob(dobStr);
  if (!info.valid) return "";
  const [y, mo, d] = info.iso.split("-").map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function deriveReadinessSummary({
  fire,
  endAge,
  pctFunded,
  onTrack,
  compact = false,
}) {
  const fn = fire?.fireNumber || {};
  const targetEndAge = endAge || fire?.endAge || 95;
  const projFireAge = fn.projectedFireAge;
  const readyText = projFireAge == null ? "After 80" : `Age ${projFireAge}`;
  const diffYears = projFireAge == null ? null : fire.retire - projFireAge;
  const depletionAgeDisplay =
    fn.depletionAge != null ? Math.floor(fn.depletionAge) : targetEndAge;
  const survivalAnswer = fn.fullyFundedTo95
    ? `Lasts past age ${targetEndAge}+`
    : `Lasts to age ${depletionAgeDisplay}`;
  const safeAgeAnswer =
    diffYears == null
      ? "After age 80"
      : diffYears > 0
        ? compact
          ? `Age ${projFireAge} (-${diffYears} yr${diffYears > 1 ? "s" : ""} early)`
          : `Age ${projFireAge} (${diffYears} yr${diffYears > 1 ? "s" : ""} earlier optional)`
        : diffYears === 0
          ? `Age ${projFireAge} (on target)`
          : compact
            ? `Age ${projFireAge} (+${-diffYears} yr${-diffYears > 1 ? "s" : ""})`
            : `Age ${projFireAge} (+${-diffYears} yr${-diffYears > 1 ? "s" : ""} later)`;
  const fundedPctLabel = formatFundedPct(pctFunded ?? fn.pctFunded);
  const deltaLine =
    !compact && diffYears != null && diffYears > 0 && onTrack
      ? `Can retire ${diffYears} yr${diffYears > 1 ? "s" : ""} earlier · ${fundedPctLabel} funded`
      : `${fundedPctLabel} of age-${targetEndAge} goal`;
  const deltaColor =
    diffYears != null && diffYears >= 0 && onTrack
      ? "var(--sem-cpf-ink)"
      : "var(--sem-cash-ink)";
  return {
    projFireAge,
    readyText,
    diffYears,
    depletionAgeDisplay,
    survivalAnswer,
    safeAgeAnswer,
    fundedPctLabel,
    deltaLine,
    deltaColor,
  };
}

export {
  $,
  $$,
  fmtInt,
  formatFundedPct,
  deriveReadinessSummary,
  money,
  m,
  signedM,
  centsHtml,
  compactMoney,
  svgCompactMoney,
  svgMoney,
  ageLabel,
  svgWrap,
  ICONS,
  KPI_ICONS,
  buildSmoothSpline,
  niceAxis,
  resetControl,
  syncCustomBudgetReset,
  bindDialogBackdropDismiss,
  escapeAttr,
  escapeHtml,
  raw,
  html,
  formatExpSharePct,
  formatDobShort,
};
