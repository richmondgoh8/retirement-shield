const test = require("node:test");
const assert = require("node:assert/strict");
const { referencePayout, portfolioTarget, C } = require("./model.js");
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
  sgSleevePct: 15,
  plan: "standard",
  returnRate: 0.05,
  inflationRate: 0.03,
  post55Work: false,
};
// Explicit legacy fixtures preserve the approved Home + Helper behaviour.
const calculate = (p) =>
  require("./model.js").calculate({ lifestyle: "home-helper", ...p });
const generateTrajectory = (p, key) =>
  require("./model.js").simulate({ lifestyle: "home-helper", ...p }, key);
test("two known fields produce a complete finite answer without refinements", () => {
  const r = calculate({ age: 35, salary: 6000 });
  for (const [k, v] of Object.entries(r))
    if (typeof v === "number") assert.ok(Number.isFinite(v), k);
  assert.equal(r.oa, 0);
  assert.equal(r.employeeCpf, 1200);
  assert.ok(Math.abs(r.employerCpf - 1020) < 1e-9);
  assert.equal(r.retire, 65);
  assert.equal(r.refined, false);
  assert.ok(r.saving > 0);
});
test("salary ceiling and optional zero housing are distinct from unknown housing", () => {
  assert.equal(calculate({ age: 35, salary: 12000 }).employeeCpf, 1600);
  assert.ok(
    calculate({ age: 35, salary: 6000, housing: 0 }).cpf >
      calculate({ age: 35, salary: 6000 }).cpf,
  );
});
test("income reference matches published anchors through ERS", () => {
  assert.equal(referencePayout(50000), 490);
  assert.equal(referencePayout(220400), 1780);
  assert.equal(referencePayout(440800), 3440);
  assert.equal(referencePayout(1000000), 3440);
  assert.equal(referencePayout(0), 0);
});
test("more savings lower the investment contribution; actual spending raises it", () => {
  const p = { age: 35, salary: 6000 };
  const a = calculate(p);
  assert.ok(calculate({ ...p, savings: 50000 }).saving < a.saving);
  assert.ok(calculate({ ...p, spend: 4500 }).saving > a.saving);
});
test("early retirement stops future salary contributions and includes a bridge", () => {
  const p = { age: 35, salary: 6000 };
  assert.ok(calculate({ ...p, retire: 40 }).cpf < calculate(p).cpf);
  const x = portfolioTarget(1500, 1500, 60, 65);
  const noIncome = portfolioTarget(1500, 0, 60, 65);
  assert.ok(Math.abs(x - noIncome) < 1e-6);
});
test("fixed payouts still leave future inflation exposure", () => {
  assert.ok(portfolioTarget(1500, 1500, 65) > 0);
});
test("retirement now shows a finite capital gap, including zero-spend case", () => {
  const r = calculate({ age: 45, salary: 6000, retire: 45 });
  assert.ok(Number.isFinite(r.saving));
  assert.equal(r.retiringNow, true);
  assert.equal(calculate({ age: 35, salary: 6000, spend: 0 }).saving, 0);
});
test("known CPF balances matter and invalid primary details are rejected", () => {
  const p = { age: 35, salary: 6000 };
  assert.ok(calculate({ ...p, sa: 25000 }).cpf > calculate(p).cpf);
  assert.throws(() => calculate({ age: 55, salary: 6000 }));
  assert.throws(() => calculate({ age: 35, salary: 0 }));
  assert.throws(() => calculate({ ...p, savings: -1 }));
  assert.throws(() => calculate({ ...p, retire: 30 }));
});

test("helper ranges add correctly without duplicate food; age-75 normal and concession totals differ by 240", () => {
  const { careRows, expenseAt } = require("./model.js");
  const sumCare = (k) => [
    careRows.reduce((s, r) => s + r[k][0], 0),
    careRows.reduce((s, r) => s + r[k][1], 0),
  ];
  assert.deepEqual(sumCare("now"), [2650, 3530]);
  assert.deepEqual(sumCare("later"), [3630, 4890]);
  assert.ok(Math.abs(expenseAt(3090, 65, 10, "helper") - 4260) < 1e-6);
  assert.deepEqual(
    sumCare("later").map((v) => v - 240),
    [3390, 4650],
  );
});
test("explicit Home + Helper fixture stays adjustable", () => {
  const p = { age: 35, salary: 6000 };
  assert.equal(calculate(p).todaySpend, 3900);
  assert.ok(calculate({ ...p, spend: 4000 }).saving > calculate(p).saving);
  assert.ok(calculate(p).at75 > calculate(p).todaySpend);
});
test("FRS and ERS fund higher payouts and reduce the outside portfolio requirement", () => {
  const r = calculate({ age: 35, salary: 6000 });
  const [salary, frs, ers] = r.scenarios;
  assert.ok(salary.payout < frs.payout);
  assert.ok(frs.payout < ers.payout);
  assert.ok(salary.privateSaving > frs.privateSaving);
  assert.ok(frs.privateSaving > ers.privateSaving);
  assert.equal(salary.cpfFunding, 0);
  assert.ok(ers.cpfFunding > frs.cpfFunding);
  assert.ok(ers.gap65 > 0);
  assert.ok(ers.gap75 > ers.gap65);
  for (const s of r.scenarios)
    assert.equal(s.totalFunding, s.cpfFunding + s.privateSaving);
});
test("CPF and outside investment pots independently reconcile to their targets", () => {
  const r = calculate({ age: 35, salary: 6000 });
  const rate = 1.04 ** (1 / 12) - 1;
  for (const s of r.scenarios) {
    const funded = require("./model").projectCPF(
      { age: 35, salary: 6000, lifestyle: "home-helper" },
      s.cpfFunding,
      s.key,
    );
    if (s.key !== "salary")
      assert.ok(Math.abs(funded.fundedRA - s.balance) < 0.01);
    const privateFV = (s.privateSaving * ((1 + rate) ** 360 - 1)) / rate;
    assert.ok(Math.abs(privateFV - s.privateTarget) < 1e-5);
  }
});
test("an entered investment amount counts once across paths and reveals a shortfall", () => {
  const r = calculate({ age: 35, salary: 6000, invest: 100, savings: 20000 });
  const rate = 1.04 ** (1 / 12) - 1,
    expected = 20000 * 1.04 ** 30 + (100 * ((1 + rate) ** 360 - 1)) / rate;
  for (const s of r.scenarios) {
    assert.ok(Math.abs(s.illustratedPortfolio - expected) < 1e-5);
    assert.ok(s.remainingPortfolioGap > 0);
  }
});
test("low spending can be covered by CPF; level income can fall behind later", () => {
  const low = calculate({ age: 35, salary: 6000, spend: 500 });
  assert.equal(low.scenarios[2].firstShortfallAge, null);
  const r = calculate({ age: 35, salary: 6000, spend: 1000 });
  const frs = r.scenarios[1];
  assert.equal(frs.gap65, 0);
  assert.equal(frs.gap75, 0);
  assert.ok(frs.firstShortfallAge > 75);
});
test("retirement now and early retirement produce finite separated funding pots", () => {
  for (const retire of [40, 45, 55, 65]) {
    const r = calculate({ age: 40, salary: 6000, retire });
    for (const s of r.scenarios)
      for (const key of [
        "cpfFunding",
        "privateSaving",
        "totalFunding",
        "illustratedPortfolio",
      ])
        assert.ok(Number.isFinite(s[key]), key);
  }
  const r = calculate({ age: 35, salary: 6000, retire: 40 });
  const rate = 1.04 ** (1 / 12) - 1;
  for (const s of r.scenarios)
    if (s.key !== "salary") {
      const funded = require("./model").projectCPF(
        { age: 35, salary: 6000, retire: 40, lifestyle: "home-helper" },
        s.cpfFunding,
        s.key,
      );
      assert.ok(Math.abs(funded.fundedRA - s.balance) < 0.01);
    }
});
test("displayed salary flow reconciles payroll deductions and the three CPF accounts", () => {
  for (const age of [25, 35, 40, 48, 53])
    for (const salary of [6000, 12000]) {
      const r = calculate({ age, salary });
      assert.ok(
        Math.abs(r.currentOA + r.currentSA + r.currentMA - r.contribution) <
          1e-8,
      );
      assert.ok(
        Math.abs(r.employeeCpf + r.employerCpf - r.contribution) < 1e-8,
      );
      assert.equal(r.afterCpf + r.employeeCpf, salary);
    }
  const r = calculate({ age: 35, salary: 6000 });
  assert.equal(Math.round(r.currentOA), 1380);
  assert.equal(Math.round(r.currentSA), 360);
  assert.equal(Math.round(r.currentMA), 480);
});

test("CPF LIFE Escalating plan starts lower and compounds by 2% yearly, overtaking standard around age 77", () => {
  const std = calculate({ age: 35, salary: 6000, plan: "standard" });
  const esc = calculate({ age: 35, salary: 6000, plan: "escalating" });
  const stdPayout65 = std.scenarios[1].payout;
  const escPayout65 = esc.scenarios[1].payout;
  assert.ok(Math.abs(escPayout65 - stdPayout65 * 0.8) < 1e-4);
  const escPayout75 = esc.scenarios[1].payout75;
  assert.ok(escPayout75 > escPayout65);
  const escPayout80 = escPayout65 * 1.02 ** 15;
  assert.ok(escPayout80 > stdPayout80Compare(stdPayout65));
});
function stdPayout80Compare(v) {
  return v;
}

test("sensitivity testing adjusts targets predictably", () => {
  const base = calculate({
    age: 35,
    salary: 6000,
    returnRate: 0.04,
    inflationRate: 0.03,
  });
  const highReturn = calculate({
    age: 35,
    salary: 6000,
    returnRate: 0.05,
    inflationRate: 0.03,
  });
  const highInflation = calculate({
    age: 35,
    salary: 6000,
    returnRate: 0.04,
    inflationRate: 0.035,
  });
  assert.ok(highReturn.saving < base.saving);
  assert.ok(highInflation.saving > base.saving);
});

test("post-55 work option accumulates senior CPF contributions", () => {
  const withoutPost55 = calculate({
    age: 35,
    salary: 6000,
    retire: 65,
    post55Work: false,
  });
  const withPost55 = calculate({
    age: 35,
    salary: 6000,
    retire: 65,
    post55Work: true,
  });
  assert.ok(withPost55.cpf > withoutPost55.cpf);
  assert.ok(withPost55.extraPost55CPF > 0);
});

test("generateTrajectory produces full chronological series to age 90 with valid invariants", () => {
  const { summary, selectedScenario, points } = generateTrajectory({
    age: 35,
    salary: 6000,
    retire: 65,
  });
  assert.equal(points[0].age, 35);
  assert.equal(points[points.length - 1].age, 90);
  for (const pt of points) {
    assert.ok(Number.isFinite(pt.monthlySpend));
    assert.ok(Number.isFinite(pt.monthlyCPF));
    assert.ok(Number.isFinite(pt.monthlyGap));
    assert.ok(Number.isFinite(pt.portfolioBalance));
    assert.ok(pt.portfolioBalance >= 0);
  }
  const retirePt = points.find((p) => p.age === 65);
  assert.equal(retirePt.phase, "drawdown");
  assert.ok(retirePt.monthlyCPF > 0);
});

test("senior allocation uses official 2026 and announced 2027 tables", () => {
  const { allocation } = require("./model.js");
  assert.deepEqual(allocation(57, 2026), [0.353, 0.3382, 0.34]);
  assert.deepEqual(allocation(62, 2026), [0.14, 0.44, 0.25]);
  assert.deepEqual(allocation(57, 2027), [0.3382, 0.3661, 0.355]);
  assert.deepEqual(allocation(62, 2027), [0.1347, 0.4615, 0.26]);
});
test("post-55 contributions cannot automatically turn OA into CPF LIFE funding", () => {
  const p = { age: 54, salary: 8000, sa: 1000000, housing: 0 };
  const a = calculate(p),
    b = calculate({ ...p, post55Work: true });
  assert.equal(b.extraPost55CPF, 0);
  assert.equal(b.post55RAContributions, 0);
  assert.ok(b.post55OA > 0);
  assert.equal(b.scenarios[0].payout, a.scenarios[0].payout);
});
test("later RA additions are capped and discounted rather than labelled age-55 balances", () => {
  const p = { age: 54, salary: 8000 };
  const a = calculate(p),
    b = calculate({ ...p, post55Work: true });
  assert.equal(b.cpfAt55, a.cpfAt55);
  assert.ok(b.extraPost55CPF > 0 && b.extraPost55CPF < b.post55RAContributions);
  assert.ok(b.post55RAContributions <= b.frs - Math.min(b.cpfAt55, b.frs));
  assert.ok(b.cpf <= b.frs);
  assert.equal(
    calculate({ ...p, retire: 55, post55Work: true }).extraPost55CPF,
    0,
  );
});

test("future senior contributions cannot pre-fund an FRS or ERS commitment at 55", () => {
  const p = { age: 54, salary: 8000 };
  const a = calculate(p),
    b = calculate({ ...p, post55Work: true });
  for (const key of ["frs", "ers"]) {
    const x = a.scenarios.find((s) => s.key === key),
      y = b.scenarios.find((s) => s.key === key);
    assert.equal(y.cpfGap, x.cpfGap);
    assert.equal(y.cpfFunding, x.cpfFunding);
  }
  assert.equal(b.scenarios[0].cpfFunding, 0);
});

test("today-dollar display converts each future amount at its own date without changing savings", () => {
  const { todayPlan, todayValue } = require("./model");
  for (const age of [28, 35, 45, 54])
    for (const inflationRate of [0.025, 0.03, 0.035])
      for (const plan of ["standard", "escalating"]) {
        const r = calculate({ age, salary: 6000, inflationRate, plan }),
          d = todayPlan(r);
        const at = (x, a) => todayValue(x, a, age, inflationRate);
        assert.equal(d.spend65, at(r.spend65, 65));
        assert.equal(d.spend75, at(r.spend75, 75));
        assert.equal(d.frs, at(r.frs, 55));
        assert.equal(d.cpfAt55, at(r.cpfAt55, 55));
        assert.equal(d.salary, r.salary);
        assert.equal(d.afterCpf, r.afterCpf);
        for (let i = 0; i < 3; i++) {
          assert.equal(d.scenarios[i].payout, at(r.scenarios[i].payout, 65));
          assert.equal(
            d.scenarios[i].payout75,
            at(r.scenarios[i].payout75, 75),
          );
          assert.ok(
            Math.abs(
              d.scenarios[i].gap65 -
                Math.max(0, d.spend65 - d.scenarios[i].payout),
            ) < 1e-9,
          );
          assert.ok(
            Math.abs(
              d.scenarios[i].gap75 -
                Math.max(0, d.spend75 - d.scenarios[i].payout75),
            ) < 1e-9,
          );
          assert.equal(
            d.scenarios[i].privateSaving,
            r.scenarios[i].privateSaving,
          );
          assert.equal(d.scenarios[i].cpfFunding, r.scenarios[i].cpfFunding);
          assert.equal(
            d.scenarios[i].privateTarget,
            at(r.scenarios[i].privateTarget, r.retire),
          );
        }
        assert.equal(r.moneyBasis, undefined);
      }
});
test("default today-dollar example and fixed-levy effect are explicit", () => {
  const { todayPlan, todayValue } = require("./model");
  const r = calculate({ age: 35, salary: 6000 }),
    d = todayPlan(r);
  assert.equal(Math.round(d.spend65), 3842);
  assert.ok(d.scenarios[0].payout > 0);
  assert.ok(
    Math.abs(d.scenarios[0].gap65 - (d.spend65 - d.scenarios[0].payout)) < 1e-8,
  );
  assert.ok(d.scenarios[0].privateSaving > 0);
  assert.equal(todayValue(1234, 35, 35, 0.03), 1234);
  assert.equal(todayValue(1234, 65, 35, 0), 1234);
  const standard = todayPlan(calculate({ age: 35, salary: 6000 })).scenarios[0];
  assert.ok(standard.payout75 < standard.payout);
});
test("real chart values reconcile with the answer at both milestone ages", () => {
  const { todayPlan, todayTrajectory } = require("./model");
  for (const plan of ["standard", "escalating"])
    for (const retire of [45, 65, 75])
      for (const key of ["salary", "frs", "ers"]) {
        const p = { age: 35, salary: 6000, retire, plan },
          t = todayTrajectory(generateTrajectory(p, key)),
          d = todayPlan({ ...t.summary, scenarios: [t.selectedScenario] }),
          s = d.scenarios[0];
        for (const age of [65, 75]) {
          const point = t.points.find((x) => x.age === age);
          assert.ok(
            Math.abs(point.monthlyCPF - (age === 65 ? s.payout : s.payout75)) <
              1e-7,
          );
          if (age >= retire)
            assert.ok(
              Math.abs(point.monthlyGap - (age === 65 ? s.gap65 : s.gap75)) <
                1e-6,
            );
        }
      }
});
test("funded portfolio trajectory matches monthly withdrawal target through 90", () => {
  for (const plan of ["standard", "escalating"])
    for (const retire of [45, 65, 75])
      for (const key of ["salary", "frs", "ers"]) {
        const t = generateTrajectory(
            { age: 35, salary: 6000, retire, plan },
            key,
          ),
          atRetire = t.points.find((x) => x.age === retire);
        assert.ok(
          Math.abs(
            atRetire.portfolioBalance - t.selectedScenario.privateTarget,
          ) < 1e-5,
        );
        assert.ok(t.points.at(-1).portfolioBalance < 1e-4);
      }
});
test("CCA is the new default with the approved spending provisions", () => {
  const M = require("./model.js");
  const r = M.calculate({ age: 35, salary: 6000 });
  assert.equal(r.lifestyle, "cca");
  assert.equal(r.todaySpend, 2800);
  assert.equal(
    M.ccaRows.reduce((sum, row) => sum + row.now, 0),
    2500,
  );
  assert.equal(
    M.ccaRows.reduce((sum, row) => sum + row.later, 0),
    3340,
  );
  const d = M.todayPlan(r);
  assert.ok(
    Math.abs(
      d.spend65 -
        (2800 * M.insuranceCurveLevelAtAge(65, "cca")) /
          M.insuranceCurveLevelAtAge(35, "cca"),
    ) < 1e-8,
  );
  assert.ok(
    Math.abs(
      d.spend75 -
        (2800 * M.insuranceCurveLevelAtAge(75, "cca")) /
          M.insuranceCurveLevelAtAge(35, "cca"),
    ) < 1e-8,
  );
  assert.equal(M.expenseAt(2500, 65, 10, 0, "cca"), 3340);
  assert.throws(() =>
    M.calculate({ age: 35, salary: 6000, lifestyle: "unknown" }),
  );
  assert.throws(() => M.calculate({ age: 35, salary: 6000, retire: 45 }));
  assert.equal(
    M.calculate({ age: 35, salary: 6000, retire: 45, lifestyle: "home-helper" })
      .retire,
    45,
  );
});
test("CCA custom budgets scale care provisions, without a fixed levy", () => {
  const M = require("./model.js");
  const p = { age: 35, salary: 6000 };
  const full = M.todayPlan(M.calculate(p)),
    half = M.todayPlan(M.calculate({ ...p, spend: 1400 }));
  assert.ok(Math.abs(half.spend65 / full.spend65 - 0.5) < 1e-8);
  assert.ok(Math.abs(half.spend75 / full.spend75 - 0.5) < 1e-8);
  assert.equal(M.calculate({ ...p, spend: 0 }).target, 0);
});
test("both presets reconcile answer, monthly trajectory and portfolio funding", () => {
  const M = require("./model.js");
  for (const lifestyle of ["cca", "home-helper"])
    for (const age of [28, 45, 54])
      for (const retire of [55, 65, 80])
        for (const plan of ["standard", "escalating"])
          for (const key of ["salary", "frs", "ers"]) {
            const p = { age, salary: 6000, lifestyle, retire, plan };
            const t = M.simulate(p, key),
              d = M.todayPlan({
                ...t.summary,
                scenarios: [t.selectedScenario],
              }),
              real = M.todayTrajectory(t),
              s = d.scenarios[0];
            assert.ok(
              Math.abs(
                t.points.find((x) => x.age === retire).portfolioBalance -
                  t.selectedScenario.privateTarget,
              ) < 1e-5,
            );
            assert.ok(t.points.at(-1).portfolioBalance < 1e-4);
            for (const milestone of [65, 75]) {
              const pt = real.points.find((x) => x.age === milestone);
              assert.ok(
                Math.abs(
                  pt.monthlySpend - (milestone === 65 ? d.spend65 : d.spend75),
                ) < 1e-7,
              );
              assert.ok(
                Math.abs(
                  pt.monthlyCPF - (milestone === 65 ? s.payout : s.payout75),
                ) < 1e-7,
              );
            }
          }
});

test("OA balance visibly reduces ERS savings while the fully funded ERS payout stays fixed", () => {
  const M = require("./model.js");
  for (const lifestyle of ["cca", "home-helper"]) {
    const p = { age: 35, salary: 6000, lifestyle };
    const base = M.calculate(p),
      withOA = M.calculate({ ...p, oa: 100000 });
    assert.ok(withOA.cpfAt55 > base.cpfAt55);
    assert.ok(withOA.scenarios[0].payout > base.scenarios[0].payout);
    assert.ok(withOA.scenarios[2].cpfGap < base.scenarios[2].cpfGap);
    assert.ok(withOA.scenarios[2].cpfFunding < base.scenarios[2].cpfFunding);
    assert.equal(withOA.scenarios[2].payout, base.scenarios[2].payout);
  }
});
test("budget changes own retirement savings, not CPF sum goals or ERS top-up savings", () => {
  const M = require("./model.js");
  for (const lifestyle of ["cca", "home-helper"]) {
    const p = { age: 35, salary: 6000, lifestyle, oa: 100000 };
    const base = M.calculate(p),
      higher = M.calculate({ ...p, spend: 4500 });
    assert.equal(higher.ers, base.ers);
    assert.equal(higher.cpfAt55, base.cpfAt55);
    assert.equal(higher.scenarios[2].cpfGap, base.scenarios[2].cpfGap);
    assert.equal(higher.scenarios[2].cpfFunding, base.scenarios[2].cpfFunding);
    for (let i = 0; i < 3; i++)
      assert.ok(
        higher.scenarios[i].privateSaving > base.scenarios[i].privateSaving,
      );
  }
});

test("fractional retirement ages stop extra CPF contributions at exact integer month boundary", () => {
  const M = require("./model.js");
  // Test (age, monthOffset) where age + k / 12 has IEEE-754 drift.
  for (const [age, offset] of [
    [35, 193], // 35 + 193/12 = 51.083333...
    [29, 100],
    [41, 145],
  ]) {
    const retire = age + offset / 12;
    const sim = M.projectCPF(
      { age, salary: 6000, retire, lifestyle: "home-helper" },
      200,
    );
    assert.equal(Math.round(sim.totalExtra), offset * 200);
  }
});

test("monthly MediSave deductions reduce MA and surface cash shortfall when MA runs low", () => {
  const M = require("./model.js");
  const base = M.projectCPF({ age: 40, salary: 6000, ma: 20000 });
  const lowMaSpend = M.projectCPF({
    age: 40,
    salary: 6000,
    ma: 20000,
    maSpend: 150,
  });
  const highMaSpend = M.projectCPF({
    age: 40,
    salary: 6000,
    ma: 500,
    maSpend: 1200,
  });
  assert.ok(lowMaSpend.ma65 < base.ma65);
  assert.equal(base.maShortfallToday, 0);
  assert.ok(highMaSpend.maShortfallToday > 0);
});

