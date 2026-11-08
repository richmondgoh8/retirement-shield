const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const money = (value) => `$${Math.round(value).toLocaleString('en-SG')}`;

function copyText(text, statusElement, successMessage) {
  const announce = (message) => {
    if (statusElement) statusElement.textContent = message;
  };

  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(() => announce(successMessage)).catch(() => announce('Select and copy the text manually.'));
    return;
  }

  const temporary = document.createElement('textarea');
  temporary.value = text;
  temporary.setAttribute('readonly', '');
  temporary.style.position = 'fixed';
  temporary.style.opacity = '0';
  document.body.append(temporary);
  temporary.select();
  try {
    document.execCommand('copy');
    announce(successMessage);
  } catch {
    announce('Select and copy the text manually.');
  }
  temporary.remove();
}

function setupComparison() {
  const form = $('#compare-form');
  if (!form) return;

  const paidInput = $('#total-paid');
  const exitInput = $('#exit-value');
  const payoutInput = $('#monthly-payout');
  const yearsInput = $('#payout-years');
  const typeInput = $('#illustration-type');
  const totalPremiumInput = $('#total-premiums');
  const premiumYearsInput = $('#premium-years');
  const payoutDelayInput = $('#payout-delay');
  const cpfLifeInput = $('#cpflife-monthly');
  const finalBenefitInput = $('#final-benefit');
  const bar = $('#money-bar-fill');
  const headline = $('#result-headline');
  const marker = $('#result-marker');
  const exitLabel = $('#exit-label');
  const paidLabel = $('#paid-label');
  const recoveryLabel = $('#recovery-label');
  const incomeTotalLabel = $('#income-total-label');
  const question = $('#result-question');
  const irrLabel = $('#policy-irr');
  const irrTypeLabel = $('#roi-type-label');
  const payoutDifference = $('#payout-difference');
  const payoutDifferenceNote = $('#payout-difference-note');

  const annualizedCashFlowReturn = (totalPremiums, premiumYears, monthlyPayout, payoutYears, delayYears, finalBenefit) => {
    const premiumMonths = Math.max(1, Math.round(premiumYears * 12));
    const payoutMonths = Math.max(1, Math.round(payoutYears * 12));
    const delayMonths = Math.max(0, Math.round(delayYears * 12));
    const monthlyPremium = totalPremiums / premiumMonths;
    const npv = (rate) => {
      let value = 0;
      const lastMonth = Math.max(premiumMonths, delayMonths + payoutMonths);
      for (let month = 1; month <= lastMonth; month += 1) {
        const cashFlow = (month <= premiumMonths ? -monthlyPremium : 0)
          + (month > delayMonths && month <= delayMonths + payoutMonths ? monthlyPayout : 0)
          + (month === delayMonths + payoutMonths ? finalBenefit : 0);
        value += cashFlow / ((1 + rate) ** month);
      }
      return value;
    };
    if (totalPremiums <= 0 || monthlyPayout <= 0 || npv(-0.99) * npv(0.5) > 0) return null;
    let low = -0.99;
    let high = 0.5;
    for (let iteration = 0; iteration < 100; iteration += 1) {
      const mid = (low + high) / 2;
      if (npv(mid) > 0) low = mid;
      else high = mid;
    }
    return ((1 + (low + high) / 2) ** 12 - 1) * 100;
  };

  const update = () => {
    const paid = Math.max(0, Number(paidInput.value) || 0);
    const exit = Math.max(0, Number(exitInput.value) || 0);
    const monthly = Math.max(0, Number(payoutInput.value) || 0);
    const years = Math.max(1, Number(yearsInput.value) || 1);
    const gap = Math.max(0, paid - exit);
    const recovery = paid > 0 ? Math.min(100, (exit / paid) * 100) : 0;
    const payoutTotal = monthly * years * 12;
    const totalPremiums = Math.max(0, Number(totalPremiumInput.value) || 0);
    const premiumYears = Math.max(1, Number(premiumYearsInput.value) || 1);
    const delayYears = Math.max(0, Number(payoutDelayInput.value) || 0);
    const cpfLife = Math.max(0, Number(cpfLifeInput.value) || 0);
    const finalBenefit = Math.max(0, Number(finalBenefitInput.value) || 0);
    const annualReturn = annualizedCashFlowReturn(totalPremiums, premiumYears, monthly, years, delayYears, finalBenefit);
    const figureType = typeInput.value;
    const access = $('input[name="access"]:checked', form)?.value;

    exitLabel.textContent = money(exit);
    paidLabel.textContent = money(paid);
    recoveryLabel.textContent = `${Math.round(recovery)}%`;
    incomeTotalLabel.textContent = money(payoutTotal);
    irrTypeLabel.textContent = `${figureType === 'guaranteed' ? 'Guaranteed' : 'Illustrated'} cash-flow return`;
    irrLabel.textContent = annualReturn === null ? 'Not available' : `${annualReturn.toFixed(2)}%`;
    const payoutGap = monthly - cpfLife;
    payoutDifference.textContent = `${payoutGap > 0 ? '+' : payoutGap < 0 ? '−' : ''}${money(Math.abs(payoutGap))}/mo`;
    payoutDifferenceNote.textContent = `${money(monthly)}/mo policy figure vs ${money(cpfLife)}/mo CPF LIFE estimate; policy lasts ${years} years`;
    bar.style.width = `${recovery}%`;

    headline.innerHTML = gap > 0
      ? `You would give up <strong>${money(gap)}</strong> of access today.`
      : `The figures show <strong>no exit gap</strong> today — still verify the terms.`;

    if (access === 'no') {
      marker.textContent = 'HIGH FRICTION';
      question.textContent = '“What exactly would I receive if I need this money before the minimum commitment period ends?”';
    } else if (access === 'unknown') {
      marker.textContent = 'ASK FIRST';
      question.textContent = '“Please show the surrender value and every partial-withdrawal charge, year by year.”';
    } else {
      marker.textContent = 'PAUSE';
      question.textContent = '“Please show the surrender value at years 1, 3, 5, 10 and after the minimum commitment period.”';
    }
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    update();
    $('#result-marker')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  $$('input, select', form).forEach((input) => input.addEventListener('input', update));
  $$('select', form).forEach((input) => input.addEventListener('change', update));
  update();

  $('.copy-question')?.addEventListener('click', () => {
    copyText(question.textContent, $('.copy-question'), 'Question copied.');
  });
}

function setupDialogs() {
  let lastTrigger = null;
  $$('.learn-more').forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const dialog = document.getElementById(trigger.dataset.dialog);
      if (!dialog) return;
      lastTrigger = trigger;
      dialog.showModal();
    });
  });

  $$('[data-close-dialog]').forEach((button) => {
    button.addEventListener('click', () => button.closest('dialog')?.close());
  });

  $$('dialog').forEach((dialog) => {
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', () => {
      lastTrigger?.focus();
      lastTrigger = null;
    });
  });
}

