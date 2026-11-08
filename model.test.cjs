const test=require('node:test');
const assert=require('node:assert/strict');
const {calculate,referencePayout,portfolioTarget,generateTrajectory,C}=require('./model.js');
test('two known fields produce a complete finite answer without refinements',()=>{
 const r=calculate({age:35,salary:6000});
 for(const [k,v]of Object.entries(r))if(typeof v==='number')assert.ok(Number.isFinite(v),k);
 assert.equal(r.oa,0); assert.equal(r.employeeCpf,1200);assert.ok(Math.abs(r.employerCpf-1020)<1e-9);
 assert.equal(r.retire,65);assert.equal(r.refined,false);assert.ok(r.saving>0);
});
test('salary ceiling and optional zero housing are distinct from unknown housing',()=>{
 assert.equal(calculate({age:35,salary:12000}).employeeCpf,1600);
 assert.ok(calculate({age:35,salary:6000,housing:0}).cpf>calculate({age:35,salary:6000}).cpf);
});
test('income reference matches published anchors through ERS',()=>{
 assert.equal(referencePayout(50000),490);assert.equal(referencePayout(220400),1780);
 assert.equal(referencePayout(440800),3440);assert.equal(referencePayout(1000000),3440);assert.equal(referencePayout(0),0);
});
test('more savings lower the investment contribution; actual spending raises it',()=>{
 const p={age:35,salary:6000};const a=calculate(p);
 assert.ok(calculate({...p,savings:50000}).saving<a.saving);
 assert.ok(calculate({...p,spend:4500}).saving>a.saving);
});
test('early retirement stops future salary contributions and includes a bridge',()=>{
 const p={age:35,salary:6000};assert.ok(calculate({...p,retire:40}).cpf<calculate(p).cpf);
 const x=portfolioTarget(1500,1500,60,65);const noIncome=portfolioTarget(1500,0,60,65);
 assert.ok(Math.abs(x-noIncome)<1e-6);
});
test('fixed payouts still leave future inflation exposure',()=>{assert.ok(portfolioTarget(1500,1500,65)>0);});
test('retirement now shows a finite capital gap, including zero-spend case',()=>{
 const r=calculate({age:45,salary:6000,retire:45});assert.ok(Number.isFinite(r.saving));assert.equal(r.retiringNow,true);
 assert.equal(calculate({age:35,salary:6000,spend:0}).saving,0);
});
test('known CPF balances matter and invalid primary details are rejected',()=>{
 const p={age:35,salary:6000};assert.ok(calculate({...p,sa:25000}).cpf>calculate(p).cpf);
 assert.throws(()=>calculate({age:55,salary:6000}));assert.throws(()=>calculate({age:35,salary:0}));
 assert.throws(()=>calculate({...p,savings:-1}));assert.throws(()=>calculate({...p,retire:30}));
});

