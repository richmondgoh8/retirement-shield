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
  assert.equal(calculate(p).todaySpend, 3500);
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
  assert.equal(Math.round(d.spend65), 3324);
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
  assert.equal(r.todaySpend, 2500);
  assert.equal(
    M.ccaRows.reduce((sum, row) => sum + row.now, 0),
    2500,
  );
  assert.equal(
    M.ccaRows.reduce((sum, row) => sum + row.later, 0),
    3340,
  );
  const d = M.todayPlan(r);
  assert.ok(Math.abs(d.spend65 - 2500) < 1e-8);
  assert.ok(Math.abs(d.spend75 - 3340) < 1e-8);
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
    half = M.todayPlan(M.calculate({ ...p, spend: 1250 }));
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
    for (const total of [0, 1000, 2500, 3500, 4321.5]) {
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
  assert.equal(cca.total, 2500);
  assert.deepEqual(
    cca.groups.map((g) => g.amount),
    [1180, 1120, 200],
  );
  const helper = M.budgetBreakdown("home-helper");
  assert.equal(helper.total, 3500);
  assert.equal(
    helper.rows.find((row) => row.name === "Planning cushion").amount,
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
  assert.equal(guideCritical.emergencyMin, 15000);
  assert.equal(guideCritical.emergencyMax, 30000);
  assert.equal(
    guideCritical.split.safeMonthly +
      guideCritical.split.srsMonthly +
      guideCritical.split.coreMonthly,
    guideCritical.allocPool,
  );
  assert.ok(guideCritical.split.srsMonthly <= C.srsCap / 12);

  // Stretched case (51-85% of take-home)
  const rStretched = M.calculate({ age: 45, salary: 6500 });
  const simStretched = M.simulate({ age: 45, salary: 6500 }, "salary", {
    summary: rStretched,
  });
  const guideStretched = M.outsideAllocationGuide(rStretched, simStretched);
  assert.equal(guideStretched.state.key, "stretched");

  // Higher earner with existing balances reaches comfortable state and positive SRS/RSTU tax savings
  const comfortableSummary = M.calculate({
    age: 35,
    salary: 9000,
    oa: 80000,
    sa: 60000,
    savings: 100000,
  });
  const simComfort = M.simulate(
    { age: 35, salary: 9000, oa: 80000, sa: 60000, savings: 100000 },
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
  // Since holistic equity % is far below 80% target due to CPF, 100% of $2,000 goes to equities
  assert.equal(alloc.monthlyRebalance.buyBondMonthly, 0);
  assert.equal(
    alloc.monthlyRebalance.buyGlobalMonthly +
      alloc.monthlyRebalance.buySgMonthly,
    2000,
  );

  // Overweight SG Dividends sleeve + $0 CPF routes 100% into Global UCITS and avoids false "CPF holds" copy
  const overweightSg = M.bogleheadAllocation(
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
  assert.equal(overweightSg.monthlyRebalance.buySgMonthly, 0);
  assert.equal(overweightSg.monthlyRebalance.buyGlobalMonthly, 1000);
  assert.equal(overweightSg.monthlyRebalance.buyBondMonthly, 0);
  assert.match(overweightSg.monthlyRebalance.note, /SSB \/ Cash holds 33%/);
  assert.match(overweightSg.monthlyRebalance.note, /100% goes to Global UCITS/);
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
