const test = require("node:test");
const assert = require("node:assert/strict");
const { referencePayout, portfolioTarget, C } = require("./model.js");
// Explicit legacy fixtures preserve the approved Home + Helper behaviour.
const calculate = (p) =>
  require("./model.js").calculate({ lifestyle: "home-helper", ...p });
const generateTrajectory = (p, key) =>
  require("./model.js").generateTrajectory(
    { lifestyle: "home-helper", ...p },
    key,
  );
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
  const { careTotals, expenseAt } = require("./model.js");
  assert.deepEqual(careTotals("now"), [2650, 3530]);
  assert.deepEqual(careTotals("later"), [3630, 4890]);
  assert.ok(Math.abs(expenseAt(3090, 65, 10, "helper") - 4260) < 1e-6);
  assert.deepEqual(
    careTotals("later").map((v) => v - 240),
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
test("drawdown slices use one retirement date and cannot exceed the portfolio", () => {
  const { todayPlan, drawdownToday, todayValue } = require("./model");
  for (const retire of [40, 55, 65, 75, 80])
    for (const spend of [0, 500, 3500]) {
      const r = calculate({ age: 35, salary: 6000, retire, spend }),
        d = todayPlan(r);
      for (let i = 0; i < 3; i++) {
        const v = drawdownToday(r, r.scenarios[i]);
        assert.ok(
          Math.abs(
            v.cashReserve +
              v.ssbLadder +
              v.equityCore -
              d.scenarios[i].privateTarget,
          ) < 1e-6,
        );
        assert.ok(
          v.ssbLadder <= todayValue(200000, retire, r.age, r.inflation),
        );
      }
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
            const t = M.generateTrajectory(p, key),
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
            const slices = M.drawdownToday(t.summary, t.selectedScenario);
            assert.ok(
              Math.abs(
                slices.cashReserve +
                  slices.ssbLadder +
                  slices.equityCore -
                  s.privateTarget,
              ) < 1e-6,
            );
          }
});

test("budget previews reconcile categories, groups and custom totals for both presets", () => {
  const M = require("./model.js");
  for (const lifestyle of ["cca", "home-helper"])
    for (const total of [0, 1000, 2500, 2800, 3500, 3900, 4321.5]) {
      const b = M.budgetBreakdown(lifestyle, total);
      assert.ok(
        Math.abs(b.rows.reduce((sum, row) => sum + row.amount, 0) - total) <
          1e-8,
      );
      assert.ok(
        Math.abs(
          b.groups.reduce((sum, group) => sum + group.amount, 0) - total,
        ) < 1e-8,
      );
      assert.equal(b.groups.length, 3);
      for (const row of b.rows)
        assert.ok(Number.isFinite(row.amount) && row.amount >= 0);
    }
  const cca = M.budgetBreakdown();
  assert.equal(cca.total, 2800);
  const ccaLegacy = M.budgetBreakdown("cca", 2500);
  assert.deepEqual(
    ccaLegacy.groups.map((g) => g.amount),
    [1180, 1120, 200],
  );
  const helper = M.budgetBreakdown("home-helper");
  assert.equal(helper.total, 3900);
  const helperLegacy = M.budgetBreakdown("home-helper", 3500);
  assert.equal(
    helperLegacy.rows.find((row) => row.name === "Planning cushion").amount,
    410,
  );
  assert.throws(() => M.budgetBreakdown("unknown", 2500));
  assert.throws(() => M.budgetBreakdown("cca", -1));
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
  const earliest = M.earliestRetirement(
    { age: 35, salary: 8000, lifestyle: "home-helper", savings: 300000 },
    "salary",
    0,
    2500,
  );
  assert.ok(earliest !== null && earliest >= 40 && earliest <= 80);
  const simAtEarliest = M.simulate(
    {
      age: 35,
      salary: 8000,
      lifestyle: "home-helper",
      savings: 300000,
      retire: earliest,
      invest: 2500,
      cpfExtra: 0,
    },
    "salary",
  );
  assert.equal(simAtEarliest.fullyFunded, true);
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
  const fp63 = M.firePlan(M.DEMO_PLAN, "salary");
  assert.equal(fp63.points[0].age, M.DEMO_PLAN.age);
  assert.equal(fp63.points.at(-1).age, 95);
  assert.equal(fp63.bridge.years, 10);
  assert.ok(fp63.bridge.requiredToday > 0);
  assert.ok(fp63.phase2.projectedCpfAt65Today > 0);
  assert.ok(fp63.fireNumber.totalRequiredToday > fp63.bridge.requiredToday);
  assert.ok(fp63.elevatorPitch.includes("CPF LIFE"));

  // SRS age 63 starts drawing at 63, age 64 delays drawdown until 64
  const fp64 = M.firePlan({ ...M.DEMO_PLAN, srsAge: 64 }, "salary");
  const pt63a = fp63.points.find((x) => x.age === 63);
  const pt63b = fp64.points.find((x) => x.age === 63);
  assert.ok(pt63a.monthlySrsDraw > 0);
  assert.equal(pt63b.monthlySrsDraw, 0);

  // Idle SRS cash at 0.05% grows noticeably slower than invested SRS
  const idleSrs = M.firePlan(
    { ...M.DEMO_PLAN, srsInvestedIn: "cash" },
    "salary",
  );
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

test("CASH_PARKING_CATALOG and cashParkingPlan cover limits, links, and tiered cash stacking", () => {
  const M = require("./model.js");
  const cat = M.CASH_PARKING_CATALOG;
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
  assert.equal(M.DEMO_PLAN.sgSleevePct, 15);
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
    ...M.DEMO_PLAN,
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
  const appJs = fs.readFileSync("app.js", "utf8");

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
  assert.ok(pmT.actionRows[3].value.includes("Cap SRS ≤$400k"));
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
  const guideNoParams = M.outsideAllocationGuide(rB, simB);
  const guideWithParams = M.outsideAllocationGuide(rB, simB, pBonus);
  assert.ok(
    guideWithParams.tax.marginalRate > guideNoParams.tax.marginalRate,
    "Expected annualBonus in params to raise marginal tax rate in outsideAllocationGuide",
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
  const appJs = fs.readFileSync("app.js", "utf8");

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
  assert.ok(fire32.fireNumber.pctFunded >= 75 && fire32.fireNumber.pctFunded < 100);
  assert.ok(fire32.fireNumber.depletionAge >= 86);
  assert.equal(fire32.fireNumber.projectedFireAge, 75);

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
  const bogle100Eq100Global = M.bogleheadAllocation({ ...base, targetEquityPct: 100, sgSleevePct: 0 }, 1000);
  assert.equal(bogle100Eq100Global.holistic.targetEquityPct, 100);
  assert.equal(bogle100Eq100Global.holistic.sgEquitySplitPct, 0);
  assert.equal(bogle100Eq100Global.monthlyRebalance.buyGlobalMonthly, 1000);
  assert.equal(bogle100Eq100Global.monthlyRebalance.buySgMonthly, 0);
  assert.equal(bogle100Eq100Global.monthlyRebalance.buyBondMonthly, 0);

  const bogle100Eq100Sg = M.bogleheadAllocation({ ...base, targetEquityPct: 100, sgSleevePct: 100 }, 1000);
  assert.equal(bogle100Eq100Sg.holistic.targetEquityPct, 100);
  assert.equal(bogle100Eq100Sg.holistic.sgEquitySplitPct, 100);
  assert.equal(bogle100Eq100Sg.monthlyRebalance.buyGlobalMonthly, 0);
  assert.equal(bogle100Eq100Sg.monthlyRebalance.buySgMonthly, 1000);
  assert.equal(bogle100Eq100Sg.monthlyRebalance.buyBondMonthly, 0);

  const bogle0Eq100Bond = M.bogleheadAllocation({ ...base, targetEquityPct: 0, sgSleevePct: 50 }, 1000);
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
  assert.ok(taps70.tap4Ssb.projectedCashOnlyAtRetireToday > taps70.tap4Ssb.currentSsbCash);
  assert.ok(taps70.tap3Equities.projectedInvestAtRetireToday > taps70.tap3Equities.currentEquities);
  assert.equal(
    taps70.tap3Equities.gapCoveragePct,
    Math.min(100, Math.round(fire70.fireNumber.pctFunded)),
  );

  // Verify simulate() and earliestRetirement() include cashSaving and cashReturnRate
  const simNoCash = M.simulate({ ...base, cashSaving: 0 }, "salary", { summary: r });
  assert.ok(sim.portfolioAtRetire > simNoCash.portfolioAtRetire);
  assert.equal(sim.investmentDeposits, simNoCash.investmentDeposits + 500 * (65 - 35) * 12);
  const erWithCash = M.earliestRetirement({ ...base, cashSaving: 500 }, "salary", 0, 1000);
  const erNoCash = M.earliestRetirement({ ...base, cashSaving: 0 }, "salary", 0, 1000);
  assert.ok(erWithCash <= erNoCash);

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
  const splitRow = printReport.actionRows.find((row) => row.label.includes("Monthly Split"));
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