function setupChecklist() {
  const items = $$('.check-item input');
  const storageKey = 'retirement-shield-checklist';
  const progressText = $('#progress-text');
  const progressPercent = $('#progress-percent');
  const progressFill = $('#progress-fill');
  const savedNote = $('#saved-note');

  let saved = [];
  try {
    saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
  } catch {
    saved = [];
  }

  items.forEach((item, index) => { item.checked = Boolean(saved[index]); });

  const render = () => {
    const checked = items.filter((item) => item.checked).length;
    const percent = items.length ? Math.round((checked / items.length) * 100) : 0;
    progressText.textContent = `${checked} of ${items.length} checked`;
    progressPercent.textContent = `${percent}%`;
    progressFill.style.width = `${percent}%`;
    try { localStorage.setItem(storageKey, JSON.stringify(items.map((item) => item.checked))); } catch { /* storage is optional */ }
    if (savedNote) savedNote.textContent = checked === items.length ? 'Ready when you are.' : 'Saved on this device';
  };

  items.forEach((item) => item.addEventListener('change', render));
  $('#reset-checklist')?.addEventListener('click', () => {
    items.forEach((item) => { item.checked = false; });
    render();
  });
  render();
}

function setupCopyScript() {
  const button = $('#copy-script');
  const script = $('#script-text');
  const status = $('#copy-status');
  button?.addEventListener('click', () => copyText(script.textContent, status, 'Script copied.')); 
}

function labelResponsiveTable() {
  $$('table').forEach((table) => {
    const labels = $$('thead th', table).map((header) => header.textContent.trim());
    $$('tbody tr', table).forEach((row) => {
      $$('td', row).forEach((cell, index) => { cell.dataset.label = labels[index + 1] || ''; });
    });
  });
}

function setupOfflineStatus() {
  const label = $('#offline-label');
  const render = () => {
    if (!label) return;
    label.textContent = navigator.onLine ? 'Works offline' : 'Offline mode';
  };
  window.addEventListener('online', render);
  window.addEventListener('offline', render);
  render();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {
      if (label) label.textContent = 'Browser mode';
    });
  }
}

