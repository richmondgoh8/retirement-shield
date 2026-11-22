import { m, html, raw, formatMoneyInput } from "./format.js";

function getCashItemTags(item) {
  const tags = [];
  const reqText =
    `${item.requirements || ""} ${item.rateDetail || ""}`.toLowerCase();
  if (
    reqText.includes("srs") ||
    item.category === "gov" ||
    item.category === "fd-mmf"
  ) {
    tags.push({ key: "srs", label: "SRS Eligible" });
  }
  if (
    item.protectionTone === "good" ||
    item.protectionTone === "gov" ||
    item.protectionTone === "sdic"
  ) {
    tags.push({
      key: "safe",
      label:
        item.category === "gov" || item.protectionTone === "gov"
          ? "SG Gov Backed"
          : "SDIC $100k",
    });
  }
  if (
    (item.liquidity || "").toLowerCase().includes("t+0") ||
    item.category === "hysa"
  ) {
    tags.push({ key: "t0", label: "Same-Day T+0" });
  }
  return tags;
}

const cashProductCategory = (item) =>
  item.category !== "fd-mmf"
    ? item.category
    : item.categoryLabel === "Fixed Deposit"
      ? "fd"
      : "mmf";

function cashProductIsStale(cp, item) {
  const asOf = new Date(`${cp.masAsOfDate}T00:00:00Z`);
  const deadline =
    item?.id === "ssb"
      ? item.metaBadge?.match(/Closes\s+(.+)$/)?.[1]
      : item?.id === "tbills"
        ? item.rateTiers?.find((tier) => tier.label.startsWith("Next 6M"))
            ?.value
        : null;
  const dateMatch = deadline?.match(
    /^(\d{1,2})\s+([A-Za-z]{3})(?:\s+(\d{4}))?$/,
  );
  const month = dateMatch
    ? new Date(`${dateMatch[2]} 1, 2000`).getMonth()
    : null;
  if (!dateMatch || month === null || !Number.isFinite(asOf.getTime()))
    return false;
  const year = Number(dateMatch[3] || asOf.getUTCFullYear());
  const deadlineIso = new Date(Date.UTC(year, month, Number(dateMatch[1])))
    .toISOString()
    .slice(0, 10);
  const todaySg = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return deadlineIso < todaySg;
}

function buildCashFreshnessHTML(cp, item) {
  // Bank reference rates are tracked by month; MAS products expire on their
  // next issue/auction date, not on a generic age-of-data threshold.
  const staticRate = item && item.category !== "gov";
  const asOf = new Date(`${cp.masAsOfDate}T00:00:00Z`);
  const label = staticRate
    ? "Nov 2026"
    : Number.isFinite(asOf.getTime())
      ? asOf.toLocaleDateString("en-SG", {
          day: "numeric",
          month: "short",
          timeZone: "UTC",
        })
      : cp.asOf;
  return html`<span class="cash-rate-date"
    >Rates as of
    ${label}${cashProductIsStale(cp, item) ? raw(' <span class="status-pill is-warn">Newer data available · Sync MAS</span>') : ""}</span
  >`;
}

