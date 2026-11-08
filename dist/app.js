const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const money = (value) => `$${Math.round(Math.max(0, value) || 0).toLocaleString('en-SG')}`;

function setupBudget() {
  const fields = $$('[data-budget]');
  const total = $('#budget-total');
  const core = $('#budget-core-total');
  const flex = $('#budget-flex-total');
  const breakdown = $('#budget-breakdown');
  if (!fields.length || !total) return;
  const flexible = new Set(['Phone and communications', 'Recreation and social life', 'Clothing and other']);
  const render = () => {
    const rows = fields.map((field) => ({ name: field.dataset.budget, value: Math.max(0, Number(field.value) || 0) }));
    const sum = rows.reduce((acc, row) => acc + row.value, 0);
    const coreSum = rows.filter((row) => !flexible.has(row.name)).reduce((acc, row) => acc + row.value, 0);
    total.textContent = `${money(sum)}`;
    core.textContent = money(coreSum);
    flex.textContent = money(sum - coreSum);
    if (breakdown) { const max = Math.max(...rows.map((row) => row.value), 1); breakdown.innerHTML = rows.map((row) => `<div class="budget-row" role="listitem"><span class="budget-row-label">${row.name}</span><span class="budget-row-track" aria-hidden="true"><i style="width:${Math.max(2, row.value / max * 100)}%"></i></span><strong>${money(row.value)}</strong></div>`).join(''); }
    document.dispatchEvent(new CustomEvent('retirement-budget-change', { detail: { total: sum } }));
  };
  fields.forEach((field) => field.addEventListener('input', render));
  render();
}

function setupPlan() {
  const ids = ['plan-age', 'plan-retire-age', 'plan-cpf', 'plan-other-income', 'plan-savings', 'plan-years', 'plan-inflation', 'plan-return'];
  const inputs = Object.fromEntries(ids.map((id) => [id, $(`#${id}`)]));
  if (Object.values(inputs).some((input) => !input)) return;
  let monthlyBudget = 1384;
  const calculate = () => {
    const age = Math.max(18, Number(inputs['plan-age'].value) || 35);
    const retireAge = Math.max(age, Number(inputs['plan-retire-age'].value) || age);
    const years = retireAge - age;
    const months = years * 12;
    const inflation = Math.max(0, Number(inputs['plan-inflation'].value) || 0) / 100;
    const returnRate = Math.max(0, Number(inputs['plan-return'].value) || 0) / 100;
    const cpf = Math.max(0, Number(inputs['plan-cpf'].value) || 0);
    const other = Math.max(0, Number(inputs['plan-other-income'].value) || 0);
    const currentSavings = Math.max(0, Number(inputs['plan-savings'].value) || 0);
    const drawYears = Math.max(1, Number(inputs['plan-years'].value) || 1);
    const futureBudget = monthlyBudget * (1 + inflation) ** years;
    const gap = Math.max(0, futureBudget - cpf - other);
    const realMonthly = ((1 + returnRate) / (1 + inflation)) ** (1 / 12) - 1;
    const withdrawalMonths = drawYears * 12;
    const capital = realMonthly === 0 ? gap * withdrawalMonths : gap * (1 - (1 + realMonthly) ** -withdrawalMonths) / realMonthly;
    const nominalMonthly = (1 + returnRate) ** (1 / 12) - 1;
    const currentAtRetirement = currentSavings * (1 + nominalMonthly) ** months;
    const nominalCapitalTarget = capital; // capital is already in retirement-year dollars
    const contributionFactor = months ? (nominalMonthly === 0 ? months : ((1 + nominalMonthly) ** months - 1) / nominalMonthly) : 0;
    const monthlySaving = months && contributionFactor ? Math.max(0, (nominalCapitalTarget - currentAtRetirement) / contributionFactor) : Math.max(0, nominalCapitalTarget - currentSavings) / 12;
    $('#plan-future-budget').textContent = `${money(futureBudget)}/mo`;
    $('#plan-monthly-gap').textContent = `${money(gap)}/mo`;
    $('#plan-capital').textContent = money(capital);
    $('#plan-monthly-saving').textContent = `${money(monthlySaving)}/mo`;
    const coverage = futureBudget ? Math.min(100, ((cpf + other) / futureBudget) * 100) : 0;
    $('#plan-coverage-fill').style.width = `${coverage}%`;
    $('#plan-coverage-caption').textContent = `${Math.round(coverage)}% covered by CPF LIFE and other entered steady income. Values shown in retirement-year dollars.`;
  };
  Object.values(inputs).forEach((input) => input.addEventListener('input', calculate));
  document.addEventListener('retirement-budget-change', (event) => { monthlyBudget = event.detail.total; calculate(); });
  calculate();
}

function setupCpfSnapshot() {
  const fields = ['cpf-oa', 'cpf-sa', 'cpf-ma', 'cpf-ra-extra'].map((id) => $(`#${id}`));
  const total = $('#cpf-total');
  const breakdown = $('#cpf-breakdown');
  if (!total || fields.some((field) => !field)) return;
  const names = ['Ordinary Account', 'Special Account', 'MediSave Account', 'Retirement Account (separate)'];
  const render = () => {
    const values = fields.map((field) => Math.max(0, Number(field.value) || 0));
    total.textContent = money(values.reduce((a, b) => a + b, 0));
    breakdown.innerHTML = values.map((value, index) => `<div class="cpf-bar-row"><span>${names[index]}</span><strong>${money(value)}</strong><i><b style="width:${values.reduce((a,b)=>a+b,0) ? value / values.reduce((a,b)=>a+b,0) * 100 : 0}%"></b></i></div>`).join('');
  };
  fields.forEach((field) => field.addEventListener('input', render));
  render();
}

