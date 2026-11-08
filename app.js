const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const money = value => `$${Math.round(Math.max(0,value)||0).toLocaleString('en-SG')}`;
let selectSettingsTab=()=>{};
function setupCareBreakdown() {
  const range=values=>`S$${values[0].toLocaleString('en-SG')}–${values[1].toLocaleString('en-SG')}`;
  $('#care-cost-rows').innerHTML=RetirementModel.careRows.map(row=>`<article class="care-cost-row" role="listitem"><h4>${row.name}</h4><div><small>Age 65 · today</small><strong>${range(row.now)}</strong></div><div><small>Age 75 · +10 years</small><strong>${range(row.later)}</strong></div><p>${row.note}</p></article>`).join('');
}
function setupSimplePlan() {
  const fields={age:'person-age',salary:'person-salary',savings:'known-savings',spend:'known-spend',oa:'known-oa',sa:'known-sa',housing:'known-housing',retire:'known-retire',invest:'known-invest'};
  const out=$('#simple-results');let selected='ers';
  const setError=message=>{out.innerHTML='';const p=document.createElement('p');p.className='next-action';p.textContent=message;out.append(p);$('#settings-error').textContent=message;$('#plan-status').textContent=message;};
  const render=()=>{
    const comparisonOpen=out.querySelector('.path-comparison')?.open||false;
    const p={};
    for(const [key,id]of Object.entries(fields)){
      const input=$('#'+id);
      if(input.value.trim()===''){if(key==='age'||key==='salary'){setError('Enter your age and gross salary to see the CPF comparison.');return;}continue;}
      if(!input.validity.valid){setError('Check the allowed range for '+input.labels[0].textContent+'.');return;}
      p[key]=Number(input.value);
    }
    let r;try{r=RetirementModel.calculate(p);}catch(e){setError(e.message);return;}
    $('#settings-error').textContent='';
    $('#baseline-summary').textContent=`${money(r.todaySpend)}/month in today’s prices · retire at ${r.retire}`;
    const ers=r.scenarios.find(s=>s.key==='ers'),frs=r.scenarios.find(s=>s.key==='frs'),s=r.scenarios.find(s=>s.key===selected);
    const unit=r.retiringNow?' now':'/mo';const year65=2026+65-r.age,year75=year65+10;
    let verdict;
    if(ers.gap65>.005)verdict='Even the ERS scenario leaves a spending gap.';
    else if(ers.gap75>.005)verdict='ERS covers age 65, but the care budget later overtakes it.';
    else if(ers.firstShortfallAge!=null)verdict=`ERS covers 65 and 75, but a gap appears around age ${Math.floor(ers.firstShortfallAge)}.`;
    else verdict='ERS covers the modelled spending from 65 to 90.';
    const timeline=(age,year,spend,gap)=>`<article><span>AGE ${age} · ${year}</span><div class="coverage-number"><b>${money(spend)}</b><small>monthly spending</small></div><div class="income-coverage"><i style="width:${spend?Math.min(100,ers.payout/spend*100):100}%"></i></div><p>ERS income reference <b>${money(ers.payout)}/mo</b></p><strong>${money(gap)}/mo left to cover</strong></article>`;
    $('#plan-status').textContent=`${verdict} ${s.label} path: ${money(s.privateSaving)} ${r.retiringNow?'capital gap today':'a month outside CPF'}, plus ${money(s.cpfFunding)} ${r.retiringNow?'capital reserved today':'a month earmarked for CPF'}.`;
    const pathName={salary:'Salary path',frs:'FRS checkpoint',ers:'ERS higher-income path'};
    const descriptions={salary:'Salary-generated CPF, up to FRS. Existing balances count only when entered.',frs:'Full Retirement Sum: a retirement-income checkpoint.',ers:'Enhanced Retirement Sum: an optional higher commitment from 55.'};
    out.innerHTML=`<div class="verdict-card"><p class="form-kicker">IF YOU FUND ERS, IS CPF ALONE ENOUGH?</p><h3>${verdict}</h3><p>For your Solo + Helper budget of <b>${money(r.todaySpend)}/month in 2026 prices</b>. This compares a level CPF payout reference with inflation and rising care provisions.</p><div class="gap-timeline">${timeline(65,year65,r.spend65,ers.gap65)}${timeline(75,year75,r.spend75,ers.gap75)}</div><p class="verdict-note">“Max CPF” here means reaching the modelled ERS at 55—not assuming unlimited top-ups. Future sums and payouts are illustrations; CPF Board’s personalised estimate remains the check before committing.</p></div>
    <details class="path-comparison" ${comparisonOpen?'open':''}><summary>Compare salary path, FRS and ERS</summary><div class="comparison-heading"><h3>What changes if you build more CPF?</h3><p>Each path separates money needed for its CPF target from the investments funding the remaining lifestyle gap.</p></div>
    <div class="scenario-grid">${r.scenarios.map(path=>`<article class="scenario-card${path.key===selected?' is-selected':''}"><span class="scenario-title">${pathName[path.key]}</span><p>${descriptions[path.key]}</p><strong>${money(path.payout)}<small>/month income reference from 65</small></strong><dl><div><dt>Gap at 65</dt><dd>${money(path.gap65)}/mo</dd></div><div><dt>Extra reserve for CPF target</dt><dd>${money(path.cpfFunding)}${unit}</dd></div><div class="outside-goal"><dt>Outside-CPF investment goal</dt><dd>${money(path.privateSaving)}${unit}</dd></div></dl><button type="button" class="scenario-select" data-path="${path.key}" aria-pressed="${path.key===selected}">${path.key===selected?'Viewing this path':'Explore this path'} →</button></article>`).join('')}</div></details>
    <section class="selected-funding card-surface" id="funding-steps" aria-labelledby="selected-path-title"><div class="funding-heading"><div><p class="form-kicker">YOUR SELECTED COMPARISON</p><h3 id="selected-path-title">${pathName[s.key]}: two pots to fund</h3></div><button type="button" class="text-button" commandfor="plan-settings" command="show-modal" data-panel="invest">Adjust my investments ↗</button></div>
      <div class="funding-pots"><article><span>1 · Earmark for the CPF target</span><strong>${money(s.cpfFunding)}<small>${r.retiringNow?'capital needed now':`a month until age ${Math.min(55,r.retire)}`}</small></strong><p>Modelled age-55 target: ${money(s.balance)}. That leaves ${money(s.cpfGap)} beyond your salary projection. Check actual balances and permitted top-ups before locking money away.</p></article><article><span>2 · Invest outside CPF</span><strong>${money(s.privateSaving)}<small>${r.retiringNow?'capital shortfall now':`a month until age ${r.retire}`}</small></strong><p>Targets a ${money(s.privateTarget)} portfolio at ${r.retire}, to fund the spending left after this path’s CPF income through age 90.</p></article></div>
      <div class="funding-total"><span>Combined funding illustration</span><strong>${money(s.totalFunding)}${unit}</strong><small>${r.retiringNow?'Compare both capital requirements with available assets.':`${Math.round(s.totalFunding/r.afterCpf*100)}% of salary after employee CPF, before tax and living costs. The CPF reserve ends by 55; the outside investment goal runs to retirement.`}</small></div>
      <p class="funding-caution">${r.scenarios[0].firstShortfallAge===null?'Your salary path already covers modelled spending from 65 to 90. A higher CPF target is optional; compare the extra lock-in and liquidity before funding it.':s.totalFunding>r.afterCpf&&!r.retiringNow?'This exceeds salary after employee CPF. Add actual balances, review the budget or retirement date, and check affordability before using these contribution amounts.':!r.refined?'This starts from salary alone: existing CPF is excluded and future OA is assumed used for housing. Add known balances in Settings to refine any apparent target shortfall.':'Your entered CPF and housing details refine the salary projection. Check the two funding pots against your emergency reserve and current bills.'}</p>
      <div class="investment-impact"><span class="form-kicker">WHAT OUTSIDE INVESTING ADDS</span><h4>${r.retiringNow?'Compare your portfolio with the gap today':`Investing ${money(s.chosenInvest)}/month could build ${money(s.illustratedPortfolio)} by ${r.retire}.`}</h4><p>${r.retiringNow?`Your entered portfolio is ${money(s.illustratedPortfolio)} against a ${money(s.privateTarget)} target.`:`This includes ${money(Number(p.savings||0))} already invested and assumes 4% net annual growth. The CPF-target reserve is excluded from this portfolio.`}</p><p><b>${s.remainingPortfolioGap>.5?`${money(s.remainingPortfolioGap)} portfolio shortfall remains${!r.retiringNow&&p.invest!=null?`; roughly ${money(s.contributionShortfall)}/month more than your entered amount is needed`:''}.`:'That reaches this portfolio target in the steady-return illustration.'}</b></p><small>Investment withdrawals fund a finite period, not guaranteed lifelong income. Market falls, tax, fees and living beyond 90 can change the result.</small></div>
      ${selected==='ers'?`<details class="result-details"><summary>What choosing ERS changes compared with FRS</summary><p class="result-detail-copy">ERS lowers the outside-investment target by ${money(Math.max(0,frs.privateSaving-ers.privateSaving))}${unit}, while requiring ${money(Math.max(0,ers.cpfFunding-frs.cpfFunding))}${unit} more earmarked for CPF. More CPF income needs funding first; compare liquidity and the combined commitment, not the payout alone.</p></details>`:''}
      <details class="result-details"><summary>How to use this funding path</summary><ol class="personal-steps"><li>Keep emergency cash and housing money accessible before funding long-term targets.</li><li>Check the ${money(s.cpfGap)} CPF target gap against your dashboard. The reserve is a funding equivalent at an assumed 4%, not an instruction to top up that amount every month. ERS may require holding money outside CPF until an eligible RA top-up or transfer after 55.</li><li>Fund the separate outside-CPF investment pot. If using SRS, count those investments once and allow for access dates and withdrawal tax.</li><li>Review annually. Match the next spending years with cash and bond maturities as retirement gets closer.</li></ol><p class="result-footnote">An example ${money(r.topup)} eligible top-up now could grow to ${money(r.early)} by 55, versus ${money(r.later)} if delayed ${r.delay} years, at an assumed 4%. Actual eligibility and liquidity come first.</p>${r.housingShortfall?`<p class="result-footnote">Your housing entry exceeds available OA by ${money(r.housingShortfall)} across the projection; that needs another funding source.</p>`:''}<a class="text-link dark-link" href="https://www.cpf.gov.sg/member/tools-and-services/calculators" target="_blank" rel="noreferrer">Check personalised CPF payouts ↗</a></details>
    </section>
    <p class="comparison-footnote">Income references use CPF Board’s male Standard Plan examples starting at 65, scaled to a future retirement-sum scenario. CPF and investment results are illustrations, not personalised quotes or promised returns. CPF LIFE continues for life; the portfolio models spending only to 90. These are funding comparisons, not return rankings. ${r.retire<65?`Your portfolio target includes the bridge from age ${r.retire} to 65.`:''}</p>`;
  };
  Object.values(fields).forEach(id=>$('#'+id).addEventListener('input',render));
  out.addEventListener('click',event=>{const button=event.target.closest('button[data-path]');if(!button)return;selected=button.dataset.path;render();$(`button[data-path="${selected}"]`).focus({preventScroll:true});});
  $('#reset-settings').addEventListener('click',()=>{Object.values(fields).filter(id=>id.startsWith('known-')).forEach(id=>$('#'+id).value='');render();});
  render();
}
function setupSettings() {
  const dialog=$('#plan-settings'),tabs=$$('.settings-tabs [role="tab"]');let lastInvoker=null;
  selectSettingsTab=name=>{tabs.forEach(tab=>{const active=tab.id==='tab-'+name;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;$('#'+tab.getAttribute('aria-controls')).hidden=!active;});};
  tabs.forEach((tab,index)=>{
    tab.addEventListener('click',()=>selectSettingsTab(tab.id.replace('tab-','')));
    tab.addEventListener('keydown',event=>{let i=index;if(event.key==='ArrowRight')i=(i+1)%tabs.length;else if(event.key==='ArrowLeft')i=(i+tabs.length-1)%tabs.length;else if(event.key==='Home')i=0;else if(event.key==='End')i=tabs.length-1;else return;event.preventDefault();selectSettingsTab(tabs[i].id.replace('tab-',''));tabs[i].focus();});
  });
  document.addEventListener('click',event=>{
    const button=event.target.closest('button[commandfor="plan-settings"]');if(!button)return;
    const command=button.getAttribute('command');
    if(command==='show-modal'){lastInvoker=button;if(button.dataset.panel)selectSettingsTab(button.dataset.panel);button.setAttribute('aria-expanded','true');}
    if(!('commandForElement'in HTMLButtonElement.prototype)){event.preventDefault();if(command==='show-modal')dialog.showModal();else dialog.close();}
  });
  dialog.addEventListener('close',()=>{$$('button[command="show-modal"]').forEach(button=>button.setAttribute('aria-expanded','false'));if(lastInvoker?.isConnected)lastInvoker.focus({preventScroll:true});else $('.settings-trigger').focus({preventScroll:true});});
  dialog.addEventListener('click',event=>{const r=dialog.getBoundingClientRect();if(event.target===dialog&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom))dialog.close();});
  $$('button[command="show-modal"]').forEach(button=>{button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','plan-settings');});
}
function setupDeepLinks() {
  document.addEventListener('click',event=>{const link=event.target.closest('a[href^="#"]');if(!link)return;const target=document.getElementById(link.getAttribute('href').slice(1));if(!target)return;const details=target.matches('details')?target:target.querySelector('.module-disclosure');if(details)details.open=true;let ancestor=target.closest('details');while(ancestor){ancestor.open=true;ancestor=ancestor.parentElement.closest('details');}});
}
function setupOfflineStatus() {
  const label=$('#offline-label');const update=()=>{label.textContent=navigator.onLine?'Works offline':'Offline mode';};
  window.addEventListener('online',update);window.addEventListener('offline',update);update();
  if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>label.textContent='Browser mode');
}
setupCareBreakdown();setupSimplePlan();setupSettings();setupDeepLinks();setupOfflineStatus();
$$('form').forEach(form=>form.addEventListener('submit',event=>event.preventDefault()));