function buildCashHistoricalDetail(item) {
  if (!item.rateContext) return "";
  const rc = item.rateContext;
  const bars = rc.recent6 || [];
  const minB = Math.min(...bars.map((b) => b.rate), rc.yr1.min);
  const maxB = Math.max(...bars.map((b) => b.rate), rc.yr1.max);
  const spanB = Math.max(0.01, maxB - minB);
  const minAvgPos = Math.max(
    4,
    Math.min(
      96,
      Math.round(
        ((rc.yr1.avg - rc.yr1.min) / Math.max(0.01, rc.yr1.max - rc.yr1.min)) *
          100,
      ),
    ),
  );
  return html`<div class="cash-hist-box">
    <div class="cash-hist-head">
      <span class="cash-hist-verdict is-${rc.tone}"
        >${rc.verdict
          .split(" · ")[0]
          .replace("Strong vs 12M", "Near 12M high")
          .replace(/\bpct\b/g, "percentile")}</span
      >
      ${rc.prevLabel ? raw(html`<span class="cash-hist-delta ${rc.deltaPrev >= 0 ? "is-up" : "is-down"}">${Math.abs(rc.deltaPrev).toFixed(2)} pts ${rc.deltaPrev < 0 ? "below" : "above"} previous ${item.id === "tbills" ? "auction" : "tranche"} (${rc.prevLabel.match(/\(([^)]+)\)/)?.[1] || ""})</span>`) : ""}
    </div>
    <div class="cash-hist-range">
      <div class="cash-hist-range-labels">
        <span>12M low ${rc.yr1.min.toFixed(2)}%</span>
        <span>12M avg ${rc.yr1.avg.toFixed(2)}%</span>
        <span>high ${rc.yr1.max.toFixed(2)}%</span>
      </div>
      <div class="cash-hist-track" aria-hidden="true">
        <span
          class="cash-hist-avg-mark"
          style="left:${minAvgPos}%"
          title="12M avg"
        ></span>
        <span class="cash-hist-dot" style="left:${rc.yr1.posPct}%"></span>
      </div>
      ${rc.longTerm ? raw(html`<div class="cash-hist-long">${rc.longTerm.label}: ${rc.longTerm.min.toFixed(2)}%–${rc.longTerm.max.toFixed(2)}% (avg ${rc.longTerm.avg.toFixed(2)}% · ${rc.longTerm.pctText?.replace(/\bpct\b/g, "percentile") || rc.longTerm.percentile + "th percentile"})</div>`) : ""}
    </div>
    ${
      bars.length
        ? raw(
            html`<div
              class="cash-hist-spark"
              role="group"
              aria-label="Last ${bars.length} tranches. Current ${bars[bars.length - 1].rate.toFixed(2)} percent. 12-month low ${rc.yr1.min.toFixed(2)} percent, average ${rc.yr1.avg.toFixed(2)} percent, high ${rc.yr1.max.toFixed(2)} percent."
            >
              ${bars.map((b, bi) => {
                const yPct = Math.max(
                  2,
                  Math.min(98, 98 - Math.round(((b.rate - minB) / spanB) * 96)),
                );
                const isCur = bi === bars.length - 1;
                return raw(
                  html`<div
                    class="cash-spark-col${isCur ? " is-current" : ""}"
                    title="${b.code}: ${b.rate.toFixed(2)}%"
                  >
                    <span class="cash-spark-val">${b.rate.toFixed(2)}</span>
                    <span class="cash-spark-plot"
                      ><i style="top:${yPct}%"></i
                    ></span>
                    <span class="cash-spark-lbl">${b.label}</span>
                  </div>`,
                );
              })}
            </div>`,
          )
        : ""
    }
    <p class="cash-hist-action">
      ${rc.action
        .replace(
          "apply now if holding excess cash, then redeem & swap if a future tranche jumps",
          "monthly redemption is available",
        )
        .replace(
          "apply now and swap if rates climb later",
          "monthly redemption is available",
        )
        .replace(
          "stagger across 2–4 fortnightly auctions or place a competitive floor bid",
          "a staggered ladder can span 2–4 fortnightly auctions",
        )
        .replace("Locked 6m to maturity: compare vs", "Compare vs")
        .replace("Locked 6m below 12M avg", "Below the 12M average")
        .replace(" & bid competitively if you want a min yield", "")
        .replace(
          "Check HYSA/MMF liquidity or set a competitive min bid before committing.",
          "",
        )
        .replace(
          "Consider splitting tranches or keeping instant cash in a higher-yielding HYSA while waiting.",
          "",
        )}
    </p>
  </div>`;
}

function buildCashProductDetail(cp, item, layout = "table") {
  const history = buildCashHistoricalDetail(item);
  const extraTags = layout === "table" ? "" : buildCashExtraTags(item);
  return html`<div class="cash-product-detail-body">
    <div class="cash-product-detail-notes">
      ${
        layout === "mobile"
          ? raw(
              html`<p>${item.provider} · ${item.categoryLabel}</p>
                <p>${item.capLabel} · ${item.liquidity}</p>`,
            )
          : ""
      }
      ${extraTags ? raw(html`<div class="cash-product-extra-tags">${raw(extraTags)}</div>`) : ""}
      ${layout !== "table" && item.metaBadge ? raw(html`<p class="cash-product-meta">${item.metaBadge}</p>`) : ""}
      ${
        item.rateTiers?.length
          ? raw(
              html`<dl class="cash-rate-rows">
                ${item.rateTiers
                  .filter((tier) => !tier.label.startsWith("Next 6M"))
                  .map((tier) =>
                    raw(
                      html`<div class="cash-rate-row">
                        <dt>${tier.label}</dt>
                        <dd>${tier.value}</dd>
                      </div>`,
                    ),
                  )}
              </dl>`,
            )
          : ""
      }
      ${
        item.id === "tbills" &&
        item.rateTiers?.some((tier) => tier.label.startsWith("Next 6M"))
          ? raw(
              html`<p class="cash-next-auction">
                <strong>Next auction:</strong>
                ${item.rateTiers.find((tier) => tier.label.startsWith("Next 6M")).value}
              </p>`,
            )
          : ""
      }
      ${
        item.id === "ocbc-360"
          ? ""
          : [item.rateDetail, item.requirements]
              .filter(Boolean)
              .filter((note, index, notes) => notes.indexOf(note) === index)
              .map((note) => raw(html`<p>${note}</p>`))
      }
    </div>
    ${raw(history)}
    ${
      layout !== "card"
        ? raw(
            html`<div class="cash-product-detail-footer">
              ${raw(buildCashFreshnessHTML(cp, item))}
              <a
                href="${item.url}"
                target="_blank"
                rel="noopener noreferrer"
                class="text-button cash-verify"
                aria-label="Verify live rates for ${item.name} (opens in a new tab)"
                >Verify live rates ↗</a
              >
            </div>`,
          )
        : ""
    }
  </div>`;
}

