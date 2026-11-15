# CPF & Retirement Model Notes

Employee planning model for Singapore citizens and full-rate PRs (starting ages 18–54). All calculations run in the browser; figures are planning illustrations, not personalised CPF Board quotes.

## Core Mechanics

- **Timeline:** Projections start December 2026 (`C.startMonth = 11`); entered age is treated as exact then.
- **CPF interest:** Base and extra interest are computed monthly on eligible balances (without monthly compounding) and credited after December. New contributions earn interest from the following month; deductions lose interest in the deduction month.
- **Extra interest tiers:** Applied in priority order `RA → OA (max $20,000) → SA → MA`, sharing a $60,000 combined cap. OA extra interest goes to SA before 55 and RA from 55. From 55, the first $30,000 earns +2% and the next $30,000 earns +1%.
- **Age-55 SA closure:** SA and OA fund RA up to the cohort Full Retirement Sum (FRS); selecting ERS also earmarks eligible OA. Pre-closure SA interest credits to RA up to FRS, then OA. Top-up room tracks RA principal (excluding RA interest).
- **MediSave & overflow:** 2026 BHS is $79,000 (assumed 5% growth thereafter; fixed at 65). Overflow above BHS routes to SA/RA up to FRS, then OA. Monthly MA deductions exceeding available MA are reported as a separate cash shortfall.
- **Top-up limits & outside reserve:** Pre-55 cash top-ups and OA-to-SA transfers share `FRS − SA − active CPFIS-SA`. Monthly extra CPF savings blocked by legal limits remain in an outside reserve (default 0% return, never CPF's 4%) and transfer when room opens.
- **Salary allocation & post-55 work:** Uses 2026 and announced 2027 CPF age-band tables ($8,000/month ordinary wage ceiling). Optional post-55 contributions stop at retirement or 65; OA remaining at 65 transfers up to FRS for supported cohorts.
- **CPF LIFE & spending presets:** Payouts interpolate from published 2026 male Standard-plan RA-at-65 anchors scaled by `cohortFRS / 220400` (capped at the highest reference anchor). Escalating plan starts at ~80% and rises 2% on payout anniversaries.
- **Today's purchasing power:** Underlying cash flows are nominal; displayed future amounts are discounted by `(1 + inflation)^years` to the event date.

## Verified Official Sources

- [CPF interest rates](https://www.cpf.gov.sg/service/article/what-are-the-cpf-interest-rates) and [computation/crediting](https://www.cpf.gov.sg/service/article/how-is-my-cpf-interest-computed-and-credited-into-my-accounts)
- [Extra interest](https://www.cpf.gov.sg/service/article/how-much-extra-interest-can-i-earn-on-my-cpf-savings) and [SA closure interest](https://www.cpf.gov.sg/service/article/my-special-account-sa-will-be-closed-when-I-turn-age-55-in-the-middle-of-the-year-if-i-have-the-full-retirement-sum-where-does-interest-earned-on-my-sa-before-sa-closure-go-do-I-lose-any-interest-for-the-remaining-months-till-the-end-of-the-year)
- [Retirement sums](https://www.cpf.gov.sg/service/article/what-are-the-retirement-sums-basic-retirement-sum-brs-full-retirement-sum-frs-and-enhanced-retirement-sum-ers), [cohort FRS](https://www.cpf.gov.sg/service/article/how-much-is-my-full-retirement-sum), and [top-up limits](https://www.cpf.gov.sg/service/article/what-is-the-maximum-amount-of-top-ups-i-can-receive)
- [Basic Healthcare Sum](https://www.cpf.gov.sg/service/article/what-is-the-basic-healthcare-sum) and [MA overflow](https://www.cpf.gov.sg/service/article/i-have-saved-the-basic-healthcare-sum-bhs-in-my-medisave-account-what-happens-to-the-savings-in-my-ma-above-the-bhs)
- [2026 allocation rates](https://www.cpf.gov.sg/content/dam/web/employer/employer-obligations/documents/CPFAllocationRatesfromJanuary2026.pdf), [2027 allocation rates](https://cpf.gov.sg/content/dam/web/employer/employer-obligations/documents/jan2027cpfallocationrates.pdf), and [2027 senior contribution changes](https://www.cpf.gov.sg/service/article/what-are-the-changes-to-the-cpf-contribution-rates-for-senior-workers-that-will-take-effect-from-1-january-2027)
- [CPF LIFE](https://www.cpf.gov.sg/member/retirement-income/monthly-payouts/cpf-life), [payout examples](https://www.cpf.gov.sg/service/article/how-much-cpf-payouts-can-i-get-every-month), and [Escalating plan](https://www.cpf.gov.sg/service/article/how-does-the-cpf-life-escalating-plan-work)
- [HDB Community Care Apartments age eligibility](https://www.hdb.gov.sg/hdb-pulse/news/2026/Age-eligibility-for-community-care-apartments-lowered-from-65-to-55-years-old) and [MoneySense life-stage investing](https://www.moneysense.gov.sg/investments/life-stage-investing/)

## Model Boundaries & Excluded Items

- **Assumptions:** Current rates held beyond announced periods, 3.5% FRS growth after 2027, 5% BHS growth after 2026, constant after-fee returns, and no salary growth, bonuses, or career breaks.
- **Excluded costs & proceeds:** Apartment purchase/lease, deposits, moving costs, rent/mortgage, tax relief, government grants, property-backed withdrawals, and longevity beyond age 90.
- **Not personalised pricing:** Payouts above the highest cohort-scaled anchor are capped and labelled as a model reference boundary rather than a statutory maximum.