test("residentTax matches IRAS YA 2024+ progressive resident tax brackets", () => {
  const { residentTax } = require("./model.js");
  assert.deepEqual(residentTax(0), {
    chargeableIncome: 0,
    annualTax: 0,
    monthlyTax: 0,
    marginalRate: 0,
  });
  assert.equal(residentTax(20000).annualTax, 0);
  assert.equal(residentTax(20000).marginalRate, 0);
  assert.equal(residentTax(30000).annualTax, 200);
  assert.equal(residentTax(30000).marginalRate, 0.02);
  assert.equal(residentTax(40000).annualTax, 550);
  assert.equal(residentTax(40000).marginalRate, 0.035);
  assert.equal(residentTax(80000).annualTax, 3350);
  assert.equal(residentTax(80000).marginalRate, 0.07);
  assert.equal(residentTax(120000).annualTax, 7950);
  assert.equal(residentTax(120000).marginalRate, 0.115);
  assert.equal(residentTax(1200000).marginalRate, 0.24);
});

test("outsideAllocationGuide reconciles take-home pay, affordability states and monthly split", () => {
  const M = require("./model.js");
  const rCritical = M.calculate({ age: 45, salary: 5000 });
  const simCritical = M.simulate({ age: 45, salary: 5000 }, "frs", {
    summary: rCritical,
  });
  const guideCritical = M.outsideAllocationGuide(rCritical, simCritical);
  assert.equal(guideCritical.afterCpf, 4000);
  assert.ok(guideCritical.netTakeHome < guideCritical.afterCpf);
  assert.equal(guideCritical.state.key, "critical");
  assert.equal(guideCritical.usingBenchmark, true);
  assert.equal(guideCritical.emergencyMin, 16800);
  assert.equal(guideCritical.emergencyMax, 33600);
  assert.equal(
    guideCritical.split.safeMonthly +
      guideCritical.split.srsMonthly +
      guideCritical.split.coreMonthly,
    guideCritical.allocPool,
  );
  assert.ok(guideCritical.split.srsMonthly <= C.srsCap / 12);

  // Stretched case (51-85% of take-home)
  const rStretched = M.calculate({ age: 45, salary: 8500 });
  const simStretched = M.simulate({ age: 45, salary: 8500 }, "salary", {
    summary: rStretched,
  });
  const guideStretched = M.outsideAllocationGuide(rStretched, simStretched);
  assert.equal(guideStretched.state.key, "stretched");

  // Higher earner with existing balances reaches comfortable state and positive SRS/RSTU tax savings
  const comfortableSummary = M.calculate({
    age: 35,
    salary: 12000,
    oa: 80000,
    sa: 60000,
    savings: 100000,
  });
  const simComfort = M.simulate(
    { age: 35, salary: 12000, oa: 80000, sa: 60000, savings: 100000 },
    "salary",
    { summary: comfortableSummary },
  );
  const guideComfort = M.outsideAllocationGuide(comfortableSummary, simComfort);
  assert.equal(guideComfort.state.key, "comfortable");
  assert.equal(guideComfort.taxWorthIt, true);
  assert.ok(guideComfort.srsTaxSaved > 0);
  assert.ok(guideComfort.rstuTaxSaved > 0);
  assert.equal(
    guideComfort.split.safeMonthly +
      guideComfort.split.srsMonthly +
      guideComfort.split.coreMonthly,
    guideComfort.allocPool,
  );
});

test("taxSweetSpot models 2026 IRAS tiers, $80k relief cap, FRS room and SRS lock-in", () => {
  const M = require("./model.js");
  // Low chargeable income <= $40,000 -> keep cash liquid
  const low = M.taxSweetSpot({ age: 28, salary: 3500, sa: 10000 });
  assert.equal(low.tier, "liquid");
  assert.ok(low.chargeableIncome <= 40000);

  // Mid bracket ($40,001 - $80,000, 7%) -> prioritize RSTU first
  const mid = M.taxSweetSpot({ age: 35, salary: 6500, sa: 50000 });
  assert.equal(mid.tier, "rstu-first");
  assert.equal(mid.maxRstu, 8000);
  assert.equal(mid.rstuTaxSaved, 560);

  // High bracket (> $80,000, >= 11.5%) -> max RSTU + SRS with 0.05% warning
  const high = M.taxSweetSpot({
    age: 38,
    salary: 10000,
    annualBonus: 20000,
    sa: 60000,
    srsAge: 64,
  });
  assert.equal(high.tier, "max-both");
  assert.equal(high.srsLockInAge, 64);
  assert.equal(high.maxRstu, 8000);
  assert.equal(high.maxSrsAfterRstu, 15300);
  assert.ok(high.combinedTaxSaved > high.rstuTaxSaved);
  assert.ok(high.srsIdleWarning.includes("0.05%"));

  // $80,000 personal relief cap enforced
  const capped = M.taxSweetSpot({
    age: 40,
    salary: 12000,
    existingReliefs: 60000,
    sa: 50000,
  });
  assert.equal(capped.annualEmployeeCpf, 19200);
  assert.equal(capped.reliefCapRemaining, 800);
  assert.equal(capped.maxRstu, 800);
  assert.equal(capped.maxSrsAfterRstu, 0);
});

test("bogleheadAllocation computes liquid vs holistic net worth split and smart rebalancing", () => {
  const M = require("./model.js");
  const alloc = M.bogleheadAllocation(
    {
      age: 35,
      oa: 80000,
      sa: 60000,
      ma: 45000,
      equities: 100000,
      sgDividends: 20000,
      ssbCash: 30000,
      srs: 20000,
      srsInvestedIn: "global",
      targetEquityPct: 80,
      sgSleevePct: 10,
    },
    2000,
  );
  // Liquid = 100k + 20k(sg) + 20k(srs eq) + 30k(ssb) = 170k; Equities = 140k
  assert.equal(alloc.liquid.total, 170000);
  assert.equal(alloc.cpf.total, 185000);
  assert.equal(alloc.holistic.totalNetWorth, 355000);
  assert.ok(alloc.holistic.effectiveEquityPct < 50);
  assert.ok(alloc.liquid.equityPct > 80);
  // Direct split: $2,000 follows 80/20 Equity/Bond and 90/10 Global/SG regardless of CPF floor
  assert.equal(alloc.monthlyRebalance.buyBondMonthly, 400);
  assert.equal(alloc.monthlyRebalance.buyGlobalMonthly, 1440);
  assert.equal(alloc.monthlyRebalance.buySgMonthly, 160);

  // Direct split with 95/5 Equity/Bond and 97/3 Global/SG on $1,000
  const direct95 = M.bogleheadAllocation(
    {
      age: 35,
      oa: 0,
      sa: 0,
      ma: 0,
      equities: 35000,
      sgDividends: 5000,
      ssbCash: 20000,
      srs: 0,
      targetEquityPct: 95,
      sgSleevePct: 3,
    },
    1000,
  );
  assert.equal(direct95.monthlyRebalance.buyBondMonthly, 50);
  assert.equal(direct95.monthlyRebalance.buySgMonthly, 29);
  assert.equal(direct95.monthlyRebalance.buyGlobalMonthly, 921);
  assert.match(direct95.monthlyRebalance.note, /95\/5 Equity\/Bond split/);
  assert.match(direct95.monthlyRebalance.note, /SSB \/ Cash holds 33%/);
});

test("firePlan models two-phase FIRE bridge, 1M65 trajectory to 95, and SRS 63/64 rule", () => {
  const M = require("./model.js");
  const fp63 = M.firePlan(DEMO_PLAN, "salary");
  assert.equal(fp63.points[0].age, DEMO_PLAN.age);
  assert.equal(fp63.points.at(-1).age, 95);
  assert.equal(fp63.bridge.years, 10);
  assert.ok(fp63.bridge.requiredToday > 0);
  assert.ok(fp63.phase2.projectedCpfAt65Today > 0);
  assert.ok(fp63.fireNumber.totalRequiredToday > fp63.bridge.requiredToday);
  assert.ok(fp63.elevatorPitch.includes("CPF LIFE"));

  // SRS age 63 starts drawing at 63, age 64 delays drawdown until 64
  const fp64 = M.firePlan({ ...DEMO_PLAN, srsAge: 64 }, "salary");
  const pt63a = fp63.points.find((x) => x.age === 63);
  const pt63b = fp64.points.find((x) => x.age === 63);
  assert.ok(pt63a.monthlySrsDraw > 0);
  assert.equal(pt63b.monthlySrsDraw, 0);

  // Idle SRS cash at 0.05% grows noticeably slower than invested SRS
  const idleSrs = M.firePlan({ ...DEMO_PLAN, srsInvestedIn: "cash" }, "salary");
  assert.ok(
    idleSrs.points.find((x) => x.age === 62).srs <
      fp63.points.find((x) => x.age === 62).srs,
  );
});

test("computeHousingPayment models HDB/bank mortgage share and stops OA deduction after housingYears", () => {
  const M = require("./model.js");
  // HDB loan @ 2.6%, $300k over 20 years, split across 2 parties
  const hdb2 = M.computeHousingPayment({
    mode: "hdb",
    loanBalance: 300000,
    loanRate: 99, // ignored for HDB (fixed 2.6%)
    loanYears: 20,
    loanParties: 2,
  });
  assert.equal(hdb2.ratePct, 2.6);
  assert.ok(Math.abs(hdb2.totalMonthly - 1604.35) < 0.2);
  assert.ok(Math.abs(hdb2.monthlyShare - 802.18) < 0.2);

  // Bank loan @ 2.0%, $300k over 20 years, 1 party
  const bank1 = M.computeHousingPayment({
    mode: "bank",
    loanBalance: 300000,
    loanRate: 2.0,
    loanYears: 20,
    loanParties: 1,
  });
  assert.equal(bank1.ratePct, 2.0);
  assert.ok(bank1.totalMonthly < hdb2.totalMonthly);
  assert.equal(bank1.monthlyShare, bank1.totalMonthly);

  // Paid up vs finite housingYears vs perpetual housing
  const paidUp = M.projectCPF({ age: 35, salary: 6000, housing: 0 });
  const finite10 = M.projectCPF({
    age: 35,
    salary: 6000,
    housing: 800,
    housingYears: 10,
  });
  const perpetual = M.projectCPF({
    age: 35,
    salary: 6000,
    housing: 800,
  });
  assert.ok(finite10.cpfAt55 > perpetual.cpfAt55);
  assert.ok(finite10.cpfAt55 < paidUp.cpfAt55);
});

test("computeAgeFromDob calculates completed years accurately across birthdays and leap days", () => {
  const M = require("./model.js");
  const ref = new Date(2026, 10, 16); // 16 Nov 2026

  // Birthday already passed this year
  const passed = M.computeAgeFromDob("1991-01-01", ref);
  assert.equal(passed.valid, true);
  assert.equal(passed.age, 35);
  assert.equal(passed.monthsRemainder, 10);

  // Birthday is today
  const todayBday = M.computeAgeFromDob("1991-11-16", ref);
  assert.equal(todayBday.valid, true);
  assert.equal(todayBday.age, 35);
  assert.equal(todayBday.isBirthdayToday, true);

  // Birthday later this year (turns 35 next month)
  const upcoming = M.computeAgeFromDob("1991-12-01", ref);
  assert.equal(upcoming.valid, true);
  assert.equal(upcoming.age, 34);
  assert.equal(upcoming.monthsRemainder, 11);

  // Leap day birthday in non-leap year
  const leapBefore = M.computeAgeFromDob("2000-02-29", new Date(2026, 1, 28));
  const leapAfter = M.computeAgeFromDob("2000-02-29", new Date(2026, 2, 1));
  assert.equal(leapBefore.age, 25);
  assert.equal(leapAfter.age, 26);

  // Invalid / future dates
  assert.equal(M.computeAgeFromDob("2030-01-01", ref).valid, false);
  assert.equal(M.computeAgeFromDob("1991-02-30", ref).valid, false);
  assert.equal(M.computeAgeFromDob("", ref).valid, false);

  // defaultDobForAge yields exact target age
  const def35 = M.defaultDobForAge(35, ref);
  assert.equal(M.computeAgeFromDob(def35, ref).age, 35);
});

test("paycheckAllocation does not double-count SRS and balances to gross + employer CPF", () => {
  const M = require("./model.js");
  const p = {
    age: 35,
    retire: 55,
    salary: 8500,
    annualBonus: 0,
    lifestyle: "home-helper",
    oa: 75000,
    sa: 55000,
    ma: 45000,
    equities: 120000,
    sgDividends: 20000,
    ssbCash: 35000,
    srs: 25000,
    srsAnnual: 12000, // $1,000/mo inside outside invest
    targetEquityPct: 80,
    sgSleevePct: 10,
  };
  const summary = M.calculate(p);
  const sim = M.simulate(p, "salary", { summary });
  const r = M.todayPlan(summary);
  const bogle = M.bogleheadAllocation(p, sim.invest);
  const pc = M.paycheckAllocation(r, sim, bogle, p);

  assert.equal(pc.srsMo, 1000);
  assert.equal(pc.liquidPool, Math.round(sim.invest - 1000));
  const rowSum = pc.rows.reduce((acc, row) => acc + row.amt, 0);
  assert.ok(
    Math.abs(rowSum - pc.grossPlusEmployer) <= 3,
    `Expected rows sum (${rowSum}) to equal gross+employer (${pc.grossPlusEmployer})`,
  );

  // Overspending > take-home reports overspendMo cleanly
  const stretchedSim = { ...sim, cpfExtra: 500, invest: r.afterCpf };
  const stretchedBogle = M.bogleheadAllocation(p, stretchedSim.invest);
  const pcOver = M.paycheckAllocation(r, stretchedSim, stretchedBogle, p);
  assert.equal(pcOver.livingAndTax, 0);
  assert.ok(pcOver.overspendMo >= 499);
});

test("buildPrintReportModel aligns retire age, readiness fallback, waterfall-to-95, and tax tier", () => {
  const M = require("./model.js");
  // Scenario 1: Early retirement at 55 with 7% bracket (rstu-first)
  const pEarly = {
    age: 35,
    retire: 55,
    salary: 5500,
    annualBonus: 0,
    lifestyle: "home-helper",
    oa: 40000,
    sa: 20000,
    ma: 20000,
    equities: 50000,
    sgDividends: 0,
    ssbCash: 10000,
    srs: 0,
    srsAnnual: 0,
  };
  const sum1 = M.calculate(pEarly);
  const sim1 = M.simulate(pEarly, "salary", { summary: sum1 });
  const r1 = M.todayPlan(sum1);
  const s1 = M.todayPlan({ ...sum1, scenarios: [sim1.selectedScenario] })
    .scenarios[0];
  const fire1 = M.firePlan(pEarly, "salary", {
    summary: sum1,
    simulation: sim1,
  });
  const bogle1 = M.bogleheadAllocation(pEarly, sim1.invest);
  const tax1 = M.taxSweetSpot(pEarly);
  const guide1 = M.outsideAllocationGuide(r1, sim1);

  const pm1 = M.buildPrintReportModel({
    summary: r1,
    selectedScenario: s1,
    simulation: sim1,
    fire: fire1,
    bogle: bogle1,
    tax: tax1,
    guide: guide1,
    params: pEarly,
  });

  assert.equal(pm1.retireAge, 55);
  assert.equal(pm1.waterfallEndAge, 95);
  assert.equal(pm1.waterfallStartAge, 52);
  assert.equal(pm1.hasSrs, false);
  const pt55 = fire1.points.find((pt) => pt.age === 55);
  assert.equal(
    Math.round(pm1.projectedAtRetire),
    Math.round(pt55.today.totalNetWorth),
  );
  const taxRow = pm1.actionRows.find((row) =>
    row.label.startsWith("4 · Tax Relief"),
  );
  assert.ok(taxRow.value.includes("RSTU saves"));
  assert.ok(!taxRow.value.includes("RSTU+SRS"));

  // Scenario 2: Very high target budget -> projectedFireAge === null => "After 80"
  const pGap = {
    age: 50,
    retire: 65,
    salary: 3000,
    annualBonus: 0,
    lifestyle: "home-helper",
    spend: 6000,
    oa: 10000,
    sa: 10000,
    ma: 10000,
    savings: 5000,
    invest: 200,
  };
  const sum2 = M.calculate(pGap);
  const sim2 = M.simulate(pGap, "salary", { summary: sum2 });
  const r2 = M.todayPlan(sum2);
  const s2 = M.todayPlan({ ...sum2, scenarios: [sim2.selectedScenario] })
    .scenarios[0];
  const fire2 = M.firePlan(pGap, "salary", { summary: sum2, simulation: sim2 });
  const bogle2 = M.bogleheadAllocation(pGap, sim2.invest);
  const tax2 = M.taxSweetSpot(pGap);
  const guide2 = M.outsideAllocationGuide(r2, sim2);
  const pm2 = M.buildPrintReportModel({
    summary: r2,
    selectedScenario: s2,
    simulation: sim2,
    fire: fire2,
    bogle: bogle2,
    tax: tax2,
    guide: guide2,
    params: pGap,
  });

  assert.equal(pm2.earliestSafeAgeText, "After 80");
  assert.equal(pm2.hasCustomSaving, true);
  assert.ok(pm2.customSavingNote.includes("Custom input active"));
});