const buildCashExtraTags = (item) =>
  getCashItemTags(item)
    .filter(({ key }) => key !== "safe")
    .map(
      ({ key, label }) => html`<span class="ui-tag is-${key}">${label}</span>`,
    )
    .join("");

function buildCashProductTags(item, table = false) {
  const protection =
    item.category === "gov" || item.protectionTone === "gov"
      ? "SG Gov Backed"
      : item.protection;
  const secondary = getCashItemTags(item).find(({ key }) => key !== "safe");
  return html`<span class="cash-product-tags">
    <span
      class="cash-safety-pill is-${item.protectionTone}"
      title="${item.protection}"
      >${protection}</span
    >
    ${table && secondary ? raw(html`<span class="ui-tag is-${secondary.key}" title="${secondary.label}"><span aria-hidden="true">${secondary.key === "srs" ? "SRS" : "T+0"}</span><span class="sr-only">${secondary.label}</span></span>`) : ""}
  </span>`;
}

const cashRateBasis = {
  ssb: "Coupon / 10Y average",
  tbills: "Auction cut-off",
  "ocbc-360": "Effective interest rate",
  "uob-one": "Effective interest rate",
  "dbs-multiplier": "Interest rate range",
  gxs: "Interest rate range",
  maribank: "Base / bonus interest",
  "trust-bank": "Base / bonus interest",
  "fd-cimb": "Deposit rate range",
  "fd-ocbc": "Promotional deposit rate",
  "fd-uob": "Promotional deposit rate",
  "fullerton-sgd": "Gross yield / net return",
  "lionglobal-mmf": "Yield to maturity / net return",
  "mari-invest": "Yield to maturity / net return",
  "chocolate-finance": "Rate by balance",
  "syfe-cash": "Rate by product",
  "endowus-cash": "Net return range",
  "phillip-mms": "Annualised yield",
};

function cashConditionLabel(item) {
  return item.metaBadge || item.requirements.split(/[.;]/, 1)[0];
}

function buildCashHeadline(item) {
  // Keep every headline verbatim. Highlight the existing qualifier without moving it.
  const parts = item.rateHeadline.split(/(up to )/i);
  return html`<span class="cash-headline-text"
      >${parts.map((part) =>
        /^up to $/i.test(part)
          ? raw(html`<span class="cash-rate-ceiling">${part}</span>`)
          : part,
      )}</span
    ><span class="cash-rate-basis">${cashRateBasis[item.id]}</span>`;
}

function singleCashHeadlineRate(item) {
  const rates = item.rateHeadline.match(/\d+(?:\.\d+)?\s*%/g);
  return rates?.length === 1 ? Number.parseFloat(rates[0]) : null;
}

// Earliest advertised access, with the original liquidity descriptions retained.
const cashLiquidityOrder = [
  ["Instant access", "Instant (Main/Pockets)", "Instant up to $10k/day"],
  ["Same-day up to $30k"],
  [
    "T+1 Flexi / 3–12m locked",
    "T+1 to T+3 business days",
    "Market hours + T+2",
  ],
  ["2–4 working days"],
  ["Monthly exit, no penalty"],
  [
    "3–12m lock-in",
    "6–10m lock-in",
    "6–12m lock-in",
    "Locked to maturity (6m/1y)",
  ],
];