test('helper ranges add correctly without duplicate food; age-75 normal and concession totals differ by 240',()=>{
 const {careTotals,expenseAt}=require('./model.js');
 assert.deepEqual(careTotals('now'),[2650,3530]);assert.deepEqual(careTotals('later'),[3630,4890]);
 assert.ok(Math.abs(expenseAt(3090,65,10,'helper')-4260)<1e-6);
 assert.deepEqual(careTotals('later').map(v=>v-240),[3390,4650]);
});
test('Solo + Helper is the only baseline and stays adjustable',()=>{
 const p={age:35,salary:6000};assert.equal(calculate(p).todaySpend,3500);
 assert.ok(calculate({...p,spend:4000}).saving>calculate(p).saving);
 assert.ok(calculate(p).at75>calculate(p).todaySpend);
});
test('FRS and ERS fund higher payouts and reduce the outside portfolio requirement',()=>{
 const r=calculate({age:35,salary:6000});const [salary,frs,ers]=r.scenarios;
 assert.ok(salary.payout<frs.payout);assert.ok(frs.payout<ers.payout);
 assert.ok(salary.privateSaving>frs.privateSaving);assert.ok(frs.privateSaving>ers.privateSaving);
 assert.equal(salary.cpfFunding,0);assert.ok(ers.cpfFunding>frs.cpfFunding);
 assert.ok(ers.gap65>0);assert.ok(ers.gap75>ers.gap65);
 for(const s of r.scenarios)assert.equal(s.totalFunding,s.cpfFunding+s.privateSaving);
});
test('CPF and outside investment pots independently reconcile to their targets',()=>{
 const r=calculate({age:35,salary:6000});const rate=1.04**(1/12)-1;
 for(const s of r.scenarios){
  const cpfFV=s.cpfFunding*((1+rate)**240-1)/rate;
  assert.ok(Math.abs(cpfFV-s.cpfGap)<1e-6);
  const privateFV=s.privateSaving*((1+rate)**360-1)/rate;
  assert.ok(Math.abs(privateFV-s.privateTarget)<1e-5);
 }
});
test('an entered investment amount counts once across paths and reveals a shortfall',()=>{
 const r=calculate({age:35,salary:6000,invest:100,savings:20000});
 const rate=1.04**(1/12)-1,expected=20000*1.04**30+100*((1+rate)**360-1)/rate;
 for(const s of r.scenarios){assert.ok(Math.abs(s.illustratedPortfolio-expected)<1e-5);assert.ok(s.remainingPortfolioGap>0);}
});
test('low spending can be covered by CPF; level income can fall behind later',()=>{
 const low=calculate({age:35,salary:6000,spend:500});assert.equal(low.scenarios[2].firstShortfallAge,null);
 const r=calculate({age:35,salary:6000,spend:1000});const frs=r.scenarios[1];
 assert.equal(frs.gap65,0);assert.equal(frs.gap75,0);assert.ok(frs.firstShortfallAge>75);
});
test('retirement now and early retirement produce finite separated funding pots',()=>{
 for(const retire of [40,45,55,65]){
  const r=calculate({age:40,salary:6000,retire});for(const s of r.scenarios)for(const key of ['cpfFunding','privateSaving','totalFunding','illustratedPortfolio'])assert.ok(Number.isFinite(s[key]),key);
 }
 const r=calculate({age:35,salary:6000,retire:40});const rate=1.04**(1/12)-1;
 for(const s of r.scenarios)assert.ok(Math.abs(s.cpfFunding*((1+rate)**60-1)/rate*1.04**15-s.cpfGap)<1e-5);
});
test('displayed salary flow reconciles payroll deductions and the three CPF accounts',()=>{
 for(const age of [25,35,40,48,53])for(const salary of [6000,12000]){
  const r=calculate({age,salary});
  assert.ok(Math.abs(r.currentOA+r.currentSA+r.currentMA-r.contribution)<1e-8);
  assert.ok(Math.abs(r.employeeCpf+r.employerCpf-r.contribution)<1e-8);
  assert.equal(r.afterCpf+r.employeeCpf,salary);
 }
 const r=calculate({age:35,salary:6000});
 assert.equal(Math.round(r.currentOA),1380);assert.equal(Math.round(r.currentSA),360);assert.equal(Math.round(r.currentMA),480);
});

test('CPF LIFE Escalating plan starts lower and compounds by 2% yearly, overtaking standard around age 77',()=>{
 const std = calculate({age:35,salary:6000,plan:'standard'});
 const esc = calculate({age:35,salary:6000,plan:'escalating'});
 const stdPayout65 = std.scenarios[1].payout;
 const escPayout65 = esc.scenarios[1].payout;
 assert.ok(Math.abs(escPayout65 - stdPayout65 * 0.8) < 1e-4);
 const escPayout75 = esc.scenarios[1].payout75;
 assert.ok(escPayout75 > escPayout65);
 const escPayout80 = escPayout65 * (1.02 ** 15);
 assert.ok(escPayout80 > stdPayout65);
});

test('sensitivity testing adjusts targets predictably',()=>{
 const base = calculate({age:35,salary:6000,returnRate:0.04,inflationRate:0.03});
 const highReturn = calculate({age:35,salary:6000,returnRate:0.05,inflationRate:0.03});
 const highInflation = calculate({age:35,salary:6000,returnRate:0.04,inflationRate:0.035});
 assert.ok(highReturn.saving < base.saving);
 assert.ok(highInflation.saving > base.saving);
});

test('post-55 work option accumulates senior CPF contributions',()=>{
 const withoutPost55 = calculate({age:35,salary:6000,retire:65,post55Work:false});
 const withPost55 = calculate({age:35,salary:6000,retire:65,post55Work:true});
 assert.ok(withPost55.cpf > withoutPost55.cpf);
 assert.ok(withPost55.extraPost55CPF > 0);
});

test('generateTrajectory produces full chronological series to age 90 with valid invariants',()=>{
 const {summary, selectedScenario, points} = generateTrajectory({age:35,salary:6000,retire:65});
 assert.equal(points[0].age, 35);
 assert.equal(points[points.length-1].age, 90);
 for (const pt of points) {
  assert.ok(Number.isFinite(pt.monthlySpend));
  assert.ok(Number.isFinite(pt.monthlyCPF));
  assert.ok(Number.isFinite(pt.monthlyGap));
  assert.ok(Number.isFinite(pt.portfolioBalance));
  assert.ok(pt.portfolioBalance >= 0);
 }
 const retirePt = points.find(p => p.age === 65);
 assert.equal(retirePt.phase, 'drawdown');
 assert.ok(retirePt.monthlyCPF > 0);
});