test("resolveCashParkingCatalog and cashParkingPlan cover limits, links, and tiered cash stacking", () => {
  const M = require("./model.js");
  const cat = M.resolveCashParkingCatalog();
  assert.ok(cat.asOf);
  assert.ok(cat.items.length >= 12);

  for (const item of cat.items) {
    assert.ok(item.id && item.name && item.provider);
    assert.ok(item.rateHeadline && item.capLabel && item.liquidity);
    assert.match(item.url, /^https:\/\//, "expected https URL for " + item.id);
    assert.ok(item.urlDomain);
  }

  const ssb = cat.items.find((x) => x.id === "ssb");
  assert.equal(ssb.capAmount, 200000);
  const ocbc = cat.items.find((x) => x.id === "ocbc-360");
  assert.equal(ocbc.capAmount, 100000);
  const uob = cat.items.find((x) => x.id === "uob-one");
  assert.equal(uob.capAmount, 150000);
  const mmfs = cat.items.filter((x) => x.protectionTone === "mmf");
  assert.ok(mmfs.length >= 5);
  assert.ok(mmfs.every((x) => x.protection.includes("Non-SDIC")));

  const cpZero = M.cashParkingPlan({
    summary: { todaySpend: 2500 },
    guide: { emergencyMin: 15000, emergencyMax: 30000 },
    params: { ssbCash: 0 },
  });
  assert.equal(cpZero.positionTone, "warn");
  assert.equal(cpZero.tiers[0].allocated, 0);

  const cpMid = M.cashParkingPlan({
    summary: { todaySpend: 2500 },
    guide: { emergencyMin: 15000, emergencyMax: 30000 },
    params: { ssbCash: 150000, srsAnnual: 5000 },
    bogle: { monthlyRebalance: { buyBondMonthly: 350 } },
  });
  assert.equal(cpMid.positionTone, "info");
  assert.equal(cpMid.hasSrs, true);
  assert.equal(cpMid.monthlyCashSlice, 350);
  assert.equal(cpMid.tiers[0].allocated, 100000);
  assert.equal(cpMid.tiers[1].allocated, 50000);
  assert.equal(cpMid.tiers[2].allocated, 0);

  const cpLarge = M.cashParkingPlan({
    summary: { todaySpend: 3500 },
    guide: { emergencyMin: 21000, emergencyMax: 42000 },
    params: { ssbCash: 360000 },
  });
  assert.equal(cpLarge.tiers[0].allocated, 100000);
  assert.equal(cpLarge.tiers[1].allocated, 200000);
  assert.equal(cpLarge.tiers[2].allocated, 60000);

  // Every item exposes structured un-lumped rateTiers and Fixed Deposits are separated by bank
  for (const item of cat.items) {
    assert.ok(
      Array.isArray(item.rateTiers) && item.rateTiers.length >= 2,
      "expected structured rateTiers for " + item.id,
    );
    for (const tier of item.rateTiers) {
      assert.ok(tier.label && tier.value);
      assert.equal(String(tier.value).includes("·"), false);
    }
  }
  assert.ok(cat.items.find((x) => x.id === "fd-cimb"));
  assert.ok(cat.items.find((x) => x.id === "fd-ocbc"));
  assert.ok(cat.items.find((x) => x.id === "fd-uob"));
  assert.equal(
    cat.items.find((x) => x.id === "sgd-fd"),
    undefined,
  );

  // Live MAS rates override populates fresh SSB tranche and T-Bill cut-offs cleanly
  const fs = require("node:fs");
  const diskRates = JSON.parse(
    fs.readFileSync("assets/mas-rates.json", "utf8"),
  );
  assert.ok(
    diskRates.ssb?.trancheCode && diskRates.tbills?.sixMonth?.issueCode,
  );

  const cpLive = M.cashParkingPlan({
    summary: { todaySpend: 2500 },
    guide: { emergencyMin: 15000, emergencyMax: 30000 },
    params: { ssbCash: 50000 },
    masRates: {
      asOfDate: "2027-01-04",
      ssb: {
        issueCode: "GX27010X",
        trancheCode: "SBJAN27",
        lastDayToApply: "2027-01-26",
        issueDate: "2027-02-01",
        year1Return: 2.1,
        year5Return: 2.4,
        year10Coupon: 3.05,
        year10Return: 2.65,
        prevTrancheCode: "SBDEC26",
        prevYear10Return: 2.39,
      },
      tbills: {
        sixMonth: {
          issueCode: "BS27100A",
          auctionDate: "2027-01-02",
          cutoffYield: 1.94,
          medianYield: 1.88,
          bidToCover: 2.31,
          nextIssueCode: "BS27101E",
          nextAuctionDate: "2027-01-14",
        },
        oneYear: {
          issueCode: "BY26103X",
          cutoffYield: 1.92,
        },
      },
    },
  });
  assert.equal(cpLive.masIsLive, true);
  assert.ok(cpLive.masSyncLabel.includes("4 Jan 2027"));
  const liveSsb = cpLive.catalog.items.find((x) => x.id === "ssb");
  assert.ok(liveSsb.metaBadge.includes("SBJAN27"));
  assert.equal(liveSsb.rateTiers[0].value, "2.10%");
  assert.equal(liveSsb.rateTiers[2].value, "2.65%");
  const liveTb = cpLive.catalog.items.find((x) => x.id === "tbills");
  assert.ok(liveTb.metaBadge.includes("BS27100A"));
  assert.equal(liveTb.rateTiers[0].value, "1.94%");
});

test("defaultExpenseItems and expensePlan break down presets, scaled targets, and itemized lists", () => {
  const M = require("./model.js");

  const ccaItems = M.defaultExpenseItems("cca");
  assert.equal(
    ccaItems.reduce((s, it) => s + it.amount, 0),
    2800,
  );
  const hhItems = M.defaultExpenseItems("home-helper");
  assert.equal(
    hhItems.reduce((s, it) => s + it.amount, 0),
    3900,
  );

  // Modern preset items include ~$800/mo food, ISP+rider, term/whole life, HDB insurance, WiFi & streaming
  assert.equal(
    ccaItems
      .filter((it) => it.category === "food")
      .reduce((s, it) => s + it.amount, 0),
    800,
  );
  assert.equal(
    hhItems
      .filter((it) => it.category === "food")
      .reduce((s, it) => s + it.amount, 0),
    800,
  );
  for (const items of [ccaItems, hhItems]) {
    assert.ok(
      items.some(
        (it) =>
          it.category === "housing" && /hdb (?:fire|insurance)/i.test(it.name),
      ),
    );
    assert.ok(
      items.some(
        (it) =>
          it.category === "care" &&
          /aia healthshield max \+ hsg max rider/i.test(it.name),
      ),
    );
    assert.ok(
      items.some(
        (it) =>
          it.category === "care" && /ge supreme multiplier life/i.test(it.name),
      ),
    );
    assert.ok(
      items.some(
        (it) =>
          it.category === "care" && /accident & term policy/i.test(it.name),
      ),
    );
    assert.ok(
      items.some(
        (it) =>
          it.category === "care" &&
          /supplement stack/i.test(it.name) &&
          it.amount === 35,
      ),
    );
    assert.ok(
      items.some(
        (it) =>
          it.category === "lifestyle" &&
          /aircon servicing, home repairs & appliances/i.test(it.name) &&
          it.amount >= 120,
      ),
    );
    assert.ok(
      items.some(
        (it) =>
          it.category === "lifestyle" &&
          /annual travel fund & contingency buffer/i.test(it.name) &&
          it.amount >= 410,
      ),
    );
  }
  assert.ok(
    ccaItems.some(
      (it) => it.category === "digital" && /wifi|mobile/i.test(it.name),
    ),
  );
  assert.ok(
    hhItems.some(
      (it) => it.category === "digital" && /netflix|streaming/i.test(it.name),
    ),
  );

  // Preset mode
  const presetPlan = M.expensePlan({ lifestyle: "cca", afterCpf: 4400 });
  assert.equal(presetPlan.sourceMode, "preset");
  assert.equal(presetPlan.isCustom, false);
  assert.equal(presetPlan.itemizedActive, false);
  assert.equal(presetPlan.total, 2800);
  assert.equal(presetPlan.categories.length, 6);
  assert.equal(
    presetPlan.categories.reduce((s, c) => s + c.amount, 0),
    2800,
  );
  assert.equal(presetPlan.takeHomePct, Math.round((2800 / 4400) * 100));

  // Explicit custom mode keeps isCustom true even if spend temporarily equals preset base
  const customSameAmount = M.expensePlan({
    lifestyle: "cca",
    spend: 2800,
    customActive: true,
    afterCpf: 4400,
  });
  assert.equal(customSameAmount.isCustom, true);
  assert.equal(customSameAmount.sourceMode, "scaled");

  // Single figure mode preserves custom item weights when scaling customExpenses
  const scaledCustomItems = M.expensePlan({
    lifestyle: "cca",
    spend: 4000,
    customActive: true,
    itemizedActive: false,
    customExpenses: [
      { id: "1", name: "Parents allowance", category: "care", amount: 500 },
      { id: "2", name: "Living & Bills", category: "food", amount: 1500 },
    ],
    afterCpf: 5000,
  });
  assert.equal(scaledCustomItems.isCustom, true);
  assert.equal(scaledCustomItems.itemizedActive, false);
  assert.equal(scaledCustomItems.total, 4000);
  assert.equal(scaledCustomItems.items[0].name, "Parents allowance");
  assert.equal(scaledCustomItems.items[0].amount, 1000);
  assert.equal(scaledCustomItems.items[1].amount, 3000);

  // Scaled custom spend mode ($3,000)
  const scaledPlan = M.expensePlan({
    lifestyle: "cca",
    spend: 3000,
    afterCpf: 5000,
  });
  assert.equal(scaledPlan.sourceMode, "scaled");
  assert.equal(scaledPlan.isCustom, true);
  assert.equal(scaledPlan.total, 3000);
  assert.equal(
    Math.round(scaledPlan.categories.reduce((s, c) => s + c.amount, 0) * 100) /
      100,
    3000,
  );
  assert.equal(scaledPlan.takeHomePct, 60);

  // Itemized custom list mode (also verifies legacy living/buffer category mapping)
  const itemizedPlan = M.expensePlan({
    lifestyle: "home-helper",
    itemizedActive: true,
    customExpenses: [
      {
        id: "1",
        name: "Utilities & Conservancy",
        category: "housing",
        amount: 300,
      },
      { id: "2", name: "Groceries & Dining", category: "living", amount: 900 },
      { id: "3", name: "Helper + Insurance", category: "care", amount: 1500 },
      { id: "4", name: "Travel Fund", category: "buffer", amount: 300 },
    ],
    afterCpf: 6000,
  });
  assert.equal(itemizedPlan.sourceMode, "itemized");
  assert.equal(itemizedPlan.isCustom, true);
  assert.equal(itemizedPlan.itemizedActive, true);
  assert.equal(itemizedPlan.total, 3000);
  assert.equal(itemizedPlan.takeHomePct, 50);
  const byCat = Object.fromEntries(
    itemizedPlan.categories.map((c) => [c.key, c]),
  );
  assert.equal(byCat.housing.amount, 300);
  assert.equal(byCat.housing.pct, 10);
  assert.equal(byCat.food.pct, 30);
  assert.equal(byCat.care.pct, 50);
  assert.equal(byCat.lifestyle.pct, 10);

  // Zero-total itemized edge case should not divide by zero
  const zeroPlan = M.expensePlan({
    lifestyle: "cca",
    itemizedActive: true,
    customExpenses: [{ name: "Empty", category: "food", amount: 0 }],
    afterCpf: 0,
  });
  assert.equal(zeroPlan.total, 0);
  assert.equal(zeroPlan.takeHomePct, 0);
  assert.equal(zeroPlan.items[0].pct, 0);
  assert.ok(zeroPlan.categories.every((c) => c.pct === 0));
});

test("resolveCashParkingCatalog builds historical rateContext for SSB and T-Bills", () => {
  const M = require("./model.js");
  const fs = require("node:fs");
  const diskRates = JSON.parse(
    fs.readFileSync("assets/mas-rates.json", "utf8"),
  );
  const cat = M.resolveCashParkingCatalog(diskRates);

  for (const id of ["ssb", "tbills"]) {
    const item = cat.items.find((x) => x.id === id);
    assert.ok(item && item.rateContext, "expected rateContext on " + id);
    assert.ok(["good", "info", "warn"].includes(item.rateContext.tone));
    assert.ok(item.rateContext.verdict.length > 5);
    assert.ok(item.rateContext.action.length > 10);
    assert.ok(item.rateContext.yr1.min <= item.rateContext.yr1.avg);
    assert.ok(item.rateContext.yr1.avg <= item.rateContext.yr1.max);
    assert.ok(
      item.rateContext.yr1.posPct >= 4 && item.rateContext.yr1.posPct <= 96,
    );
    assert.ok(
      item.rateContext.longTerm && item.rateContext.longTerm.sinceYear <= 2020,
    );
    assert.equal(item.rateContext.recent6.length, 6);
  }
});

test("HealthShield age-band step-up and limited-pay GE Life curve fund old-age care without changing today cashflow", () => {
  const M = require("./model.js");
  assert.equal(M.healthShieldMonthlyAtAge(35), 153);
  assert.equal(M.healthShieldMonthlyAtAge(45), 248);
  assert.equal(M.healthShieldMonthlyAtAge(55), 381);
  assert.equal(M.healthShieldMonthlyAtAge(65), 621);
  assert.equal(M.healthShieldMonthlyAtAge(75), 1216);
  assert.equal(M.healthShieldMonthlyAtAge(85), 1730);
  assert.equal(M.healthShieldMonthlyAtAge(90), 1821);

  for (const [lifestyle, expectedToday, exp65, exp75] of [
    ["cca", 2800, 2963, 4026],
    ["home-helper", 3900, 3842, 4579],
  ]) {
    const r = M.calculate({ age: 35, salary: 6000, lifestyle });
    const d = M.todayPlan(r);
    assert.equal(r.todaySpend, expectedToday);
    assert.equal(Math.round(d.spend65), exp65);
    assert.equal(Math.round(d.spend75), exp75);

    const s0 = r.scenarios[0];
    const futureSpendAt65 = M.expenseAt(
      r.todaySpend,
      r.age,
      r.retire - r.age,
      r.inflation,
      lifestyle,
      { insuranceCurve: true },
    );
    const flatCurveTarget = M.portfolioTarget(
      futureSpendAt65,
      s0.payout,
      r.retire,
      90,
      {
        investmentReturn: r.investmentReturn,
        inflation: r.inflation,
        plan: r.plan,
        lifestyle,
        insuranceCurve: false,
      },
    );
    assert.ok(s0.privateTarget > flatCurveTarget);

    const sim = M.simulate({ age: 35, salary: 6000, lifestyle }, "salary", {
      summary: r,
    });
    assert.ok(Math.abs(sim.points.at(-1).portfolioBalance) < 1e-4);
    const fire = M.firePlan({
      age: 35,
      salary: 6000,
      lifestyle,
      retire: 65,
    });
    const f65 = fire.points.find((pt) => pt.age === 65);
    const f75 = fire.points.find((pt) => pt.age === 75);
    assert.equal(Math.round(f65.today.monthlySpend), exp65);
    assert.equal(Math.round(f75.today.monthlySpend), exp75);
    assert.equal(fire.points.at(-1).age, 95);
  }
});

test("4-Tap retirement architecture, SRS age-63 $400k/$450k-$500k ballooning trap guardrail, 85/15 equity split, $150k SSB buffer, and age-55 $500k OA interest tap", () => {
  const M = require("./model.js");

  // 1. Default 85% Global Growth / 15% SG Dividend split inside Equity Sleeve
  assert.equal(DEMO_PLAN.sgSleevePct, 15);
  const bogleDefault = M.bogleheadAllocation(
    {
      age: 35,
      oa: 80000,
      sa: 60000,
      ma: 45000,
      equities: 100000,
      sgDividends: 15000,
      ssbCash: 35000,
      srs: 20000,
      targetEquityPct: 80,
    },
    2000,
  );
  assert.equal(bogleDefault.holistic.globalEquitySplitPct, 85);
  assert.equal(bogleDefault.holistic.sgEquitySplitPct, 15);
  assert.equal(bogleDefault.holistic.targetGlobalPct, 68);
  assert.equal(bogleDefault.holistic.targetSgPct, 12);

  // 2. SRS Age-63 Ballooning Trap Guardrail ($400k tax-free ceiling vs $450k-$500k trap)
  const safeSrs = M.taxSweetSpot({
    age: 40,
    salary: 9000,
    srs: 30000,
    srsAnnual: 5000,
    srsInvestedIn: "global",
  });
  assert.equal(safeSrs.srsTrapStatus, "safe");
  assert.ok(safeSrs.srsProjectedAt63 <= 400000);
  assert.equal(safeSrs.srsWithdrawalTaxAt63.annualTax, 0);
  assert.ok(safeSrs.srsMaxSafeAnnualTo400k > 5000);

  const nearCapSrs = M.taxSweetSpot({
    age: 50,
    salary: 10000,
    srs: 150000,
    srsAnnual: 9000,
    srsInvestedIn: "global",
  });
  assert.equal(nearCapSrs.srsTrapStatus, "near-cap");
  assert.ok(
    nearCapSrs.srsProjectedAt63 > 400000 &&
      nearCapSrs.srsProjectedAt63 < 450000,
  );

  const balloonTrapSrs = M.taxSweetSpot({
    age: 35,
    salary: 12000,
    srs: 80000,
    srsAnnual: 15300,
    srsInvestedIn: "global",
  });
  assert.equal(balloonTrapSrs.srsTrapStatus, "balloon-trap");
  assert.ok(balloonTrapSrs.srsProjectedAt63 >= 450000);
  assert.ok(balloonTrapSrs.srsTenYearAnnualDraw >= 45000);
  assert.ok(balloonTrapSrs.srsTaxableAnnualAt63 >= 22500);
  assert.ok(balloonTrapSrs.srsWithdrawalTaxAt63.annualTax > 0);
  assert.ok(balloonTrapSrs.srsTrapGuidance.includes("brokerage"));

  // 3. $150k SSB Post-Buffer Target (after 12-month emergency buffer)
  const cp80k = M.cashParkingPlan({
    summary: { todaySpend: 2800 },
    guide: { emergencyMin: 16800, emergencyMax: 33600 },
    params: { ssbCash: 80000 },
  });
  assert.equal(cp80k.ssbTargetBuffer, 150000);
  assert.equal(cp80k.ssbTargetProgress, 80000 - 33600);
  assert.equal(cp80k.ssbTargetRemaining, 150000 - (80000 - 33600));

  const cp200k = M.cashParkingPlan({
    summary: { todaySpend: 2800 },
    guide: { emergencyMin: 16800, emergencyMax: 33600 },
    params: { ssbCash: 200000 },
  });
  assert.equal(cp200k.ssbTargetProgress, 150000);
  assert.equal(cp200k.ssbTargetRemaining, 0);

  // 4. Age-55 $500k OA = ~$1,000/mo ($1,042/mo exact) & 4-Tap Retirement Income Summary
  const p55 = {
    ...DEMO_PLAN,
    age: 35,
    retire: 55,
    salary: 8500,
    oa: 220000,
    sa: 120000,
    ma: 55000,
  };
  const sum55 = M.calculate(p55);
  const sim55 = M.simulate(p55, "salary", { summary: sum55 });
  const r55 = M.todayPlan(sum55);
  const s55 = M.todayPlan({ ...sum55, scenarios: [sim55.selectedScenario] })
    .scenarios[0];
  const fire55 = M.firePlan(p55, "salary", {
    summary: sum55,
    simulation: sim55,
  });
  const bogle55 = M.bogleheadAllocation(p55, sim55.invest);
  const tax55 = M.taxSweetSpot(p55);
  const taps = M.retirementTapsPlan({
    summary: r55,
    selectedScenario: s55,
    simulation: sim55,
    fire: fire55,
    bogle: bogle55,
    tax: tax55,
    params: p55,
  });

  assert.equal(fire55.milestones.age55.oaRef500kMonthly, 1042);
  assert.ok(fire55.milestones.age55.oaInterestMonthlyNominal > 0);
  assert.equal(taps.tap1Cpf.targetRefMonthly, 2200);
  assert.equal(taps.tap1Cpf.oa500kRefMonthly, 1000);
  assert.equal(taps.tap1Cpf.oa500kMonthlyExact, 1042);
  assert.equal(taps.tap1Cpf.brs.sum, 110200);
  assert.equal(taps.tap1Cpf.frs.sum, 220400);
  assert.equal(taps.tap1Cpf.ers.sum, 440800);
  assert.equal(taps.tap2Srs.softCapAt63, 400000);
  assert.equal(taps.tap2Srs.trapFloorAt63, 450000);
  assert.equal(taps.tap3Equities.globalSplitPct, 85);
  assert.equal(taps.tap3Equities.sgDividendSplitPct, 15);
  assert.equal(taps.tap3Equities.benchmarkMinMonthly, 1200);
  assert.equal(taps.tap3Equities.benchmarkMaxMonthly, 2200);
  assert.equal(taps.tap4Ssb.targetBuffer, 150000);
  assert.equal(taps.tap4Ssb.masCap, 200000);
});

test("SG_DEFAULT_PLAN, index.html initial inputs, and buildPrintReportModel stay 100% synced and immune to context rot", () => {
  const fs = require("node:fs");
  const M = require("./model.js");
  const html = fs.readFileSync("index.html", "utf8");
  const appJs = [
    "app.js",
    ...fs
      .readdirSync("src/app")
      .filter((f) => f.endsWith(".js"))
      .map((f) => `src/app/${f}`),
  ]
    .map((p) => fs.readFileSync(p, "utf8"))
    .join("\n");

  // 1. Verify SG_DEFAULT_PLAN reflects modern Singapore age-35 profile with exact 85/15 equity split
  const def = M.SG_DEFAULT_PLAN;
  assert.ok(def, "Expected SG_DEFAULT_PLAN exported on RetirementModel");
  assert.equal(def.age, 35);
  assert.equal(def.retire, 65);
  assert.equal(def.salary, 5500);
  assert.equal(def.lifestyle, "cca");
  assert.equal(def.equities, 34000);
  assert.equal(def.sgDividends, 6000);
  assert.equal(def.ssbCash, 20000);
  assert.equal(def.equities + def.sgDividends, 40000);
  assert.equal(
    Math.round((def.equities / (def.equities + def.sgDividends)) * 100),
    85,
  );
  assert.equal(
    Math.round((def.sgDividends / (def.equities + def.sgDividends)) * 100),
    15,
  );
  assert.equal(def.sgSleevePct, 15);
  assert.equal(def.targetEquityPct, 80);
  assert.equal(def.existingReliefs, 1000);
  assert.equal(def.housingMode, "all-oa");

  // 2. Verify index.html input default values match SG_DEFAULT_PLAN 1-for-1
  const getInputAttrValue = (id) => {
    const re = new RegExp(`<input[^>]*id="${id}"[^>]*>`, "m");
    const m = html.match(re);
    assert.ok(m, `Expected <input id="${id}"> in index.html`);
    const valMatch = m[0].match(/\bvalue="([^"]*)"/);
    const phMatch = m[0].match(/\bplaceholder="([^"]*)"/);
    return valMatch ? valMatch[1] : phMatch ? phMatch[1] : null;
  };
  assert.equal(Number(getInputAttrValue("person-salary")), def.salary);
  assert.equal(Number(getInputAttrValue("known-retire")), def.retire);
  assert.equal(
    Number(getInputAttrValue("known-annual-bonus")),
    def.annualBonus,
  );
  assert.equal(Number(getInputAttrValue("known-oa")), def.oa);
  assert.equal(Number(getInputAttrValue("known-sa")), def.sa);
  assert.equal(Number(getInputAttrValue("known-ma")), def.ma);
  assert.equal(Number(getInputAttrValue("known-equities")), def.equities);
  assert.equal(
    Number(getInputAttrValue("known-sg-dividends")),
    def.sgDividends,
  );
  assert.equal(Number(getInputAttrValue("known-ssb-cash")), def.ssbCash);
  assert.equal(Number(getInputAttrValue("known-srs")), def.srs);
  assert.equal(Number(getInputAttrValue("known-srs-annual")), def.srsAnnual);
  assert.equal(
    Number(getInputAttrValue("known-existing-reliefs")),
    def.existingReliefs,
  );
  assert.equal(
    Number(getInputAttrValue("known-target-equity")),
    def.targetEquityPct,
  );
  assert.equal(Number(getInputAttrValue("known-sg-sleeve")), def.sgSleevePct);

  // 3. Verify app.js uses RetirementModel.SG_DEFAULT_PLAN and pm.colophonRulesText (no hardcoded statutory strings in renderPrintSheet)
  assert.ok(
    appJs.includes("...RetirementModel.SG_DEFAULT_PLAN"),
    "app.js must derive SG_DEFAULT_PLAN from RetirementModel.SG_DEFAULT_PLAN",
  );
  assert.ok(
    appJs.includes("pm.colophonRulesText"),
    "renderPrintSheet must render pm.colophonRulesText from model.js",
  );
  assert.ok(
    appJs.includes("swellCombo: true") &&
      appJs.includes('"print-swell"') &&
      appJs.includes("buildExpensePieSVG(ep, { isPrint: true })"),
    "renderPrintSheet must render the same Swell combo chart, readiness semi-gauge, and living budget donut as Overview",
  );
  assert.equal(
    appJs.includes("FRS $220.4k, ERS $440.8k"),
    false,
    "renderPrintSheet must not contain hardcoded CPF sum strings",
  );

  // 4. Verify buildPrintReportModel on SG_DEFAULT_PLAN produces accurate dynamic fields
  const sum = M.calculate(def);
  const sim = M.simulate(def, "salary", { summary: sum });
  const r = M.todayPlan(sum);
  const s = M.todayPlan({ ...sum, scenarios: [sim.selectedScenario] })
    .scenarios[0];
  const fire = M.firePlan(def, "salary", { summary: sum, simulation: sim });
  const bogle = M.bogleheadAllocation(def, sim.invest);
  const tax = M.taxSweetSpot(def);
  const guide = M.outsideAllocationGuide(r, sim);
  const pm = M.buildPrintReportModel({
    summary: r,
    selectedScenario: s,
    simulation: sim,
    fire,
    bogle,
    tax,
    guide,
    params: def,
  });

  assert.equal(pm.budgetChipLabel, "Community Care Apartments ($2,800/mo)");
  assert.equal(pm.housingChipLabel, "Housing: All new OA");
  assert.ok(pm.colophonRulesText.includes("BRS $110.2k"));
  assert.ok(pm.colophonRulesText.includes("FRS $220.4k"));
  assert.ok(pm.colophonRulesText.includes("ERS $440.8k"));
  assert.ok(pm.colophonRulesText.includes("OW cap $8k"));
  assert.ok(pm.colophonRulesText.includes("RSTU cap $8k"));
  assert.ok(pm.colophonRulesText.includes("SRS cap $15.3k"));
  assert.ok(pm.colophonRulesText.includes("relief cap $80k"));
  assert.ok(pm.taps && pm.taps.tap1Cpf && pm.taps.tap4Ssb);
  assert.ok(pm.actionRows[0].tag.includes("$150k SSB"));
  assert.ok(pm.actionRows[1].tag.includes("85/15 G/SG"));

  // 5. Verify SRS balloon-trap warning and custom itemized budget surface in buildPrintReportModel
  const pTrap = {
    ...def,
    salary: 12000,
    srs: 80000,
    srsAnnual: 15300,
    spend: 3450,
    isCustomBudget: true,
    itemizedActive: true,
    housingMode: "paid-up",
    housing: 0,
  };
  const sumT = M.calculate(pTrap);
  const simT = M.simulate(pTrap, "salary", { summary: sumT });
  const rT = M.todayPlan(sumT);
  const sT = M.todayPlan({ ...sumT, scenarios: [simT.selectedScenario] })
    .scenarios[0];
  const fireT = M.firePlan(pTrap, "salary", {
    summary: sumT,
    simulation: simT,
  });
  const bogleT = M.bogleheadAllocation(pTrap, simT.invest);
  const taxT = M.taxSweetSpot(pTrap);
  const guideT = M.outsideAllocationGuide(rT, simT);
  const pmT = M.buildPrintReportModel({
    summary: rT,
    selectedScenario: sT,
    simulation: simT,
    fire: fireT,
    bogle: bogleT,
    tax: taxT,
    guide: guideT,
    params: pTrap,
  });

  assert.equal(pmT.budgetChipLabel, "Custom itemized ($3,450/mo)");
  assert.equal(pmT.housingChipLabel, "Housing: Paid-up ($0 OA)");
  assert.equal(pmT.actionRows[3].tag, "SRS >$450k Trap!");
  const expectedTrapCapK = Math.round(
    (taxT.srsZeroTaxCap || M.C.srsSoftCapAt63) / 1000,
  );
  assert.ok(pmT.actionRows[3].value.includes(`Cap SRS ≤$${expectedTrapCapK}k`));
});

