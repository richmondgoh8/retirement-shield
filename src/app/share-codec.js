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

export function toBase64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(token) {
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

export function buildShareDefaultEntries(defaultPlan, defaultDob) {
  return {
    lifestyle: String(defaultPlan.lifestyle || "cca"),
    dob: defaultDob,
    salary: String(defaultPlan.salary ?? 5500),
    retire: String(defaultPlan.retire ?? 65),
    equities: String(defaultPlan.equities ?? 34000),
    sgDividends: String(defaultPlan.sgDividends ?? 6000),
    ssbCash: String(defaultPlan.ssbCash ?? 20000),
    srsAge: String(defaultPlan.srsAge ?? 63),
    srsInvestedIn: String(defaultPlan.srsInvestedIn || "global"),
    existingReliefs: String(defaultPlan.existingReliefs ?? 1000),
    targetEquityPct: String(defaultPlan.targetEquityPct ?? 80),
    sgSleevePct: String(defaultPlan.sgSleevePct ?? 15),
    plan: String(defaultPlan.plan || "standard"),
    returnRate: String(defaultPlan.returnRate ?? 0.05),
    inflationRate: String(defaultPlan.inflationRate ?? 0.025),
    post55Work: String(Boolean(defaultPlan.post55Work ?? false)),
    reserveReturn: String(defaultPlan.reserveReturn ?? 0),
    housingMode: String(defaultPlan.housingMode || "all-oa"),
    housingParties: String(defaultPlan.housingParties ?? 1),
    selected: "frs",
    learningTarget: "frs",
    version: PLAN_STORAGE_VERSION,
  };
}

export function encodeShareToken(search, shareDefaults) {
  const entries = Object.fromEntries(search.entries());
  const diff = {};
  for (const [k, rawVal] of Object.entries(entries)) {
    if (k === "age" && (entries.dob || shareDefaults.dob)) {
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
      const merged = { ...shareDefaults };
      for (const [k, v] of Object.entries(parsed)) {
        if (v === "" || v == null) {
          delete merged[k];
        } else {
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