function setupCpfForecast() {
  const ids = ['cpf-salary','cpf-start-age','cpf-housing','cpf-target-growth','cpf-topup','cpf-delay','cpf-oa','cpf-sa','cpf-ma','cpf-ra-extra'];
  const update = () => {
    const n = id => Math.max(0,Number(document.getElementById(id).value)||0);
    const age=n('cpf-start-age'), salary=n('cpf-salary'), out=$('#cpf-forecast-output');
    if(age<18||age>=55||salary<=750||n('cpf-ra-extra')>0){out.textContent='This salary projection supports ages 18–54, full CPF rates and salary above $750, without an existing RA. Use CPF’s official planner for other cases.';return;}
    const years=55-age, months=Math.round(years*12), wage=Math.min(8000,salary), contribution=wage*.37;
    let oa=n('cpf-oa'), sa=n('cpf-sa'), unmetHousing=0;
    const growth=n('cpf-target-growth')/100, frs=220400*(1+growth)**years, ers=2*frs;
    const rows=[];
    for(let m=0;m<months;m++) {
      const a=age+m/12, ratios=a<=35?[.6217,.1621]:a<=45?[.5677,.1891]:a<=50?[.5136,.2162]:[.4055,.3108];
      oa=oa*1.025**(1/12)+contribution*ratios[0];
      sa=sa*1.04**(1/12)+contribution*ratios[1];
      const spent=Math.min(oa,n('cpf-housing')); oa-=spent; unmetHousing+=n('cpf-housing')-spent;
    }
    const total=oa+sa, topup=Math.min(n('cpf-topup'),Math.max(0,220400-n('cpf-sa'))), delay=Math.min(years,n('cpf-delay'));
    const early=topup*1.04**years, later=topup*1.04**(years-delay);
    const ratios=age<=35?[.6217,.1621,.2162]:age<=45?[.5677,.1891,.2432]:age<=50?[.5136,.2162,.2702]:[.4055,.3108,.2837];
    const monthlyRate=1.04**(1/12)-1, factor=((1+monthlyRate)**months-1)/monthlyRate;
    const gapLine=(target,label)=>`<article><span>${label} scenario at 55</span><strong>${money(target)}</strong><p>${total>=target?'Projected OA + SA meets this scenario target.':`${money(target-total)} short using projected OA + SA.`}</p><p>Additional saving at assumed 4%: <b>${money(Math.max(0,target-total)/factor)}/month</b>.</p><small>SA alone: ${sa>=target?'meets target':money(target-sa)+' short'}.</small></article>`;
    out.innerHTML=`<p class="forecast-narrative">At ${money(salary)} gross salary, about <b>${money(wage*.20)}</b> employee CPF and <b>${money(wage*.17)}</b> employer CPF enter your accounts each month. That is roughly ${money(contribution*ratios[0])} OA, ${money(contribution*ratios[1])} SA and ${money(contribution*ratios[2])} MA at your current age.</p><div class="forecast-cards"><article><span>Projected OA + SA at 55</span><strong>${money(total)}</strong><p>OA ${money(oa)} + SA ${money(sa)}. MA excluded.</p></article>${gapLine(frs,'FRS')}${gapLine(ers,'ERS comparison')}</div><div class="compounding-story"><h3>What does starting earlier change?</h3><p>The same <b>${money(topup)}</b> cash top-up could add <b>${money(early)}</b> by 55 if made now, versus <b>${money(later)}</b> if made ${delay} years later: an extra <b>${money(early-later)}</b> from time at an assumed 4% yearly. These top-up amounts are additional to the salary-only forecast above. The monthly gap amounts illustrate additional saving at 4%; CPF top-up eligibility may prevent paying all of it into SA.</p><p>With the early top-up, projected OA + SA becomes <b>${money(total+early)}</b>. Remaining scenario gaps: FRS <b>${money(frs-total-early)}</b>; ERS comparison <b>${money(ers-total-early)}</b>.</p>${unmetHousing>0?`<p>OA could not cover ${money(unmetHousing)} of the housing withdrawals entered over the projection. That amount needs another funding source.</p>`:''}</div>`;
  };
  ids.forEach(id=>document.getElementById(id).addEventListener('input',update));
  $('#plan-age').addEventListener('input',()=>{$('#cpf-start-age').value=$('#plan-age').value;update();});
  $('#cpf-start-age').addEventListener('input',()=>{$('#plan-age').value=$('#cpf-start-age').value;$('#plan-age').dispatchEvent(new Event('input'));});
  update();
}

function setupOfflineStatus() {
  const label = $('#offline-label');
  const render = () => { if (label) label.textContent = navigator.onLine ? 'Works offline' : 'Offline mode'; };
  window.addEventListener('online', render);
  window.addEventListener('offline', render);
  render();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { if (label) label.textContent = 'Browser mode'; });
}

setupBudget();
setupPlan();
setupCpfSnapshot();
setupCpfForecast();
setupOfflineStatus();