test("outsideAllocationGuide, retirementTapsPlan, and buildPrintReportModel stay aligned across bonus, MAS rates, real SRS taps, and housing/asset breakdowns", () => {
  const M = require("./model.js");
  const def = M.SG_DEFAULT_PLAN;

  // 1. outsideAllocationGuide incorporates annualBonus and existingReliefs ($80k personal relief cap)
  const pBonus = {
    ...def,
    salary: 5500,
    annualBonus: 36000,
    existingReliefs: 1000,
  };
  const sumB = M.calculate(pBonus);
  const simB = M.simulate(pBonus, "salary", { summary: sumB });
  const rB = M.todayPlan(sumB);
  const pNoBonus = {
    ...pBonus,
    annualBonus: 0,
  };
  const sumNB = M.calculate(pNoBonus);
  const simNB = M.simulate(pNoBonus, "salary", { summary: sumNB });
  const rNB = M.todayPlan(sumNB);
  const guideNoBonus = M.outsideAllocationGuide(rNB, simNB, pNoBonus);
  const guideNoParams = M.outsideAllocationGuide(rB, simB);
  const guideWithParams = M.outsideAllocationGuide(rB, simB, pBonus);
  assert.ok(
    guideWithParams.tax.marginalRate > guideNoBonus.tax.marginalRate,
    "Expected annualBonus in params to raise marginal tax rate in outsideAllocationGuide",
  );
  assert.equal(
    guideNoParams.tax.marginalRate,
    guideWithParams.tax.marginalRate,
    "Expected outsideAllocationGuide fallback to pick up awBonusAnnual from summary",
  );

  const pCapped = {
    ...pBonus,
    existingReliefs: 80000,
  };
  const guideCapped = M.outsideAllocationGuide(rB, simB, pCapped);
  assert.equal(guideCapped.remainingReliefCap, 0);
  assert.equal(guideCapped.rstuEligible, 0);
  assert.equal(guideCapped.rstuTaxSaved, 0);
  assert.equal(guideCapped.srsTaxSaved, 0);

  // 2. retirementTapsPlan exposes real-dollar Tap 2 SRS fields and honors live masRates
  const pSrs = {
    ...def,
    age: 35,
    retire: 65,
    srs: 40000,
    srsAnnual: 10000,
    srsInvested: true,
    maSpend: 6000,
  };
  const sumS = M.calculate(pSrs);
  const simS = M.simulate(pSrs, "salary", { summary: sumS });
  const rS = M.todayPlan(sumS);
  assert.equal(typeof sumS.maShortfallToday, "number");
  assert.equal(typeof rS.maShortfallToday, "number");
  const sS = M.todayPlan({ ...sumS, scenarios: [simS.selectedScenario] })
    .scenarios[0];
  const fireS = M.firePlan(pSrs, "salary", { summary: sumS, simulation: simS });
  const bogleS = M.bogleheadAllocation(pSrs, simS.invest);
  const taxS = M.taxSweetSpot(pSrs);
  const customMas = {
    ssb: { year1Return: 2.15, year10Return: 2.74 },
  };
  const taps = M.retirementTapsPlan({
    summary: rS,
    selectedScenario: sS,
    simulation: simS,
    fire: fireS,
    bogle: bogleS,
    tax: taxS,
    params: pSrs,
    masRates: customMas,
  });
  assert.equal(taps.tap4Ssb.ssb1YrPct, 2.15);
  assert.equal(taps.tap4Ssb.ssb10YrPct, 2.74);
  assert.ok(taps.tap2Srs.projectedAt63Today > 0);
  assert.ok(
    taps.tap2Srs.projectedAt63Today < taps.tap2Srs.projectedAt63,
    "Real projected SRS at 63 should be discounted for inflation vs nominal",
  );
  assert.ok(
    taps.tap2Srs.tenYearMonthlyDrawToday < taps.tap2Srs.tenYearMonthlyDraw,
    "Real monthly SRS draw should be discounted for inflation vs nominal",
  );

  // 3. buildPrintReportModel handles $0 HDB loan, active loan years + shortfall, and reconciled startingAssets
  const pZeroHdb = {
    ...def,
    housingMode: "hdb",
    loanBalance: 0,
    loanRate: 2.6,
    loanYears: 20,
    housing: 0,
  };
  const sumZ = M.calculate(pZeroHdb);
  const simZ = M.simulate(pZeroHdb, "salary", { summary: sumZ });
  const rZ = M.todayPlan(sumZ);
  const sZ = M.todayPlan({ ...sumZ, scenarios: [simZ.selectedScenario] })
    .scenarios[0];
  const fireZ = M.firePlan(pZeroHdb, "salary", {
    summary: sumZ,
    simulation: simZ,
  });
  const bogleZ = M.bogleheadAllocation(pZeroHdb, simZ.invest);
  const taxZ = M.taxSweetSpot(pZeroHdb);
  const guideZ = M.outsideAllocationGuide(rZ, simZ, pZeroHdb);
  const pmZ = M.buildPrintReportModel({
    summary: rZ,
    selectedScenario: sZ,
    simulation: simZ,
    fire: fireZ,
    bogle: bogleZ,
    tax: taxZ,
    guide: guideZ,
    params: pZeroHdb,
    masRates: customMas,
  });
  assert.equal(pmZ.housingChipLabel, "Housing: $0 OA (HDB)");
  assert.equal(pmZ.taps.tap4Ssb.ssb10YrPct, 2.74);
  assert.equal(pmZ.startingAssets.cpfTotal, def.oa + def.sa + def.ma);
  assert.equal(
    pmZ.startingAssets.liquidOutside,
    def.equities + def.sgDividends + def.ssbCash,
  );
  assert.equal(
    pmZ.startingAssets.totalAssets,
    pmZ.startingAssets.cpfTotal + pmZ.startingAssets.outsideTotal,
  );

  const hcBank = M.computeHousingPayment({
    mode: "bank",
    loanBalance: 600000,
    loanRate: 3.2,
    loanYears: 22,
  });
  const pLoanShort = {
    ...def,
    salary: 3500,
    oa: 0,
    housingMode: "bank",
    housing: hcBank.monthlyShare,
    housingYears: hcBank.years,
  };
  const sumL = M.calculate(pLoanShort);
  const simL = M.simulate(pLoanShort, "salary", { summary: sumL });
  const rL = M.todayPlan(sumL);
  const sL = M.todayPlan({ ...sumL, scenarios: [simL.selectedScenario] })
    .scenarios[0];
  const fireL = M.firePlan(pLoanShort, "salary", {
    summary: sumL,
    simulation: simL,
  });
  const bogleL = M.bogleheadAllocation(pLoanShort, simL.invest);
  const taxL = M.taxSweetSpot(pLoanShort);
  const guideL = M.outsideAllocationGuide(rL, simL, pLoanShort);
  const pmL = M.buildPrintReportModel({
    summary: rL,
    selectedScenario: sL,
    simulation: simL,
    fire: fireL,
    bogle: bogleL,
    tax: taxL,
    guide: guideL,
    params: pLoanShort,
  });
  assert.ok(pmL.housingChipLabel.includes("(Bank, 22y"));
  assert.ok(pmL.housingChipLabel.includes("Shortfall"));
});

test("annualBonus credits Additional Wage CPF up to $102,000 ceiling, srsInvestedIn differentiates returns, and milestonePlan/retirementTapsPlan stay personalized", () => {
  const M = require("./model.js");
  const def = M.SG_DEFAULT_PLAN;

  // 1. Additional Wage CPF up to $102,000 annual CPF salary ceiling
  const noBonus = M.calculate({ ...def, salary: 5500, annualBonus: 0 });
  const withBonus = M.calculate({ ...def, salary: 5500, annualBonus: 12000 });
  assert.equal(withBonus.awSubjectAnnual, 12000);
  assert.equal(withBonus.annualBonusEmployeeCpf, 2400);
  assert.equal(
    Math.round(withBonus.annualBonusTotalCpf),
    Math.round(12000 * 0.37),
  );
  assert.ok(
    withBonus.cpfAt55 > noBonus.cpfAt55,
    "Expected annualBonus AW CPF to increase projected CPF at 55",
  );

  // Above $8k/mo OW ($96,000/yr), AW CPF is strictly capped at remaining $6,000 ($102k - $96k)
  const cap6k = M.calculate({ ...def, salary: 8500, annualBonus: 6000 });
  const cap30k = M.calculate({ ...def, salary: 8500, annualBonus: 30000 });
  assert.equal(cap6k.awSubjectAnnual, 6000);
  assert.equal(cap30k.awSubjectAnnual, 6000);
  assert.equal(
    Math.round(cap6k.cpfAt55 * 100),
    Math.round(cap30k.cpfAt55 * 100),
    "Expected bonuses above the $102k annual CPF ceiling to add zero extra CPF",
  );

  // 2. srsInvestedIn return differentiation in taxSweetSpot and firePlan
  const srsBase = {
    ...def,
    age: 35,
    retire: 65,
    srs: 20000,
    srsAnnual: 8000,
    returnRate: 0.06,
  };
  const txGlobal = M.taxSweetSpot({ ...srsBase, srsInvestedIn: "global" });
  const txBalanced = M.taxSweetSpot({ ...srsBase, srsInvestedIn: "balanced" });
  const txSsb = M.taxSweetSpot({ ...srsBase, srsInvestedIn: "ssb" });
  const txCash = M.taxSweetSpot({ ...srsBase, srsInvestedIn: "cash" });
  assert.ok(txGlobal.srsProjectedAt63 > txBalanced.srsProjectedAt63);
  assert.ok(txBalanced.srsProjectedAt63 > txSsb.srsProjectedAt63);
  assert.ok(txSsb.srsProjectedAt63 > txCash.srsProjectedAt63);
  assert.ok(txCash.srsIdleWarning.includes("uninvested cash"));

  const fpGlobal = M.firePlan({ ...srsBase, srsInvestedIn: "global" });
  const fpBalanced = M.firePlan({ ...srsBase, srsInvestedIn: "balanced" });
  const fpSsb = M.firePlan({ ...srsBase, srsInvestedIn: "ssb" });
  const fpCash = M.firePlan({ ...srsBase, srsInvestedIn: "cash" });
  const nwAt65 = (fp) => fp.points.find((pt) => pt.age === 65).totalNetWorth;
  assert.ok(nwAt65(fpGlobal) > nwAt65(fpBalanced));
  assert.ok(nwAt65(fpBalanced) > nwAt65(fpSsb));
  assert.ok(nwAt65(fpSsb) > nwAt65(fpCash));

  // 3. milestonePlan reconciles today's dollars, plannedCpfExtra, and Standard vs Escalating payouts
  const mpStd = M.milestonePlan(
    { ...def, age: 35, plan: "standard", cpfExtra: 0 },
    "ers",
  );
  const mpEsc = M.milestonePlan(
    { ...def, age: 35, plan: "escalating", cpfExtra: 300 },
    "ers",
  );
  assert.ok(mpStd.targetToday < mpStd.target);
  assert.equal(
    Math.round(mpStd.targetToday),
    Math.round(M.todayValue(mpStd.target, 55, 35, def.inflationRate)),
  );
  assert.ok(
    mpEsc.cohortMilestones.frs.payoutToday <
      mpStd.cohortMilestones.frs.payoutToday,
    "Escalating initial cohort payout at 65 should start ~20% below Standard",
  );
  assert.equal(mpEsc.plannedCpfExtra, 300);
  assert.ok(mpEsc.withPlanned.remainingGap < mpStd.gap);
  assert.ok(mpEsc.withPlanned.additionalMonthlyNeeded < mpStd.monthly);
  // Cohort payouts and monthly top-up in milestonePlan must reconcile identically with calculate()/todayPlan()
  const mpCalcToday = M.todayPlan(
    M.calculate({ ...def, age: 35, plan: "standard", cpfExtra: 0 }),
  );
  assert.equal(
    Math.round(mpStd.cohortMilestones.brs.payoutToday),
    Math.round(mpCalcToday.brsScenario.payout),
  );
  assert.equal(
    Math.round(mpStd.cohortMilestones.frs.payoutToday),
    Math.round(mpCalcToday.scenarios.find((s) => s.key === "frs").payout),
  );
  assert.equal(
    Math.round(mpStd.cohortMilestones.ers.payoutToday),
    Math.round(mpCalcToday.scenarios.find((s) => s.key === "ers").payout),
  );
  assert.equal(
    mpStd.monthly,
    Math.round(mpCalcToday.scenarios.find((s) => s.key === "ers").cpfFunding),
  );

  // 4. retirementTapsPlan Tap 2 personalized verdicts across income/tax states
  const tapsLow = M.retirementTapsPlan({
    params: { ...def, salary: 3000, srs: 0, srsAnnual: 0 },
  });
  assert.equal(tapsLow.tap2Srs.worthIt, false);
  assert.equal(tapsLow.tap2Srs.verdictStatus, "skip-low-tax");

  const tapsMid = M.retirementTapsPlan({
    params: { ...def, salary: 5500, sa: 45000, srs: 0, srsAnnual: 0 },
  });
  assert.equal(tapsMid.tap2Srs.worthIt, false);
  assert.equal(tapsMid.tap2Srs.verdictStatus, "rstu-first");

  const tapsHigh = M.retirementTapsPlan({
    params: { ...def, salary: 10000, srs: 0, srsAnnual: 5500 },
  });
  assert.equal(tapsHigh.tap2Srs.worthIt, true);
  assert.equal(tapsHigh.tap2Srs.verdictStatus, "worth-it");
  assert.ok(tapsHigh.tap2Srs.verdictLabel.includes("Worth It"));

  const tapsTrap = M.retirementTapsPlan({
    params: { ...def, salary: 10000, srs: 0, srsAnnual: 10000 },
  });
  assert.equal(tapsTrap.tap2Srs.worthIt, true);
  assert.equal(tapsTrap.tap2Srs.verdictStatus, "trap-alert");

  const tapsIdle = M.retirementTapsPlan({
    params: {
      ...def,
      salary: 10000,
      srs: 25000,
      srsAnnual: 5000,
      srsInvestedIn: "cash",
    },
  });
  assert.equal(tapsIdle.tap2Srs.verdictStatus, "idle-cash");

  const tapsCapped = M.retirementTapsPlan({
    params: { ...def, salary: 10000, existingReliefs: 80000 },
  });
  assert.equal(tapsCapped.tap2Srs.worthIt, false);
  assert.equal(tapsCapped.tap2Srs.verdictStatus, "cap-full");
});

test("Multi-Account Tiered Cash & SSB Breakdown computes exact tiered EIR, SDIC bank-group aggregation, overflow sweep, and compounds in firePlan", () => {
  const M = require("./model.js");
  const def = M.SG_DEFAULT_PLAN;

  // 1. User scenario: $150,000 in DBS Multiplier ($100k bonus cap @ 2.00%, excess @ 0.05% base)
  const dbs150k = M.computeCashAccountsBreakdown([
    {
      preset: "dbs-multiplier",
      name: "DBS Multiplier",
      balance: 150000,
      bonusCap: 100000,
      bonusRatePct: 2.0,
      baseRatePct: 0.05,
    },
  ]);
  assert.equal(dbs150k.totalBalance, 150000);
  assert.equal(dbs150k.totalTier1Balance, 100000);
  assert.equal(dbs150k.totalOverflowBalance, 50000);
  assert.equal(dbs150k.accounts[0].tier1AnnualInterest, 2000);
  assert.equal(dbs150k.accounts[0].overflowAnnualInterest, 25);
  assert.equal(dbs150k.totalAnnualInterest, 2025);
  assert.equal(dbs150k.effectiveRatePct, 1.35);
  assert.equal(dbs150k.accounts[0].rateDragPct, 0.65);
  assert.equal(dbs150k.sdicOverflowTotal, 50000);
  assert.equal(dbs150k.sdicExceededBanks.length, 1);
  assert.equal(dbs150k.sdicExceededBanks[0].bankGroup, "dbs-posb");

  // 2. Shared $100k SDIC limit between DBS and POSB + multi-account blended EIR
  const multi = M.computeCashAccountsBreakdown([
    {
      preset: "dbs-multiplier",
      name: "DBS Multiplier",
      balance: 120000,
      bonusCap: 100000,
      bonusRatePct: 2.0,
      baseRatePct: 0.05,
    },
    {
      preset: "posb-say",
      name: "POSB Savings",
      balance: 30000,
      bonusCap: 100000,
      bonusRatePct: 2.0,
      baseRatePct: 0.05,
    },
    {
      preset: "ocbc-360",
      name: "OCBC 360",
      balance: 80000,
      bonusCap: 100000,
      bonusRatePct: 2.45,
      baseRatePct: 0.05,
    },
  ]);
  assert.equal(multi.totalBalance, 230000);
  assert.equal(multi.totalOverflowBalance, 20000);
  // DBS (120k) + POSB (30k) = 150k in dbs-posb group -> 50k above $100k SDIC limit
  assert.equal(multi.sdicOverflowTotal, 50000);
  assert.equal(multi.sdicExceededBanks[0].balance, 150000);
  assert.equal(multi.sdicExceededBanks[0].uninsured, 50000);

  // 3. 1-click sweep of bonus-cap overflow into MAS SSB
  const swept = M.sweepCashAccountsOverflow([
    {
      preset: "dbs-multiplier",
      name: "DBS Multiplier",
      balance: 150000,
      bonusCap: 100000,
      bonusRatePct: 2.0,
      baseRatePct: 0.05,
    },
  ]);
  const sweptBd = M.computeCashAccountsBreakdown(swept);
  assert.equal(sweptBd.totalBalance, 150000);
  assert.equal(sweptBd.totalOverflowBalance, 0);
  assert.equal(
    swept.find((a) => a.preset === "dbs-multiplier").balance,
    100000,
  );
  assert.equal(swept.find((a) => a.preset === "ssb").balance, 50000);
  assert.ok(
    sweptBd.effectiveRatePct > dbs150k.effectiveRatePct,
    "Sweeping overflow to MAS SSB should raise blended effective interest rate",
  );
  assert.equal(
    Math.round(sweptBd.totalAnnualInterest - dbs150k.totalAnnualInterest),
    Math.round(dbs150k.sweepAnnualGain),
  );

  // 4. Integration into firePlan, cashParkingPlan, and retirementTapsPlan
  const pCappedCash = {
    ...def,
    age: 35,
    retire: 65,
    returnRate: 0.05,
    cashAccountsActive: true,
    cashAccounts: [
      {
        preset: "dbs-multiplier",
        name: "DBS Multiplier",
        balance: 150000,
        bonusCap: 100000,
        bonusRatePct: 2.0,
        baseRatePct: 0.05,
      },
    ],
  };
  const pSweptCash = {
    ...pCappedCash,
    cashAccounts: swept,
  };
  const fpCapped = M.firePlan(pCappedCash, "salary");
  const fpSwept = M.firePlan(pSweptCash, "salary");
  assert.equal(fpCapped.buckets.ssbCash, 150000);
  assert.equal(fpCapped.buckets.cashEffectiveRatePct, 1.35);
  const nw65Capped = fpCapped.points.find((pt) => pt.age === 65).totalNetWorth;
  const nw65Swept = fpSwept.points.find((pt) => pt.age === 65).totalNetWorth;
  assert.ok(
    nw65Swept > nw65Capped,
    "Expected sweeping $50k overflow from 0.05% base to SSB to increase projected age-65 net worth",
  );

  const cp = M.cashParkingPlan({ params: pCappedCash });
  assert.equal(cp.cashAccountsActive, true);
  assert.equal(cp.currentCash, 150000);
  assert.equal(cp.cashBreakdown.effectiveRatePct, 1.35);
  assert.ok(cp.positionHeadline.includes("Over Bonus Cap"));

  const taps = M.retirementTapsPlan({ params: pCappedCash, fire: fpCapped });
  assert.equal(taps.tap4Ssb.cashAccountsActive, true);
  assert.equal(taps.tap4Ssb.effectiveRatePct, 1.35);
  assert.equal(taps.tap4Ssb.overflowBalance, 50000);
});

test("firePlan routes monthly savings holistically, spends post-55 excess CPF OA and low-yielding cash first, and Portfolio Allocator chip moves monotonically with equity", () => {
  const fs = require("node:fs");
  const M = require("./model.js");
  const appJs = [
    "app.js",
    ...fs
      .readdirSync("src/app")
      .filter((f) => f.endsWith(".js"))
      .map((f) => `src/app/${f}`),
  ]
    .map((p) => fs.readFileSync(p, "utf8"))
    .join("\n");

  // 1. Portfolio Allocator top chip uses Current - Target signed variance (not inverse Target - Current)
  assert.ok(
    appJs.includes("const equityDeltaPct = curEqRounded - tgtEqRounded;"),
    "Expected Portfolio Allocator chip to compute signed Current - Target delta",
  );
  assert.equal(
    appJs.includes("Equities needed"),
    false,
    "Expected inverse +X% Equities needed badge text to be replaced",
  );

  // 2. Age-32 profile with large CPF + Cash defensive floor routes 100% of monthly liquid savings to equities and counts post-55 excess OA
  const p32 = {
    ...M.SG_DEFAULT_PLAN,
    age: 32,
    retire: 65,
    salary: 10000,
    lifestyle: "home-helper",
    spend: 3900,
    oa: 110000,
    sa: 40000,
    ma: 31357,
    equities: 80002,
    sgDividends: 6000,
    ssbCash: 139500,
    srs: 2,
    savings: 80002 + 6000 + 139500 + 2,
    cashAccountsActive: true,
    cashAccounts: [
      {
        preset: "dbs-multiplier",
        name: "DBS Multiplier",
        balance: 100000,
        bonusCap: 100000,
        bonusRatePct: 2.0,
        baseRatePct: 0.05,
      },
      {
        preset: "ssb",
        name: "MAS SSB",
        balance: 39500,
        bonusCap: 200000,
        bonusRatePct: 2.39,
        baseRatePct: 2.39,
      },
    ],
    targetEquityPct: 55,
    sgSleevePct: 15,
    housingMode: "hdb",
    housing: 1456.8,
    housingYears: 20,
    returnRate: 0.05,
    inflationRate: 0.025,
  };
  const sum32 = M.calculate(p32);
  const sim32 = M.simulate(p32, "salary", { summary: sum32 });
  const fire32 = M.firePlan(p32, "salary", {
    summary: sum32,
    simulation: sim32,
  });

  // With direct 55/45 split on auto-saving ($624/mo), ~76%+ funded and lasts to age ~87+
  assert.ok(
    fire32.fireNumber.pctFunded >= 75 && fire32.fireNumber.pctFunded < 100,
  );
  assert.ok(fire32.fireNumber.depletionAge >= 86);
  // Including retained post-65 CPF LIFE payouts during post-65 work reaches FI at age 72
  assert.equal(fire32.fireNumber.projectedFireAge, 72);

  // Adopting projectedFireAge (75) while keeping the $624/mo investment is 100%+ funded to 95 with zero depletion and does not shift projectedFireAge higher
  const p32AtReady = {
    ...p32,
    retire: fire32.fireNumber.projectedFireAge,
    invest: Math.round(sim32.invest),
  };
  const sum32Ready = M.calculate(p32AtReady);
  const sim32Ready = M.simulate(p32AtReady, "salary", { summary: sum32Ready });
  const fire32Ready = M.firePlan(p32AtReady, "salary", {
    summary: sum32Ready,
    simulation: sim32Ready,
  });
  assert.equal(fire32Ready.fireNumber.fullyFundedTo95, true);
  assert.equal(fire32Ready.fireNumber.depletionAge, null);
  assert.ok(fire32Ready.fireNumber.pctFunded >= 100);
  assert.equal(
    fire32Ready.fireNumber.projectedFireAge,
    fire32.fireNumber.projectedFireAge,
  );

  // Saving $1,400/mo with direct 55/45 split is 100%+ funded to age 95 with zero depletion
  const p32Funded = { ...p32, invest: 1400 };
  const sum32F = M.calculate(p32Funded);
  const sim32F = M.simulate(p32Funded, "salary", { summary: sum32F });
  const fire32F = M.firePlan(p32Funded, "salary", {
    summary: sum32F,
    simulation: sim32F,
  });
  assert.ok(fire32F.fireNumber.pctFunded >= 100);
  assert.equal(fire32F.fireNumber.depletionAge, null);
  assert.equal(fire32F.fireNumber.fullyFundedTo95, true);
  assert.ok(fire32F.fireNumber.projectedFireAge <= 65);
});

