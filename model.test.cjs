const test=require('node:test');
const assert=require('node:assert/strict');
const {referencePayout,portfolioTarget,C}=require('./model.js');
// Explicit legacy fixtures preserve the approved Home + Helper behaviour.
const calculate=p=>require('./model.js').calculate({lifestyle:'home-helper',...p});
const generateTrajectory=(p,key)=>require('./model.js').generateTrajectory({lifestyle:'home-helper',...p},key);
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
test('explicit Home + Helper fixture stays adjustable',()=>{
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

test('senior allocation uses official 2026 and announced 2027 tables',()=>{
 const {allocation}=require('./model.js');
 assert.deepEqual(allocation(57,2026),[.353,.3382,.34]);
 assert.deepEqual(allocation(62,2026),[.14,.44,.25]);
 assert.deepEqual(allocation(57,2027),[.3382,.3661,.355]);
 assert.deepEqual(allocation(62,2027),[.1347,.4615,.26]);
});
test('post-55 contributions cannot automatically turn OA into CPF LIFE funding',()=>{
 const p={age:54,salary:8000,sa:1000000,housing:0};
 const a=calculate(p), b=calculate({...p,post55Work:true});
 assert.equal(b.extraPost55CPF,0);
 assert.equal(b.post55RAContributions,0);
 assert.ok(b.post55OA>0);
 assert.equal(b.scenarios[0].payout,a.scenarios[0].payout);
});
test('later RA additions are capped and discounted rather than labelled age-55 balances',()=>{
 const p={age:54,salary:8000};
 const a=calculate(p), b=calculate({...p,post55Work:true});
 assert.equal(b.cpfAt55,a.cpfAt55);
 assert.ok(b.extraPost55CPF>0 && b.extraPost55CPF<b.post55RAContributions);
 assert.ok(b.post55RAContributions<=b.frs-Math.min(b.cpfAt55,b.frs));
 assert.ok(b.cpf<=b.frs);
 assert.equal(calculate({...p,retire:55,post55Work:true}).extraPost55CPF,0);
});

test('future senior contributions cannot pre-fund an FRS or ERS commitment at 55',()=>{
 const p={age:54,salary:8000};
 const a=calculate(p),b=calculate({...p,post55Work:true});
 for(const key of ['frs','ers']) {
  const x=a.scenarios.find(s=>s.key===key),y=b.scenarios.find(s=>s.key===key);
  assert.equal(y.cpfGap,x.cpfGap);
  assert.equal(y.cpfFunding,x.cpfFunding);
 }
 assert.equal(b.scenarios[0].cpfFunding,0);
});

test('today-dollar display converts each future amount at its own date without changing savings',()=>{
 const {todayPlan,todayValue}=require('./model');
 for(const age of [28,35,45,54])for(const inflationRate of [.025,.03,.035])for(const plan of ['standard','escalating']){
  const r=calculate({age,salary:6000,inflationRate,plan}),d=todayPlan(r);
  const at=(x,a)=>todayValue(x,a,age,inflationRate);
  assert.equal(d.spend65,at(r.spend65,65));assert.equal(d.spend75,at(r.spend75,75));
  assert.equal(d.frs,at(r.frs,55));assert.equal(d.cpfAt55,at(r.cpfAt55,55));
  assert.equal(d.salary,r.salary);assert.equal(d.afterCpf,r.afterCpf);
  for(let i=0;i<3;i++){
   assert.equal(d.scenarios[i].payout,at(r.scenarios[i].payout,65));
   assert.equal(d.scenarios[i].payout75,at(r.scenarios[i].payout75,75));
   assert.ok(Math.abs(d.scenarios[i].gap65-Math.max(0,d.spend65-d.scenarios[i].payout))<1e-9);
   assert.ok(Math.abs(d.scenarios[i].gap75-Math.max(0,d.spend75-d.scenarios[i].payout75))<1e-9);
   assert.equal(d.scenarios[i].privateSaving,r.scenarios[i].privateSaving);
   assert.equal(d.scenarios[i].cpfFunding,r.scenarios[i].cpfFunding);
   assert.equal(d.scenarios[i].privateTarget,at(r.scenarios[i].privateTarget,r.retire));
  }
  assert.equal(r.moneyBasis,undefined);
 }
});
test('default today-dollar example and fixed-levy effect are explicit',()=>{
 const {todayPlan,todayValue}=require('./model');const r=calculate({age:35,salary:6000}),d=todayPlan(r);
 assert.equal(Math.round(d.spend65),3324);assert.equal(Math.round(d.scenarios[0].payout),639);
 assert.equal(Math.round(d.scenarios[0].gap65),2684);
 assert.equal(Math.round(d.scenarios[0].privateSaving),2869);
 assert.equal(todayValue(1234,35,35,.03),1234);
 assert.equal(todayValue(1234,65,35,0),1234);
 const standard=todayPlan(calculate({age:35,salary:6000})).scenarios[0];
 assert.ok(standard.payout75<standard.payout);
});
test('real chart values reconcile with the answer at both milestone ages',()=>{
 const {todayPlan,todayTrajectory}=require('./model');
 for(const plan of ['standard','escalating'])for(const retire of [45,65,75])for(const key of ['salary','frs','ers']){
  const p={age:35,salary:6000,retire,plan},t=todayTrajectory(generateTrajectory(p,key)),d=todayPlan(t.summary),s=d.scenarios.find(x=>x.key===key);
  for(const age of [65,75]){
   const point=t.points.find(x=>x.age===age);
   assert.ok(Math.abs(point.monthlyCPF-(age===65?s.payout:s.payout75))<1e-7);
   if(age>=retire)assert.ok(Math.abs(point.monthlyGap-(age===65?s.gap65:s.gap75))<1e-6);
  }
 }
});
test('funded portfolio trajectory matches monthly withdrawal target through 90',()=>{
 for(const plan of ['standard','escalating'])for(const retire of [45,65,75])for(const key of ['salary','frs','ers']){
  const t=generateTrajectory({age:35,salary:6000,retire,plan},key),atRetire=t.points.find(x=>x.age===retire);
  assert.ok(Math.abs(atRetire.portfolioBalance-t.selectedScenario.privateTarget)<1e-5);
  assert.ok(t.points.at(-1).portfolioBalance<1e-4);
 }
});
test('drawdown slices use one retirement date and cannot exceed the portfolio',()=>{
 const {todayPlan,drawdownToday,todayValue}=require('./model');
 for(const retire of [40,55,65,75,80])for(const spend of [0,500,3500]){
  const r=calculate({age:35,salary:6000,retire,spend}),d=todayPlan(r);
  for(let i=0;i<3;i++){
   const v=drawdownToday(r,r.scenarios[i]);
   assert.ok(Math.abs(v.cashReserve+v.ssbLadder+v.equityCore-d.scenarios[i].privateTarget)<1e-6);
   assert.ok(v.ssbLadder<=todayValue(200000,retire,r.age,r.inflation));
  }
 }
});


test('CCA is the new default with the approved spending provisions',()=>{
 const M=require('./model.js');const r=M.calculate({age:35,salary:6000});
 assert.equal(r.lifestyle,'cca');assert.equal(r.todaySpend,2500);
 assert.equal(M.ccaRows.reduce((sum,row)=>sum+row.now,0),2500);
 assert.equal(M.ccaRows.reduce((sum,row)=>sum+row.later,0),3340);
 const d=M.todayPlan(r);
 assert.ok(Math.abs(d.spend65-2500)<1e-8);assert.ok(Math.abs(d.spend75-3340)<1e-8);
 assert.equal(M.expenseAt(2500,65,10,0,'cca'),3340);
 assert.throws(()=>M.calculate({age:35,salary:6000,lifestyle:'unknown'}));
 assert.throws(()=>M.calculate({age:35,salary:6000,retire:45}));
 assert.equal(M.calculate({age:35,salary:6000,retire:45,lifestyle:'home-helper'}).retire,45);
});
test('CCA custom budgets scale care provisions, without a fixed levy',()=>{
 const M=require('./model.js');const p={age:35,salary:6000};
 const full=M.todayPlan(M.calculate(p)),half=M.todayPlan(M.calculate({...p,spend:1250}));
 assert.ok(Math.abs(half.spend65/full.spend65-.5)<1e-8);
 assert.ok(Math.abs(half.spend75/full.spend75-.5)<1e-8);
 assert.equal(M.calculate({...p,spend:0}).target,0);
});
test('both presets reconcile answer, monthly trajectory and portfolio funding',()=>{
 const M=require('./model.js');
 for(const lifestyle of ['cca','home-helper'])for(const age of [28,45,54])for(const retire of [55,65,80])for(const plan of ['standard','escalating'])for(const key of ['salary','frs','ers']){
  const p={age,salary:6000,lifestyle,retire,plan};
  const t=M.generateTrajectory(p,key),d=M.todayPlan(t.summary),real=M.todayTrajectory(t),s=d.scenarios.find(x=>x.key===key);
  assert.ok(Math.abs(t.points.find(x=>x.age===retire).portfolioBalance-t.selectedScenario.privateTarget)<1e-5);
  assert.ok(t.points.at(-1).portfolioBalance<1e-4);
  for(const milestone of [65,75]){
   const pt=real.points.find(x=>x.age===milestone);
   assert.ok(Math.abs(pt.monthlySpend-(milestone===65?d.spend65:d.spend75))<1e-7);
   assert.ok(Math.abs(pt.monthlyCPF-(milestone===65?s.payout:s.payout75))<1e-7);
  }
  const slices=M.drawdownToday(t.summary,t.selectedScenario);
  assert.ok(Math.abs(slices.cashReserve+slices.ssbLadder+slices.equityCore-s.privateTarget)<1e-6);
 }
});

test('budget previews reconcile categories, groups and custom totals for both presets',()=>{
 const M=require('./model.js');
 for(const lifestyle of ['cca','home-helper'])for(const total of [0,1000,2500,3500,4321.5]){
  const b=M.budgetBreakdown(lifestyle,total);
  assert.ok(Math.abs(b.rows.reduce((sum,row)=>sum+row.amount,0)-total)<1e-8);
  assert.ok(Math.abs(b.groups.reduce((sum,group)=>sum+group.amount,0)-total)<1e-8);
  assert.equal(b.groups.length,3);
  for(const row of b.rows)assert.ok(Number.isFinite(row.amount)&&row.amount>=0);
 }
 const cca=M.budgetBreakdown();assert.equal(cca.total,2500);
 assert.deepEqual(cca.groups.map(g=>g.amount),[1180,1120,200]);
 const helper=M.budgetBreakdown('home-helper');assert.equal(helper.total,3500);
 assert.equal(helper.rows.find(row=>row.name==='Planning cushion').amount,410);
 assert.throws(()=>M.budgetBreakdown('unknown',2500));
 assert.throws(()=>M.budgetBreakdown('cca',-1));
});


test('OA balance visibly reduces ERS savings while the fully funded ERS payout stays fixed',()=>{
 const M=require('./model.js');
 for(const lifestyle of ['cca','home-helper']){
  const p={age:35,salary:6000,lifestyle};const base=M.calculate(p),withOA=M.calculate({...p,oa:100000});
  assert.ok(withOA.cpfAt55>base.cpfAt55);
  assert.ok(withOA.scenarios[0].payout>base.scenarios[0].payout);
  assert.ok(withOA.scenarios[2].cpfGap<base.scenarios[2].cpfGap);
  assert.ok(withOA.scenarios[2].cpfFunding<base.scenarios[2].cpfFunding);
  assert.equal(withOA.scenarios[2].payout,base.scenarios[2].payout);
 }
});
test('budget changes own retirement savings, not CPF sum goals or ERS top-up savings',()=>{
 const M=require('./model.js');
 for(const lifestyle of ['cca','home-helper']){
  const p={age:35,salary:6000,lifestyle,oa:100000};const base=M.calculate(p),higher=M.calculate({...p,spend:4500});
  assert.equal(higher.ers,base.ers);assert.equal(higher.cpfAt55,base.cpfAt55);
  assert.equal(higher.scenarios[2].cpfGap,base.scenarios[2].cpfGap);
  assert.equal(higher.scenarios[2].cpfFunding,base.scenarios[2].cpfFunding);
  for(let i=0;i<3;i++)assert.ok(higher.scenarios[i].privateSaving>base.scenarios[i].privateSaving);
 }
});
