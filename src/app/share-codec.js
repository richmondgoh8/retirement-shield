/**
 * Pure URL-hash and base64url codec for sharing and restoring Retirement Shield plans.
 */

export const PLAN_STORAGE_VERSION = "3";
export const SUPPORTED_PLAN_VERSIONS = new Set(["2", PLAN_STORAGE_VERSION]);

const LEGACY_SHARE_KEY_RE =
  /(?:^|&)(?:version|lifestyle|salary|dob|age|retire|plan)=/;

export function isPlanShareHash(h) {
  return Boolean(
    h &&
    h.length > 2 &&
    (h.startsWith("#p=") || LEGACY_SHARE_KEY_RE.test(h.slice(1))),
  );
}

function toBase64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(token) {
  const b64 = String(token || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
  const bin = atob(b64 + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

const UNSAFE_OBJECT_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export function buildShareDefaultEntries(defaultPlan, defaultDob) {
  const dp = defaultPlan || {};
  const str = (val, fallback = "") => String(val ?? fallback);
  return {
    lifestyle: str(dp.lifestyle),
    dob: defaultDob,
    salary: str(dp.salary),
    retire: str(dp.retire),
    oa: str(dp.oa),
    sa: str(dp.sa),
    ma: str(dp.ma),
    saInvested: str(dp.saInvested, 0),
    maSpend: str(dp.maSpend, 0),
    cpfExtra: str(dp.cpfExtra, 0),
    equities: str(dp.equities),
    sgDividends: str(dp.sgDividends),
    ssbCash: str(dp.ssbCash),
    cashReturnRate: str(dp.cashReturnRate, ""),
    srs: str(dp.srs),
    srsAge: str(dp.srsAge),
    srsAnnual: str(dp.srsAnnual),
    srsInvestedIn: str(dp.srsInvestedIn),
    annualBonus: str(dp.annualBonus),
    existingReliefs: str(dp.existingReliefs),
    familyRstuAnnual: str(dp.familyRstuAnnual, 0),
    longevityAge: str(dp.longevityAge, 95),
    bridgeIncome: str(dp.bridgeIncome, 0),
    targetEquityPct: str(dp.targetEquityPct),
    sgSleevePct: str(dp.sgSleevePct),
    plan: str(dp.plan),
    returnRate: str(dp.returnRate),
    inflationRate: str(dp.inflationRate),
    post55Work: String(Boolean(dp.post55Work)),
    reserveReturn: str(dp.reserveReturn),
    housingMode: str(dp.housingMode),
    housingBalance: str(dp.housingBalance),
    housingYears: str(dp.housingYears),
    housingRate: str(dp.housingRate),
    housingParties: str(dp.housingParties),
    selected: "frs",
    learningTarget: "frs",
    version: PLAN_STORAGE_VERSION,
  };
}

export function encodeShareToken(search, shareDefaults) {
  const entries = Object.fromEntries(search.entries());
  const diff = {};
  for (const [k, rawVal] of Object.entries(entries)) {
    // Only skip redundant age when an explicit dob is actually present in entries.
    if (k === "age" && entries.dob) {
      continue;
    }
    if (k === "savings") {
      const eqSum =
        Number(entries.equities || 0) +
        Number(entries.sgDividends || 0) +
        Number(entries.ssbCash || 0) +
        Number(entries.srs || 0);
      if (Math.abs(Number(rawVal) - eqSum) < 0.01) continue;
    }
    const strVal = String(rawVal);
    // Always include dob explicitly so shared links do not drift as DEFAULT_DOB advances over time.
    if (k !== "dob" && shareDefaults[k] === strVal) continue;
    if (
      strVal !== "" &&
      /^-?\d+(\.\d+)?$/.test(strVal) &&
      !/^0\d/.test(strVal) &&
      k !== "dob"
    ) {
      diff[k] = Number(strVal);
    } else {
      diff[k] = strVal;
    }
  }
  for (const k of Object.keys(shareDefaults)) {
    if (!(k in entries)) {
      diff[k] = "";
    }
  }
  return toBase64Url(JSON.stringify(diff));
}

export function decodeShareHashToParams(hash, shareDefaults) {
  if (!hash || hash.length <= 2) return null;
  if (hash.startsWith("#p=")) {
    try {
      const rawToken = hash.slice(3).split("&")[0];
      const parsed = JSON.parse(fromBase64Url(rawToken));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return null;
      }
      const merged = Object.assign(Object.create(null), shareDefaults);
      for (const [k, v] of Object.entries(parsed)) {
        if (UNSAFE_OBJECT_KEYS.has(k)) continue;
        if (v === "" || v == null) {
          delete merged[k];
        } else if (
          typeof v === "string" ||
          typeof v === "number" ||
          typeof v === "boolean"
        ) {
          merged[k] = String(v);
        }
      }
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(merged)) {
        if (v != null && v !== "") params.set(k, String(v));
      }
      return params;
    } catch (err) {
      console.warn("Failed to decode #p= share token:", err);
      return null;
    }
  }
  if (LEGACY_SHARE_KEY_RE.test(hash.slice(1))) {
    return new URLSearchParams(hash.slice(1));
  }
  return null;
}
