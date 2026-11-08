/* Fixed, disclosed planning assumptions; no personal data leaves the browser. */
(function(root) {
  const C = {year:2026, inflation:.03, investmentReturn:.04, retirementAge:65, endAge:90, frs:220400, sumGrowth:.035, oaRate:.025, saRate:.04, wageCap:8000};
  const table = [[0,0],[50000,490],[110200,950],[150000,1250],[220400,1780],[300000,2380],[440800,3440]];
  function referencePayout(balance) {
    const x=Math.max(0,Math.min(2*C.frs,balance));
    for(let i=1;i<table.length;i++) if(x<=table[i][0]) {
      const [a,b]=table[i-1], [c,d]=table[i]; return b+(d-b)*(x-a)/(c-a);
    }
    return 3440;
  }
  const careRows=[
    {name:'Housing & utilities',now:[180,250],later:[230,320],note:'Paid-up 2-room Flexi flat: S&CC, utilities and routine upkeep. Rent, mortgage and purchase cost excluded.'},
    {name:'Food & groceries for two',now:[800,1000],later:[1050,1300],note:'Meals and groceries for the senior and helper. Helper food is counted here only.'},
    {name:'Transport',now:[120,180],later:[150,220],note:'Senior public transport plus occasional taxis; allow more rides as mobility changes.'},
    {name:'Healthcare & insurance reserve',now:[250,400],later:[500,850],note:'A monthly provision for premiums, medication and visits. Actual cover, subsidies and care needs vary.'},
    {name:'Helper: salary, levy & non-food costs',now:[1150,1450],later:[1500,1900],note:'Includes a normal $300 levy, insurance, checks and a reserve for employment costs. Food stays in the food row.'},
    {name:'Lifestyle & personal care',now:[150,250],later:[200,300],note:'Phone, broadband, haircuts, clothing and social spending.'}
  ];
  function careTotals(key='now') {return careRows.reduce((s,row)=>[s[0]+row[key][0],s[1]+row[key][1]],[0,0]);}
  // Match the supplied category midpoints at 65 and ten years later at 75.
  // Keep the $300 levy fixed; model general prices and an additional care-age allowance.
  const careAgeFactor = age => ((4260-300)/(3090-300)/1.03**10)**(Math.max(0,age-65)/10);
  function expenseAt(spend,startAge,elapsed) {
    const levy=Math.min(300,spend);
    return (spend-levy)*1.03**elapsed*careAgeFactor(startAge+elapsed)/careAgeFactor(startAge)+levy;
  }
  function portfolioTarget(spend, income, retirementAge, endAge=C.endAge) {
    const rate=(1+C.investmentReturn)**(1/12)-1;
    let target=0;
    for(let m=1;m<=Math.round((endAge-retirementAge)*12);m++) {
      const t=(m-1)/12;
      const cpf=retirementAge+t>=65?income:0;
      target+=Math.max(0,expenseAt(spend,retirementAge,t)-cpf)/(1+rate)**m;
    }
    return target;
  }
  function allocation(age) {
    return age<=35?[.6217,.1621]:age<=45?[.5677,.1891]:age<=50?[.5136,.2162]:[.4055,.3108];
  }
  function calculate(p) {
    const age=Number(p.age), salary=Number(p.salary);
    if(!Number.isInteger(age)||age<18||age>54) throw new Error('Enter an age from 18 to 54 for this CPF salary illustration.');
    if(!Number.isFinite(salary)||salary<=750||salary>1000000) throw new Error('Enter monthly gross salary above $750, before employee CPF.');
    for(const key of ['oa','sa','housing','savings','spend','invest']) if(p[key]!=null&&(!Number.isFinite(Number(p[key]))||Number(p[key])<0)) throw new Error('Use zero or a positive amount for balances, spending and monthly investments.');
    const retire=p.retire==null?65:Number(p.retire);
    if(!Number.isInteger(retire)||retire<Math.max(40,age)||retire>80) throw new Error('Retirement age must be at least your current age, between 40 and 80.');
    const months55=(55-age)*12, years55=55-age, wage=Math.min(salary,C.wageCap), contribution=wage*.37;
    let oa=Number(p.oa||0), sa=Number(p.sa||0), housingShortfall=0;
    for(let m=0;m<months55;m++) {
      const a=age+m/12;
      const activeContribution=a<retire?contribution:0;
      const [o,s]=allocation(a);
      oa=oa*(1+C.oaRate)**(1/12)+activeContribution*o;
      sa=sa*(1+C.saRate)**(1/12)+activeContribution*s;
      const housing=p.housing==null?activeContribution*o:Number(p.housing);
      housingShortfall+=Math.max(0,housing-oa); oa=Math.max(0,oa-housing);
    }
    const cpf=oa+sa, scale=(1+C.sumGrowth)**years55, frs=C.frs*scale, ers=2*frs;
    // A scaled reference illustration, not CPF Board's personalised annuity pricing.
    const income=referencePayout(Math.min(cpf,frs)/scale)*scale;
    const todaySpend=p.spend==null?3500:Number(p.spend);
    const years=retire-age, months=years*12, futureSpend=expenseAt(todaySpend,age,years);
    const target=portfolioTarget(futureSpend,income,retire,C.endAge), noCpfTarget=portfolioTarget(futureSpend,0,retire,C.endAge);
    const rate=(1+C.investmentReturn)**(1/12)-1, factor=((1+rate)**months-1)/rate;
    const savings=Number(p.savings||0), futureAssets=savings*(1+rate)**months;
    const saving=months?Math.max(0,target-futureAssets)/factor:Math.max(0,target-savings), savingNoCpf=months?Math.max(0,noCpfTarget-futureAssets)/factor:Math.max(0,noCpfTarget-savings);
    const cpfFactor=((1+C.saRate)**years55-1)/((1+C.saRate)**(1/12)-1);
    const topup=Math.min(1000,Math.max(0,C.frs-Number(p.sa||0))), delay=Math.min(10,years55);
    const spend65=expenseAt(todaySpend,age,65-age), spend75=expenseAt(todaySpend,age,75-age);
    const fundingMonths=Math.max(0,Math.min(55,retire)-age)*12;
    const cpfRate=1.04**(1/12)-1;
    const cpfFundingFactor=fundingMonths ? ((1+cpfRate)**fundingMonths-1)/cpfRate * 1.04**Math.max(0,55-retire) : 0;
    function makeScenario(key,label,balance) {
      const payout=referencePayout(balance/scale)*scale;
      const privateTarget=portfolioTarget(futureSpend,payout,retire);
      const privateSaving=months?Math.max(0,privateTarget-futureAssets)/factor:Math.max(0,privateTarget-savings);
      const cpfGap=Math.max(0,balance-cpf);
      const cpfFunding=cpfFundingFactor?cpfGap/cpfFundingFactor:cpfGap/1.04**years55;
      const chosenInvest=p.invest==null?privateSaving:Number(p.invest);
      const illustratedPortfolio=months?futureAssets+chosenInvest*factor:savings;
      let firstShortfallAge=null;
      for(let m=0;m<25*12;m++) if(expenseAt(spend65,65,m/12)>payout+.005) {firstShortfallAge=65+m/12;break;}
      return {key,label,balance,payout,cpfGap,cpfFunding,privateTarget,privateSaving,
        totalFunding:cpfFunding+privateSaving, gap65:Math.max(0,spend65-payout),gap75:Math.max(0,spend75-payout),
        firstShortfallAge,chosenInvest,illustratedPortfolio,remainingPortfolioGap:Math.max(0,privateTarget-illustratedPortfolio),
        contributionShortfall:Math.max(0,privateSaving-chosenInvest)};
    }
    const scenarios=[makeScenario('salary','Salary path',Math.min(cpf,frs)),makeScenario('frs','FRS',frs),makeScenario('ers','ERS',ers)];
    return {scenarios,spend65,spend75,age,salary,retire,at75:expenseAt(todaySpend,65,10),retiringNow:months===0,todaySpend,futureSpend,cpf,oa,sa,frs,ers,income,target,saving,savingNoCpf,
      frsMonthly:Math.max(0,frs-cpf)/cpfFactor, ersMonthly:Math.max(0,ers-cpf)/cpfFactor,
      employeeCpf:wage*.2,employerCpf:wage*.17,afterCpf:salary-wage*.2,
      contribution,wage,currentOA:contribution*allocation(age)[0],currentSA:contribution*allocation(age)[1],
      currentMA:contribution*(1-allocation(age)[0]-allocation(age)[1]),
      gap:Math.max(0,futureSpend-(retire>=65?income:0)),housingShortfall,
      topup,early:topup*1.04**years55,later:topup*1.04**(years55-delay),delay,
      refined:p.oa!=null||p.sa!=null||p.housing!=null};
  }
  const api={C,careRows,careTotals,expenseAt,referencePayout,portfolioTarget,calculate};
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
  root.RetirementModel=api;
})(typeof globalThis!=='undefined'?globalThis:this);