function buildCashCardsMarkup(cp, options) {
  const { filter, search, tag, view, sort, direction, expanded } = options;
  const q = search.trim().toLowerCase();
  const items = (cp?.catalog?.items || []).filter((it) => {
    if (filter !== "all" && cashProductCategory(it) !== filter) return false;
    const tags = getCashItemTags(it);
    if (tag !== "all" && !tags.some((t) => t.key === tag)) return false;
    return [
      it.name,
      it.provider,
      it.categoryLabel,
      it.rateHeadline,
      it.protection,
      it.requirements,
      it.liquidity,
      ...tags.map((t) => t.label),
    ]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });

  if (!items.length) {
    return html`<div class="cash-empty-state card-surface" role="status">
      <p>No products match <strong>"${search.trim() || tag}"</strong>.</p>
      <button type="button" class="button button-small" data-cash-reset-filters>
        Reset filters
      </button>
    </div>`;
  }

  if (sort === "rate") {
    items.sort((a, b) => {
      const left = singleCashHeadlineRate(a);
      const right = singleCashHeadlineRate(b);
      if (left === null) return right === null ? 0 : 1;
      if (right === null) return -1;
      return direction * (left - right);
    });
  } else if (sort === "liquidity") {
    const rank = (item) => {
      const index = cashLiquidityOrder.findIndex((group) =>
        group.includes(item.liquidity),
      );
      return index < 0 ? cashLiquidityOrder.length : index;
    };
    items.sort((a, b) => direction * (rank(a) - rank(b)));
  }

  if (view === "cards") {
    return html`<div class="cash-product-grid">
      ${items.map((item) =>
        raw(
          html`<article class="card-surface cash-product-card">
            <h3>${item.name}</h3>
            <p class="cash-product-issuer">${item.provider}</p>
            <div class="cash-product-rate">${raw(buildCashHeadline(item))}</div>
            ${raw(buildCashProductTags(item))}
            <p class="cash-product-secondary">
              ${item.liquidity} · ${item.capLabel}
            </p>
            ${raw(buildCashFreshnessHTML(cp, item))}
            <div class="cash-card-actions">
              <a
                href="${item.url}"
                target="_blank"
                rel="noopener noreferrer"
                class="text-button cash-verify cash-card-verify"
                aria-label="Verify live rates for ${item.name} (opens in a new tab)"
                >Verify live rates ↗</a
              >
              <button
                type="button"
                class="text-button cash-product-toggle cash-card-detail-toggle"
                data-cash-product="${item.id}"
                aria-expanded="${expanded.has(item.id)}"
                aria-controls="cash-product-${item.id}"
              >
                <span class="cash-detail-label"
                  ><span class="sr-only">${item.name} </span>Details</span
                >
                <span class="cash-chevron" aria-hidden="true"></span>
              </button>
            </div>
            ${expanded.has(item.id) ? raw(html`<div id="cash-product-${item.id}">${raw(buildCashProductDetail(cp, item, "card"))}</div>`) : raw(html`<div id="cash-product-${item.id}" hidden></div>`)}
          </article>`,
        ),
      )}
    </div>`;
  }

  const sortState = direction > 0 ? "ascending" : "descending";
  const sortButton = (key, label, mobile = false) =>
    html`<button
      type="button"
      data-cash-sort="${key}"
      ${mobile ? raw(html`aria-pressed="${sort === key}"`) : ""}
      title="${key === "rate" ? "Sort single published percentages" : "Sort by earliest advertised access"}"
    >
      ${label}
      <span aria-hidden="true"
        >${sort === key ? (direction > 0 ? "↑" : "↓") : "↕"}</span
      >
      ${mobile && sort === key ? raw(html`<span class="sr-only">${sortState}</span>`) : ""}
    </button>`;
  const sortHeader = (key, label) =>
    html`<th
      scope="col"
      class="cash-sort-header"
      ${sort === key ? raw(html`aria-sort="${sortState}"`) : ""}
    >
      ${raw(sortButton(key, label))}
    </th>`;
  const disclosure = (item, detailId) =>
    html`<button
      type="button"
      class="cash-product-toggle cash-chevron-button"
      data-cash-product="${item.id}"
      aria-label="Rate details for ${item.name}"
      aria-expanded="${expanded.has(item.id)}"
      aria-controls="${detailId}"
    >
      <span class="cash-chevron" aria-hidden="true"></span>
    </button>`;

  const unsortableRateNames = items
    .filter((item) => singleCashHeadlineRate(item) === null)
    .map((item) => item.name);
  return html`${sort === "rate" ? raw(html`<p class="cash-sort-note">Sorted by the single published headline percentage (including advertised ceilings). Rows without one sortable headline value follow: ${unsortableRateNames.join(", ")}.</p>`) : ""}
    <div class="cash-table-surface card-surface">
      <table class="cash-product-table" aria-label="Cash products">
        <thead>
          <tr>
            <th scope="col">Product</th>
            <th scope="col">Type</th>
            ${raw(sortHeader("rate", "Headline rate"))}
            <th scope="col">Conditions</th>
            <th scope="col">Limit</th>
            ${raw(sortHeader("liquidity", "Liquidity"))}
            <th scope="col">Tags</th>
            <th scope="col" class="cash-chevron-cell">
              <span class="sr-only">Details</span>
            </th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item) => {
            const detailId = `cash-product-${item.id}`;
            const isOpen = expanded.has(item.id);
            return raw(
              html`<tr class="cash-product-row" data-cash-product-row>
                  <th scope="row">
                    ${item.name}<span class="cash-product-issuer"
                      >${item.provider}</span
                    >
                  </th>
                  <td>${item.categoryLabel}</td>
                  <td class="cash-product-rate">
                    ${raw(buildCashHeadline(item))}
                  </td>
                  <td>
                    ${cashConditionLabel(item)}
                    ${cashProductIsStale(cp, item) ? raw('<span class="cash-stale-note">Newer data available · Sync MAS</span>') : ""}
                  </td>
                  <td>${item.capLabel}</td>
                  <td>${item.liquidity}</td>
                  <td class="cash-product-table-tags">
                    ${raw(buildCashProductTags(item, true))}
                  </td>
                  <td class="cash-chevron-cell">
                    ${raw(disclosure(item, detailId))}
                  </td>
                </tr>
                <tr
                  class="cash-detail-row"
                  id="${detailId}"
                  ${isOpen ? "" : "hidden"}
                >
                  <td colspan="8">
                    ${isOpen ? raw(buildCashProductDetail(cp, item)) : ""}
                  </td>
                </tr>`,
            );
          })}
        </tbody>
      </table>
    </div>
    <div class="cash-mobile-comparison card-surface">
      <div
        class="cash-mobile-sort cash-sort-header"
        role="group"
        aria-label="Sort cash products"
      >
        ${raw(sortButton("rate", "Headline rate", true))}
        ${raw(sortButton("liquidity", "Liquidity", true))}
      </div>
      <ul class="cash-mobile-list" aria-label="Cash products">
        ${items.map((item) => {
          const detailId = `cash-list-detail-${item.id}`;
          const isOpen = expanded.has(item.id);
          return raw(
            html`<li>
              <div class="cash-mobile-row" data-cash-product-row>
                <strong>${item.name}</strong>
                <div class="cash-product-rate">
                  ${raw(buildCashHeadline(item))}
                </div>
                ${raw(buildCashProductTags(item))}
                ${raw(disclosure(item, detailId))}
              </div>
              <div
                class="cash-mobile-detail"
                id="${detailId}"
                ${isOpen ? "" : "hidden"}
              >
                ${isOpen ? raw(buildCashProductDetail(cp, item, "mobile")) : ""}
              </div>
            </li>`,
          );
        })}
      </ul>
    </div>`;
}

