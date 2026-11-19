import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const MAS_BASE =
  "https://eservices.mas.gov.sg/statistics/api/v1/bondsandbills/";
const MONTHS_SHORT = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

function trancheCodeFromIssueDate(issueDate) {
  if (typeof issueDate !== "string") return "";
  const match = issueDate.match(/^(\d{4})-(\d{2})-/);
  if (!match) return "";
  const yr = match[1].slice(-2);
  const moIdx = Number(match[2]) - 1;
  const mon = MONTHS_SHORT[moIdx];
  return mon ? `SB${mon}${yr}` : "";
}

function shortMonthLabel(isoDate) {
  if (typeof isoDate !== "string") return "";
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return isoDate;
  const mon = MONTHS_SHORT[Number(match[2]) - 1] || match[2];
  return `${mon.charAt(0)}${mon.slice(1).toLowerCase()} '${match[1].slice(-2)}`;
}

function shortDayMonthLabel(isoDate) {
  if (typeof isoDate !== "string") return "";
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return isoDate;
  const mon = MONTHS_SHORT[Number(match[2]) - 1] || match[2];
  return `${Number(match[3])} ${mon.charAt(0)}${mon.slice(1).toLowerCase()}`;
}

async function fetchJson(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "RetirementShield-RateSync/1.0",
      },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${url}`);
    }
    const json = await res.json();
    if (!json?.success || !Array.isArray(json?.result?.records)) {
      throw new Error(`Unexpected payload for ${url}`);
    }
    return json.result.records;
  } finally {
    clearTimeout(timer);
  }
}

function roundPct(val) {
  const num = Number(val);
  return Number.isFinite(num) ? Math.round(num * 100) / 100 : null;
}

function summarizeWindow(values, currentVal, extra = {}) {
  const clean = values.filter((v) => Number.isFinite(v));
  if (!clean.length || !Number.isFinite(currentVal)) return null;
  const sorted = clean.slice().sort((a, b) => a - b);
  const sum = clean.reduce((acc, v) => acc + v, 0);
  const belowOrEqual = clean.filter((v) => v <= currentVal).length;
  return {
    count: clean.length,
    min: roundPct(sorted[0]),
    max: roundPct(sorted[sorted.length - 1]),
    avg: roundPct(sum / clean.length),
    percentile: Math.round((belowOrEqual / clean.length) * 100),
    ...extra,
  };
}

async function main() {
  const [ssbIssues, ssbInterests, tbillAuctions] = await Promise.all([
    fetchJson(`${MAS_BASE}m/listsavingbonds?rows=200&sort=issue_date%20desc`),
    fetchJson(
      `${MAS_BASE}m/savingbondsinterest?rows=200&sort=issue_date%20desc`,
    ),
    fetchJson(
      `${MAS_BASE}m/listauctionbondsandbills?rows=200&filters=product_type:%22B%22&sort=auction_date%20desc`,
    ),
  ]);

  const interestByCode = new Map(
    ssbInterests.map((row) => [row.issue_code, row]),
  );

  const ssbSeries = ssbIssues
    .filter((row) => interestByCode.has(row.issue_code))
    .map((row) => {
      const intr = interestByCode.get(row.issue_code);
      return {
        issueCode: row.issue_code,
        trancheCode: trancheCodeFromIssueDate(row.issue_date) || row.issue_code,
        annDate: row.ann_date,
        lastDayToApply: row.last_day_to_apply,
        issueDate: row.issue_date,
        maturityDate: row.maturity_date,
        issueSizeM: Number(row.issue_size) || null,
        year1Coupon: roundPct(intr.year1_coupon),
        year1Return: roundPct(intr.year1_return),
        year5Return: roundPct(intr.year5_return),
        year10Coupon: roundPct(intr.year10_coupon),
        year10Return: roundPct(intr.year10_return),
      };
    })
    .filter((row) => Number.isFinite(row.year10Return));

  const currentIssue = ssbSeries[0];
  if (!currentIssue)
    throw new Error("No SSB issue records with rates returned");
  const prevIssue = ssbSeries[1] || null;
  const oldestSsbYear = Number(
    String(ssbSeries[ssbSeries.length - 1]?.issueDate || "2015").slice(0, 4),
  );

  const ssbHistory = {
    yr1: summarizeWindow(
      ssbSeries.slice(0, 12).map((x) => x.year10Return),
      currentIssue.year10Return,
    ),
    yr5: summarizeWindow(
      ssbSeries.slice(0, 60).map((x) => x.year10Return),
      currentIssue.year10Return,
    ),
    allTime: summarizeWindow(
      ssbSeries.map((x) => x.year10Return),
      currentIssue.year10Return,
      { sinceYear: oldestSsbYear },
    ),
    deltaPrev: prevIssue
      ? roundPct(currentIssue.year10Return - prevIssue.year10Return)
      : 0,
    recent6: ssbSeries
      .slice(0, 6)
      .reverse()
      .map((x) => ({
        code: x.trancheCode,
        label: shortMonthLabel(x.issueDate),
        rate: x.year10Return,
      })),
  };

  const sixMonthList = tbillAuctions.filter(
    (r) => Number(r.auction_tenor) === 0.5 && Number(r.cutoff_yield) > 0,
  );
  const sixMonthCompleted = sixMonthList[0];
  const sixMonthPrev = sixMonthList[1] || null;
  const sixMonthUpcoming = tbillAuctions
    .filter(
      (r) =>
        Number(r.auction_tenor) === 0.5 &&
        (!r.cutoff_yield || Number(r.cutoff_yield) === 0) &&
        (!sixMonthCompleted ||
          String(r.auction_date) > String(sixMonthCompleted.auction_date)),
    )
    .sort((a, b) =>
      String(a.auction_date).localeCompare(String(b.auction_date)),
    )[0];

  const oneYearList = tbillAuctions.filter(
    (r) => Number(r.auction_tenor) === 1 && Number(r.cutoff_yield) > 0,
  );
  const oneYearCompleted = oneYearList[0];
  const oneYearPrev = oneYearList[1] || null;
  const oneYearUpcoming = tbillAuctions
    .filter(
      (r) =>
        Number(r.auction_tenor) === 1 &&
        (!r.cutoff_yield || Number(r.cutoff_yield) === 0) &&
        (!oneYearCompleted ||
          String(r.auction_date) > String(oneYearCompleted.auction_date)),
    )
    .sort((a, b) =>
      String(a.auction_date).localeCompare(String(b.auction_date)),
    )[0];

  if (!sixMonthCompleted || !oneYearCompleted) {
    throw new Error("Missing completed 6M or 1Y T-bill auction records");
  }

  const sixCutoff = roundPct(sixMonthCompleted.cutoff_yield);
  const oldestSixYear = Number(
    String(sixMonthList[sixMonthList.length - 1]?.auction_date || "2021").slice(
      0,
      4,
    ),
  );
  const sixHistory = {
    yr1: summarizeWindow(
      sixMonthList.slice(0, 26).map((x) => roundPct(x.cutoff_yield)),
      sixCutoff,
    ),
    multiYear: summarizeWindow(
      sixMonthList.map((x) => roundPct(x.cutoff_yield)),
      sixCutoff,
      { sinceYear: oldestSixYear },
    ),
    deltaPrev: sixMonthPrev
      ? roundPct(sixCutoff - roundPct(sixMonthPrev.cutoff_yield))
      : 0,
    recent6: sixMonthList
      .slice(0, 6)
      .reverse()
      .map((x) => ({
        code: x.issue_code,
        label: shortDayMonthLabel(x.auction_date),
        rate: roundPct(x.cutoff_yield),
      })),
  };

  const oneCutoff = roundPct(oneYearCompleted.cutoff_yield);
  const oneHistory = {
    yr1: summarizeWindow(
      oneYearList.slice(0, 4).map((x) => roundPct(x.cutoff_yield)),
      oneCutoff,
    ),
    deltaPrev: oneYearPrev
      ? roundPct(oneCutoff - roundPct(oneYearPrev.cutoff_yield))
      : 0,
  };

  const now = new Date();
  const asOfDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const payload = {
    source: "Monetary Authority of Singapore (eservices.mas.gov.sg)",
    fetchedAt: now.toISOString(),
    asOfDate,
    ssb: {
      issueCode: currentIssue.issueCode,
      trancheCode: currentIssue.trancheCode,
      annDate: currentIssue.annDate,
      lastDayToApply: currentIssue.lastDayToApply,
      issueDate: currentIssue.issueDate,
      maturityDate: currentIssue.maturityDate,
      issueSizeM: currentIssue.issueSizeM,
      year1Coupon: currentIssue.year1Coupon,
      year1Return: currentIssue.year1Return,
      year5Return: currentIssue.year5Return,
      year10Coupon: currentIssue.year10Coupon,
      year10Return: currentIssue.year10Return,
      prevTrancheCode: prevIssue ? prevIssue.trancheCode : null,
      prevYear10Return: prevIssue ? prevIssue.year10Return : null,
      history: ssbHistory,
    },
    tbills: {
      sixMonth: {
        issueCode: sixMonthCompleted.issue_code,
        auctionDate: sixMonthCompleted.auction_date,
        issueDate: sixMonthCompleted.issue_date,
        maturityDate: sixMonthCompleted.maturity_date,
        cutoffYield: sixCutoff,
        medianYield: roundPct(sixMonthCompleted.median_yield),
        avgYield: roundPct(sixMonthCompleted.avg_yield),
        bidToCover: roundPct(sixMonthCompleted.bid_to_cover),
        nextIssueCode: sixMonthUpcoming?.issue_code || null,
        nextAuctionDate: sixMonthUpcoming?.auction_date || null,
        nextIssueSizeM: sixMonthUpcoming
          ? Number(sixMonthUpcoming.auction_amt) || null
          : null,
        history: sixHistory,
      },
      oneYear: {
        issueCode: oneYearCompleted.issue_code,
        auctionDate: oneYearCompleted.auction_date,
        issueDate: oneYearCompleted.issue_date,
        maturityDate: oneYearCompleted.maturity_date,
        cutoffYield: oneCutoff,
        medianYield: roundPct(oneYearCompleted.median_yield),
        avgYield: roundPct(oneYearCompleted.avg_yield),
        bidToCover: roundPct(oneYearCompleted.bid_to_cover),
        nextIssueCode: oneYearUpcoming?.issue_code || null,
        nextAuctionDate: oneYearUpcoming?.auction_date || null,
        history: oneHistory,
      },
    },
  };

  // Validate model.js marker before writing either file so assets/mas-rates.json
  // and DEFAULT_MAS_LIVE_RATES cannot silently diverge on format shifts.
  const modelPath = path.resolve("model.js");
  const modelSrc = await readFile(modelPath, "utf8");
  const markerRe =
    /const DEFAULT_MAS_LIVE_RATES = \{[\s\S]*?\n  \};\n\n  function normalizeMasRates/;
  if (!markerRe.test(modelSrc)) {
    throw new Error(
      "Could not locate DEFAULT_MAS_LIVE_RATES marker in model.js; sync aborted.",
    );
  }
  const indented = JSON.stringify(payload, null, 2)
    .split("\n")
    .map((line, idx) => (idx === 0 ? line : `  ${line}`))
    .join("\n");
  const updatedModel = modelSrc.replace(
    markerRe,
    () =>
      `const DEFAULT_MAS_LIVE_RATES = ${indented};\n\n  function normalizeMasRates`,
  );
  const outPath = path.resolve("assets/mas-rates.json");
  await writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await writeFile(modelPath, updatedModel, "utf8");

  console.log(
    `Updated ${outPath} & DEFAULT_MAS_LIVE_RATES: SSB ${payload.ssb.trancheCode} (${payload.ssb.year10Return}% 10Y avg, ${payload.ssb.history.yr1?.percentile ?? "n/a"}th pct 12M), 6M T-Bill ${payload.tbills.sixMonth.issueCode} (${payload.tbills.sixMonth.cutoffYield}%, ${payload.tbills.sixMonth.history.yr1?.percentile ?? "n/a"}th pct 12M).`,
  );
}

main().catch((err) => {
  console.error("Failed to fetch MAS rates:", err?.message || err);
  process.exitCode = 1;
});
