const test=require('node:test');
const assert=require('node:assert/strict');
const {calculate,referencePayout,portfolioTarget,C}=require('./model.js');
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
test('income reference matches published 2026 anchor points and caps at FRS',()=>{
 assert.equal(referencePayout(50000),490);assert.equal(referencePayout(220400),1780);
 assert.equal(referencePayout(440800),1780);assert.equal(referencePayout(0),0);
});
test('more savings lower the investment contribution; actual spending raises it',()=>{
 const p={age:35,salary:6000};const a=calculate(p);
 assert.ok(calculate({...p,savings:50000}).saving<a.saving);
 assert.ok(calculate({...p,spend:2500}).saving>a.saving);
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
