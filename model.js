/* Fixed, disclosed planning assumptions; no personal data leaves the browser. */
(function (root) {
  const C = {
    year: 2026,
    inflation: 0.03,
    investmentReturn: 0.04,
    retirementAge: 65,
    endAge: 90,
    frs: 220400,
    sumGrowth: 0.035,
    oaRate: 0.025,
    saRate: 0.04,
    wageCap: 8000,
    escalatingRate: 0.02,
    escalatingRatio: 0.8,
  };
  const table = [
    [0, 0],
    [50000, 490],
    [110200, 950],
    [150000, 1250],
    [220400, 1780],
    [300000, 2380],
    [440800, 3440],
  ];
  function referencePayout(balance, plan = "standard", elapsedYears = 0) {
    const x = Math.max(0, Math.min(2 * C.frs, balance));
    let base = 3440;
    for (let i = 1; i < table.length; i++) {
      if (x <= table[i][0]) {
        const [a, b] = table[i - 1],
          [c, d] = table[i];
        base = b + ((d - b) * (x - a)) / (c - a);
        break;
      }
    }
    if (plan === "escalating") {
      return (
        base *
        C.escalatingRatio *
        (1 + C.escalatingRate) ** Math.max(0, elapsedYears)
      );
    }
    return base;
  }
  const careRows = [
    {
      name: "Housing & utilities",
      now: [180, 250],
      later: [230, 320],
      note: "Paid-up 2-room Flexi flat: S&CC, utilities and routine upkeep. Rent, mortgage and purchase cost excluded.",
    },
    {
      name: "Food & groceries for two",
      now: [800, 1000],
      later: [1050, 1300],
      note: "Meals and groceries for the senior and helper. Helper food is counted here only.",
    },
    {
      name: "Transport",
      now: [120, 180],
      later: [150, 220],
      note: "Senior public transport plus occasional taxis; allow more rides as mobility changes.",
    },
    {
      name: "Healthcare & insurance reserve",
      now: [250, 400],
      later: [500, 850],
      note: "A monthly provision for premiums, medication and visits. Actual cover, subsidies and care needs vary.",
    },
    {
      name: "Helper: salary, levy & non-food costs",
      now: [1150, 1450],
      later: [1500, 1900],
      note: "Includes a normal $300 levy, insurance, checks and a reserve for employment costs. Food stays in the food row.",
    },
    {
      name: "Lifestyle & personal care",
      now: [150, 250],
      later: [200, 300],
      note: "Phone, broadband, haircuts, clothing and social spending.",
    },
  ];
  const ccaRows = [
    { name: "Utilities, upkeep & housing charges", now: 250, later: 250 },
    { name: "Food", now: 500, later: 500 },
    { name: "Transport", now: 180, later: 220 },
    { name: "Healthcare & insurance", now: 400, later: 700 },
    { name: "Basic Service Package provision", now: 220, later: 220 },
    { name: "Extra care & household help", now: 500, later: 1000 },
    { name: "Personal & social spending", now: 250, later: 250 },
    { name: "Contingency", now: 200, later: 200 },
  ];
  const lifestyles = {
    cca: { label: "Community Care Apartments", budget: 2500 },
    "home-helper": { label: "Home + Helper", budget: 3500 },
  };
  function budgetBreakdown(
    lifestyle = "cca",
    total = lifestyles[lifestyle]?.budget,
  ) {
    if (
      !Object.hasOwn(lifestyles, lifestyle) ||
      !Number.isFinite(total) ||
      total < 0
    )
      throw new Error("Choose a preset and a non-negative monthly budget.");
    const source =
      lifestyle === "cca"
        ? ccaRows.map((row, i) => ({
            name: row.name,
            amount: row.now,
            group: [0, 1, 2, 6].includes(i)
              ? "living"
              : i === 7
                ? "buffer"
                : "care",
          }))
        : [
            ...careRows.map((row, i) => ({
              name: row.name,
              amount: (row.now[0] + row.now[1]) / 2,
              group: [3, 4].includes(i) ? "care" : "living",
            })),
            { name: "Planning cushion", amount: 410, group: "buffer" },
          ];
    const rows = source.map((row) => ({
      ...row,
      amount: (row.amount * total) / lifestyles[lifestyle].budget,
    }));
    const groups = [
      { key: "living", label: "Daily living" },
      { key: "care", label: "Health & help" },
      { key: "buffer", label: "Cushion" },
    ].map((group) => ({
      ...group,
      amount: rows
        .filter((row) => row.group === group.key)
        .reduce((sum, row) => sum + row.amount, 0),
    }));
    return { total, rows, groups };
  }
  function careTotals(key = "now") {
    return careRows.reduce(
      (s, row) => [s[0] + row[key][0], s[1] + row[key][1]],
      [0, 0],
    );
  }
  // Match the supplied category midpoints at 65 and ten years later at 75.
  // Keep the $300 levy fixed; model general prices and an additional care-age allowance.
  const careAgeFactor = (age) =>
    ((4260 - 300) / (3090 - 300) / 1.03 ** 10) ** (Math.max(0, age - 65) / 10);
  function expenseAt(
    spend,
    startAge,
    elapsed,
    inflation = C.inflation,
    lifestyle = "home-helper",
  ) {
    const inf = typeof inflation === "number" ? inflation : C.inflation;
    if (lifestyle === "cca") {
      const care = (age) => (3340 / 2500) ** (Math.max(0, age - 65) / 10);
      return (
        (spend * (1 + inf) ** elapsed * care(startAge + elapsed)) /
        care(startAge)
      );
    }
    const levy = Math.min(300, spend);
    return (
      ((spend - levy) *
        (1 + inf) ** elapsed *
        careAgeFactor(startAge + elapsed)) /
        careAgeFactor(startAge) +
      levy
    );
  }
  function portfolioTarget(
    spend,
    income,
    retirementAge,
    endAge = C.endAge,
    opts = {},
  ) {
    const investmentReturn =
      typeof opts === "number"
        ? opts
        : typeof opts.investmentReturn === "number"
          ? opts.investmentReturn
          : C.investmentReturn;
    const inflation =
      typeof opts.inflation === "number" ? opts.inflation : C.inflation;
    const plan = typeof opts === "object" && opts.plan ? opts.plan : "standard";

    const lifestyle =
      typeof opts === "object" && opts.lifestyle === "cca"
        ? "cca"
        : "home-helper";
    const rate = (1 + investmentReturn) ** (1 / 12) - 1;
    let target = 0;
    const totalMonths = Math.round((endAge - retirementAge) * 12);
    for (let m = 1; m <= totalMonths; m++) {
      const t = (m - 1) / 12;
      const currentAge = retirementAge + t;
      let cpf = 0;
      if (currentAge >= 65) {
        const cpfElapsed = currentAge - 65;
        cpf =
          plan === "escalating"
            ? income * C.escalatingRatio * (1 + C.escalatingRate) ** cpfElapsed
            : income;
      }
      target +=
        Math.max(
          0,
          expenseAt(spend, retirementAge, t, inflation, lifestyle) - cpf,
        ) /
        (1 + rate) ** m;
    }
    return target;
  }
  function allocation(age, year = C.year) {
    return age <= 35
      ? [0.6217, 0.1621, 0.37]
      : age <= 45
        ? [0.5677, 0.1891, 0.37]
        : age <= 50
          ? [0.5136, 0.2162, 0.37]
          : age <= 55
            ? [0.4055, 0.3108, 0.37]
            : age <= 60
              ? year >= 2027
                ? [0.3382, 0.3661, 0.355]
                : [0.353, 0.3382, 0.34]
              : year >= 2027
                ? [0.1347, 0.4615, 0.26]
                : [0.14, 0.44, 0.25];
  }
  function calculate(p) {
    const age = Number(p.age),
      salary = Number(p.salary);
    if (!Number.isInteger(age) || age < 18 || age > 54)
      throw new Error(
        "Enter an age from 18 to 54 for this CPF salary illustration.",
      );
    if (!Number.isFinite(salary) || salary <= 750 || salary > 1000000)
      throw new Error(
        "Enter monthly gross salary above $750, before employee CPF.",
      );
    for (const key of ["oa", "sa", "housing", "savings", "spend", "invest"])
      if (
        p[key] != null &&
        (!Number.isFinite(Number(p[key])) || Number(p[key]) < 0)
      )
        throw new Error(
          "Use zero or a positive amount for balances, spending and monthly investments.",
        );
    const lifestyle = p.lifestyle == null ? "cca" : p.lifestyle;
    if (!Object.hasOwn(lifestyles, lifestyle))
      throw new Error("Choose Community Care Apartments or Home + Helper.");
    const retire = p.retire == null ? 65 : Number(p.retire);
    if (lifestyle === "cca" && retire < 55)
      throw new Error(
        "The CCA preset assumes moving in at retirement, from age 55. Choose 55 or later, or Home + Helper for an earlier retirement illustration.",
      );
    if (!Number.isInteger(retire) || retire < Math.max(40, age) || retire > 80)
      throw new Error(
        "Retirement age must be at least your current age, between 40 and 80.",
      );

    const investmentReturn =
      typeof p.returnRate === "number" && p.returnRate >= 0
        ? p.returnRate
        : C.investmentReturn;
    const inflation =
      typeof p.inflationRate === "number" && p.inflationRate >= 0
        ? p.inflationRate
        : C.inflation;
    const plan = p.plan === "escalating" ? "escalating" : "standard";
    const post55Work = Boolean(p.post55Work);

    const months55 = (55 - age) * 12,
      years55 = 55 - age,
      wage = Math.min(salary, C.wageCap),
      baseContribution = wage * 0.37;
    let oa = Number(p.oa || 0),
      sa = Number(p.sa || 0),
      housingShortfall = 0,
      housingShortfallToday = 0;

    for (let m = 0; m < months55; m++) {
      const a = age + m / 12;
      const activeContribution = a < retire ? baseContribution : 0;
      const [o, s] = allocation(a);
      oa = oa * (1 + C.oaRate) ** (1 / 12) + activeContribution * o;
      sa = sa * (1 + C.saRate) ** (1 / 12) + activeContribution * s;
      const housing =
        p.housing == null ? activeContribution * o : Number(p.housing);
      const shortfall = Math.max(0, housing - oa);
      housingShortfall += shortfall;
      housingShortfallToday += todayValue(
        shortfall,
        age + (m + 1) / 12,
        age,
        inflation,
      );
      oa = Math.max(0, oa - housing);
    }

    const cpfAt55 = oa + sa,
      scale = (1 + C.sumGrowth) ** years55,
      frs = C.frs * scale,
      ers = 2 * frs;
    let extraPost55CPF = 0,
      post55OA = 0,
      post55RAContributions = 0,
      post55RAContributionsToday = 0;
    if (post55Work && retire > 55) {
      // CPF 2026/2027 employee allocation tables, checked 9 Nov 2026.
      // RA contributions are capped at the cohort FRS; diverted funds stay in OA.
      // Discount later RA additions to a 55-equivalent for the reference payout table.
      let ra = Math.min(cpfAt55, frs);
      const postMonths = Math.min(10, retire - 55) * 12;
      for (let m = 0; m < postMonths; m++) {
        const a = 55 + (m + 1) / 12;
        const year = C.year + years55 + Math.floor(m / 12);
        const [o, r, totalRate] = allocation(a, year);
        const contribution = wage * totalRate;
        ra *= (1 + C.saRate) ** (1 / 12);
        const addition = Math.min(contribution * r, Math.max(0, frs - ra));
        ra += addition;
        post55RAContributions += addition;
        post55RAContributionsToday += todayValue(
          addition,
          55 + (m + 1) / 12,
          age,
          inflation,
        );
        extraPost55CPF += addition / (1 + C.saRate) ** ((m + 1) / 12);
        post55OA =
          post55OA * (1 + C.oaRate) ** (1 / 12) +
          contribution * o +
          contribution * r -
          addition;
      }
    }
    // OA after 55 is not automatically committed to CPF LIFE.
    const cpf = cpfAt55 + extraPost55CPF;

    // A scaled reference illustration, not CPF Board's personalised annuity pricing.
    const baseStandardPayout =
      referencePayout(Math.min(cpf, frs) / scale) * scale;
    const income =
      plan === "escalating"
        ? baseStandardPayout * C.escalatingRatio
        : baseStandardPayout;

    const todaySpend =
      p.spend == null ? lifestyles[lifestyle].budget : Number(p.spend);
    const years = retire - age,
      months = years * 12,
      futureSpend = expenseAt(todaySpend, age, years, inflation, lifestyle);

    const calcOpts = { investmentReturn, inflation, plan, lifestyle };
    const target = portfolioTarget(
        futureSpend,
        baseStandardPayout,
        retire,
        C.endAge,
        calcOpts,
      ),
      noCpfTarget = portfolioTarget(futureSpend, 0, retire, C.endAge, calcOpts);

    const rate = (1 + investmentReturn) ** (1 / 12) - 1,
      factor = ((1 + rate) ** months - 1) / rate;
    const savings = Number(p.savings || 0),
      futureAssets = savings * (1 + rate) ** months;
    const saving = months
        ? Math.max(0, target - futureAssets) / factor
        : Math.max(0, target - savings),
      savingNoCpf = months
        ? Math.max(0, noCpfTarget - futureAssets) / factor
        : Math.max(0, noCpfTarget - savings);

    const cpfFactor =
      ((1 + C.saRate) ** years55 - 1) / ((1 + C.saRate) ** (1 / 12) - 1);
    const topup = Math.min(1000, Math.max(0, C.frs - Number(p.sa || 0))),
      delay = Math.min(10, years55);
    const spend65 = expenseAt(todaySpend, age, 65 - age, inflation, lifestyle),
      spend75 = expenseAt(todaySpend, age, 75 - age, inflation, lifestyle);
    const fundingMonths = Math.max(0, Math.min(55, retire) - age) * 12;
    const cpfRate = 1.04 ** (1 / 12) - 1;
    const cpfFundingFactor = fundingMonths
      ? (((1 + cpfRate) ** fundingMonths - 1) / cpfRate) *
        1.04 ** Math.max(0, 55 - retire)
      : 0;

    function makeScenario(key, label, balance) {
      const standardPayout = referencePayout(balance / scale) * scale;
      const payout65 =
        plan === "escalating"
          ? standardPayout * C.escalatingRatio
          : standardPayout;
      const payout75 =
        plan === "escalating"
          ? payout65 * (1 + C.escalatingRate) ** 10
          : standardPayout;

      const privateTarget = portfolioTarget(
        futureSpend,
        standardPayout,
        retire,
        C.endAge,
        calcOpts,
      );
      const privateSaving = months
        ? Math.max(0, privateTarget - futureAssets) / factor
        : Math.max(0, privateTarget - savings);
      const cpfGap = key === "salary" ? 0 : Math.max(0, balance - cpfAt55);
      const cpfFunding = cpfFundingFactor
        ? cpfGap / cpfFundingFactor
        : cpfGap / 1.04 ** years55;
      const chosenInvest = p.invest == null ? privateSaving : Number(p.invest);
      const illustratedPortfolio = months
        ? futureAssets + chosenInvest * factor
        : savings;

      let firstShortfallAge = null;
      for (let m = 0; m < 25 * 12; m++) {
        const t = m / 12;
        const currentPayout =
          plan === "escalating"
            ? payout65 * (1 + C.escalatingRate) ** t
            : standardPayout;
        if (
          expenseAt(spend65, 65, t, inflation, lifestyle) >
          currentPayout + 0.005
        ) {
          firstShortfallAge = 65 + t;
          break;
        }
      }

      return {
        key,
        label,
        balance,
        payout: payout65,
        payout75,
        standardPayout,
        cpfGap,
        cpfFunding,
        privateTarget,
        privateSaving,
        totalFunding: cpfFunding + privateSaving,
        gap65: Math.max(0, spend65 - payout65),
        gap75: Math.max(0, spend75 - payout75),
        firstShortfallAge,
        chosenInvest,
        illustratedPortfolio,
        remainingPortfolioGap: Math.max(
          0,
          privateTarget - illustratedPortfolio,
        ),
        contributionShortfall: Math.max(0, privateSaving - chosenInvest),
      };
    }

    const scenarios = [
      makeScenario("salary", "Salary path", Math.min(cpf, frs)),
      makeScenario("frs", "FRS", frs),
      makeScenario("ers", "ERS", ers),
    ];

    return {
      scenarios,
      lifestyle,
      lifestyleLabel: lifestyles[lifestyle].label,
      spend65,
      spend75,
      age,
      salary,
      retire,
      plan,
      investmentReturn,
      inflation,
      post55Work,
      extraPost55CPF,
      post55OA,
      post55RAContributions,
      post55RAContributionsToday,
      at75: spend75,
      retiringNow: months === 0,
      todaySpend,
      futureSpend,
      cpf,
      cpfAt55,
      oa,
      sa,
      frs,
      ers,
      income,
      target,
      saving,
      savingNoCpf,
      frsMonthly: Math.max(0, frs - cpfAt55) / cpfFactor,
      ersMonthly: Math.max(0, ers - cpfAt55) / cpfFactor,
      employeeCpf: wage * 0.2,
      employerCpf: wage * 0.17,
      afterCpf: salary - wage * 0.2,
      contribution: baseContribution,
      wage,
      currentOA: baseContribution * allocation(age)[0],
      currentSA: baseContribution * allocation(age)[1],
      currentMA:
        baseContribution * (1 - allocation(age)[0] - allocation(age)[1]),
      gap: Math.max(0, futureSpend - (retire >= 65 ? income : 0)),
      housingShortfall,
      housingShortfallToday,
      topup,
      early: topup * 1.04 ** years55,
      later: topup * 1.04 ** (years55 - delay),
      delay,
      refined: p.oa != null || p.sa != null || p.housing != null,
    };
  }

  // Presentation only: financial calculations retain nominal cash flows.
  function todayValue(value, atAge, currentAge, inflation = C.inflation) {
    return value / (1 + inflation) ** (atAge - currentAge);
  }
  function todayPlan(r) {
    const at = (value, age) => todayValue(value, age, r.age, r.inflation);
    const result = { ...r, moneyBasis: "today" };
    for (const key of [
      "cpf",
      "cpfAt55",
      "oa",
      "sa",
      "frs",
      "ers",
      "extraPost55CPF",
      "early",
      "later",
    ])
      result[key] = at(r[key], 55);
    for (const key of ["futureSpend", "target"])
      result[key] = at(r[key], r.retire);
    result.income = at(r.income, 65);
    result.spend65 = at(r.spend65, 65);
    result.spend75 = at(r.spend75, 75);
    result.at75 = result.spend75;
    result.gap = at(r.gap, r.retire);
    result.post55RAContributions = r.post55RAContributionsToday;
    result.housingShortfall = r.housingShortfallToday;
    result.post55OA = at(r.post55OA, Math.min(65, r.retire));
    result.scenarios = r.scenarios.map((s) => ({
      ...s,
      balance: at(s.balance, 55),
      cpfGap: at(s.cpfGap, 55),
      payout: at(s.payout, 65),
      payout75: at(s.payout75, 75),
      standardPayout: at(s.standardPayout, 65),
      gap65: at(s.gap65, 65),
      gap75: at(s.gap75, 75),
      privateTarget: at(s.privateTarget, r.retire),
      illustratedPortfolio: at(s.illustratedPortfolio, r.retire),
      remainingPortfolioGap: at(s.remainingPortfolioGap, r.retire),
    }));
    return result;
  }
  function todayTrajectory(trajectory) {
    const { summary: r } = trajectory;
    return {
      ...trajectory,
      points: trajectory.points.map((point) => {
        const at = (value) => todayValue(value, point.age, r.age, r.inflation);
        return {
          ...point,
          monthlySpend: at(point.monthlySpend),
          monthlyCPF: at(point.monthlyCPF),
          monthlyGap: at(point.monthlyGap),
          portfolioBalance: at(point.portfolioBalance),
        };
      }),
    };
  }
  function drawdownToday(r, s) {
    const income =
      r.retire < 65
        ? 0
        : s.payout *
          (r.plan === "escalating"
            ? (1 + C.escalatingRate) ** (r.retire - 65)
            : 1);
    const gap = Math.max(0, r.futureSpend - income);
    // All slices share the retirement date; never allocate more than the pot.
    const cashReserve = Math.min(s.privateTarget, gap * 24);
    const ssbLadder = Math.min(
      Math.max(0, s.privateTarget - cashReserve),
      200000,
      gap * 60,
    );
    const equityCore = Math.max(0, s.privateTarget - cashReserve - ssbLadder);
    const at = (value) => todayValue(value, r.retire, r.age, r.inflation);
    return {
      gap: at(gap),
      cashReserve: at(cashReserve),
      ssbLadder: at(ssbLadder),
      equityCore: at(equityCore),
    };
  }

  function generateTrajectory(p, selectedKey = "salary") {
    const r = calculate(p);
    const s = r.scenarios.find((x) => x.key === selectedKey) || r.scenarios[0];
    const points = [];
    const monthlyRate = (1 + r.investmentReturn) ** (1 / 12) - 1;
    let balance = Number(p.savings || 0);

    for (let curAge = r.age; curAge <= C.endAge; curAge++) {
      const year = C.year + (curAge - r.age);
      const isAccumulating = curAge < r.retire;
      const isRetire = curAge >= r.retire;
      const isCPFActive = curAge >= 65;

      const tSpend = curAge >= r.retire ? curAge - r.retire : 0;
      const monthlySpend = isRetire
        ? expenseAt(r.futureSpend, r.retire, tSpend, r.inflation, r.lifestyle)
        : expenseAt(
            r.todaySpend,
            r.age,
            curAge - r.age,
            r.inflation,
            r.lifestyle,
          );

      let monthlyCPF = 0;
      if (isCPFActive) {
        const cpfElapsed = curAge - 65;
        monthlyCPF =
          r.plan === "escalating"
            ? s.payout * (1 + C.escalatingRate) ** cpfElapsed
            : s.standardPayout;
      }

      const monthlyGap = isRetire ? Math.max(0, monthlySpend - monthlyCPF) : 0;

      points.push({
        age: curAge,
        year,
        phase: isAccumulating
          ? "accumulating"
          : curAge < 65
            ? "bridge"
            : "drawdown",
        monthlySpend,
        monthlyCPF,
        monthlyGap,
        portfolioBalance: Math.max(0, balance),
      });

      // Simulate 12 months forward for next age
      for (let m = 0; m < 12; m++) {
        if (isAccumulating) {
          balance = balance * (1 + monthlyRate) + s.chosenInvest;
        } else {
          // Match portfolioTarget: monthly spending and CPF escalation,
          // with the withdrawal at month end after growth.
          const elapsed = curAge - r.retire + m / 12;
          const ageAtMonth = curAge + m / 12;
          const cpfAtMonth =
            ageAtMonth < 65
              ? 0
              : s.payout *
                (r.plan === "escalating"
                  ? (1 + C.escalatingRate) ** (ageAtMonth - 65)
                  : 1);
          const spending = expenseAt(
            r.futureSpend,
            r.retire,
            elapsed,
            r.inflation,
            r.lifestyle,
          );
          balance = Math.max(
            0,
            balance * (1 + monthlyRate) - Math.max(0, spending - cpfAtMonth),
          );
        }
      }
    }
    return { summary: r, selectedScenario: s, points };
  }

  const api = {
    C,
    todayValue,
    todayPlan,
    todayTrajectory,
    drawdownToday,
    allocation,
    careRows,
    ccaRows,
    lifestyles,
    budgetBreakdown,
    careTotals,
    expenseAt,
    referencePayout,
    portfolioTarget,
    calculate,
    generateTrajectory,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.RetirementModel = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