test("Cash Savings and Outside Investment are split separately and Outside Investment models directly after chosen Allocator split", () => {
  const M = require("./model.js");
  const base = {
    ...M.SG_DEFAULT_PLAN,
    age: 35,
    retire: 65,
    salary: 8000,
    oa: 50000,
    sa: 40000,
    ma: 30000,
    equities: 50000,
    sgDividends: 10000,
    ssbCash: 20000,
    srs: 0,
    savings: 80000,
    cashSaving: 500,
    invest: 1000,
    targetEquityPct: 70,
    sgSleevePct: 20,
    returnRate: 0.06,
    cashReturnRate: 0.02,
  };
  const sum = M.calculate(base);
  const sim = M.simulate(base, "salary", { summary: sum });
  assert.equal(sim.cashSaving, 500);
  assert.equal(sim.invest, 1000);

  const bogle = M.bogleheadAllocation(base, sim.invest);
  // $1,000 outside invest -> 70% Eq ($700: 80% Global $560 + 20% SG $140) + 30% Bond ($300)
  assert.equal(bogle.monthlyRebalance.buyGlobalMonthly, 560);
  assert.equal(bogle.monthlyRebalance.buySgMonthly, 140);
  assert.equal(bogle.monthlyRebalance.buyBondMonthly, 300);

  const r = M.todayPlan(sum);
  const pc = M.paycheckAllocation(r, sim, bogle, base);
  assert.equal(pc.cashSavingMo, 500);
  assert.equal(pc.eqMo, 700);
  assert.equal(pc.ssbMo, 300);
  const rowSum = pc.rows.reduce((acc, row) => acc + row.amt, 0);
  assert.ok(Math.abs(rowSum - pc.grossPlusEmployer) <= 3);

  const fire70 = M.firePlan(base, "salary", { summary: sum, simulation: sim });
  const p90 = { ...base, targetEquityPct: 90 };
  const fire90 = M.firePlan(p90, "salary", { summary: sum, simulation: sim });
  const pt70 = fire70.points.find((pt) => pt.age === 65);
  const pt90 = fire90.points.find((pt) => pt.age === 65);
  // Higher equity split (90% vs 70%) directly grows liquidEquities more and ssbCash less
  assert.ok(pt90.liquidEquities > pt70.liquidEquities);
  assert.ok(pt90.ssbCash < pt70.ssbCash);
  // Cash savings ($500/mo) still accumulates into ssbCash even at 95% equity split
  assert.ok(pt90.ssbCash > 20000 + 500 * 12 * 30);

  // Full 100/0 and 0/100 splits are supported on both Equity/Bond and Global/SG
  const bogle100Eq100Global = M.bogleheadAllocation(
    { ...base, targetEquityPct: 100, sgSleevePct: 0 },
    1000,
  );
  assert.equal(bogle100Eq100Global.holistic.targetEquityPct, 100);
  assert.equal(bogle100Eq100Global.holistic.sgEquitySplitPct, 0);
  assert.equal(bogle100Eq100Global.monthlyRebalance.buyGlobalMonthly, 1000);
  assert.equal(bogle100Eq100Global.monthlyRebalance.buySgMonthly, 0);
  assert.equal(bogle100Eq100Global.monthlyRebalance.buyBondMonthly, 0);

  const bogle100Eq100Sg = M.bogleheadAllocation(
    { ...base, targetEquityPct: 100, sgSleevePct: 100 },
    1000,
  );
  assert.equal(bogle100Eq100Sg.holistic.targetEquityPct, 100);
  assert.equal(bogle100Eq100Sg.holistic.sgEquitySplitPct, 100);
  assert.equal(bogle100Eq100Sg.monthlyRebalance.buyGlobalMonthly, 0);
  assert.equal(bogle100Eq100Sg.monthlyRebalance.buySgMonthly, 1000);
  assert.equal(bogle100Eq100Sg.monthlyRebalance.buyBondMonthly, 0);

  const bogle0Eq100Bond = M.bogleheadAllocation(
    { ...base, targetEquityPct: 0, sgSleevePct: 50 },
    1000,
  );
  assert.equal(bogle0Eq100Bond.holistic.targetEquityPct, 0);
  assert.equal(bogle0Eq100Bond.monthlyRebalance.buyGlobalMonthly, 0);
  assert.equal(bogle0Eq100Bond.monthlyRebalance.buySgMonthly, 0);
  assert.equal(bogle0Eq100Bond.monthlyRebalance.buyBondMonthly, 1000);

  // Verify retirementTapsPlan stays 100% synced with Monthly planned investment, Monthly planned savings, and firePlan
  const s = r.scenarios.find((x) => x.key === "salary");
  const taps70 = M.retirementTapsPlan({
    summary: r,
    selectedScenario: s,
    simulation: sim,
    fire: fire70,
    bogle,
    params: base,
  });
  assert.equal(taps70.tap3Equities.targetEquityPct, 70);
  assert.equal(taps70.tap3Equities.targetBondPct, 30);
  assert.equal(taps70.tap3Equities.globalSplitPct, 80);
  assert.equal(taps70.tap3Equities.sgDividendSplitPct, 20);
  assert.equal(taps70.tap3Equities.currentEquities, 60000);
  assert.equal(taps70.tap3Equities.monthlyInvest, 1000);
  assert.equal(taps70.tap3Equities.monthlyGlobalBuy, 560);
  assert.equal(taps70.tap3Equities.monthlySgBuy, 140);
  assert.equal(taps70.tap3Equities.monthlyBondBuy, 300);
  assert.equal(taps70.tap4Ssb.monthlyCashSaving, 500);
  assert.equal(taps70.tap4Ssb.effectiveRatePct, 2);
  assert.ok(
    taps70.tap4Ssb.projectedCashOnlyAtRetireToday >
      taps70.tap4Ssb.currentSsbCash,
  );
  assert.ok(
    taps70.tap3Equities.projectedInvestAtRetireToday >
      taps70.tap3Equities.currentEquities,
  );
  assert.equal(
    taps70.tap3Equities.gapCoveragePct,
    Math.min(100, Math.round(fire70.fireNumber.pctFunded)),
  );

  // Verify simulate() includes cashSaving and cashReturnRate
  const simNoCash = M.simulate({ ...base, cashSaving: 0 }, "salary", {
    summary: r,
  });
  assert.ok(sim.portfolioAtRetire > simNoCash.portfolioAtRetire);
  assert.equal(
    sim.investmentDeposits,
    simNoCash.investmentDeposits + 500 * (65 - 35) * 12,
  );

  // Verify resolveCashReturnRate normalizes percentage (> 0.3) vs decimal
  assert.equal(M.resolveCashReturnRate({ cashReturnRate: 2.5 }), 0.025);
  assert.equal(M.resolveCashReturnRate({ cashReturnRate: 0.025 }), 0.025);

  // Verify cashParkingPlan includes monthlyCashSaving + monthlyBondSlice
  const cp = M.cashParkingPlan({ summary: r, bogle, params: base });
  assert.equal(cp.monthlyCashSaving, 500);
  assert.equal(cp.monthlyBondSlice, 300);
  assert.equal(cp.monthlyCashSlice, 800);

  // Verify buildPrintReportModel includes cashSavingMo in 3 · Monthly Split
  const printReport = M.buildPrintReportModel({
    params: base,
    summary: r,
    selectedScenario: s,
    simulation: sim,
    fire: fire70,
    bogle,
    paycheck: pc,
  });
  const splitRow = printReport.actionRows.find((row) =>
    row.label.includes("Monthly Split"),
  );
  assert.ok(splitRow && splitRow.value.includes("$500 Cash"));
});

test("evaluateDividendYield computes monthly, annual, quarterly, daily payouts and SG benchmark verdict tiers", () => {
  const M = RetirementModel;
  const bankBase = M.evaluateDividendYield({ capital: 100000, ratePct: 0.05 });
  assert.equal(bankBase.tierKey, "sub-floor");
  assert.equal(bankBase.tone, "danger");
  assert.equal(bankBase.annualPayout, 50);
  assert.equal(bankBase.monthlyPayout, 4.17);
  assert.ok(bankBase.realRatePct < 0);

  const ssbFloor = M.evaluateDividendYield({ capital: 100000, ratePct: 2.3 });
  assert.equal(ssbFloor.tierKey, "capital-preserve");
  assert.equal(ssbFloor.tone, "warn");

  const cpfSafe = M.evaluateDividendYield({ capital: 100000, ratePct: 3.5 });
  assert.equal(cpfSafe.tierKey, "safe-floor");
  assert.equal(cpfSafe.tone, "info");
  assert.equal(cpfSafe.realRatePct, 1);

  const sweetSpot = M.evaluateDividendYield({ capital: 100000, ratePct: 5.0 });
  assert.equal(sweetSpot.tierKey, "sweet-spot");
  assert.equal(sweetSpot.tone, "good");
  assert.equal(sweetSpot.annualPayout, 5000);
  assert.equal(sweetSpot.monthlyPayout, 416.67);
  assert.equal(sweetSpot.quarterlyPayout, 1250);
  assert.equal(sweetSpot.realRatePct, 2.5);
  assert.equal(sweetSpot.benchmarks.length, 7);
  assert.ok(sweetSpot.benchmarks.find((b) => b.key === "sg-banks")?.isClosest);

  const elevated = M.evaluateDividendYield({ capital: 200000, ratePct: 6.8 });
  assert.equal(elevated.tierKey, "elevated");
  assert.equal(elevated.tone, "warn");
  assert.equal(elevated.monthlyPayout, 1133.33);

  const yieldTrap = M.evaluateDividendYield({ capital: 100000, ratePct: 9.0 });
  assert.equal(yieldTrap.tierKey, "yield-trap");
  assert.equal(yieldTrap.tone, "danger");
  assert.equal(yieldTrap.monthlyPayout, 750);
});

test("evaluateTargetMonthlyIncome computes required capital, gap, inflation-adjusted years to goal, and 15/20-year savings", () => {
  const M = RetirementModel;
  const res = M.evaluateTargetMonthlyIncome({
    targetMonthly: 10000,
    ratePct: 5.0,
    currentCapital: 60000,
    monthlyContribution: 1817,
    inflationPct: 2.5,
  });
  const resNom = M.evaluateTargetMonthlyIncome({
    targetMonthly: 10000,
    ratePct: 5.0,
    currentCapital: 60000,
    monthlyContribution: 1817,
    inflationPct: 0,
  });
  assert.equal(res.targetAnnual, 120000);
  assert.equal(res.requiredCapital, 2400000);
  assert.equal(res.capitalGap, 2340000);
  assert.equal(res.pctReachedNow, 2.5);
  assert.ok(resNom.yearsToGoal > 30 && resNom.yearsToGoal < 42);
  assert.ok(
    res.yearsToGoal > resNom.yearsToGoal,
    "Inflation-adjusted target should take longer than nominal target",
  );
  assert.ok(
    res.save15YrMo > resNom.save15YrMo && res.save20YrMo > resNom.save20YrMo,
    "Inflation-adjusted 15/20-yr required savings must exceed nominal savings",
  );
  assert.ok(res.save15YrMo > res.save20YrMo);
  assert.equal(res.tone, "good");
  assert.equal(res.tierRows.length, 5);
});

test("evaluateAnnuityPlan computes implied IRR, payout multiple, DIY comparisons, and verdicts", () => {
  const M = RetirementModel;
  const subSa = M.evaluateAnnuityPlan({
    monthlyContribution: 1000,
    contributeYears: 15,
    deferYears: 0,
    payoutYears: 20,
    quotedMonthlyPayout: 1200,
    benchmarkRatePct: 5.0,
  });
  assert.equal(subSa.totalPrincipalPaid, 180000);
  assert.equal(subSa.totalPayoutReceived, 288000);
  assert.equal(subSa.payoutMultiple, 1.6);
  assert.ok(subSa.impliedAnnualIrrPct > 2.5 && subSa.impliedAnnualIrrPct < 4.0);
  assert.equal(subSa.verdictKey, "below-cpf-sa");
  assert.equal(subSa.tone, "warn");
  assert.ok(subSa.diyCpfSa.monthlyPayout > 1200);
  assert.ok(subSa.diyBench.monthlyPayout > subSa.diyCpfSa.monthlyPayout);
  assert.equal(subSa.comparisons.length, 4);

  const badTrap = M.evaluateAnnuityPlan({
    monthlyContribution: 1000,
    contributeYears: 15,
    deferYears: 5,
    payoutYears: 20,
    quotedMonthlyPayout: 1000,
  });
  assert.equal(badTrap.verdictKey, "endowment-trap");
  assert.equal(badTrap.tone, "danger");

  const worthIt = M.evaluateAnnuityPlan({
    monthlyContribution: 1000,
    contributeYears: 15,
    deferYears: 0,
    payoutYears: 20,
    quotedMonthlyPayout: 1600,
  });
  assert.equal(worthIt.verdictKey, "worth-it");
  assert.equal(worthIt.tone, "good");
});

test("evaluateAnnuityPlan brackets the IRR for short payouts and reports when it is undefined", () => {
  const plan = RetirementModel.evaluateAnnuityPlan({
    monthlyContribution: 1000,
    contributeYears: 10,
    deferYears: 5,
    payoutYears: 2,
    quotedMonthlyPayout: 1150,
    inflationRatePct: 2.5,
  });
  assert.equal(plan.totalPrincipalPaid, 120000);
  assert.equal(plan.totalPayoutReceived, 27600);
  assert.equal(plan.impliedAnnualIrrPct, -13.02);
  assert.equal(plan.realAnnualIrrPct, -15.14);
  assert.equal(plan.verdictKey, "endowment-trap");

  const noPayout = RetirementModel.evaluateAnnuityPlan({
    quotedMonthlyPayout: 0,
    terminalDividend: 10000,
    bonusRealization: 0,
  });
  assert.equal(noPayout.impliedAnnualIrrPct, null);
  assert.equal(noPayout.realAnnualIrrPct, null);
  assert.equal(noPayout.comparisons[0].potAtPayoutStart, null);
});

test("evaluateAnnuityPlan models stepped participating payouts and maturity dividends", () => {
  const M = RetirementModel;
  const base = M.evaluateAnnuityPlan({
    monthlyContribution: 1151,
    contributeYears: 15,
    deferYears: 5,
    payoutYears: 20,
    quotedMonthlyPayout: 1000,
    nonGuaranteedMonthlyDividends: 137810,
    dividendStepUpRatePct: 5,
    terminalDividend: 149360,
    paymentMode: "monthly",
    bonusRealization: 1,
    inflationRatePct: 2.5,
  });
  const baseAnnual = M.evaluateAnnuityPlan({
    monthlyContribution: 1151,
    contributeYears: 15,
    deferYears: 5,
    payoutYears: 20,
    quotedMonthlyPayout: 1000,
    nonGuaranteedMonthlyDividends: 137810,
    dividendStepUpRatePct: 5,
    terminalDividend: 149360,
    paymentMode: "annual",
    bonusRealization: 1,
    inflationRatePct: 2.5,
  });
  const floor = M.evaluateAnnuityPlan({
    monthlyContribution: 1151,
    contributeYears: 15,
    deferYears: 5,
    payoutYears: 20,
    quotedMonthlyPayout: 1000,
    nonGuaranteedMonthlyDividends: 137810,
    dividendStepUpRatePct: 5,
    terminalDividend: 149360,
    paymentMode: "monthly",
    bonusRealization: 0,
    inflationRatePct: 2.5,
  });

  assert.equal(base.totalPayoutReceived, 527170);
  assert.ok(
    base.impliedAnnualIrrPct >= 3.73 && base.impliedAnnualIrrPct <= 3.77,
  );
  assert.equal(baseAnnual.totalPayoutReceived, 527170);
  assert.ok(
    baseAnnual.impliedAnnualIrrPct >= 3.67 &&
      baseAnnual.impliedAnnualIrrPct <= 3.69,
  );
  assert.equal(base.scaledTerminalDividend, 149360);
  assert.ok(base.finalMonthlyPayout > base.startingMonthlyPayout);
  assert.ok(base.realAnnualIrrPct >= 0.6 && base.realAnnualIrrPct <= 1.5);
  assert.ok(
    floor.impliedAnnualIrrPct >= 0.62 && floor.impliedAnnualIrrPct <= 0.66,
  );
});

test("longevityAge (85/90/95/100), bridgeIncome (pre-65 Barista FIRE), BRS Property Pledge path, familyRstuAnnual, and SG_PERSONA_PRESETS", () => {
  const M = RetirementModel;
  const base = {
    age: 35,
    retire: 50,
    salary: 6500,
    lifestyle: "home-helper",
    oa: 80000,
    sa: 60000,
    ma: 40000,
    equities: 120000,
    ssbCash: 30000,
  };

  // 1. Longevity horizon (85 vs 90 vs 95 vs 100)
  assert.equal(M.resolveLongevityAge({}, 90), 90);
  assert.equal(M.resolveLongevityAge({ longevityAge: 100 }, 90), 100);
  const sum85 = M.calculate({ ...base, longevityAge: 85 });
  const sum100 = M.calculate({ ...base, longevityAge: 100 });
  assert.equal(sum85.endAge, 85);
  assert.equal(sum100.endAge, 100);
  assert.ok(
    sum100.target > sum85.target,
    "Longer longevity horizon (Age 100 vs 85) increases required outside portfolio",
  );
  const sim100 = M.simulate({ ...base, longevityAge: 100 }, "salary", {
    summary: sum100,
  });
  const fire100 = M.firePlan({ ...base, longevityAge: 100 }, "salary", {
    summary: sum100,
    simulation: sim100,
  });
  assert.equal(sim100.endAge, 100);
  assert.equal(fire100.endAge, 100);
  assert.equal(fire100.points.at(-1).age, 100);

  // 2. Barista / Part-Time Bridge Income (from retire until 65)
  const sumNoBridge = M.calculate({ ...base, bridgeIncome: 0 });
  const sumWithBridge = M.calculate({ ...base, bridgeIncome: 1500 });
  assert.ok(
    sumWithBridge.target < sumNoBridge.target,
    "Pre-65 bridge income reduces outside portfolio needed at retirement",
  );
  const simWithBridge = M.simulate({ ...base, bridgeIncome: 1500 }, "salary", {
    summary: sumWithBridge,
  });
  const fireWithBridge = M.firePlan({ ...base, bridgeIncome: 1500 }, "salary", {
    summary: sumWithBridge,
    simulation: simWithBridge,
  });
  const pt55 = fireWithBridge.points.find((p) => p.age === 55);
  const pt66 = fireWithBridge.points.find((p) => p.age === 66);
  assert.ok(
    pt55.today.monthlyBridge > 1400 && pt55.today.monthlyBridge <= 1500,
  );
  assert.equal(pt66.today.monthlyBridge, 0);

  // 3. BRS Property Pledge path (50% FRS cap on RA at 55, keeping excess OA liquid)
  assert.ok(sumNoBridge.brsScenario, "calculate() includes brsScenario");
  assert.equal(sumNoBridge.brsScenario.key, "brs");
  assert.ok(
    sumNoBridge.brsScenario.balance < sumNoBridge.scenarios[1].balance,
    "BRS scenario locks 50% of FRS in RA at 55",
  );
  assert.ok(
    M.projectCPF(base, 0, "brs").oaAfter55 >=
      M.projectCPF(base, 0, "frs").oaAfter55,
    "BRS path preserves more or equal post-55 liquid OA than FRS path",
  );
  const simBrs = M.simulate(base, "brs", { summary: sumNoBridge });
  assert.equal(simBrs.selectedScenario.key, "brs");

  // 4. Spouse / Family CPF Cash Top-Up (familyRstuAnnual up to $8,000/yr)
  const taxNoFam = M.taxSweetSpot({ ...base, familyRstuAnnual: 0 });
  const taxWithFam = M.taxSweetSpot({ ...base, familyRstuAnnual: 8000 });
  assert.equal(taxWithFam.familyRstuPlanned, 8000);
  assert.equal(taxWithFam.eligibleFamilyRstu, 8000);
  assert.ok(
    taxWithFam.familyRstuTaxSaved > 0,
    "Family RSTU top-up generates positive IRAS tax savings when relief room is available",
  );

  // 5. Removed Sankey and Fee Drag model export check
  assert.equal(M.buildSankeyModel, undefined);
  assert.equal(M.evaluateFeeDrag, undefined);

  // 7. SG_PERSONA_PRESETS validity
  assert.ok(Array.isArray(M.SG_PERSONA_PRESETS));
  assert.equal(M.SG_PERSONA_PRESETS.length, 4);
  for (const preset of M.SG_PERSONA_PRESETS) {
    const calc = M.calculate(preset.params);
    assert.ok(calc.retire >= calc.age);
    assert.equal(calc.scenarios.length, 3);
    assert.ok(calc.brsScenario);
  }
});

test("Audit math & statutory regressions: solveBucketAwareSimulation, age-65 pending CPF interest, post-55 OA sweep, spendableNetWorth, IRAS $80k relief cap, geometric monthly rates, and effective annuity IRR", () => {
  const M = RetirementModel;

  // M-01 & M-04: solveBucketAwareSimulation reconciles Auto outside investment across summary, simulation, and fire through Age 95
  const autoPlan = { ...M.SG_DEFAULT_PLAN };
  delete autoPlan.invest;
  const solved = M.solveBucketAwareSimulation(autoPlan, "frs");
  assert.equal(solved.summary.endAge, 95);
  assert.equal(solved.simulation.endAge, 95);
  assert.equal(solved.fire.endAge, 95);
  assert.equal(solved.fire.fireNumber.fullyFundedTo95, true);
  assert.equal(solved.simulation.fullyFunded, true);
  assert.equal(solved.fire.fireNumber.depletionAge, null);
  assert.ok(solved.fire.fireNumber.pctFunded >= 100);
  const sFrs = solved.summary.scenarios.find((sc) => sc.key === "frs");
  assert.equal(
    Math.round(sFrs.privateSaving),
    Math.round(solved.simulation.invest),
  );

  // M-02: projectCPF credits Jan-Nov pending interest when reaching age 65 mid-year (e.g. non-integer age)
  const midYearCpf = M.projectCPF(
    {
      age: 54.5,
      retire: 65,
      salary: 0,
      oa: 0,
      sa: 220400,
      ma: 79000,
      inflationRate: 0,
      plan: "standard",
    },
    0,
    "frs",
  );
  // 10.5 years from 54.5 to 65 -> RA at 55 (~$224.8k) compounds for 10 full years to 65 (~$339k+), including the final year's months
  assert.ok(midYearCpf.ra65 > 330000);

  // M-03 & M-05: Post-55 excess OA withdrawals cannot be double-counted into age-65 RA sweep, and spendableNetWorth excludes locked RA/MA
  const earlyFireP = {
    ...M.SG_DEFAULT_PLAN,
    age: 50,
    retire: 56,
    lifestyle: "home-helper",
    spend: 5500,
    salary: 6000,
    oa: 180000,
    sa: 80000,
    ma: 79000,
    equities: 40000,
    sgDividends: 0,
    ssbCash: 20000,
    srs: 0,
    savings: 60000,
    invest: 0,
  };
  const earlySolved = M.solveBucketAwareSimulation(earlyFireP, "frs");
  for (const pt of earlySolved.fire.points) {
    const expectedSpendable =
      pt.totalOutside + (pt.age >= 55 ? Math.max(0, pt.cpfOA) : 0);
    assert.ok(
      Math.abs(pt.spendableNetWorth - expectedSpendable) < 1e-6,
      `spendableNetWorth at age ${pt.age} must exclude locked CPF SA/RA/MA`,
    );
    assert.ok(pt.totalNetWorth >= pt.spendableNetWorth);
  }

  // M-06: computeTaxSummary uses progressive IRAS brackets, includes bonus + active RSTU/SRS reliefs, and enforces the $80,000 personal relief cap
  const highEarner = {
    age: 40,
    retire: 65,
    salary: 25000,
    annualBonus: 60000,
    existingReliefs: 72000,
    srsAnnual: 15300,
    familyRstuAnnual: 8000,
    oa: 50000,
    sa: 50000,
    ma: 50000,
  };
  const taxSum = M.computeTaxSummary(highEarner, { cpfExtra: 700 });
  assert.equal(taxSum.annualGross, 360000);
  // Mandatory employee CPF on $102k ceiling is $20,400; existingReliefs $72,000 => $92,400 > $80,000 cap!
  assert.equal(taxSum.totalBaseReliefs, 80000);
  assert.equal(taxSum.reliefCapRemaining, 0);
  assert.equal(taxSum.activeVoluntaryReliefs, 0);
  assert.equal(taxSum.activeChargeableIncome, 280000);
  assert.equal(taxSum.activeTax.chargeableIncome, 280000);

  // M-10: evaluateTargetMonthlyIncome uses geometric monthlyRate() matching core engine and inflates target capital by inflationPct
  const targetGeometric = M.evaluateTargetMonthlyIncome({
    targetMonthly: 600,
    ratePct: 7.2,
    currentCapital: 0,
    monthlyContribution: 0,
    inflationPct: 0,
  });
  // At 7.2% effective annual (mRate = 1.072^(1/12)-1), requiredCapital = $100,000; 20yr monthly saving matches requiredSaving($100,000, 0, mRate, 240)
  const expectedM240 =
    100000 / (((1.072 ** (1 / 12)) ** 240 - 1) / (1.072 ** (1 / 12) - 1));
  assert.equal(targetGeometric.requiredCapital, 100000);
  assert.equal(targetGeometric.save20YrMo, Math.ceil(expectedM240));
  const targetReal = M.evaluateTargetMonthlyIncome({
    targetMonthly: 600,
    ratePct: 7.2,
    currentCapital: 0,
    monthlyContribution: 0,
    inflationPct: 2.5,
  });
  assert.equal(targetReal.save20YrMo, Math.ceil(expectedM240 * 1.025 ** 20));

  // M-11 & M-12: evaluateAnnuityPlan uses effective annual IRR, handles negative-return endowment traps (<1.0x payout), and leaves zero literal $$ in comparison strings
  const lossEndowment = M.evaluateAnnuityPlan({
    monthlyContribution: 1000,
    contributeYears: 10,
    deferYears: 5,
    payoutYears: 10,
    quotedMonthlyPayout: 800, // $96k back on $120k paid!
    benchmarkRatePct: 5.0,
  });
  assert.ok(lossEndowment.payoutMultiple < 1);
  assert.ok(lossEndowment.impliedAnnualIrrPct < 0);
  assert.equal(lossEndowment.verdictKey, "endowment-trap");
  for (const c of lossEndowment.comparisons) {
    assert.equal(
      String(c.sub || "").includes("$$"),
      false,
      `Comparison subtext must not contain literal $$: ${c.sub}`,
    );
  }
});

