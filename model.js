/* Fixed, disclosed planning assumptions; no personal data leaves the browser. */
(function (root) {
  const C = {
    year: 2026,
    startMonth: 11, // First full projection month: December 2026.
    bhs: 79000,
    bhsGrowth: 0.05, // Unannounced future BHS: planning assumption only.
    inflation: 0.03,
    investmentReturn: 0.04,
    retirementAge: 65,
    endAge: 90,
    fireEndAge: 95,
    brs: 110200,
    frs: 220400,
    ers: 440800,
    sumGrowth: 0.035,
    oaRate: 0.025,
    saRate: 0.04,
    wageCap: 8000,
    annualWageCap: 102000,
    escalatingRate: 0.02,
    escalatingRatio: 0.8,
    sdicCap: 100000,
    ssbCap: 200000,
    srsCap: 15300,
    srsIdleRate: 0.0005,
    srsTaxFreeAnnual: 40000,
    rstuReliefCap: 8000,
    personalReliefCap: 80000,
  };

  // Official IRAS resident individual income tax brackets (YA 2024 onwards).
  const TAX_BRACKETS = [
    [20000, 0],
    [30000, 0.02],
    [40000, 0.035],
    [80000, 0.07],
    [120000, 0.115],
    [160000, 0.15],
    [200000, 0.18],
    [240000, 0.19],
    [280000, 0.195],
    [320000, 0.2],
    [500000, 0.22],
    [1000000, 0.23],
    [Infinity, 0.24],
  ];

  function residentTax(chargeableIncome) {
    const income = Math.max(0, Number(chargeableIncome) || 0);
    let tax = 0,
      prev = 0,
      marginalRate = 0;
    for (const [limit, rate] of TAX_BRACKETS) {
      if (income > prev) {
        const slice = Math.min(income, limit) - prev;
        tax += slice * rate;
        marginalRate = rate;
      }
      if (income <= limit) break;
      prev = limit;
    }
    const annualTax = Math.round(tax * 100) / 100;
    return {
      chargeableIncome: income,
      annualTax,
      monthlyTax: annualTax / 12,
      marginalRate,
    };
  }

  const monthlyRate = (annualRate) => (1 + annualRate) ** (1 / 12) - 1;

  // Contributions at month end; returns are effective annual rates outside CPF.
  function annuityFactor(rate, months) {
    return Math.abs(rate) < 1e-12
      ? months
      : Math.expm1(months * Math.log1p(rate)) / rate;
  }

  function requiredSaving(target, currentAssets, rate, months) {
    const futureAssets = currentAssets * (1 + rate) ** months;
    const shortfall = Math.max(0, target - futureAssets);
    return months ? shortfall / annuityFactor(rate, months) : shortfall;
  }

  function interpolateTable(entries, value) {
    const last = entries[entries.length - 1];
    const x = Math.max(0, Math.min(last[0], value));
    for (let i = 1; i < entries.length; i++) {
      const [a, b] = entries[i - 1],
        [c, d] = entries[i];
      if (x <= c) return b + ((d - b) * (x - a)) / (c - a);
    }
    return last[1];
  }

  const table = [
    [0, 0],
    [50000, 490],
    [110200, 950],
    [150000, 1250],
    [220400, 1780],
    [300000, 2380],
    [440800, 3440],
  ];

  // CPF's published RA-at-65 examples already include interest from 55 to 65.
  const table65 = [
    [0, 0],
    [82400, 490],
    [170100, 950],
    [227900, 1250],
    [330100, 1780],
    [445600, 2380],
    [650100, 3440],
  ];

  function referencePayout(balance, plan = "standard", elapsedYears = 0) {
    const base = interpolateTable(table, balance);
    if (plan === "escalating") {
      return (
        base *
        C.escalatingRatio *
        (1 + C.escalatingRate) ** Math.max(0, elapsedYears)
      );
    }
    return base;
  }

  function payoutFrom65(balance, scale = 1) {
    return interpolateTable(table65, balance / scale) * scale;
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
    const rate = monthlyRate(investmentReturn);
    let target = 0;
    const totalMonths = Math.round((endAge - retirementAge) * 12);
    for (let m = 1; m <= totalMonths; m++) {
      const t = (m - 1) / 12;
      const currentAge = retirementAge + t;
      let cpf = 0;
      if (currentAge >= 65) {
        const cpfElapsed = Math.floor(currentAge - 65 + 1e-9);
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

  function extraInterest(balances, age) {
    const result = { oa: 0, sa: 0, ma: 0, ra: 0 };
    let used = 0;
    for (const key of ["ra", "oa", "sa", "ma"]) {
      const eligible = Math.min(
        key === "oa" ? 20000 : Infinity,
        balances[key] || 0,
      );
      const first = Math.min(eligible, Math.max(0, 30000 - used));
      const total = Math.min(eligible, Math.max(0, 60000 - used));
      const interest = total * 0.01 + (age >= 55 ? first * 0.01 : 0);
      result[key === "oa" ? (age >= 55 ? "ra" : "sa") : key] += interest;
      used += eligible;
    }
    return result;
  }

  function retirementSum(year) {
    return year <= 2026 ? C.frs : 228200 * (1 + C.sumGrowth) ** (year - 2027);
  }

  function projectCPF(
    p,
    monthlyExtra = 0,
    goal = "salary",
    forcedAt55 = null,
    options = {},
  ) {
    const age = Number(p.age),
      retire = p.retire == null ? 65 : Number(p.retire),
      saInvested = Number(p.saInvested || 0),
      maSpend = Number(p.maSpend || 0),
      inflation = p.inflationRate ?? C.inflation,
      months55 = (55 - age) * 12,
      months65 = (65 - age) * 12,
      monthsRetire = Math.round((retire - age) * 12),
      frs = retirementSum(C.year + 55 - age);
    const b = {
      oa: Number(p.oa || 0),
      sa: Number(p.sa || 0),
      ma: Number(p.ma || 0),
      ra: 0,
    };
    const oaTransfer = options.transferOA
      ? Math.min(b.oa, Math.max(0, C.frs - b.sa - saInvested))
      : 0;
    b.oa -= oaTransfer;
    b.sa += oaTransfer;
    const pending = { oa: 0, sa: 0, ma: 0, ra: 0 };
    let reserve = 0,
      principal = 0,
      totalExtra = 0,
      totalTopups = 0,
      totalInterest = 0,
      closedSAInterest = 0;
    let housingShortfall = 0,
      housingShortfallToday = 0,
      maShortfallToday = 0,
      post55RAContributions = 0,
      post55RAContributionsToday = 0,
      extraPost55CPF = 0;
    let scheduledTopup = 0,
      scheduledRoom = 0,
      scheduledLimit = 0;
    let snapshot55,
      goalAge = null,
      reserveDeposits = 0;
    const ledger = [];
    const reserveRate = monthlyRate(Number(p.reserveReturn || 0));

    const creditRA = (amount, limit) => {
      const accepted = Math.min(amount, Math.max(0, limit - principal));
      b.ra += accepted;
      principal += accepted;
      return accepted;
    };
    const addRetirement = (amount, limit, before55) => {
      const accepted = before55
        ? Math.min(amount, Math.max(0, limit - b.sa - saInvested))
        : creditRA(amount, limit);
      if (before55) b.sa += accepted;
      b.oa += amount - accepted;
    };
    const applyTopup = (m, before55, currentFRS) => {
      if (!options.topup || m !== Math.round((options.topup.age - age) * 12))
        return;
      const limit = before55
        ? currentFRS
        : options.topup.target === "frs"
          ? frs
          : 2 * currentFRS;
      const room = Math.max(
        0,
        limit - (before55 ? b.sa + saInvested : principal),
      );
      scheduledTopup = Math.min(options.topup.amount ?? room, room);
      if (before55) b.sa += scheduledTopup;
      else {
        b.ra += scheduledTopup;
        principal += scheduledTopup;
      }
      scheduledRoom = room;
      scheduledLimit = limit;
      totalExtra += scheduledTopup;
      totalTopups += scheduledTopup;
    };

    for (let m = 0; m <= months65; m++) {
      const currentAge = age + m / 12;
      const year = C.year + Math.floor((C.startMonth + m) / 12);
      const currentFRS = retirementSum(year);
      const bhs = C.bhs * (1 + C.bhsGrowth) ** (year - C.year);
      if (m === months55) {
        const originalOA = b.oa,
          originalSA = b.sa;
        const initial = Math.min(frs, b.sa + b.oa);
        const fromSA = Math.min(b.sa, initial);
        b.sa -= fromSA;
        b.oa -= initial - fromSA;
        b.ra = initial;
        principal = initial;
        b.oa += b.sa;
        b.sa = 0;
        // Pre-closure SA interest is credited at year end, up to FRS in RA, then OA.
        closedSAInterest = pending.sa;
        pending.sa = 0;
        snapshot55 = {
          ...b,
          oa: originalOA,
          sa: originalSA,
          cpfAt55: initial,
          availableAt55: originalOA + originalSA,
          reserve,
        };
        const limit = goal === "ers" ? 2 * frs : frs;
        if (goal !== "salary") {
          b.oa -= creditRA(b.oa, limit);
        }
        const reserveTransfer = creditRA(reserve, limit);
        reserve -= reserveTransfer;
        totalTopups += reserveTransfer;
        if (forcedAt55 != null) {
          b.ra = Math.max(b.ra, forcedAt55);
          principal = b.ra;
          pending.ra = 0;
          closedSAInterest = 0;
        }
        snapshot55.fundedRA = b.ra;
        snapshot55.remainingReserve = reserve;
      }
      if (m === months65) applyTopup(m, false, currentFRS);
      const target = goal === "ers" ? 2 * frs : frs;
      if (
        goalAge === null &&
        (currentAge < 55 ? b.sa + b.oa + reserve : principal) >= target - 0.005
      )
        goalAge = currentAge;
      if (options.monthly || m % 12 === 0 || m === months55)
        ledger.push({
          age: currentAge,
          ...b,
          reserve,
          totalExtra,
          totalTopups,
          totalInterest,
        });
      if (m === months65) {
        // For these birth cohorts, OA is transferred up to FRS when payouts start.
        b.oa -= creditRA(b.oa, frs);
        if (goalAge === null && principal >= target - 0.005)
          goalAge = currentAge;
        if (ledger.at(-1)?.age === currentAge) Object.assign(ledger.at(-1), b);
        break;
      }
      const before55 = m < months55;
      const working =
        m < monthsRetire && (before55 || (p.post55Work && currentAge < 65));
      // The new age band applies from the month after the birthday.
      const [o, r, totalRate] = allocation(currentAge, year);
      const contribution = working
        ? Math.min(Number(p.salary), C.wageCap) * totalRate
        : 0;
      const incoming = {
        oa: contribution * o,
        sa: 0,
        ra: 0,
        ma: contribution * (1 - o - r),
      };
      if (before55) incoming.sa = contribution * r;
      else {
        incoming.ra = creditRA(contribution * r, frs);
        incoming.oa += contribution * r - incoming.ra;
        post55RAContributions += incoming.ra;
        post55RAContributionsToday += todayValue(
          incoming.ra,
          currentAge + 1 / 12,
          age,
          inflation,
        );
        extraPost55CPF += incoming.ra / 1.04 ** (currentAge + 1 / 12 - 55);
      }
      const housing = p.housing == null ? incoming.oa : Number(p.housing);
      const shortfall = Math.max(0, housing - b.oa - incoming.oa);
      housingShortfall += shortfall;
      housingShortfallToday += todayValue(
        shortfall,
        currentAge + 1 / 12,
        age,
        inflation,
      );
      // Deductions lose this month's interest; incoming funds earn from next month.
      const eligible = {
        ...b,
        oa: Math.max(0, b.oa - housing),
        ma: Math.max(0, b.ma - maSpend),
      };
      if (m === 0) eligible.sa = Math.max(0, eligible.sa - oaTransfer);
      const extra = extraInterest(eligible, currentAge);
      maShortfallToday += todayValue(
        Math.max(0, maSpend - b.ma - incoming.ma),
        currentAge + 1 / 12,
        age,
        inflation,
      );
      for (const key of Object.keys(b)) {
        const interest =
          (eligible[key] * (key === "oa" ? C.oaRate : C.saRate) + extra[key]) /
          12;
        pending[key] += interest;
        totalInterest += interest;
      }
      b.oa = Math.max(0, b.oa + incoming.oa - housing);
      incoming.ma = Math.max(0, incoming.ma - Math.max(0, maSpend - b.ma));
      b.ma = Math.max(0, b.ma - maSpend);
      b.sa += incoming.sa;
      b.ra += incoming.ra;
      const maAddition = Math.min(incoming.ma, Math.max(0, bhs - b.ma));
      b.ma += maAddition;
      addRetirement(
        incoming.ma - maAddition,
        before55 ? currentFRS : frs,
        before55,
      );
      // New cash earns from the following month.
      applyTopup(m, before55, currentFRS);
      reserve *= 1 + reserveRate;
      if (before55 && m < monthsRetire) {
        totalExtra += monthlyExtra;
        const accepted = Math.min(
          monthlyExtra,
          Math.max(0, currentFRS - b.sa - saInvested),
        );
        b.sa += accepted;
        totalTopups += accepted;
        reserve += monthlyExtra - accepted;
        reserveDeposits += monthlyExtra - accepted;
      }
      if (!before55 && reserve > 0 && goal !== "salary") {
        const transfer = creditRA(
          reserve,
          goal === "ers" ? 2 * currentFRS : frs,
        );
        reserve -= transfer;
        totalTopups += transfer;
      }
      if ((C.startMonth + m) % 12 === 11) {
        for (const key of Object.keys(b)) {
          b[key] += pending[key];
          pending[key] = 0;
        }
        if (!before55 && closedSAInterest > 0) {
          addRetirement(closedSAInterest, frs, false);
          closedSAInterest = 0;
        }
        const overflow = Math.max(0, b.ma - bhs);
        b.ma -= overflow;
        addRetirement(overflow, before55 ? currentFRS : frs, before55);
      }
    }
    return {
      ...snapshot55,
      oaTransfer,
      ra65: b.ra,
      pendingRA65: pending.ra,
      scheduledTopup,
      scheduledRoom,
      scheduledLimit,
      ma65: b.ma,
      post55OA: b.oa,
      reserve65: reserve,
      totalExtra,
      totalTopups,
      totalInterest,
      reserveDeposits,
      goalAge,
      ledger,
      housingShortfall,
      housingShortfallToday,
      maShortfallToday,
      post55RAContributions,
      post55RAContributionsToday,
      extraPost55CPF,
      currentTopupRoom: Math.max(0, C.frs - Number(p.sa || 0) - saInvested),
    };
  }

  function validate(p) {
    const age = Number(p.age),
      salary = Number(p.salary),
      retire = p.retire == null ? 65 : Number(p.retire);
    if (!Number.isInteger(age) || age < 18 || age > 54)
      throw new Error(
        "Enter an age from 18 to 54 for this CPF salary illustration.",
      );
    if (!Number.isFinite(salary) || salary <= 750 || salary > 1000000)
      throw new Error(
        "Enter monthly gross salary above $750, before employee CPF.",
      );
    for (const key of [
      "oa",
      "sa",
      "ma",
      "saInvested",
      "maSpend",
      "housing",
      "savings",
      "spend",
      "invest",
      "cpfExtra",
      "equities",
      "sgDividends",
      "ssbCash",
      "srs",
      "srsAnnual",
      "annualBonus",
      "existingReliefs",
    ])
      if (
        p[key] != null &&
        (!Number.isFinite(p[key]) || Number(p[key]) < 0 || Number(p[key]) > 1e9)
      )
        throw new Error(
          "Use amounts from $0 to $1 billion for balances and monthly savings.",
        );
    for (const key of ["returnRate", "inflationRate", "reserveReturn"])
      if (
        p[key] != null &&
        (!Number.isFinite(p[key]) || p[key] < 0 || p[key] > 0.2)
      )
        throw new Error("Use an annual rate from 0% to 20%.");
    if (!Object.hasOwn(lifestyles, p.lifestyle ?? "cca"))
      throw new Error("Choose Community Care Apartments or Home + Helper.");
    if (
      !Number.isFinite(retire) ||
      Math.abs(retire * 12 - Math.round(retire * 12)) > 1e-7 ||
      retire < Math.max((p.lifestyle ?? "cca") === "cca" ? 55 : 40, age) ||
      retire > 80
    )
      throw new Error(
        "Retirement must be between your current age and 80, from 55 for CCA or 40 for Home + Helper.",
      );
  }

  function calculate(p) {
    validate(p);
    const age = Number(p.age),
      salary = Number(p.salary),
      retire = p.retire == null ? 65 : Number(p.retire);
    const lifestyle = p.lifestyle ?? "cca",
      inflation = p.inflationRate ?? C.inflation,
      investmentReturn = p.returnRate ?? C.investmentReturn;
    const plan = p.plan === "escalating" ? "escalating" : "standard",
      post55Work = Boolean(p.post55Work);
    const base = projectCPF(p),
      years55 = 55 - age,
      frs = retirementSum(C.year + years55),
      scale = frs / C.frs,
      ers = 2 * frs;
    const cpfAt55 = base.availableAt55,
      cpf = base.cpfAt55 + base.extraPost55CPF;
    const todaySpend = p.spend ?? lifestyles[lifestyle].budget;
    const years = retire - age,
      months = Math.round(years * 12),
      rate = monthlyRate(investmentReturn);
    const factor = annuityFactor(rate, months),
      savings = Number(p.savings || 0),
      futureAssets = savings * (1 + rate) ** months;
    const futureSpend = expenseAt(todaySpend, age, years, inflation, lifestyle);
    const spend65 = expenseAt(todaySpend, age, 65 - age, inflation, lifestyle),
      spend75 = expenseAt(todaySpend, age, 75 - age, inflation, lifestyle);
    const calcOpts = { investmentReturn, inflation, plan, lifestyle };

    function makeScenario(key, balance) {
      const funded = key === "salary" ? base : projectCPF(p, 0, key, balance);
      const standardPayout = payoutFrom65(funded.ra65, scale);
      const payout =
        standardPayout * (plan === "escalating" ? C.escalatingRatio : 1);
      const payout75 =
        payout * (plan === "escalating" ? C.escalatingRate + 1 : 1) ** 10;
      const privateTarget = portfolioTarget(
        futureSpend,
        standardPayout,
        retire,
        C.endAge,
        calcOpts,
      );
      const privateSaving = requiredSaving(
        privateTarget,
        savings,
        rate,
        months,
      );
      const cpfGap = key === "salary" ? 0 : Math.max(0, balance - cpfAt55);
      let cpfFunding = 0;
      if (cpfGap > 0 && months > 0) {
        let lo = 0,
          hi = cpfGap / Math.max(1, Math.min(months, years55 * 12));
        for (let i = 0; i < 30; i++) {
          const mid = (lo + hi) / 2;
          const t = projectCPF(p, mid, key);
          if (t.fundedRA >= balance - 0.001) hi = mid;
          else lo = mid;
        }
        cpfFunding = hi;
      } else if (cpfGap > 0) {
        // Capital needed today, held at the reserve rate until age 55.
        cpfFunding = cpfGap / (1 + Number(p.reserveReturn || 0)) ** years55;
      }
      const chosenInvest = p.invest ?? privateSaving;
      const illustratedPortfolio = futureAssets + chosenInvest * factor;
      let firstShortfallAge = null;
      for (let m = 0; m < 300; m++) {
        const a = 65 + m / 12;
        const income =
          payout * (plan === "escalating" ? 1.02 ** Math.floor(m / 12) : 1);
        if (
          expenseAt(spend65, 65, m / 12, inflation, lifestyle) >
          income + 0.005
        ) {
          firstShortfallAge = a;
          break;
        }
      }
      return {
        key,
        label: key === "salary" ? "Salary path" : key.toUpperCase(),
        balance,
        payout,
        payout75,
        standardPayout,
        cpfGap,
        cpfFunding,
        privateTarget,
        privateSaving,
        totalFunding: cpfFunding + privateSaving,
        gap65: Math.max(0, spend65 - payout),
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
      makeScenario("salary", Math.min(base.cpfAt55, frs)),
      makeScenario("frs", frs),
      makeScenario("ers", ers),
    ];
    const topup = Math.min(1000, base.currentTopupRoom),
      delay = Math.min(10, years55),
      wage = Math.min(salary, C.wageCap),
      contribution = wage * 0.37,
      [oaShare, saShare] = allocation(age);
    return {
      scenarios,
      lifestyle,
      lifestyleLabel: lifestyles[lifestyle].label,
      age,
      salary,
      retire,
      plan,
      investmentReturn,
      inflation,
      post55Work,
      todaySpend,
      futureSpend,
      spend65,
      spend75,
      at75: spend75,
      retiringNow: months === 0,
      cpf,
      cpfAt55,
      oa: base.oa,
      sa: base.sa,
      frs,
      ers,
      income: scenarios[0].payout,
      target: scenarios[0].privateTarget,
      saving: scenarios[0].privateSaving,
      savingNoCpf: requiredSaving(
        portfolioTarget(futureSpend, 0, retire, 90, calcOpts),
        savings,
        rate,
        months,
      ),
      frsMonthly: scenarios[1].cpfFunding,
      ersMonthly: scenarios[2].cpfFunding,
      employeeCpf: wage * 0.2,
      employerCpf: wage * 0.17,
      afterCpf: salary - wage * 0.2,
      contribution,
      wage,
      currentOA: contribution * oaShare,
      currentSA: contribution * saShare,
      currentMA: contribution * (1 - oaShare - saShare),
      gap: Math.max(
        0,
        futureSpend -
          (retire >= 65
            ? scenarios[0].payout *
              (plan === "escalating" ? 1.02 ** Math.floor(retire - 65) : 1)
            : 0),
      ),
      housingShortfall: base.housingShortfall,
      housingShortfallToday: base.housingShortfallToday,
      extraPost55CPF: base.extraPost55CPF,
      post55OA: base.post55OA,
      post55RAContributions: base.post55RAContributions,
      post55RAContributionsToday: base.post55RAContributionsToday,
      currentTopupRoom: base.currentTopupRoom,
      topup,
      early: topup * 1.04 ** years55,
      later: topup * 1.04 ** (years55 - delay),
      delay,
      refined:
        p.oa != null || p.sa != null || p.ma != null || p.housing != null,
    };
  }

  // Actual contributions have their own outcome, independent of fully funded comparisons.
  function simulate(p, selectedKey = "salary", options = {}) {
    const r = options.summary || calculate(p),
      s = r.scenarios.find((x) => x.key === selectedKey) || r.scenarios[0];
    const cpfExtra = r.retiringNow ? 0 : (p.cpfExtra ?? s.cpfFunding);
    const cpfResult = projectCPF(p, r.retiringNow ? 0 : cpfExtra, selectedKey);
    const scale = retirementSum(C.year + 55 - r.age) / C.frs;
    const standardPayout = payoutFrom65(cpfResult.ra65, scale);
    const payout =
      standardPayout * (r.plan === "escalating" ? C.escalatingRatio : 1);
    const actual = {
      ...s,
      payout,
      standardPayout,
      payout75: payout * (r.plan === "escalating" ? 1.02 ** 10 : 1),
      chosenInvest: 0,
    };
    actual.gap65 = Math.max(0, r.spend65 - payout);
    actual.gap75 = Math.max(0, r.spend75 - actual.payout75);
    actual.privateTarget = portfolioTarget(
      r.futureSpend,
      standardPayout,
      r.retire,
      C.endAge,
      {
        investmentReturn: r.investmentReturn,
        inflation: r.inflation,
        plan: r.plan,
        lifestyle: r.lifestyle,
      },
    );
    const rate = monthlyRate(r.investmentReturn);
    const monthsToRetire = Math.round((r.retire - r.age) * 12);
    const requiredInvestment = requiredSaving(
      actual.privateTarget,
      Number(p.savings || 0),
      rate,
      monthsToRetire,
    );
    const invest = r.retiringNow ? 0 : (p.invest ?? requiredInvestment);
    actual.privateSaving = requiredInvestment;
    actual.contributionShortfall = Math.max(0, requiredInvestment - invest);
    actual.firstShortfallAge = null;
    actual.chosenInvest = invest;
    const points = [],
      monthly = [];
    let portfolio = Number(p.savings || 0),
      depletionAge = null,
      portfolioAtRetire = portfolio;
    const retirementMonth = monthsToRetire,
      endMonth = (C.endAge - r.age) * 12;
    let investmentDeposits = 0;
    for (let m = 0; m <= endMonth; m++) {
      const age = r.age + m / 12,
        retired = m >= retirementMonth;
      const monthlyCPF =
        age < 65
          ? 0
          : payout *
            (r.plan === "escalating"
              ? 1.02 ** Math.floor((m - (65 - r.age) * 12) / 12 + 1e-9)
              : 1);
      const monthlySpend = expenseAt(
        r.todaySpend,
        r.age,
        m / 12,
        r.inflation,
        r.lifestyle,
      );
      const monthlyGap = retired ? Math.max(0, monthlySpend - monthlyCPF) : 0;
      if (
        age >= 65 &&
        monthlySpend > monthlyCPF + 0.005 &&
        actual.firstShortfallAge == null
      )
        actual.firstShortfallAge = age;
      if (m === retirementMonth) portfolioAtRetire = portfolio;
      if (m % 12 === 0)
        points.push({
          age,
          year: C.year + Math.floor((C.startMonth + m) / 12),
          phase: !retired ? "accumulating" : age < 65 ? "bridge" : "drawdown",
          monthlySpend,
          monthlyCPF,
          monthlyGap,
          portfolioBalance: portfolio,
        });
      if (options.monthly)
        monthly.push({ age, portfolio, monthlySpend, monthlyCPF, monthlyGap });
      if (m === endMonth) break;
      if (!retired) {
        portfolio = portfolio * (1 + rate) + invest;
        investmentDeposits += invest;
      } else {
        const remaining = portfolio * (1 + rate) - monthlyGap;
        if (remaining < -0.005 && depletionAge === null)
          depletionAge = age + 1 / 12;
        portfolio = Math.max(0, remaining);
      }
    }
    actual.illustratedPortfolio = portfolioAtRetire;
    actual.remainingPortfolioGap = Math.max(
      0,
      actual.privateTarget - portfolioAtRetire,
    );
    actual.totalFunding = s.cpfFunding + requiredInvestment;
    actual.chosenTotal = cpfExtra + invest;
    // An additional level cash withdrawal, not a CPF annuity or safe withdrawal rule.
    const drawMonths = Math.round((C.endAge - r.retire) * 12);
    const monthlyPortfolioIncome = drawMonths
      ? (portfolioAtRetire / annuityFactor(rate, drawMonths)) *
        (1 + rate) ** drawMonths
      : 0;
    return {
      summary: r,
      selectedScenario: actual,
      points,
      monthly,
      cpfResult,
      cpfExtra,
      invest,
      portfolioAtRetire,
      depletionAge,
      monthlyPortfolioIncome,
      investmentDeposits,
      investmentGrowth:
        portfolioAtRetire - Number(p.savings || 0) - investmentDeposits,
      payoutCapped: cpfResult.ra65 > 650100 * scale,
      cpfGoalAge: cpfResult.goalAge,
      fullyFunded: portfolioAtRetire + 0.005 >= actual.privateTarget,
    };
  }

  // Isolated timing comparison: salary CPF and entered balances are identical.
  // Additional cash is supplied at the chosen age; it is not taken from investments.
  function compareTopupTiming(
    p,
    earlierAge = 55,
    laterAge = 60,
    amount = null,
    target = "ers",
    mode = "target",
  ) {
    validate(p);
    if (
      ![earlierAge, laterAge].every(
        (x) => Number.isInteger(x) && x >= p.age && x <= 65,
      )
    )
      throw new Error("Choose top-up ages from your current age to 65.");
    if (
      amount != null &&
      (!Number.isFinite(amount) || amount < 0 || amount > 1e9)
    )
      throw new Error(
        "Enter a top-up from $0 to $1 billion, or leave blank for the maximum.",
      );
    if (!["frs", "ers"].includes(target)) throw new Error("Choose FRS or ERS.");
    if (target === "ers" && (earlierAge < 55 || laterAge < 55))
      throw new Error(
        "ERS top-ups start at 55. Choose FRS for a top-up before 55.",
      );
    if (earlierAge > laterAge) [earlierAge, laterAge] = [laterAge, earlierAge];
    if (!["same", "target"].includes(mode))
      throw new Error("Choose a comparison mode.");
    const maximumAt = (age) =>
      projectCPF(p, 0, "salary", null, { topup: { age, target } })
        .scheduledTopup;
    const commonCash =
      mode === "same"
        ? Math.min(
            amount ?? Infinity,
            maximumAt(earlierAge),
            maximumAt(laterAge),
          )
        : amount;
    const baseline = projectCPF(p);
    const scale = retirementSum(C.year + 55 - Number(p.age)) / C.frs;
    const scenario = (age) => {
      const result = projectCPF(p, 0, "salary", null, {
        topup: { age, amount: commonCash, target },
      });
      return {
        age,
        cash: result.scheduledTopup,
        room: result.scheduledRoom,
        limit: result.scheduledLimit,
        ra65: result.ra65,
        oa65: result.post55OA,
        interest: result.totalInterest - baseline.totalInterest,
        payout:
          payoutFrom65(result.ra65, scale) *
          (p.plan === "escalating" ? C.escalatingRatio : 1),
        payoutCapped: result.ra65 > 650100 * scale,
      };
    };
    return {
      retire: p.retire ?? 65,
      target,
      earlier: scenario(earlierAge),
      later: scenario(laterAge),
    };
  }

  // A level monthly route to an age-55 milestone, not a payout/withdrawal election.
  function milestonePlan(p, key = "frs") {
    validate(p);
    if (!["brs", "frs", "ers"].includes(key))
      throw new Error("Choose BRS, FRS or ERS.");
    const frs = retirementSum(C.year + 55 - Number(p.age));
    const target = frs * { brs: 0.5, frs: 1, ers: 2 }[key];
    const base = projectCPF(p);
    const available = base.availableAt55;
    const gap = Math.max(0, target - available);
    const retire = Number(p.retire ?? 65);
    const months = Math.round((Math.min(55, retire) - Number(p.age)) * 12);
    const goal = key === "brs" ? "salary" : key;
    let monthly = gap > 0.005 && months <= 0 ? null : 0;
    let projection = goal === "salary" ? base : projectCPF(p, 0, goal);
    if (gap > 0.005 && months > 0) {
      let low = 0,
        high = gap / months;
      for (let i = 0; i < 32; i++) {
        const mid = (low + high) / 2;
        if (projectCPF(p, mid, goal).fundedRA >= target - 0.001) high = mid;
        else low = mid;
      }
      monthly = Math.ceil(high);
      projection = projectCPF(p, monthly, goal);
    }
    return {
      key,
      target,
      available,
      gap,
      monthly,
      untilAge: Math.min(55, retire),
      currentRoom: base.currentTopupRoom,
      reserveAt55: projection.reserve,
      fundedRA: projection.fundedRA,
      projection,
    };
  }

  function earliestRetirement(p, selectedKey, monthlyCPF, monthlyInvestment) {
    validate(p);
    const minimum = Math.max(
      Number(p.age),
      (p.lifestyle ?? "cca") === "cca" ? 55 : 40,
    );
    for (let m = Math.ceil(minimum * 12); m <= 80 * 12; m++) {
      const candidate = {
        ...p,
        retire: m / 12,
        cpfExtra: monthlyCPF,
        invest: monthlyInvestment,
      };
      // Avoid target-solving during the monthly search: simulate needs baseline metadata only.
      const age = Number(p.age),
        retire = m / 12,
        inflation = p.inflationRate ?? C.inflation,
        investmentReturn = p.returnRate ?? C.investmentReturn;
      const lifestyle = p.lifestyle ?? "cca",
        todaySpend = p.spend ?? lifestyles[lifestyle].budget;
      const summary = {
        age,
        retire,
        inflation,
        investmentReturn,
        lifestyle,
        todaySpend,
        plan: p.plan === "escalating" ? "escalating" : "standard",
        retiringNow: retire === age,
        futureSpend: expenseAt(
          todaySpend,
          age,
          retire - age,
          inflation,
          lifestyle,
        ),
        spend65: expenseAt(todaySpend, age, 65 - age, inflation, lifestyle),
        spend75: expenseAt(todaySpend, age, 75 - age, inflation, lifestyle),
        scenarios: [
          {
            key: selectedKey,
            cpfFunding: monthlyCPF,
            privateSaving: monthlyInvestment,
          },
        ],
      };
      const t = simulate(candidate, selectedKey, { summary });
      if (t.fullyFunded) return retire;
    }
    return null;
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
    result.post55OA = at(r.post55OA, 65);
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
            ? (1 + C.escalatingRate) ** Math.floor(r.retire - 65)
            : 1);
    const gap = Math.max(0, r.futureSpend - income);
    // All slices share the retirement date; never allocate more than the pot.
    const available = Math.min(
      s.privateTarget,
      s.illustratedPortfolio ?? s.privateTarget,
    );
    const cashReserve = Math.min(available, gap * 24);
    const ssbLadder = Math.min(
      Math.max(0, available - cashReserve),
      C.ssbCap,
      gap * 60,
    );
    const equityCore = Math.max(0, available - cashReserve - ssbLadder);
    const at = (value) => todayValue(value, r.retire, r.age, r.inflation);
    return {
      gap: at(gap),
      cashReserve: at(cashReserve),
      ssbLadder: at(ssbLadder),
      equityCore: at(equityCore),
    };
  }

  // Personalized Singapore outside-CPF priority waterfall & take-home pay allocation guide.
  function outsideAllocationGuide(summary, simulation) {
    const afterCpf = Math.max(0, summary.afterCpf || 0);
    const annualGross = summary.salary * 12;
    const annualEmployeeCpf = summary.employeeCpf * 12;
    const earnedIncomeRelief = 1000;
    const chargeableIncome = Math.max(
      0,
      annualGross - annualEmployeeCpf - earnedIncomeRelief,
    );
    const tax = residentTax(chargeableIncome);
    const netTakeHome = Math.max(0, afterCpf - tax.monthlyTax);
    const cpfExtra = simulation.cpfExtra || 0;
    const outsideMonthly = simulation.invest || 0;
    const totalSaving = cpfExtra + outsideMonthly;
    const pctAfterCpf =
      afterCpf > 0 ? Math.round((totalSaving / afterCpf) * 100) : 0;
    const pctNet =
      netTakeHome > 0 ? Math.round((totalSaving / netTakeHome) * 100) : 0;
    const leftForLiving = netTakeHome - totalSaving;

    let state;
    if (summary.retiringNow) {
      state = {
        key: "retired",
        label: "Retiring now",
        tone: "good",
      };
    } else if (totalSaving > afterCpf || pctAfterCpf > 85) {
      state = {
        key: "critical",
        label: "Critical (>85% of take-home)",
        tone: "danger",
      };
    } else if (pctAfterCpf > 50) {
      state = {
        key: "stretched",
        label: "Stretched (>50% of take-home)",
        tone: "warn",
      };
    } else if (pctAfterCpf > 30) {
      state = {
        key: "ambitious",
        label: "Ambitious (31–50% of take-home)",
        tone: "good",
      };
    } else {
      state = {
        key: "comfortable",
        label: "Comfortable (≤30% of take-home)",
        tone: "good",
      };
    }

    const sustainableMin = Math.round(netTakeHome * 0.2);
    const sustainableMax = Math.round(netTakeHome * 0.3);
    const usingBenchmark =
      !summary.retiringNow &&
      (outsideMonthly <= 0.5 || outsideMonthly > netTakeHome * 0.55);
    const allocPool = summary.retiringNow
      ? 0
      : usingBenchmark
        ? Math.round(netTakeHome * 0.25)
        : Math.round(outsideMonthly);

    const horizon = Math.max(0, summary.retire - summary.age);
    const rstuEligible = Math.min(C.rstuReliefCap, summary.currentTopupRoom);
    const rstuTaxSaved = Math.max(
      0,
      tax.annualTax - residentTax(chargeableIncome - rstuEligible).annualTax,
    );
    const srsTaxSaved = Math.max(
      0,
      tax.annualTax - residentTax(chargeableIncome - C.srsCap).annualTax,
    );
    const taxWorthIt = tax.marginalRate >= 0.07;

    let safeShare, srsShare;
    if (horizon >= 12) {
      safeShare = taxWorthIt ? 0.15 : 0.2;
      srsShare = taxWorthIt ? 0.25 : 0;
    } else if (horizon >= 5) {
      safeShare = 0.35;
      srsShare = taxWorthIt && horizon >= 6 ? 0.2 : 0;
    } else {
      safeShare = 0.65;
      srsShare = 0;
    }

    const srsMonthlyCap = C.srsCap / 12;
    const srsMonthly = Math.min(
      Math.round(allocPool * srsShare),
      srsMonthlyCap,
    );
    const safeMonthly = Math.round(allocPool * safeShare);
    const coreMonthly = Math.max(0, allocPool - safeMonthly - srsMonthly);

    return {
      afterCpf,
      tax,
      netTakeHome,
      cpfExtra,
      outsideMonthly,
      totalSaving,
      pctAfterCpf,
      pctNet,
      leftForLiving,
      state,
      sustainableMin,
      sustainableMax,
      usingBenchmark,
      allocPool,
      horizon,
      emergencyMin: Math.round(summary.todaySpend * 6),
      emergencyMax: Math.round(summary.todaySpend * 12),
      rstuEligible,
      rstuTaxSaved,
      srsTaxSaved,
      taxWorthIt,
      split: {
        safeMonthly,
        srsMonthly,
        coreMonthly,
      },
    };
  }

  const DEMO_PLAN = {
    lifestyle: "home-helper",
    age: 35,
    salary: 8500,
    annualBonus: 17000,
    retire: 55,
    spend: 3500,
    oa: 75000,
    sa: 55000,
    ma: 45000,
    housing: 0,
    equities: 120000,
    sgDividends: 20000,
    ssbCash: 35000,
    srs: 25000,
    srsAge: 63,
    srsAnnual: 6000,
    srsInvestedIn: "global",
    existingReliefs: 1000,
    targetEquityPct: 80,
    sgSleevePct: 10,
    plan: "standard",
    returnRate: 0.05,
    inflationRate: 0.03,
    post55Work: false,
  };

  function resolvePortfolioBuckets(p) {
    const hasBuckets =
      p.equities != null ||
      p.sgDividends != null ||
      p.ssbCash != null ||
      p.srs != null;
    if (hasBuckets) {
      const equities = Math.max(0, Number(p.equities || 0));
      const sgDividends = Math.max(0, Number(p.sgDividends || 0));
      const ssbCash = Math.max(0, Number(p.ssbCash || 0));
      const srs = Math.max(0, Number(p.srs || 0));
      return {
        hasBuckets: true,
        equities,
        sgDividends,
        ssbCash,
        srs,
        liquidOnly: equities + sgDividends + ssbCash,
        total: equities + sgDividends + ssbCash + srs,
      };
    }
    const total = Math.max(0, Number(p.savings || 0));
    const equities = total * 0.7;
    const sgDividends = total * 0.1;
    const ssbCash = total * 0.2;
    return {
      hasBuckets: false,
      equities,
      sgDividends,
      ssbCash,
      srs: 0,
      liquidOnly: total,
      total,
    };
  }

  function withEffectiveSavings(p) {
    const buckets = resolvePortfolioBuckets(p);
    return buckets.hasBuckets && p.savings == null
      ? { ...p, savings: buckets.total }
      : p;
  }

  // 2026 IRAS CPF RSTU vs SRS Tax Sweet-Spot Calculator
  function taxSweetSpot(p) {
    const salary = Math.max(0, Number(p.salary || 0));
    const annualBonus = Math.max(0, Number(p.annualBonus || 0));
    const annualGross = salary * 12 + annualBonus;
    const owAnnual = Math.min(salary, C.wageCap) * 12;
    const awSubject = Math.min(
      annualBonus,
      Math.max(0, C.annualWageCap - owAnnual),
    );
    const annualEmployeeCpf = (owAnnual + awSubject) * 0.2;
    const existingReliefs = Math.max(0, Number(p.existingReliefs ?? 1000));
    const totalBaseReliefs = Math.min(
      C.personalReliefCap,
      annualEmployeeCpf + existingReliefs,
    );
    const reliefCapRemaining = Math.max(
      0,
      C.personalReliefCap - totalBaseReliefs,
    );
    const chargeableIncome = Math.max(0, annualGross - totalBaseReliefs);
    const taxBefore = residentTax(chargeableIncome);
    const saRoom = Math.max(
      0,
      C.frs - Number(p.sa || 0) - Number(p.saInvested || 0),
    );
    const maxRstu = Math.min(C.rstuReliefCap, saRoom, reliefCapRemaining);
    const taxAfterRstu = residentTax(Math.max(0, chargeableIncome - maxRstu));
    const rstuTaxSaved = Math.max(
      0,
      taxBefore.annualTax - taxAfterRstu.annualTax,
    );
    const maxSrsAfterRstu = Math.min(
      C.srsCap,
      Math.max(0, reliefCapRemaining - maxRstu),
    );
    const maxSrsStandalone = Math.min(C.srsCap, reliefCapRemaining);
    const taxAfterBoth = residentTax(
      Math.max(0, chargeableIncome - maxRstu - maxSrsAfterRstu),
    );
    const srsTaxSavedAfterRstu = Math.max(
      0,
      taxAfterRstu.annualTax - taxAfterBoth.annualTax,
    );
    const srsStandaloneTaxSaved = Math.max(
      0,
      taxBefore.annualTax -
        residentTax(Math.max(0, chargeableIncome - maxSrsStandalone)).annualTax,
    );
    const combinedTaxSaved = Math.max(
      0,
      taxBefore.annualTax - taxAfterBoth.annualTax,
    );
    const srsLockInAge = Number(p.srsAge) === 64 ? 64 : 63;

    let tier, headline, guidance;
    if (reliefCapRemaining <= 0) {
      tier = "cap-reached";
      headline = "$80,000 IRAS personal relief cap already reached";
      guidance =
        "Mandatory CPF and existing reliefs already use the $80,000 personal relief cap. Invest extra cash in liquid Global UCITS ETFs or SSBs without locking funds.";
    } else if (chargeableIncome <= 40000) {
      tier = "liquid";
      headline = "Keep cash liquid — tax bracket ≤ 3.5% (≤ $40k chargeable)";
      guidance =
        "Your marginal IRAS rate is too low (0%–3.5%) to justify locking cash in CPF SA or SRS until 55/63–64. Prioritize liquid emergency cash and Global UCITS ETFs.";
    } else if (chargeableIncome <= 80000) {
      tier = "rstu-first";
      headline = "Prioritize CPF RSTU ($8,000/yr) first — 7% bracket";
      guidance =
        saRoom > 0
          ? `At a 7% marginal bracket, CPF RSTU (up to ${Math.round(maxRstu).toLocaleString("en-SG")}/yr into SA/RA) earns a guaranteed 4.0% floor plus immediate tax relief before considering SRS.`
          : "Your SA has already reached the 2026 FRS ($220,400), so RSTU gives $0 relief. Keep cash liquid or use SRS selectively if horizon to withdrawal is short.";
    } else {
      tier = "max-both";
      headline =
        "Max CPF RSTU ($8,000/yr) + SRS ($15,300/yr) — ≥ 11.5% bracket";
      guidance =
        "In the 11.5%+ bracket, locking tax-relieved dollars yields strong day-one tax alpha. Max RSTU (up to FRS) plus $15,300 SRS, and invest SRS immediately so it does not sit idle at 0.05%.";
    }

    return {
      annualGross,
      annualEmployeeCpf,
      existingReliefs,
      totalBaseReliefs,
      reliefCapUsed: totalBaseReliefs,
      reliefCapRemaining,
      chargeableIncome,
      taxBefore,
      saRoom,
      maxRstu,
      rstuTaxSaved,
      maxSrsAfterRstu,
      maxSrsStandalone,
      srsTaxSavedAfterRstu,
      srsStandaloneTaxSaved,
      combinedTaxSaved,
      srsLockInAge,
      srsInvestedIn: p.srsInvestedIn || "global",
      tier,
      headline,
      guidance,
      srsIdleWarning:
        "SRS cash earns only 0.05% p.a. unless invested in index funds, T-bills, or Singapore Savings Bonds.",
    };
  }

  // Holistic Boglehead 3-Fund (Singapore Edition) Allocator
  function bogleheadAllocation(p, monthlyInvest = 0) {
    const buckets = resolvePortfolioBuckets(p);
    const srsMode = p.srsInvestedIn || "global";
    const srsEqShare =
      srsMode === "global" ? 1 : srsMode === "balanced" ? 0.6 : 0;
    const srsEquities = buckets.srs * srsEqShare;
    const srsBonds = buckets.srs * (1 - srsEqShare);

    const globalEquities = buckets.equities + srsEquities;
    const sgDividends = buckets.sgDividends;
    const liquidBonds = buckets.ssbCash + srsBonds;
    const liquidTotal = globalEquities + sgDividends + liquidBonds;

    const cpfOA = Math.max(0, Number(p.oa || 0));
    const cpfSA = Math.max(0, Number(p.sa || 0));
    const cpfMA = Math.max(0, Number(p.ma || 0));
    const cpfTotal = cpfOA + cpfSA + cpfMA;

    const totalEquities = globalEquities + sgDividends;
    const totalBonds = liquidBonds + cpfTotal;
    const totalNetWorth = totalEquities + totalBonds;

    const targetEquityPct = Math.min(
      95,
      Math.max(20, Number(p.targetEquityPct ?? 80)),
    );
    const sgSleevePct = Math.min(15, Math.max(0, Number(p.sgSleevePct ?? 10)));
    const globalTargetShareOfEquities =
      targetEquityPct > 0
        ? Math.max(0, targetEquityPct - sgSleevePct) / targetEquityPct
        : 1;

    const effectiveEquityPct =
      totalNetWorth > 0 ? (totalEquities / totalNetWorth) * 100 : 0;
    const effectiveBondPct =
      totalNetWorth > 0 ? (totalBonds / totalNetWorth) * 100 : 0;
    const liquidEquityPct =
      liquidTotal > 0 ? (totalEquities / liquidTotal) * 100 : 0;
    const liquidBondPct =
      liquidTotal > 0 ? (liquidBonds / liquidTotal) * 100 : 0;

    const targetEquityAmt = totalNetWorth * (targetEquityPct / 100);
    const targetBondAmt = totalNetWorth - targetEquityAmt;
    const equityGap = targetEquityAmt - totalEquities;

    const investPool = Math.max(0, Number(monthlyInvest || 0));
    let buyGlobalMonthly = 0,
      buySgMonthly = 0,
      buyBondMonthly = 0,
      rebalanceNote = "";

    if (investPool <= 0.5) {
      rebalanceNote =
        equityGap > 500
          ? `Total portfolio is ${Math.round(effectiveEquityPct)}% equities vs ${targetEquityPct}% target because CPF anchors your bond floor. Direct new cash into Global UCITS ETFs.`
          : "Enter monthly outside savings in Step 3 to see exact monthly buy orders.";
    } else if (equityGap > investPool) {
      // Because CPF acts as fixed-income ballast, route 100% of new monthly cash to equities.
      buySgMonthly = Math.round(investPool * (1 - globalTargetShareOfEquities));
      buyGlobalMonthly = Math.max(0, Math.round(investPool) - buySgMonthly);
      rebalanceNote = `Because CPF holds ${Math.round(effectiveBondPct)}% of net worth in risk-free fixed income, route 100% of monthly liquid cash into equities (${Math.round(globalTargetShareOfEquities * 100)}% Global UCITS / ${Math.round((1 - globalTargetShareOfEquities) * 100)}% SG Dividends) until holistic ratio hits ${targetEquityPct}/${100 - targetEquityPct}.`;
    } else if (equityGap < -investPool) {
      buyBondMonthly = Math.round(investPool);
      rebalanceNote = `Your equities exceed your ${targetEquityPct}% holistic target by ${Math.round(-equityGap).toLocaleString("en-SG")}. Route new monthly cash into SSB / T-Bills or CPF to restore balance.`;
    } else {
      const eqShare = targetEquityPct / 100;
      const totalEqBuy = Math.round(investPool * eqShare);
      buySgMonthly = Math.round(totalEqBuy * (1 - globalTargetShareOfEquities));
      buyGlobalMonthly = Math.max(0, totalEqBuy - buySgMonthly);
      buyBondMonthly = Math.max(0, Math.round(investPool) - totalEqBuy);
      rebalanceNote = `Holistic Stock/Bond ratio is near your ${targetEquityPct}/${100 - targetEquityPct} target. Split monthly cash proportionally across Global UCITS, SG sleeve, and SSB/T-Bills.`;
    }

    return {
      buckets,
      srsMode,
      liquid: {
        total: liquidTotal,
        globalEquities,
        sgDividends,
        bondsCash: liquidBonds,
        equityPct: liquidEquityPct,
        bondPct: liquidBondPct,
      },
      cpf: {
        oa: cpfOA,
        sa: cpfSA,
        ma: cpfMA,
        total: cpfTotal,
      },
      holistic: {
        totalNetWorth,
        globalEquities,
        sgDividends,
        liquidBonds,
        cpfTotal,
        totalEquities,
        totalBonds,
        effectiveEquityPct,
        effectiveBondPct,
        targetEquityPct,
        targetBondPct: 100 - targetEquityPct,
        sgSleevePct,
        targetEquityAmt,
        targetBondAmt,
        equityGap,
      },
      monthlyRebalance: {
        investPool,
        buyGlobalMonthly,
        buySgMonthly,
        buyBondMonthly,
        note: rebalanceNote,
      },
    };
  }

  // Two-Phase FIRE + 1M65 Bridge + Stacked Net Worth & Cashflow Waterfall (Age Now -> 95)
  function firePlan(p, selectedKey = "salary", options = {}) {
    const effP = withEffectiveSavings(p);
    const summary = options.summary || calculate(effP);
    const sim = options.simulation || simulate(effP, selectedKey, { summary });
    const buckets = resolvePortfolioBuckets(p);

    const age = summary.age;
    const retire = summary.retire;
    const endAge = C.fireEndAge;
    const inflation = summary.inflation;
    const investmentReturn = summary.investmentReturn;
    const lifestyle = summary.lifestyle;
    const plan = summary.plan;
    const todaySpend = summary.todaySpend;
    const rate = monthlyRate(investmentReturn);
    const srsWithdrawalAge = Number(p.srsAge) === 64 ? 64 : 63;
    const srsRate =
      p.srsInvestedIn === "cash" ? monthlyRate(C.srsIdleRate) : rate;

    const payout65 = sim.selectedScenario.payout;
    const retireMonth = Math.round((retire - age) * 12);
    const endMonth = (endAge - age) * 12;

    // Exact Phase 1 Bridge PV at Target FIRE Age (retire -> 65)
    let bridgeCorpusAtRetire = 0;
    if (retire < 65) {
      const bridgeMonths = Math.round((65 - retire) * 12);
      for (let m = 1; m <= bridgeMonths; m++) {
        const t = (m - 1) / 12;
        const spendM = expenseAt(
          todaySpend,
          age,
          retire - age + t,
          inflation,
          lifestyle,
        );
        bridgeCorpusAtRetire += spendM / (1 + rate) ** m;
      }
    }
    const bridgeCorpusToday = todayValue(
      bridgeCorpusAtRetire,
      retire,
      age,
      inflation,
    );

    // Exact Phase 2 PV at Phase 2 start (max(retire, 65) -> 95) discounted to retire & today
    const phase2StartAge = Math.max(retire, 65);
    let pvAtPhase2Start = 0;
    const phase2Months = Math.round((endAge - phase2StartAge) * 12);
    for (let m = 1; m <= phase2Months; m++) {
      const curAge = phase2StartAge + (m - 1) / 12;
      const spendM = expenseAt(
        todaySpend,
        age,
        curAge - age,
        inflation,
        lifestyle,
      );
      const cpfElapsed = Math.floor(curAge - 65 + 1e-9);
      const cpfM =
        plan === "escalating"
          ? payout65 * (1 + C.escalatingRate) ** cpfElapsed
          : payout65;
      const gapM = Math.max(0, spendM - cpfM);
      pvAtPhase2Start += gapM / (1 + rate) ** m;
    }
    const monthsRetireTo65 = Math.max(0, Math.round((65 - retire) * 12));
    const phase2CorpusAtRetire =
      pvAtPhase2Start / (1 + rate) ** monthsRetireTo65;
    const phase2CorpusToday = todayValue(
      phase2CorpusAtRetire,
      retire,
      age,
      inflation,
    );

    const fireNumberAtRetire = bridgeCorpusAtRetire + phase2CorpusAtRetire;
    const fireNumberToday = todayValue(
      fireNumberAtRetire,
      retire,
      age,
      inflation,
    );

    // Map CPF ledger up to age 65 and continue OA/MA/RA reserve through age 95
    const cpfByAge = new Map();
    for (const row of sim.cpfResult.ledger) {
      if (Number.isInteger(row.age)) cpfByAge.set(row.age, row);
    }

    const srsAnnualPlanned = Math.min(
      C.srsCap,
      Math.max(0, Number(p.srsAnnual || 0)),
    );
    const monthlySrsContrib = srsAnnualPlanned / 12;
    const targetEqShare = Math.min(
      0.95,
      Math.max(0.2, Number(p.targetEquityPct ?? 80) / 100),
    );
    const totalMonthlyOutside = sim.invest;
    const monthlyLiquidContrib = Math.max(
      0,
      totalMonthlyOutside - monthlySrsContrib,
    );

    let liquidEquities = buckets.equities + buckets.sgDividends;
    let ssbCash = buckets.ssbCash;
    let srs = buckets.srs;

    let cpfOA = Number(p.oa || 0);
    let cpfSARA = Number(p.sa || 0);
    let cpfMA = Number(p.ma || 0);
    let cpfAnnuity = 0;

    let outsideAtRetire = buckets.total;
    let depletionAge = null;
    const points = [];

    for (let m = 0; m <= endMonth; m++) {
      const curAge = age + m / 12;
      const retired = m >= retireMonth;
      const cpfElapsed = curAge >= 65 ? Math.floor(curAge - 65 + 1e-9) : 0;
      const monthlyCpfLife =
        curAge < 65
          ? 0
          : payout65 *
            (plan === "escalating" ? (1 + C.escalatingRate) ** cpfElapsed : 1);
      const monthlySpend = expenseAt(
        todaySpend,
        age,
        m / 12,
        inflation,
        lifestyle,
      );

      let monthlySrsDraw = 0;
      let monthlyLiquidDraw = 0;
      let monthlyShortfall = 0;
      if (retired) {
        const need = Math.max(0, monthlySpend - monthlyCpfLife);
        if (
          curAge >= srsWithdrawalAge &&
          curAge < srsWithdrawalAge + 10 &&
          srs > 0
        ) {
          const remSrsMonths = Math.max(
            1,
            Math.round((srsWithdrawalAge + 10 - curAge) * 12),
          );
          const scheduledSrs = srs / remSrsMonths;
          const bridgeBoost =
            curAge < 65 ? C.srsTaxFreeAnnual / 12 : scheduledSrs;
          monthlySrsDraw = Math.min(
            srs,
            need,
            Math.max(scheduledSrs, bridgeBoost),
          );
        }
        const needAfterSrs = Math.max(0, need - monthlySrsDraw);
        const totalLiquid = liquidEquities + ssbCash;
        monthlyLiquidDraw = Math.min(totalLiquid, needAfterSrs);
        monthlyShortfall = Math.max(0, needAfterSrs - monthlyLiquidDraw);
        if (monthlyShortfall > 0.05 && depletionAge === null) {
          depletionAge = curAge;
        }
      }

      if (m === retireMonth) {
        outsideAtRetire = liquidEquities + ssbCash + srs;
      }

      if (m % 12 === 0) {
        const intAge = Math.round(curAge);
        const year = C.year + Math.floor((C.startMonth + m) / 12);
        if (intAge <= 65 && cpfByAge.has(intAge)) {
          const row = cpfByAge.get(intAge);
          cpfOA = row.oa;
          cpfSARA = intAge < 55 ? row.sa : row.ra;
          cpfMA = row.ma;
          cpfAnnuity = intAge === 65 ? row.ra : 0;
        } else if (intAge > 65) {
          cpfOA = cpfOA * (1 + C.oaRate);
          cpfMA = cpfMA * (1 + C.saRate);
          cpfAnnuity = Math.max(
            0,
            cpfAnnuity * (1 + C.saRate) - monthlyCpfLife * 12,
          );
          cpfSARA = cpfAnnuity;
        }
        const cpfTotal = cpfOA + cpfSARA + cpfMA;
        const totalOutside = liquidEquities + ssbCash + srs;
        const totalNetWorth = totalOutside + cpfTotal;
        const disc = (val) => todayValue(val, intAge, age, inflation);
        points.push({
          age: intAge,
          year,
          phase:
            intAge < retire
              ? "accumulating"
              : intAge < 65
                ? "bridge"
                : "phase2",
          monthlySpend,
          monthlyCpfLife,
          monthlySrsDraw,
          monthlyLiquidDraw,
          monthlyTotalIncome:
            monthlyCpfLife + monthlySrsDraw + monthlyLiquidDraw,
          monthlyShortfall,
          liquidEquities,
          ssbCash,
          srs,
          cpfOA,
          cpfSARA,
          cpfMA,
          cpfTotal,
          totalOutside,
          totalNetWorth,
          today: {
            monthlySpend: disc(monthlySpend),
            monthlyCpfLife: disc(monthlyCpfLife),
            monthlySrsDraw: disc(monthlySrsDraw),
            monthlyLiquidDraw: disc(monthlyLiquidDraw),
            monthlyTotalIncome: disc(
              monthlyCpfLife + monthlySrsDraw + monthlyLiquidDraw,
            ),
            monthlyShortfall: disc(monthlyShortfall),
            liquidEquities: disc(liquidEquities),
            ssbCash: disc(ssbCash),
            srs: disc(srs),
            cpfOA: disc(cpfOA),
            cpfSARA: disc(cpfSARA),
            cpfMA: disc(cpfMA),
            cpfTotal: disc(cpfTotal),
            totalOutside: disc(totalOutside),
            totalNetWorth: disc(totalNetWorth),
          },
        });
      }

      if (m === endMonth) break;
      if (!retired) {
        liquidEquities =
          liquidEquities * (1 + rate) + monthlyLiquidContrib * targetEqShare;
        ssbCash =
          ssbCash * (1 + rate) + monthlyLiquidContrib * (1 - targetEqShare);
        srs = srs * (1 + srsRate) + monthlySrsContrib;
      } else {
        const totalLiquid = liquidEquities + ssbCash;
        const eqRatio = totalLiquid > 0 ? liquidEquities / totalLiquid : 0;
        const eqDraw = monthlyLiquidDraw * eqRatio;
        const cashDraw = monthlyLiquidDraw - eqDraw;
        liquidEquities = Math.max(0, liquidEquities * (1 + rate) - eqDraw);
        ssbCash = Math.max(0, ssbCash * (1 + rate) - cashDraw);
        srs = Math.max(0, srs * (1 + srsRate) - monthlySrsDraw);
      }
    }

    const ptAt65 = points.find((pt) => pt.age === 65) || points.at(-1);
    const ptAt55 = points.find((pt) => pt.age === 55);
    const outsideAtRetireToday = todayValue(
      outsideAtRetire,
      retire,
      age,
      inflation,
    );
    const pctFunded =
      fireNumberToday > 0
        ? Math.round((outsideAtRetireToday / fireNumberToday) * 100)
        : 100;
    const currentFirePct =
      fireNumberToday > 0
        ? Math.min(100, Math.round((buckets.total / fireNumberToday) * 100))
        : 100;

    // Earliest FIRE age where accumulated outside pot (saving until candidate age) funds Phase 1 + Phase 2 to 95
    let projectedFireAge = null;
    const minFireAge = Math.max(age, lifestyle === "cca" ? 55 : 40);
    const liquidStart =
      buckets.equities + buckets.sgDividends + buckets.ssbCash;
    for (let cand = minFireAge; cand <= 80; cand++) {
      const candMonths = Math.round((cand - age) * 12);
      const liquidAtCand =
        liquidStart * (1 + rate) ** candMonths +
        monthlyLiquidContrib * annuityFactor(rate, candMonths);
      const srsAtCand =
        buckets.srs * (1 + srsRate) ** candMonths +
        monthlySrsContrib * annuityFactor(srsRate, candMonths);
      const potAtCand = liquidAtCand + srsAtCand;
      let reqBridge = 0;
      if (cand < 65) {
        for (let m = 1; m <= (65 - cand) * 12; m++) {
          const sp = expenseAt(
            todaySpend,
            age,
            cand - age + (m - 1) / 12,
            inflation,
            lifestyle,
          );
          reqBridge += sp / (1 + rate) ** m;
        }
      }
      const p2Start = Math.max(cand, 65);
      let reqP2 = 0;
      for (let m = 1; m <= (endAge - p2Start) * 12; m++) {
        const curA = p2Start + (m - 1) / 12;
        const sp = expenseAt(todaySpend, age, curA - age, inflation, lifestyle);
        const cEl = Math.floor(curA - 65 + 1e-9);
        const cP =
          plan === "escalating"
            ? payout65 * (1 + C.escalatingRate) ** cEl
            : payout65;
        reqP2 += Math.max(0, sp - cP) / (1 + rate) ** m;
      }
      const reqTotal =
        reqBridge + reqP2 / (1 + rate) ** Math.max(0, (65 - cand) * 12);
      if (potAtCand + 1 >= reqTotal) {
        projectedFireAge = cand;
        break;
      }
    }

    const requiredMonthlyTo95 = requiredSaving(
      fireNumberAtRetire,
      buckets.total,
      rate,
      retireMonth,
    );

    const fmt = (v) => `$${Math.round(Math.max(0, v)).toLocaleString("en-SG")}`;
    const totalMonthlySaving = sim.cpfExtra + sim.invest;
    const elevatorPitch = `I need ${fmt(fireNumberToday)} in outside & SRS investments (${retire < 65 ? `${fmt(bridgeCorpusToday)} bridge for ages ${retire}–65 + ` : ""}${fmt(phase2CorpusToday)} to top up my ${fmt(todayValue(payout65, 65, age, inflation))}/mo CPF LIFE floor) to retire at age ${retire}. With ${fmt(buckets.total)} invested today${totalMonthlySaving > 0 ? ` and ${fmt(totalMonthlySaving)}/mo saved` : ""}, I’m ${pctFunded}% funded at ${retire}${projectedFireAge != null ? ` and hit financial independence at age ${projectedFireAge}` : ""}.`;

    return {
      age,
      retire,
      endAge,
      srsWithdrawalAge,
      bridge: {
        years: Math.max(0, 65 - retire),
        requiredAtRetire: bridgeCorpusAtRetire,
        requiredToday: bridgeCorpusToday,
      },
      phase2: {
        years: endAge - 65,
        requiredAtRetire: phase2CorpusAtRetire,
        requiredToday: phase2CorpusToday,
        cpfLife65Nominal: payout65,
        cpfLife65Today: todayValue(payout65, 65, age, inflation),
        projectedCpfAt65Nominal: ptAt65 ? ptAt65.cpfTotal : 0,
        projectedCpfAt65Today: ptAt65 ? ptAt65.today.cpfTotal : 0,
      },
      fireNumber: {
        totalRequiredAtRetire: fireNumberAtRetire,
        totalRequiredToday: fireNumberToday,
        requiredMonthlyTo95,
        projectedOutsideAtRetireNominal: outsideAtRetire,
        projectedOutsideAtRetireToday: outsideAtRetireToday,
        shortfallToday: Math.max(0, fireNumberToday - outsideAtRetireToday),
        pctFunded,
        currentFirePct,
        projectedFireAge,
        depletionAge,
        fullyFundedTo95: depletionAge === null,
      },
      milestones: {
        targetFireAge: retire,
        age55: ptAt55
          ? {
              age: 55,
              frs: summary.frs,
              ers: summary.ers,
              ra55: ptAt55.cpfSARA,
              oaOverflow: ptAt55.cpfOA,
            }
          : null,
        srsAge: srsWithdrawalAge,
        age65: {
          age: 65,
          cpfLifeToday: todayValue(payout65, 65, age, inflation),
          cpfTotalToday: ptAt65 ? ptAt65.today.cpfTotal : 0,
        },
      },
      points,
      elevatorPitch,
    };
  }

  function generateTrajectory(p, selectedKey = "salary") {
    return simulate(p, selectedKey);
  }

  const api = {
    C,
    DEMO_PLAN,
    residentTax,
    outsideAllocationGuide,
    resolvePortfolioBuckets,
    taxSweetSpot,
    bogleheadAllocation,
    firePlan,
    retirementSum,
    annuityFactor,
    extraInterest,
    payoutFrom65,
    projectCPF,
    simulate,
    earliestRetirement,
    compareTopupTiming,
    milestonePlan,
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