function buildCashAccountReadoutHTML(acc) {
  if (!acc) return "";
  if (acc.hasOverflow) {
    return `First ${m(acc.tier1Balance)} @ ${acc.bonusRatePct.toFixed(2)}% (${m(acc.tier1AnnualInterest, "/yr")}) · ${m(acc.overflowBalance)} over cap @ ${acc.baseRatePct.toFixed(2)}% (${m(acc.overflowAnnualInterest, "/yr")})`;
  }
  if (acc.bonusCap > 0) {
    const room = Math.max(0, acc.bonusCap - acc.balance);
    return `Within ${m(acc.bonusCap)} bonus cap @ ${acc.bonusRatePct.toFixed(2)}% · ${m(room)} room`;
  }
  return `${acc.sovereignBacked ? "SG Gov Backed" : "Uncapped rate"} @ ${acc.bonusRatePct.toFixed(2)}% p.a.`;
}

function buildCashAccountInterestHTML(acc) {
  return `${m(acc.monthlyInterest, "/mo")} · ${m(acc.annualInterest, "/yr")}${acc.hasOverflow ? ` · ${acc.effectiveRatePct.toFixed(2)}% effective rate (−${acc.rateDragPct.toFixed(2)}% drag)` : ""}`;
}

function buildCashAccountsAlertsHTML(bd) {
  if (!bd) return "";
  const parts = [];
  if (bd.totalOverflowBalance > 0 && Math.round(bd.sweepAnnualGain) > 0) {
    const overList = bd.accounts
      .filter((a) => a.hasOverflow && (a.potentialOverflowGainAnnual || 0) > 0)
      .map(
        (a) =>
          html`<strong>${a.name}</strong> has
            <strong>${raw(m(a.overflowBalance))}</strong> above its
            ${raw(m(a.bonusCap))} cap earning
            <strong>${a.baseRatePct.toFixed(2)}%</strong> (dragging account EIR
            from ${a.bonusRatePct.toFixed(2)}% down to
            <strong>${a.effectiveRatePct.toFixed(2)}%</strong>)`,
      )
      .join("; ");
    parts.push(
      html`<div class="cash-acc-alert is-warn" role="status">
        <div class="cash-acc-alert-copy">
          <strong
            >Bonus Cap Overflow Detected (${raw(m(bd.totalOverflowBalance))}
            earning ${bd.overflowAvgBaseRatePct.toFixed(2)}% base):</strong
          >
          <span
            >${raw(overList)}. Sweeping the overflow into MAS SSB / T-Bills
            (${bd.ssb10YrPct.toFixed(2)}%) lifts your blended cash EIR to
            <strong>${bd.sweptEffectiveRatePct.toFixed(2)}%</strong> (<strong
              >+${raw(m(bd.sweepAnnualGain, "/yr"))}</strong
            >
            extra interest).</span
          >
        </div>
        ${
          bd.sweepAnnualGain > 0
            ? raw(
                html`<button
                  type="button"
                  class="button button-small button-accent cash-acc-sweep-btn"
                  data-cash-acc-sweep
                >
                  Sweep ${raw(m(bd.totalOverflowBalance))} overflow to MAS SSB
                  (+${raw(m(bd.sweepAnnualGain, "/yr"))}) →
                </button>`,
              )
            : ""
        }
      </div>`,
    );
  }
  if (bd.sdicOverflowTotal > 0) {
    const sdicList = bd.sdicExceededBanks
      .map(
        (b) =>
          html`<strong>${b.bankLabel}</strong> combined deposits
            (<strong>${raw(m(b.balance))}</strong>) exceed the $100,000 SDIC
            insured limit by <strong>${raw(m(b.uninsured))}</strong>`,
      )
      .join("; ");
    parts.push(
      html`<div class="cash-acc-alert is-info" role="status">
        <div class="cash-acc-alert-copy">
          <strong>Per-Bank $100k SDIC Coverage Notice:</strong>
          <span
            >${raw(sdicList)}. Note that DBS and POSB share a single $100,000
            SDIC limit.</span
          >
        </div>
      </div>`,
    );
  }
  if (bd.ssbTotal > bd.ssbCap) {
    parts.push(
      html`<div class="cash-acc-alert is-warn" role="status">
        <div class="cash-acc-alert-copy">
          <strong>MAS $200,000 Individual SSB Limit Exceeded:</strong>
          <span
            >Your SSB rows total
            <strong>${raw(m(bd.ssbTotal))}</strong> (${raw(m(bd.ssbOverflow))}
            above the $200,000 MAS individual holding cap). Route excess into
            6-Month MAS T-Bills or a secondary bank.</span
          >
        </div>
      </div>`,
    );
  }
  return parts.join("");
}