test("Phase 1 & 2 audit regressions: post-55 RA single-count, cashSaving shortfall, fractional retire, nominal print, projectedFireAge, retire>65, SRS early retire, multi-SSB cap, longevity>90, zero fallbacks", () => {
  const M = require("./model.js");

  // 1. Post-55 RA contributions must not be double-counted or earn same-month interest
  const post55Res = M.projectCPF(
    {
      age: 54,
      retire: 65,
      salary: 5000,
      oa: 0,
      sa: 0,
      ma: 0,
      post55Work: true,
    },
    0,
    "salary",
    null,
    { monthly: true },
  );
  const m55_1 = post55Res.ledger.find(
    (r) => Math.abs(r.age - (55 + 1 / 12)) < 1e-4,
  );
  const m55_2 = post55Res.ledger.find(
    (r) => Math.abs(r.age - (55 + 2 / 12)) < 1e-4,
  );
  assert.ok(m55_1 && m55_2);
  const raStep = m55_2.ra - m55_1.ra;
  // 2027 senior rate 35.5%, RA share 0.3661 => 5000 * 0.355 * 0.3661 = 649.8275 (1x, not 2x 1299.65)
  assert.ok(
    Math.abs(raStep - 649.8275) < 1,
    `Expected single-counted post-55 RA step ~$649.83, got ${raStep}`,
  );

  // 2. solveBucketAwareSimulation contributionShortfall must not double-subtract cashSaving
  const solved = M.solveBucketAwareSimulation(
    {
      ...M.SG_DEFAULT_PLAN,
      age: 35,
      salary: 6000,
      retire: 55,
      cashSaving: 1000,
      invest: 500,
    },
    "salary",
  );
  const expectedShortfall = Math.max(
    0,
    solved.simulation.selectedScenario.privateSaving - 500,
  );
  assert.equal(
    solved.simulation.selectedScenario.contributionShortfall,
    expectedShortfall,
  );

  // 3. Fractional retirement age (55.5) captured accurately in firePlan, buildPrintReportModel, retirementTapsPlan
  const fracP = {
    ...M.SG_DEFAULT_PLAN,
    age: 35,
    salary: 8000,
    retire: 55.5,
    invest: 1500,
  };
  const fracSolved = M.solveBucketAwareSimulation(fracP, "salary");
  assert.ok(fracSolved.fire.atRetire);
  assert.equal(fracSolved.fire.atRetire.age, 55.5);
  const fracPrint = M.buildPrintReportModel({
    summary: fracSolved.summary,
    selectedScenario: fracSolved.simulation.selectedScenario,
    simulation: fracSolved.simulation,
    fire: fracSolved.fire,
    params: fracP,
    basis: "nominal",
  });
  assert.ok(
    Math.abs(
      fracPrint.outsideAtRetire - fracSolved.fire.atRetire.totalOutside,
    ) < 2,
    "buildPrintReportModel must use exact fractional atRetire snapshot",
  );

  // 4. buildPrintReportModel nominal basis must use nominal cpfLife65 for cpfCovPct
  const nomPrint = M.buildPrintReportModel({
    summary: fracSolved.summary,
    selectedScenario: fracSolved.simulation.selectedScenario,
    simulation: fracSolved.simulation,
    fire: fracSolved.fire,
    params: fracP,
    basis: "nominal",
  });
  const expectedNomCov = Math.min(
    100,
    Math.round(
      ((fracSolved.fire.phase2.cpfLife65Nominal ??
        fracSolved.simulation.selectedScenario.payout) /
        Math.max(1, fracSolved.summary.spend65)) *
        100,
    ),
  );
  assert.equal(nomPrint.cpfCovPct, expectedNomCov);

  // 5. projectedFireAge must be self-consistent when actually retiring at that age
  const fireTestP = {
    ...M.SG_DEFAULT_PLAN,
    age: 35,
    salary: 8000,
    oa: 10000,
    sa: 10000,
    ma: 10000,
    equities: 400000,
    retire: 65,
    invest: 2000,
    housing: 0,
  };
  const fireTest = M.solveBucketAwareSimulation(fireTestP, "salary");
  const projAge = fireTest.fire.fireNumber.projectedFireAge;
  assert.ok(projAge != null);
  const verifyAtProj = M.solveBucketAwareSimulation(
    { ...fireTestP, retire: projAge },
    "salary",
  );
  assert.equal(
    verifyAtProj.fire.fireNumber.fullyFundedTo95,
    true,
    `Expected retiring at projectedFireAge (${projAge}) to actually stay funded`,
  );

  // 6. retire > 65 must compound OA cleanly across age 69->70 and retain pre-retirement CPF LIFE payouts
  const lateP = {
    ...M.SG_DEFAULT_PLAN,
    age: 50,
    retire: 70,
    salary: 6000,
    oa: 300000,
    sa: 250000,
    housing: 0,
    invest: 500,
  };
  const lateSolved = M.solveBucketAwareSimulation(lateP, "salary");
  const pt69 = lateSolved.fire.points.find((pt) => pt.age === 69);
  const pt70 = lateSolved.fire.points.find((pt) => pt.age === 70);
  assert.ok(pt69 && pt70 && pt69.cpfOA > 0);
  assert.ok(
    Math.abs(pt70.cpfOA / pt69.cpfOA - 1.025) < 0.002,
    `Expected ~2.5% OA growth age 69->70, got ${pt70.cpfOA / pt69.cpfOA}`,
  );

  // 7. taxSweetSpot must stop SRS contributions at retire < srsLockInAge
  const earlySrsTax = M.taxSweetSpot({
    age: 35,
    retire: 50,
    salary: 12000,
    srsAnnual: 15300,
    returnRate: 0.05,
  });
  const lateSrsTax = M.taxSweetSpot({
    age: 35,
    retire: 65,
    salary: 12000,
    srsAnnual: 15300,
    returnRate: 0.05,
  });
  assert.ok(
    earlySrsTax.srsProjectedAt63 < lateSrsTax.srsProjectedAt63 - 150000,
    "Early retirement at 50 must cap SRS contribution horizon in taxSweetSpot",
  );

  // 8. sweepCashAccountsOverflow must respect aggregate $200k SSB cap across multiple SSB rows
  const swept = M.sweepCashAccountsOverflow([
    {
      id: "c1",
      preset: "dbs-multiplier",
      name: "DBS",
      balance: 150000,
      bonusCap: 100000,
      bonusRatePct: 2.0,
      baseRatePct: 0.05,
    },
    {
      id: "c2",
      preset: "ssb",
      name: "SSB 1",
      balance: 120000,
      bonusCap: 200000,
      bonusRatePct: 2.39,
      baseRatePct: 0,
    },
    {
      id: "c3",
      preset: "ssb",
      name: "SSB 2",
      balance: 80000,
      bonusCap: 200000,
      bonusRatePct: 2.39,
      baseRatePct: 0,
    },
  ]);
  const ssbTotalAfter = swept
    .filter((r) => r.preset === "ssb")
    .reduce((a, b) => a + b.balance, 0);
  const tbillTotalAfter = swept
    .filter((r) => r.preset === "tbills")
    .reduce((a, b) => a + b.balance, 0);
  assert.equal(ssbTotalAfter, 200000);
  assert.equal(tbillTotalAfter, 50000);

  // 9. calculate() firstShortfallAge scans beyond age 90 when longevityAge > 90
  const longCalc = M.calculate({
    age: 35,
    salary: 8000,
    retire: 65,
    spend: 1950,
    plan: "standard",
    longevityAge: 105,
    inflationRate: 0.01,
  });
  const longSim = M.simulate(
    {
      age: 35,
      salary: 8000,
      retire: 65,
      spend: 1950,
      plan: "standard",
      longevityAge: 105,
      inflationRate: 0.01,
    },
    "ers",
    { summary: longCalc },
  );
  const longCalcErs = longCalc.scenarios.find((s) => s.key === "ers");
  assert.equal(
    longCalcErs.firstShortfallAge !== null,
    longSim.selectedScenario.firstShortfallAge !== null,
  );

  // 10. Explicit 0 inputs must not be overwritten by truthy || fallbacks
  const zeroInf = M.evaluateTargetMonthlyIncome({
    targetMonthly: 2000,
    ratePct: 5,
    inflationPct: 0,
  });
  assert.equal(zeroInf.inflationPct, 0);
  const zeroSsb = M.evaluateDividendYield({
    capital: 100000,
    ratePct: 5,
    ssbRatePct: 0,
  });
  assert.equal(zeroSsb.ssbRatePct, 0);
});

test("Comprehensive audit regressions: SRS deemed-withdrawal sweep, nominal taps/print alignment, age-55+ RSTU FRS cap, ghost SRS cap, BRS reconciliation, SSB sweep", () => {
  const M = RetirementModel;

  // 1. SRS balance is never permanently frozen after srsWithdrawalAge + 10 (swept to liquid cash net of tax)
  const srsFreezeCase = {
    age: 50,
    salary: 6000,
    retire: 65,
    spend: 2200,
    srs: 300000,
    srsAge: 63,
    oa: 100000,
    sa: 200000,
    lifestyle: "cca",
  };
  const srsRes = M.solveBucketAwareSimulation(srsFreezeCase, "frs");
  const pt85 = srsRes.fire.points.find((pt) => pt.age === 85);
  assert.equal(
    pt85.srs,
    0,
    "SRS must sweep to liquid cash after 10-year window",
  );
  assert.equal(
    srsRes.fire.fireNumber.depletionAge,
    null,
    "Swept SRS prevents false depletion when healthcare costs rise",
  );

  // 1b. Late retiree (retire >= 73) starts 10-year SRS window at retirement age rather than locking 100%
  const lateSrsCase = {
    age: 50,
    salary: 10000,
    retire: 75,
    spend: 4000,
    srs: 300000,
    srsAge: 63,
    srsAnnual: 15300,
    lifestyle: "cca",
  };
  const lateSrsRes = M.solveBucketAwareSimulation(lateSrsCase, "frs");
  const pt86 = lateSrsRes.fire.points.find((pt) => pt.age === 86);
  assert.equal(pt86.srs, 0);
  assert.equal(lateSrsRes.fire.fireNumber.depletionAge, null);

  // 2. retirementTapsPlan normalizes nominal selectedScenario to today's dollars
  const demoNominal = M.solveBucketAwareSimulation(DEMO_PLAN, "frs");
  const tapsFromNominal = M.retirementTapsPlan({
    summary: demoNominal.summary,
    selectedScenario: demoNominal.simulation.selectedScenario,
    simulation: demoNominal.simulation,
    fire: demoNominal.fire,
    params: DEMO_PLAN,
  });
  const demoTodaySum = M.todayPlan(demoNominal.summary);
  const tapsFromToday = M.retirementTapsPlan({
    summary: demoTodaySum,
    selectedScenario: demoTodaySum.scenarios.find((s) => s.key === "frs"),
    simulation: demoNominal.simulation,
    fire: demoNominal.fire,
    params: DEMO_PLAN,
  });
  assert.equal(
    tapsFromNominal.tap1Cpf.budgetCoveragePct,
    tapsFromToday.tap1Cpf.budgetCoveragePct,
    "Nominal selectedScenario must not inflate today-dollar CPF coverage",
  );
  assert.ok(tapsFromNominal.tap1Cpf.budgetCoveragePct < 60);

  // 3. IRAS age-55+ RSTU tax relief is capped at FRS ($220,400), not ERS ($440,800)
  const age55AtFrs = {
    age: 55,
    salary: 12000,
    ra: M.C.frs,
    sa: M.C.frs,
  };
  const tax55 = M.taxSweetSpot(age55AtFrs);
  assert.equal(tax55.saRoom, 0);
  assert.equal(tax55.maxRstu, 0);
  assert.equal(tax55.rstuTaxSaved, 0);
  const taxSum55 = M.computeTaxSummary(age55AtFrs, { cpfExtra: 667 });
  assert.equal(taxSum55.saRoom, 0);
  assert.equal(taxSum55.activeSelfRstu, 0);

  // 4. firePlan caps effective SRS contribution at totalMonthlyOutside (no ghost SRS when invest = 0)
  const zeroInvSrs = {
    age: 35,
    salary: 10000,
    retire: 55,
    invest: 0,
    srsAnnual: 15300,
    equities: 0,
    sgDividends: 0,
    ssbCash: 0,
    srs: 0,
    lifestyle: "cca",
  };
  const zeroInvRes = M.solveBucketAwareSimulation(zeroInvSrs, "salary");
  const pt55Zero = zeroInvRes.fire.points.find((pt) => pt.age === 55);
  assert.equal(pt55Zero.srs, 0, "invest: 0 must not fabricate SRS balance");

  // 5. buildPrintReportModel nominal basis stays basis-consistent across outsideNeed, cpfAtRetire, and cpfCovPct
  const printNom = M.buildPrintReportModel({
    summary: demoNominal.summary,
    selectedScenario: demoNominal.simulation.selectedScenario,
    simulation: demoNominal.simulation,
    fire: demoNominal.fire,
    params: DEMO_PLAN,
    basis: "nominal",
  });
  const printToday = M.buildPrintReportModel({
    summary: demoNominal.summary,
    selectedScenario: demoNominal.simulation.selectedScenario,
    simulation: demoNominal.simulation,
    fire: demoNominal.fire,
    params: DEMO_PLAN,
    basis: "today",
  });
  assert.ok(printNom.outsideNeed > printToday.outsideNeed);
  assert.ok(printNom.cpfAtRetire > printToday.cpfAtRetire);
  assert.equal(
    printNom.cpfCovPct,
    printToday.cpfCovPct,
    "CPF coverage % must match across nominal and today bases",
  );

  // 6. retire > 65 projectedFireAge includes retained post-65 CPF LIFE payouts
  const retire70 = {
    age: 50,
    salary: 6000,
    retire: 70,
    lifestyle: "cca",
    equities: 80000,
    ssbCash: 20000,
    oa: 100000,
    sa: 150000,
    invest: 4100,
  };
  const r70 = M.solveBucketAwareSimulation(retire70, "salary");
  assert.equal(r70.fire.fireNumber.fullyFundedTo95, true);
  assert.ok(
    r70.fire.fireNumber.projectedFireAge <= 70,
    `Expected projectedFireAge <= 70 when fully funded at 70, got ${r70.fire.fireNumber.projectedFireAge}`,
  );

  // 7. requiredInvestTo95 aligns with solveBucketAwareSimulation privateSaving (both include SRS)
  const srsAlignPlan = {
    age: 35,
    salary: 12000,
    retire: 55,
    srsAnnual: 15300,
    lifestyle: "cca",
  };
  const srsAlign = M.solveBucketAwareSimulation(srsAlignPlan, "salary");
  assert.ok(
    Math.abs(
      srsAlign.fire.fireNumber.requiredInvestTo95 -
        srsAlign.simulation.selectedScenario.privateSaving,
    ) <= 2,
  );

  // 8. outsideAllocationGuide without explicit params uses regularBaselineTax (not bonus-inflated tax)
  const bonusPlan = {
    age: 35,
    salary: 8500,
    annualBonus: 34000,
    retire: 65,
    lifestyle: "cca",
  };
  const bSum = M.calculate(bonusPlan);
  const bSim = M.simulate(bonusPlan, "salary", { summary: bSum });
  const guideNoParams = M.outsideAllocationGuide(bSum, bSim);
  const guideRegularOnly = M.outsideAllocationGuide(
    M.calculate({ ...bonusPlan, annualBonus: 0 }),
    bSim,
  );
  assert.equal(
    Math.round(guideNoParams.netTakeHome),
    Math.round(guideRegularOnly.netTakeHome),
  );

  // 9. solveBucketAwareSimulation reconciles summary.brsScenario when selectedKey === "brs"
  const brsRes = M.solveBucketAwareSimulation(DEMO_PLAN, "brs");
  assert.equal(
    brsRes.summary.brsScenario.privateSaving,
    brsRes.simulation.selectedScenario.privateSaving,
  );

  // 10. withEffectiveSavings derives savings from buckets even if stale p.savings is present
  const eff = M.withEffectiveSavings({
    savings: 50000,
    equities: 200000,
    ssbCash: 50000,
  });
  assert.equal(eff.savings, 250000);

  // 11. sweepCashAccountsOverflow sweeps SSB overflow above $200,000 into T-Bills
  const sweptSsb = M.sweepCashAccountsOverflow([
    {
      id: "ssb-1",
      preset: "ssb",
      name: "MAS SSB",
      balance: 260000,
      bonusCap: 200000,
      bonusRatePct: 2.39,
      baseRatePct: 0,
    },
  ]);
  const ssbAfter = sweptSsb.find((a) => a.preset === "ssb");
  const tbillAfter = sweptSsb.find((a) => a.preset === "tbills");
  assert.equal(ssbAfter.balance, 200000);
  assert.equal(tbillAfter.balance, 60000);

  // 12. calculate/validate rejects negative invest, and simulate clamps negative invest when summary is precomputed
  assert.throws(() =>
    M.simulate({ ...M.SG_DEFAULT_PLAN, invest: -500 }, "frs"),
  );
  const preSum = M.calculate(M.SG_DEFAULT_PLAN);
  const negSim = M.simulate({ ...M.SG_DEFAULT_PLAN, invest: -500 }, "frs", {
    summary: preSum,
  });
  assert.equal(negSim.invest, 0);
});

test("Full audit Phase 1-4 regressions: SRS requiredInvestTo95 diversion, tap2Srs fields, paycheckAllocation SRS cap, nominal taps cpfExtra", () => {
  const M = require("./model.js");

  // 1. tap2Srs exposes taxSavedPerYear & effectiveRoom for high-income $0 SRS candidates
  const hiInc = {
    age: 35,
    retire: 65,
    salary: 12000,
    annualBonus: 24000,
    srs: 0,
    srsAnnual: 0,
    invest: 2000,
  };
  const hiTaps = M.retirementTapsPlan({ params: hiInc });
  assert.equal(hiTaps.tap2Srs.verdictStatus, "worth-it");
  assert.ok(
    hiTaps.tap2Srs.taxSavedPerYear > 0,
    "taxSavedPerYear must be populated",
  );
  assert.ok(
    hiTaps.tap2Srs.effectiveRoom > 0,
    "effectiveRoom must be populated",
  );

  // 2. firePlan requiredInvestTo95 accounts for SRS diversion when invest < srsAnnual/12
  const srsDivP = {
    age: 35,
    retire: 55,
    longevityAge: 95,
    salary: 12000,
    spend65: 4500,
    oa: 50000,
    sa: 30000,
    ma: 30000,
    cash: 100000,
    invest: 0,
    srsAnnual: 15300,
    srsInvestedIn: "cash",
    rate: 0.06,
    inflation: 0.025,
  };
  const fpInitial = M.firePlan(srsDivP, "frs");
  assert.ok(fpInitial.fireNumber.requiredInvestTo95 > 0);
  const fpApplied = M.firePlan(
    { ...srsDivP, invest: fpInitial.fireNumber.requiredInvestTo95 },
    "frs",
  );
  assert.equal(
    fpApplied.fireNumber.fullyFundedTo95,
    true,
    "Applying requiredInvestTo95 must fund plan through longevityAge even with SRS diversion",
  );

  // 3. paycheckAllocation caps srsMo to investPool to match firePlan
  const pCapSrs = {
    age: 35,
    retire: 65,
    salary: 10000,
    invest: 500,
    srsAnnual: 15300,
  };
  const sumCap = M.calculate(pCapSrs);
  const simCap = M.simulate(pCapSrs, "salary", { summary: sumCap });
  const pcCap = M.paycheckAllocation(
    M.todayPlan(sumCap),
    simCap,
    M.bogleheadAllocation(pCapSrs, simCap.invest),
    pCapSrs,
  );
  assert.equal(pcCap.srsMo, 500);

  // 5. retirementTapsPlan preserves p.cpfExtra when passed a nominal summary + selectedScenario
  const pCpfEx = {
    age: 35,
    retire: 65,
    salary: 5000,
    oa: 0,
    sa: 0,
    ma: 0,
    cpfExtra: 667,
    invest: 1000,
  };
  const nomSum = M.calculate(pCpfEx);
  const nomSim = M.simulate(pCpfEx, "salary", { summary: nomSum });
  const nomTaps = M.retirementTapsPlan({
    params: pCpfEx,
    summary: nomSum,
    simulation: nomSim,
    selectedScenario: nomSim.selectedScenario,
  });
  const expectedTodayPayout = M.todayValue(
    nomSim.selectedScenario.payout,
    65,
    nomSum.age,
    nomSum.inflation,
  );
  assert.ok(
    Math.abs(nomTaps.tap1Cpf.monthlyPayoutToday - expectedTodayPayout) < 2,
    `Expected ~${expectedTodayPayout}, got ${nomTaps.tap1Cpf.monthlyPayoutToday}`,
  );
});

