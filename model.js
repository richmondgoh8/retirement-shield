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
    cca: { label: "Community Care Apartments", budget: 2800 },
    "home-helper": { label: "Home + Helper", budget: 3900 },
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
    const sourceTotal = source.reduce((sum, row) => sum + row.amount, 0);
    const rows = source.map((row) => ({
      ...row,
      amount: sourceTotal > 0 ? (row.amount * total) / sourceTotal : 0,
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
      target +=
        Math.max(
          0,
          expenseAt(spend, retirementAge, t, inflation, lifestyle, expOpts) -
            cpf,
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
      const housingMonths =
        p.housingYears == null
          ? Infinity
          : Math.max(0, Math.round(Number(p.housingYears) * 12));
      const housing =
        m >= housingMonths
          ? 0
          : p.housing == null
            ? incoming.oa
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
    const calcOpts = {
      investmentReturn,
      inflation,
      plan,
      lifestyle,
      insuranceCurve: true,
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
        insuranceCurve: true,
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
        { insuranceCurve: true },
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
          { insuranceCurve: true },
        ),
        spend65: expenseAt(todaySpend, age, 65 - age, inflation, lifestyle, {
          insuranceCurve: true,
        }),
        spend75: expenseAt(todaySpend, age, 75 - age, inflation, lifestyle, {
          insuranceCurve: true,
        }),
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

    const emergencySpendBase = Math.max(0, Number(summary.todaySpend) || 0);
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
      emergencyMin: Math.round(emergencySpendBase * 6),
      emergencyMax: Math.round(emergencySpendBase * 12),
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
    spend: 3900,
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
          ? `At a 7% marginal bracket, CPF RSTU (up to $${Math.round(maxRstu).toLocaleString("en-SG")}/yr into SA/RA) earns a guaranteed 4.0% floor plus immediate tax relief before considering SRS.`
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
    const targetGlobalAmt =
      totalNetWorth * (Math.max(0, targetEquityPct - sgSleevePct) / 100);
    const targetSgAmt = targetEquityAmt - targetGlobalAmt;
    const equityGap = targetEquityAmt - totalEquities;
    const globalGap = Math.max(0, targetGlobalAmt - globalEquities);
    const sgGap = Math.max(0, targetSgAmt - sgDividends);
    const eqPosSum = globalGap + sgGap;

    const bondSourceLabel =
      cpfTotal > 0 && liquidBonds > 0
        ? `CPF and SSB/Cash hold ${Math.round(effectiveBondPct)}%`
        : cpfTotal > 0
          ? `CPF holds ${Math.round(effectiveBondPct)}%`
          : `SSB / Cash holds ${Math.round(effectiveBondPct)}%`;

    const investPool = Math.max(0, Number(monthlyInvest || 0));
    let buyGlobalMonthly = 0,
      buySgMonthly = 0,
      buyBondMonthly = 0,
      rebalanceNote = "";

    const eqSplitGlobalShare =
      eqPosSum > 0 ? globalGap / eqPosSum : globalTargetShareOfEquities;

    if (investPool <= 0.5) {
      rebalanceNote =
        equityGap > 500
          ? `Total portfolio is ${Math.round(effectiveEquityPct)}% equities vs ${targetEquityPct}% target (${bondSourceLabel} in fixed income). Direct new cash into equities.`
          : "Set monthly outside savings in Trajectory to see exact monthly buy orders.";
    } else if (equityGap > investPool) {
      // Underweight equities overall: direct 100% of new monthly cash to underweight equity buckets.
      buySgMonthly = Math.round(investPool * (1 - eqSplitGlobalShare));
      buyGlobalMonthly = Math.max(0, Math.round(investPool) - buySgMonthly);
      const sgOverweightNote =
        sgGap <= 0 && sgDividends > targetSgAmt + 50
          ? ` (SG Dividends are already above your ${sgSleevePct}% target, so 100% goes to Global UCITS)`
          : "";
      rebalanceNote = `Because ${bondSourceLabel} of net worth in fixed income, route 100% of monthly liquid cash into equities${sgOverweightNote} until holistic ratio hits ${targetEquityPct}/${100 - targetEquityPct}.`;
    } else if (equityGap < -investPool) {
      buyBondMonthly = Math.round(investPool);
      rebalanceNote = `Your equities exceed your ${targetEquityPct}% holistic target by $${Math.round(-equityGap).toLocaleString("en-SG")}. Route new monthly cash into SSB / T-Bills or CPF to restore balance.`;
    } else {
      const eqShare = targetEquityPct / 100;
      const totalEqBuy = Math.round(investPool * eqShare);
      buySgMonthly = Math.round(totalEqBuy * (1 - eqSplitGlobalShare));
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
          { insuranceCurve: true },
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
        { insuranceCurve: true },
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
            { insuranceCurve: true },
          );
          reqBridge += sp / (1 + rate) ** m;
        }
      }
      const p2Start = Math.max(cand, 65);
      let reqP2 = 0;
      for (let m = 1; m <= (endAge - p2Start) * 12; m++) {
        const curA = p2Start + (m - 1) / 12;
        const sp = expenseAt(
          todaySpend,
          age,
          curA - age,
          inflation,
          lifestyle,
          {
            insuranceCurve: true,
          },
        );
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
      const ratePct =
        mode === "hdb"
          ? 2.6
          : Math.max(
              0,
              Number(loanRate == null || loanRate === "" ? 2.6 : loanRate),
            );
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
      srsMo = Math.round(srsMonthlyPlanned);
      liquidPool = Math.max(0, investPool - srsMonthlyPlanned);

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
            0.95,
            Math.max(0.2, Number(params?.targetEquityPct ?? 80) / 100),
          );
          const sgShareOfEq =
            eqShare > 0
              ? Math.min(
                  0.15,
                  Math.max(0, Number(params?.sgSleevePct ?? 10) / 100),
                ) / eqShare
              : 0;
          const eqTarget = Math.round(liquidPool * eqShare);
          ssbMo = Math.max(0, Math.round(liquidPool) - eqTarget);
          sgEqMo = Math.round(eqTarget * sgShareOfEq);
          globalEqMo = Math.max(0, eqTarget - sgEqMo);
        }
      }

      cpfExtraMo = Math.round(Math.max(0, Number(simulation?.cpfExtra || 0)));
      const totalCashSavings =
        cpfExtraMo + Math.max(investPool, srsMonthlyPlanned);
      livingAndTax = Math.max(0, Math.round(afterCpf - totalCashSavings));
      overspendMo = Math.max(0, Math.round(totalCashSavings - afterCpf));
    }

    const eqMo = globalEqMo + sgEqMo;
    const extraTaxMo = cpfExtraMo + srsMo;
    const rows = [
      { label: "Living & IRAS Tax", amt: livingAndTax, color: "#64748B" },
      { label: "Mandatory CPF", amt: mandatoryCpf, color: "#059669" },
      {
        label: "Equities (Global + SG)",
        amt: eqMo,
        globalAmt: globalEqMo,
        sgAmt: sgEqMo,
        color: "#2563EB",
      },
      { label: "SSB / T-Bills", amt: ssbMo, color: "#D97706" },
      {
        label: "Extra CPF / SRS",
        amt: extraTaxMo,
        cpfExtraAmt: cpfExtraMo,
        srsAmt: srsMo,
        color: "#7C3AED",
      },
    ];

    return {
      grossPlusEmployer,
      afterCpf,
      mandatoryCpf,
      cpfExtraMo,
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
      fn.depletionAge != null ? Math.floor(fn.depletionAge) : 90;
    const runwayPill = fullyFundedTo95
      ? "Lasts 95+"
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
      fire?.points?.find((pt) => pt.age === retireAge) ||
      fire?.points?.[fire.points.length - 1];
    const outsideNeed = fn.totalRequiredToday ?? s.privateTarget;
    const cpfAtRetire =
      ptAtRetire?.today?.cpfTotal ??
      fire?.phase2?.projectedCpfAt65Today ??
      s.balance;
    const projectedAtRetire =
      basis === "nominal"
        ? (ptAtRetire?.totalNetWorth ?? 0)
        : (ptAtRetire?.today?.totalNetWorth ?? outsideNeed + cpfAtRetire);

    const cpfFloor65 = fire?.phase2?.cpfLife65Today ?? s.payout;
    const cpfCovPct = Math.min(
      100,
      Math.round((cpfFloor65 / Math.max(1, r.spend65)) * 100),
    );
    const builtTodayPct = Math.min(100, Math.max(0, fn.currentFirePct ?? 0));

    const hasCustomSaving =
      !r.retiringNow && (params?.invest != null || params?.cpfExtra != null);
    const monthlySave = r.retiringNow
      ? Math.round(s.privateSaving || 0)
      : Math.round((simulation?.cpfExtra || 0) + (simulation?.invest || 0));
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

    const fmtSgd = (v) =>
      "$" + Math.round(Math.max(0, v || 0)).toLocaleString("en-SG");
    const hol = bogle?.holistic || {};
    const targetEqPct = Math.round(hol.targetEquityPct ?? 80);
    const targetBondPct = Math.round(hol.targetBondPct ?? 20);
    const effEqPct = Math.round(hol.effectiveEquityPct ?? 0);
    const effBondPct = Math.round(hol.effectiveBondPct ?? 0);
    const eqGapPct = Math.round(
      (hol.targetEquityPct ?? 80) - (hol.effectiveEquityPct ?? 0),
    );
    const mixDeltaText =
      Math.abs(eqGapPct) <= 3
        ? "On target"
        : eqGapPct > 0
          ? "+" + eqGapPct + "% Eq needed"
          : "+" + -eqGapPct + "% Bond needed";

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
    } else if (paycheck.liquidPool > 0 || paycheck.srsMo > 0) {
      const parts = [];
      if (paycheck.globalEqMo > 0)
        parts.push(fmtSgd(paycheck.globalEqMo) + " Global");
      if (paycheck.sgEqMo > 0) parts.push(fmtSgd(paycheck.sgEqMo) + " SG");
      if (paycheck.ssbMo > 0) parts.push(fmtSgd(paycheck.ssbMo) + " SSB");
      if (paycheck.srsMo > 0) parts.push(fmtSgd(paycheck.srsMo) + " SRS");
      monthlySplitValue = parts.join(" · ") || fmtSgd(0) + "/mo";
    }

    const actionRows = [
      {
        label: "1 · HYSA Buffer",
        tag: "Today · 6–12m",
        value:
          fmtSgd(guide?.emergencyMin ?? r.todaySpend * 6) +
          "–" +
          fmtSgd(guide?.emergencyMax ?? r.todaySpend * 12),
      },
      {
        label: "2 · Holistic Mix (" + targetEqPct + "/" + targetBondPct + ")",
        tag: effEqPct + "% Eq · " + effBondPct + "% Bond",
        value: mixDeltaText,
      },
      {
        label: "3 · Monthly Split",
        tag: r.retiringNow ? "Future saving" : "Invest / mo",
        value: monthlySplitValue,
      },
      {
        label: "4 · Tax Relief (" + marginalPct + ")",
        tag: "IRAS tier",
        value: taxActionValue,
      },
      {
        label: "5 · Age-" + retireAge + " Target",
        tag: "Today’s $",
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
      cpfAtRetire,
      projectedAtRetire,
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
      actionRows,
      customSavingNote: hasCustomSaving
        ? "Custom input active: " +
          fmtSgd(simulation?.cpfExtra || 0) +
          " extra CPF + " +
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
    return {
      asOf: "Nov 2026",
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

  const CASH_PARKING_CATALOG = resolveCashParkingCatalog();

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
      Number(summary?.todaySpend || 2800),
    );
    const emergencyMin = Math.round(
      guide?.emergencyMin ?? emergencyMonthlyBase * 6,
    );
    const emergencyMax = Math.round(
      guide?.emergencyMax ?? emergencyMonthlyBase * 12,
    );
    const buckets = resolvePortfolioBuckets(params);
    const currentCash = Math.round(Math.max(0, buckets.ssbCash || 0));
    const monthlyCashSlice = summary?.retiringNow
      ? 0
      : Math.round(
          Math.max(0, Number(bogle?.monthlyRebalance?.buyBondMonthly || 0)),
        );
    const hasSrs =
      Number(params?.srs || 0) > 0 || Number(params?.srsAnnual || 0) > 0;

    let positionTone = "good";
    let positionHeadline = "Fits inside 1 HYSA ($100k SDIC)";
    let positionNote =
      "Your current cash fits comfortably within one bank’s $100k SDIC insurance limit.";

    if (currentCash <= 0) {
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
      positionHeadline = "Fits inside 1 HYSA ($100k SDIC)";
      positionNote =
        currentCash > emergencyMax
          ? "Emergency buffer covered; any surplus above 12 months can shift into SSB ($200k cap) or T-Bills."
          : "Emergency buffer covered inside a single $100k SDIC-insured bank.";
    } else if (currentCash <= C.sdicCap + C.ssbCap) {
      positionTone = "info";
      positionHeadline = "Split across HYSA + SSB ($200k cap)";
      positionNote =
        "Cash exceeds one $100k SDIC bank cap. Keep emergency cash in HYSA/digital ($100k/bank) and park surplus in SSB (up to $200k) or T-Bills.";
    } else {
      positionTone = "info";
      positionHeadline = "Layer Multi-Bank + SSB + T-Bills/MMF";
      positionNote =
        "Cash exceeds 1 bank ($100k SDIC) + full SSB ($200k). Split across multiple SDIC banks, MAS T-Bills, or SGD MMFs.";
    }

    const tier1Alloc = Math.min(currentCash, C.sdicCap);
    const afterTier1 = Math.max(0, currentCash - tier1Alloc);
    const tier2Alloc = Math.min(afterTier1, C.ssbCap);
    const tier3Alloc = Math.max(0, afterTier1 - tier2Alloc);

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
      emergencyMonthlyBase,
      emergencyMin,
      emergencyMax,
      currentCash,
      monthlyCashSlice,
      hasSrs,
      positionTone,
      positionHeadline,
      positionNote,
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

  function generateTrajectory(p, selectedKey = "salary") {
    return simulate(p, selectedKey);
  }

  const api = {
    C,
    DEMO_PLAN,
    computeAgeFromDob,
    defaultDobForAge,
    computeHousingPayment,
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
    EXPENSE_CATEGORIES,
    defaultExpenseItems,
    scaleExpenseItems,
    expensePlan,
    careTotals,
    healthShieldMonthlyAtAge,
    insuranceCurveLevelAtAge,
    expenseAt,
    referencePayout,
    portfolioTarget,
    calculate,
    paycheckAllocation,
    DEFAULT_MAS_LIVE_RATES,
    CASH_PARKING_CATALOG,
    resolveCashParkingCatalog,
    cashParkingPlan,
    buildPrintReportModel,
    generateTrajectory,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.RetirementModel = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