function buildCashAccountsEditorHTML(cp) {
  const active = Boolean(cp.cashAccountsActive);
  const bd = cp.cashBreakdown;
  const addButton =
    '<button type="button" class="button button-small" data-cash-acc-add="smart">+ Add account</button>';

  const renderField = (acc, idx, field, label, isMoney) =>
    html`<div class="cash-acc-col">
      <label for="cash-acc-${field}-${idx}">${label}</label>
      <div class="input-wrap">
        ${isMoney ? raw('<span aria-hidden="true">$</span>') : ""}
        <input
          id="cash-acc-${field}-${idx}"
          type="${isMoney ? "text" : "number"}"
          inputmode="decimal"
          ${isMoney ? raw("data-cash-money") : raw('min="0" max="20" step="0.05"')}
          data-cash-acc-field="${field}"
          data-cash-acc-idx="${idx}"
          value="${isMoney ? formatMoneyInput(acc[field]) : acc[field]}"
        />
        ${isMoney ? "" : raw('<span aria-hidden="true">%</span>')}
      </div>
    </div>`;

  return html`<div class="cash-acc-editor">
    <div class="cash-acc-mode-bar">
      <div
        class="cash-acc-mode-tabs"
        role="group"
        aria-label="Cash bucket entry mode"
      >
        <button
          type="button"
          class="qe-picker-chip"
          data-cash-acc-mode="single"
          aria-pressed="${!active}"
        >
          Single figure
        </button>
        <button
          type="button"
          class="qe-picker-chip"
          data-cash-acc-mode="itemized"
          aria-pressed="${active}"
        >
          By account
        </button>
      </div>
      ${active ? raw(addButton) : ""}
    </div>
    ${
      !active
        ? raw(
            html`<p class="cash-acc-single-copy">
              Using one cash and SSB balance of
              <strong>${raw(m(cp.currentCash))}</strong>.
              <button
                type="button"
                class="text-button"
                data-open-settings-field="known-ssb-cash"
              >
                Edit balance
              </button>
            </p>`,
          )
        : raw(
            html`<div id="cash-acc-summary-page" class="cash-account-summary">
                ${bd.accountCount}
                ${bd.accountCount === 1 ? "account" : "accounts"} ·
                ${raw(m(bd.totalAnnualInterest, "/yr"))} total interest
              </div>
              <div id="cash-acc-alerts-page">
                ${raw(buildCashAccountsAlertsHTML(bd))}
              </div>
              <div
                class="cash-acc-list"
                role="group"
                aria-label="Itemized cash accounts"
              >
                ${bd.accounts.map((acc, idx) => {
                  const isFlat = ["ssb", "tbills", "mmf"].includes(acc.preset);
                  const isCustom = acc.preset === "custom";
                  return raw(
                    html`<section
                      class="cash-acc-row"
                      data-cash-acc-row="${idx}"
                      aria-label="Account ${idx + 1}"
                    >
                      <div
                        class="cash-acc-row-top${isCustom ? " is-custom-preset" : ""}"
                      >
                        <div class="cash-acc-col is-preset">
                          <label for="cash-acc-preset-${idx}"
                            >Bank / Vehicle</label
                          >
                          <div class="input-wrap select-wrap">
                            <select
                              id="cash-acc-preset-${idx}"
                              data-cash-acc-field="preset"
                              data-cash-acc-idx="${idx}"
                            >
                              ${RetirementModel.CASH_ACCOUNT_PRESETS.map((preset) => raw(html`<option value="${preset.key}" ${raw(preset.key === acc.preset ? "selected" : "")}>${preset.name || preset.label}</option>`))}
                            </select>
                          </div>
                        </div>
                        ${
                          isCustom
                            ? raw(
                                html`<div class="cash-acc-col is-name">
                                  <label for="cash-acc-name-${idx}"
                                    >Bank / Account name</label
                                  >
                                  <div class="input-wrap">
                                    <input
                                      id="cash-acc-name-${idx}"
                                      type="text"
                                      maxlength="50"
                                      data-cash-acc-field="name"
                                      data-cash-acc-idx="${idx}"
                                      value="${acc.name}"
                                    />
                                  </div>
                                </div>`,
                              )
                            : ""
                        }
                        ${raw(renderField(acc, idx, "balance", "Balance ($)", true))}
                        <button
                          type="button"
                          class="text-button cash-account-remove"
                          data-cash-acc-remove="${idx}"
                          aria-label="Remove ${acc.name}"
                        >
                          Remove
                        </button>
                      </div>
                      <p
                        class="cash-acc-row-readout"
                        data-cash-acc-readout="${idx}"
                      >
                        ${raw(buildCashAccountReadoutHTML(acc))}
                      </p>
                      <details
                        class="cash-customize"
                        data-cash-customize="${acc.id}"
                      >
                        <summary>Customize rates</summary>
                        <div
                          class="cash-acc-row-rules${isFlat ? " is-flat" : ""}"
                        >
                          ${
                            isFlat
                              ? raw(
                                  renderField(
                                    acc,
                                    idx,
                                    "bonusRatePct",
                                    acc.preset === "ssb"
                                      ? "10-year average yield"
                                      : "Annual yield",
                                    false,
                                  ),
                                )
                              : [
                                  raw(
                                    renderField(
                                      acc,
                                      idx,
                                      "bonusCap",
                                      "Bonus cap ($)",
                                      true,
                                    ),
                                  ),
                                  raw(
                                    renderField(
                                      acc,
                                      idx,
                                      "bonusRatePct",
                                      "Rate up to cap",
                                      false,
                                    ),
                                  ),
                                  raw(
                                    renderField(
                                      acc,
                                      idx,
                                      "baseRatePct",
                                      "Rate above cap",
                                      false,
                                    ),
                                  ),
                                ]
                          }
                        </div>
                        <p data-cash-acc-interest="${idx}">
                          ${raw(buildCashAccountInterestHTML(acc))}
                        </p>
                      </details>
                    </section>`,
                  );
                })}
              </div>`,
          )
    }
  </div>`;
}

