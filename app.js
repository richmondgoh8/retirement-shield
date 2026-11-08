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
    const nominalCapitalTarget = capital * (1 + inflation) ** years;
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
  const names = ['Ordinary Account', 'Special / Retirement Account', 'MediSave Account', 'Retirement Account (separate)'];
  const render = () => {
    const values = fields.map((field) => Math.max(0, Number(field.value) || 0));
    total.textContent = money(values.reduce((a, b) => a + b, 0));
    breakdown.innerHTML = values.map((value, index) => `<div class="cpf-bar-row"><span>${names[index]}</span><strong>${money(value)}</strong><i><b style="width:${values.reduce((a,b)=>a+b,0) ? value / values.reduce((a,b)=>a+b,0) * 100 : 0}%"></b></i></div>`).join('');
  };
  fields.forEach((field) => field.addEventListener('input', render));
  render();
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
setupOfflineStatus();
