const priorities = [
  {
    name: "High-interest debt paydown",
    scope: "Credit cards and personal loans above 4% APR",
    return: "6%–28% p.a.",
    returnBasis: "Risk-free return equals the APR saved",
    protection: "100% guaranteed savings on interest avoided",
    sweetSpot: "S$0 consumer debt; keep mortgages below 2.6%–3%",
    rationale:
      "The supplied guide ranks this first because consumer debt can cost 15%–26% in interest, a return investments cannot reliably beat risk-free.",
  },
  {
    name: "Liquid sovereign & cash buffer",
    scope: "SSB, 6-month T-bills, SGD MMFs and high-yield savings",
    return: "~1.67%–2.39% p.a.",
    returnBasis:
      "Supplied Nov 2026 snapshot: 6-month T-bill 2.07%; SSB 1.83% Year 1 / 2.39% 10-year average",
    protection:
      "Singapore Government-backed for SSB/T-bills; SDIC cover up to S$100,000 per depositor per Scheme member for eligible deposits",
    sweetSpot: "3–6 months of expenses; SSB individual holdings cap S$200,000",
    rationale:
      "A liquid reserve can reduce the chance of selling equities during a job loss or market fall. Keep enough accessible cash for near-term needs.",
  },
  {
    name: "CPF RSTU cash top-up",
    scope: "Self or eligible family member; SA/RA/MA rules apply",
    return: "4.0%–5.0% p.a. risk-free",
    returnBasis: "First S$60,000 combined earns extra 1%",
    protection:
      "Potential dollar-for-dollar tax relief up to S$8,000 self + S$8,000 family, subject to eligibility and limits",
    sweetSpot:
      "S$8,000/year to self until SA reaches S$220,400 FRS or MA reaches S$79,000 BHS (2026 figures)",
    rationale:
      "The supplied guide ranks this for eligible savers who value tax relief and CPF interest. The top-up is less liquid than cash investments.",
  },
  {
    name: "SRS contribution + global equity deployment",
    scope:
      "Contribute to SRS, then invest the balance rather than leaving it idle",
    return: "~6.5%–8.5% p.a. when invested in low-cost global index funds",
    returnBasis: "Long-term estimate supplied in the guide",
    protection:
      "Tax relief up to S$15,300/year for Citizens/PRs or S$35,700 for foreigners, subject to the overall personal relief cap",
    sweetSpot:
      "S$15,300/year at taxable income S$80k–S$120k+; supplied guide suggests ~S$400k total balance by age 63",
    rationale:
      "Do not assume the illustrated S$400,000 balance produces zero tax in every case. The supplied S$40,000/year, 10-year draw example assumes no other income and depends on the applicable withdrawal rules and tax position.",
  },
  {
    name: "Core global equity ETFs (cash)",
    scope: "Ireland-domiciled UCITS via IBKR, such as VWRA",
    return: "~7.0%–9.0% p.a.",
    returnBasis: "Long-term total return estimate supplied in the guide",
    protection:
      "15% US dividend withholding tax versus 30% on US ETFs; daily liquidity; zero US estate tax claim supplied for this structure",
    sweetSpot:
      "Core wealth engine: 60%–90% of liquid investable net worth for a 10+ year horizon",
    rationale:
      "The supplied guide cites low fee drag (~0.19% TER and S$0 platform fee), inflation protection and liquidity. Verify fund, broker and tax details before relying on them.",
  },
  {
    name: "CPF Voluntary Contribution (VC3A)",
    scope:
      "All-account top-up; most relevant to self-employed or late-career savers",
    return: "~2.5%–4.0% p.a. blended",
    returnBasis: "OA 2.5%; SA/MA 4.0% as stated in the supplied guide",
    protection:
      "Singapore Government-backed; tax relief only for eligible self-employed MediSave contributions",
    sweetSpot:
      "Up to S$37,740 annual CPF limit less mandatory CPF, subject to eligibility",
    rationale:
      "The supplied guide ranks this below RSTU and liquid global equities for many salaried savers because VC3A can direct part of the money to OA and generally has no tax relief.",
  },
  {
    name: "CPF LIFE Enhanced Retirement Sum (ERS) top-up",
    scope: "At or after age 55",
    return: "~6.4%–6.5% p.a. lifelong payout from age 65",
    returnBasis: "Supplied estimate: ~S$3,180–S$3,440/month on 2026 ERS",
    protection:
      "Singapore Government-backed longevity annuity; zero fees and risk-pooling as described in the supplied guide",
    sweetSpot:
      "Top up from FRS S$220,400 to ERS S$440,800 (2026); S$456,400 (2027)",
    rationale:
      "The supplied guide places this later because top-ups exchange liquid cash for higher lifelong CPF LIFE payouts.",
  },
  {
    name: "Flexible robo / income portfolios",
    scope: "Endowus, Syfe and AutoWealth examples in the supplied guide",
    return: "~3.5%–5.0% income / ~6.5%–8.5% equity p.a.",
    returnBasis: "Estimates supplied; not capital guaranteed",
    protection: "Full liquidity stated as 3–5 days; not capital guaranteed",
    sweetSpot:
      "10%–25% of liquid portfolio, or CPF-OA surplus above S$20,000 via eligible platforms",
    rationale:
      "The supplied guide suggests these for CPF-OA investing or bridging pre-65 income when users prefer managed rebalancing. Fees and withdrawal timing vary by product.",
  },
  {
    name: "Private annuities & participating endowments",
    scope: "AIA Retirement Saver IV and Singlife Flexi Life Income examples",
    return: "~2.15%–3.52% projected IRR",
    returnBasis: "Guaranteed portion stated as ~0.7%–1.5%",
    protection:
      "Capital guaranteed at maturity only; early surrender may involve substantial losses",
    sweetSpot:
      "S$0 for disciplined investors; supplied guide suggests a 10%–15% maximum only after CPF ERS, SSB and SRS are full",
    rationale:
      "The supplied guide flags commissions and 15–25 year lock-ins. Compare the guaranteed and non-guaranteed portions, fees and surrender values in the policy illustration.",
  },
  {
    name: "High-fee bank robos & ILPs",
    scope: "DBS digiPortfolio, OCBC Robo and investment-linked policies",
    return: "~1.5%–4.0% p.a. lag versus index benchmarks",
    returnBasis: "Underperformance estimate supplied in the guide",
    protection: "No capital guarantee stated; ILPs may have punitive lock-ins",
    sweetSpot: "S$0 (avoid entirely), as ranked in the supplied guide",
    rationale:
      "The supplied guide attributes the ranking to recurring 0.75%–3.5% fee drag. Compare current fees, risks and services on their own merits before deciding.",
  },
];