function buildCashPlanCardHTML(cp) {
  const bd = cp.cashBreakdown;
  const months =
    cp.emergencyMonthlyBase > 0
      ? Math.round(cp.currentCash / cp.emergencyMonthlyBase)
      : null;
  const progress =
    cp.emergencyMax > cp.emergencyMin
      ? Math.min(
          100,
          Math.max(
            0,
            (100 * (cp.currentCash - cp.emergencyMin)) /
              (cp.emergencyMax - cp.emergencyMin),
          ),
        )
      : 0;
  const belowTarget = cp.currentCash < cp.emergencyMin;
  const coverage = belowTarget
    ? "Below target range"
    : cp.currentCash > cp.emergencyMax
      ? "Above target range"
      : "Within target range";
  const purposes = [
    "Instant access",
    "Government-backed",
    "Higher-yield funds",
  ];
  return `<section class="card-surface cash-plan-card" aria-labelledby="cash-layer-title">
    <div class="cash-plan-heading">
      <h2 id="cash-layer-title">Cash buffer</h2>
      <button type="button" class="text-button" data-open-page-cash-accounts aria-controls="cash-accounts">Edit cash accounts</button>
    </div>
    <dl class="cash-plan-stats">
      <div>
        <dt>Emergency target</dt>
        <dd>${m(cp.emergencyMin, "", "cash-em-min")}–${m(cp.emergencyMax, "", "cash-em-max")}</dd>
        <dd class="cash-stat-note">6–12 months at ${m(cp.emergencyMonthlyBase, "/mo")}</dd>
      </div>
      <div>
        <dt>Cash &amp; SSB</dt>
        <dd>${m(cp.currentCash, "", "cash-entered")}</dd>
        ${cp.cashAccountsActive && bd ? `<dd class="cash-stat-note">${bd.effectiveRatePct.toFixed(2)}% blended EIR · ~${m(bd.totalMonthlyInterest, "/mo")}</dd>` : ""}
      </div>
      <div>
        <dt>Monthly cash/bond slice</dt>
        <dd>${m(cp.monthlyCashSlice, "/mo", "cash-monthly-slice")}</dd>
        <dd class="cash-stat-note">${
          cp.monthlyCashSaving > 0
            ? `${m(cp.monthlyCashSaving, "/mo")} cash savings + ${m(cp.monthlyBondSlice, "/mo")} bonds`
            : "Bond slice from Allocator"
        }</dd>
      </div>
    </dl>
    ${
      months === null
        ? ""
        : `<div class="cash-coverage${belowTarget ? " is-below-target" : ""}">
      <p><strong>About ${months} ${months === 1 ? "month" : "months"}</strong> · ${coverage}</p>
      <div class="cash-coverage-range" aria-hidden="true">
        <span>6 months</span><div><i style="left:${progress}%"></i></div><span>12 months</span>
      </div>
    </div>`
    }
    <ul class="cash-purpose-list" aria-label="Suggested allocation of current cash">
      ${cp.tiers
        .map(
          (tier, idx) => `<li${tier.allocated === 0 ? ' class="is-zero"' : ""}>
        <div><strong>${purposes[idx]}</strong><p>${tier.vehicles}</p>
        ${idx === 1 ? `<p>${m(cp.ssbTargetBuffer)} SSB target after the emergency buffer · T-Bills have no individual cap</p>` : ""}
        ${idx === 2 && cp.monthlyCashSaving === 0 && cp.hasSrs ? "<p>Idle SRS earns 0.05%.</p>" : ""}</div>
        <strong>${m(tier.allocated)}</strong>
      </li>`,
        )
        .join("")}
    </ul>
  </section>`;
}