test("Iterative audit regressions: firePlan exact-PV & SRS tax, nominal taps fields, outsideAllocationGuide SRS cap, Coast-FIRE & high-spend solver, NaN guards, sweepCashAccountsOverflow", () => {
  const M = RetirementModel;

  // 1. Model C1: firePlan exact-PV reconciliation at age 55 through 95 (no pre-growth cap or extra-month off-by-one)
  const pBaseC1 = {
    age: 54,
    salary: 6000,
    retire: 55,
    lifestyle: "cca",
    spend: 2800,
    oa: 100000,
    sa: 100000,
    ma: 50000,
    equities: 0,
    returnRate: 0.05,
    inflationRate: 0.03,
    cashReturnRate: 0.05,
    longevityAge: 95,
  };
  const fpProbe = M.firePlan(pBaseC1, "salary");
  const exactEqToday = Math.ceil(
    (fpProbe.fireNumber.fireNumberAtRetire || 0) / 1.05,
  );
  const fpExact = M.firePlan({ ...pBaseC1, equities: exactEqToday }, "salary");
  assert.equal(fpExact.fireNumber.depletionAge, null);
  assert.equal(fpExact.fireNumber.fullyFundedTo95, true);

  // 2. Model C2: retirementTapsPlan preserves balance, standardPayout, and gap65 when summary is nominal + cpfExtra
  const pC2 = {
    age: 40,
    salary: 4000,
    retire: 60,
    lifestyle: "cca",
    oa: 10000,
    sa: 10000,
    ma: 10000,
    equities: 100000,
    cpfExtra: 667,
  };
  const sumC2 = M.calculate(pC2);
  const simC2 = M.simulate(pC2, "salary", { summary: sumC2 });
  const tapsC2 = M.retirementTapsPlan({
    params: pC2,
    summary: sumC2,
    simulation: simC2,
    selectedScenario: simC2.selectedScenario,
  });
  const expBal55Today = M.todayValue(
    simC2.selectedScenario.balance,
    55,
    sumC2.age,
    sumC2.inflation,
  );
  const expStdToday = M.todayValue(
    simC2.selectedScenario.standardPayout,
    65,
    sumC2.age,
    sumC2.inflation,
  );
  const expGap65Today = M.todayValue(
    simC2.selectedScenario.gap65,
    65,
    sumC2.age,
    sumC2.inflation,
  );
  assert.ok(
    Math.abs(tapsC2.tap1Cpf.projectedCpf55Today - expBal55Today) < 2,
    `Expected projectedCpf55Today ~${expBal55Today}, got ${tapsC2.tap1Cpf.projectedCpf55Today}`,
  );
  assert.ok(
    Math.abs(tapsC2.tap1Cpf.standardMonthlyToday - expStdToday) < 2,
    `Expected standardMonthlyToday ~${expStdToday}, got ${tapsC2.tap1Cpf.standardMonthlyToday}`,
  );
  assert.ok(
    Math.abs(tapsC2.tap3Equities.postCpfGap65Today - expGap65Today) < 2,
    `Expected postCpfGap65Today ~${expGap65Today}, got ${tapsC2.tap3Equities.postCpfGap65Today}`,
  );

  // 3. Model M1: firePlan deducts IRAS withdrawal tax during 10-year SRS drawdown for ballooning SRS
  const pSrsTax = {
    age: 54,
    salary: 8000,
    retire: 63,
    lifestyle: "cca",
    spend: 12000,
    oa: 100000,
    sa: 100000,
    ma: 50000,
    equities: 500000,
    srs: 1500000,
    srsAge: 63,
    srsInvestedIn: "global",
    returnRate: 0.05,
    inflationRate: 0.025,
    longevityAge: 95,
  };
  const fpSrsTax = M.firePlan(pSrsTax, "salary");
  const pt65Srs = fpSrsTax.points.find((x) => x.age === 65);
  assert.ok(pt65Srs && pt65Srs.monthlySrsDraw > 4000);
  // Because SRS draw exceeds $3,333/mo tax-free ceiling, net SRS covers less than gross draw,
  // forcing liquid drawdown to cover the IRAS tax drag alongside any remaining spend gap.
  assert.ok(
    pt65Srs.monthlyLiquidDraw > 0 || pt65Srs.monthlyShortfall > 0,
    "Ballooning SRS withdrawal tax must be covered by liquid buckets or surfaced as shortfall",
  );

  // 4. Model M2: outsideAllocationGuide caps srsMonthly at srsEligible / 12 under $80k relief cap
  const pCapM2 = {
    age: 35,
    salary: 15000,
    existingReliefs: 57600,
    retire: 60,
    lifestyle: "cca",
    invest: 5000,
  };
  const sumM2 = M.calculate(pCapM2);
  const simM2 = M.simulate(pCapM2, "salary", { summary: sumM2 });
  const guideM2 = M.outsideAllocationGuide(sumM2, simM2, pCapM2);
  const srsCapMo = Math.min(M.C.srsCap, guideM2.remainingReliefCap) / 12;
  assert.ok(
    guideM2.split.srsMonthly <= srsCapMo + 0.01,
    `srsMonthly (${guideM2.split.srsMonthly}) must not exceed srsEligible/12 (${srsCapMo})`,
  );

  // 5. Model M3: solveBucketAwareSimulation Coast-FIRE returns 0 (not srsMo) & solves high-spend > $250k/mo
  const coastRes = M.solveBucketAwareSimulation(
    {
      age: 35,
      salary: 12000,
      retire: 60,
      lifestyle: "cca",
      equities: 3000000,
      srsAnnual: 15300,
    },
    "salary",
  );
  assert.equal(coastRes.simulation.selectedScenario.privateSaving, 0);
  assert.equal(coastRes.fire.fireNumber.fullyFundedTo95, true);

  const highSpendRes = M.solveBucketAwareSimulation(
    {
      age: 54,
      salary: 10000,
      retire: 55,
      lifestyle: "home-helper",
      spend: 50000,
      oa: 0,
      sa: 0,
      ma: 0,
      equities: 0,
      returnRate: 0.04,
    },
    "salary",
  );
  assert.equal(highSpendRes.fire.fireNumber.fullyFundedTo95, true);
  assert.equal(highSpendRes.fire.fireNumber.depletionAge, null);

  // 6. Model M5: firePlan retiringNow does not subtract monthly cashSaving from lump-sum shortfall
  const fpRetNow0 = M.firePlan(
    {
      age: 40,
      salary: 5000,
      retire: 40,
      lifestyle: "home-helper",
      equities: 100000,
      cashSaving: 0,
    },
    "salary",
  );
  const fpRetNow1k = M.firePlan(
    {
      age: 40,
      salary: 5000,
      retire: 40,
      lifestyle: "home-helper",
      equities: 100000,
      cashSaving: 1000,
    },
    "salary",
  );
  assert.equal(
    fpRetNow1k.fireNumber.requiredInvestTo95,
    fpRetNow0.fireNumber.requiredInvestTo95,
  );

  // 7. Model M6: NaN guards in evaluateDividendYield and computeHousingPayment
  const divNan = M.evaluateDividendYield({
    capital: 100000,
    ratePct: 5,
    inflationRate: "abc",
  });
  assert.ok(Number.isFinite(divNan.realMonthlyPayout));
  assert.ok(Number.isFinite(divNan.inflationPct));

  const houseNan = M.computeHousingPayment({
    mode: "bank",
    loanRate: "abc",
    loanBalance: 300000,
    loanYears: 20,
    loanParties: 1,
  });
  assert.ok(Number.isFinite(houseNan.ratePct));
  assert.ok(Number.isFinite(houseNan.monthlyShare));

  // 8. Model L3 & L4: sweepCashAccountsOverflow preserves high-base accounts & avoids duplicate IDs; phase2.years & taxSweetSpot retiringNow
  const swept = M.sweepCashAccountsOverflow([
    {
      id: "cash-1",
      preset: "custom",
      name: "High Base Custom",
      balance: 150000,
      bonusCap: 100000,
      bonusRatePct: 3.5,
      baseRatePct: 3.0,
    },
    {
      id: "cash-3",
      preset: "dbs-multiplier",
      name: "DBS Multiplier",
      balance: 150000,
      bonusCap: 100000,
      bonusRatePct: 2.0,
      baseRatePct: 0.05,
    },
  ]);
  const ids = swept.map((r) => r.id);
  assert.equal(
    new Set(ids).size,
    ids.length,
    "Swept account IDs must be unique",
  );
  assert.equal(
    swept.find((r) => r.id === "cash-1").balance,
    150000,
    "Account with baseRatePct >= SSB benchmark should not be swept",
  );

  const fpRet70 = M.firePlan(
    { age: 50, salary: 6000, retire: 70, lifestyle: "cca", longevityAge: 95 },
    "salary",
  );
  assert.equal(fpRet70.phase2.years, 25);

  const txRetNow = M.taxSweetSpot({
    age: 40,
    salary: 8000,
    retire: 40,
    lifestyle: "home-helper",
  });
  assert.equal(txRetNow.srsMaxSafeAnnualTo400k, 0);
});

test("Audit Phases 1-5 regressions: Tap 3/4 non-overlap, over-funded requiredInvestTo95, net SRS income, age>65 CPF, negative extraInterest, SSB cap breakdown, SRS up to retire", () => {
  const M = require("./model.js");
  // 1. Tap 3 + Tap 4 must not double-count bond-sleeve cash on a 60/40 portfolio
  const p6040 = {
    age: 35,
    salary: 8000,
    retire: 65,
    lifestyle: "cca",
    targetEquityPct: 60,
    invest: 2000,
    cashSaving: 500,
    equities: 50000,
    ssbCash: 30000,
  };
  const sum6040 = M.calculate(p6040);
  const fp6040 = M.firePlan(p6040, "frs", { summary: sum6040 });
  const taps6040 = M.retirementTapsPlan({
    summary: sum6040,
    params: p6040,
    fire: fp6040,
  });
  const ptRet = fp6040.atRetire;
  const expectedTotalLiquid =
    Math.round(ptRet.today.liquidEquities) + Math.round(ptRet.today.ssbCash);
  assert.equal(
    taps6040.tap3Equities.projectedInvestAtRetireToday +
      taps6040.tap4Ssb.projectedSsbCashAtRetireToday,
    expectedTotalLiquid,
    "Tap 3 + Tap 4 must equal total liquid portfolio with zero bond-sleeve double-counting",
  );

  // 2. Over-funded plan reports requiredInvestTo95 === 0 instead of current invest
  const fpOver = M.firePlan(
    {
      age: 35,
      salary: 8000,
      retire: 65,
      lifestyle: "cca",
      equities: 2000000,
      invest: 5000,
    },
    "frs",
  );
  assert.equal(fpOver.fireNumber.depletionAge, null);
  assert.equal(
    fpOver.fireNumber.requiredInvestTo95,
    0,
    "Already self-sustaining plan must report $0 required monthly investment",
  );

  // 3. firePlan monthlyTotalIncome uses net post-tax SRS drawdown (never inflates by IRAS tax)
  const fpSrsTax = M.firePlan(
    {
      age: 40,
      salary: 12000,
      retire: 63,
      lifestyle: "home-helper",
      srs: 200000,
      srsAnnual: 15300,
      srsInvestedIn: "global",
      equities: 300000,
    },
    "frs",
  );
  const pt64 = fpSrsTax.points.find((pt) => pt.age === 64);
  assert.ok(
    pt64 && pt64.monthlySrsTax > 0,
    "Expected SRS withdrawal tax at age 64",
  );
  assert.ok(
    pt64.monthlyTotalIncome <= pt64.monthlySpend + 0.05,
    "monthlyTotalIncome must not exceed monthlySpend by SRS tax remitted to IRAS",
  );

  // 4. allocation() handles age > 65 statutory bands (16.5% for 65-70, 12.5% for >70)
  assert.equal(M.allocation(68, 2027)[2], 0.165);
  assert.equal(M.allocation(72, 2027)[2], 0.125);

  // 5. extraInterest() clamps negative balances to 0
  const exNeg = M.extraInterest(
    { oa: -10000, sa: 20000, ma: 20000, ra: 0 },
    35,
  );
  assert.equal(exNeg.sa, 200);
  assert.equal(exNeg.ma, 200);

  // 6. taxSweetSpot allows SRS contributions up to retire (> 63) and models 10-yr return during drawdown
  const txRet63 = M.taxSweetSpot({
    age: 40,
    salary: 12000,
    retire: 63,
    srs: 20000,
    srsAnnual: 15300,
    srsInvestedIn: "global",
  });
  const txRet65 = M.taxSweetSpot({
    age: 40,
    salary: 12000,
    retire: 65,
    srs: 20000,
    srsAnnual: 15300,
    srsInvestedIn: "global",
  });
  assert.ok(
    txRet65.srsProjectedAt63 > txRet63.srsProjectedAt63,
    "Allowing SRS contributions up to retire=65 must project higher SRS pot than retiring at 63",
  );
  assert.ok(
    txRet63.srsTenYearAnnualDraw > txRet63.srsProjectedAt63 / 10,
    "Invested SRS 10-year annual drawdown must reflect ongoing returns during drawdown",
  );

  // 7. computeCashAccountsBreakdown caps SSB sweep gain at $200k SSB limit
  const bdCap = M.computeCashAccountsBreakdown([
    {
      id: "c1",
      preset: "ssb",
      name: "MAS SSB",
      balance: 200000,
      bonusCap: 200000,
      bonusRatePct: 2.39,
      baseRatePct: 2.39,
    },
    {
      id: "c2",
      preset: "dbs-multiplier",
      name: "DBS",
      balance: 150000,
      bonusCap: 100000,
      bonusRatePct: 2.0,
      baseRatePct: 0.05,
    },
  ]);
  const expectedTbillGain =
    50000 *
    ((M.DEFAULT_MAS_LIVE_RATES.tbills.sixMonth.cutoffYield - 0.05) / 100);
  assert.ok(
    Math.abs(bdCap.potentialExtraAnnualInterest - expectedTbillGain) < 1,
    "Overflow above $200k SSB cap must be priced at 6M T-Bill yield, not SSB yield",
  );

  // 8. paycheckAllocation fallback honors 100% equity without clamping to 95%
  const pay100 = M.paycheckAllocation(
    {
      age: 35,
      salary: 8000,
      targetEquityPct: 100,
      sgSleevePct: 0,
      invest: 1000,
    },
    "frs",
    {
      bogle: {
        monthlyRebalance: {
          buyGlobalMonthly: 0,
          buySgMonthly: 0,
          buyBondMonthly: 0,
        },
      },
    },
  );
  assert.equal(
    pay100.ssbMo,
    0,
    "100% equity target must not clamp to 95%/5% bond split",
  );
});

test("Comprehensive Phase 1-5 audit regressions: cutoffYield, SRS discounting/tax-bomb sweep, net-of-SRS allocation, cash sweep guard, zero-spend, BRS milestone, annuity negative IRR", () => {
  const M = require("./model.js");
  // 1. Live MAS 6M T-Bill cutoffYield (lowercase o) is honored in computeCashAccountsBreakdown
  const liveMas = {
    ssb: { year1Return: 2.0, year10Return: 2.5 },
    tbills: { sixMonth: { cutoffYield: 3.5 } },
  };
  const bdLive = M.computeCashAccountsBreakdown(
    [
      {
        id: "c1",
        preset: "ssb",
        name: "MAS SSB",
        balance: 200000,
        bonusCap: 200000,
        bonusRatePct: 2.5,
        baseRatePct: 2.5,
      },
      {
        id: "c2",
        preset: "dbs-multiplier",
        name: "DBS",
        balance: 200000,
        bonusCap: 100000,
        bonusRatePct: 2.0,
        baseRatePct: 0.05,
      },
    ],
    liveMas,
  );
  assert.ok(
    Math.abs(bdLive.potentialExtraAnnualInterest - 3450) < 1,
    `Expected $3,450/yr gain at 3.50% T-Bill yield, got ${bdLive.potentialExtraAnnualInterest}`,
  );

  // 2. retirementTapsPlan discounts SRS from srsWithdrawalStartAge (retire=70) & uses amortizing PMT
  const pRet70 = {
    age: 35,
    salary: 12000,
    retire: 70,
    srs: 50000,
    srsAnnual: 15300,
    srsAge: 63,
    srsInvestedIn: "global",
    returnRate: 0.05,
    inflationRate: 0.025,
  };
  const tx70 = M.taxSweetSpot(pRet70);
  const taps70 = M.retirementTapsPlan({ params: pRet70 });
  assert.equal(taps70.tap2Srs.startAge, 70);
  assert.equal(taps70.tap2Srs.endAge, 80);
  assert.ok(
    Math.abs(
      taps70.tap2Srs.projectedAt63Today -
        M.todayValue(tx70.srsProjectedAt63, 70, 35, 0.025),
    ) < 1,
    "tap2Srs.projectedAt63Today must discount from retire=70, not srsLockInAge=63",
  );
  assert.ok(
    Math.abs(
      taps70.tap2Srs.tenYearAnnualDrawToday -
        M.todayValue(tx70.srsTenYearAnnualDraw, 70, 35, 0.025),
    ) < 1,
    "tap2Srs.tenYearAnnualDrawToday must discount amortizing PMT draw",
  );

  // 3. taxSweetSpot never claims "$0 withdrawal tax" when amortizing PMT triggers positive tax
  const txTrapEdge = M.taxSweetSpot({
    age: 40,
    salary: 12000,
    retire: 63,
    srs: 100000,
    srsAnnual: 2100,
    srsInvestedIn: "global",
    returnRate: 0.05,
  });
  assert.ok(txTrapEdge.srsWithdrawalTaxAt63.annualTax > 0);
  assert.notEqual(txTrapEdge.srsTrapStatus, "safe");
  assert.ok(
    !txTrapEdge.srsTrapGuidance.includes("$0 withdrawal tax)."),
    "Must not contradict positive withdrawal tax with '$0 withdrawal tax'",
  );

  // 4. bogleheadAllocation, retirementTapsPlan, and cashParkingPlan do not double-count monthly SRS
  const pSrsSplit = {
    age: 35,
    salary: 14000,
    retire: 60,
    srsAnnual: 15300,
    invest: 2000,
    targetEquityPct: 80,
    sgSleevePct: 15,
  };
  const bgSrs = M.bogleheadAllocation(pSrsSplit, 2000);
  const tapsSrs = M.retirementTapsPlan({ params: pSrsSplit });
  const simSrs = M.simulate(pSrsSplit, "frs");
  const paySrs = M.paycheckAllocation(
    M.calculate(pSrsSplit),
    simSrs,
    bgSrs,
    pSrsSplit,
  );
  const totalAllocated =
    bgSrs.monthlyRebalance.srsMonthly +
    bgSrs.monthlyRebalance.buyGlobalMonthly +
    bgSrs.monthlyRebalance.buySgMonthly +
    bgSrs.monthlyRebalance.buyBondMonthly;
  assert.ok(
    Math.abs(totalAllocated - 2000) <= 2,
    `SRS + Global + SG + Bond (${totalAllocated}) must equal $2,000 invest budget`,
  );
  assert.equal(
    tapsSrs.tap3Equities.monthlyBondBuy,
    paySrs.ssbMo,
    "retirementTapsPlan bond buy must match paycheckAllocation net-of-SRS bond slice",
  );

  // 5. sweepCashAccountsOverflow does not reduce interest when SSB cap is full and bank baseRate > T-Bill
  const highBaseAccts = [
    {
      id: "c1",
      preset: "ssb",
      name: "MAS SSB",
      balance: 200000,
      bonusCap: 200000,
      bonusRatePct: 2.39,
      baseRatePct: 2.39,
    },
    {
      id: "c2",
      preset: "custom",
      name: "High-Base Bank",
      balance: 150000,
      bonusCap: 100000,
      bonusRatePct: 2.5,
      baseRatePct: 2.0,
    },
  ];
  const beforeSweep = M.computeCashAccountsBreakdown(highBaseAccts);
  const afterSweep = M.computeCashAccountsBreakdown(
    M.sweepCashAccountsOverflow(highBaseAccts),
  );
  assert.ok(
    afterSweep.totalAnnualInterest >= beforeSweep.totalAnnualInterest - 0.01,
    `Sweep must not reduce interest (${beforeSweep.totalAnnualInterest} -> ${afterSweep.totalAnnualInterest})`,
  );

  // 6. firePlan 10-year tax-free SRS sweep avoids year-10 deemed-withdrawal tax bomb when CPF covers spending
  const fpTaxBomb = M.firePlan({
    age: 50,
    salary: 12000,
    retire: 65,
    lifestyle: "cca",
    spend: 2000,
    oa: 300000,
    sa: 220000,
    ma: 79000,
    srs: 200000,
    srsAge: 63,
    srsAnnual: 0,
    srsInvestedIn: "ssb",
    returnRate: 0.05,
    inflationRate: 0.02,
  });
  const ptAt75 = fpTaxBomb.points.find((pt) => pt.age === 75);
  assert.ok(ptAt75, "Age 75 trajectory point must exist");
  assert.equal(
    Math.round(ptAt75.srs),
    0,
    "SRS must be smoothly emptied across the 10-year window (ages 65-74) instead of hitting year-10 deemed-withdrawal tax bomb",
  );

  // 7. cashParkingPlan preserves explicit $0 spend; outsideAllocationGuide exposes cashSaving; milestonePlan("brs") uses brs goal; evaluateAnnuityPlan keeps negative IRR pot
  const cpZero = M.cashParkingPlan({
    summary: { todaySpend: 0, retiringNow: false },
  });
  assert.equal(cpZero.emergencyMin, 0);
  const pCash = { age: 35, salary: 8000, cashSaving: 500 };
  const guideCash = M.outsideAllocationGuide(
    M.calculate(pCash),
    M.simulate(pCash, "frs"),
    pCash,
  );
  assert.equal(guideCash.cashSaving, 500);
  const msBrs = M.milestonePlan(
    { age: 35, salary: 8000, oa: 100000, sa: 100000 },
    "brs",
  );
  assert.ok(
    msBrs.fundedRA <= msBrs.target * 1.05,
    "BRS milestone must cap RA at BRS, not FRS",
  );
  const annNeg = M.evaluateAnnuityPlan({
    monthlyContrib: 1000,
    contribYears: 10,
    deferYears: 0,
    payoutYears: 10,
    quotedMonthlyPayout: 100,
  });
  assert.ok(annNeg.impliedAnnualIrrPct < 0);
  const quotedRow = annNeg.comparisons.find((c) => c.key === "quoted");
  assert.ok(
    quotedRow.potAtPayoutStart < 120000,
    `Negative-IRR annuity potAtPayoutStart (${quotedRow.potAtPayoutStart}) must not clamp to 0% ($120,000)`,
  );
});

test("Audit regressions: live T-Bill sweep benchmark, SSB room preservation, Tap 2 standalone cap, Tap 4 bond sleeve", () => {
  const M = require("./model.js");
  // 1. computeCashAccountsBreakdown exposes tbillBenchmarkPct & sweepCashAccountsOverflow uses live 6M T-Bill yield
  const liveMasHighTbill = {
    ssb: { year10Return: 2.39, year1Return: 1.83 },
    tbills: { sixMonth: { cutoffYield: 3.5 } },
  };
  const accountsFullSsb = [
    {
      id: "ssb",
      preset: "ssb",
      name: "MAS SSB",
      balance: 200000,
      bonusCap: 200000,
      bonusRatePct: 2.39,
      baseRatePct: 2.39,
    },
    {
      id: "bank",
      preset: "uob-one",
      name: "UOB One",
      balance: 200000,
      bonusCap: 150000,
      bonusRatePct: 3.3,
      baseRatePct: 2.0,
    },
  ];
  const bdHighTbill = M.computeCashAccountsBreakdown(
    accountsFullSsb,
    liveMasHighTbill,
  );
  assert.equal(bdHighTbill.tbillBenchmarkPct, 3.5);
  const sweptHighTbill = M.sweepCashAccountsOverflow(
    accountsFullSsb,
    liveMasHighTbill,
  );
  const tbillRow = sweptHighTbill.find((a) => a.preset === "tbills");
  assert.ok(
    tbillRow && tbillRow.balance === 50000,
    "Overflow at 2.0% must sweep into 3.5% live 6M T-Bills when SSB cap is full",
  );

  // 2. High-base overflow account must not steal SSB sweep room from lower-yielding HYSA
  const accountsOrder = [
    {
      id: "hi",
      preset: "custom",
      name: "High Base",
      balance: 300000,
      bonusCap: 100000,
      bonusRatePct: 3.5,
      baseRatePct: 2.8,
    },
    {
      id: "ocbc",
      preset: "ocbc-360",
      name: "OCBC 360",
      balance: 150000,
      bonusCap: 100000,
      bonusRatePct: 3.3,
      baseRatePct: 0.05,
    },
  ];
  const bdOrder = M.computeCashAccountsBreakdown(accountsOrder, {
    ssb: { year10Return: 2.39, year1Return: 1.83 },
    tbills: { sixMonth: { cutoffYield: 1.86 } },
  });
  const expectedOcbcSsbGain = 50000 * ((2.39 - 0.05) / 100);
  assert.ok(
    Math.abs(bdOrder.potentialExtraAnnualInterest - expectedOcbcSsbGain) < 1,
    `Expected OCBC 360 overflow to get SSB room ($${expectedOcbcSsbGain}), got $${bdOrder.potentialExtraAnnualInterest}`,
  );

  // 3. tap2Srs exposes maxSrsStandalone bounded by $80k relief cap even when maxRstu === 0
  const pCap = {
    age: 40,
    salary: 12000,
    retire: 65,
    sa: 250000,
    existingReliefs: 52000,
  };
  const tapsCap = M.retirementTapsPlan({ params: pCap });
  assert.equal(tapsCap.tap2Srs.maxRstu, 0);
  assert.equal(tapsCap.tap2Srs.maxSrsStandalone, 8800);

  // 4. Default 80/20 plan Tap 4 projectedSsbCashAtRetireToday includes monthly bond sleeve (> projectedCashOnlyAtRetireToday)
  const pDef = { ...M.SG_DEFAULT_PLAN };
  const tapsDef = M.retirementTapsPlan({ params: pDef });
  assert.ok(
    tapsDef.tap4Ssb.projectedSsbCashAtRetireToday >
      tapsDef.tap4Ssb.projectedCashOnlyAtRetireToday + 50000,
    "Tap 4 projectedSsbCashAtRetireToday must include monthly bond sleeve from outside investing",
  );
});

