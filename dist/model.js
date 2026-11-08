/* Fixed, disclosed planning assumptions; no personal data leaves the browser. */
(function(root) {
  const C = {year:2026, inflation:.02, investmentReturn:.04, retirementAge:65, endAge:90, frs:220400, sumGrowth:.035, oaRate:.025, saRate:.04, wageCap:8000};
  const table = [[0,0],[50000,490],[110200,950],[150000,1250],[220400,1780]];
  function referencePayout(balance) {
    const x=Math.max(0,Math.min(C.frs,balance));
    for(let i=1;i<table.length;i++) if(x<=table[i][0]) {
      const [a,b]=table[i-1], [c,d]=table[i]; return b+(d-b)*(x-a)/(c-a);
    }
    return 1780;
  }
  function portfolioTarget(spend, income, retirementAge, endAge=C.endAge) {
    const rate=(1+C.investmentReturn)**(1/12)-1;
    let target=0;
    for(let m=1;m<=Math.round((endAge-retirementAge)*12);m++) {
      const t=(m-1)/12;
      const cpf=retirementAge+t>=65?income:0;
      target+=Math.max(0,spend*(1+C.inflation)**t-cpf)/(1+rate)**m;
    }
    return target;
  }
  function calculate(p) {
    const age=Number(p.age), salary=Number(p.salary);
    if(!Number.isInteger(age)||age<18||age>54) throw new Error('Enter an age from 18 to 54 for this CPF salary illustration.');
    if(!Number.isFinite(salary)||salary<=750||salary>1000000) throw new Error('Enter monthly gross salary above $750, before employee CPF.');
    for(const key of ['oa','sa','housing','savings','spend']) if(p[key]!=null&&(!Number.isFinite(Number(p[key]))||Number(p[key])<0)) throw new Error('Use zero or a positive amount for balances and spending.');
    const retire=p.retire==null?65:Number(p.retire);
    if(!Number.isInteger(retire)||retire<Math.max(40,age)||retire>80) throw new Error('Retirement age must be at least your current age, between 40 and 80.');
    const months55=(55-age)*12, years55=55-age, wage=Math.min(salary,C.wageCap), contribution=wage*.37;
    let oa=Number(p.oa||0), sa=Number(p.sa||0), housingShortfall=0;
    for(let m=0;m<months55;m++) {
      const a=age+m/12;
      const activeContribution=a<retire?contribution:0;
      const [o,s]=a<=35?[.6217,.1621]:a<=45?[.5677,.1891]:a<=50?[.5136,.2162]:[.4055,.3108];
      oa=oa*(1+C.oaRate)**(1/12)+activeContribution*o;
      sa=sa*(1+C.saRate)**(1/12)+activeContribution*s;
      const housing=p.housing==null?activeContribution*o:Number(p.housing);
      housingShortfall+=Math.max(0,housing-oa); oa=Math.max(0,oa-housing);
    }
    const cpf=oa+sa, scale=(1+C.sumGrowth)**years55, frs=C.frs*scale, ers=2*frs;
    // A scaled reference illustration, not CPF Board's personalised annuity pricing.
    const income=referencePayout(Math.min(cpf,frs)/scale)*scale;
    const todaySpend=p.spend==null?1384*(1+C.inflation)**3:Number(p.spend);
    const years=retire-age, months=years*12, futureSpend=todaySpend*(1+C.inflation)**years;
    const target=portfolioTarget(futureSpend,income,retire), noCpfTarget=portfolioTarget(futureSpend,0,retire);
    const rate=(1+C.investmentReturn)**(1/12)-1, factor=((1+rate)**months-1)/rate;
    const savings=Number(p.savings||0), futureAssets=savings*(1+rate)**months;
    const saving=months?Math.max(0,target-futureAssets)/factor:Math.max(0,target-savings), savingNoCpf=months?Math.max(0,noCpfTarget-futureAssets)/factor:Math.max(0,noCpfTarget-savings);
    const cpfFactor=((1+C.saRate)**years55-1)/((1+C.saRate)**(1/12)-1);
    const topup=Math.min(1000,Math.max(0,C.frs-Number(p.sa||0))), delay=Math.min(10,years55);
    return {age,salary,retire,retiringNow:months===0,todaySpend,futureSpend,cpf,oa,sa,frs,ers,income,target,saving,savingNoCpf,
      frsMonthly:Math.max(0,frs-cpf)/cpfFactor, ersMonthly:Math.max(0,ers-cpf)/cpfFactor,
      employeeCpf:wage*.2,employerCpf:wage*.17,afterCpf:salary-wage*.2,
      gap:Math.max(0,futureSpend-(retire>=65?income:0)),housingShortfall,
      topup,early:topup*1.04**years55,later:topup*1.04**(years55-delay),delay,
      refined:p.oa!=null||p.sa!=null||p.housing!=null};
  }
  const api={C,referencePayout,portfolioTarget,calculate};
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
  root.RetirementModel=api;
})(typeof globalThis!=='undefined'?globalThis:this);