function buildCashOptionsView(cp, options) {
  if (!cp?.catalog) return "";
  const categories = [
    { key: "all", label: "All products" },
    ...cp.catalog.categories.filter(
      ({ key }) => key !== "all" && key !== "fd-mmf",
    ),
    { key: "fd", label: "Fixed deposits" },
    { key: "mmf", label: "MMF & cash management" },
  ];
  const counts = { all: cp.catalog.items.length };
  for (const item of cp.catalog.items) {
    const category = cashProductCategory(item);
    counts[category] = (counts[category] || 0) + 1;
  }
  const tags = [
    { key: "srs", label: "SRS eligible" },
    { key: "safe", label: "SDIC / SG Gov" },
    { key: "t0", label: "Same-day T+0" },
  ];

  return html` <header class="fin-page-header cash-page-header">
      <h1>Cash options</h1>
      <div class="cash-header-sync">
        <span class="cash-mas-date"
          >MAS data date
          <span class="cash-sync-pill"
            >${raw(buildCashFreshnessHTML(cp))}</span
          ></span
        >
        <button
          type="button"
          class="button button-small cash-sync-btn"
          data-cash-sync
        >
          Sync MAS
        </button>
      </div>
    </header>
    <div class="cash-plan-slot">${raw(buildCashPlanCardHTML(cp))}</div>
    <section aria-labelledby="cash-comparison-title">
      <div class="cash-compare-heading">
        <h2 class="cash-comparison-title" id="cash-comparison-title">
          Compare cash products
        </h2>
        <div
          class="cash-view-options"
          role="group"
          aria-label="Comparison view"
        >
          <button
            type="button"
            class="qe-picker-chip"
            data-cash-view="table"
            aria-pressed="${options.view === "table"}"
          >
            Table
          </button>
          <button
            type="button"
            class="qe-picker-chip"
            data-cash-view="cards"
            aria-pressed="${options.view === "cards"}"
          >
            Cards
          </button>
        </div>
      </div>
      <div class="cash-toolbar">
        <div class="cash-search-tag-bar">
          <div class="cash-search-wrap">
            <svg
              class="cash-search-icon"
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              stroke-width="1.75"
              stroke-linecap="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="search"
              id="cash-search-input"
              class="cash-search-input"
              placeholder="Search cash products"
              aria-label="Search cash products"
              value="${options.search}"
            />
            <button
              type="button"
              class="cash-search-clear"
              data-cash-search-clear
              aria-label="Clear search"
              ${raw(options.search ? "" : "hidden")}
            >
              ×
            </button>
          </div>
        </div>
        <details class="cash-filters">
          <summary>
            Product filters <span data-cash-active-filters></span>
          </summary>
          <div
            class="cash-filter-bar"
            role="group"
            aria-label="Filter by product type"
          >
            ${categories.map(({ key, label }) => raw(html`<button type="button" class="qe-picker-chip" data-cash-filter="${key}" aria-pressed="${key === options.filter}">${label} <span class="cash-filter-count">${counts[key] || 0}</span></button>`))}
          </div>
          <div class="cash-tag-bar" role="group" aria-label="Filter by tag">
            ${tags.map(({ key, label }) => raw(html`<button type="button" class="qe-picker-chip" data-cash-tag="${key}" aria-pressed="${options.tag === key}">${label}</button>`))}
          </div>
        </details>
      </div>
      <div class="cash-cards-wrap">
        ${raw(buildCashCardsMarkup(cp, options))}
      </div>
    </section>
    <div class="cash-rules-note" role="note">
      <strong>Key limit reminders (${cp.asOf})</strong>
      <span
        >SDIC insures eligible SGD deposits up to
        <b>$100,000 per depositor, per DI Scheme bank</b> (DBS &amp; POSB share
        one combined $100k limit). MAS Singapore Savings Bonds have a
        <b>$200,000 individual holding cap</b> across all tranches. Money market
        funds and cash-management portfolios are investment products and are
        <b>not SDIC-insured</b>.</span
      >
    </div>`;
}

export {
  buildCashCardsMarkup,
  buildCashAccountReadoutHTML,
  buildCashAccountInterestHTML,
  buildCashFreshnessHTML,
  buildCashAccountsAlertsHTML,
  buildCashAccountsEditorHTML,
  buildCashPlanCardHTML,
  buildCashOptionsView,
};
