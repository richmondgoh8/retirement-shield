/* Fixed, disclosed planning assumptions; no personal data leaves the browser. */
(function (root) {
  const fmtSgd = (v) =>
    `$${Math.round(Math.max(0, Number(v) || 0)).toLocaleString("en-SG")}`;
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
    cpfAnnualLimit: 37740,
    escalatingRate: 0.02,
    escalatingRatio: 0.8,
    sdicCap: 100000,
    ssbCap: 200000,
    srsCap: 15300,
    srsIdleRate: 0.0005,
    srsTaxFreeAnnual: 40000,
    rstuReliefCap: 8000,
    familyRstuReliefCap: 8000,
    personalReliefCap: 80000,
    ssbTargetBuffer: 150000,
    srsSoftCapAt63: 400000,
    srsTrapFloorAt63: 450000,
    srsTrapCeilingAt63: 500000,
    cpfLifeTargetRef: 2200,
    equityTapMinRef: 1200,
    equityTapMaxRef: 2200,
    oaInterestRefBalance: 500000,
    oaInterestRefMonthly: 1000,
    defaultGlobalEquitySplitPct: 85,
    defaultSgDividendSplitPct: 15,
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
    cca: { label: "Community Care Apartments", budget: 2800 },
    "home-helper": { label: "Home + Helper", budget: 3900 },
  };

  const EXPENSE_CATEGORIES = [
    { key: "housing", label: "Home & Utilities", color: "#0891B2" },
    { key: "food", label: "Food & Dining", color: "#2563EB" },
    { key: "digital", label: "Telco, WiFi & Subscriptions", color: "#7C3AED" },
    { key: "transport", label: "Transport & Rides", color: "#0284C7" },
    { key: "care", label: "Healthcare, Insurance & Care", color: "#059669" },
    { key: "lifestyle", label: "Lifestyle, Travel & Buffer", color: "#D97706" },
  ];

  function defaultExpenseItems(lifestyle = "cca", targetTotal = null) {
    const key = lifestyle === "home-helper" ? "home-helper" : "cca";
    const baseBudget = lifestyles[key].budget;
    const rawItems =
      key === "cca"
        ? [
            {
              id: "cca-housing",
              name: "Utilities (SP electricity, water) & S&CC",
              category: "housing",
              amount: 140,
            },
            {
              id: "cca-hdb-ins",
              name: "HDB fire & home contents insurance",
              category: "housing",
              amount: 10,
            },
            {
              id: "cca-groceries",
              name: "Groceries & household essentials",
              category: "food",
              amount: 420,
            },
            {
              id: "cca-dining",
              name: "Hawker meals, cafés & dining out",
              category: "food",
              amount: 380,
            },
            {
              id: "cca-wifi",
              name: "Fibre WiFi & SIM-only mobile plan",
              category: "digital",
              amount: 40,
            },
            {
              id: "cca-streaming",
              name: "Streaming & digital (Netflix, Spotify, cloud)",
              category: "digital",
              amount: 32,
            },
            {
              id: "cca-transport",
              name: "MRT / bus & occasional Grab rides",
              category: "transport",
              amount: 115,
            },
            {
              id: "cca-health",
              name: "AIA HealthShield Max + HSG Max Rider",
              category: "care",
              amount: 153,
            },
            {
              id: "cca-life-ins",
              name: "GE Supreme Multiplier Life (whole life + CI)",
              category: "care",
              amount: 260,
            },
            {
              id: "cca-pa-term",
              name: "Accident & Term policy (PA + term life)",
              category: "care",
              amount: 45,
            },
            {
              id: "cca-supplements",
              name: "Daily supplement stack (Omega-3, D3+K2, Magnesium, Multi)",
              category: "care",
              amount: 35,
            },
            {
              id: "cca-bsp",
              name: "CCA Basic Service Package",
              category: "care",
              amount: 175,
            },
            {
              id: "cca-help",
              name: "Extra care & ad-hoc home help",
              category: "care",
              amount: 285,
            },
            {
              id: "cca-social",
              name: "Personal care, haircuts, fitness & social",
              category: "lifestyle",
              amount: 180,
            },
            {
              id: "cca-repairs",
              name: "Aircon servicing, home repairs & appliances",
              category: "lifestyle",
              amount: 120,
            },
            {
              id: "cca-buffer",
              name: "Annual travel fund & contingency buffer",
              category: "lifestyle",
              amount: 410,
            },
          ]
        : [
            {
              id: "hh-housing",
              name: "Utilities (SP electricity, water, gas) & S&CC",
              category: "housing",
              amount: 200,
            },
            {
              id: "hh-hdb-ins",
              name: "HDB insurance (HPS, fire & contents)",
              category: "housing",
              amount: 20,
            },
            {
              id: "hh-groceries",
              name: "Groceries & wet market (for two)",
              category: "food",
              amount: 480,
            },
            {
              id: "hh-dining",
              name: "Hawker meals, dining out & GrabFood",
              category: "food",
              amount: 320,
            },
            {
              id: "hh-wifi",
              name: "Home fibre WiFi & two mobile plans",
              category: "digital",
              amount: 55,
            },
            {
              id: "hh-streaming",
              name: "Streaming, news & cloud (Netflix, YouTube, apps)",
              category: "digital",
              amount: 45,
            },
            {
              id: "hh-transport",
              name: "MRT / bus & point-to-point Grab rides",
              category: "transport",
              amount: 130,
            },
            {
              id: "hh-health",
              name: "AIA HealthShield Max + HSG Max Rider",
              category: "care",
              amount: 153,
            },
            {
              id: "hh-life-ins",
              name: "GE Supreme Multiplier Life (whole life + CI)",
              category: "care",
              amount: 300,
            },
            {
              id: "hh-pa-term",
              name: "Accident & Term policy (PA + term life)",
              category: "care",
              amount: 50,
            },
            {
              id: "hh-supplements",
              name: "Daily supplement stack (Omega-3, D3+K2, Magnesium, Multi)",
              category: "care",
              amount: 35,
            },
            {
              id: "hh-helper",
              name: "Helper: salary, FDW levy & insurance",
              category: "care",
              amount: 1230,
            },
            {
              id: "hh-social",
              name: "Personal care, haircuts, social & hobbies",
              category: "lifestyle",
              amount: 192,
            },
            {
              id: "hh-repairs",
              name: "Aircon servicing, home repairs & appliances",
              category: "lifestyle",
              amount: 150,
            },
            {
              id: "hh-buffer",
              name: "Annual travel fund & contingency buffer",
              category: "lifestyle",
              amount: 540,
            },
          ];
    const desired =
      targetTotal != null && Number.isFinite(Number(targetTotal))
        ? Math.max(0, Number(targetTotal))
        : baseBudget;
    if (Math.abs(desired - baseBudget) < 0.01) {
      return rawItems.map((it) => ({ ...it }));
    }
    return scaleExpenseItems(rawItems, desired, key);
  }

  function scaleExpenseItems(items, targetTotal, lifestyle = "cca") {
    const desired = Math.max(
      0,
      Math.round((Number(targetTotal) || 0) * 100) / 100,
    );
    const baseSum = (items || []).reduce(
      (s, it) => s + Math.max(0, Number(it?.amount) || 0),
      0,
    );
    if (!items?.length || (baseSum <= 0 && desired > 0)) {
      return defaultExpenseItems(lifestyle, desired);
    }
    if (desired === 0) {
      return items.map((it) => ({ ...it, amount: 0 }));
    }
    const factor = desired / baseSum;
    const scaled = items.map((it) => ({
      ...it,
      amount:
        Math.round(Math.max(0, Number(it?.amount) || 0) * factor * 100) / 100,
    }));
    const currentSum = scaled.reduce((s, it) => s + it.amount, 0);
    const diff = Math.round((desired - currentSum) * 100) / 100;
    if (Math.abs(diff) > 0 && scaled.length) {
      let maxIdx = 0;
      for (let i = 1; i < scaled.length; i++) {
        if (scaled[i].amount > scaled[maxIdx].amount) maxIdx = i;
      }
      scaled[maxIdx].amount = Math.max(
        0,
        Math.round((scaled[maxIdx].amount + diff) * 100) / 100,
      );
    }
    return scaled;
  }

  function expensePlan({
    lifestyle = "cca",
    spend = null,
    itemizedActive = false,
    customExpenses = null,
    afterCpf = 0,
    customActive = false,
  } = {}) {
    const key = lifestyle === "home-helper" ? "home-helper" : "cca";
    const baseBudget = lifestyles[key].budget;
    const validCatKeys = new Set(EXPENSE_CATEGORIES.map((c) => c.key));
    const catAliases = { living: "food", buffer: "lifestyle" };
    const sanitizeCustom = (list) =>
      list.map((row, idx) => {
        const mappedCat = catAliases[row?.category] || row?.category;
        return {
          id: String(row?.id || "item-" + (idx + 1)),
          name:
            String(row?.name || "Expense " + (idx + 1)).trim() ||
            "Expense " + (idx + 1),
          category: validCatKeys.has(mappedCat) ? mappedCat : "food",
          amount: Math.max(
            0,
            Math.round((Number(row?.amount) || 0) * 100) / 100,
          ),
        };
      });

    const hasCustomList =
      Boolean(itemizedActive) &&
      Array.isArray(customExpenses) &&
      customExpenses.length > 0;

    let rawRows;
    let sourceMode;
    let isCustom = false;
    if (hasCustomList) {
      sourceMode = "itemized";
      isCustom = true;
      rawRows = sanitizeCustom(customExpenses);
    } else {
      const numericSpend =
        spend != null && Number.isFinite(Number(spend))
          ? Math.max(0, Number(spend))
          : baseBudget;
      isCustom =
        Boolean(customActive) || Math.abs(numericSpend - baseBudget) >= 0.01;
      sourceMode = isCustom ? "scaled" : "preset";
      if (
        isCustom &&
        Array.isArray(customExpenses) &&
        customExpenses.length > 0
      ) {
        rawRows = scaleExpenseItems(
          sanitizeCustom(customExpenses),
          numericSpend,
          key,
        );
      } else {
        rawRows = defaultExpenseItems(key, numericSpend);
      }
    }

    const total =
      Math.round(rawRows.reduce((sum, it) => sum + it.amount, 0) * 100) / 100;
    const denom = total > 0 ? total : 1;
    const items = rawRows.map((it) => ({
      ...it,
      pct: total > 0 ? Math.round((it.amount / denom) * 1000) / 10 : 0,
    }));

    const categories = EXPENSE_CATEGORIES.map((cat) => {
      const catItems = items.filter((it) => it.category === cat.key);
      const amount =
        Math.round(catItems.reduce((s, it) => s + it.amount, 0) * 100) / 100;
      const pct = total > 0 ? Math.round((amount / denom) * 1000) / 10 : 0;
      return {
        ...cat,
        amount,
        pct,
        items: catItems,
      };
    });

    const netPay = Math.max(0, Number(afterCpf) || 0);
    const takeHomePct = netPay > 0 ? Math.round((total / netPay) * 100) : 0;

    return {
      lifestyle: key,
      lifestyleLabel: lifestyles[key].label,
      sourceMode,
      isCustom,
      itemizedActive: hasCustomList,
      total,
      categories,
      items,
      afterCpf: netPay,
      takeHomePct,
      remainingAfterSpend: netPay - total,
    };
  }

  // Match the supplied category midpoints at 65 and ten years later at 75.
  // Keep the $300 levy fixed; model general prices and an additional care-age allowance.
  const careAgeFactor = (age) =>
    ((4260 - 300) / (3090 - 300) / 1.03 ** 10) ** (Math.max(0, age - 65) / 10);

  // AIA HealthShield Gold Max A + Max VitalHealth Pro A (Oct 2026 SC/SPR schedule, incl. 9% GST)
  const AIA_HEALTHSHIELD_BANDS = [
    [20, 105],
    [25, 113],
    [30, 121],
    [35, 153],
    [40, 158],
    [45, 248],
    [50, 268],
    [55, 381],
    [60, 466],
    [65, 621],
    [70, 861],
    [73, 1092],
    [75, 1216],
    [78, 1425],
    [80, 1568],
    [83, 1663],
    [85, 1730],
    [88, 1786],
    [90, 1821],
    [93, 1841],
    [120, 1862],
  ];

  function healthShieldMonthlyAtAge(age) {
    const a = Number(age) || 0;
    for (const [maxAge, amt] of AIA_HEALTHSHIELD_BANDS) {
      if (a <= maxAge) return amt;
    }
    return AIA_HEALTHSHIELD_BANDS[AIA_HEALTHSHIELD_BANDS.length - 1][1];
  }

  // Age-adjusted spending curve in today dollars (excluding Home + Helper fixed $300 levy):
  // Smoothly absorbs HealthShield climbs against limited-pay GE Life & PA/Term finishing by 65,
  // then steps through the exact AIA HealthShield brackets from 65 to 95 alongside non-insurance care growth.
  function insuranceCurveLevelAtAge(age, lifestyle = "home-helper") {
    const isCca = lifestyle === "cca";
    const base35 = isCca
      ? lifestyles.cca.budget
      : lifestyles["home-helper"].budget;
    const levy = isCca ? 0 : 300;
    const ins35 = isCca ? 458 : 503; // $153 HS + $260/$300 GE Life + $45/$50 PA/Term
    const ins65 = healthShieldMonthlyAtAge(65); // $621 HS; GE Life & PA/Term finished by 65
    let ins;
    if (age <= 35) {
      ins = ins35;
    } else if (age < 65) {
      ins = ins35 + ((ins65 - ins35) * (age - 35)) / 30;
    } else {
      ins = healthShieldMonthlyAtAge(age);
    }
    const nonIns35 = base35 - levy - ins35;
    const careAfter65 = isCca
      ? (3000 / 2500) ** (Math.max(0, age - 65) / 10)
      : careAgeFactor(age);
    return nonIns35 * careAfter65 + ins;
  }

  function expenseAt(
    spend,
    startAge,
    elapsed,
    inflation = C.inflation,
    lifestyle = "home-helper",
    opts = {},
  ) {
    const inf = typeof inflation === "number" ? inflation : C.inflation;
    const useInsCurve = Boolean(
      opts && typeof opts === "object" && opts.insuranceCurve,
    );
    if (useInsCurve) {
      const curAge = startAge + elapsed;
      const ratio =
        insuranceCurveLevelAtAge(curAge, lifestyle) /
        insuranceCurveLevelAtAge(startAge, lifestyle);
      if (lifestyle === "cca") {
        return spend * (1 + inf) ** elapsed * ratio;
      }
      const levy = Math.min(300, spend);
      return (spend - levy) * (1 + inf) ** elapsed * ratio + levy;
    }
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
    const insuranceCurve = Boolean(
      typeof opts === "object" && opts.insuranceCurve,
    );
    const bridgeIncomeAtRetire =
      typeof opts === "object" && Number.isFinite(opts.bridgeIncomeAtRetire)
        ? Math.max(0, Number(opts.bridgeIncomeAtRetire))
        : 0;
    const expOpts = { insuranceCurve };
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
      const bridge =
        currentAge < 65 && bridgeIncomeAtRetire > 0
          ? bridgeIncomeAtRetire * (1 + inflation) ** t
          : 0;
      target +=
        Math.max(
          0,
          expenseAt(spend, retirementAge, t, inflation, lifestyle, expOpts) -
            cpf -
            bridge,
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
              : age <= 65
                ? year >= 2027
                  ? [0.1347, 0.4615, 0.26]
                  : [0.14, 0.44, 0.25]
                : age <= 70
                  ? [0.0607, 0.303, 0.165]
                  : [0.08, 0.08, 0.125];
  }

  function employeeCpfRate(age, year = C.year) {
    if (age <= 55) return 0.2;
    if (age <= 60) return year >= 2027 ? 0.19 : 0.18;
    if (age <= 65) return year >= 2027 ? 0.13 : 0.125;
    if (age <= 70) return 0.075;
    return 0.05;
  }

  function extraInterest(balances, age) {
    const result = { oa: 0, sa: 0, ma: 0, ra: 0 };
    let used = 0;
    for (const key of ["ra", "oa", "sa", "ma"]) {
      const eligible = Math.min(
        key === "oa" ? 20000 : Infinity,
        Math.max(0, balances[key] || 0),
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
    // A savings milestone does not elect a property-backed withdrawal.
    const target = goal === "ers" ? 2 * frs : goal === "brs" ? 0.5 * frs : frs;
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
    let snapshot55,
      goalAge = null,
      reserveDeposits = 0,
      raSweepAt65 = 0,
      bhs65 = C.bhs * (1 + C.bhsGrowth) ** (65 - age);
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
          cpfAt55: Math.min(frs, originalOA + originalSA),
          availableAt55: originalOA + originalSA,
          reserve,
        };
        if (goal === "ers") {
          b.oa -= creditRA(b.oa, target);
        }
        const reserveTransfer = creditRA(reserve, target);
        reserve -= reserveTransfer;
        totalTopups += reserveTransfer;
        if (forcedAt55 != null) {
          b.ra = Math.max(b.ra, forcedAt55);
          principal = b.ra;
          pending.ra = 0;
          closedSAInterest = 0;
        }
        snapshot55.fundedRA = b.ra;
        snapshot55.oaAfter55 = b.oa;
        snapshot55.remainingReserve = reserve;
      }
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
        bhs65 = bhs;
        for (const key of Object.keys(b)) {
          b[key] += pending[key];
          pending[key] = 0;
        }
        if (closedSAInterest > 0) {
          addRetirement(closedSAInterest, frs, false);
          closedSAInterest = 0;
        }
        const overflow65 = Math.max(0, b.ma - bhs);
        if (overflow65 > 0) {
          b.ma -= overflow65;
          addRetirement(overflow65, frs, false);
        }
        // For these birth cohorts, OA is transferred up to RA requirement when payouts start.
        raSweepAt65 = creditRA(b.oa, frs);
        b.oa -= raSweepAt65;
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
      const owWage = working ? Math.min(Number(p.salary), C.wageCap) : 0;
      const awSubjectAnnual = working
        ? Math.min(
            Math.max(0, Number(p.annualBonus || 0)),
            Math.max(0, C.annualWageCap - owWage * 12),
          )
        : 0;
      const owContribution = owWage * totalRate;
      const awContribution = (awSubjectAnnual / 12) * totalRate;
      const contribution = owContribution + awContribution;
      const incoming = {
        oa: contribution * o,
        sa: 0,
        ra: 0,
        ma: contribution * (1 - o - r),
      };
      if (before55) incoming.sa = contribution * r;
      else {
        // Compute capped RA addition without mutating b.ra before interest eligibility is snapshotted.
        incoming.ra = Math.min(contribution * r, Math.max(0, frs - principal));
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
      const housingMonths =
        p.housingYears == null
          ? Infinity
          : Math.max(0, Math.round(Number(p.housingYears) * 12));
      const housing =
        m >= housingMonths
          ? 0
          : p.housing == null
            ? owContribution * o
            : Number(p.housing);
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
      principal += incoming.ra;
      const maAddition = Math.min(incoming.ma, Math.max(0, bhs - b.ma));
      b.ma += maAddition;
      addRetirement(
        incoming.ma - maAddition,
        before55 ? currentFRS : frs,
        before55,
      );
      // New cash earns from the following month.
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
          goal === "ers" ? 2 * currentFRS : target,
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
    const owAnnualNow =
      Math.min(Math.max(0, Number(p.salary || 0)), C.wageCap) * 12;
    const awSubjectNow = Math.min(
      Math.max(0, Number(p.annualBonus || 0)),
      Math.max(0, C.annualWageCap - owAnnualNow),
    );
    const currentTotalCpfRate = allocation(age, C.year)[2];
    const mandatoryAnnualCpfNow =
      (owAnnualNow + awSubjectNow) * currentTotalCpfRate;
    return {
      ...snapshot55,
      oaTransfer,
      ra65: b.ra,
      raSweepAt65,
      bhs65,
      pendingRA65: pending.ra,
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
      vc3aAnnualRoom: Math.max(0, C.cpfAnnualLimit - mandatoryAnnualCpfNow),
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
      "housingYears",
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
      "bridgeIncome",
      "familyRstuAnnual",
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
    if (p.longevityAge != null && p.longevityAge !== "") {
      const lon = Number(p.longevityAge);
      if (!Number.isInteger(lon) || lon < 80 || lon > 105 || lon <= retire) {
        throw new Error(
          "Planning horizon must be an age from 80 to 105 and above your target retirement age.",
        );
      }
    }
  }

  function resolveLongevityAge(p, fallback) {
    if (p && p.longevityAge != null && p.longevityAge !== "") {
      const v = Math.round(Number(p.longevityAge));
      if (Number.isFinite(v) && v >= 80 && v <= 105) return v;
    }
    return fallback;
  }

  /**
   * Binary-search the monthly extra CPF contribution needed to reach `target`
   * funded RA by age 55 under `goal` ("brs" | "frs" | "ers").
   */
  function solveCpfFundingMonthly(
    p,
    goal,
    target,
    gap,
    months,
    iterations = 32,
  ) {
    let low = 0;
    let high = gap / Math.max(1, months);
    for (let i = 0; i < iterations; i++) {
      const mid = (low + high) / 2;
      if (projectCPF(p, mid, goal).fundedRA >= target - 0.001) high = mid;
      else low = mid;
    }
    return high;
  }

  function calculate(rawP) {
    const p = withEffectiveSavings(rawP);
    validate(p);
    const age = Number(p.age),
      salary = Number(p.salary),
      retire = p.retire == null ? 65 : Number(p.retire);
    const lifestyle = p.lifestyle ?? "cca",
      inflation = p.inflationRate ?? C.inflation,
      investmentReturn = p.returnRate ?? C.investmentReturn;
    const plan = p.plan === "escalating" ? "escalating" : "standard",
      post55Work = Boolean(p.post55Work);
    const simEndAge = resolveLongevityAge(p, C.endAge);
    const bridgeIncome = Math.max(0, Number(p.bridgeIncome || 0));
    const base = projectCPF(p),
      years55 = 55 - age,
      frs = retirementSum(C.year + years55),
      brs = 0.5 * frs,
      scale = frs / C.frs,
      ers = 2 * frs;
    const cpfAt55 = base.availableAt55,
      cpf = base.cpfAt55 + base.extraPost55CPF;
    const todaySpend = p.spend ?? lifestyles[lifestyle].budget;
    const years = retire - age,
      months = Math.round(years * 12),
      rate = monthlyRate(investmentReturn);
    const bridgeIncomeAtRetire =
      retire < 65 && bridgeIncome > 0
        ? bridgeIncome * (1 + inflation) ** years
        : 0;
    const factor = annuityFactor(rate, months),
      savings = Number(p.savings || 0),
      futureAssets = savings * (1 + rate) ** months;
    const calcOpts = {
      investmentReturn,
      inflation,
      plan,
      lifestyle,
      insuranceCurve: true,
      bridgeIncomeAtRetire,
    };
    const futureSpend = expenseAt(
      todaySpend,
      age,
      years,
      inflation,
      lifestyle,
      calcOpts,
    );
    const spend65 = expenseAt(
        todaySpend,
        age,
        65 - age,
        inflation,
        lifestyle,
        calcOpts,
      ),
      spend75 = expenseAt(
        todaySpend,
        age,
        75 - age,
        inflation,
        lifestyle,
        calcOpts,
      );

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
        simEndAge,
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
        cpfFunding = solveCpfFundingMonthly(
          p,
          key,
          balance,
          cpfGap,
          Math.min(months, years55 * 12),
          30,
        );
      } else if (cpfGap > 0) {
        // Capital needed today, held at the reserve rate until age 55.
        cpfFunding = cpfGap / (1 + Number(p.reserveReturn || 0)) ** years55;
      }
      const chosenInvest = p.invest ?? privateSaving;
      const illustratedPortfolio = futureAssets + chosenInvest * factor;
      let firstShortfallAge = null;
      const post65ScanMonths = Math.max(0, Math.round((simEndAge - 65) * 12));
      for (let m = 0; m < post65ScanMonths; m++) {
        const a = 65 + m / 12;
        const income =
          payout * (plan === "escalating" ? 1.02 ** Math.floor(m / 12) : 1);
        if (
          expenseAt(spend65, 65, m / 12, inflation, lifestyle, calcOpts) >
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
    const brsScenario = makeScenario("brs", brs);
    const topup = Math.min(1000, base.currentTopupRoom),
      delay = Math.min(10, years55),
      wage = Math.min(salary, C.wageCap),
      annualBonus = Math.max(0, Number(p.annualBonus || 0)),
      awSubjectAnnual = Math.min(
        annualBonus,
        Math.max(0, C.annualWageCap - wage * 12),
      ),
      [oaShare, saShare, totalCpfRate] = allocation(age),
      empCpfRate = employeeCpfRate(age),
      emprCpfRate =
        Math.round(Math.max(0, totalCpfRate - empCpfRate) * 1e6) / 1e6,
      contribution = wage * totalCpfRate,
      annualBonusEmployeeCpf = awSubjectAnnual * empCpfRate,
      annualBonusEmployerCpf = awSubjectAnnual * emprCpfRate,
      annualBonusTotalCpf = awSubjectAnnual * totalCpfRate;
    return {
      scenarios,
      brsScenario,
      endAge: simEndAge,
      bridgeIncome,
      bridgeIncomeAtRetire,
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
      brs,
      frs,
      ers,
      income: scenarios[0].payout,
      target: scenarios[0].privateTarget,
      saving: scenarios[0].privateSaving,
      savingNoCpf: requiredSaving(
        portfolioTarget(futureSpend, 0, retire, simEndAge, calcOpts),
        savings,
        rate,
        months,
      ),
      frsMonthly: scenarios[1].cpfFunding,
      ersMonthly: scenarios[2].cpfFunding,
      employeeCpf: wage * empCpfRate,
      employerCpf: wage * (totalCpfRate - empCpfRate),
      afterCpf: salary - wage * empCpfRate,
      contribution,
      wage,
      awBonusAnnual: annualBonus,
      awSubjectAnnual,
      annualBonusEmployeeCpf,
      annualBonusEmployerCpf,
      annualBonusTotalCpf,
      empCpfRate,
      emprCpfRate,
      totalCpfRate,
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
      maShortfallToday: base.maShortfallToday,
      extraPost55CPF: base.extraPost55CPF,
      post55OA: base.post55OA,
      post55RAContributions: base.post55RAContributions,
      post55RAContributionsToday: base.post55RAContributionsToday,
      currentTopupRoom: base.currentTopupRoom,
      vc3aAnnualRoom: base.vc3aAnnualRoom,
      topup,
      early: topup * 1.04 ** years55,
      later: topup * 1.04 ** (years55 - delay),
      delay,
      refined:
        p.oa != null || p.sa != null || p.ma != null || p.housing != null,
    };
  }

  // Actual contributions have their own outcome, independent of fully funded comparisons.
  function simulate(rawP, selectedKey = "salary", options = {}) {
    const p = withEffectiveSavings(rawP);
    const r = options.summary || calculate(p),
      s =
        selectedKey === "brs" && r.brsScenario
          ? r.brsScenario
          : r.scenarios.find((x) => x.key === selectedKey) || r.scenarios[0];
    const simEndAge = resolveLongevityAge(p, r.endAge ?? C.endAge);
    const todayBridge = Math.max(
      0,
      Number(p.bridgeIncome ?? r.bridgeIncome ?? 0),
    );
    const bridgeIncomeAtRetire =
      r.retire < 65 && todayBridge > 0
        ? todayBridge * (1 + r.inflation) ** (r.retire - r.age)
        : 0;
    const cpfExtra = r.retiringNow ? 0 : (p.cpfExtra ?? s.cpfFunding);
    const cpfResult =
      options.cpfResult ||
      projectCPF(p, r.retiringNow ? 0 : cpfExtra, selectedKey);
    const scale = retirementSum(C.year + 55 - r.age) / C.frs;
    const standardPayout = payoutFrom65(cpfResult.ra65, scale);
    const payout =
      standardPayout * (r.plan === "escalating" ? C.escalatingRatio : 1);
    const actual = {
      ...s,
      balance: cpfResult.fundedRA ?? s.balance,
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
      simEndAge,
      {
        investmentReturn: r.investmentReturn,
        inflation: r.inflation,
        plan: r.plan,
        lifestyle: r.lifestyle,
        insuranceCurve: true,
        bridgeIncomeAtRetire,
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
    const cashSaving = r.retiringNow
      ? 0
      : Math.max(0, Number(p.cashSaving || 0));
    const cashRate = monthlyRate(resolveCashReturnRate(p));
    const defaultInvest = Math.max(0, requiredInvestment - cashSaving);
    const invest = r.retiringNow
      ? 0
      : Math.max(0, Number(p.invest ?? defaultInvest));
    actual.privateSaving = requiredInvestment;
    actual.contributionShortfall = Math.max(
      0,
      requiredInvestment - invest - cashSaving,
    );
    actual.firstShortfallAge = null;
    actual.chosenInvest = invest;
    const points = [],
      monthly = [];
    let portfolio = Number(p.savings || 0),
      cashAccum = 0,
      depletionAge = null,
      portfolioAtRetire = portfolio;
    const retirementMonth = monthsToRetire,
      endMonth = (simEndAge - r.age) * 12;
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
      const monthlyBridge =
        retired && age < 65 && todayBridge > 0
          ? todayBridge * (1 + r.inflation) ** (m / 12)
          : 0;
      const monthlySpend = expenseAt(
        r.todaySpend,
        r.age,
        m / 12,
        r.inflation,
        r.lifestyle,
        { insuranceCurve: true },
      );
      const monthlyGap = retired
        ? Math.max(0, monthlySpend - monthlyCPF - monthlyBridge)
        : 0;
      if (
        age >= 65 &&
        monthlySpend > monthlyCPF + 0.005 &&
        actual.firstShortfallAge == null
      )
        actual.firstShortfallAge = age;
      const totalPortfolio = portfolio + cashAccum;
      if (m === retirementMonth) portfolioAtRetire = totalPortfolio;
      if (m % 12 === 0)
        points.push({
          age,
          year: C.year + Math.floor((C.startMonth + m) / 12),
          phase: !retired ? "accumulating" : age < 65 ? "bridge" : "drawdown",
          monthlySpend,
          monthlyCPF,
          monthlyBridge,
          monthlyGap,
          portfolioBalance: totalPortfolio,
        });
      if (options.monthly)
        monthly.push({
          age,
          portfolio: totalPortfolio,
          monthlySpend,
          monthlyCPF,
          monthlyGap,
        });
      if (m === endMonth) break;
      if (!retired) {
        portfolio = portfolio * (1 + rate) + invest;
        if (cashSaving > 0) {
          cashAccum = cashAccum * (1 + cashRate) + cashSaving;
        }
        investmentDeposits += invest + cashSaving;
      } else if (cashAccum > 0) {
        cashAccum = cashAccum * (1 + cashRate);
        portfolio = portfolio * (1 + rate);
        const cashDraw = Math.min(cashAccum, monthlyGap);
        cashAccum = Math.max(0, cashAccum - cashDraw);
        const remaining = portfolio - (monthlyGap - cashDraw);
        if (remaining < -0.005 && depletionAge === null)
          depletionAge = age + 1 / 12;
        portfolio = Math.max(0, remaining);
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
    actual.chosenTotal = cpfExtra + cashSaving + invest;
    // An additional level cash withdrawal, not a CPF annuity or safe withdrawal rule.
    const drawMonths = Math.round((simEndAge - r.retire) * 12);
    const monthlyPortfolioIncome = drawMonths
      ? (portfolioAtRetire / annuityFactor(rate, drawMonths)) *
        (1 + rate) ** drawMonths
      : 0;
    return {
      summary: r,
      endAge: simEndAge,
      bridgeIncome: todayBridge,
      selectedScenario: actual,
      points,
      monthly,
      cpfResult,
      cpfExtra,
      cashSaving,
      invest,
      portfolioAtRetire,
      depletionAge,
      monthlyPortfolioIncome,
      investmentDeposits,
      investmentGrowth:
        portfolioAtRetire - Number(p.savings || 0) - investmentDeposits,
      payoutCapped: cpfResult.ra65 > 650100 * scale,
      cpfGoalAge: cpfResult.goalAge,
      fullyFunded:
        cashSaving > 0
          ? depletionAge === null &&
            portfolioAtRetire + 0.005 >= actual.privateTarget
          : portfolioAtRetire + 0.005 >= actual.privateTarget,
    };
  }

  // A level monthly route to an age-55 milestone, not a payout/withdrawal election.
  function milestonePlan(p, key = "frs") {
    validate(p);
    if (!["brs", "frs", "ers"].includes(key))
      throw new Error("Choose BRS, FRS or ERS.");
    const age = Number(p.age);
    const inflation = p.inflationRate ?? C.inflation;
    const plan = p.plan === "escalating" ? "escalating" : "standard";
    const frs = retirementSum(C.year + 55 - age);
    const scale = frs / C.frs;
    const target = frs * { brs: 0.5, frs: 1, ers: 2 }[key];
    const base = projectCPF(p);
    const available = base.availableAt55;
    const gap = Math.max(0, target - available);
    const retire = Number(p.retire ?? 65);
    const months = Math.round((Math.min(55, retire) - age) * 12);
    const goal = key;
    let monthly = gap > 0.005 && months <= 0 ? null : 0;
    let projection = goal === "salary" ? base : projectCPF(p, 0, goal);
    if (gap > 0.005 && months > 0) {
      monthly = Math.round(
        solveCpfFundingMonthly(p, goal, target, gap, months, 32),
      );
      projection = projectCPF(p, monthly, goal);
    }
    const plannedCpfExtra =
      months <= 0 ? 0 : Math.max(0, Number(p.cpfExtra || 0));
    const plannedProj =
      plannedCpfExtra > 0
        ? projectCPF(p, plannedCpfExtra, goal)
        : goal === "salary"
          ? base
          : projectCPF(p, 0, goal);
    const plannedAvailable = plannedProj.availableAt55 + plannedProj.reserve;
    const remainingGapAfterPlanned = Math.max(0, target - plannedProj.fundedRA);
    const additionalMonthlyNeeded =
      monthly === null ? null : Math.max(0, monthly - plannedCpfExtra);
    const cohortMilestones = {};
    for (const [mKey, mult] of [
      ["brs", 0.5],
      ["frs", 1],
      ["ers", 2],
    ]) {
      const sum2026 = C.frs * mult;
      const sumAt55 = frs * mult;
      const sumToday = todayValue(sumAt55, 55, age, inflation);
      const fundedAt65 = projectCPF(p, 0, mKey, sumAt55);
      const stdNominal = payoutFrom65(fundedAt65.ra65, scale);
      const escNominal = stdNominal * C.escalatingRatio;
      const activeNominal = plan === "escalating" ? escNominal : stdNominal;
      cohortMilestones[mKey] = {
        sum2026,
        sumAt55,
        sumToday,
        payout2026Ref: referencePayout(sum2026, plan),
        payoutAt65Nominal: activeNominal,
        payoutToday: todayValue(activeNominal, 65, age, inflation),
        standardPayoutToday: todayValue(stdNominal, 65, age, inflation),
        escalatingPayoutToday: todayValue(escNominal, 65, age, inflation),
      };
    }
    return {
      key,
      age,
      inflation,
      plan,
      target,
      targetToday: todayValue(target, 55, age, inflation),
      available,
      availableToday: todayValue(available, 55, age, inflation),
      gap,
      gapToday: todayValue(gap, 55, age, inflation),
      monthly,
      untilAge: Math.min(55, retire),
      currentRoom: base.currentTopupRoom,
      reserveAt55: projection.reserve,
      reserveAt55Today: todayValue(projection.reserve, 55, age, inflation),
      fundedRA: projection.fundedRA,
      fundedRAToday: todayValue(projection.fundedRA, 55, age, inflation),
      plannedCpfExtra,
      withPlanned: {
        availableAt55: plannedAvailable,
        availableAt55Today: todayValue(plannedAvailable, 55, age, inflation),
        fundedRA: plannedProj.fundedRA,
        fundedRAToday: todayValue(plannedProj.fundedRA, 55, age, inflation),
        remainingGap: remainingGapAfterPlanned,
        remainingGapToday: todayValue(
          remainingGapAfterPlanned,
          55,
          age,
          inflation,
        ),
        additionalMonthlyNeeded,
        hitsTarget: plannedProj.fundedRA >= target - 0.5,
      },
      cohortMilestones,
      projection,
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
      "brs",
      "frs",
      "ers",
      "extraPost55CPF",
      "early",
      "later",
    ])
      if (r[key] != null) result[key] = at(r[key], 55);
    for (const key of ["futureSpend", "target"])
      result[key] = at(r[key], r.retire);
    result.income = at(r.income, 65);
    result.spend65 = at(r.spend65, 65);
    result.spend75 = at(r.spend75, 75);
    result.at75 = result.spend75;
    result.gap = at(r.gap, r.retire);
    result.post55RAContributions = r.post55RAContributionsToday;
    result.housingShortfall = r.housingShortfallToday;
    result.maShortfallToday = r.maShortfallToday;
    result.post55OA = at(r.post55OA, 65);
    const convertScenario = (s) => ({
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
    });
    result.scenarios = r.scenarios.map(convertScenario);
    if (r.brsScenario) {
      result.brsScenario = convertScenario(r.brsScenario);
    }
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
          monthlyBridge: at(point.monthlyBridge || 0),
          monthlyGap: at(point.monthlyGap),
          portfolioBalance: at(point.portfolioBalance),
          ...(point.outsideBalance != null
            ? { outsideBalance: at(point.outsideBalance) }
            : {}),
        };
      }),
    };
  }

  function computeTaxSummary(p = {}, simulation = null) {
    const salary = Math.max(0, Number(p.salary || 0));
    const annualBonus = Math.max(0, Number(p.annualBonus || 0));
    const regularGross = salary * 12;
    const annualGross = regularGross + annualBonus;
    const owAnnual = Math.min(salary, C.wageCap) * 12;
    const awSubject = Math.min(
      annualBonus,
      Math.max(0, C.annualWageCap - owAnnual),
    );
    const curAge = Math.max(18, Math.min(100, Number(p.age ?? 35)));
    const empCpfRate = employeeCpfRate(curAge, C.year);
    const regularEmployeeCpf = owAnnual * empCpfRate;
    const bonusEmployeeCpf = awSubject * empCpfRate;
    const annualEmployeeCpf = regularEmployeeCpf + bonusEmployeeCpf;
    const existingReliefs = Math.max(0, Number(p.existingReliefs ?? 1000));
    const totalBaseReliefs = Math.min(
      C.personalReliefCap,
      annualEmployeeCpf + existingReliefs,
    );
    const reliefCapRemaining = Math.max(
      0,
      C.personalReliefCap - totalBaseReliefs,
    );
    const baselineChargeableIncome = Math.max(
      0,
      annualGross - totalBaseReliefs,
    );
    const baselineTax = residentTax(baselineChargeableIncome);
    // IRAS cash RSTU tax relief is capped at the current Full Retirement Sum (FRS) for all ages;
    // age 55+ RA top-ups between FRS and ERS are permitted by CPF but receive $0 tax relief.
    const saRoom =
      curAge >= 55
        ? Math.max(0, C.frs - Number(p.ra ?? p.sa ?? 0))
        : Math.max(0, C.frs - Number(p.sa || 0) - Number(p.saInvested || 0));
    const plannedCpfExtraMonthly = Math.max(
      0,
      Number(simulation?.cpfExtra ?? p.cpfExtra ?? 0),
    );
    const activeSelfRstu = Math.min(
      C.rstuReliefCap,
      saRoom,
      plannedCpfExtraMonthly * 12,
      reliefCapRemaining,
    );
    const activeFamilyRstu = Math.min(
      C.familyRstuReliefCap,
      Math.max(0, Number(p.familyRstuAnnual || 0)),
      Math.max(0, reliefCapRemaining - activeSelfRstu),
    );
    const activeSrs = Math.min(
      C.srsCap,
      Math.max(0, Number(p.srsAnnual || 0)),
      Math.max(0, reliefCapRemaining - activeSelfRstu - activeFamilyRstu),
    );
    const activeVoluntaryReliefs =
      activeSelfRstu + activeFamilyRstu + activeSrs;
    const activeChargeableIncome = Math.max(
      0,
      baselineChargeableIncome - activeVoluntaryReliefs,
    );
    const activeTax = residentTax(activeChargeableIncome);
    const activeTaxSavedAnnual = Math.max(
      0,
      baselineTax.annualTax - activeTax.annualTax,
    );

    const regularBaseReliefs = Math.min(
      C.personalReliefCap,
      regularEmployeeCpf + existingReliefs,
    );
    const regularReliefRoom = Math.max(
      0,
      C.personalReliefCap - regularBaseReliefs,
    );
    const regularVoluntaryReliefs = Math.min(
      regularReliefRoom,
      activeVoluntaryReliefs,
    );
    const regularBaselineTax = residentTax(
      Math.max(0, regularGross - regularBaseReliefs),
    );
    const regularChargeableIncome = Math.max(
      0,
      regularGross - regularBaseReliefs - regularVoluntaryReliefs,
    );
    const regularActiveTax = residentTax(regularChargeableIncome);
    const bonusTaxAnnual = Math.max(
      0,
      activeTax.annualTax - regularActiveTax.annualTax,
    );
    const netAnnualBonus = Math.max(
      0,
      annualBonus - bonusEmployeeCpf - bonusTaxAnnual,
    );

    return {
      salary,
      annualBonus,
      regularGross,
      annualGross,
      owAnnual,
      awSubject,
      regularEmployeeCpf,
      bonusEmployeeCpf,
      annualEmployeeCpf,
      existingReliefs,
      totalBaseReliefs,
      reliefCapRemaining,
      saRoom,
      baselineChargeableIncome,
      baselineTax,
      regularBaselineTax,
      activeSelfRstu,
      activeFamilyRstu,
      activeSrs,
      activeVoluntaryReliefs,
      activeChargeableIncome,
      activeTax,
      activeTaxSavedAnnual,
      regularActiveTax,
      bonusTaxAnnual,
      netAnnualBonus,
    };
  }

  // Personalized Singapore outside-CPF priority waterfall & take-home pay allocation guide.
  function outsideAllocationGuide(summary, simulation, params = {}) {
    const afterCpf = Math.max(0, summary.afterCpf || 0);
    const salary = Math.max(0, Number(summary.salary || 0));
    const annualBonus = Math.max(
      0,
      Number(params?.annualBonus ?? summary.awBonusAnnual ?? 0),
    );
    const hasExplicitParams = params != null && Object.keys(params).length > 0;
    const taxSum = computeTaxSummary(
      {
        ...params,
        age: params?.age ?? summary.age ?? 35,
        salary,
        annualBonus,
        existingReliefs:
          params?.existingReliefs ?? summary.existingReliefs ?? 1000,
        sa:
          params?.sa ??
          (summary.currentTopupRoom != null
            ? Math.max(0, C.frs - summary.currentTopupRoom)
            : 0),
      },
      hasExplicitParams ? simulation : { cpfExtra: 0 },
    );
    const totalBaseReliefs = taxSum.totalBaseReliefs;
    const chargeableIncome = taxSum.baselineChargeableIncome;
    const baselineTax = taxSum.baselineTax;
    const tax = hasExplicitParams ? taxSum.activeTax : baselineTax;
    // Regular monthly take-home deducts regular salary tax (excluding annual bonus tax).
    const regularMonthlyTax = hasExplicitParams
      ? (taxSum.regularActiveTax?.monthlyTax ?? tax.monthlyTax)
      : (taxSum.regularBaselineTax?.monthlyTax ?? baselineTax.monthlyTax);
    const netTakeHome = Math.max(0, afterCpf - regularMonthlyTax);
    const cpfExtra = simulation.cpfExtra || 0;
    const cashSaving = simulation.cashSaving || 0;
    const outsideMonthly = simulation.invest || 0;
    const totalSaving = cpfExtra + cashSaving + outsideMonthly;
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
        name: "Retiring now",
        tone: "good",
      };
    } else if (totalSaving > afterCpf || pctAfterCpf > 85) {
      state = {
        key: "critical",
        label: "Critical (>85% of take-home)",
        name: "Critical (>85% of take-home)",
        tone: "danger",
      };
    } else if (pctAfterCpf > 50) {
      state = {
        key: "stretched",
        label: "Stretched (>50% of take-home)",
        name: "Stretched (>50% of take-home)",
        tone: "warn",
      };
    } else if (pctAfterCpf > 30) {
      state = {
        key: "ambitious",
        label: "Ambitious (31–50% of take-home)",
        name: "Ambitious (31–50% of take-home)",
        tone: "good",
      };
    } else {
      state = {
        key: "comfortable",
        label: "Comfortable (≤30% of take-home)",
        name: "Comfortable (≤30% of take-home)",
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

    const emergencySpendBase = Math.max(0, Number(summary.todaySpend) || 0);
    const horizon = Math.max(0, summary.retire - summary.age);
    const remainingReliefCap = Math.max(
      0,
      C.personalReliefCap - totalBaseReliefs,
    );
    const rstuEligible = Math.min(
      C.rstuReliefCap,
      summary.currentTopupRoom,
      remainingReliefCap,
    );
    const srsEligible = Math.min(C.srsCap, remainingReliefCap);
    const rstuTaxSaved = Math.max(
      0,
      baselineTax.annualTax -
        residentTax(chargeableIncome - rstuEligible).annualTax,
    );
    const srsTaxSaved = Math.max(
      0,
      baselineTax.annualTax -
        residentTax(chargeableIncome - srsEligible).annualTax,
    );
    const taxWorthIt =
      baselineTax.marginalRate >= 0.07 && remainingReliefCap > 0;

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

    const srsMonthlyCap = srsEligible / 12;
    const srsMonthly = Math.min(
      Math.round(allocPool * srsShare),
      srsMonthlyCap,
    );
    const safeMonthly = Math.round(allocPool * safeShare);
    const coreMonthly = Math.max(0, allocPool - safeMonthly - srsMonthly);

    return {
      afterCpf,
      tax,
      baselineTax,
      activeTax: taxSum.activeTax,
      activeTaxSavedAnnual: taxSum.activeTaxSavedAnnual,
      regularActiveTax: taxSum.regularActiveTax,
      bonusTaxAnnual: taxSum.bonusTaxAnnual,
      netAnnualBonus: taxSum.netAnnualBonus,
      netTakeHome,
      cpfExtra,
      cashSaving,
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
      emergencyMin: Math.round(emergencySpendBase * 6),
      emergencyMax: Math.round(emergencySpendBase * 12),
      remainingReliefCap,
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

  const SG_DEFAULT_PLAN = {
    lifestyle: "cca",
    dob: "1991-01-01",
    age: 35,
    salary: 5500,
    retire: C.retirementAge,
    oa: 0,
    sa: 0,
    ma: 0,
    equities: 34000,
    sgDividends: 6000,
    ssbCash: 20000,
    srs: 0,
    srsAge: 63,
    srsAnnual: 0,
    srsInvestedIn: "global",
    annualBonus: 0,
    existingReliefs: 1000,
    targetEquityPct: 80,
    sgSleevePct: C.defaultSgDividendSplitPct,
    plan: "standard",
    returnRate: 0.05,
    inflationRate: 0.025,
    post55Work: false,
    reserveReturn: 0,
    housingMode: "all-oa",
    housingBalance: "",
    housingYears: 20,
    housingRate: 2.6,
    housingParties: 1,
  };

  const SG_PERSONA_PRESETS = [
    {
      id: "fresh-grad",
      label: "Fresh Grad",
      badge: "Age 25 · $4.5k/mo",
      summary:
        "Starting career, low CPF base, long 35-year compounding runway.",
      params: {
        lifestyle: "cca",
        age: 25,
        salary: 4500,
        retire: 60,
        oa: 8000,
        sa: 3000,
        ma: 3500,
        equities: 10000,
        sgDividends: 2000,
        ssbCash: 8000,
        srs: 0,
        srsAge: 63,
        srsAnnual: 0,
        srsInvestedIn: "global",
        annualBonus: 4500,
        existingReliefs: 1000,
        familyRstuAnnual: 0,
        bridgeIncome: 0,
        targetEquityPct: 90,
        sgSleevePct: 15,
        plan: "standard",
        returnRate: 0.055,
        inflationRate: 0.025,
        post55Work: false,
        housingMode: "all-oa",
        housingBalance: "",
        housingYears: 25,
        housingRate: 2.6,
        housingParties: 1,
        invest: 1100,
        cpfExtra: 0,
      },
    },
    {
      id: "hdb-family",
      label: "HDB Dual-Income",
      badge: "Age 35 · $6.8k/mo",
      summary:
        "Servicing split 4-room HDB mortgage from CPF OA with core family reserves.",
      params: {
        lifestyle: "home-helper",
        age: 35,
        salary: 6800,
        retire: 62,
        oa: 45000,
        sa: 32000,
        ma: 28000,
        equities: 55000,
        sgDividends: 15000,
        ssbCash: 30000,
        srs: 0,
        srsAge: 63,
        srsAnnual: 0,
        srsInvestedIn: "global",
        annualBonus: 10000,
        existingReliefs: 5000,
        familyRstuAnnual: 0,
        bridgeIncome: 0,
        targetEquityPct: 80,
        sgSleevePct: 15,
        plan: "standard",
        returnRate: 0.05,
        inflationRate: 0.025,
        post55Work: false,
        housingMode: "hdb",
        housingBalance: 360000,
        housingYears: 22,
        housingRate: 2.6,
        housingParties: 2,
        invest: 1600,
        cpfExtra: 0,
      },
    },
    {
      id: "henry-srs",
      label: "HENRY Above Cap",
      badge: "Age 42 · $14k/mo",
      summary:
        "Above $8k CPF OW cap, optimizing SRS ($15.3k/yr) + Family Cash RSTU ($8k/yr).",
      params: {
        lifestyle: "home-helper",
        age: 42,
        salary: 14000,
        retire: 58,
        oa: 110000,
        sa: 145000,
        ma: 68000,
        equities: 240000,
        sgDividends: 45000,
        ssbCash: 65000,
        srs: 60000,
        srsAge: 63,
        srsAnnual: 15300,
        srsInvestedIn: "global",
        annualBonus: 36000,
        existingReliefs: 4000,
        familyRstuAnnual: 8000,
        bridgeIncome: 0,
        targetEquityPct: 80,
        sgSleevePct: 20,
        plan: "escalating",
        returnRate: 0.05,
        inflationRate: 0.025,
        post55Work: false,
        housingMode: "bank",
        housingBalance: 550000,
        housingYears: 18,
        housingRate: 2.8,
        housingParties: 2,
        invest: 4500,
        cpfExtra: 667,
      },
    },
    {
      id: "barista-fire-50",
      label: "Barista FIRE 55",
      badge: "Age 50 · Retire 55",
      summary:
        "Paid-up flat, retiring at 55 with $1,500/mo consulting bridge until CPF LIFE at 65.",
      params: {
        lifestyle: "cca",
        age: 50,
        salary: 9500,
        retire: 55,
        oa: 165000,
        sa: 205000,
        ma: 79000,
        equities: 310000,
        sgDividends: 75000,
        ssbCash: 85000,
        srs: 95000,
        srsAge: 63,
        srsAnnual: 12000,
        srsInvestedIn: "balanced",
        annualBonus: 15000,
        existingReliefs: 2000,
        familyRstuAnnual: 0,
        bridgeIncome: 1500,
        targetEquityPct: 70,
        sgSleevePct: 25,
        plan: "standard",
        returnRate: 0.05,
        inflationRate: 0.025,
        post55Work: false,
        housingMode: "paid-up",
        housingBalance: "",
        housingYears: null,
        housingRate: 0,
        housingParties: 1,
        invest: 3200,
        cpfExtra: 0,
      },
    },
  ];

  function resolvePortfolioBuckets(p) {
    const hasCashAccounts = Boolean(
      p?.cashAccountsActive &&
      Array.isArray(p?.cashAccounts) &&
      p.cashAccounts.length > 0,
    );
    const hasBuckets =
      hasCashAccounts ||
      p.equities != null ||
      p.sgDividends != null ||
      p.ssbCash != null ||
      p.srs != null;
    if (hasBuckets) {
      const equities = Math.max(0, Number(p.equities || 0));
      const sgDividends = Math.max(0, Number(p.sgDividends || 0));
      const cashBreakdown = hasCashAccounts
        ? computeCashAccountsBreakdown(p.cashAccounts, p.masRates)
        : null;
      const ssbCash = cashBreakdown
        ? cashBreakdown.totalBalance
        : Math.max(0, Number(p.ssbCash || 0));
      const srs = Math.max(0, Number(p.srs || 0));
      return {
        hasBuckets: true,
        cashAccountsActive: hasCashAccounts,
        cashBreakdown,
        cashEffectiveRatePct: cashBreakdown
          ? cashBreakdown.effectiveRatePct
          : null,
        cashAnnualInterest: cashBreakdown
          ? cashBreakdown.totalAnnualInterest
          : null,
        equities,
        sgDividends,
        ssbCash,
        srs,
        liquidOnly: equities + sgDividends + ssbCash,
        total: equities + sgDividends + ssbCash + srs,
      };
    }
    const total = Math.max(0, Number(p.savings || 0));
    const equities = total * 0.68;
    const sgDividends = total * 0.12;
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
    return buckets.hasBuckets ? { ...p, savings: buckets.total } : p;
  }

  function resolveSrsReturnRate(p, baseReturnRate = C.investmentReturn) {
    const mode = p?.srsInvestedIn || "global";
    if (mode === "cash") return C.srsIdleRate;
    const defaultSsbPct = DEFAULT_MAS_LIVE_RATES.ssb.year10Return;
    const rawSsbPct = p?.masRates?.ssb?.year10Return ?? defaultSsbPct;
    const ssbPct = Number(rawSsbPct);
    const ssbRate = Math.max(
      0,
      (Number.isFinite(ssbPct) ? ssbPct : defaultSsbPct) / 100,
    );
    if (mode === "ssb") return ssbRate;
    if (mode === "balanced") return 0.6 * baseReturnRate + 0.4 * ssbRate;
    return baseReturnRate;
  }

  function resolveCashReturnRate(p, fallbackRate) {
    const resolvedFallback =
      fallbackRate != null
        ? fallbackRate
        : DEFAULT_MAS_LIVE_RATES.ssb.year10Return / 100;
    if (p?.cashReturnRate != null && p?.cashReturnRate !== "") {
      const explicit = Number(p.cashReturnRate);
      if (Number.isFinite(explicit) && explicit >= 0)
        return explicit > 0.3 ? explicit / 100 : explicit;
    }
    if (
      p?.cashAccountsActive &&
      Array.isArray(p?.cashAccounts) &&
      p.cashAccounts.length > 0
    ) {
      const bd =
        p._cashBreakdown ||
        computeCashAccountsBreakdown(p.cashAccounts, p.masRates);
      return bd.totalBalance > 0 ? bd.effectiveRate : bd.ssbBenchmarkPct / 100;
    }
    const rawSsbPct =
      p?.masRates?.ssb?.year10Return ?? DEFAULT_MAS_LIVE_RATES.ssb.year10Return;
    if (rawSsbPct != null && Number.isFinite(Number(rawSsbPct))) {
      return Math.max(0, Number(rawSsbPct) / 100);
    }
    return resolvedFallback;
  }

  // 2026 IRAS CPF RSTU vs SRS Tax Sweet-Spot Calculator
  function taxSweetSpot(p, options = {}) {
    const curAge = Math.max(18, Math.min(100, Number(p.age ?? 35)));
    const salary = Math.max(0, Number(p.salary || 0));
    const annualBonus = Math.max(0, Number(p.annualBonus || 0));
    const annualGross = salary * 12 + annualBonus;
    const owAnnual = Math.min(salary, C.wageCap) * 12;
    const awSubject = Math.min(
      annualBonus,
      Math.max(0, C.annualWageCap - owAnnual),
    );
    const empCpfRate = employeeCpfRate(curAge, C.year);
    const annualEmployeeCpf = (owAnnual + awSubject) * empCpfRate;
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
    // IRAS cash RSTU tax relief is capped at the current Full Retirement Sum (FRS) for all ages;
    // age 55+ RA top-ups between FRS and ERS are permitted by CPF but receive $0 tax relief.
    const saRoom =
      curAge >= 55
        ? Math.max(0, C.frs - Number(p.ra ?? p.sa ?? 0))
        : Math.max(0, C.frs - Number(p.sa || 0) - Number(p.saInvested || 0));
    const maxRstu = Math.min(C.rstuReliefCap, saRoom, reliefCapRemaining);
    const taxAfterRstu = residentTax(Math.max(0, chargeableIncome - maxRstu));
    const rstuTaxSaved = Math.max(
      0,
      taxBefore.annualTax - taxAfterRstu.annualTax,
    );
    const maxFamilyRstuRoom = Math.min(
      C.familyRstuReliefCap,
      Math.max(0, reliefCapRemaining - maxRstu),
    );
    const familyRstuPlanned = Math.min(
      C.familyRstuReliefCap,
      Math.max(0, Number(p.familyRstuAnnual || 0)),
    );
    const eligibleFamilyRstu = Math.min(familyRstuPlanned, maxFamilyRstuRoom);
    const taxAfterRstuAndFamily = residentTax(
      Math.max(0, chargeableIncome - maxRstu - eligibleFamilyRstu),
    );
    const familyRstuTaxSaved = Math.max(
      0,
      taxAfterRstu.annualTax - taxAfterRstuAndFamily.annualTax,
    );
    const potentialFamilyRstuTaxSaved = Math.max(
      0,
      taxAfterRstu.annualTax -
        residentTax(Math.max(0, chargeableIncome - maxRstu - maxFamilyRstuRoom))
          .annualTax,
    );
    const maxSrsAfterRstu = Math.min(
      C.srsCap,
      Math.max(0, reliefCapRemaining - maxRstu - eligibleFamilyRstu),
    );
    const maxSrsStandalone = Math.min(C.srsCap, reliefCapRemaining);
    const taxAfterBoth = residentTax(
      Math.max(
        0,
        chargeableIncome - maxRstu - eligibleFamilyRstu - maxSrsAfterRstu,
      ),
    );
    const srsTaxSavedAfterRstu = Math.max(
      0,
      taxAfterRstuAndFamily.annualTax - taxAfterBoth.annualTax,
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
    const srsBalanceToday = Math.max(0, Number(p.srs || 0));
    const srsAnnualPlanned = Math.min(
      C.srsCap,
      Math.max(0, Number(p.srsAnnual || 0)),
    );
    const srsInvestedIn = p.srsInvestedIn || "global";
    const srsReturnRate = resolveSrsReturnRate(
      p,
      Math.max(0, Number(p.returnRate ?? C.investmentReturn)),
    );
    const retireAge =
      p.retire != null && Number.isFinite(Number(p.retire))
        ? Number(p.retire)
        : srsLockInAge;
    // IRAS allows SRS contributions up to retirement (before first penalty-free withdrawal starts the 10-yr clock).
    const srsWithdrawalStartAge = Math.max(srsLockInAge, retireAge);
    const srsMonthsToStart = Math.max(
      0,
      Math.round((srsWithdrawalStartAge - curAge) * 12),
    );
    const srsContribMonths = Math.min(
      srsMonthsToStart,
      Math.max(0, Math.round((retireAge - curAge) * 12)),
    );
    const srsCoastMonths = Math.max(0, srsMonthsToStart - srsContribMonths);
    const srsMonthlyRate = monthlyRate(srsReturnRate);
    // Effective annuity factor at withdrawal start age accounting for coasting after early retirement.
    const srsAnnuity =
      annuityFactor(srsMonthlyRate, srsContribMonths) *
      (1 + srsMonthlyRate) ** srsCoastMonths;
    const srsCoastAt63 =
      srsBalanceToday * (1 + srsMonthlyRate) ** srsMonthsToStart;
    const srsProjectedAt63 =
      srsCoastAt63 + (srsAnnualPlanned / 12) * srsAnnuity;
    const srsFullCapProjectedAt63 = srsCoastAt63 + (C.srsCap / 12) * srsAnnuity;
    const srsPmtFactor =
      srsReturnRate > 0
        ? srsReturnRate / (1 - (1 + srsReturnRate) ** -10)
        : 0.1;
    // Exact nominal pot at withdrawal start whose 10-yr amortizing draw equals $40k/yr ($20k taxable = $0 IRAS tax).
    const srsZeroTaxCap = Math.min(
      C.srsSoftCapAt63,
      Math.round(C.srsTaxFreeAnnual / srsPmtFactor),
    );
    const srsMaxSafeAnnualTo400k =
      srsContribMonths > 0 && srsAnnuity > 0
        ? Math.min(
            C.srsCap,
            Math.max(0, ((srsZeroTaxCap - srsCoastAt63) / srsAnnuity) * 12),
          )
        : 0;
    // Account for ongoing SRS investment returns during the 10-year drawdown window (amortizing PMT).
    const srsTenYearAnnualDraw = srsProjectedAt63 * srsPmtFactor;
    const srsTenYearMonthlyDraw = srsTenYearAnnualDraw / 12;
    const srsTaxableAnnualAt63 = srsTenYearAnnualDraw * 0.5;
    const srsWithdrawalTaxAt63 = residentTax(srsTaxableAnnualAt63);

    const srsYearsToLockIn = Math.max(
      0,
      Math.round(srsWithdrawalStartAge - curAge),
    );
    const marginalPctLabel =
      (taxBefore.marginalRate * 100).toFixed(1).replace(/\.0$/, "") + "%";

    const reliefCapStr = `$${C.personalReliefCap.toLocaleString("en-SG")}`;
    const rstuCapStr = `$${C.rstuReliefCap.toLocaleString("en-SG")}`;
    const srsCapStr = `$${C.srsCap.toLocaleString("en-SG")}`;
    const frsCapStr = `$${C.frs.toLocaleString("en-SG")}`;

    let tier, headline, guidance;
    if (reliefCapRemaining <= 0) {
      tier = "cap-reached";
      headline = `${reliefCapStr} IRAS personal relief cap already reached`;
      guidance = `Mandatory CPF and existing reliefs already use the ${reliefCapStr} personal relief cap. Invest extra cash in liquid Global UCITS ETFs or SSBs without locking funds.`;
    } else if (chargeableIncome <= 40000) {
      tier = "liquid";
      headline = "Keep cash liquid — tax bracket ≤ 3.5% (≤ $40k chargeable)";
      guidance =
        "Your marginal IRAS rate is too low (0%–3.5%) to justify locking cash in CPF SA or SRS until 55/63–64. Prioritize liquid emergency cash and Global UCITS ETFs.";
    } else if (chargeableIncome <= 80000) {
      tier = "rstu-first";
      headline = `Prioritize CPF RSTU (${rstuCapStr}/yr) first — 7% bracket`;
      guidance =
        saRoom > 0
          ? `At a 7% marginal bracket, CPF RSTU (up to $${Math.round(maxRstu).toLocaleString("en-SG")}/yr into SA/RA) earns a guaranteed 4.0% floor plus immediate tax relief before considering SRS.`
          : `Your SA has already reached the ${C.year} FRS (${frsCapStr}), so RSTU gives $0 relief. Keep cash liquid or use SRS selectively if horizon to withdrawal is short.`;
    } else {
      tier = "max-both";
      headline = `Max CPF RSTU (${rstuCapStr}/yr) + SRS (${srsCapStr}/yr) — ≥ 11.5% bracket`;
      guidance =
        srsMaxSafeAnnualTo400k > 0 && srsMaxSafeAnnualTo400k < C.srsCap - 50
          ? `In the 11.5%+ bracket, locking tax-relieved dollars yields strong day-one tax alpha. Max RSTU (up to FRS) plus SRS (up to ${srsCapStr}/yr statutory cap, or ~$${Math.round(srsMaxSafeAnnualTo400k).toLocaleString("en-SG")}/yr steady pace to stay within the $${srsZeroTaxCap.toLocaleString("en-SG")} age-${srsWithdrawalStartAge} $0-tax ceiling), and invest SRS immediately so it does not sit idle at 0.05%.`
          : `In the 11.5%+ bracket, locking tax-relieved dollars yields strong day-one tax alpha. Max RSTU (up to FRS) plus ${srsCapStr} SRS, and invest SRS immediately so it does not sit idle at 0.05%.`;
    }

    let srsTrapStatus = "safe";
    let srsTrapTone = "is-info";
    let srsTrapHeadline = "No SRS planned · Optional after $8k RSTU";
    let srsTrapGuidance =
      "50% of each SRS withdrawal is taxable over the 10-year window from age " +
      srsWithdrawalStartAge +
      "—keeping your nominal pot ≤ $" +
      srsZeroTaxCap.toLocaleString("en-SG") +
      " (≤ $400,000 at 0% drawdown growth) lets you draw up to $40,000/yr ($3,333/mo) at $0 tax if you have no other taxable income.";
    if (srsProjectedAt63 >= C.srsTrapFloorAt63) {
      srsTrapStatus = "balloon-trap";
      srsTrapTone = "is-danger";
      srsTrapHeadline =
        "Ballooning Trap · $" +
        Math.round(srsProjectedAt63).toLocaleString("en-SG") +
        " at age " +
        srsWithdrawalStartAge +
        " (> $450k)";
      srsTrapGuidance =
        "50% of each SRS withdrawal is taxable. Drawing $" +
        Math.round(srsTenYearAnnualDraw).toLocaleString("en-SG") +
        "/yr over 10 years leaves $" +
        Math.round(srsTaxableAnnualAt63).toLocaleString("en-SG") +
        "/yr chargeable (~$" +
        Math.round(srsWithdrawalTaxAt63.annualTax).toLocaleString("en-SG") +
        "/yr tax). Cap annual SRS at ≤$" +
        Math.round(srsMaxSafeAnnualTo400k).toLocaleString("en-SG") +
        "/yr and direct excess cash into your personal brokerage account instead.";
    } else if (
      srsProjectedAt63 >= C.srsSoftCapAt63 ||
      srsWithdrawalTaxAt63.annualTax > 0.5
    ) {
      srsTrapStatus = "near-cap";
      srsTrapTone = "is-warn";
      srsTrapHeadline =
        "Near Tax Cap · $" +
        Math.round(srsProjectedAt63).toLocaleString("en-SG") +
        " at age " +
        srsWithdrawalStartAge;
      srsTrapGuidance =
        "50% of each SRS withdrawal is taxable. With ongoing drawdown returns, 10-year withdrawals ($" +
        Math.round(srsTenYearAnnualDraw).toLocaleString("en-SG") +
        "/yr) leave $" +
        Math.round(srsTaxableAnnualAt63).toLocaleString("en-SG") +
        "/yr chargeable (~$" +
        Math.round(srsWithdrawalTaxAt63.annualTax).toLocaleString("en-SG") +
        "/yr tax). Keep your age-" +
        srsWithdrawalStartAge +
        " pot ≤$" +
        srsZeroTaxCap.toLocaleString("en-SG") +
        " (≤$" +
        Math.round(srsMaxSafeAnnualTo400k).toLocaleString("en-SG") +
        "/yr pace) for $0 withdrawal tax, and direct excess cash into your personal brokerage (85% Global Growth / 15% SG Dividend) instead.";
    } else if (srsProjectedAt63 > 0) {
      srsTrapStatus = "safe";
      srsTrapTone = srsInvestedIn === "cash" ? "is-warn" : "is-good";
      srsTrapHeadline =
        srsInvestedIn === "cash"
          ? "Idle Cash (0.05%) · $" +
            Math.round(srsProjectedAt63).toLocaleString("en-SG") +
            " at age " +
            srsWithdrawalStartAge
          : "On Track · $" +
            Math.round(srsProjectedAt63).toLocaleString("en-SG") +
            " at age " +
            srsWithdrawalStartAge +
            " ($0 withdrawal tax)";
      srsTrapGuidance =
        "50% of each SRS withdrawal is taxable. Your projected age-" +
        srsWithdrawalStartAge +
        " pot stays within the $" +
        srsZeroTaxCap.toLocaleString("en-SG") +
        " $0-tax ceiling, so 10-year withdrawals ($" +
        Math.round(srsTenYearAnnualDraw).toLocaleString("en-SG") +
        "/yr) stay below the $20,000/yr IRAS tax-free threshold ($0 withdrawal tax).";
    } else {
      srsTrapStatus = "safe";
      srsTrapTone =
        tier === "liquid" || tier === "cap-reached" ? "is-warn" : "is-info";
      srsTrapHeadline =
        tier === "cap-reached"
          ? "No SRS · $80k relief cap full"
          : tier === "liquid"
            ? "No SRS · Skip at " + marginalPctLabel + " tax"
            : tier === "rstu-first"
              ? "No SRS · Prioritize $8k RSTU first"
              : "No SRS planned · ≤$" +
                Math.round(
                  Math.min(maxSrsAfterRstu, srsMaxSafeAnnualTo400k),
                ).toLocaleString("en-SG") +
                "/yr safe pace";
    }

    const activeTaxInfo = computeTaxSummary(p, options?.simulation || null);
    return {
      annualGross,
      annualEmployeeCpf,
      existingReliefs,
      totalBaseReliefs,
      reliefCapUsed: totalBaseReliefs,
      reliefCapRemaining,
      chargeableIncome,
      taxBefore,
      activeSelfRstu: activeTaxInfo.activeSelfRstu,
      activeFamilyRstu: activeTaxInfo.activeFamilyRstu,
      activeSrs: activeTaxInfo.activeSrs,
      activeVoluntaryReliefs: activeTaxInfo.activeVoluntaryReliefs,
      activeChargeableIncome: activeTaxInfo.activeChargeableIncome,
      activeTax: activeTaxInfo.activeTax,
      activeTaxSavedAnnual: activeTaxInfo.activeTaxSavedAnnual,
      saRoom,
      maxRstu,
      rstuTaxSaved,
      maxFamilyRstuRoom,
      familyRstuPlanned,
      eligibleFamilyRstu,
      familyRstuTaxSaved,
      potentialFamilyRstuTaxSaved,
      maxSrsAfterRstu,
      maxSrsStandalone,
      srsTaxSavedAfterRstu,
      srsStandaloneTaxSaved,
      combinedTaxSaved,
      srsLockInAge,
      srsWithdrawalStartAge,
      srsWithdrawalEndAge: srsWithdrawalStartAge + 10,
      srsZeroTaxCap,
      srsInvestedIn,
      srsBalanceToday,
      srsAnnualPlanned,
      srsReturnRate,
      srsCoastAt63,
      srsProjectedAt63,
      srsFullCapProjectedAt63,
      srsMaxSafeAnnualTo400k,
      srsTenYearAnnualDraw,
      srsTenYearMonthlyDraw,
      srsTaxableAnnualAt63,
      srsWithdrawalTaxAt63,
      srsSoftCapAt63: C.srsSoftCapAt63,
      srsTrapFloorAt63: C.srsTrapFloorAt63,
      srsYearsToLockIn,
      srsTrapStatus,
      srsTrapTone,
      srsTrapHeadline,
      srsTrapGuidance,
      tier,
      headline,
      guidance,
      srsIdleWarning:
        srsInvestedIn === "cash" &&
        (srsBalanceToday > 0 || srsAnnualPlanned > 0)
          ? "Warning: Your SRS is set to uninvested cash (0.05% p.a.). Invest SRS in Global ETFs, a 60/40 portfolio, or Singapore Savings Bonds so inflation does not erode your tax relief."
          : "SRS cash earns only 0.05% p.a. unless invested in index funds, T-bills, or Singapore Savings Bonds.",
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
      100,
      Math.max(0, Number(p.targetEquityPct ?? 80)),
    );
    const sgSleevePct = Math.min(
      100,
      Math.max(0, Number(p.sgSleevePct ?? C.defaultSgDividendSplitPct)),
    );
    const sgEquitySplitPct = sgSleevePct;
    const globalEquitySplitPct = Math.max(0, 100 - sgEquitySplitPct);
    const globalTargetShareOfEquities = globalEquitySplitPct / 100;
    const sgTargetShareOfEquities = sgEquitySplitPct / 100;

    const effectiveEquityPct =
      totalNetWorth > 0 ? (totalEquities / totalNetWorth) * 100 : 0;
    const effectiveBondPct =
      totalNetWorth > 0 ? (totalBonds / totalNetWorth) * 100 : 0;
    const liquidEquityPct =
      liquidTotal > 0 ? (totalEquities / liquidTotal) * 100 : 0;
    const liquidBondPct =
      liquidTotal > 0 ? (liquidBonds / liquidTotal) * 100 : 0;
    const currentGlobalShareOfEq =
      totalEquities > 0
        ? Math.round((globalEquities / totalEquities) * 100)
        : globalEquitySplitPct;
    const currentSgShareOfEq =
      totalEquities > 0 ? 100 - currentGlobalShareOfEq : sgEquitySplitPct;

    const targetEquityAmt = totalNetWorth * (targetEquityPct / 100);
    const targetBondAmt = totalNetWorth - targetEquityAmt;
    const targetGlobalAmt = targetEquityAmt * globalTargetShareOfEquities;
    const targetSgAmt = targetEquityAmt * sgTargetShareOfEquities;
    const targetGlobalPct =
      Math.round(targetEquityPct * globalTargetShareOfEquities * 10) / 10;
    const targetSgPct =
      Math.round((targetEquityPct - targetGlobalPct) * 10) / 10;
    const equityGap = targetEquityAmt - totalEquities;

    const bondSourceLabel =
      cpfTotal > 0 && liquidBonds > 0
        ? `CPF and SSB/Cash hold ${Math.round(effectiveBondPct)}%`
        : cpfTotal > 0
          ? `CPF holds ${Math.round(effectiveBondPct)}%`
          : `SSB / Cash holds ${Math.round(effectiveBondPct)}%`;

    const investPool = Math.max(0, Number(monthlyInvest || 0));
    const srsMonthlyPlanned = Math.min(
      C.srsCap / 12,
      Math.max(0, Number(p.srsAnnual || 0)) / 12,
    );
    const srsMonthlyEffective = Math.min(srsMonthlyPlanned, investPool);
    const liquidInvestPool = Math.max(0, investPool - srsMonthlyEffective);
    let buyGlobalMonthly = 0,
      buySgMonthly = 0,
      buyBondMonthly = 0,
      rebalanceNote = "";

    if (investPool <= 0.5) {
      rebalanceNote =
        equityGap > 500
          ? `Total portfolio is ${Math.round(effectiveEquityPct)}% equities vs ${targetEquityPct}% target (${bondSourceLabel} in fixed income). Set monthly outside investment to see exact buy orders.`
          : "Set monthly outside investment in Trajectory or Quick Edit to see exact monthly buy orders.";
    } else if (liquidInvestPool <= 0.5) {
      rebalanceNote = `Your full monthly outside investment ($${Math.round(investPool).toLocaleString("en-SG")}/mo) funds your planned SRS contribution. Increase monthly outside savings to add liquid ETF/SSB buys.`;
    } else {
      // Direct proportional split of net-of-SRS liquid savings following the user-chosen Equity/Bond & Global/SG sliders.
      const eqShare = targetEquityPct / 100;
      const totalEqBuy = Math.round(liquidInvestPool * eqShare);
      buySgMonthly = Math.round(totalEqBuy * sgTargetShareOfEquities);
      buyGlobalMonthly = Math.max(0, totalEqBuy - buySgMonthly);
      buyBondMonthly = Math.max(0, Math.round(liquidInvestPool) - totalEqBuy);
      rebalanceNote = `Monthly liquid outside investment${srsMonthlyEffective > 0 ? ` ($${Math.round(liquidInvestPool).toLocaleString("en-SG")}/mo after $${Math.round(srsMonthlyEffective).toLocaleString("en-SG")}/mo SRS)` : ""} follows your chosen ${targetEquityPct}/${100 - targetEquityPct} Equity/Bond split (${globalEquitySplitPct}% Global / ${sgEquitySplitPct}% SG).${Math.abs(equityGap) > 500 ? ` Current holistic mix is ${Math.round(effectiveEquityPct)}% equities (${bondSourceLabel} in fixed income).` : ""}`;
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
        globalEquitySplitPct,
        sgEquitySplitPct,
        currentGlobalShareOfEq,
        currentSgShareOfEq,
        targetGlobalPct,
        targetSgPct,
        targetGlobalAmt,
        targetSgAmt,
        targetEquityAmt,
        targetBondAmt,
        equityGap,
      },
      monthlyRebalance: {
        investPool,
        srsMonthly: Math.round(srsMonthlyEffective),
        liquidInvestPool: Math.round(liquidInvestPool),
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
    const endAge = resolveLongevityAge(p, C.fireEndAge);
    const inflation = summary.inflation;
    const investmentReturn = summary.investmentReturn;
    const lifestyle = summary.lifestyle;
    const plan = summary.plan;
    const todaySpend = summary.todaySpend;
    const todayBridge = Math.max(
      0,
      Number(p.bridgeIncome ?? summary.bridgeIncome ?? 0),
    );
    const rate = monthlyRate(investmentReturn);
    const cashReturnAnnual = resolveCashReturnRate(p);
    const cashRate = monthlyRate(cashReturnAnnual);
    const srsWithdrawalAge = Number(p.srsAge) === 64 ? 64 : 63;
    const srsRate = monthlyRate(resolveSrsReturnRate(p, investmentReturn));

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
          { insuranceCurve: true },
        );
        const bridgeM =
          todayBridge > 0
            ? todayBridge * (1 + inflation) ** (retire - age + t)
            : 0;
        bridgeCorpusAtRetire += Math.max(0, spendM - bridgeM) / (1 + rate) ** m;
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
        { insuranceCurve: true },
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
      1,
      Math.max(0, Number(p.targetEquityPct ?? 80) / 100),
    );
    const monthlyCashSaving = Math.max(
      0,
      Number(sim.cashSaving ?? p.cashSaving ?? 0),
    );
    const totalMonthlyOutside = Math.max(0, sim.invest);
    const effectiveMonthlySrs = Math.min(
      monthlySrsContrib,
      totalMonthlyOutside,
    );
    const monthlyLiquidContrib = Math.max(
      0,
      totalMonthlyOutside - effectiveMonthlySrs,
    );
    const srsWindowStart = Math.max(srsWithdrawalAge, retire);
    const splitDirectLiquidContrib = (contrib, cashSav = 0) => ({
      eqBuy: contrib * targetEqShare,
      cashBuy: cashSav + contrib * (1 - targetEqShare),
    });

    let liquidEquities = buckets.equities + buckets.sgDividends;
    let ssbCash = buckets.ssbCash;
    let srs = buckets.srs;

    const oaMonthlyRate = monthlyRate(C.oaRate);
    const raSweepPlanned65 = sim.cpfResult.raSweepAt65 || 0;
    const cohortBhs65 =
      sim.cpfResult.bhs65 ?? C.bhs * (1 + C.bhsGrowth) ** (65 - age);
    const scale55 = retirementSum(C.year + 55 - age) / C.frs;
    let effectivePayout65 = payout65;
    let cpfOA = Number(p.oa || 0);
    let cpfSARA = Number(p.sa || 0);
    let cpfMA = Number(p.ma || 0);
    let cpfAnnuity = 0;
    let oaWithdrawnPost55 = 0;

    let outsideAtRetire = buckets.total;
    let spendableAtRetire = buckets.total;
    let atRetirePoint = null;
    let depletionAge = null;
    let shortfallPvAtRetire = 0;
    const points = [];

    // Shared monthly retirement drawdown step used by both the main firePlan
    // trajectory loop and survivesDrawdownFromAge() so growth-before-withdrawal,
    // IRAS SRS 10-year withdrawal tax, deemed withdrawal, and bucket priority
    // stay 100% consistent.
    const stepRetirementDrawdown = (
      st,
      curAge,
      srsStart,
      monthlySpend,
      monthlyCpfLife,
      monthlyBridge,
      srsYr10Taxable = 0,
    ) => {
      let eq = st.eq;
      let cash = st.cash;
      let srsBal = st.srs;
      let oa = st.oa;
      // Under IRAS SRS rules, the 10-year penalty-free window begins on first withdrawal
      // (max of statutory withdrawal age and retirement age); any residual at the end of
      // year 10 is deemed withdrawn (50% taxable) in Year 10 (stacked onto Year 10 taxable income).
      if (curAge >= srsStart + 10 && srsBal > 0) {
        const deemedBase = Math.max(0, srsYr10Taxable);
        const deemedTax = Math.max(
          0,
          residentTax(deemedBase + srsBal * 0.5).annualTax -
            residentTax(deemedBase).annualTax,
        );
        cash += Math.max(0, srsBal - deemedTax);
        srsBal = 0;
      }
      // Credit 1 month of growth before end-of-month withdrawal, matching
      // simulate(), portfolioTarget(), and bridge/phase2 PV formulas.
      const grownEq = eq * (1 + rate);
      const grownCash = cash * (1 + cashRate);
      const grownSrs = srsBal * (1 + srsRate);
      const grownOa = curAge >= 65 ? oa * (1 + oaMonthlyRate) : oa;

      const need = Math.max(0, monthlySpend - monthlyCpfLife - monthlyBridge);
      let monthlySrsDraw = 0;
      let srsTaxMonthly = 0;
      let netSrsDraw = 0;
      let srsSurplusToCash = 0;
      if (curAge >= srsStart && curAge < srsStart + 10 && grownSrs > 0) {
        const remSrsMonths = Math.max(
          1,
          Math.round((srsStart + 10 - curAge) * 12),
        );
        const scheduledSrs = grownSrs / remSrsMonths;
        const bridgeBoost =
          curAge < 65 ? C.srsTaxFreeAnnual / 12 : scheduledSrs;
        const bridgeAnnual = monthlyBridge * 12;
        // Proactive 10-year tax-free sweep: even when CPF LIFE covers most spending,
        // withdraw up to the $40k/yr IRAS $0-tax band (net of any taxable bridge income)
        // into liquid cash so residual SRS does not trigger a year-10 deemed-withdrawal tax bomb.
        const taxFreeSrsMonthlyRoom = Math.max(
          0,
          (C.srsTaxFreeAnnual - bridgeAnnual * 2) / 12,
        );
        const spendDrivenSrs = Math.min(
          grownSrs,
          need,
          Math.max(scheduledSrs, bridgeBoost),
        );
        const taxFreeSweepSrs = Math.min(
          grownSrs,
          Math.min(scheduledSrs, taxFreeSrsMonthlyRoom),
        );
        monthlySrsDraw = Math.max(spendDrivenSrs, taxFreeSweepSrs);
        // 50% of SRS withdrawal is taxable under IRAS alongside any taxable bridge income.
        srsTaxMonthly = Math.max(
          0,
          residentTax(bridgeAnnual + monthlySrsDraw * 12 * 0.5).monthlyTax -
            residentTax(bridgeAnnual).monthlyTax,
        );
        const netSrsTotal = Math.max(0, monthlySrsDraw - srsTaxMonthly);
        netSrsDraw = Math.min(need, netSrsTotal);
        srsSurplusToCash = Math.max(0, netSrsTotal - netSrsDraw);
      }
      const needAfterSrs = Math.max(0, need - netSrsDraw);
      const oaAvailable = curAge >= 55 ? Math.max(0, grownOa) : 0;
      let monthlyCashDraw = 0;
      let monthlyOaDraw = 0;
      let monthlyEqDraw = 0;
      if (cashRate < rate) {
        monthlyCashDraw = Math.min(grownCash, needAfterSrs);
        const remAfterCash = Math.max(0, needAfterSrs - monthlyCashDraw);
        if (C.oaRate < investmentReturn && oaAvailable > 0) {
          monthlyOaDraw = Math.min(oaAvailable, remAfterCash);
          const remAfterOa = Math.max(0, remAfterCash - monthlyOaDraw);
          monthlyEqDraw = Math.min(grownEq, remAfterOa);
        } else {
          monthlyEqDraw = Math.min(grownEq, remAfterCash);
          const remAfterEq = Math.max(0, remAfterCash - monthlyEqDraw);
          monthlyOaDraw = Math.min(oaAvailable, remAfterEq);
        }
      } else {
        const totalOut = grownEq + grownCash;
        const outDraw = Math.min(totalOut, needAfterSrs);
        const eqRatio = totalOut > 0 ? grownEq / totalOut : 0;
        monthlyEqDraw = outDraw * eqRatio;
        monthlyCashDraw = outDraw - monthlyEqDraw;
        const remAfterOut = Math.max(0, needAfterSrs - outDraw);
        monthlyOaDraw = Math.min(oaAvailable, remAfterOut);
      }
      const monthlyLiquidDraw = monthlyCashDraw + monthlyOaDraw + monthlyEqDraw;
      const monthlyShortfall = Math.max(0, needAfterSrs - monthlyLiquidDraw);
      return {
        monthlySrsDraw,
        srsTaxMonthly,
        netSrsDraw,
        srsSurplusToCash,
        monthlyCashDraw,
        monthlyOaDraw,
        monthlyEqDraw,
        monthlyLiquidDraw,
        monthlyShortfall,
        nextEq: Math.max(0, grownEq - monthlyEqDraw),
        nextCash: Math.max(0, grownCash - monthlyCashDraw) + srsSurplusToCash,
        nextSrs: Math.max(0, grownSrs - monthlySrsDraw),
        nextOa: Math.max(0, grownOa - monthlyOaDraw),
        oaWithdrawnDelta: curAge < 65 ? monthlyOaDraw : 0,
      };
    };
    const syncAnnualCpfBalances = (
      intAge,
      cpfMap,
      raSweepPlanned,
      curOa,
      curPayout65,
      state,
    ) => {
      const row = cpfMap.get(intAge);
      if (intAge > 55) {
        state.prior =
          state.prior * (1 + C.oaRate) + state.ytd + state.lostIntYtd;
        state.ytd = 0;
        state.lostIntYtd = 0;
      }
      const totalWithdrawn = state.prior;
      if (intAge === 65 && totalWithdrawn > 0 && raSweepPlanned > 0) {
        const preSweepOa65 = row.oa + raSweepPlanned;
        const actualPreSweepOa65 = Math.max(0, preSweepOa65 - totalWithdrawn);
        const actualSweep65 = Math.min(actualPreSweepOa65, raSweepPlanned);
        const sweepShortfall = Math.max(0, raSweepPlanned - actualSweep65);
        const nextOa = Math.max(0, actualPreSweepOa65 - actualSweep65);
        const effectiveRa65 = Math.max(0, row.ra - sweepShortfall);
        const nextPayout65 =
          sweepShortfall > 0.01
            ? payoutFrom65(effectiveRa65, scale55) *
              (plan === "escalating" ? C.escalatingRatio : 1)
            : curPayout65;
        return {
          oa: nextOa,
          sara: effectiveRa65,
          ma: Math.min(row.ma, cohortBhs65),
          annuity: effectiveRa65,
          payout65: nextPayout65,
        };
      }
      return {
        oa: Math.max(0, row.oa - totalWithdrawn),
        sara: intAge < 55 ? row.sa : row.ra,
        ma: intAge === 65 ? Math.min(row.ma, cohortBhs65) : row.ma,
        annuity: intAge === 65 ? row.ra : 0,
        payout65: curPayout65,
      };
    };
    const recordOaWithdrawal = (state, delta, monthIdx) => {
      if (delta <= 0) return;
      const remMonths = 12 - (monthIdx % 12);
      state.ytd += delta;
      state.lostIntYtd += delta * C.oaRate * (remMonths / 12);
    };
    const mainOaState = { prior: 0, ytd: 0, lostIntYtd: 0 };
    let mainSrsYr10Taxable = 0;

    for (let m = 0; m <= endMonth; m++) {
      const curAge = age + m / 12;
      const retired = m >= retireMonth;
      if (m % 12 === 0) {
        const intAge = Math.round(curAge);
        if (intAge <= 65 && cpfByAge.has(intAge)) {
          const synced = syncAnnualCpfBalances(
            intAge,
            cpfByAge,
            raSweepPlanned65,
            cpfOA,
            effectivePayout65,
            mainOaState,
          );
          cpfOA = synced.oa;
          cpfSARA = synced.sara;
          cpfMA = synced.ma;
          cpfAnnuity = synced.annuity;
          effectivePayout65 = synced.payout65;
          oaWithdrawnPost55 = mainOaState.prior;
        } else if (intAge > 65) {
          // Post-65 OA compounds monthly below whether working or retired.
          // BHS is fixed for life at age 65; post-65 MediSave healthcare draws prevent runaway compounding above cohort BHS.
          cpfMA = Math.min(cpfMA * (1 + C.saRate), cohortBhs65);
          // CPF LIFE Standard/Escalating bequest = initial RA premium committed at 65 minus cumulative payouts received.
          const prevYearPayout =
            effectivePayout65 *
            (plan === "escalating"
              ? (1 + C.escalatingRate) ** Math.max(0, intAge - 66)
              : 1) *
            12;
          cpfAnnuity = Math.max(0, cpfAnnuity - prevYearPayout);
          cpfSARA = cpfAnnuity;
        }
      }
      const cpfElapsed = curAge >= 65 ? Math.floor(curAge - 65 + 1e-9) : 0;
      const monthlyCpfLife =
        curAge < 65
          ? 0
          : effectivePayout65 *
            (plan === "escalating" ? (1 + C.escalatingRate) ** cpfElapsed : 1);
      const monthlySpend = expenseAt(
        todaySpend,
        age,
        m / 12,
        inflation,
        lifestyle,
        { insuranceCurve: true },
      );

      const monthlyBridge =
        retired && curAge < 65 && todayBridge > 0
          ? todayBridge * (1 + inflation) ** (m / 12)
          : 0;
      let monthlySrsDraw = 0;
      let monthlySrsTax = 0;
      let netSrsDraw = 0;
      let monthlyCashDraw = 0;
      let monthlyOaDraw = 0;
      let monthlyEqDraw = 0;
      let monthlyLiquidDraw = 0;
      let monthlyShortfall = 0;
      let drawStep = null;
      if (retired && m < endMonth) {
        drawStep = stepRetirementDrawdown(
          { eq: liquidEquities, cash: ssbCash, srs, oa: cpfOA },
          curAge,
          srsWindowStart,
          monthlySpend,
          monthlyCpfLife,
          monthlyBridge,
          mainSrsYr10Taxable,
        );
        if (curAge >= srsWindowStart + 9 && curAge < srsWindowStart + 10) {
          mainSrsYr10Taxable += drawStep.monthlySrsDraw * 0.5 + monthlyBridge;
        }
        monthlySrsDraw = drawStep.monthlySrsDraw;
        monthlySrsTax = drawStep.srsTaxMonthly;
        netSrsDraw = drawStep.netSrsDraw;
        monthlyCashDraw = drawStep.monthlyCashDraw;
        monthlyOaDraw = drawStep.monthlyOaDraw;
        monthlyEqDraw = drawStep.monthlyEqDraw;
        monthlyLiquidDraw = drawStep.monthlyLiquidDraw;
        monthlyShortfall = drawStep.monthlyShortfall;
        if (monthlyShortfall > 0.05) {
          if (depletionAge === null) depletionAge = curAge;
          shortfallPvAtRetire +=
            monthlyShortfall / (1 + rate) ** Math.max(1, m - retireMonth + 1);
        }
      }

      const buildPointSnapshot = (snapAge) => {
        const year = C.year + Math.floor((C.startMonth + m) / 12);
        const cpfTotal = cpfOA + cpfSARA + cpfMA;
        const totalOutside = liquidEquities + ssbCash + srs;
        const spendableNetWorth =
          totalOutside + (snapAge >= 55 ? Math.max(0, cpfOA) : 0);
        const totalNetWorth = totalOutside + cpfTotal;
        const monthlyTotalIncome =
          monthlyCpfLife + monthlyBridge + netSrsDraw + monthlyLiquidDraw;
        const isAccum = snapAge < retire;
        const monthlyOutsideSave = isAccum
          ? totalMonthlyOutside + monthlyCashSaving
          : 0;
        const monthlyExtraCpf =
          isAccum && snapAge < 55
            ? Math.max(0, Number(sim.cpfExtra ?? p.cpfExtra ?? 0))
            : 0;
        const disc = (val) => todayValue(val, snapAge, age, inflation);
        return {
          age: snapAge,
          year,
          phase:
            snapAge < retire
              ? "accumulating"
              : snapAge < 65
                ? "bridge"
                : "phase2",
          monthlyOutsideSave,
          monthlyExtraCpf,
          monthlySpend,
          monthlyCpfLife,
          monthlyBridge,
          monthlySrsDraw,
          monthlySrsTax,
          monthlyCashDraw,
          monthlyOaDraw,
          monthlyEqDraw,
          monthlyLiquidDraw,
          monthlyTotalIncome,
          monthlyShortfall,
          liquidEquities,
          ssbCash,
          srs,
          cpfOA,
          cpfSARA,
          cpfMA,
          cpfTotal,
          totalOutside,
          spendableNetWorth,
          totalNetWorth,
          today: {
            monthlyOutsideSave: disc(monthlyOutsideSave),
            monthlyExtraCpf: disc(monthlyExtraCpf),
            monthlySpend: disc(monthlySpend),
            monthlyCpfLife: disc(monthlyCpfLife),
            monthlyBridge: disc(monthlyBridge),
            monthlySrsDraw: disc(monthlySrsDraw),
            monthlySrsTax: disc(monthlySrsTax),
            monthlyCashDraw: disc(monthlyCashDraw),
            monthlyOaDraw: disc(monthlyOaDraw),
            monthlyEqDraw: disc(monthlyEqDraw),
            monthlyLiquidDraw: disc(monthlyLiquidDraw),
            monthlyTotalIncome: disc(monthlyTotalIncome),
            monthlyShortfall: disc(monthlyShortfall),
            liquidEquities: disc(liquidEquities),
            ssbCash: disc(ssbCash),
            srs: disc(srs),
            cpfOA: disc(cpfOA),
            cpfSARA: disc(cpfSARA),
            cpfMA: disc(cpfMA),
            cpfTotal: disc(cpfTotal),
            totalOutside: disc(totalOutside),
            spendableNetWorth: disc(spendableNetWorth),
            totalNetWorth: disc(totalNetWorth),
          },
        };
      };

      if (m === retireMonth) {
        outsideAtRetire = liquidEquities + ssbCash + srs;
        spendableAtRetire =
          outsideAtRetire + (curAge >= 55 ? Math.max(0, cpfOA) : 0);
        atRetirePoint = buildPointSnapshot(retire);
      }

      if (m % 12 === 0) {
        points.push(buildPointSnapshot(Math.round(curAge)));
      }

      if (m === endMonth) break;
      if (!retired) {
        const { eqBuy, cashBuy } = splitDirectLiquidContrib(
          monthlyLiquidContrib,
          monthlyCashSaving,
        );
        liquidEquities = liquidEquities * (1 + rate) + eqBuy;
        // If working past age 65, CPF LIFE payouts already commenced at 65 are retained in cash.
        ssbCash =
          ssbCash * (1 + cashRate) +
          cashBuy +
          (curAge >= 65 ? monthlyCpfLife : 0);
        srs = srs * (1 + srsRate) + effectiveMonthlySrs;
        if (curAge >= 65) {
          cpfOA = cpfOA * (1 + oaMonthlyRate);
        }
      } else if (drawStep) {
        liquidEquities = drawStep.nextEq;
        ssbCash = drawStep.nextCash;
        srs = drawStep.nextSrs;
        cpfOA = drawStep.nextOa;
        if (drawStep.oaWithdrawnDelta > 0) {
          recordOaWithdrawal(mainOaState, drawStep.oaWithdrawnDelta, m);
          oaWithdrawnPost55 =
            mainOaState.prior + mainOaState.ytd + mainOaState.lostIntYtd;
        }
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
    const spendableAtRetireToday = todayValue(
      spendableAtRetire,
      retire,
      age,
      inflation,
    );
    const effectiveFireNumberAtRetire =
      depletionAge !== null
        ? Math.max(fireNumberAtRetire, spendableAtRetire + shortfallPvAtRetire)
        : fireNumberAtRetire;
    const effectiveFireNumberToday = todayValue(
      effectiveFireNumberAtRetire,
      retire,
      age,
      inflation,
    );
    const rawPctFunded =
      effectiveFireNumberToday > 0
        ? Math.round((spendableAtRetireToday / effectiveFireNumberToday) * 100)
        : 100;
    const pctFunded =
      depletionAge !== null
        ? Math.min(99, rawPctFunded)
        : Math.max(100, rawPctFunded);
    const currentFirePct =
      effectiveFireNumberToday > 0
        ? Math.min(
            100,
            Math.round((buckets.total / effectiveFireNumberToday) * 100),
          )
        : 100;

    // Earliest FIRE age where accumulated outside + post-55 excess OA pot (saving until candidate age) funds Phase 1 + Phase 2 to endAge
    const candCpfCache = new Map();
    const getCandCpfContext = (candAge) => {
      const workCap = p.post55Work ? 65 : 55;
      const effCandWork = Math.min(candAge, workCap);
      const effRetWork = Math.min(retire, workCap);
      if (Math.abs(effCandWork - effRetWork) < 1e-6) {
        return {
          map: cpfByAge,
          payout65: payout65,
          raSweep65: raSweepPlanned65,
        };
      }
      if (candCpfCache.has(candAge)) return candCpfCache.get(candAge);
      const cCpf = projectCPF(
        { ...p, retire: candAge },
        sim.cpfExtra || 0,
        selectedKey,
      );
      const cMap = new Map();
      for (const row of cCpf.ledger) cMap.set(Math.round(row.age), row);
      const cPayout65 =
        payoutFrom65(cCpf.ra65, scale55) *
        (plan === "escalating" ? C.escalatingRatio : 1);
      const ctx = {
        map: cMap,
        payout65: cPayout65,
        raSweep65: cCpf.raSweepAt65 || 0,
      };
      candCpfCache.set(candAge, ctx);
      return ctx;
    };

    const survivesDrawdownFromAge = (
      candAge,
      startEq,
      startCash,
      startSrs,
      startOa,
      cpfCtx = null,
    ) => {
      const activeCpf = cpfCtx || {
        map: cpfByAge,
        payout65,
        raSweep65: raSweepPlanned65,
      };
      let dEq = startEq;
      let dCash = startCash;
      let dSrs = startSrs;
      let dOa = startOa;
      let dPayout65 = activeCpf.payout65;
      const candOaState = { prior: 0, ytd: 0, lostIntYtd: 0 };
      let candSrsYr10Taxable = 0;
      const startM = Math.round((candAge - age) * 12);
      for (let dm = startM; dm < endMonth; dm++) {
        const cAge = age + dm / 12;
        if (dm > startM && dm % 12 === 0) {
          const intA = Math.round(cAge);
          if (intA <= 65 && activeCpf.map.has(intA)) {
            const synced = syncAnnualCpfBalances(
              intA,
              activeCpf.map,
              activeCpf.raSweep65,
              dOa,
              dPayout65,
              candOaState,
            );
            dOa = synced.oa;
            dPayout65 = synced.payout65;
          }
        }
        const cEl = cAge >= 65 ? Math.floor(cAge - 65 + 1e-9) : 0;
        const cP =
          cAge < 65
            ? 0
            : dPayout65 *
              (plan === "escalating" ? (1 + C.escalatingRate) ** cEl : 1);
        const sp = expenseAt(todaySpend, age, dm / 12, inflation, lifestyle, {
          insuranceCurve: true,
        });
        const brM =
          cAge < 65 && todayBridge > 0
            ? todayBridge * (1 + inflation) ** (dm / 12)
            : 0;
        const dSrsStart = Math.max(srsWithdrawalAge, candAge);
        const step = stepRetirementDrawdown(
          { eq: dEq, cash: dCash, srs: dSrs, oa: dOa },
          cAge,
          dSrsStart,
          sp,
          cP,
          brM,
          candSrsYr10Taxable,
        );
        if (cAge >= dSrsStart + 9 && cAge < dSrsStart + 10) {
          candSrsYr10Taxable += step.monthlySrsDraw * 0.5 + brM;
        }
        if (step.monthlyShortfall > 0.05) return false;
        dEq = step.nextEq;
        dCash = step.nextCash;
        dSrs = step.nextSrs;
        dOa = step.nextOa;
        if (step.oaWithdrawnDelta > 0) {
          recordOaWithdrawal(candOaState, step.oaWithdrawnDelta, dm);
        }
      }
      return true;
    };

    let projectedFireAge = null;
    const minFireAge = Math.max(age, lifestyle === "cca" ? 55 : 40);
    const candStateByAge = new Map();
    if (!options.skipSolvers) {
      let candEq = buckets.equities + buckets.sgDividends;
      let candCash = buckets.ssbCash;
      let candSrs = buckets.srs;
      const maxCandMonths = Math.max(0, Math.round((80 - age) * 12));
      for (let cm = 0; cm <= maxCandMonths; cm++) {
        if (cm % 12 === 0) {
          const cAge = age + cm / 12;
          let oaAtCand = 0;
          if (cAge <= 65 && cpfByAge.has(cAge)) {
            oaAtCand = cpfByAge.get(cAge).oa;
          } else if (cAge > 65) {
            oaAtCand =
              (cpfByAge.get(65)?.oa || 0) * (1 + C.oaRate) ** (cAge - 65);
          }
          candStateByAge.set(cAge, {
            eq: candEq,
            cash: candCash,
            srs: candSrs,
            oa: oaAtCand,
          });
        }
        if (cm === maxCandMonths) break;
        const { eqBuy, cashBuy } = splitDirectLiquidContrib(
          monthlyLiquidContrib,
          monthlyCashSaving,
        );
        const cAgeNow = age + cm / 12;
        const cElNow = cAgeNow >= 65 ? Math.floor(cAgeNow - 65 + 1e-9) : 0;
        const candCpfLifeNow =
          cAgeNow >= 65
            ? payout65 *
              (plan === "escalating" ? (1 + C.escalatingRate) ** cElNow : 1)
            : 0;
        candEq = candEq * (1 + rate) + eqBuy;
        candCash = candCash * (1 + cashRate) + cashBuy + candCpfLifeNow;
        candSrs = candSrs * (1 + srsRate) + effectiveMonthlySrs;
      }
      const maxFireCand = Math.min(80, endAge - 1);
      for (let cand = minFireAge; cand <= maxFireCand; cand++) {
        const st = candStateByAge.get(cand);
        if (!st) continue;
        const cCtx = getCandCpfContext(cand);
        let candOaStart = st.oa;
        if (cand <= 65 && cCtx.map.has(cand)) {
          candOaStart = cCtx.map.get(cand).oa;
        } else if (cand > 65) {
          candOaStart =
            (cCtx.map.get(65)?.oa || 0) * (1 + C.oaRate) ** (cand - 65);
        }
        let candCashStart = st.cash;
        if (cand > 65 && Math.abs(cCtx.payout65 - payout65) > 0.01) {
          const deltaPayout = cCtx.payout65 - payout65;
          const extraMonths = Math.round((cand - 65) * 12);
          let extraCash = 0;
          for (let em = 0; em < extraMonths; em++) {
            const eEl = Math.floor(em / 12 + 1e-9);
            extraCash =
              extraCash * (1 + cashRate) +
              deltaPayout *
                (plan === "escalating" ? (1 + C.escalatingRate) ** eEl : 1);
          }
          candCashStart += extraCash;
        }
        if (
          survivesDrawdownFromAge(
            cand,
            st.eq,
            candCashStart,
            st.srs,
            candOaStart,
            cCtx,
          )
        ) {
          projectedFireAge = cand;
          break;
        }
      }
    }

    const requiredMonthlyTo95 = requiredSaving(
      effectiveFireNumberAtRetire,
      buckets.total,
      rate,
      retireMonth,
    );
    let requiredInvestTo95 =
      retireMonth > 0
        ? Math.max(0, Math.ceil(requiredMonthlyTo95 - monthlyCashSaving))
        : Math.max(0, Math.ceil(requiredMonthlyTo95));
    if (!options.skipSolvers && retireMonth > 0) {
      const stRet = candStateByAge.get(retire);
      const oaAtRet = atRetirePoint
        ? atRetirePoint.cpfOA
        : stRet
          ? stRet.oa
          : 0;
      const eqF = annuityFactor(rate, retireMonth);
      const cashF = annuityFactor(cashRate, retireMonth);
      const baseEqRet =
        (buckets.equities + buckets.sgDividends) * (1 + rate) ** retireMonth;
      let retainedCpfCashRet = 0;
      if (retire > 65) {
        const start65M = Math.max(0, Math.round((65 - age) * 12));
        for (let rm = start65M; rm < retireMonth; rm++) {
          const rAge = age + rm / 12;
          const rEl = Math.floor(rAge - 65 + 1e-9);
          const rPayout =
            payout65 *
            (plan === "escalating" ? (1 + C.escalatingRate) ** rEl : 1);
          retainedCpfCashRet = retainedCpfCashRet * (1 + cashRate) + rPayout;
        }
      }
      const baseCashRet =
        buckets.ssbCash * (1 + cashRate) ** retireMonth + retainedCpfCashRet;
      const srsF = annuityFactor(srsRate, retireMonth);
      const baseSrsRet = buckets.srs * (1 + srsRate) ** retireMonth;
      const testSurvives = (testTotalInv) => {
        const candSrs = Math.min(monthlySrsContrib, Math.max(0, testTotalInv));
        const candLiquid = Math.max(0, testTotalInv - candSrs);
        const { eqBuy, cashBuy } = splitDirectLiquidContrib(
          candLiquid,
          monthlyCashSaving,
        );
        return survivesDrawdownFromAge(
          retire,
          baseEqRet + eqBuy * eqF,
          baseCashRet + cashBuy * cashF,
          baseSrsRet + candSrs * srsF,
          oaAtRet,
        );
      };
      if (depletionAge !== null) {
        let lo = Math.max(0, Math.floor(totalMonthlyOutside) + 1);
        let hi = Math.max(lo + 500, Math.ceil(requiredMonthlyTo95 * 1.6) + 500);
        const hiCap = Math.max(250000, hi * 16);
        while (!testSurvives(hi) && hi < hiCap) hi *= 2;
        for (let step = 0; step < 18; step++) {
          if (lo >= hi) break;
          const mid = Math.floor((lo + hi) / 2);
          if (testSurvives(mid)) hi = mid;
          else lo = mid + 1;
        }
        requiredInvestTo95 = lo;
      } else {
        // Already funded through endAge: solve downward for the true minimum monthly investment.
        if (testSurvives(0)) {
          requiredInvestTo95 = 0;
        } else {
          let lo = 0;
          let hi = Math.max(0, Math.ceil(totalMonthlyOutside));
          for (let step = 0; step < 18; step++) {
            if (lo >= hi) break;
            const mid = Math.floor((lo + hi) / 2);
            if (testSurvives(mid)) hi = mid;
            else lo = mid + 1;
          }
          requiredInvestTo95 = lo;
        }
      }
    }

    const fmt = fmtSgd;
    const totalMonthlySaving = sim.cpfExtra + monthlyCashSaving + sim.invest;
    const elevatorPitch = `I need ${fmt(effectiveFireNumberToday)} in outside & SRS investments (${retire < 65 ? `${fmt(bridgeCorpusToday)} bridge for ages ${retire}–65 + ` : ""}${fmt(phase2CorpusToday)} to top up my ${fmt(todayValue(effectivePayout65, 65, age, inflation))}/mo CPF LIFE floor) to retire at age ${retire}. With ${fmt(buckets.total)} invested today${totalMonthlySaving > 0 ? ` and ${fmt(totalMonthlySaving)}/mo saved` : ""}, I’m ${pctFunded}% funded at ${retire}${projectedFireAge != null ? ` and hit financial independence at age ${projectedFireAge}` : ""}.`;

    return {
      age,
      retire,
      endAge,
      srsWithdrawalAge,
      buckets,
      cashReturnRate: cashReturnAnnual,
      bridge: {
        years: Math.max(0, 65 - retire),
        monthlyBridgeToday: todayBridge,
        requiredAtRetire: bridgeCorpusAtRetire,
        requiredToday: bridgeCorpusToday,
      },
      phase2: {
        years: Math.max(0, endAge - phase2StartAge),
        requiredAtRetire: phase2CorpusAtRetire,
        requiredToday: phase2CorpusToday,
        cpfLife65Nominal: effectivePayout65,
        cpfLife65Today: todayValue(effectivePayout65, 65, age, inflation),
        projectedCpfAt65Nominal: ptAt65 ? ptAt65.cpfTotal : 0,
        projectedCpfAt65Today: ptAt65 ? ptAt65.today.cpfTotal : 0,
      },
      fireNumber: {
        totalRequiredAtRetire: effectiveFireNumberAtRetire,
        totalRequiredToday: effectiveFireNumberToday,
        requiredMonthlyTo95,
        requiredInvestTo95,
        projectedOutsideAtRetireNominal: outsideAtRetire,
        projectedOutsideAtRetireToday: outsideAtRetireToday,
        projectedSpendableAtRetireNominal: spendableAtRetire,
        projectedSpendableAtRetireToday: spendableAtRetireToday,
        shortfallToday: Math.max(
          0,
          effectiveFireNumberToday - spendableAtRetireToday,
        ),
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
              oaOverflowToday: ptAt55.today.cpfOA,
              oaInterestMonthlyNominal: (ptAt55.cpfOA * C.oaRate) / 12,
              oaInterestMonthlyToday: (ptAt55.today.cpfOA * C.oaRate) / 12,
              oaRef500kMonthly: Math.round(
                (C.oaInterestRefBalance * C.oaRate) / 12,
              ),
            }
          : null,
        srsAge: srsWithdrawalAge,
        age65: {
          age: 65,
          cpfLifeToday: todayValue(effectivePayout65, 65, age, inflation),
          cpfTotalToday: ptAt65 ? ptAt65.today.cpfTotal : 0,
        },
      },
      atRetire: atRetirePoint,
      points,
      elevatorPitch,
    };
  }

  // Unified multi-bucket simulation & Auto-investment solver so Overview, Trajectory, and Print Summary share 100% identical numbers.
  function solveBucketAwareSimulation(
    rawP,
    selectedKey = "salary",
    options = {},
  ) {
    const effLongevity = resolveLongevityAge(rawP, C.fireEndAge);
    const memoCashBreakdown =
      rawP?._cashBreakdown ||
      (rawP?.cashAccountsActive &&
      Array.isArray(rawP?.cashAccounts) &&
      rawP.cashAccounts.length > 0
        ? computeCashAccountsBreakdown(rawP.cashAccounts, rawP.masRates)
        : null);
    const pWithHorizon = memoCashBreakdown
      ? {
          ...rawP,
          longevityAge: effLongevity,
          _cashBreakdown: memoCashBreakdown,
        }
      : { ...rawP, longevityAge: effLongevity };
    const effP = withEffectiveSavings(pWithHorizon);
    const summary = options.summary || calculate(effP);
    const userHasInvest = rawP?.invest != null && rawP?.invest !== "";
    const initialSim = simulate(effP, selectedKey, { summary });
    let solvedAutoInvest = Math.round(
      initialSim.selectedScenario.privateSaving || 0,
    );

    if (!summary.retiringNow) {
      const srsMo =
        Math.min(C.srsCap, Math.max(0, Number(effP.srsAnnual || 0))) / 12;
      const cachedCpfResult = initialSim.cpfResult;
      const testFunded = (candInvest) => {
        const candP = { ...effP, invest: candInvest };
        const candSim = simulate(candP, selectedKey, {
          summary,
          cpfResult: cachedCpfResult,
        });
        const candFire = firePlan(candP, selectedKey, {
          summary,
          simulation: candSim,
          skipSolvers: true,
        });
        return candFire.fireNumber.depletionAge === null;
      };
      if (testFunded(0)) {
        solvedAutoInvest = 0;
      } else {
        let lo = 0;
        let hi = Math.max(
          Math.ceil(srsMo) + 500,
          Math.ceil(solvedAutoInvest * 1.6) + 500,
        );
        const maxHi = Math.max(250000, hi * 16);
        while (!testFunded(hi) && hi < maxHi) hi *= 2;
        for (let step = 0; step < 24; step++) {
          if (lo >= hi) break;
          const mid = Math.floor((lo + hi) / 2);
          if (testFunded(mid)) hi = mid;
          else lo = mid + 1;
        }
        solvedAutoInvest = lo;
      }
    } else {
      solvedAutoInvest = 0;
    }

    const activeInvest = summary.retiringNow
      ? 0
      : userHasInvest
        ? Number(rawP.invest)
        : solvedAutoInvest;
    const finalP = { ...effP, invest: activeInvest };
    const rawSim = simulate(finalP, selectedKey, {
      summary,
      cpfResult: initialSim.cpfResult,
    });
    const fire = firePlan(finalP, selectedKey, {
      summary,
      simulation: rawSim,
    });

    const reconciledPoints = fire.points.map((fpPt) => {
      const spendable =
        fpPt.spendableNetWorth ??
        fpPt.totalOutside + (fpPt.age >= 55 ? Math.max(0, fpPt.cpfOA) : 0);
      return {
        age: fpPt.age,
        year: fpPt.year,
        phase: fpPt.phase === "phase2" ? "drawdown" : fpPt.phase,
        monthlySpend: fpPt.monthlySpend,
        monthlyCPF: fpPt.monthlyCpfLife,
        monthlyBridge: fpPt.monthlyBridge,
        monthlyGap:
          fpPt.age >= fire.retire
            ? Math.max(
                0,
                fpPt.monthlySpend - fpPt.monthlyCpfLife - fpPt.monthlyBridge,
              )
            : 0,
        portfolioBalance: spendable,
        outsideBalance: fpPt.totalOutside,
      };
    });

    const reqAtRetire = fire.fireNumber.totalRequiredAtRetire;
    const projSpendableAtRetire =
      fire.fireNumber.projectedSpendableAtRetireNominal;
    const scen = {
      ...rawSim.selectedScenario,
      privateTarget: reqAtRetire,
      privateSaving: solvedAutoInvest,
      chosenInvest: activeInvest,
      illustratedPortfolio: projSpendableAtRetire,
      remainingPortfolioGap: Math.max(0, reqAtRetire - projSpendableAtRetire),
      contributionShortfall: Math.max(0, solvedAutoInvest - activeInvest),
      totalFunding:
        (rawSim.selectedScenario.cpfFunding || 0) +
        (rawSim.cashSaving || 0) +
        solvedAutoInvest,
      chosenTotal:
        (rawSim.cpfExtra || 0) + (rawSim.cashSaving || 0) + activeInvest,
    };

    const reconcileScenarioRow = (sc) =>
      sc.key === selectedKey
        ? {
            ...sc,
            privateTarget: reqAtRetire,
            privateSaving: solvedAutoInvest,
            totalFunding:
              (sc.cpfFunding || 0) +
              (rawSim.cashSaving || 0) +
              solvedAutoInvest,
            chosenInvest: activeInvest,
            illustratedPortfolio: projSpendableAtRetire,
            remainingPortfolioGap: scen.remainingPortfolioGap,
            contributionShortfall: scen.contributionShortfall,
          }
        : sc;

    const reconciledSummary = {
      ...summary,
      endAge: fire.endAge,
      target: selectedKey === "salary" ? reqAtRetire : summary.target,
      saving: selectedKey === "salary" ? solvedAutoInvest : summary.saving,
      scenarios: summary.scenarios.map(reconcileScenarioRow),
      ...(summary.brsScenario
        ? { brsScenario: reconcileScenarioRow(summary.brsScenario) }
        : {}),
    };

    const drawMonths = Math.max(
      0,
      Math.round((fire.endAge - summary.retire) * 12),
    );
    const mRate = monthlyRate(summary.investmentReturn);
    const monthlyPortfolioIncome = drawMonths
      ? (projSpendableAtRetire / annuityFactor(mRate, drawMonths)) *
        (1 + mRate) ** drawMonths
      : 0;

    const simulation = {
      ...rawSim,
      summary: reconciledSummary,
      endAge: fire.endAge,
      selectedScenario: scen,
      points: reconciledPoints,
      invest: activeInvest,
      portfolioAtRetire: projSpendableAtRetire,
      monthlyPortfolioIncome,
      outsideAtRetire: fire.fireNumber.projectedOutsideAtRetireNominal,
      depletionAge: fire.fireNumber.depletionAge,
      projectedFireAge: fire.fireNumber.projectedFireAge,
      fullyFunded: fire.fireNumber.fullyFundedTo95,
      bucketAware: true,
    };

    return {
      summary: reconciledSummary,
      simulation,
      fire,
    };
  }

  function computeHousingPayment({
    mode = "all-oa",
    loanBalance = 0,
    loanRate = 2.6,
    loanYears = 20,
    loanParties = 1,
    manualMonthly = null,
  } = {}) {
    if (mode === "paid-up") {
      return {
        mode: "paid-up",
        ratePct: 0,
        years: 0,
        parties: 1,
        totalMonthly: 0,
        monthlyShare: 0,
      };
    }
    if (mode === "custom") {
      const m =
        manualMonthly == null || manualMonthly === ""
          ? 0
          : Math.max(0, Number(manualMonthly) || 0);
      return {
        mode: "custom",
        ratePct: 0,
        years: null,
        parties: 1,
        totalMonthly: m,
        monthlyShare: m,
      };
    }
    if (mode === "hdb" || mode === "bank") {
      const rawLoanRate =
        loanRate == null || loanRate === "" ? 2.6 : Number(loanRate);
      const ratePct =
        mode === "hdb"
          ? 2.6
          : Math.max(0, Number.isFinite(rawLoanRate) ? rawLoanRate : 2.6);
      const principal = Math.max(0, Number(loanBalance || 0));
      const years = Math.max(0, Number(loanYears || 0));
      const parties = Math.max(1, Math.round(Number(loanParties || 1)));
      const n = Math.round(years * 12);
      const i = ratePct / 100 / 12;
      let totalMonthly = 0;
      if (principal > 0 && n > 0) {
        totalMonthly =
          i === 0
            ? principal / n
            : (principal * i * (1 + i) ** n) / ((1 + i) ** n - 1);
      }
      return {
        mode,
        ratePct,
        years,
        parties,
        totalMonthly,
        monthlyShare: totalMonthly / parties,
      };
    }
    return {
      mode: "all-oa",
      ratePct: 0,
      years: null,
      parties: 1,
      totalMonthly: null,
      monthlyShare: null,
    };
  }

  function computeAgeFromDob(dobStr, referenceDate = new Date()) {
    if (typeof dobStr !== "string") {
      return { valid: false, age: null, monthsRemainder: 0, iso: "" };
    }
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dobStr.trim());
    if (!match) {
      return { valid: false, age: null, monthsRemainder: 0, iso: "" };
    }
    const y = Number(match[1]);
    const mo = Number(match[2]);
    const d = Number(match[3]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) {
      return { valid: false, age: null, monthsRemainder: 0, iso: "" };
    }
    const check = new Date(y, mo - 1, d);
    if (
      check.getFullYear() !== y ||
      check.getMonth() !== mo - 1 ||
      check.getDate() !== d
    ) {
      return { valid: false, age: null, monthsRemainder: 0, iso: "" };
    }
    const ref =
      referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
    if (Number.isNaN(ref.getTime())) {
      return { valid: false, age: null, monthsRemainder: 0, iso: "" };
    }
    const refY = ref.getFullYear();
    const refM = ref.getMonth() + 1;
    const refD = ref.getDate();
    if (y > refY || (y === refY && (mo > refM || (mo === refM && d > refD)))) {
      return {
        valid: false,
        age: null,
        monthsRemainder: 0,
        iso: "",
        reason: "future",
      };
    }
    const totalMonths = (refY - y) * 12 + (refM - mo) - (refD < d ? 1 : 0);
    const age = Math.floor(totalMonths / 12);
    const monthsRemainder = totalMonths % 12;
    return {
      valid: true,
      age,
      monthsRemainder,
      isBirthdayToday: refM === mo && refD === d,
      iso: `${match[1]}-${match[2]}-${match[3]}`,
    };
  }

  function defaultDobForAge(targetAge = 35, referenceDate = new Date()) {
    const ref =
      referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
    const refY = Number.isNaN(ref.getTime()) ? C.year : ref.getFullYear();
    const safeAge = Math.max(
      0,
      Math.min(120, Math.round(Number(targetAge) || 35)),
    );
    return `${String(refY - safeAge).padStart(4, "0")}-01-01`;
  }

  function paycheckAllocation(summary, simulation, bogle, params = {}) {
    const retiringNow = Boolean(summary?.retiringNow);
    const gross = Math.max(0, Number(summary?.salary || 0));
    const employerCpf = Math.max(0, Number(summary?.employerCpf || 0));
    const employeeCpf = Math.max(0, Number(summary?.employeeCpf || 0));
    const afterCpf = Math.max(
      0,
      Number(summary?.afterCpf ?? Math.max(0, gross - employeeCpf)),
    );
    const grossPlusEmployer = Math.max(1, gross + employerCpf);
    const mandatoryCpf = Math.round(employeeCpf + employerCpf);

    let cpfExtraMo = 0;
    let cashSavingMo = 0;
    let srsMo = 0;
    let globalEqMo = 0;
    let sgEqMo = 0;
    let ssbMo = 0;
    let liquidPool = 0;
    let overspendMo = 0;
    let livingAndTax = Math.round(afterCpf);

    if (!retiringNow) {
      const investPool = Math.max(
        0,
        Number(bogle?.monthlyRebalance?.investPool ?? simulation?.invest ?? 0),
      );
      const srsMonthlyPlanned = Math.min(
        C.srsCap / 12,
        Math.max(0, Number(params?.srsAnnual || 0)) / 12,
      );
      const srsMonthlyEffective = Math.min(srsMonthlyPlanned, investPool);
      srsMo = Math.round(srsMonthlyEffective);
      liquidPool = Math.max(0, investPool - srsMonthlyEffective);

      if (liquidPool > 0.5) {
        const rawGlobal = Math.max(
          0,
          Number(bogle?.monthlyRebalance?.buyGlobalMonthly || 0),
        );
        const rawSg = Math.max(
          0,
          Number(bogle?.monthlyRebalance?.buySgMonthly || 0),
        );
        const rawBond = Math.max(
          0,
          Number(bogle?.monthlyRebalance?.buyBondMonthly || 0),
        );
        const rawSum = rawGlobal + rawSg + rawBond;
        if (rawSum > 0) {
          ssbMo = Math.round(liquidPool * (rawBond / rawSum));
          const eqTarget = Math.max(0, Math.round(liquidPool) - ssbMo);
          const eqRaw = rawGlobal + rawSg;
          sgEqMo = eqRaw > 0 ? Math.round(eqTarget * (rawSg / eqRaw)) : 0;
          globalEqMo = Math.max(0, eqTarget - sgEqMo);
        } else {
          const eqShare = Math.min(
            1,
            Math.max(0, Number(params?.targetEquityPct ?? 80) / 100),
          );
          const sgShareOfEq = Math.min(
            1,
            Math.max(
              0,
              Number(params?.sgSleevePct ?? C.defaultSgDividendSplitPct) / 100,
            ),
          );
          const eqTarget = Math.round(liquidPool * eqShare);
          ssbMo = Math.max(0, Math.round(liquidPool) - eqTarget);
          sgEqMo = Math.round(eqTarget * sgShareOfEq);
          globalEqMo = Math.max(0, eqTarget - sgEqMo);
        }
      }

      cpfExtraMo = Math.round(Math.max(0, Number(simulation?.cpfExtra || 0)));
      cashSavingMo = Math.round(
        Math.max(0, Number(simulation?.cashSaving || 0)),
      );
      const totalCashSavings = cpfExtraMo + cashSavingMo + investPool;
      livingAndTax = Math.max(0, Math.round(afterCpf - totalCashSavings));
      overspendMo = Math.max(0, Math.round(totalCashSavings - afterCpf));
    }

    const eqMo = globalEqMo + sgEqMo;
    const extraTaxMo = cpfExtraMo + srsMo;
    const rows = [
      { label: "Living & IRAS Tax", amt: livingAndTax, color: "#64748B" },
      { label: "Mandatory CPF", amt: mandatoryCpf, color: "#059669" },
      {
        label: "Cash Savings (HYSA / SSB)",
        amt: cashSavingMo,
        color: "#0891B2",
      },
      {
        label: "Equities (Global + SG)",
        amt: eqMo,
        globalAmt: globalEqMo,
        sgAmt: sgEqMo,
        color: "#2563EB",
      },
      { label: "SSB / T-Bills (Alloc.)", amt: ssbMo, color: "#D97706" },
      { label: "Extra CPF Saving", amt: cpfExtraMo, color: "#10B981" },
      { label: "SRS Contribution", amt: srsMo, color: "#7C3AED" },
    ];

    return {
      grossPlusEmployer,
      afterCpf,
      mandatoryCpf,
      cpfExtraMo,
      cashSavingMo,
      srsMo,
      globalEqMo,
      sgEqMo,
      eqMo,
      ssbMo,
      liquidPool: Math.round(liquidPool),
      extraTaxMo,
      livingAndTax,
      overspendMo,
      rows,
    };
  }

  function buildPrintReportModel({
    summary,
    selectedScenario,
    simulation,
    fire,
    bogle,
    tax,
    guide,
    params = {},
    basis = "today",
    masRates = null,
  }) {
    const r = summary;
    const s = selectedScenario;
    const fn = fire?.fireNumber || {};
    const retireAge = fire?.retire ?? r.retire;
    const endAge = fire?.endAge ?? C.fireEndAge;

    const rawPctFunded = Number.isFinite(fn.pctFunded)
      ? Math.max(0, fn.pctFunded)
      : 100;
    const pctFunded = Math.min(150, rawPctFunded);
    const fullyFundedTo95 = fn.fullyFundedTo95 ?? true;
    const onTrack = pctFunded >= 100 && fullyFundedTo95;
    const nearTrack = pctFunded >= 80 && !onTrack;
    const statusTone = onTrack ? "good" : nearTrack ? "warn" : "danger";
    const statusText = onTrack
      ? "On Track"
      : nearTrack
        ? "Within Reach"
        : "Shortfall";

    const projFireAge = fn.projectedFireAge ?? null;
    const earliestSafeAgeText =
      projFireAge == null ? "After 80" : "Age " + projFireAge;
    const depletionAgeDisplay =
      fn.depletionAge != null ? Math.floor(fn.depletionAge) : endAge;
    const runwayPill = fullyFundedTo95
      ? "Lasts " + endAge + "+"
      : "Lasts to " + depletionAgeDisplay;
    const diffYears = projFireAge == null ? null : retireAge - projFireAge;
    const verdictSub =
      diffYears == null
        ? runwayPill
        : diffYears > 0
          ? diffYears + " yr" + (diffYears > 1 ? "s" : "") + " early"
          : diffYears === 0
            ? "Meets goal"
            : -diffYears + " yr" + (-diffYears > 1 ? "s" : "") + " after goal";

    const ptAtRetire =
      fire?.atRetire ||
      fire?.points?.find((pt) => pt.age === retireAge) ||
      fire?.points?.[fire.points.length - 1];
    const outsideNeed =
      basis === "nominal"
        ? (fn.totalRequiredAtRetire ?? s.privateTarget)
        : (fn.totalRequiredToday ?? s.privateTarget);
    const cpfAtRetire =
      basis === "nominal"
        ? (ptAtRetire?.cpfTotal ??
          fire?.phase2?.projectedCpfAt65Nominal ??
          s.balance)
        : (ptAtRetire?.today?.cpfTotal ??
          fire?.phase2?.projectedCpfAt65Today ??
          s.balance);
    const outsideAtRetire =
      basis === "nominal"
        ? (ptAtRetire?.totalOutside ?? 0)
        : (ptAtRetire?.today?.totalOutside ?? outsideNeed);
    const projectedAtRetire =
      basis === "nominal"
        ? (ptAtRetire?.totalNetWorth ?? 0)
        : (ptAtRetire?.today?.totalNetWorth ?? outsideNeed + cpfAtRetire);

    const taps = retirementTapsPlan({
      summary: r,
      selectedScenario: s,
      simulation,
      fire,
      bogle,
      tax,
      params,
      masRates,
    });

    const cpfFloor65 =
      basis === "nominal"
        ? (fire?.phase2?.cpfLife65Nominal ?? s.payout)
        : (fire?.phase2?.cpfLife65Today ?? s.payout);
    const spend65ForBasis =
      basis === "nominal"
        ? r.moneyBasis === "today"
          ? r.spend65 * (1 + r.inflation) ** Math.max(0, 65 - r.age)
          : r.spend65
        : r.moneyBasis === "today"
          ? r.spend65
          : todayValue(r.spend65, 65, r.age, r.inflation);
    const cpfCovPct = Math.min(
      100,
      Math.round((cpfFloor65 / Math.max(1, spend65ForBasis)) * 100),
    );
    const builtTodayPct = Math.min(100, Math.max(0, fn.currentFirePct ?? 0));

    const hasCustomSaving =
      !r.retiringNow &&
      (params?.invest != null ||
        params?.cpfExtra != null ||
        (params?.cashSaving != null && Number(params.cashSaving) > 0));
    const monthlySave = r.retiringNow
      ? Math.round(s.privateSaving || 0)
      : Math.round(
          (simulation?.cpfExtra || 0) +
            (simulation?.cashSaving || 0) +
            (simulation?.invest || 0),
        );
    const pctOfPay = r.retiringNow
      ? null
      : r.afterCpf > 0
        ? Math.round((monthlySave / r.afterCpf) * 100)
        : 0;

    const paycheck = paycheckAllocation(r, simulation, bogle, params);

    const waterfallEndAge = endAge;
    const waterfallStartAge = r.retiringNow
      ? r.age
      : Math.max(r.age, Math.min(retireAge - 3, endAge - 15));
    const hasSrs = Boolean(
      fire?.points?.some((pt) => (pt.srs || 0) > 0.5) ||
      Number(params?.srs || 0) > 0 ||
      Number(params?.srsAnnual || 0) > 0,
    );

    const hol = bogle?.holistic || {};
    const targetEqPct = Math.round(hol.targetEquityPct ?? 80);
    const targetBondPct = Math.round(hol.targetBondPct ?? 20);
    const effEqPct = Math.round(hol.effectiveEquityPct ?? 0);
    const effBondPct = Math.round(hol.effectiveBondPct ?? 0);
    const eqDeltaPct = effEqPct - targetEqPct;
    const mixDeltaText =
      Math.abs(eqDeltaPct) <= 3
        ? effEqPct + "% Eq · On target"
        : effEqPct +
          "% vs " +
          targetEqPct +
          "% (" +
          (eqDeltaPct > 0 ? "+" : "") +
          eqDeltaPct +
          "% Eq)";

    const marginalPct = tax?.taxBefore
      ? (tax.taxBefore.marginalRate * 100).toFixed(1).replace(/\.0$/, "") + "%"
      : "0%";
    let taxActionValue = "Keep cash liquid";
    if (tax?.tier === "cap-reached")
      taxActionValue = "$80k cap used · Stay liquid";
    else if (tax?.tier === "liquid")
      taxActionValue = "Low bracket · Stay liquid";
    else if (tax?.tier === "rstu-first")
      taxActionValue =
        tax.rstuTaxSaved > 0
          ? "RSTU saves " + fmtSgd(tax.rstuTaxSaved) + "/yr"
          : "SA at FRS ($0 relief)";
    else if (tax?.tier === "max-both")
      taxActionValue = "RSTU+SRS saves " + fmtSgd(tax.combinedTaxSaved) + "/yr";

    let monthlySplitValue = "$0/mo";
    if (r.retiringNow) {
      monthlySplitValue = "Paused (retiring now)";
    } else if (
      paycheck.liquidPool > 0 ||
      paycheck.cashSavingMo > 0 ||
      paycheck.srsMo > 0
    ) {
      const parts = [];
      if (paycheck.globalEqMo > 0)
        parts.push(fmtSgd(paycheck.globalEqMo) + " Global");
      if (paycheck.sgEqMo > 0) parts.push(fmtSgd(paycheck.sgEqMo) + " SG");
      if (paycheck.ssbMo > 0) parts.push(fmtSgd(paycheck.ssbMo) + " SSB");
      if (paycheck.cashSavingMo > 0)
        parts.push(fmtSgd(paycheck.cashSavingMo) + " Cash");
      if (paycheck.srsMo > 0) parts.push(fmtSgd(paycheck.srsMo) + " SRS");
      monthlySplitValue = parts.join(" · ") || fmtSgd(0) + "/mo";
    }

    const presetBaseline = lifestyles[r.lifestyle]?.budget || 2800;
    const isCustomBudget = Boolean(
      params?.isCustomBudget ||
      Math.round(Number(r.todaySpend || 0) * 100) !==
        Math.round(presetBaseline * 100),
    );
    const budgetChipLabel = isCustomBudget
      ? (params?.itemizedActive ? "Custom itemized" : "Custom") +
        " (" +
        fmtSgd(r.todaySpend) +
        "/mo)"
      : r.lifestyleLabel + " (" + fmtSgd(r.todaySpend) + "/mo)";
    const isLoanMode =
      params?.housingMode === "hdb" || params?.housingMode === "bank";
    const loanTypeTag = params?.housingMode === "bank" ? "Bank" : "HDB";
    const housingBaseChip =
      params?.housingMode === "paid-up" ||
      (params?.housing === 0 && !isLoanMode)
        ? "Housing: Paid-up ($0 OA)"
        : Number(params?.housing || 0) > 0
          ? "Housing OA " +
            fmtSgd(params.housing) +
            "/mo" +
            (isLoanMode
              ? " (" +
                loanTypeTag +
                (Number(params?.housingYears) > 0
                  ? ", " + Math.round(Number(params.housingYears)) + "y"
                  : "") +
                ")"
              : "")
          : isLoanMode
            ? "Housing: $0 OA (" + loanTypeTag + ")"
            : "Housing: All new OA";
    const housingChipLabel =
      (r.housingShortfall || 0) > 0.5
        ? housingBaseChip + " · Shortfall " + fmtSgd(r.housingShortfall)
        : housingBaseChip;

    const bucketsToday = resolvePortfolioBuckets(params);
    const startingOa = Math.max(0, Number(params?.oa || 0));
    const startingSa = Math.max(0, Number(params?.sa || 0));
    const startingMa = Math.max(0, Number(params?.ma || 0));
    const startingSaInvested = Math.max(0, Number(params?.saInvested || 0));
    const startingCpfToday = startingOa + startingSa + startingMa;
    const startingLiquidOutside = bucketsToday.liquidOnly;
    const startingSrs = bucketsToday.srs;
    const startingOutsideTotal = bucketsToday.total;
    const startingTotalAssets = startingCpfToday + startingOutsideTotal;
    const srsIdleActive =
      (startingSrs > 0 || Number(params?.srsAnnual || 0) > 0) &&
      params?.srsInvestedIn === "cash";
    const startingAssets = {
      oa: startingOa,
      sa: startingSa,
      ma: startingMa,
      saInvested: startingSaInvested,
      cpfTotal: startingCpfToday,
      equities: bucketsToday.equities,
      sgDividends: bucketsToday.sgDividends,
      ssbCash: bucketsToday.ssbCash,
      liquidOutside: startingLiquidOutside,
      srs: startingSrs,
      outsideTotal: startingOutsideTotal,
      totalAssets: startingTotalAssets,
      srsIdleActive,
    };

    const fmtK = (n) =>
      "$" + (n % 1000 === 0 ? String(n / 1000) : (n / 1000).toFixed(1)) + "k";
    const colophonRulesText =
      "Based on " +
      C.year +
      " CPF & IRAS rules (BRS " +
      fmtK(C.brs) +
      ", FRS " +
      fmtK(C.frs) +
      ", ERS " +
      fmtK(C.ers) +
      ", BHS " +
      fmtK(C.bhs) +
      ", OW cap " +
      fmtK(C.wageCap) +
      ", RSTU cap " +
      fmtK(C.rstuReliefCap) +
      ", SRS cap " +
      fmtK(C.srsCap) +
      ", relief cap " +
      fmtK(C.personalReliefCap) +
      "). Age-55 cohort sums grow " +
      Number((C.sumGrowth * 100).toFixed(1)) +
      "%/yr.";

    const actionRows = [
      {
        label: "1 · HYSA & SSB Buffer",
        tag: "6–12m + $" + Math.round(C.ssbTargetBuffer / 1000) + "k SSB",
        value:
          fmtSgd(guide?.emergencyMin ?? r.todaySpend * 6) +
          "–" +
          fmtSgd(guide?.emergencyMax ?? r.todaySpend * 12) +
          " · SSB " +
          fmtSgd(taps.tap4Ssb.currentSsbCash) +
          "/$" +
          Math.round(C.ssbTargetBuffer / 1000) +
          "k",
      },
      {
        label: "2 · Holistic Mix (" + targetEqPct + "/" + targetBondPct + ")",
        tag:
          effEqPct +
          "% Eq (" +
          (hol.globalEquitySplitPct ?? C.defaultGlobalEquitySplitPct) +
          "/" +
          (hol.sgEquitySplitPct ?? C.defaultSgDividendSplitPct) +
          " G/SG) · " +
          effBondPct +
          "% Bond",
        value: mixDeltaText,
      },
      {
        label: "3 · Monthly Split",
        tag: r.retiringNow ? "Future saving" : "Invest / mo",
        value: monthlySplitValue,
      },
      {
        label: "4 · Tax Relief (" + marginalPct + ")",
        tag:
          tax?.srsTrapStatus === "balloon-trap"
            ? "SRS >$" + Math.round(C.srsTrapFloorAt63 / 1000) + "k Trap!"
            : tax?.srsTrapStatus === "near-cap"
              ? "SRS ~$" +
                Math.round((tax?.srsZeroTaxCap || C.srsSoftCapAt63) / 1000) +
                "k cap"
              : "IRAS · $" + Math.round(C.personalReliefCap / 1000) + "k cap",
        value:
          taxActionValue +
          (tax?.srsTrapStatus === "balloon-trap"
            ? " · Cap SRS ≤$" +
              Math.round((tax?.srsZeroTaxCap || C.srsSoftCapAt63) / 1000) +
              "k"
            : ""),
      },
      {
        label: "5 · Age-" + retireAge + " Target",
        tag:
          taps.tap1Cpf.oaAt55Today > 0
            ? (basis === "nominal" ? "Nominal $ · +" : "Today’s $ · +") +
              fmtSgd(
                basis === "nominal"
                  ? taps.tap1Cpf.oaInterestMonthlyNominal
                  : taps.tap1Cpf.oaInterestMonthlyToday,
              ) +
              "/mo 55 OA"
            : basis === "nominal"
              ? "Nominal $ · 4-Tap Floor"
              : "Today’s $ · 4-Tap Floor",
        value: fmtSgd(outsideNeed) + " out + " + fmtSgd(cpfAtRetire) + " CPF",
      },
    ];

    return {
      pctFunded,
      rawPctFunded,
      fullyFundedTo95,
      onTrack,
      nearTrack,
      statusTone,
      statusText,
      earliestSafeAgeText,
      depletionAgeDisplay,
      runwayPill,
      verdictSub,
      retireAge,
      endAge,
      outsideNeed,
      outsideAtRetire,
      cpfAtRetire,
      projectedAtRetire,
      taps,
      isCustomBudget,
      budgetChipLabel,
      housingChipLabel,
      colophonRulesText,
      cpfFloor65,
      cpfCovPct,
      builtTodayPct,
      hasCustomSaving,
      monthlySave,
      pctOfPay,
      savingKpiLabel: r.retiringNow
        ? "Outside Need Now"
        : hasCustomSaving
          ? "Planned Monthly Save"
          : "Monthly Saving Target",
      savingKpiPill: r.retiringNow
        ? s.remainingPortfolioGap > 0.5
          ? "Gap " + fmtSgd(s.remainingPortfolioGap)
          : "Covered today"
        : pctOfPay + "% take-home",
      paycheck,
      waterfallStartAge,
      waterfallEndAge,
      hasSrs,
      startingAssets,
      actionRows,
      customSavingNote: hasCustomSaving
        ? "Custom input active: " +
          fmtSgd(simulation?.cpfExtra || 0) +
          " extra CPF + " +
          fmtSgd(simulation?.cashSaving || 0) +
          " cash savings + " +
          fmtSgd(simulation?.invest || 0) +
          " outside/mo."
        : null,
    };
  }

  const MONTHS_SHORT_LIST = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  function formatSgShortDate(iso) {
    if (typeof iso !== "string") return "";
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return iso;
    const mon = MONTHS_SHORT_LIST[Number(m[2]) - 1] || m[2];
    return Number(m[3]) + " " + mon;
  }

  function formatSgFullDate(iso) {
    if (typeof iso !== "string") return "";
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return iso;
    const mon = MONTHS_SHORT_LIST[Number(m[2]) - 1] || m[2];
    return Number(m[3]) + " " + mon + " " + m[1];
  }

  function fmtPctRate(val) {
    const n = Number(val);
    if (!Number.isFinite(n)) return "—";
    return (Math.round(n * 100) / 100).toFixed(2) + "%";
  }

  const DEFAULT_MAS_LIVE_RATES = {
    source: "Monetary Authority of Singapore (eservices.mas.gov.sg)",
    fetchedAt: "2026-11-16T04:58:09.602Z",
    asOfDate: "2026-11-16",
    ssb: {
      issueCode: "GX26120A",
      trancheCode: "SBDEC26",
      annDate: "2026-11-02",
      lastDayToApply: "2026-11-25",
      issueDate: "2026-12-01",
      maturityDate: "2036-12-01",
      issueSizeM: 500,
      year1Coupon: 1.83,
      year1Return: 1.83,
      year5Return: 2.16,
      year10Coupon: 2.83,
      year10Return: 2.39,
      prevTrancheCode: "SBNOV26",
      prevYear10Return: 2.45,
      history: {
        yr1: {
          count: 12,
          min: 1.99,
          max: 2.45,
          avg: 2.18,
          percentile: 92,
        },
        yr5: {
          count: 60,
          min: 1.64,
          max: 3.47,
          avg: 2.63,
          percentile: 35,
        },
        allTime: {
          count: 135,
          min: 0.8,
          max: 3.47,
          avg: 2.23,
          percentile: 60,
          sinceYear: 2015,
        },
        deltaPrev: -0.06,
        recent6: [
          {
            code: "SBJUL26",
            label: "Jul '26",
            rate: 2.11,
          },
          {
            code: "SBAUG26",
            label: "Aug '26",
            rate: 2.06,
          },
          {
            code: "SBSEP26",
            label: "Sep '26",
            rate: 2.25,
          },
          {
            code: "SBOCT26",
            label: "Oct '26",
            rate: 2.32,
          },
          {
            code: "SBNOV26",
            label: "Nov '26",
            rate: 2.45,
          },
          {
            code: "SBDEC26",
            label: "Dec '26",
            rate: 2.39,
          },
        ],
      },
    },
    tbills: {
      sixMonth: {
        issueCode: "BS26122V",
        auctionDate: "2026-11-04",
        issueDate: "2026-11-10",
        maturityDate: "2027-05-11",
        cutoffYield: 1.86,
        medianYield: 1.8,
        avgYield: 1.63,
        bidToCover: 2.45,
        nextIssueCode: "BS26123A",
        nextAuctionDate: "2026-11-19",
        nextIssueSizeM: 8600,
        history: {
          yr1: {
            count: 26,
            min: 1.36,
            max: 1.95,
            avg: 1.54,
            percentile: 88,
          },
          multiYear: {
            count: 172,
            min: 0.2,
            max: 4.4,
            avg: 2.07,
            percentile: 52,
            sinceYear: 2020,
          },
          deltaPrev: -0.09,
          recent6: [
            {
              code: "BS26117A",
              label: "27 Aug",
              rate: 1.6,
            },
            {
              code: "BS26118E",
              label: "10 Sep",
              rate: 1.7,
            },
            {
              code: "BS26119F",
              label: "24 Sep",
              rate: 1.92,
            },
            {
              code: "BS26120W",
              label: "8 Oct",
              rate: 1.9,
            },
            {
              code: "BS26121N",
              label: "22 Oct",
              rate: 1.95,
            },
            {
              code: "BS26122V",
              label: "4 Nov",
              rate: 1.86,
            },
          ],
        },
      },
      oneYear: {
        issueCode: "BY26103X",
        auctionDate: "2026-10-15",
        issueDate: "2026-10-20",
        maturityDate: "2027-10-19",
        cutoffYield: 1.92,
        medianYield: 1.87,
        avgYield: 1.72,
        bidToCover: 2.15,
        nextIssueCode: null,
        nextAuctionDate: null,
        history: {
          yr1: {
            count: 4,
            min: 1.44,
            max: 1.92,
            avg: 1.63,
            percentile: 100,
          },
          deltaPrev: 0.24,
        },
      },
    },
  };

  function normalizeMasRates(input) {
    if (
      !input ||
      !input.ssb ||
      !input.tbills?.sixMonth ||
      !input.tbills?.oneYear
    ) {
      return { data: DEFAULT_MAS_LIVE_RATES, isLive: false };
    }
    return {
      data: {
        source: input.source || DEFAULT_MAS_LIVE_RATES.source,
        asOfDate: input.asOfDate || DEFAULT_MAS_LIVE_RATES.asOfDate,
        fetchedAt: input.fetchedAt || null,
        ssb: {
          ...DEFAULT_MAS_LIVE_RATES.ssb,
          ...input.ssb,
          history: input.ssb.history || DEFAULT_MAS_LIVE_RATES.ssb.history,
        },
        tbills: {
          sixMonth: {
            ...DEFAULT_MAS_LIVE_RATES.tbills.sixMonth,
            ...input.tbills.sixMonth,
            history:
              input.tbills.sixMonth.history ||
              DEFAULT_MAS_LIVE_RATES.tbills.sixMonth.history,
          },
          oneYear: {
            ...DEFAULT_MAS_LIVE_RATES.tbills.oneYear,
            ...input.tbills.oneYear,
            history:
              input.tbills.oneYear.history ||
              DEFAULT_MAS_LIVE_RATES.tbills.oneYear.history,
          },
        },
      },
      isLive: true,
    };
  }

  function buildRateContext(kind, currentRate, history, meta = {}) {
    if (!history?.yr1 || !Number.isFinite(Number(currentRate))) return null;
    const cur = Number(currentRate);
    const yr1 = history.yr1;
    const longStats = history.allTime || history.multiYear || history.yr5;
    const span = Math.max(0.01, (yr1.max || cur) - (yr1.min || cur));
    const posPct = Math.max(
      4,
      Math.min(96, Math.round(((cur - yr1.min) / span) * 100)),
    );
    const formatOrd = (num) => {
      const n = Math.round(Number(num) || 0);
      const mod100 = n % 100;
      if (mod100 >= 11 && mod100 <= 13) return n + "th";
      const mod10 = n % 10;
      return (
        n +
        (mod10 === 1 ? "st" : mod10 === 2 ? "nd" : mod10 === 3 ? "rd" : "th")
      );
    };
    const pct12m = Math.max(0, Math.min(100, Math.round(yr1.percentile || 0)));
    const pct12mOrd = formatOrd(pct12m);
    const delta = Number(history.deltaPrev || 0);
    const deltaText =
      (delta > 0 ? "+" : "") + (Math.round(delta * 100) / 100).toFixed(2) + "%";

    if (kind === "ssb") {
      let tone = "info";
      let verdict = "Mid 12M range (" + pct12mOrd + " pct) · Swap anytime";
      let action =
        "Zero early-exit penalty ($2 CDP fee): apply now if holding excess cash, then redeem & swap if a future tranche jumps.";
      if (pct12m >= 75) {
        tone = "good";
        verdict = "Strong vs 12M (" + pct12mOrd + " pct) · Apply now";
        action =
          "At " +
          fmtPctRate(cur) +
          " 10Y avg vs " +
          fmtPctRate(yr1.avg) +
          " 12M avg (and above " +
          fmtPctRate(longStats?.avg || cur) +
          " since " +
          (longStats?.sinceYear || 2015) +
          "). No lock-in penalty: apply now and swap if rates climb later.";
      } else if (pct12m < 40) {
        tone = "warn";
        verdict = "Low vs 12M (" + pct12mOrd + " pct) · Compare HYSA";
        action =
          "Trailing 12M average (" +
          fmtPctRate(yr1.avg) +
          "). Consider splitting tranches or keeping instant cash in a higher-yielding HYSA while waiting.";
      }
      return {
        tone,
        verdict,
        action,
        yr1: { ...yr1, posPct },
        longTerm: longStats
          ? {
              ...longStats,
              pctText: formatOrd(longStats.percentile) + " pct",
              label:
                "Since " +
                (longStats.sinceYear || 2015) +
                " (" +
                longStats.count +
                " tranches)",
            }
          : null,
        deltaPrev: delta,
        deltaText,
        prevLabel: meta.prevLabel || "",
        recent6: Array.isArray(history.recent6) ? history.recent6 : [],
      };
    }

    let tone = "info";
    let verdict = "Mid 12M range (" + pct12mOrd + " pct) · Ladder";
    let action =
      "Capital locks 6m to maturity — stagger across 2–4 fortnightly auctions or place a competitive floor bid.";
    if (pct12m >= 75) {
      tone = "info";
      verdict = "Near 12M high (" + pct12mOrd + " pct) · Ladder / floor bid";
      action =
        "At " +
        fmtPctRate(cur) +
        " vs " +
        fmtPctRate(yr1.avg) +
        " 12M avg (near " +
        fmtPctRate(yr1.max) +
        " 1Y high). Locked 6m to maturity: compare vs SSB Yr 1 (" +
        fmtPctRate(meta.ssbYr1) +
        ") & bid competitively if you want a min yield.";
    } else if (pct12m < 40) {
      tone = "warn";
      verdict = "Below 12M avg (" + pct12mOrd + " pct) · Wait or HYSA";
      action =
        "Locked 6m below 12M avg (" +
        fmtPctRate(yr1.avg) +
        "). Check HYSA/MMF liquidity or set a competitive min bid before committing.";
    }
    return {
      tone,
      verdict,
      action,
      yr1: { ...yr1, posPct },
      longTerm: longStats
        ? {
            ...longStats,
            pctText: formatOrd(longStats.percentile) + " pct",
            label:
              "Since " +
              (longStats.sinceYear || 2020) +
              " (" +
              longStats.count +
              " auctions)",
          }
        : null,
      deltaPrev: delta,
      deltaText,
      prevLabel: meta.prevLabel || "",
      recent6: Array.isArray(history.recent6) ? history.recent6 : [],
    };
  }

  function buildSsbItem(masRates, isLive) {
    const ssb = masRates.ssb;
    const syncText =
      (isLive ? "Live · " : "Ref · ") + formatSgShortDate(masRates.asOfDate);
    const rateTiers = [
      { label: "Year 1 Coupon", value: fmtPctRate(ssb.year1Return) },
      {
        label: "Year 5 Avg",
        value: fmtPctRate(ssb.year5Return || ssb.year1Return),
      },
      {
        label: "10-Year Avg",
        value: fmtPctRate(ssb.year10Return),
        tone: "accent",
      },
      { label: "Year 10 Step-Up", value: fmtPctRate(ssb.year10Coupon) },
    ];
    const rateContext = buildRateContext("ssb", ssb.year10Return, ssb.history, {
      prevLabel:
        ssb.prevTrancheCode && ssb.prevYear10Return != null
          ? "vs " +
            ssb.prevTrancheCode +
            " (" +
            fmtPctRate(ssb.prevYear10Return) +
            ")"
          : "",
    });
    return {
      id: "ssb",
      category: "gov",
      categoryLabel: "Gov-Backed",
      name: "Singapore Savings Bonds (SSB)",
      provider: "Monetary Authority of Singapore",
      protection: "100% SG Gov",
      protectionTone: "gov",
      metaBadge:
        "Open: " +
        ssb.trancheCode +
        " · Closes " +
        formatSgShortDate(ssb.lastDayToApply),
      syncBadge: syncText,
      rateHeadline:
        fmtPctRate(ssb.year1Return) +
        " Yr 1 · " +
        fmtPctRate(ssb.year10Return) +
        " 10Y avg",
      rateTiers,
      rateContext,
      rateDetail: "Min $500 · Issued " + formatSgFullDate(ssb.issueDate),
      capLabel: "$200,000 total cap",
      capAmount: C.ssbCap,
      liquidity: "Monthly exit, no penalty",
      requirements:
        "CDP account (cash) or SRS; max $200k holding across all SSB issues",
      url: "https://www.mas.gov.sg/bonds-and-bills/singapore-savings-bonds",
      urlDomain: "mas.gov.sg",
    };
  }

  function buildTbillsItem(masRates, isLive) {
    const s6 = masRates.tbills.sixMonth;
    const y1 = masRates.tbills.oneYear;
    const syncText =
      (isLive ? "Live · " : "Ref · ") + formatSgShortDate(masRates.asOfDate);
    const rateTiers = [
      {
        label: "6M Cut-Off (" + s6.issueCode + ")",
        value: fmtPctRate(s6.cutoffYield),
        tone: "accent",
      },
      { label: "6M Median Yield", value: fmtPctRate(s6.medianYield) },
      {
        label: "1Y Cut-Off (" + y1.issueCode + ")",
        value: fmtPctRate(y1.cutoffYield),
      },
    ];
    if (s6.nextIssueCode && s6.nextAuctionDate) {
      rateTiers.push({
        label: "Next 6M (" + s6.nextIssueCode + ")",
        value: formatSgShortDate(s6.nextAuctionDate),
      });
    }
    const prevRecent =
      Array.isArray(s6.history?.recent6) && s6.history.recent6.length >= 2
        ? s6.history.recent6[s6.history.recent6.length - 2]
        : null;
    const rateContext = buildRateContext("tbills", s6.cutoffYield, s6.history, {
      ssbYr1: masRates.ssb?.year1Return,
      prevLabel: prevRecent
        ? "vs " + prevRecent.code + " (" + fmtPctRate(prevRecent.rate) + ")"
        : "",
    });
    return {
      id: "tbills",
      category: "gov",
      categoryLabel: "Gov-Backed",
      name: "MAS 6-Month / 1-Year T-Bills",
      provider: "Monetary Authority of Singapore",
      protection: "100% SG Gov",
      protectionTone: "gov",
      metaBadge:
        "Last 6M: " + s6.issueCode + " · " + formatSgShortDate(s6.auctionDate),
      syncBadge: syncText,
      rateHeadline: fmtPctRate(s6.cutoffYield) + " 6M cut-off",
      rateTiers,
      rateContext,
      rateDetail:
        "Min $1,000 · " +
        (s6.bidToCover
          ? s6.bidToCover.toFixed(2) + "× bid-to-cover"
          : "Auction allotment"),
      capLabel: "No ind. holding cap",
      capAmount: null,
      liquidity: "Locked to maturity (6m/1y)",
      requirements: "Eligible for Cash, SRS & CPFIS-OA; issued at discount",
      url: "https://www.mas.gov.sg/bonds-and-bills/singapore-government-t-bills-information-for-individuals",
      urlDomain: "mas.gov.sg",
    };
  }

  const STATIC_CASH_PARKING_ITEMS = [
    {
      id: "ocbc-360",
      category: "hysa",
      categoryLabel: "HYSA",
      name: "OCBC 360 Account",
      provider: "OCBC Bank",
      protection: "SDIC $100k",
      protectionTone: "sdic",
      metaBadge: "Salary + Save + Spend tiers",
      rateHeadline: "1.95% EIR ($100k)",
      rateTiers: [
        { label: "Salary + Save + Spend", value: "1.95%", tone: "accent" },
        { label: "Base (No Hoops)", value: "0.05%" },
        { label: "With Insure / Invest", value: "up to 4.45%+" },
      ],
      rateDetail: "Realistic Salary+Save+Spend EIR; bonus applies up to $100k",
      capLabel: "$100,000 bonus cap",
      capAmount: 100000,
      liquidity: "Instant access",
      requirements: "0.05% base without hoops; SDIC covers up to $100k/bank",
      url: "https://www.ocbc.com/personal-banking/deposits/360-savings-account",
      urlDomain: "ocbc.com",
    },
    {
      id: "uob-one",
      category: "hysa",
      categoryLabel: "HYSA",
      name: "UOB One Account",
      provider: "UOB",
      protection: "SDIC $100k",
      protectionTone: "sdic",
      metaBadge: "Salary + $500 card spend",
      rateHeadline: "1.90% EIR at $150k",
      rateTiers: [
        { label: "First $50k Tier", value: "1.00%" },
        { label: "$100k Balance EIR", value: "1.38%" },
        { label: "$150k Balance EIR", value: "1.90%", tone: "accent" },
      ],
      rateDetail:
        "Requires GIRO salary/3 GIRO debits + min $500/mo eligible card spend",
      capLabel: "$150,000 bonus cap",
      capAmount: 150000,
      liquidity: "Instant access",
      requirements: "Top $50k ($100k–$150k tier) sits above $100k SDIC limit",
      url: "https://www.uob.com.sg/personal/save/everyday-accounts/one-account.page",
      urlDomain: "uob.com.sg",
    },
    {
      id: "dbs-multiplier",
      category: "hysa",
      categoryLabel: "HYSA",
      name: "DBS Multiplier Account",
      provider: "DBS / POSB",
      protection: "SDIC $100k shared",
      protectionTone: "sdic",
      metaBadge: "Income + category tiers",
      rateHeadline: "1.80%–2.20% realistic",
      rateTiers: [
        { label: "Income + 1 Cat ($50k)", value: "1.80%", tone: "accent" },
        { label: "Income + 2 Cats ($100k)", value: "2.20%" },
        { label: "Max Bracket", value: "up to 4.10%" },
      ],
      rateDetail:
        "No minimum card spend amount; dividends or PayLah count toward income",
      capLabel: "$50k–$100k cap",
      capAmount: 100000,
      liquidity: "Instant access",
      requirements: "DBS & POSB deposits share one combined $100k SDIC limit",
      url: "https://www.dbs.com.sg/personal/deposits/bank-earn/multiplier",
      urlDomain: "dbs.com.sg",
    },
    {
      id: "gxs",
      category: "digital",
      categoryLabel: "Digital Bank",
      name: "GXS Savings Account",
      provider: "GXS Bank",
      protection: "SDIC $100k",
      protectionTone: "sdic",
      metaBadge: "Daily interest · No hoops",
      rateHeadline: "0.88%–1.08% p.a.",
      rateTiers: [
        { label: "Saving Pockets", value: "1.08%", tone: "accent" },
        { label: "Main Account", value: "0.88%" },
        { label: "Boost Pockets (18m)", value: "up to 2.00%" },
      ],
      rateDetail: "Zero salary credit or card spend required; daily payout",
      capLabel: "$95,000 total cap",
      capAmount: 95000,
      liquidity: "Instant (Main/Pockets)",
      requirements: "Boost Pockets lock principal for promo tenure",
      url: "https://www.gxs.com.sg/savings-account",
      urlDomain: "gxs.com.sg",
    },
    {
      id: "maribank",
      category: "digital",
      categoryLabel: "Digital Bank",
      name: "Mari Savings Account",
      provider: "MariBank",
      protection: "SDIC $100k",
      protectionTone: "sdic",
      metaBadge: "Daily credit · Zero min balance",
      rateHeadline: "0.88% base · 1.48% bonus",
      rateTiers: [
        { label: "Base (No Hoops)", value: "0.88%" },
        { label: "Salary + ShopeeVIP Bonus", value: "1.48%", tone: "accent" },
      ],
      rateDetail:
        "0.88% flat with zero hoops; bonus rate applies to first $100k",
      capLabel: "$100,000 cap",
      capAmount: 100000,
      liquidity: "Instant access",
      requirements: "No minimum balance or lock-in; daily interest credit",
      url: "https://www.maribank.sg/product/mari-savings-account",
      urlDomain: "maribank.sg",
    },
    {
      id: "trust-bank",
      category: "digital",
      categoryLabel: "Digital Bank",
      name: "Trust Savings Account",
      provider: "Trust Bank",
      protection: "SDIC $100k",
      protectionTone: "sdic",
      metaBadge: "Multi-tier ($1.2M bank cap)",
      rateHeadline: "0.40% base · up to 2.40%",
      rateTiers: [
        { label: "Base (No Cond.)", value: "0.40%" },
        {
          label: "Flex / Signature Tiers",
          value: "1.00%–2.40%",
          tone: "accent",
        },
      ],
      rateDetail:
        "NTUC Union / FairPrice spend & salary tiers unlock higher bonus",
      capLabel: "$1.2M bank ($100k SDIC)",
      capAmount: 100000,
      liquidity: "Instant access",
      requirements:
        "Only first $100k is SDIC-insured; check active promo terms",
      url: "https://trustbank.sg/savings-account/",
      urlDomain: "trustbank.sg",
    },
    {
      id: "fd-cimb",
      category: "fd-mmf",
      categoryLabel: "Fixed Deposit",
      name: "CIMB SGD Fixed Deposit",
      provider: "CIMB Singapore",
      protection: "SDIC $100k",
      protectionTone: "sdic",
      metaBadge: "Online promo ($10k min)",
      rateHeadline: "2.20%–2.35% p.a.",
      rateTiers: [
        { label: "6-Month Online Promo", value: "2.20%" },
        { label: "12-Month Online Promo", value: "2.30%", tone: "accent" },
        { label: "Preferred Banking (12m)", value: "2.35%" },
      ],
      rateDetail:
        "Guaranteed fixed rate on $10k+ online placement; board rate 0.10%",
      capLabel: "$100k SDIC / bank",
      capAmount: 100000,
      liquidity: "3–12m lock-in",
      requirements: "Early uplift forfeits promotional interest",
      url: "https://www.cimb.com.sg/en/personal/help-support/rates-charges/rates/sgd-fixed-deposit-rates.html",
      urlDomain: "cimb.com.sg",
    },
    {
      id: "fd-ocbc",
      category: "fd-mmf",
      categoryLabel: "Fixed Deposit",
      name: "OCBC SGD Time Deposit",
      provider: "OCBC Bank",
      protection: "SDIC $100k",
      protectionTone: "sdic",
      metaBadge: "Online & SeniorCare ($5k min)",
      rateHeadline: "Up to 1.85% p.a.",
      rateTiers: [
        { label: "Promo (12-Month)", value: "up to 1.85%", tone: "accent" },
        { label: "Minimum Placement", value: "$5,000" },
      ],
      rateDetail:
        "Applies via OCBC Digital / Internet Banking (fresh funds for some promos)",
      capLabel: "$100k SDIC / bank",
      capAmount: 100000,
      liquidity: "6–12m lock-in",
      requirements: "Early withdrawal incurs fee / interest forfeiture",
      url: "https://www.ocbc.com/personal-banking/deposits/fixed-deposit-account",
      urlDomain: "ocbc.com",
    },
    {
      id: "fd-uob",
      category: "fd-mmf",
      categoryLabel: "Fixed Deposit",
      name: "UOB SGD Fixed Deposit",
      provider: "UOB",
      protection: "SDIC $100k",
      protectionTone: "sdic",
      metaBadge: "Online promo ($10k min)",
      rateHeadline: "Up to 1.70% p.a.",
      rateTiers: [
        { label: "Promotional Tenor", value: "up to 1.70%", tone: "accent" },
        { label: "Minimum Placement", value: "$10,000" },
      ],
      rateDetail: "Eligible for Cash or SRS online placement via UOB TMRW",
      capLabel: "$100k SDIC / bank",
      capAmount: 100000,
      liquidity: "6–10m lock-in",
      requirements:
        "Early uplift forfeits interest; check tranche fresh-funds rules",
      url: "https://www.uob.com.sg/personal/save/fixed-deposits/singapore-dollar-fixed-deposit.page",
      urlDomain: "uob.com.sg",
    },
    {
      id: "fullerton-sgd",
      category: "fd-mmf",
      categoryLabel: "MMF",
      name: "Fullerton SGD Cash Fund (Class A)",
      provider: "Fullerton Fund Management",
      protection: "Non-SDIC (MMF)",
      protectionTone: "mmf",
      metaBadge: "0.21% p.a. total expense",
      rateHeadline: "~1.60% gross · ~1.28% 1Y net",
      rateTiers: [
        { label: "5-Day Gross Yield", value: "~1.60%", tone: "accent" },
        { label: "1-Year Net Return", value: "~1.28%" },
      ],
      rateDetail:
        "Invests in MAS bills & top-tier SG/global bank fixed deposits",
      capLabel: "No cap",
      capAmount: null,
      liquidity: "T+1 to T+3 business days",
      requirements:
        "Investment fund (not SDIC-insured); available on Webull/Moomoo/Endowus",
      url: "https://www.fullertonfund.com/fund/fullerton-sgd-cash-fund-a/",
      urlDomain: "fullertonfund.com",
    },
    {
      id: "lionglobal-mmf",
      category: "fd-mmf",
      categoryLabel: "MMF",
      name: "LionGlobal SGD Money Market Fund",
      provider: "LionGlobal Investors",
      protection: "Non-SDIC (MMF)",
      protectionTone: "mmf",
      metaBadge: "0.30% p.a. mgmt fee",
      rateHeadline: "~1.80% YTM · ~1.41% 1Y net",
      rateTiers: [
        { label: "Weighted Portfolio YTM", value: "~1.80%", tone: "accent" },
        { label: "1-Year Net Return", value: "~1.41%" },
      ],
      rateDetail:
        "Short-duration SGD bank deposits & high-grade corporate/gov bills",
      capLabel: "No cap",
      capAmount: null,
      liquidity: "T+1 to T+3 business days",
      requirements: "Cash & SRS eligible via banks/brokers; not SDIC-insured",
      url: "https://www.lionglobalinvestors.com/en/fund.html?officialNav=SGA1",
      urlDomain: "lionglobalinvestors.com",
    },
    {
      id: "mari-invest",
      category: "fd-mmf",
      categoryLabel: "MMF",
      name: "Mari Invest SavePlus",
      provider: "MariBank",
      protection: "Non-SDIC (MMF)",
      protectionTone: "mmf",
      metaBadge: "0.25% mgmt fee · Instant $10k/d",
      rateHeadline: "~1.90% YTM · ~1.50% 1Y net",
      rateTiers: [
        { label: "Projected Portfolio YTM", value: "~1.90%", tone: "accent" },
        { label: "1-Year Net Return", value: "~1.50%" },
      ],
      rateDetail:
        "Lion-MariBank SavePlus MAS-bill/deposit fund with daily NAV update",
      capLabel: "No cap (instant $10k/d)",
      capAmount: null,
      liquidity: "Instant up to $10k/day",
      requirements: "Withdrawals >$10k/day settle T+1–T+3; not SDIC-insured",
      url: "https://www.maribank.sg/product/mari-invest",
      urlDomain: "maribank.sg",
    },
    {
      id: "chocolate-finance",
      category: "fd-mmf",
      categoryLabel: "Cash Mgmt",
      name: "Chocolate Finance",
      provider: "Chocolate Finance",
      protection: "Non-SDIC (Managed)",
      protectionTone: "mmf",
      metaBadge: "Top-Up Programme until 30 Jun 2027",
      rateHeadline: "2.20% ($20k) · 1.90% ($130k)",
      rateTiers: [
        { label: "First $20,000", value: "2.20%", tone: "accent" },
        { label: "Next $130,000", value: "1.90%" },
        { label: "Balances >$150k", value: "Market rate" },
      ],
      rateDetail: "Target return backed by Top-Up Programme (up to $150k)",
      capLabel: "$150,000 Top-Up cap",
      capAmount: 150000,
      liquidity: "Same-day up to $30k",
      requirements: "Invested in short-duration bond funds; not SDIC-insured",
      url: "https://www.chocolatefinance.com",
      urlDomain: "chocolatefinance.com",
    },
    {
      id: "syfe-cash",
      category: "fd-mmf",
      categoryLabel: "Cash Mgmt",
      name: "Syfe Cash+ (Flexi / Guaranteed)",
      provider: "Syfe",
      protection: "Non-SDIC (MMF/FD)",
      protectionTone: "mmf",
      metaBadge: "Flexi or locked Guaranteed tenors",
      rateHeadline: "~1.70% Flexi · 1.40–1.65% Guar.",
      rateTiers: [
        { label: "Cash+ Flexi (SGD, T+1)", value: "~1.70%", tone: "accent" },
        { label: "Guaranteed (3–12m FD)", value: "1.40%–1.65%" },
      ],
      rateDetail:
        "Choose flexible T+1 MMF sleeve or fixed bank-placed Guaranteed tranches",
      capLabel: "No cap",
      capAmount: null,
      liquidity: "T+1 Flexi / 3–12m locked",
      requirements:
        "Held via platform custodian structure; not directly SDIC-insured",
      url: "https://www.syfe.com/cash-management",
      urlDomain: "syfe.com",
    },
    {
      id: "endowus-cash",
      category: "fd-mmf",
      categoryLabel: "Cash Mgmt",
      name: "Endowus Cash Smart",
      provider: "Endowus",
      protection: "Non-SDIC (Fund)",
      protectionTone: "mmf",
      metaBadge: "Net after 0.15% access + fund fee",
      rateHeadline: "1.30%–2.80% net",
      rateTiers: [
        { label: "Secure (Low Risk)", value: "~1.30%" },
        { label: "Enhanced (Short Bond)", value: "~2.40%", tone: "accent" },
        { label: "Ultra (Higher Volatility)", value: "~2.80%" },
      ],
      rateDetail: "Supports Cash & SRS ($1,000 min); rebate of trailer fees",
      capLabel: "No cap ($1,000 min)",
      capAmount: null,
      liquidity: "2–4 working days",
      requirements: "Higher tiers carry duration/credit NAV fluctuation",
      url: "https://endowus.com/cash-smart",
      urlDomain: "endowus.com",
    },
    {
      id: "phillip-mms",
      category: "fd-mmf",
      categoryLabel: "MMF ETF",
      name: "Phillip SGD Money Market ETF (MMS)",
      provider: "PhillipFunds (SGX)",
      protection: "Non-SDIC (ETF)",
      protectionTone: "mmf",
      metaBadge: "SGX Ticker: MMS · T+2 settlement",
      rateHeadline: "~1.27% 7-day ann.",
      rateTiers: [
        { label: "7-Day Annualised Yield", value: "~1.27%", tone: "accent" },
        { label: "Trading Venue", value: "SGX (SGD)" },
      ],
      rateDetail:
        "Exchange-traded SGD money market fund bought via stock broker",
      capLabel: "No cap",
      capAmount: null,
      liquidity: "Market hours + T+2",
      requirements:
        "Requires CDP/custodian broker; watch bid-ask spread & commissions",
      url: "https://www.phillipfunds.com/phillip-sgd-money-market-etf/",
      urlDomain: "phillipfunds.com",
    },
  ];

  function resolveCashParkingCatalog(masRatesInput) {
    const { data, isLive } = normalizeMasRates(masRatesInput);
    const derivedAsOf = (() => {
      if (data.asOfDate && /^\d{4}-\d{2}-\d{2}/.test(data.asOfDate)) {
        const dt = new Date(data.asOfDate + "T00:00:00Z");
        if (!Number.isNaN(dt.getTime())) {
          return dt.toLocaleDateString("en-SG", {
            month: "short",
            year: "numeric",
            timeZone: "UTC",
          });
        }
      }
      return "Nov 2026";
    })();
    return {
      asOf: derivedAsOf,
      masAsOfDate: data.asOfDate,
      masIsLive: isLive,
      masFetchedAt: data.fetchedAt || null,
      categories: [
        { key: "all", label: "All Mediums" },
        { key: "gov", label: "Gov-Backed" },
        { key: "hysa", label: "HYSA" },
        { key: "digital", label: "Digital Banks" },
        { key: "fd-mmf", label: "FD & MMF" },
      ],
      items: [
        buildSsbItem(data, isLive),
        buildTbillsItem(data, isLive),
        ...STATIC_CASH_PARKING_ITEMS,
      ],
    };
  }

  const CASH_ACCOUNT_PRESETS = [
    {
      key: "dbs-multiplier",
      label: "DBS Multiplier",
      name: "DBS Multiplier",
      bankGroup: "dbs-posb",
      bankGroupLabel: "DBS / POSB",
      sdicCovered: true,
      sovereignBacked: false,
      bonusCap: 100000,
      bonusRatePct: 2.0,
      baseRatePct: 0.05,
      note: "First $100k earns bonus rate (1.8%–4.1%); excess >$100k earns 0.05% base & shares DBS/POSB $100k SDIC cap.",
    },
    {
      key: "posb-say",
      label: "POSB / DBS Savings",
      name: "POSB / DBS Savings",
      bankGroup: "dbs-posb",
      bankGroupLabel: "DBS / POSB",
      sdicCovered: true,
      sovereignBacked: false,
      bonusCap: 100000,
      bonusRatePct: 2.0,
      baseRatePct: 0.05,
      note: "Aggregated with DBS under a single $100,000 SDIC deposit insurance limit.",
    },
    {
      key: "ocbc-360",
      label: "OCBC 360",
      name: "OCBC 360",
      bankGroup: "ocbc",
      bankGroupLabel: "OCBC Bank",
      sdicCovered: true,
      sovereignBacked: false,
      bonusCap: 100000,
      bonusRatePct: 1.95,
      baseRatePct: 0.05,
      note: "First $100k earns Salary + Save bonus (~1.95%–2.45%); balances >$100k drop to 0.05% base rate.",
    },
    {
      key: "uob-one",
      label: "UOB One",
      name: "UOB One",
      bankGroup: "uob",
      bankGroupLabel: "UOB",
      sdicCovered: true,
      sovereignBacked: false,
      bonusCap: 150000,
      bonusRatePct: 1.9,
      baseRatePct: 0.05,
      note: "Tiered bonus up to $150k (~1.90% EIR with $500 card spend + GIRO/Salary); SDIC cap remains $100k.",
    },
    {
      key: "maribank",
      label: "MariBank Savings",
      name: "MariBank Savings",
      bankGroup: "maribank",
      bankGroupLabel: "MariBank",
      sdicCovered: true,
      sovereignBacked: false,
      bonusCap: 100000,
      bonusRatePct: 1.48,
      baseRatePct: 0.05,
      note: "Daily interest up to $100k (0.88% base, 1.48% bonus); SDIC-insured up to $100k.",
    },
    {
      key: "gxs",
      label: "GXS Savings / Boost",
      name: "GXS Savings / Boost",
      bankGroup: "gxs",
      bankGroupLabel: "GXS Bank",
      sdicCovered: true,
      sovereignBacked: false,
      bonusCap: 95000,
      bonusRatePct: 1.08,
      baseRatePct: 0.05,
      note: "Up to $95k across Saving Pockets (1.08%) / Main (0.88%); SDIC-insured up to $100k.",
    },
    {
      key: "trust-bank",
      label: "Trust Bank Savings",
      name: "Trust Bank Savings",
      bankGroup: "trust",
      bankGroupLabel: "Trust Bank",
      sdicCovered: true,
      sovereignBacked: false,
      bonusCap: 100000,
      bonusRatePct: 1.75,
      baseRatePct: 0.05,
      note: "Bonus rate with card spend; SDIC-insured up to $100k per depositor.",
    },
    {
      key: "ssb",
      label: "MAS Singapore Savings Bonds (SSB)",
      name: "MAS Singapore Savings Bonds (SSB)",
      bankGroup: "mas-gov",
      bankGroupLabel: "Singapore Gov (MAS)",
      sdicCovered: false,
      sovereignBacked: true,
      bonusCap: 200000,
      bonusRatePct: DEFAULT_MAS_LIVE_RATES.ssb.year10Return,
      baseRatePct: 0,
      note: "AAA Singapore Government bond; $200k individual cap (Cash + SRS), monthly par redemption.",
    },
    {
      key: "tbills",
      label: "MAS 6M / 1Y T-Bills",
      name: "MAS 6M / 1Y T-Bills",
      bankGroup: "mas-gov",
      bankGroupLabel: "Singapore Gov (MAS)",
      sdicCovered: false,
      sovereignBacked: true,
      bonusCap: 0,
      bonusRatePct: 1.86,
      baseRatePct: 1.86,
      note: "AAA Singapore Government treasury bills; no individual cap, locked until maturity.",
    },
    {
      key: "mmf",
      label: "SGD Money Market Fund (Fullerton / Mari Invest)",
      name: "SGD Money Market Fund (Fullerton / Mari Invest)",
      bankGroup: "mmf",
      bankGroupLabel: "Custodian MMF (Non-SDIC)",
      sdicCovered: false,
      sovereignBacked: false,
      bonusCap: 0,
      bonusRatePct: 1.8,
      baseRatePct: 1.8,
      note: "Uncapped institutional SGD money market fund (T+1 liquidity; non-SDIC).",
    },
    {
      key: "custom",
      label: "Custom Bank / Cash Account",
      name: "Custom Bank / Cash Account",
      bankGroup: "custom",
      bankGroupLabel: "Custom Bank (SDIC $100k)",
      sdicCovered: true,
      sovereignBacked: false,
      bonusCap: 100000,
      bonusRatePct: 2.0,
      baseRatePct: 0.05,
      note: "Custom tiered bank or fixed deposit account.",
    },
  ];

  function resolveCashAccountPreset(
    presetKey = "dbs-multiplier",
    masRates = null,
  ) {
    const resolvedMas = masRates || DEFAULT_MAS_LIVE_RATES;
    const ssb10YrPct = Number(
      resolvedMas?.ssb?.year10Return ?? DEFAULT_MAS_LIVE_RATES.ssb.year10Return,
    );
    const tbill6mPct = Number(
      resolvedMas?.tbills?.sixMonth?.cutoffYield ??
        DEFAULT_MAS_LIVE_RATES.tbills?.sixMonth?.cutoffYield ??
        1.86,
    );
    const found =
      CASH_ACCOUNT_PRESETS.find((p) => p.key === presetKey) ||
      CASH_ACCOUNT_PRESETS.find((p) => p.key === "custom");
    if (found.key === "ssb") {
      return { ...found, bonusRatePct: ssb10YrPct };
    }
    if (found.key === "tbills") {
      return { ...found, bonusRatePct: tbill6mPct, baseRatePct: tbill6mPct };
    }
    return { ...found };
  }

  function defaultCashAccounts(totalCash = 20000, masRates = null) {
    const safeTotal = Math.max(0, Math.round(Number(totalCash) || 0));
    const dbs = resolveCashAccountPreset("dbs-multiplier", masRates);
    const ssb = resolveCashAccountPreset("ssb", masRates);
    return [
      {
        id: "cash-1",
        preset: "dbs-multiplier",
        name: dbs.label,
        balance: safeTotal,
        bonusCap: dbs.bonusCap,
        bonusRatePct: dbs.bonusRatePct,
        baseRatePct: dbs.baseRatePct,
      },
      {
        id: "cash-2",
        preset: "ssb",
        name: "MAS SSB",
        balance: 0,
        bonusCap: ssb.bonusCap,
        bonusRatePct: ssb.bonusRatePct,
        baseRatePct: ssb.baseRatePct,
      },
    ];
  }

  function computeCashAccountsBreakdown(accounts = [], masRates = null) {
    const resolvedMas = masRates || DEFAULT_MAS_LIVE_RATES;
    const ssbBenchmarkPct = Number(
      resolvedMas?.ssb?.year10Return ?? DEFAULT_MAS_LIVE_RATES.ssb.year10Return,
    );
    const tbillBenchmarkPct = Number(
      resolvedMas?.tbills?.sixMonth?.cutoffYield ??
        DEFAULT_MAS_LIVE_RATES.tbills?.sixMonth?.cutoffYield ??
        1.86,
    );
    const list = Array.isArray(accounts) ? accounts : [];
    const sdicMap = new Map();
    let totalBalance = 0;
    let totalTier1Balance = 0;
    let totalOverflowBalance = 0;
    let totalOverflowInterest = 0;
    let totalAnnualInterest = 0;
    let potentialExtraAnnualInterest = 0;
    let totalSovereignBacked = 0;
    let totalNonSdicMmf = 0;
    let ssbTotalBalance = 0;

    const computedRows = list.map((acc, idx) => {
      const preset = resolveCashAccountPreset(
        acc?.preset || "custom",
        masRates,
      );
      const id = String(acc?.id || "cash-" + (idx + 1));
      const name = String(acc?.name ?? preset.label).trim() || preset.label;
      const balance = Math.max(0, Number(acc?.balance) || 0);
      const bonusCap =
        acc?.bonusCap != null && acc?.bonusCap !== ""
          ? Math.max(0, Number(acc.bonusCap) || 0)
          : preset.bonusCap;
      const bonusRatePct =
        acc?.bonusRatePct != null && acc?.bonusRatePct !== ""
          ? Math.max(0, Math.min(25, Number(acc.bonusRatePct) || 0))
          : preset.bonusRatePct;
      const baseRatePct =
        acc?.baseRatePct != null && acc?.baseRatePct !== ""
          ? Math.max(0, Math.min(25, Number(acc.baseRatePct) || 0))
          : preset.baseRatePct;
      const hasCap = bonusCap > 0;
      const tier1Balance = hasCap ? Math.min(balance, bonusCap) : balance;
      const overflowBalance = hasCap ? Math.max(0, balance - bonusCap) : 0;
      const tier1AnnualInterest = tier1Balance * (bonusRatePct / 100);
      const overflowAnnualInterest = overflowBalance * (baseRatePct / 100);
      const annualInterest = tier1AnnualInterest + overflowAnnualInterest;
      const monthlyInterest = annualInterest / 12;
      const effectiveRatePct =
        balance > 0 ? (annualInterest / balance) * 100 : bonusRatePct;
      const effectiveRate = effectiveRatePct / 100;
      const hasOverflow = overflowBalance > 0;
      const rateDragPct =
        balance > 0 && hasOverflow
          ? Math.round(Math.max(0, bonusRatePct - effectiveRatePct) * 100) / 100
          : 0;
      const potentialOverflowGainAnnual =
        hasOverflow && ssbBenchmarkPct > baseRatePct
          ? overflowBalance * ((ssbBenchmarkPct - baseRatePct) / 100)
          : 0;

      totalBalance += balance;
      totalTier1Balance += tier1Balance;
      totalOverflowBalance += overflowBalance;
      totalOverflowInterest += overflowAnnualInterest;
      totalAnnualInterest += annualInterest;
      potentialExtraAnnualInterest += potentialOverflowGainAnnual;

      if (preset.sovereignBacked) {
        totalSovereignBacked += balance;
        if (preset.key === "ssb") {
          ssbTotalBalance += balance;
        }
      } else if (preset.sdicCovered) {
        const groupKey =
          preset.key === "custom"
            ? "custom:" + name.toLowerCase()
            : preset.bankGroup;
        const groupLabel =
          preset.key === "custom" ? name : preset.bankGroupLabel;
        if (!sdicMap.has(groupKey)) {
          sdicMap.set(groupKey, {
            bankGroupKey: groupKey,
            label: groupLabel,
            totalBalance: 0,
            insuredBalance: 0,
            uninsuredBalance: 0,
            accountNames: [],
          });
        }
        const g = sdicMap.get(groupKey);
        g.totalBalance += balance;
        if (!g.accountNames.includes(name)) g.accountNames.push(name);
      } else {
        totalNonSdicMmf += balance;
      }

      return {
        id,
        preset: preset.key,
        presetLabel: preset.label,
        bankGroup: preset.bankGroup,
        bankGroupLabel: preset.bankGroupLabel,
        sdicCovered: preset.sdicCovered,
        sovereignBacked: preset.sovereignBacked,
        name,
        balance,
        bonusCap,
        hasCap,
        hasOverflow,
        bonusRatePct,
        baseRatePct,
        tier1Balance,
        overflowBalance,
        tier1AnnualInterest,
        overflowAnnualInterest,
        annualInterest,
        monthlyInterest,
        effectiveRatePct,
        effectiveRate,
        rateDragPct,
        potentialOverflowGainAnnual,
        note: preset.note,
      };
    });

    let totalSdicInsured = 0;
    let totalSdicUninsured = 0;
    const sdicGroups = [];
    for (const g of sdicMap.values()) {
      g.insuredBalance = Math.min(g.totalBalance, C.sdicCap);
      g.uninsuredBalance = Math.max(0, g.totalBalance - C.sdicCap);
      totalSdicInsured += g.insuredBalance;
      totalSdicUninsured += g.uninsuredBalance;
      sdicGroups.push(g);
    }

    const effectiveRatePct =
      totalBalance > 0
        ? (totalAnnualInterest / totalBalance) * 100
        : ssbBenchmarkPct;
    const effectiveRate = effectiveRatePct / 100;
    // Reconcile total sweep gain with sweepCashAccountsOverflow(): SSB up to $200k cap, remainder to 6M T-Bills.
    let ssbRoomForSweep = Math.max(0, C.ssbCap - ssbTotalBalance);
    let cappedPotentialExtraAnnualInterest = 0;
    for (const row of computedRows) {
      if (row.overflowBalance > 0) {
        const toSsb =
          row.baseRatePct < ssbBenchmarkPct
            ? Math.min(row.overflowBalance, ssbRoomForSweep)
            : 0;
        const toTbill = Math.max(0, row.overflowBalance - toSsb);
        ssbRoomForSweep = Math.max(0, ssbRoomForSweep - toSsb);
        const rowGain =
          toSsb * Math.max(0, (ssbBenchmarkPct - row.baseRatePct) / 100) +
          toTbill * Math.max(0, (tbillBenchmarkPct - row.baseRatePct) / 100);
        row.potentialOverflowGainAnnual = rowGain;
        cappedPotentialExtraAnnualInterest += rowGain;
      } else {
        row.potentialOverflowGainAnnual = 0;
      }
    }
    potentialExtraAnnualInterest = cappedPotentialExtraAnnualInterest;
    const totalMonthlyInterest = totalAnnualInterest / 12;
    const potentialExtraMonthlyInterest = potentialExtraAnnualInterest / 12;
    const overflowAccounts = computedRows.filter((r) => r.overflowBalance > 0);
    const sdicBreachGroups = sdicGroups.filter((g) => g.uninsuredBalance > 0);
    const sdicExceededBanks = sdicBreachGroups.map((g) => ({
      bankGroup: g.bankGroupKey,
      bankLabel: g.label,
      balance: g.totalBalance,
      uninsured: g.uninsuredBalance,
    }));
    const ssbCapExcess = Math.max(0, ssbTotalBalance - C.ssbCap);
    const overflowAvgBaseRatePct =
      totalOverflowBalance > 0
        ? (totalOverflowInterest / totalOverflowBalance) * 100
        : 0;
    const sweptAnnualInterest =
      totalAnnualInterest + potentialExtraAnnualInterest;
    const sweptEffectiveRatePct =
      totalBalance > 0
        ? (sweptAnnualInterest / totalBalance) * 100
        : ssbBenchmarkPct;

    return {
      accounts: computedRows,
      accountCount: computedRows.length,
      totalBalance,
      totalTier1Balance,
      totalOverflowBalance,
      totalAnnualInterest,
      totalMonthlyInterest,
      effectiveRatePct,
      effectiveRate,
      ssbBenchmarkPct,
      ssb10YrPct: ssbBenchmarkPct,
      tbillBenchmarkPct,
      overflowAvgBaseRatePct,
      potentialExtraAnnualInterest,
      potentialExtraMonthlyInterest,
      sweepAnnualGain: potentialExtraAnnualInterest,
      sweptEffectiveRatePct,
      overflowAccounts,
      sdicGroups,
      sdicBreachGroups,
      sdicExceededBanks,
      totalSdicInsured,
      totalSdicUninsured,
      sdicOverflowTotal: totalSdicUninsured,
      totalSovereignBacked,
      totalNonSdicMmf,
      ssbTotalBalance,
      ssbTotal: ssbTotalBalance,
      ssbCap: C.ssbCap,
      ssbCapExcess,
      ssbOverflow: ssbCapExcess,
    };
  }

  function sweepCashAccountsOverflow(accounts = [], masRates = null) {
    const bd = computeCashAccountsBreakdown(accounts, masRates);
    if (bd.totalOverflowBalance <= 0) {
      return bd.accounts.map((a) => ({
        id: a.id,
        preset: a.preset,
        name: a.name,
        balance: a.balance,
        bonusCap: a.bonusCap,
        bonusRatePct: a.bonusRatePct,
        baseRatePct: a.baseRatePct,
      }));
    }
    const ssbBenchmarkPct =
      bd.ssbBenchmarkPct || DEFAULT_MAS_LIVE_RATES.ssb.year10Return;
    const tbillBenchmarkPct = bd.tbillBenchmarkPct || 1.86;
    let remainingSsbRoom = Math.max(0, C.ssbCap - (bd.ssbTotalBalance || 0));
    let sweptToSsb = 0;
    let sweptToTbill = 0;
    const nextRows = bd.accounts.map((a) => {
      if (a.hasCap && a.overflowBalance > 0) {
        let moveAmt = 0;
        if (remainingSsbRoom > 0 && a.baseRatePct < ssbBenchmarkPct) {
          const toSsb = Math.min(a.overflowBalance, remainingSsbRoom);
          remainingSsbRoom -= toSsb;
          sweptToSsb += toSsb;
          moveAmt += toSsb;
        }
        const remOverflow = a.overflowBalance - moveAmt;
        if (remOverflow > 0 && a.baseRatePct < tbillBenchmarkPct) {
          sweptToTbill += remOverflow;
          moveAmt += remOverflow;
        }
        if (moveAmt > 0) {
          return {
            id: a.id,
            preset: a.preset,
            name: a.name,
            balance: Math.max(0, a.balance - moveAmt),
            bonusCap: a.bonusCap,
            bonusRatePct: a.bonusRatePct,
            baseRatePct: a.baseRatePct,
          };
        }
      }
      return {
        id: a.id,
        preset: a.preset,
        name: a.name,
        balance: a.balance,
        bonusCap: a.bonusCap,
        bonusRatePct: a.bonusRatePct,
        baseRatePct: a.baseRatePct,
      };
    });

    const nextUniqueId = () => {
      let n = nextRows.length + 1;
      const used = new Set(nextRows.map((r) => r.id));
      while (used.has("cash-" + n)) n++;
      return "cash-" + n;
    };

    if (sweptToSsb > 0) {
      const ssbPreset = resolveCashAccountPreset("ssb", masRates);
      let ssbRow = nextRows.find((r) => r.preset === "ssb");
      if (!ssbRow) {
        ssbRow = {
          id: nextUniqueId(),
          preset: "ssb",
          name: "MAS SSB",
          balance: 0,
          bonusCap: ssbPreset.bonusCap,
          bonusRatePct: ssbPreset.bonusRatePct,
          baseRatePct: ssbPreset.baseRatePct,
        };
        nextRows.push(ssbRow);
      }
      ssbRow.balance += sweptToSsb;
    }

    if (sweptToTbill > 0) {
      const tbillPreset = resolveCashAccountPreset("tbills", masRates);
      let tbillRow = nextRows.find((r) => r.preset === "tbills");
      if (!tbillRow) {
        tbillRow = {
          id: nextUniqueId(),
          preset: "tbills",
          name: "MAS 6M T-Bills",
          balance: 0,
          bonusCap: 0,
          bonusRatePct: tbillPreset.bonusRatePct,
          baseRatePct: tbillPreset.baseRatePct,
        };
        nextRows.push(tbillRow);
      }
      tbillRow.balance += sweptToTbill;
    }
    return nextRows;
  }

  function cashParkingPlan({
    summary,
    guide,
    params = {},
    bogle,
    masRates,
  } = {}) {
    const catalog = resolveCashParkingCatalog(masRates);
    const emergencyMonthlyBase = Math.max(
      0,
      Number(summary?.todaySpend ?? 2800),
    );
    const emergencyMin = Math.round(
      guide?.emergencyMin ?? emergencyMonthlyBase * 6,
    );
    const emergencyMax = Math.round(
      guide?.emergencyMax ?? emergencyMonthlyBase * 12,
    );
    const buckets = resolvePortfolioBuckets(params);
    const cashAccountsActive = Boolean(
      params?.cashAccountsActive &&
      Array.isArray(params?.cashAccounts) &&
      params.cashAccounts.length > 0,
    );
    const rawCurrentCash = Math.round(Math.max(0, buckets.ssbCash || 0));
    const cashBreakdown = computeCashAccountsBreakdown(
      cashAccountsActive
        ? params.cashAccounts
        : defaultCashAccounts(rawCurrentCash, masRates || params?.masRates),
      masRates || params?.masRates,
    );
    const currentCash = cashAccountsActive
      ? Math.round(cashBreakdown.totalBalance)
      : rawCurrentCash;
    const monthlyCashSaving = summary?.retiringNow
      ? 0
      : Math.round(Math.max(0, Number(params?.cashSaving || 0)));
    const monthlyBondSlice = summary?.retiringNow
      ? 0
      : Math.round(
          Math.max(0, Number(bogle?.monthlyRebalance?.buyBondMonthly || 0)),
        );
    const monthlyCashSlice = monthlyCashSaving + monthlyBondSlice;
    const hasSrs =
      Number(params?.srs || 0) > 0 || Number(params?.srsAnnual || 0) > 0;

    let positionTone = "good";
    let positionHeadline = "Fits inside 1 HYSA ($100k SDIC)";
    let positionNote =
      "Your current cash fits comfortably within one bank’s $100k SDIC insurance limit.";

    const fmtCash = fmtSgd;

    if (
      cashAccountsActive &&
      cashBreakdown.totalOverflowBalance > 0 &&
      Math.round(cashBreakdown.potentialExtraAnnualInterest) > 0
    ) {
      positionTone = "warn";
      positionHeadline = `${fmtCash(cashBreakdown.totalOverflowBalance)} Over Bonus Cap (${cashBreakdown.overflowAvgBaseRatePct.toFixed(2)}%)`;
      positionNote = `${cashBreakdown.overflowAccounts.map((a) => a.name).join(", ")} exceed bonus caps by ${fmtCash(cashBreakdown.totalOverflowBalance)}, dragging your blended cash rate to ${cashBreakdown.effectiveRatePct.toFixed(2)}% p.a. (${fmtCash(cashBreakdown.totalMonthlyInterest)}/mo). Sweep the overflow to MAS SSB (${cashBreakdown.ssbBenchmarkPct.toFixed(2)}%) or a 2nd bank for +${fmtCash(cashBreakdown.potentialExtraAnnualInterest)}/yr.`;
    } else if (cashAccountsActive && cashBreakdown.totalSdicUninsured > 0) {
      positionTone = "warn";
      positionHeadline = `${fmtCash(cashBreakdown.totalSdicUninsured)} Above $100k SDIC Cap`;
      positionNote = `Combined deposits at ${cashBreakdown.sdicBreachGroups.map((g) => g.label).join(", ")} exceed the $100k per-bank SDIC insurance cap by ${fmtCash(cashBreakdown.totalSdicUninsured)} (blended yield ${cashBreakdown.effectiveRatePct.toFixed(2)}% p.a. · ${fmtCash(cashBreakdown.totalMonthlyInterest)}/mo).`;
    } else if (currentCash <= 0) {
      positionTone = "warn";
      positionHeadline = "Build Tier 1 buffer first";
      positionNote =
        "Target 6–12 months of spending in an instant HYSA or digital bank before locking cash.";
    } else if (currentCash < emergencyMin) {
      positionTone = "warn";
      positionHeadline = "Below 6-month emergency target";
      positionNote =
        "Keep 100% instant in an SDIC-insured HYSA or digital bank until your 6-month buffer is filled.";
    } else if (currentCash <= C.sdicCap) {
      positionTone = "good";
      positionHeadline = cashAccountsActive
        ? `${cashBreakdown.effectiveRatePct.toFixed(2)}% Blended · SDIC Covered`
        : "Fits inside 1 HYSA ($100k SDIC)";
      positionNote =
        currentCash > emergencyMax
          ? "Emergency buffer covered; any surplus above 12 months can shift into SSB ($200k cap) or T-Bills."
          : "Emergency buffer covered inside a single $100k SDIC-insured bank.";
    } else if (currentCash <= C.sdicCap + C.ssbCap) {
      positionTone = cashAccountsActive ? "good" : "info";
      positionHeadline = cashAccountsActive
        ? `${cashBreakdown.effectiveRatePct.toFixed(2)}% Blended · Cap Optimized`
        : "Split across HYSA + SSB ($200k cap)";
      positionNote =
        "Cash exceeds one $100k SDIC bank cap. Keep emergency cash in HYSA/digital ($100k/bank) and park surplus in SSB (up to $200k) or T-Bills.";
    } else {
      positionTone = cashAccountsActive ? "good" : "info";
      positionHeadline = cashAccountsActive
        ? `${cashBreakdown.effectiveRatePct.toFixed(2)}% Blended · Multi-Account`
        : "Layer Multi-Bank + SSB + T-Bills/MMF";
      positionNote =
        "Cash exceeds 1 bank ($100k SDIC) + full SSB ($200k). Split across multiple SDIC banks, MAS T-Bills, or SGD MMFs.";
    }

    const tier1Alloc = Math.min(currentCash, C.sdicCap);
    const afterTier1 = Math.max(0, currentCash - tier1Alloc);
    const tier2Alloc = Math.min(afterTier1, C.ssbCap);
    const tier3Alloc = Math.max(0, afterTier1 - tier2Alloc);

    const ssbPostBufferCash = Math.max(0, currentCash - emergencyMax);
    const ssbTargetProgress = Math.min(C.ssbTargetBuffer, ssbPostBufferCash);
    const ssbTargetRemaining = Math.max(
      0,
      C.ssbTargetBuffer - ssbTargetProgress,
    );

    return {
      asOf: catalog.asOf,
      masAsOfDate: catalog.masAsOfDate,
      masIsLive: catalog.masIsLive,
      masFetchedAt: catalog.masFetchedAt,
      masSyncLabel:
        (catalog.masIsLive ? "MAS synced · " : "MAS snapshot · ") +
        formatSgFullDate(catalog.masAsOfDate),
      sdicCap: C.sdicCap,
      ssbCap: C.ssbCap,
      ssbTargetBuffer: C.ssbTargetBuffer,
      ssbTargetProgress,
      ssbTargetRemaining,
      emergencyMonthlyBase,
      emergencyMin,
      emergencyMax,
      currentCash,
      monthlyCashSaving,
      monthlyBondSlice,
      monthlyCashSlice,
      hasSrs,
      positionTone,
      positionHeadline,
      positionNote,
      cashAccountsActive,
      cashBreakdown,
      tiers: [
        {
          step: "Tier 1 · Instant Buffer",
          limit: "$100k SDIC / bank",
          targetText:
            "$" +
            emergencyMin.toLocaleString("en-SG") +
            "–$" +
            emergencyMax.toLocaleString("en-SG"),
          allocated: tier1Alloc,
          vehicles:
            "HYSA (OCBC 360 / UOB One / DBS) or Digital Bank (GXS / MariBank)",
        },
        {
          step: "Tier 2 · Sovereign Yield",
          limit: "$200k SSB cap · Uncapped T-Bills",
          targetText: "Surplus above 12m buffer",
          allocated: tier2Alloc,
          vehicles:
            "MAS Singapore Savings Bonds (monthly exit) & 6m/1y T-Bills",
        },
        {
          step: "Tier 3 · Overflow & SRS",
          limit: "Non-SDIC · Check liquidity",
          targetText: hasSrs ? "Idle SRS & excess cash" : "Overflow > $300k",
          allocated: tier3Alloc,
          vehicles:
            "SGD MMFs (Fullerton / LionGlobal / Mari Invest) & Cash Mgmt",
        },
      ],
      catalog,
    };
  }

  function retirementTapsPlan({
    summary,
    selectedScenario,
    simulation,
    fire,
    bogle,
    tax,
    params = {},
    masRates = null,
  } = {}) {
    const effP = withEffectiveSavings(params);
    const sum = summary || calculate(effP);
    const sim =
      simulation ||
      simulate(effP, selectedScenario?.key || "salary", { summary: sum });
    const todaySum = sum.moneyBasis === "today" ? sum : todayPlan(sum);
    const desiredKey =
      selectedScenario?.key || sim.selectedScenario?.key || "salary";
    const matchedTodayScen =
      desiredKey === "brs" && todaySum.brsScenario
        ? todaySum.brsScenario
        : todaySum.scenarios.find((x) => x.key === desiredKey);
    let scen =
      (sum.moneyBasis === "today" ? selectedScenario : null) ||
      matchedTodayScen ||
      todaySum.scenarios[0];
    if (sum.moneyBasis !== "today" && selectedScenario) {
      const payoutToday = todayValue(
        selectedScenario.payout || 0,
        65,
        sum.age,
        sum.inflation,
      );
      const standardPayoutToday = todayValue(
        selectedScenario.standardPayout ?? selectedScenario.payout ?? 0,
        65,
        sum.age,
        sum.inflation,
      );
      const payout75Today = todayValue(
        selectedScenario.payout75 || 0,
        75,
        sum.age,
        sum.inflation,
      );
      const balanceToday = todayValue(
        selectedScenario.balance ?? selectedScenario.cpfAt55 ?? 0,
        55,
        sum.age,
        sum.inflation,
      );
      const gap65Today =
        selectedScenario.gap65 != null
          ? todayValue(selectedScenario.gap65, 65, sum.age, sum.inflation)
          : Math.max(0, (todaySum.spend65 || 0) - payoutToday);
      const gap75Today =
        selectedScenario.gap75 != null
          ? todayValue(selectedScenario.gap75, 75, sum.age, sum.inflation)
          : Math.max(0, (todaySum.spend75 || 0) - payout75Today);
      scen = {
        ...(matchedTodayScen || selectedScenario),
        key: selectedScenario.key,
        balance: balanceToday,
        payout: payoutToday,
        standardPayout: standardPayoutToday,
        payout75: payout75Today,
        gap65: gap65Today,
        gap75: gap75Today,
        privateTarget: todayValue(
          selectedScenario.privateTarget || 0,
          sum.retire,
          sum.age,
          sum.inflation,
        ),
      };
    }
    const fp =
      fire || firePlan(effP, scen.key, { summary: sum, simulation: sim });
    const bg = bogle || bogleheadAllocation(effP, sim.invest);
    const tx = tax || taxSweetSpot(effP);

    const keepOA = sim?.cpfResult || projectCPF(effP);
    const oaAt55Nominal = Math.max(
      0,
      keepOA.oaAfter55 ?? keepOA.availableAt55 - keepOA.cpfAt55,
    );
    const oaAt55Today = todayValue(oaAt55Nominal, 55, sum.age, sum.inflation);
    const oaInterestMonthlyNominal = (oaAt55Nominal * C.oaRate) / 12;
    const oaInterestMonthlyToday = (oaAt55Today * C.oaRate) / 12;
    const oa500kMonthlyExact = Math.round(
      (C.oaInterestRefBalance * C.oaRate) / 12,
    );

    const resolvedMas = masRates || params?.masRates || DEFAULT_MAS_LIVE_RATES;
    const ssb10YrPct = Number(
      resolvedMas?.ssb?.year10Return ?? DEFAULT_MAS_LIVE_RATES.ssb.year10Return,
    );
    const ssb1YrPct = Number(
      resolvedMas?.ssb?.year1Return ??
        DEFAULT_MAS_LIVE_RATES.ssb?.year1Return ??
        1.83,
    );
    const ssb10YrRate = ssb10YrPct / 100;
    const ssb150kMonthlyYield = Math.round(
      (C.ssbTargetBuffer * ssb10YrRate) / 12,
    );
    const cashAccountsActive = Boolean(
      params?.cashAccountsActive &&
      Array.isArray(params?.cashAccounts) &&
      params.cashAccounts.length > 0,
    );
    const cashBreakdown = cashAccountsActive
      ? computeCashAccountsBreakdown(params.cashAccounts, resolvedMas)
      : null;
    const hasCustomCashRate =
      params?.cashReturnRate != null &&
      params.cashReturnRate !== "" &&
      Number.isFinite(Number(params.cashReturnRate)) &&
      Number(params.cashReturnRate) >= 0;
    const effectiveCashAnnualRate = resolveCashReturnRate(
      params,
      fp?.cashReturnRate ?? ssb10YrRate,
    );
    const effectiveCashRatePct = hasCustomCashRate
      ? Number((effectiveCashAnnualRate * 100).toFixed(2))
      : cashBreakdown
        ? cashBreakdown.effectiveRatePct
        : Number((effectiveCashAnnualRate * 100).toFixed(2));
    const currentSsbMonthlyYield = hasCustomCashRate
      ? Math.round((bg.buckets.ssbCash * effectiveCashAnnualRate) / 12)
      : cashBreakdown
        ? Math.round(cashBreakdown.totalMonthlyInterest)
        : Math.round((bg.buckets.ssbCash * ssb10YrRate) / 12);
    const monthlyCashSaving = sum.retiringNow
      ? 0
      : Math.round(Math.max(0, Number(sim.cashSaving ?? effP.cashSaving ?? 0)));
    const monthlyBondBuyFromInvest = sum.retiringNow
      ? 0
      : Math.round(
          Math.max(0, Number(bg.monthlyRebalance?.buyBondMonthly || 0)),
        );
    const totalMonthlyCashAndBond =
      monthlyCashSaving + monthlyBondBuyFromInvest;
    const monthlyExtraCpf = sum.retiringNow
      ? 0
      : Math.round(Math.max(0, Number(sim.cpfExtra ?? effP.cpfExtra ?? 0)));
    const monthsToRet = Math.max(0, Math.round((sum.retire - sum.age) * 12));
    const mRateCash = monthlyRate(effectiveCashAnnualRate);
    const fvCashOnlyNominal =
      mRateCash > 0
        ? bg.buckets.ssbCash * (1 + mRateCash) ** monthsToRet +
          monthlyCashSaving * (((1 + mRateCash) ** monthsToRet - 1) / mRateCash)
        : bg.buckets.ssbCash + monthlyCashSaving * monthsToRet;
    const fvSsbAndBondNominal =
      mRateCash > 0
        ? bg.buckets.ssbCash * (1 + mRateCash) ** monthsToRet +
          totalMonthlyCashAndBond *
            (((1 + mRateCash) ** monthsToRet - 1) / mRateCash)
        : bg.buckets.ssbCash + totalMonthlyCashAndBond * monthsToRet;
    const projectedCashOnlyAtRetireToday = Math.round(
      todayValue(fvCashOnlyNominal, sum.retire, sum.age, sum.inflation),
    );
    const fallbackProjectedSsbAtRetireToday = Math.round(
      todayValue(fvSsbAndBondNominal, sum.retire, sum.age, sum.inflation),
    );
    const ptAtRetire =
      fp?.atRetire ||
      fp?.points?.find((pt) => pt.age === fp.retire) ||
      fp?.points?.[fp.points.length - 1] ||
      null;
    const resolvedProjectedSsbCashAtRetireToday = Math.round(
      ptAtRetire?.today?.ssbCash ?? fallbackProjectedSsbAtRetireToday,
    );
    const projectedCashMonthlyYieldToday = Math.round(
      (resolvedProjectedSsbCashAtRetireToday * effectiveCashAnnualRate) / 12,
    );
    const currentLiquidEquities = Math.round(
      (bg.buckets.equities || 0) + (bg.buckets.sgDividends || 0),
    );
    const projectedEquitiesAtRetireToday = Math.round(
      ptAtRetire?.today?.liquidEquities ?? currentLiquidEquities,
    );
    // Tap 3 owns liquid equities only; Tap 4 owns SSB/Cash + bond sleeve so Tap 3 + Tap 4 === total liquid with zero double-counting.
    const projectedInvestAtRetireToday = ptAtRetire
      ? projectedEquitiesAtRetireToday
      : Math.round(
          todayValue(
            sim.portfolioAtRetire || 0,
            sum.retire,
            sum.age,
            sum.inflation,
          ),
        );
    const portAtRetireToday = Math.round(
      fp?.fireNumber?.projectedOutsideAtRetireToday ??
        todayValue(
          sim.portfolioAtRetire || 0,
          sum.retire,
          sum.age,
          sum.inflation,
        ),
    );
    const firePctFunded = Math.max(
      0,
      Number(
        fp?.fireNumber?.pctFunded ??
          (scen.privateTarget > 0
            ? (portAtRetireToday / scen.privateTarget) * 100
            : 100),
      ),
    );
    const portDrawToday =
      scen.gap65 > 0
        ? Math.round(scen.gap65 * (Math.min(100, firePctFunded) / 100))
        : Math.round((projectedInvestAtRetireToday * 0.04) / 12);
    const srsStartAge =
      tx.srsWithdrawalStartAge || Math.max(tx.srsLockInAge, sum.retire);
    const srsProjectedAt63Today = todayValue(
      tx.srsProjectedAt63,
      srsStartAge,
      sum.age,
      sum.inflation,
    );
    const srsTenYearAnnualDrawToday = todayValue(
      tx.srsTenYearAnnualDraw,
      srsStartAge,
      sum.age,
      sum.inflation,
    );
    const srsTenYearMonthlyDrawToday = srsTenYearAnnualDrawToday / 12;
    const srsMode = tx.srsInvestedIn || effP.srsInvestedIn || "global";
    const hasAnyRstu = (tx.maxRstu || 0) + (tx.eligibleFamilyRstu || 0) > 0;
    const srsEffectiveTaxSaved = hasAnyRstu
      ? tx.srsTaxSavedAfterRstu
      : tx.srsStandaloneTaxSaved;
    const srsEffectiveCap = hasAnyRstu
      ? tx.maxSrsAfterRstu
      : tx.maxSrsStandalone;
    const srsWorthIt =
      srsEffectiveCap > 0 &&
      srsEffectiveTaxSaved > 0 &&
      (tx.tier === "max-both" || (tx.tier === "rstu-first" && tx.saRoom <= 0));
    const marginalPctStr = (tx.taxBefore.marginalRate * 100)
      .toFixed(1)
      .replace(/\.0$/, "");
    let srsVerdictStatus = "worth-it";
    let srsVerdictLabel = `Worth It · Saves $${Math.round(srsEffectiveTaxSaved).toLocaleString("en-SG")}/yr`;
    if (tx.srsTrapStatus === "balloon-trap") {
      srsVerdictStatus = "trap-alert";
      srsVerdictLabel = `Trap Alert · Over $${Math.round(C.srsTrapFloorAt63 / 1000)}k`;
    } else if (
      srsMode === "cash" &&
      (tx.srsBalanceToday > 0 || tx.srsAnnualPlanned > 0)
    ) {
      srsVerdictStatus = "idle-cash";
      srsVerdictLabel = "Invest SRS · 0.05% Cash";
    } else if (
      tx.tier === "cap-reached" ||
      (tx.tier !== "liquid" && srsEffectiveCap <= 0)
    ) {
      srsVerdictStatus = "cap-full";
      srsVerdictLabel = "Skip · $80k Cap Full";
    } else if (tx.tier === "liquid") {
      srsVerdictStatus = "skip-low-tax";
      srsVerdictLabel = `Skip · ${marginalPctStr}% Tax`;
    } else if (tx.tier === "rstu-first" && tx.saRoom > 0) {
      srsVerdictStatus = "rstu-first";
      srsVerdictLabel = `RSTU First · ${marginalPctStr}% Tax`;
    } else if (srsEffectiveTaxSaved <= 0) {
      srsVerdictStatus = "skip-low-tax";
      srsVerdictLabel = `Skip · ${marginalPctStr}% Tax`;
    }

    const cpfBudgetCovPct = Math.min(
      100,
      Math.round((scen.payout / Math.max(1, todaySum.spend65)) * 100),
    );
    const eqGapCovPct =
      scen.gap65 > 0 ? Math.min(100, Math.round(firePctFunded)) : 100;
    const emergencyMin = Math.round(todaySum.todaySpend * 6);
    const emergencyMax = Math.round(todaySum.todaySpend * 12);

    return {
      tap1Cpf: {
        plan: sum.plan,
        selectedPathKey: scen.key,
        selectedPathLabel: scen.label,
        monthlyPayoutToday: scen.payout,
        monthlyExtraCpf,
        projectedCpf55Today: Math.round(scen.balance || 0),
        standardMonthlyToday: scen.standardPayout,
        escalatingMonthlyToday: scen.standardPayout * C.escalatingRatio,
        spend65Today: todaySum.spend65,
        todaySpend: todaySum.todaySpend,
        budgetCoveragePct: cpfBudgetCovPct,
        targetRefMonthly: C.cpfLifeTargetRef,
        brs: { sum: C.brs, monthly: 950 },
        frs: { sum: C.frs, monthly: 1780 },
        ers: { sum: C.ers, monthly: 3440, post55Only: true },
        oaAt55Nominal,
        oaAt55Today,
        oaInterestMonthlyNominal,
        oaInterestMonthlyToday,
        oa500kRefBalance: C.oaInterestRefBalance,
        oa500kRefMonthly: C.oaInterestRefMonthly,
        oa500kMonthlyExact,
      },
      tap2Srs: {
        startAge: srsStartAge,
        endAge: srsStartAge + 10,
        annualCap: C.srsCap,
        idleRate: C.srsIdleRate,
        taxFreeAnnual: C.srsTaxFreeAnnual,
        taxFreeMonthly: Math.round(C.srsTaxFreeAnnual / 12),
        softCapAt63: C.srsSoftCapAt63,
        srsZeroTaxCap: tx.srsZeroTaxCap,
        trapFloorAt63: C.srsTrapFloorAt63,
        trapCeilingAt63: C.srsTrapCeilingAt63,
        projectedAt63: tx.srsProjectedAt63,
        projectedAt63Today: srsProjectedAt63Today,
        tenYearAnnualDraw: tx.srsTenYearAnnualDraw,
        tenYearAnnualDrawToday: srsTenYearAnnualDrawToday,
        tenYearMonthlyDraw: tx.srsTenYearMonthlyDraw,
        tenYearMonthlyDrawToday: srsTenYearMonthlyDrawToday,
        srsInvestedIn: srsMode,
        srsReturnRate: tx.srsReturnRate,
        srsBalanceToday: tx.srsBalanceToday,
        srsAnnualPlanned: tx.srsAnnualPlanned,
        withdrawalTaxAnnual: tx.srsWithdrawalTaxAt63.annualTax,
        maxSafeAnnualTo400k: tx.srsMaxSafeAnnualTo400k,
        trapStatus: tx.srsTrapStatus,
        trapHeadline: tx.srsTrapHeadline,
        trapGuidance: tx.srsTrapGuidance,
        tier: tx.tier,
        marginalRate: tx.taxBefore.marginalRate,
        chargeableIncome: tx.chargeableIncome,
        reliefCapRemaining: tx.reliefCapRemaining,
        maxRstu: tx.maxRstu,
        eligibleFamilyRstu: tx.eligibleFamilyRstu,
        rstuTaxSaved: tx.rstuTaxSaved,
        maxSrsStandalone: tx.maxSrsStandalone,
        maxSrsAfterRstu: tx.maxSrsAfterRstu,
        srsTaxSavedAfterRstu: tx.srsTaxSavedAfterRstu,
        srsStandaloneTaxSaved: tx.srsStandaloneTaxSaved,
        taxSavedPerYear: tx.srsTaxSavedAfterRstu,
        effectiveRoom: tx.maxSrsAfterRstu,
        worthIt: srsWorthIt,
        verdictStatus: srsVerdictStatus,
        verdictLabel: srsVerdictLabel,
      },
      tap3Equities: {
        targetEquityPct: bg.holistic.targetEquityPct,
        targetBondPct: bg.holistic.targetBondPct,
        globalSplitPct: bg.holistic.globalEquitySplitPct,
        sgDividendSplitPct: bg.holistic.sgEquitySplitPct,
        currentEquities: currentLiquidEquities,
        holisticTotalEquities: bg.holistic.totalEquities,
        monthlyInvest: sum.retiringNow ? 0 : Math.round(sim.invest || 0),
        monthlyGlobalBuy: sum.retiringNow
          ? 0
          : Math.round(bg.monthlyRebalance?.buyGlobalMonthly || 0),
        monthlySgBuy: sum.retiringNow
          ? 0
          : Math.round(bg.monthlyRebalance?.buySgMonthly || 0),
        monthlyBondBuy: sum.retiringNow
          ? 0
          : Math.round(bg.monthlyRebalance?.buyBondMonthly || 0),
        projectedEquitiesAtRetireToday,
        projectedInvestAtRetireToday,
        portfolioAtRetireToday: portAtRetireToday,
        postCpfGap65Today: scen.gap65,
        gapCoveragePct: eqGapCovPct,
        firePctFunded: Math.round(firePctFunded),
        projectedMonthlyDrawToday: portDrawToday,
        benchmarkMinMonthly: C.equityTapMinRef,
        benchmarkMaxMonthly: C.equityTapMaxRef,
      },
      tap4Ssb: {
        currentSsbCash: bg.buckets.ssbCash,
        monthlyCashSaving,
        projectedCashOnlyAtRetireToday,
        projectedSsbCashAtRetireToday: resolvedProjectedSsbCashAtRetireToday,
        projectedMonthlyYieldToday: projectedCashMonthlyYieldToday,
        emergencyMin,
        emergencyMax,
        currentMonthlyYield: currentSsbMonthlyYield,
        targetBuffer: C.ssbTargetBuffer,
        masCap: C.ssbCap,
        monthlyYieldAt150k: ssb150kMonthlyYield,
        ssb10YrPct,
        ssb1YrPct,
        cashAccountsActive,
        cashBreakdown,
        hasCustomCashRate,
        effectiveRatePct: effectiveCashRatePct,
        accountCount: cashBreakdown ? cashBreakdown.accounts.length : 1,
        overflowBalance: cashBreakdown ? cashBreakdown.totalOverflowBalance : 0,
        potentialExtraMonthlyInterest: cashBreakdown
          ? Math.round(cashBreakdown.potentialExtraMonthlyInterest)
          : 0,
        sdicUninsured: cashBreakdown ? cashBreakdown.totalSdicUninsured : 0,
      },
      vhr: {
        oaRate: C.oaRate,
        saRate: C.saRate,
        rstuCap: C.rstuReliefCap,
        personalReliefCap: C.personalReliefCap,
        oaAt55Nominal,
        oaAt55Today,
        oaInterestMonthlyToday,
      },
    };
  }

  function evaluateDividendYield(opts = {}) {
    const capital = Math.max(0, Number(opts.capital ?? 100000) || 0);
    const ratePct = Math.min(
      100,
      Math.max(0, Math.round((Number(opts.ratePct ?? 5) || 0) * 100) / 100),
    );
    const rawInf = Number(
      opts.inflationRate ?? SG_DEFAULT_PLAN.inflationRate ?? 0.025,
    );
    const inflationRate = Number.isFinite(rawInf)
      ? Math.max(0, rawInf)
      : (SG_DEFAULT_PLAN.inflationRate ?? 0.025);
    const inflationPct = Math.round(inflationRate * 10000) / 100;
    const defaultSsbRate = DEFAULT_MAS_LIVE_RATES.ssb.year10Return;
    const rawSsbRate = opts.ssbRatePct ?? defaultSsbRate;
    const ssbRatePct =
      Math.round(
        (Number.isFinite(Number(rawSsbRate)) && rawSsbRate !== ""
          ? Math.max(0, Number(rawSsbRate))
          : defaultSsbRate) * 100,
      ) / 100;

    const annualPayout = Math.round(capital * (ratePct / 100) * 100) / 100;
    const monthlyPayout = Math.round((annualPayout / 12) * 100) / 100;
    const quarterlyPayout = Math.round((annualPayout / 4) * 100) / 100;
    const dailyPayout = Math.round((annualPayout / 365) * 100) / 100;

    const realRatePct = Math.round((ratePct - inflationPct) * 100) / 100;
    const realAnnualPayout =
      Math.round(capital * (realRatePct / 100) * 100) / 100;
    const realMonthlyPayout = Math.round((realAnnualPayout / 12) * 100) / 100;

    let tierKey = "sweet-spot";
    let tone = "good";
    let badge = "Core Income · SG Dividend Benchmark";
    let headline = `Sustainable Income Tier (+${realRatePct.toFixed(2)}% Real)`;
    let summary = `Beats both 4.00% CPF SA/RA and ${inflationPct.toFixed(1)}% inflation. Aligns with STI ETFs (~4.5%), SG local banks (DBS/OCBC/UOB ~5.0%–5.5%), and blue-chip SG REITs (5.0%–6.0%) with 0% SG dividend withholding tax.`;

    if (ratePct < 1.5) {
      tierKey = "sub-floor";
      tone = "danger";
      badge = "Sub-Inflation · Negative Real Yield";
      headline = "Below Safe Floor — Erodes Real Principal";
      summary = `Trails Singapore’s ${inflationPct.toFixed(1)}% inflation and ${ssbRatePct.toFixed(2)}% MAS 10Y SSB. At ${ratePct.toFixed(2)}%, inflation erodes ${Math.abs(realRatePct).toFixed(2)}%/yr of real purchasing power.`;
    } else if (ratePct < inflationPct) {
      tierKey = "capital-preserve";
      tone = "warn";
      badge = "Capital Preservation · Trails Inflation";
      headline = "Liquid Parking Tier — Slightly Behind Inflation";
      summary = `Comparable to MAS T-Bills / 10Y SSB (${ssbRatePct.toFixed(2)}%) and base HYSA tiers. Safe for emergency liquidity, but trails ${inflationPct.toFixed(1)}% inflation and 2.50% CPF OA.`;
    } else if (ratePct < 4.0) {
      tierKey = "safe-floor";
      tone = "info";
      badge = "Moderate Yield · Beats Inflation & CPF OA";
      headline = `Inflation-Beating Safe Yield (+${realRatePct.toFixed(2)}% Real)`;
      summary = `Outpaces ${inflationPct.toFixed(1)}% inflation and 2.50% CPF OA while approaching the 4.00% CPF SA/RA floor. Typical of promotional HYSAs, money market funds, and SGD investment-grade bonds.`;
    } else if (ratePct <= 6.2) {
      tierKey = "sweet-spot";
      tone = "good";
      badge = "Core Income · SG Dividend Benchmark";
      headline = `Sustainable Income Tier (+${realRatePct.toFixed(2)}% Real)`;
      summary = `Beats both 4.00% CPF SA/RA and ${inflationPct.toFixed(1)}% inflation. Aligns with STI ETFs (~4.5%), SG local banks (DBS/OCBC/UOB ~5.0%–5.5%), and blue-chip SG REITs (5.0%–6.0%) with 0% SG dividend withholding tax.`;
    } else if (ratePct <= 7.5) {
      tierKey = "elevated";
      tone = "warn";
      badge = "Elevated Yield · Verify Payout Coverage";
      headline = "High Yield — Check Free Cash Flow & Gearing";
      summary =
        "Above typical SG blue-chip bank and REIT averages (4.5%–6.0%). Confirm distributions are backed by recurring operating cash flow rather than high debt gearing (>40%) or capital return.";
    } else {
      tierKey = "yield-trap";
      tone = "danger";
      badge = "High Risk · Capital Erosion Warning";
      headline = "Unsustainable SGD Yield Zone — Watch for NAV Erosion";
      summary =
        "In SGD terms, yields above 7.5% rarely sustain without share price / NAV decay, DPU cuts, FX depreciation, or covered-call upside drag. Check 5-year total return before committing capital.";
    }

    const rawBenchmarks = [
      {
        key: "bank-base",
        label: "Idle Bank Base Rate",
        sub: "POSB / DBS / OCBC base tier (SDIC $100k)",
        ratePct: 0.05,
        tone: "danger",
        verdictShort: "Severe inflation drag",
      },
      {
        key: "mas-ssb",
        label: "MAS 10Y SSB",
        sub: "Sovereign AAA floor · $200k individual cap",
        ratePct: ssbRatePct,
        tone: "warn",
        verdictShort: "Liquid cash floor",
      },
      {
        key: "cpf-oa",
        label: "CPF OA / SG Inflation",
        sub: "2.5% statutory OA floor & core inflation benchmark",
        ratePct: 2.5,
        tone: "info",
        verdictShort: "Real purchasing power parity",
      },
      {
        key: "cpf-sa",
        label: "CPF SA / RA Floor",
        sub: "4.0% risk-free long-term CPF benchmark",
        ratePct: 4.0,
        tone: "info",
        verdictShort: "Risk-free hurdle rate",
      },
      {
        key: "sg-banks",
        label: "STI ETF / SG Local Banks",
        sub: "DBS · OCBC · UOB · 0% SG dividend tax",
        ratePct: 5.0,
        tone: "good",
        verdictShort: "Core SG dividend benchmark",
      },
      {
        key: "sg-reits",
        label: "SG Blue-Chip REITs",
        sub: "Industrial / Retail / Parkway · <40% gearing",
        ratePct: 6.0,
        tone: "good",
        verdictShort: "Upper sustainable income tier",
      },
      {
        key: "yield-trap",
        label: "Yield-Trap Warning Zone",
        sub: "High-leverage REITs / FX debt / option-cap ETFs",
        ratePct: 8.0,
        tone: "danger",
        verdictShort: "High NAV decay & DPU cut risk",
      },
    ];

    let closestIdx = 0;
    let minDiff = Infinity;
    rawBenchmarks.forEach((b, idx) => {
      const d = Math.abs(b.ratePct - ratePct);
      if (d < minDiff) {
        minDiff = d;
        closestIdx = idx;
      }
    });

    const benchmarks = rawBenchmarks.map((b, idx) => {
      const bAnnual = Math.round(capital * (b.ratePct / 100) * 100) / 100;
      const bMonthly = Math.round((bAnnual / 12) * 100) / 100;
      const bRealRatePct = Math.round((b.ratePct - inflationPct) * 100) / 100;
      return {
        ...b,
        annualPayout: bAnnual,
        monthlyPayout: bMonthly,
        realRatePct: bRealRatePct,
        monthlyDelta: Math.round((bMonthly - monthlyPayout) * 100) / 100,
        isClosest: idx === closestIdx && minDiff <= 0.35,
      };
    });

    return {
      capital,
      ratePct,
      inflationPct,
      ssbRatePct,
      annualPayout,
      monthlyPayout,
      quarterlyPayout,
      dailyPayout,
      realRatePct,
      realAnnualPayout,
      realMonthlyPayout,
      tierKey,
      tone,
      badge,
      headline,
      summary,
      benchmarks,
    };
  }

  function evaluateTargetMonthlyIncome({
    targetMonthly = 10000,
    ratePct = 5.0,
    currentCapital = 60000,
    monthlyContribution = 1817,
    inflationPct = 2.5,
    masRates = null,
  } = {}) {
    const tgtMo = Math.max(
      0,
      Number.isFinite(Number(targetMonthly)) ? Number(targetMonthly) : 0,
    );
    const rPct = Math.max(
      0.1,
      Math.min(25, Number.isFinite(Number(ratePct)) ? Number(ratePct) : 5.0),
    );
    const curCap = Math.max(
      0,
      Number.isFinite(Number(currentCapital)) ? Number(currentCapital) : 0,
    );
    const moSave = Math.max(
      0,
      Number.isFinite(Number(monthlyContribution))
        ? Number(monthlyContribution)
        : 0,
    );
    const infPct = Math.max(
      0,
      Number.isFinite(Number(inflationPct)) ? Number(inflationPct) : 2.5,
    );
    const ssbRatePct = Number(
      masRates?.ssb?.tenYearAvgReturn ??
        masRates?.ssb?.year10Return ??
        DEFAULT_MAS_LIVE_RATES.ssb.year10Return,
    );

    const targetAnnual = Math.round(tgtMo * 12 * 100) / 100;
    const rateDec = rPct / 100;
    const requiredCapital =
      rateDec > 0 ? Math.round(targetAnnual / rateDec) : 0;
    const realRatePct = Math.round((rPct - infPct) * 100) / 100;
    const capitalGap = Math.max(0, requiredCapital - curCap);
    const pctReachedNow =
      requiredCapital > 0
        ? Math.min(100, Math.round((curCap / requiredCapital) * 1000) / 10)
        : 100;

    // Exact years to reach inflation-adjusted target capital (today's purchasing power)
    // with curCap + fixed nominal moSave compounding monthly at effective annual rPct.
    const rMo = monthlyRate(rateDec);
    const infMo = monthlyRate(infPct / 100);
    let monthsToGoal = 0;
    if (capitalGap > 0) {
      if (moSave <= 0 && curCap <= 0) {
        monthsToGoal = Infinity;
      } else {
        let bal = curCap;
        let inflatedCap = requiredCapital;
        while (bal < inflatedCap && monthsToGoal < 1200) {
          bal = bal * (1 + rMo) + moSave;
          inflatedCap *= 1 + infMo;
          monthsToGoal++;
        }
        if (bal < inflatedCap) monthsToGoal = Infinity;
      }
    }
    const yearsToGoal = Number.isFinite(monthsToGoal)
      ? Math.round((monthsToGoal / 12) * 10) / 10
      : null;

    // Required monthly contribution to hit inflation-adjusted target capital in 10, 15, 20, 25 years
    const calcReqSaveForYears = (yrs, tierRatePct = rPct) => {
      const n = Math.max(1, Math.round(yrs * 12));
      const rm = monthlyRate(tierRatePct / 100);
      const tierCapToday =
        tierRatePct > 0 ? Math.round((tgtMo * 12) / (tierRatePct / 100)) : 0;
      const tierCapInflated = Math.round(
        tierCapToday * (1 + infPct / 100) ** yrs,
      );
      const fvCur = curCap * (1 + rm) ** n;
      const rem = Math.max(0, tierCapInflated - fvCur);
      if (rem <= 0) return 0;
      const af = annuityFactor(rm, n);
      return Math.ceil(rem / af);
    };

    const yieldVerdict = evaluateDividendYield({
      capital: requiredCapital,
      ratePct: rPct,
      inflationRate: infPct / 100,
      ssbRatePct,
    });

    const tierRows = [
      {
        key: "ssb",
        label: "MAS 10Y SSB",
        sub: "Risk-free sovereign floor",
        ratePct: ssbRatePct,
      },
      {
        key: "cpf-sa",
        label: "CPF SA / RA Floor",
        sub: "4.0% statutory floor",
        ratePct: 4.0,
      },
      {
        key: "sg-banks",
        label: "STI ETF / SG Banks",
        sub: "DBS · OCBC · UOB (0% tax)",
        ratePct: 5.0,
      },
      {
        key: "sg-reits",
        label: "SG Blue-Chip REITs",
        sub: "Industrial & Retail REITs",
        ratePct: 6.0,
      },
      {
        key: "yield-trap",
        label: "High-Risk / Yield Trap",
        sub: "High NAV erosion risk",
        ratePct: 8.0,
      },
    ].map((t) => {
      const safeRate = t.ratePct > 0 ? t.ratePct : 0.1;
      const reqCap = Math.round((tgtMo * 12) / (safeRate / 100));
      const gap = Math.max(0, reqCap - curCap);
      return {
        ...t,
        requiredCapital: reqCap,
        capitalGap: gap,
        save15YrMo: calcReqSaveForYears(15, safeRate),
        save20YrMo: calcReqSaveForYears(20, safeRate),
        isSelected: Math.abs(t.ratePct - rPct) <= 0.35,
      };
    });

    return {
      targetMonthly: tgtMo,
      targetAnnual,
      ratePct: rPct,
      inflationPct: infPct,
      realRatePct,
      currentCapital: curCap,
      monthlyContribution: moSave,
      requiredCapital,
      capitalGap,
      pctReachedNow,
      yearsToGoal,
      save10YrMo: calcReqSaveForYears(10, rPct),
      save15YrMo: calcReqSaveForYears(15, rPct),
      save20YrMo: calcReqSaveForYears(20, rPct),
      save25YrMo: calcReqSaveForYears(25, rPct),
      tone: yieldVerdict.tone,
      badge: yieldVerdict.badge,
      headline: yieldVerdict.headline,
      summary: yieldVerdict.summary,
      tierRows,
    };
  }

  function evaluateAnnuityPlan({
    monthlyContribution = 1000,
    contributeYears = 10,
    deferYears = 5,
    payoutYears = 15,
    quotedMonthlyPayout = 1150,
    nonGuaranteedMonthlyDividends = 0,
    dividendStepUpRatePct = 5,
    terminalDividend = 0,
    paymentMode = "monthly",
    bonusRealization = 1,
    inflationRatePct = 2.5,
    benchmarkRatePct = 5.0,
    masRates = null,
  } = {}) {
    const moPayIn = Math.max(
      1,
      Number.isFinite(Number(monthlyContribution))
        ? Number(monthlyContribution)
        : 1000,
    );
    const cYrs = Math.max(
      1,
      Math.min(
        50,
        Math.round(
          Number.isFinite(Number(contributeYears))
            ? Number(contributeYears)
            : 15,
        ),
      ),
    );
    const dYrs = Math.max(
      0,
      Math.min(
        30,
        Math.round(
          Number.isFinite(Number(deferYears)) ? Number(deferYears) : 0,
        ),
      ),
    );
    const pYrs = Math.max(
      1,
      Math.min(
        50,
        Math.round(
          Number.isFinite(Number(payoutYears)) ? Number(payoutYears) : 20,
        ),
      ),
    );
    const quotedMo = Math.max(
      0,
      Number.isFinite(Number(quotedMonthlyPayout))
        ? Number(quotedMonthlyPayout)
        : 0,
    );
    const baseMonthlyDividends = Math.max(
      0,
      Number.isFinite(Number(nonGuaranteedMonthlyDividends))
        ? Number(nonGuaranteedMonthlyDividends)
        : 0,
    );
    const realization = Math.max(
      0,
      Math.min(
        1,
        Number.isFinite(Number(bonusRealization))
          ? Number(bonusRealization)
          : 1,
      ),
    );
    const stepUp = Math.max(
      0,
      Math.min(
        1,
        (Number.isFinite(Number(dividendStepUpRatePct))
          ? Number(dividendStepUpRatePct)
          : 5) / 100,
      ),
    );
    const baseTerminalDividend = Math.max(
      0,
      Number.isFinite(Number(terminalDividend)) ? Number(terminalDividend) : 0,
    );
    const inflation = Math.max(
      -0.99,
      Math.min(
        1,
        (Number.isFinite(Number(inflationRatePct))
          ? Number(inflationRatePct)
          : 2.5) / 100,
      ),
    );
    const mode = paymentMode === "annual" ? "annual" : "monthly";
    const benchRatePct = Math.max(
      0.5,
      Math.min(
        20,
        Number.isFinite(Number(benchmarkRatePct))
          ? Number(benchmarkRatePct)
          : 5,
      ),
    );
    const ssbRatePct = Number(
      masRates?.ssb?.tenYearAvgReturn ??
        masRates?.ssb?.year10Return ??
        DEFAULT_MAS_LIVE_RATES.ssb.year10Return,
    );

    const premiumMonths = cYrs * 12;
    const payoutStartMonth = (cYrs + dYrs) * 12;
    const payoutMonths = pYrs * 12;
    const totalMonths = (cYrs + dYrs + pYrs) * 12;
    const flows = Array(totalMonths + 1).fill(0);

    if (mode === "monthly") {
      for (let m = 0; m < premiumMonths; m++) flows[m] -= moPayIn;
    } else {
      for (let m = 0; m < premiumMonths; m += 12) flows[m] -= moPayIn * 12;
    }

    const scaledMonthlyDividends = baseMonthlyDividends * realization;
    let year1AnnualDividend = 0;
    if (scaledMonthlyDividends > 0 && pYrs > 0) {
      if (stepUp === 0) {
        year1AnnualDividend = scaledMonthlyDividends / pYrs;
      } else {
        let divisor = 0;
        for (let y = 0; y < pYrs; y++) divisor += (1 + stepUp) ** y;
        year1AnnualDividend =
          divisor > 0 ? scaledMonthlyDividends / divisor : 0;
      }
    }
    const scaledTerminalDividend = baseTerminalDividend * realization;

    for (let y = 0; y < pYrs; y++) {
      const annualDividend = year1AnnualDividend * (1 + stepUp) ** y;
      const monthlyDividend = annualDividend / 12;
      for (let month = 0; month < 12; month++) {
        const flowIndex = payoutStartMonth + y * 12 + month + 1;
        flows[flowIndex] += quotedMo + monthlyDividend;
      }
    }
    flows[totalMonths] += scaledTerminalDividend;

    const totalPrincipalPaid = Math.round(
      mode === "monthly" ? moPayIn * premiumMonths : moPayIn * 12 * cYrs,
    );
    const guaranteedPayoutReceived = Math.round(quotedMo * payoutMonths);
    const nonGuaranteedPayoutReceived = Math.round(
      scaledMonthlyDividends + scaledTerminalDividend,
    );
    const totalPayoutReceived = Math.round(
      guaranteedPayoutReceived + nonGuaranteedPayoutReceived,
    );
    const netProfitNominal = totalPayoutReceived - totalPrincipalPaid;
    const payoutMultiple =
      totalPrincipalPaid > 0
        ? Math.round((totalPayoutReceived / totalPrincipalPaid) * 100) / 100
        : 0;

    const solveMonthlyLogGrowth = () => {
      if (flows[totalMonths] === 0) return null;
      // Premiums precede payouts. Valued at payout start, premiums grow in
      // magnitude as the rate rises, while discounted payouts shrink.
      const valueAtPayoutStart = (logGrowth) =>
        flows.reduce((sum, flow, month) => {
          if (flow === 0) return sum;
          return sum + flow * Math.exp((payoutStartMonth - month) * logGrowth);
        }, 0);
      let lo = -1;
      let hi = 1;
      while (valueAtPayoutStart(lo) < 0) lo *= 2;
      while (valueAtPayoutStart(hi) > 0) hi *= 2;
      for (let i = 0; i < 64; i++) {
        const mid = (lo + hi) / 2;
        const value = valueAtPayoutStart(mid);
        if (value === 0) return mid;
        if (value > 0) lo = mid;
        else hi = mid;
      }
      return (lo + hi) / 2;
    };
    const monthlyLogGrowth = solveMonthlyLogGrowth();
    const impliedAnnualIrrPct =
      monthlyLogGrowth === null
        ? null
        : Math.round(Math.expm1(12 * monthlyLogGrowth) * 10000) / 100;
    const realAnnualIrrPct =
      monthlyLogGrowth === null
        ? null
        : Math.round(
            Math.expm1(12 * monthlyLogGrowth - Math.log1p(inflation)) * 10000,
          ) / 100;

    const accumulatePremiums = (monthlyGrowth) => {
      let pot = 0;
      for (let m = 0; m < premiumMonths; m++) {
        pot =
          (pot +
            (mode === "monthly" ? moPayIn : m % 12 === 0 ? moPayIn * 12 : 0)) *
          monthlyGrowth;
      }
      for (let m = premiumMonths; m < payoutStartMonth; m++)
        pot *= monthlyGrowth;
      return pot;
    };
    const calcDiyAnnuity = (annualPct) => {
      const rm = (1 + annualPct / 100) ** (1 / 12) - 1;
      const pot = accumulatePremiums(1 + rm);
      const monthlyDraw =
        rm === 0
          ? pot / payoutMonths
          : (pot * rm) / (1 - (1 + rm) ** -payoutMonths);
      const totalPayout = monthlyDraw * payoutMonths;
      return {
        ratePct: annualPct,
        potAtPayoutStart: Math.round(pot),
        monthlyPayout: Math.round(monthlyDraw * 100) / 100,
        totalPayout: Math.round(totalPayout),
        perpetualMonthly: Math.round(pot * rm * 100) / 100,
        monthlyDeltaVsQuoted:
          Math.round(
            (monthlyDraw - (quotedMo + scaledMonthlyDividends / payoutMonths)) *
              100,
          ) / 100,
      };
    };
    const diySsb = calcDiyAnnuity(ssbRatePct);
    const diyCpfSa = calcDiyAnnuity(4);
    const diyBench = calcDiyAnnuity(benchRatePct);

    const startingMonthlyPayout =
      quotedMo + (pYrs > 0 ? year1AnnualDividend / 12 : 0);
    const finalMonthlyPayout =
      quotedMo +
      (pYrs > 0 ? (year1AnnualDividend * (1 + stepUp) ** (pYrs - 1)) / 12 : 0);
    let verdictKey = "fair";
    let tone = "info";
    let badge = "Fair Risk-Free Floor";
    const irrLabel = impliedAnnualIrrPct?.toLocaleString("en-SG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    let headline;
    let summary = `Guaranteed payout: $${quotedMo.toLocaleString("en-SG")}/mo. Participating income: $${Math.round(startingMonthlyPayout - quotedMo).toLocaleString("en-SG")}/mo in Year 1, step-up to $${Math.round(finalMonthlyPayout - quotedMo).toLocaleString("en-SG")}/mo in the final year. Maturity dividend: $${scaledTerminalDividend.toLocaleString("en-SG")}.`;
    if (monthlyLogGrowth === null) {
      verdictKey = "no-irr";
      badge = "No payout";
      headline = "IRR requires at least one positive payout.";
    } else if (impliedAnnualIrrPct < 2.5) {
      verdictKey = "endowment-trap";
      tone = "danger";
      badge = "Sub-Benchmark · Trails 2.5% Inflation";
      headline = `Implied yield is only ${irrLabel}% p.a.`;
    } else if (impliedAnnualIrrPct < 4) {
      verdictKey = "below-cpf-sa";
      tone = "warn";
      badge = "Below Hurdle · Trails 4.0% Risk-Free Rate";
      headline = `${irrLabel}% p.a. trails the 4.0% CPF SA benchmark`;
    } else if (impliedAnnualIrrPct <= 6.5) {
      verdictKey = "worth-it";
      tone = "good";
      badge = "Outperforms · Beats 4.0% Risk-Free Hurdle";
      headline = `Strong ${irrLabel}% p.a. nominal implied return`;
    } else {
      verdictKey = "high-risk-projection";
      tone = "warn";
      badge = "Elevated · Non-Guaranteed Projection";
      headline = `${irrLabel}% p.a. exceeds typical guaranteed annuity floors`;
    }

    const comparisons = [
      {
        key: "quoted",
        label: "Participating Annuity",
        sub: `${mode === "annual" ? "Annual" : "Monthly"} premium · ${pYrs}y payout`,
        ratePct: impliedAnnualIrrPct,
        potAtPayoutStart:
          monthlyLogGrowth === null
            ? null
            : Math.round(accumulatePremiums(Math.exp(monthlyLogGrowth))),
        monthlyPayout: startingMonthlyPayout,
        totalPayout: totalPayoutReceived,
        perpetualMonthly: 0,
        monthlyDeltaVsQuoted: 0,
        isQuoted: true,
      },
      {
        key: "ssb",
        label: "DIY · MAS 10Y SSB Floor",
        sub: "100% liquid sovereign floor · $0 lock-in penalty",
        ...diySsb,
      },
      {
        key: "cpf-sa",
        label: "DIY · CPF SA / RA (4.0% Floor)",
        sub: "AAA risk-free statutory rate · same premium cash flows",
        ...diyCpfSa,
      },
      {
        key: "diy-bench",
        label: `DIY · Portfolio @ ${benchRatePct.toFixed(1)}% p.a.`,
        sub: "Same premium, deferment and payout duration",
        ...diyBench,
      },
    ];

    return {
      monthlyContribution: moPayIn,
      contributeYears: cYrs,
      deferYears: dYrs,
      payoutYears: pYrs,
      quotedMonthlyPayout: quotedMo,
      nonGuaranteedMonthlyDividends: baseMonthlyDividends,
      dividendStepUpRatePct: dividendStepUpRatePct,
      terminalDividend: baseTerminalDividend,
      paymentMode: mode,
      bonusRealization: realization,
      inflationRatePct: inflationRatePct,
      year1AnnualDividend,
      scaledMonthlyDividends,
      scaledTerminalDividend,
      startingMonthlyPayout,
      finalMonthlyPayout,
      blendedMonthlyPayout: startingMonthlyPayout,
      guaranteedPayoutReceived,
      nonGuaranteedPayoutReceived,
      benchmarkRatePct: benchRatePct,
      totalPrincipalPaid,
      totalPayoutReceived,
      netProfitNominal,
      payoutMultiple,
      impliedAnnualIrrPct,
      realAnnualIrrPct,
      flows,
      diySsb,
      diyCpfSa,
      diyBench,
      verdictKey,
      tone,
      badge,
      headline,
      summary,
      comparisons,
    };
  }

  function computeRebalanceTargets(bogle, p, r) {
    const hol = bogle?.holistic || {};
    const curEqPct = Math.round(hol.effectiveEquityPct || 0);
    const tgtEqPct = Math.round(
      p?.targetEquityPct ?? SG_DEFAULT_PLAN.targetEquityPct,
    );
    const eqDriftPct = Math.abs(curEqPct - tgtEqPct);
    const curCashBucket = Math.round(bogle?.buckets?.ssbCash || 0);
    const emergencyReserveFloor = Math.max(
      20000,
      Math.round((r?.todaySpend || lifestyles.cca.budget) * 6),
    );
    const deployableExcessCash = Math.max(
      0,
      curCashBucket - emergencyReserveFloor,
    );
    const curLiqEq = Math.round(
      (bogle?.buckets?.equities || 0) + (bogle?.buckets?.sgDividends || 0),
    );
    const liqTotal = curLiqEq + curCashBucket;
    const holTot = Math.max(1, Math.round(hol.totalNetWorth || liqTotal));
    const targetTotalEq = Math.round(holTot * (tgtEqPct / 100));
    const srsMode = p?.srsInvestedIn || SG_DEFAULT_PLAN.srsInvestedIn;
    const srsBal = Math.round(bogle?.buckets?.srs || 0);
    const srsEq =
      srsMode === "global" || srsMode === "equities"
        ? srsBal
        : srsMode === "balanced"
          ? Math.round(srsBal * 0.6)
          : 0;
    const rawNewLiqEq = Math.min(liqTotal, Math.max(0, targetTotalEq - srsEq));
    const isUnderweightEq = rawNewLiqEq > curLiqEq;
    const shiftAmt = isUnderweightEq
      ? Math.min(rawNewLiqEq - curLiqEq, deployableExcessCash)
      : curLiqEq - rawNewLiqEq;
    const newLiqEq = isUnderweightEq
      ? curLiqEq + shiftAmt
      : curLiqEq - shiftAmt;
    const newCash = Math.max(0, liqTotal - newLiqEq);
    return {
      curEqPct,
      tgtEqPct,
      eqDriftPct,
      curCashBucket,
      emergencyReserveFloor,
      deployableExcessCash,
      curLiqEq,
      liqTotal,
      isUnderweightEq,
      shiftAmt,
      newLiqEq,
      newCash,
    };
  }

  function computeMonthlyTakeHomeCashflow({
    r,
    simulation,
    contribution,
    p,
    tax,
    expenseData,
  }) {
    const hMode = p?.housingMode || SG_DEFAULT_PLAN.housingMode;
    const hInfo = computeHousingPayment({
      mode: hMode,
      loanBalance: p?.housingBalance,
      loanRate: p?.housingRate,
      loanYears: p?.housingYears,
      loanParties: p?.housingParties,
      manualMonthly: p?.housing,
    });
    const housingTotalMo =
      hMode === "paid-up"
        ? 0
        : hMode === "all-oa"
          ? Math.round(r?.currentOA || 0)
          : Math.round(hInfo.monthlyShare || 0);
    const housingOaMo = Math.min(Math.round(r?.currentOA || 0), housingTotalMo);
    const housingCashMo = Math.max(0, housingTotalMo - housingOaMo);
    // Reuse passed tax summary when available; only compute if omitted.
    const taxSummary = tax || computeTaxSummary(p, simulation);
    const exactTax = taxSummary?.regularActiveTax || taxSummary?.activeTax;
    const monthlyTax = Math.max(0, Math.round(exactTax?.monthlyTax || 0));
    const allItems = expenseData?.items || [];
    const fixedMatcher =
      /insurance|healthshield|multiplier life|accident|term|utilities|s&cc|town council|wifi|mobile|streaming|subscription|broadband|telco|levy|helper/i;
    const recurringItems = allItems
      .filter(
        (it) =>
          it.category === "housing" ||
          it.category === "digital" ||
          fixedMatcher.test(it.name),
      )
      .sort((a, b) => b.amount - a.amount);
    const recurringTotal = Math.round(
      recurringItems.reduce((acc, it) => acc + (it.amount || 0), 0),
    );
    const fixedOutMo = Math.round(monthlyTax + housingCashMo + recurringTotal);
    const afterCpf = r?.afterCpf || 0;
    const contrib = contribution || 0;
    const leftAfterSave = Math.round(afterCpf - contrib);
    const netCashSurplus = Math.round(afterCpf - contrib - fixedOutMo);
    const maxAffordableSaveMo = Math.max(0, Math.round(afterCpf - fixedOutMo));
    return {
      hMode,
      housingTotalMo,
      housingOaMo,
      housingCashMo,
      monthlyTax,
      recurringItems,
      recurringTotal,
      fixedOutMo,
      leftAfterSave,
      netCashSurplus,
      maxAffordableSaveMo,
    };
  }

  function projectCashBucketAtRetire({
    currentBalance = 0,
    monthlyInflow = 0,
    annualRate = 0,
    yearsToRetire = 0,
    inflationRate = 0.025,
  } = {}) {
    const months = Math.max(0, Math.round(yearsToRetire * 12));
    const mRate = monthlyRate(Math.max(0, Number(annualRate) || 0));
    const cur = Math.max(0, Number(currentBalance) || 0);
    const inflow = Math.max(0, Number(monthlyInflow) || 0);
    const fvNominal =
      mRate > 0
        ? cur * (1 + mRate) ** months +
          inflow * (((1 + mRate) ** months - 1) / mRate)
        : cur + inflow * months;
    const inf = Math.max(0, Number(inflationRate ?? 0.025));
    const fvToday = fvNominal / (1 + inf) ** Math.max(0, yearsToRetire);
    return { nominal: Math.round(fvNominal), today: Math.round(fvToday) };
  }

  const api = {
    C,
    SG_DEFAULT_PLAN,
    SG_PERSONA_PRESETS,
    resolveLongevityAge,
    computeAgeFromDob,
    defaultDobForAge,
    computeHousingPayment,
    residentTax,
    computeTaxSummary,
    outsideAllocationGuide,
    resolvePortfolioBuckets,
    withEffectiveSavings,
    taxSweetSpot,
    bogleheadAllocation,
    firePlan,
    solveBucketAwareSimulation,
    retirementSum,
    annuityFactor,
    extraInterest,
    payoutFrom65,
    projectCPF,
    simulate,
    milestonePlan,
    todayValue,
    todayPlan,
    todayTrajectory,
    allocation,
    careRows,
    ccaRows,
    lifestyles,
    EXPENSE_CATEGORIES,
    defaultExpenseItems,
    scaleExpenseItems,
    expensePlan,
    healthShieldMonthlyAtAge,
    insuranceCurveLevelAtAge,
    expenseAt,
    referencePayout,
    portfolioTarget,
    calculate,
    paycheckAllocation,
    DEFAULT_MAS_LIVE_RATES,
    CASH_ACCOUNT_PRESETS,
    resolveCashAccountPreset,
    defaultCashAccounts,
    computeCashAccountsBreakdown,
    sweepCashAccountsOverflow,
    resolveCashReturnRate,
    resolveCashParkingCatalog,
    cashParkingPlan,
    retirementTapsPlan,
    buildPrintReportModel,
    evaluateDividendYield,
    evaluateTargetMonthlyIncome,
    evaluateAnnuityPlan,
    computeRebalanceTargets,
    computeMonthlyTakeHomeCashflow,
    projectCashBucketAtRetire,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.RetirementModel = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