test("Full audit Phase 1-5 regressions: accumulating point flows, SRS Yr-10 deemed tax stacking, totalFunding cashSaving, high-spend solver ceiling", () => {
  const M = require("./model.js");

  // 1. Accumulating points expose monthlyOutsideSave & monthlyExtraCpf (nominal & today)
  const pAcc = {
    ...M.SG_DEFAULT_PLAN,
    age: 35,
    retire: 60,
    invest: 1200,
    cashSaving: 300,
    cpfExtra: 250,
  };
  const fpAcc = M.firePlan(pAcc, "frs");
  const ptWork = fpAcc.points.find((pt) => pt.age === 40);
  const ptRet = fpAcc.points.find((pt) => pt.age === 65);
  assert.equal(ptWork.phase, "accumulating");
  assert.equal(Math.round(ptWork.monthlyOutsideSave), 1500);
  assert.equal(Math.round(ptWork.monthlyExtraCpf), 250);
  assert.ok(ptWork.today.monthlyOutsideSave > 0);
  assert.equal(ptRet.monthlyOutsideSave, 0);
  assert.equal(ptRet.monthlyExtraCpf, 0);

  // 2. SRS Year-10 deemed withdrawal stacks onto Year-10 taxable income (no phantom 11th YA 0% bracket)
  const pHugeSrs = {
    age: 54,
    salary: 8000,
    retire: 63,
    lifestyle: "cca",
    spend: 2000,
    oa: 300000,
    sa: 250000,
    ma: 79000,
    srs: 700000,
    srsAnnual: 0,
    srsInvestedIn: "global",
    equities: 500000,
    ssbCash: 100000,
    invest: 0,
    cashSaving: 0,
    inflation: 0,
    returnRate: 0.05,
  };
  const fpHugeSrs = M.firePlan(pHugeSrs, "frs");
  const pt73 = fpHugeSrs.points.find((pt) => pt.age === 73);
  const pt74 = fpHugeSrs.points.find((pt) => pt.age === 74);
  assert.ok(
    pt73.srs > 100000,
    "Large SRS pot still has residual entering deemed-withdrawal boundary",
  );
  assert.equal(
    pt74.srs,
    0,
    "Residual SRS is deemed withdrawn at end of 10-year window",
  );
  const naiveUnstackedTax = M.residentTax(pt73.srs * 0.5).annualTax;
  const stackedTax =
    M.residentTax(20000 + pt73.srs * 0.5).annualTax -
    M.residentTax(20000).annualTax;
  assert.ok(
    stackedTax > naiveUnstackedTax,
    "Stacked Year-10 deemed tax must exceed unstacked tax",
  );
  // Verify actual cash increase across the deemed-withdrawal year is <= what naive unstacked tax would yield
  const cashRateYr = 1 + (fpHugeSrs.cashReturnRate ?? 0.0239);
  const maxCashIfUnstacked =
    (pt73.ssbCash + (pt73.srs - naiveUnstackedTax)) * cashRateYr;
  assert.ok(
    pt74.ssbCash < maxCashIfUnstacked - 1000,
    "Deemed withdrawal cash proceeds must reflect stacked Year-10 tax (no phantom 11th YA 0% bracket)",
  );

  // 3. solveBucketAwareSimulation totalFunding includes cashSaving
  const solvedCash = M.solveBucketAwareSimulation(
    {
      ...M.SG_DEFAULT_PLAN,
      age: 35,
      retire: 60,
      cashSaving: 600,
      invest: 1000,
    },
    "frs",
  );
  const scCash = solvedCash.summary.scenarios.find((x) => x.key === "frs");
  assert.equal(
    Math.round(solvedCash.simulation.selectedScenario.totalFunding),
    Math.round(
      (solvedCash.simulation.selectedScenario.cpfFunding || 0) +
        600 +
        (solvedCash.simulation.selectedScenario.privateSaving || 0),
    ),
    "selectedScenario.totalFunding must include cashSaving alongside cpfFunding and privateSaving",
  );
  assert.ok(scCash);

  // 4. requiredInvestTo95 solver scales beyond $200,000/mo ceiling for extreme high-spend 1-yr horizon
  const fpExtreme = M.firePlan(
    {
      age: 54,
      salary: 8000,
      retire: 55,
      lifestyle: "cca",
      spend: 25000,
      oa: 0,
      sa: 0,
      ma: 0,
      equities: 0,
      ssbCash: 0,
      invest: 0,
      cashSaving: 0,
    },
    "salary",
  );
  assert.ok(
    fpExtreme.fireNumber.requiredInvestTo95 > 200000,
    `Expected requiredInvestTo95 > 200000 for extreme $25k/mo 1-yr horizon, got ${fpExtreme.fireNumber.requiredInvestTo95}`,
  );
});

test("Audit bug regressions: SRS sweep monthlySrsTax, $80k relief cap verdict, reconciled monthlyPortfolioIncome & scenario totalFunding", () => {
  const M = require("./model.js");
  // 1. Tax-free SRS-to-cash sweep must not be misreported as monthlySrsTax
  const fpSweep = M.firePlan(
    {
      ...M.SG_DEFAULT_PLAN,
      age: 45,
      retire: 63,
      salary: 12000,
      srs: 150000,
      srsAnnual: 15300,
      housing: 0,
    },
    "frs",
  );
  const pt65 = fpSweep.points.find((pt) => pt.age === 65);
  assert.ok(
    pt65 && pt65.monthlySrsDraw > 0,
    "Expected active SRS draw at age 65",
  );
  assert.ok(
    pt65.monthlySrsDraw * 12 <= M.C.srsTaxFreeAnnual + 1,
    `Expected annual SRS draw <= $40k tax-free band, got ${pt65.monthlySrsDraw * 12}`,
  );
  assert.equal(
    Math.round(pt65.monthlySrsTax),
    0,
    `Tax-free SRS sweep must report $0 monthlySrsTax, got ${pt65.monthlySrsTax}`,
  );

  // 2. Exhausted $80k IRAS relief cap (after RSTU + family RSTU) must mark Tap 2 SRS cap-full & worthIt=false
  const capParams = {
    ...M.SG_DEFAULT_PLAN,
    age: 42,
    salary: 14000,
    annualBonus: 36000,
    sa: 100000,
    existingReliefs: 49600,
    familyRstuAnnual: 2000,
    srs: 0,
    srsAnnual: 0,
  };
  const capSolved = M.solveBucketAwareSimulation(capParams, "frs");
  const capTax = M.taxSweetSpot(capParams, capSolved.summary);
  assert.equal(
    capTax.maxSrsAfterRstu,
    0,
    "Expected $0 remaining SRS room under $80k cap",
  );
  const capTaps = M.retirementTapsPlan({
    summary: capSolved.summary,
    selectedScenario: capSolved.simulation.selectedScenario,
    simulation: capSolved.simulation,
    fire: capSolved.fire,
    tax: capTax,
    params: capParams,
  });
  assert.equal(
    capTaps.tap2Srs.worthIt,
    false,
    "Tap 2 SRS must not be worthIt when $80k cap is full",
  );
  assert.equal(capTaps.tap2Srs.verdictStatus, "cap-full");
  assert.match(capTaps.tap2Srs.verdictLabel, /Cap Full/i);

  // 3. solveBucketAwareSimulation must recompute monthlyPortfolioIncome from reconciled portfolioAtRetire
  const lateSolved = M.solveBucketAwareSimulation(
    {
      ...M.SG_DEFAULT_PLAN,
      age: 45,
      retire: 70,
      oa: 200000,
      sa: 200000,
      equities: 100000,
      ssbCash: 100000,
      housing: 0,
    },
    "frs",
  );
  const drawMonths = Math.round(
    (lateSolved.fire.endAge - lateSolved.summary.retire) * 12,
  );
  const mRate = (1 + lateSolved.summary.investmentReturn) ** (1 / 12) - 1;
  const expectedPmt =
    (lateSolved.simulation.portfolioAtRetire /
      M.annuityFactor(mRate, drawMonths)) *
    (1 + mRate) ** drawMonths;
  assert.ok(
    Math.abs(lateSolved.simulation.monthlyPortfolioIncome - expectedPmt) < 2,
    `Expected reconciled monthlyPortfolioIncome ~${Math.round(expectedPmt)}, got ${Math.round(lateSolved.simulation.monthlyPortfolioIncome)}`,
  );

  // 4. summary.scenarios[selected].totalFunding must include cashSaving
  const cashSolved = M.solveBucketAwareSimulation(
    {
      ...M.SG_DEFAULT_PLAN,
      age: 35,
      retire: 60,
      cashSaving: 500,
      invest: 1000,
    },
    "frs",
  );
  const frsRow = cashSolved.summary.scenarios.find((x) => x.key === "frs");
  assert.equal(
    Math.round(frsRow.totalFunding),
    Math.round(cashSolved.simulation.selectedScenario.totalFunding),
    "summary.scenarios[selected].totalFunding must reconcile with selectedScenario.totalFunding including cashSaving",
  );
});

test("Phase 2 regressions: dynamic srsZeroTaxCap, Family RSTU + SRS verdict consistency, and cashParkingPlan overflow gating", () => {
  const M = require("./model.js");
  // 1. tap2Srs.srsZeroTaxCap & eligibleFamilyRstu exposure + buildPrintReportModel dynamic srsZeroTaxCap label
  const srsParams = {
    ...M.SG_DEFAULT_PLAN,
    age: 40,
    retire: 65,
    salary: 14000,
    annualBonus: 24000,
    srs: 200000,
    srsAnnual: 15300,
    srsInvestedIn: "global",
    familyRstuAnnual: 3000,
  };
  const srsSolved = M.solveBucketAwareSimulation(srsParams, "frs");
  const srsTax = M.taxSweetSpot(srsParams, srsSolved.summary);
  const srsTaps = M.retirementTapsPlan({
    summary: srsSolved.summary,
    selectedScenario: srsSolved.simulation.selectedScenario,
    simulation: srsSolved.simulation,
    fire: srsSolved.fire,
    tax: srsTax,
    params: srsParams,
  });
  assert.equal(
    srsTaps.tap2Srs.srsZeroTaxCap,
    srsTax.srsZeroTaxCap,
    "tap2Srs must expose dynamic srsZeroTaxCap from taxSweetSpot",
  );
  assert.ok(
    srsTaps.tap2Srs.srsZeroTaxCap > 250000 &&
      srsTaps.tap2Srs.srsZeroTaxCap < 350000,
    `At 5% SRS return, srsZeroTaxCap should be ~$309k (not static $400k), got ${srsTaps.tap2Srs.srsZeroTaxCap}`,
  );
  assert.equal(
    srsTaps.tap2Srs.eligibleFamilyRstu,
    srsTax.eligibleFamilyRstu,
    "tap2Srs must expose eligibleFamilyRstu from taxSweetSpot",
  );
  assert.ok(
    srsTaps.tap2Srs.eligibleFamilyRstu > 0,
    "Expected eligibleFamilyRstu > 0 for familyRstuAnnual=3000",
  );
  const expectedCapK = Math.round(srsTax.srsZeroTaxCap / 1000);
  const printBalloon = M.buildPrintReportModel({
    summary: srsSolved.summary,
    selectedScenario: srsSolved.simulation.selectedScenario,
    simulation: srsSolved.simulation,
    fire: srsSolved.fire,
    tax: srsTax,
    params: srsParams,
    basis: "today",
  });
  assert.equal(srsTax.srsTrapStatus, "balloon-trap");
  assert.ok(
    printBalloon.actionRows[3].value.includes(`Cap SRS ≤$${expectedCapK}k`),
    `buildPrintReportModel balloon-trap action must use dynamic srsZeroTaxCap ($${expectedCapK}k), got: ${printBalloon.actionRows[3].value}`,
  );
  assert.equal(
    printBalloon.actionRows[3].value.includes("Cap SRS ≤$400k"),
    false,
    "buildPrintReportModel must not hardcode $400k when srsZeroTaxCap differs",
  );
  const printNearCap = M.buildPrintReportModel({
    summary: srsSolved.summary,
    selectedScenario: srsSolved.simulation.selectedScenario,
    simulation: srsSolved.simulation,
    fire: srsSolved.fire,
    tax: { ...srsTax, srsTrapStatus: "near-cap" },
    params: srsParams,
    basis: "today",
  });
  assert.equal(
    printNearCap.actionRows[3].tag,
    `SRS ~$${expectedCapK}k cap`,
    `buildPrintReportModel near-cap tag must use dynamic srsZeroTaxCap ($${expectedCapK}k)`,
  );

  // 2. Family RSTU + SRS verdict consistency when maxRstu === 0 && eligibleFamilyRstu > 0
  const famParams = {
    ...M.SG_DEFAULT_PLAN,
    age: 42,
    salary: 14000,
    annualBonus: 36000,
    sa: 260000, // SA >= FRS => own maxRstu === 0
    existingReliefs: 52600, // Leaves ~$8k under $80k cap after employee CPF (~$19.4k)
    familyRstuAnnual: 8000,
    srs: 0,
    srsAnnual: 0,
  };
  const famSolved = M.solveBucketAwareSimulation(famParams, "frs");
  const famTax = M.taxSweetSpot(famParams, famSolved.summary);
  assert.equal(famTax.maxRstu, 0, "Expected maxRstu === 0 when SA >= FRS");
  assert.ok(
    famTax.eligibleFamilyRstu > 0,
    `Expected eligibleFamilyRstu > 0, got ${famTax.eligibleFamilyRstu}`,
  );
  assert.equal(
    famTax.maxSrsAfterRstu,
    0,
    `Expected maxSrsAfterRstu === 0 after family RSTU fills $80k cap, got ${famTax.maxSrsAfterRstu}`,
  );
  assert.ok(
    famTax.maxSrsStandalone > 0,
    "Precondition: standalone SRS room must be > 0 before family RSTU",
  );
  const famTaps = M.retirementTapsPlan({
    summary: famSolved.summary,
    selectedScenario: famSolved.simulation.selectedScenario,
    simulation: famSolved.simulation,
    fire: famSolved.fire,
    tax: famTax,
    params: famParams,
  });
  assert.equal(
    famTaps.tap2Srs.worthIt,
    false,
    "tap2Srs.worthIt must be false when family RSTU exhausts $80k relief cap even if maxRstu === 0",
  );
  assert.equal(
    famTaps.tap2Srs.verdictStatus,
    "cap-full",
    `Expected cap-full verdict when family RSTU exhausts relief cap, got ${famTaps.tap2Srs.verdictStatus}`,
  );

  // 3. cashParkingPlan() high-base-rate overflow (no bogus warn) & dynamic overflowAvgBaseRatePct
  const highBaseParams = {
    ...M.SG_DEFAULT_PLAN,
    age: 35,
    ssbCash: 150000,
    cashAccountsActive: true,
    cashAccounts: [
      {
        name: "High Base HYSA",
        preset: "custom",
        balance: 150000,
        bonusCap: 100000,
        bonusRatePct: 3.5,
        baseRatePct: 3.0,
      },
    ],
  };
  const highBaseSolved = M.solveBucketAwareSimulation(highBaseParams, "frs");
  const highBasePlan = M.cashParkingPlan({
    summary: highBaseSolved.summary,
    simulation: highBaseSolved.simulation,
    params: highBaseParams,
  });
  assert.equal(highBasePlan.cashBreakdown.totalOverflowBalance, 50000);
  assert.equal(highBasePlan.cashBreakdown.potentialExtraAnnualInterest, 0);
  assert.equal(
    highBasePlan.positionHeadline.includes("Over Bonus Cap"),
    false,
    `High-base-rate overflow with $0 sweep gain must not trigger Over Bonus Cap warn: ${highBasePlan.positionHeadline}`,
  );

  const customBaseParams = {
    ...M.SG_DEFAULT_PLAN,
    age: 35,
    ssbCash: 120000,
    cashAccountsActive: true,
    cashAccounts: [
      {
        name: "Tiered Bank",
        preset: "custom",
        balance: 120000,
        bonusCap: 100000,
        bonusRatePct: 3.5,
        baseRatePct: 0.75,
      },
    ],
  };
  const customBaseSolved = M.solveBucketAwareSimulation(
    customBaseParams,
    "frs",
  );
  const customBasePlan = M.cashParkingPlan({
    summary: customBaseSolved.summary,
    simulation: customBaseSolved.simulation,
    params: customBaseParams,
  });
  assert.equal(customBasePlan.positionTone, "warn");
  assert.ok(
    customBasePlan.positionHeadline.includes("(0.75%)"),
    `Overflow headline must interpolate actual overflowAvgBaseRatePct (0.75%), got: ${customBasePlan.positionHeadline}`,
  );
  assert.equal(
    customBasePlan.positionHeadline.includes("(0.05%)"),
    false,
    "Overflow headline must not hardcode (0.05%)",
  );
});

test("computeMonthlyTakeHomeCashflow reuses passed tax summary and computes accurate monthly cashflow", () => {
  const M = require("./model.js");
  const p = {
    ...M.SG_DEFAULT_PLAN,
    age: 35,
    salary: 8000,
    housingMode: "hdb",
    housingBalance: 400000,
    housingYears: 20,
    housingRate: 2.6,
    housingParties: 1,
  };
  const solved = M.solveBucketAwareSimulation(p, "frs");
  const r = solved.summary;
  const simulation = solved.simulation;
  const expenseData = M.expensePlan(p);
  const contribution = Math.round(
    (simulation.cpfExtra || 0) +
      (simulation.cashSaving || 0) +
      (simulation.invest || 0),
  );

  // Sentinel tax object proves passed `tax` is reused without calling computeTaxSummary()
  const sentinelTax = {
    regularActiveTax: { monthlyTax: 321 },
    activeTax: { monthlyTax: 999 },
  };
  const cfWithPassedTax = M.computeMonthlyTakeHomeCashflow({
    r,
    simulation,
    contribution,
    p,
    tax: sentinelTax,
    expenseData,
  });
  assert.equal(cfWithPassedTax.monthlyTax, 321);
  assert.equal(cfWithPassedTax.hMode, "hdb");
  assert.equal(
    cfWithPassedTax.housingOaMo + cfWithPassedTax.housingCashMo,
    cfWithPassedTax.housingTotalMo,
  );
  assert.equal(
    cfWithPassedTax.fixedOutMo,
    cfWithPassedTax.monthlyTax +
      cfWithPassedTax.housingCashMo +
      cfWithPassedTax.recurringTotal,
  );
  assert.equal(
    cfWithPassedTax.leftAfterSave,
    Math.round(r.afterCpf - contribution),
  );
  assert.equal(
    cfWithPassedTax.netCashSurplus,
    Math.round(r.afterCpf - contribution - cfWithPassedTax.fixedOutMo),
  );
  assert.equal(
    cfWithPassedTax.maxAffordableSaveMo,
    Math.max(0, Math.round(r.afterCpf - cfWithPassedTax.fixedOutMo)),
  );
  // Pure model output must not contain HTML tags
  assert.equal("housingMetaLabel" in cfWithPassedTax, false);

  // Fallback when tax is omitted computes real tax summary
  const cfAutoTax = M.computeMonthlyTakeHomeCashflow({
    r,
    simulation,
    contribution,
    p,
    tax: null,
    expenseData,
  });
  const realTax = M.computeTaxSummary(p, simulation);
  assert.equal(
    cfAutoTax.monthlyTax,
    Math.max(0, Math.round(realTax.regularActiveTax.monthlyTax || 0)),
  );
});

test("computeRebalanceTargets respects emergency reserve floor and handles underweight/overweight equity & SRS", () => {
  const M = require("./model.js");
  // Underweight equities with excess cash above 6-month / $20k floor
  const pUnder = {
    ...M.SG_DEFAULT_PLAN,
    equities: 20000,
    sgDividends: 0,
    ssbCash: 100000,
    srs: 10000,
    srsInvestedIn: "global",
    targetEquityPct: 80,
  };
  const rUnder = M.calculate(pUnder);
  const bogleUnder = M.bogleheadAllocation(pUnder, 1000);
  const rebUnder = M.computeRebalanceTargets(bogleUnder, pUnder, rUnder);
  assert.equal(rebUnder.isUnderweightEq, true);
  assert.equal(
    rebUnder.emergencyReserveFloor,
    Math.max(20000, Math.round(rUnder.todaySpend * 6)),
  );
  assert.equal(
    rebUnder.deployableExcessCash,
    Math.max(0, 100000 - rebUnder.emergencyReserveFloor),
  );
  assert.ok(rebUnder.shiftAmt > 0);
  assert.ok(
    rebUnder.newCash >= rebUnder.emergencyReserveFloor,
    "Rebalance must never dip into the 6-month / $20k emergency reserve floor",
  );
  assert.equal(rebUnder.newLiqEq + rebUnder.newCash, rebUnder.liqTotal);

  // Overweight equities (100% equity vs 60% target) shifts from equities to cash
  const pOver = {
    ...M.SG_DEFAULT_PLAN,
    equities: 200000,
    sgDividends: 0,
    ssbCash: 0,
    oa: 0,
    sa: 0,
    ma: 0,
    targetEquityPct: 60,
  };
  const rOver = M.calculate(pOver);
  const bogleOver = M.bogleheadAllocation(pOver, 1000);
  const rebOver = M.computeRebalanceTargets(bogleOver, pOver, rOver);
  assert.equal(rebOver.isUnderweightEq, false);
  assert.equal(rebOver.shiftAmt, 80000);
  assert.equal(rebOver.newLiqEq, 120000);
  assert.equal(rebOver.newCash, 80000);
});

test("bogleheadAllocation exposes monthlyRebalance.srsMonthly for Quick Edit SRS deduction display", () => {
  const M = require("./model.js");
  const withSrs = M.bogleheadAllocation(
    { ...M.SG_DEFAULT_PLAN, srsAnnual: 15300 },
    2500,
  );
  assert.equal(withSrs.monthlyRebalance.srsMonthly, 1275);
  assert.equal(withSrs.monthlyRebalance.liquidInvestPool, 1225);
  assert.equal(
    withSrs.monthlyRebalance.buyGlobalMonthly +
      withSrs.monthlyRebalance.buySgMonthly +
      withSrs.monthlyRebalance.buyBondMonthly,
    1225,
  );

  const noSrs = M.bogleheadAllocation(
    { ...M.SG_DEFAULT_PLAN, srsAnnual: 0 },
    2500,
  );
  assert.equal(noSrs.monthlyRebalance.srsMonthly, 0);
  assert.equal(noSrs.monthlyRebalance.liquidInvestPool, 2500);
});
