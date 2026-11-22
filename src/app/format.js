const $ = (selector, root = document) =>
  (root || document).querySelector(selector);
const $$ = (selector, root = document) => [
  ...(root || document).querySelectorAll(selector),
];
const fmtInt = (value) =>
  Math.round(Math.max(0, value) || 0).toLocaleString("en-SG");
const formatFundedPct = (pctFunded) => `${fmtInt(pctFunded)}%`;
function getSavingsProgress(fire) {
  const pct = fire.fireNumber.pctFunded;
  const percent = formatFundedPct(pct);
  return {
    pct,
    percent,
    title: `Savings target funded at age ${fire.retire}`,
    label: `${percent} of savings target funded at age ${fire.retire}`,
  };
}
function getSavingsRunway(fire) {
  const { depletionAge } = fire.fireNumber;
  return depletionAge == null
    ? `Funded through age ${fire.endAge}`
    : `Lasts to age ${Math.floor(depletionAge)}`;
}
const money = (value) => `$${fmtInt(value)}`;
const formatMoneyInput = (amount) =>
  Number(amount).toLocaleString("en-SG", { maximumFractionDigits: 20 });
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

function buildAllocationMix(equity, sgSleeve) {
  const segments = [
    ["Global", (equity * (100 - sgSleeve)) / 100, "equities"],
    ["SG", (equity * sgSleeve) / 100, "equities-sg"],
    ["Bond", 100 - equity, "cash"],
  ];
  return `<div class="allocation-mix">
    <div class="allocation-track" aria-hidden="true">
      ${segments.map(([, pct, color]) => `<span style="width:${pct}%;background:var(--sem-${color})"></span>`).join("")}
    </div>
    <ul class="allocation-legend">
      ${segments.map(([label, pct, color]) => `<li><i style="background:var(--sem-${color})" aria-hidden="true"></i>${label} <strong>${Number(pct.toFixed(2))}%</strong></li>`).join("")}
    </ul>
  </div>`;
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

function formatAnnuityIrr(pct, { signed = false, digits = 2 } = {}) {
  if (!Number.isFinite(pct)) return "—";
  const value = (pct || 0).toLocaleString("en-SG", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    signDisplay: signed ? "exceptZero" : "auto",
  });
  return `${value}%`;
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
  const readyText =
    projFireAge == null ? "No age through 80" : `Age ${projFireAge}`;
  const diffYears = projFireAge == null ? null : fire.retire - projFireAge;
  const depletionAgeDisplay =
    fn.depletionAge != null ? Math.floor(fn.depletionAge) : targetEndAge;
  const survivalAnswer = fn.fullyFundedTo95
    ? `Funded through age ${targetEndAge}`
    : `Lasts to age ${depletionAgeDisplay}`;
  const safeAgeAnswer =
    diffYears == null
      ? readyText
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
  buildAllocationMix,
  $,
  $$,
  fmtInt,
  formatFundedPct,
  getSavingsProgress,
  getSavingsRunway,
  deriveReadinessSummary,
  money,
  formatMoneyInput,
  m,
  signedM,
  centsHtml,
  compactMoney,
  svgCompactMoney,
  svgMoney,
  ageLabel,
  svgWrap,
  ICONS,
  resetControl,
  bindDialogBackdropDismiss,
  escapeAttr,
  escapeHtml,
  raw,
  html,
  formatExpSharePct,
  formatAnnuityIrr,
  formatDobShort,
};
