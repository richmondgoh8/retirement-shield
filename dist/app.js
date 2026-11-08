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
  const bar = $('#money-bar-fill');
  const headline = $('#result-headline');
  const marker = $('#result-marker');
  const exitLabel = $('#exit-label');
  const paidLabel = $('#paid-label');
  const recoveryLabel = $('#recovery-label');
  const incomeTotalLabel = $('#income-total-label');
  const question = $('#result-question');

  const update = () => {
    const paid = Math.max(0, Number(paidInput.value) || 0);
    const exit = Math.max(0, Number(exitInput.value) || 0);
    const monthly = Math.max(0, Number(payoutInput.value) || 0);
    const years = Math.max(1, Number(yearsInput.value) || 1);
    const gap = Math.max(0, paid - exit);
    const recovery = paid > 0 ? Math.min(100, (exit / paid) * 100) : 0;
    const payoutTotal = monthly * years * 12;
    const access = $('input[name="access"]:checked', form)?.value;

    exitLabel.textContent = money(exit);
    paidLabel.textContent = money(paid);
    recoveryLabel.textContent = `${Math.round(recovery)}%`;
    incomeTotalLabel.textContent = money(payoutTotal);
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

  $$('input', form).forEach((input) => input.addEventListener('input', update));
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

setupComparison();
setupDialogs();
setupChecklist();
setupCopyScript();
labelResponsiveTable();
setupOfflineStatus();
