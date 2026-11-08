const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const money = value => `$${Math.round(Math.max(0,value)||0).toLocaleString('en-SG')}`;
function setupCareBreakdown() {
  const range=values=>`S$${values[0].toLocaleString('en-SG')}–${values[1].toLocaleString('en-SG')}`;
  $('#care-cost-rows').innerHTML=RetirementModel.careRows.map(row=>`<article class="care-cost-row" role="listitem"><h4>${row.name}</h4><div><small>Age 65 · today</small><strong>${range(row.now)}</strong></div><div><small>Age 75 · +10 years</small><strong>${range(row.later)}</strong></div><p>${row.note}</p></article>`).join('');
}
function setupSimplePlan() {
  const fields={age:'person-age',salary:'person-salary',savings:'known-savings',spend:'known-spend',oa:'known-oa',sa:'known-sa',housing:'known-housing',retire:'known-retire'};
  const out=$('#simple-results');
  const render=()=>{
    const p={profile:document.querySelector('input[name="spending-profile"]:checked').value};
    for(const [key,id] of Object.entries(fields)) {
      const input=$('#'+id);
      if(input.value.trim()==='') {if(key==='age'||key==='salary') {out.innerHTML='<p class="next-action">Enter your age and gross salary to see a starting answer.</p>';return;} continue;}
      if(!input.validity.valid) {out.innerHTML='<p class="next-action">Check the allowed range for '+input.labels[0].textContent+'.</p>';return;}
      p[key]=Number(input.value);
    }
    let r;try{r=RetirementModel.calculate(p);}catch(e){out.textContent=e.message;return;}
    const ratio=r.retiringNow?0:Math.round(r.saving/r.afterCpf*100), monthsToCpf=Math.max(0,65-r.retire)*12;
    const status=r.cpf>=r.frs?'Salary projection reaches the FRS scenario.':'There is a gap to the FRS scenario.';
    out.innerHTML=`<div class="simple-answer-grid">
      <article class="answer-tile"><span class="answer-step">01 · MONTHLY NEED</span><strong>${money(r.todaySpend)}<small>/month today</small></strong><p>About <b>${money(r.futureSpend)}/month at ${r.retire} (${2026+r.retire-r.age})</b> after modelled inflation.</p>${p.spend==null?`<p class="answer-small">${r.profile==='helper'?'Solo + helper planning target, in 2026 prices.':'Survey reference adjusted from 2023 to 2026 at 2% a year.'}</p>`:''}<a href="${r.profile==='helper'?'#retirement-budget':'#survey-reference'}">See the spending breakdown →</a></article>
      <article class="answer-tile"><span class="answer-step">02 · CPF AT 55</span><strong>${money(r.cpf)}<small>retirement balance illustration</small></strong><p>${status}</p><p class="answer-small">${r.refined?'Uses the CPF details entered.':'Salary-only start: existing CPF is excluded and future OA is assumed used for housing.'}</p></article>
      <article class="answer-tile answer-highlight"><span class="answer-step">03 · ${r.retiringNow?'INVESTMENT GAP TODAY':'EXTRA INVESTMENT SAVING'}</span><strong>${money(r.saving)}<small>${r.retiringNow?'capital shortfall today':'/month from now'}</small></strong><p>Using a <b>${money(r.income)}/month CPF income reference</b> from 65. This is a modelled comparison, not a personalised payout quote.</p><p class="answer-small">${r.retiringNow?'Compare this capital shortfall with your available assets.':`About ${ratio}% of salary after employee CPF, before tax and living costs.`}</p></article>
    </div>
    <p class="next-action">${r.retiringNow?'You are modelling retirement today. Review the capital shortfall, the bridge to 65 and accessible savings before making commitments.':!r.refined?'This starting answer excludes CPF saved already. Keep emergency cash accessible; use the optional balances to refine the apparent gap before deciding on a top-up.':ratio>100?'This scenario needs more than your salary after employee CPF. Try a later retirement, review spending, or add existing savings before treating this as an affordable plan.':r.cpf<r.frs?'First: keep emergency cash accessible. Next: check whether a CPF top-up fits the gap below, then update the investment plan after confirming your CPF income.':'First: keep emergency cash accessible. Your salary projection covers the FRS scenario; assess whether extra CPF lock-in adds value before funding more of the flexible investment bucket.'}</p>
    <details class="result-details"><summary>See my CPF targets and what starting earlier changes</summary><div class="forecast-cards">
      <article><span>Full Retirement Sum (FRS) scenario</span><strong>${money(r.frs)}</strong><div class="target-track" aria-hidden="true"><i style="width:${Math.min(100,r.cpf/r.frs*100)}%"></i></div><p>${money(r.frs-r.cpf)} projected gap at 55.</p><p>Equivalent extra saving at assumed 4%: <b>${money(r.frsMonthly)}/month</b>.</p></article>
      <article><span>Enhanced Retirement Sum (ERS) comparison</span><strong>${money(r.ers)}</strong><div class="target-track" aria-hidden="true"><i style="width:${Math.min(100,r.cpf/r.ers*100)}%"></i></div><p>${money(r.ers-r.cpf)} projected gap at 55.</p><p>Equivalent extra saving at assumed 4%: <b>${money(r.ersMonthly)}/month</b>. An optional higher commitment at 55+, not a required target.</p></article>
      <article><span>Example: the same ${money(r.topup)} top-up</span><strong>+${money(r.early-r.later)}</strong><p>Extra value by 55 if made now rather than ${r.delay} years later, assuming 4% yearly.</p><p>Now: ${money(r.early)}. Later: ${money(r.later)}. Check top-up eligibility and liquidity first.</p></article></div><p class="result-footnote">Future retirement sums are scenario assumptions. The monthly gap figures are not automatic CPF top-up instructions; eligible limits can restrict what goes into SA. FRS is a checkpoint, not a guarantee it covers your lifestyle.</p></details>
    <details class="result-details"><summary>See the investment estimate and its limits</summary><div class="result-detail-copy"><p>Salary after employee CPF: <b>${money(r.afterCpf)}/month</b>, before tax. Employer CPF adds <b>${money(r.employerCpf)}/month</b>.</p><p>Portfolio target at ${r.retire}: <b>${money(r.target)}</b>. The initial investment-funded spending gap is <b>${money(r.gap)}/month</b>. ${monthsToCpf?`Includes ${monthsToCpf/12} years before CPF starts at 65.`:'The CPF income reference starts at 65.'}</p><p>With no allowance for CPF income at all, the same spending plan would need about <b>${money(r.savingNoCpf)}${r.retiringNow?' of additional capital':'/month of investment saving'}</b>. This helps show how sensitive the answer is to the income assumption.</p>${r.housingShortfall?`<p>Your entered housing payment exceeds available OA by ${money(r.housingShortfall)} across the projection. That shortfall needs cash or another funding source.</p>`:''}<p>This covers spending to age 90 under steady returns. Living longer, market falls, taxes or changes to CPF can increase the amount needed. <a href="https://www.cpf.gov.sg/member/tools-and-services/calculators" target="_blank" rel="noreferrer">Verify your CPF payout with CPF before committing ↗</a></p></div></details>`;
  };
  Object.values(fields).forEach(id=>$('#'+id).addEventListener('input',render));
  $$('input[name="spending-profile"]').forEach(input=>input.addEventListener('change',render));render();
}
function setupOfflineStatus() {
  const label=$('#offline-label');const update=()=>{label.textContent=navigator.onLine?'Works offline':'Offline mode';};
  window.addEventListener('online',update);window.addEventListener('offline',update);update();
  if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>label.textContent='Browser mode');
}
setupCareBreakdown();setupSimplePlan();setupOfflineStatus();
$$('form').forEach(form=>form.addEventListener('submit',e=>e.preventDefault()));