const ageGuides = {
  '30s': [
    ['Map', 'Find your CPF balances and note which accounts are for housing, healthcare and retirement.'],
    ['Protect', 'Build emergency cash before locking extra money into a long-term product.'],
    ['Grow', 'Learn the difference between CPF interest, investment returns and insurance payouts.']
  ],
  '40s': [
    ['Map', 'Estimate future housing, education and caregiving costs before making irreversible top-ups.'],
    ['Compare', 'Review protection needs separately from retirement investing.'],
    ['Grow', 'Check your CPF forecast and set a savings amount you can sustain through job changes.']
  ],
  '50s': [
    ['Before 55', 'Check the FRS for the year you turn 55 and understand how your RA will be formed.'],
    ['Access', 'Write down the cash you may need for housing, health and family before topping up.'],
    ['Compare', 'Use CPF’s payout estimator with your own balances and compare payout start ages.']
  ],
  '60s': [
    ['Choose', 'Compare CPF LIFE Standard and Escalating payouts using CPF’s personalised service.'],
    ['Connect', 'Confirm your bank details and understand when the first payout will arrive.'],
    ['Plan', 'Set a simple monthly spending plan and keep separate cash for large one-off costs.']
  ],
  '70s': [
    ['Simplify', 'List accounts, policies and providers on one page so they are easier to review.'],
    ['Verify', 'Check your contact and bank details using official CPF and provider channels.'],
    ['Share', 'Tell a trusted person where your records are. Never share passwords or OTPs.']
  ]
};

function setupCpfPlanner() {
  const form = $('#cpf-growth-form');
  if (form) {
    const current = $('#cpf-current');
    const monthly = $('#cpf-monthly');
    const age = $('#cpf-age');
    const rate = $('#cpf-rate');
    const result = $('#cpf-projection');
    const note = $('#cpf-projection-note');

    const update = () => {
      const balance = Math.max(0, Number(current.value) || 0);
      const contribution = Math.max(0, Number(monthly.value) || 0);
      const currentAge = Math.min(64, Math.max(18, Number(age.value) || 35));
      const annualRate = Math.min(10, Math.max(0, Number(rate.value) || 0)) / 100;
      const months = (65 - currentAge) * 12;
      const monthlyRate = annualRate / 12;
      const projected = monthlyRate === 0
        ? balance + contribution * months
        : balance * (1 + monthlyRate) ** months + contribution * (((1 + monthlyRate) ** months - 1) / monthlyRate);
      result.textContent = money(projected);
      note.textContent = `${months} monthly periods at ${(annualRate * 100).toFixed(1)}% assumed annual growth. This is not a CPF payout estimate.`;
    };
    $$('input', form).forEach((input) => input.addEventListener('input', update));
    form.addEventListener('submit', (event) => event.preventDefault());
    update();
  }

  const ageContent = $('#age-content');
  const tabs = $$('.age-tab');
  if (!ageContent || !tabs.length) return;
  const key = 'retirement-shield-age-quests-v1';
  let checked = {};
  try { checked = JSON.parse(localStorage.getItem(key) || '{}'); } catch { checked = {}; }

  const render = (tier) => {
    const tasks = ageGuides[tier] || ageGuides['30s'];
    ageContent.innerHTML = tasks.map(([tag, body], index) => {
      const taskId = `${tier}-${index}`;
      const isChecked = Boolean(checked[taskId]);
      return `<label class="age-task${isChecked ? ' is-done' : ''}"><span>${tag} · 10 points</span><span class="age-task-line"><input type="checkbox" data-quest="${taskId}" ${isChecked ? 'checked' : ''}><span class="quest-check" aria-hidden="true">✓</span><p>${body}</p></span></label>`;
    }).join('') + `<p class="quest-score">${tasks.filter((_, index) => checked[`${tier}-${index}`]).length * 10} / 30 points · progress saves on this device</p>`;

    $$('input[data-quest]', ageContent).forEach((input) => input.addEventListener('change', () => {
      checked[input.dataset.quest] = input.checked;
      try { localStorage.setItem(key, JSON.stringify(checked)); } catch { /* local saving is optional */ }
      render(tier);
    }));
  };

  tabs.forEach((tab) => tab.addEventListener('click', () => {
    tabs.forEach((item) => {
      const active = item === tab;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    render(tab.dataset.age);
  }));
  render('30s');
}

setupComparison();
setupDialogs();
setupChecklist();
setupCopyScript();
labelResponsiveTable();
setupOfflineStatus();
setupCpfPlanner();