const sourceLinks = [
  [
    "CPF cash top-up tax relief",
    "https://www.cpf.gov.sg/service/article/how-much-tax-relief-can-i-enjoy-when-i-make-cash-top-ups",
  ],
  [
    "IRAS SRS contribution relief",
    "https://www.iras.gov.sg/taxes/individual-income-tax/basics-of-individual-income-tax/special-tax-schemes/srs-contributions",
  ],
  [
    "IRAS SRS withdrawal tax",
    "https://www.iras.gov.sg/taxes/individual-income-tax/basics-of-individual-income-tax/special-tax-schemes/tax-on-srs-withdrawals",
  ],
  [
    "MAS Singapore Savings Bonds",
    "https://www.mas.gov.sg/bonds-and-bills/investing-in-singapore-savings-bonds",
  ],
  [
    "MAS Treasury Bills statistics",
    "https://www.mas.gov.sg/bonds-and-bills/treasury-bills-statistics",
  ],
  ["SDIC deposit insurance", "https://www.sdic.org.sg/di_faq/"],
];

export function buildPriorityGuideView() {
  return `<header class="fin-page-header priority-guide-header">
    <div class="fin-header-copy">
      <h1>Priority guide</h1>
      <p>A general order for extra cash. Your next step depends on debt costs, emergency needs, eligibility, tax position, liquidity and time horizon.</p>
    </div>
  </header>
  <section class="priority-guide-sheet card-surface" aria-labelledby="priority-guide-list-title">
    <div class="priority-guide-intro">
      <h2 id="priority-guide-list-title">Master priority waterfall</h2>
      <p>Reference estimates supplied for this guide. Rates and product terms are not synced to live data and are not personalized recommendations. Confirm current terms and eligibility before acting.</p>
    </div>
    <ol class="priority-guide-list">
      ${priorities
        .map(
          (item, index) => `<li>
            <details class="priority-guide-row">
              <summary>
                <span class="priority-guide-rank" aria-label="Priority ${index + 1}">${index + 1}</span>
                <span class="priority-guide-main">
                  <strong>${item.name}</strong>
                  <span>${item.scope}</span>
                </span>
                <span class="priority-guide-return">
                  <small>Reference return</small>
                  <strong>${item.return}</strong>
                </span>
                <span class="priority-guide-chevron" aria-hidden="true"></span>
              </summary>
              <div class="priority-guide-detail">
                <dl>
                  <div><dt>Basis</dt><dd>${item.returnBasis}</dd></div>
                  <div><dt>Tax &amp; protection</dt><dd>${item.protection}</dd></div>
                  <div><dt>Sweet spot</dt><dd>${item.sweetSpot}</dd></div>
                  <div><dt>Why it ranks here</dt><dd>${item.rationale}</dd></div>
                </dl>
              </div>
            </details>
          </li>`,
        )
        .join("")}
    </ol>
    <details class="priority-guide-sources">
      <summary>Sources &amp; how to use this guide</summary>
      <div class="priority-guide-source-body">
        <p>Official links below help confirm scheme rules, caps and current product data. They do not validate the guide’s return estimates or ranking. Investment return estimates and product examples remain those supplied for this reference.</p>
        <ul>${sourceLinks
          .map(
            ([label, href]) =>
              `<li><a href="${href}" target="_blank" rel="noopener noreferrer">${label} ↗</a></li>`,
          )
          .join("")}</ul>
      </div>
    </details>
  </section>`;
}
