const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const money = (value) =>
  `$${Math.round(Math.max(0, value) || 0).toLocaleString("en-SG")}`;
function setupCareBreakdown() {
  const range = (values) =>
    `S$${values[0].toLocaleString("en-SG")}–${values[1].toLocaleString("en-SG")}`;
  $("#care-cost-rows").innerHTML = RetirementModel.careRows
    .map(
      (row) =>
        `<article class="care-cost-row" role="listitem"><h4>${row.name}</h4><div><small>Age 65 · today</small><strong>${range(row.now)}</strong></div><div><small>Age 75 · +10 years</small><strong>${range(row.later)}</strong></div><p>${row.note}</p></article>`,
    )
    .join("");
}
function setupSimplePlan() {
  const fields = {
    age: "person-age",
    salary: "person-salary",
    savings: "known-savings",
    spend: "known-spend",
    oa: "known-oa",
    sa: "known-sa",
    housing: "known-housing",
    retire: "known-retire",
    invest: "known-invest",
  };
  const out = $("#simple-results");
  let selected = "salary";
  const setError = (message) => {
    out.innerHTML = "";
    const p = document.createElement("p");
    p.className = "next-action";
    p.textContent = message;
    out.append(p);
    $("#settings-error").textContent = message;
    $("#plan-status").textContent = message;
  };
  const render = () => {
    const comparisonOpen = out.querySelector(".path-comparison")?.open || false;
    const p = {};
    for (const [key, id] of Object.entries(fields)) {
      const input = $("#" + id);
      if (input.value.trim() === "") {
        if (key === "age" || key === "salary") {
          setError(
            "Enter your age and gross salary to see the CPF comparison.",
          );
          return;
        }
        continue;
      }
      if (!input.validity.valid) {
        setError(
          "Check the allowed range for " + input.labels[0].textContent + ".",
        );
        return;
      }
      p[key] = Number(input.value);
    }
    let r;
    try {
      r = RetirementModel.calculate(p);
    } catch (e) {
      setError(e.message);
      return;
    }
    $("#settings-error").textContent = "";
    $("#baseline-summary").textContent =
      `${money(r.todaySpend)}/month in today’s prices · retire at ${r.retire}`;
    const ers = r.scenarios.find((s) => s.key === "ers"),
      frs = r.scenarios.find((s) => s.key === "frs"),
      s = r.scenarios.find((s) => s.key === selected);
    const unit = r.retiringNow ? " now" : "/mo";
    const year65 = 2026 + 65 - r.age,
      year75 = year65 + 10;
    const pathName = {
      salary: "Salary CPF only",
      frs: "Build up to FRS",
      ers: "Build up to ERS",
    };
    const descriptions = {
      salary:
        "What salary contributions could build, with no extra CPF-target savings.",
      frs: "Add savings to reach the Full Retirement Sum at 55.",
      ers: "Add savings to reach the Enhanced Retirement Sum at 55, subject to eligible transfers or top-ups.",
    };
    const incomeLabel = s.key === "salary" ? "Salary CPF" : s.key.toUpperCase();
    let verdict;
    if (s.gap65 > 0.005)
      verdict = `${s.key === "salary" ? "Salary CPF alone" : s.key.toUpperCase()} leaves a gap in this model.`;
    else if (s.gap75 > 0.005)
      verdict = `${incomeLabel} covers age 65, but falls behind by 75.`;
    else if (s.firstShortfallAge != null)
      verdict = `A spending gap appears around age ${Math.floor(s.firstShortfallAge)}.`;
    else verdict = `${incomeLabel} covers modelled spending from 65 to 90.`;
    const timeline = (age, year, spend, gap) =>
      `<article><span>AGE ${age} · ${year} DOLLARS</span><div class="coverage-number"><b>${money(spend)}</b><small>spending / month</small></div><div class="income-coverage" role="img" aria-label="CPF covers ${Math.round(spend ? Math.min(100, (s.payout / spend) * 100) : 100)} percent of spending"><i style="width:${spend ? Math.min(100, (s.payout / spend) * 100) : 100}%"></i></div><p>${incomeLabel} income <b>${money(s.payout)}/mo</b></p><strong>${gap > 0.005 ? `${money(gap)}/mo to fund outside CPF` : "No spending gap at this age"}</strong></article>`;
    const signedMoney = (value) =>
      value < 0 ? `−${money(-value)}` : money(value);
    const remaining = r.afterCpf - s.totalFunding;
    const housingNote =
      p.housing == null
        ? "All future OA is assumed spent on housing."
        : `OA housing use: ${money(p.housing)}/month.`;
    const balanceNote =
      p.oa == null && p.sa == null
        ? "Current OA and SA balances are unknown and excluded."
        : `Starting OA ${money(p.oa || 0)} + SA ${money(p.sa || 0)}.`;
    $("#plan-status").textContent =
      `${verdict} Based on age ${r.age}, gross salary ${money(r.salary)} a month. ${pathName[s.key]}: ${money(s.privateSaving)} ${r.retiringNow ? "capital gap today" : "a month invested for retirement"}, plus ${money(s.cpfFunding)} ${r.retiringNow ? "capital reserved today" : "a month saved towards the CPF target"}.`;
    out.innerHTML = `<section class="salary-context card-surface" aria-labelledby="salary-context-title"><div class="context-heading"><div><p class="form-kicker">1 · WHAT GOES INTO CPF AUTOMATICALLY</p><h3 id="salary-context-title">Age ${r.age} · ${money(r.salary)} gross salary / month</h3></div><a class="text-link dark-link" href="#quick-form">Edit age or salary ↑</a></div><div class="salary-flow"><div><span>Deducted from salary · 20%</span><strong>${money(r.employeeCpf)}</strong></div><div><span>Employer adds · 17%</span><strong>${money(r.employerCpf)}</strong></div><div><span>Total to CPF / month</span><strong>${money(r.contribution)}</strong></div><div><span>Salary after employee CPF</span><strong>${money(r.afterCpf)}</strong></div></div><p class="account-split">Current monthly split: <b>OA ${money(r.currentOA)}</b> · <b>SA ${money(r.currentSA)}</b> · <b>MA ${money(r.currentMA)}</b>. Rounded; allocations change with age. MA is reserved for healthcare.</p><div class="projection-context"><p><b>Salary CPF projected at 55: ${money(r.cpf)}</b> · ${r.cpf >= r.frs ? "FRS reached in this illustration" : `${money(r.frs - r.cpf)} short of FRS`}.</p><p>Age-55 targets (${2026 + 55 - r.age} dollars): FRS ${money(r.frs)} · ERS ${money(r.ers)}.</p><p>${balanceNote} ${housingNote} <button type="button" class="text-button" commandfor="plan-settings" command="show-modal" data-panel="cpf">Add balances / change housing ↗</button></p></div><details class="context-details"><summary>How this salary projection works</summary><p>Full citizen/third-year PR rates; CPF wages capped at $8,000/month. Salary is held constant. Contributions are modelled only until the earlier of retirement or 55; contributions after 55 are excluded. OA grows at 2.5% and SA at 4%, before the assumed housing deduction. No bonus, extra interest or MA overflow is counted. The paid-up flat describes retirement; current OA housing use is a separate setting.</p><a class="text-link dark-link" href="https://www.cpf.gov.sg/employer/employer-obligations/how-much-cpf-contributions-to-pay" target="_blank" rel="noreferrer">CPF contribution rules ↗</a></details></section>
    <div class="verdict-card"><p class="form-kicker">2 · DOES ${incomeLabel.toUpperCase()} COVER SOLO + HELPER?</p><h3>${verdict}</h3><p>Your <b>${money(r.todaySpend)}/month budget today</b> becomes <b>${money(r.spend65)}/month at 65 in ${year65}</b>, after ${65 - r.age} years of modelled inflation. Both spending and income below are <b>future-dollar illustrations</b>.</p><div class="gap-timeline">${timeline(65, year65, r.spend65, s.gap65)}${timeline(75, year75, r.spend75, s.gap75)}</div><details class="verdict-calculation"><summary>Why are these amounts different from today’s budget?</summary><p>At 65: (${money(r.todaySpend)} − ${money(Math.min(300, r.todaySpend))} fixed helper levy) × 1.03<sup>${65 - r.age}</sup> + ${money(Math.min(300, r.todaySpend))} = ${money(r.spend65)}/month. After 65, the model also increases the care provision with age.</p><p>CPF income is a scenario too. FRS grows by an assumed 3.5% a year to your age 55; ERS is twice that target. Published 2026 male Standard Plan payouts are scaled using that target-growth factor. The result is held level from 65; it is not a CPF Board quote for ${year65}.</p></details><p class="verdict-note">Viewing: <b>${pathName[s.key]}</b>. ${s.key === "salary" ? "This uses projected salary CPF up to FRS. Compare the fully funded FRS or ERS scenarios below." : "This assumes the CPF target is fully funded. The extra savings required are shown below."} Actual balances, future rules and pricing can change the answer.</p></div>
    <details class="path-comparison" ${comparisonOpen ? "open" : ""}><summary>What if I save extra to reach FRS or ERS?</summary><div class="comparison-heading"><h3>Same salary. Three ways to fund retirement.</h3><p>All three use age ${r.age}, gross salary ${money(r.salary)}/month and the same budget. Your automatic ${money(r.contribution)}/month CPF contribution is already included. Amounts labelled extra come from your ${money(r.afterCpf)} salary after employee CPF.</p></div>
    <div class="scenario-grid">${r.scenarios.map((path) => `<article class="scenario-card${path.key === selected ? " is-selected" : ""}"><span class="scenario-title">${pathName[path.key]}</span><p>${descriptions[path.key]}</p><strong>${money(path.payout)}<small>/month at 65 · ${year65} dollars</small></strong><dl><div><dt>CPF amount at 55</dt><dd>${money(path.balance)}</dd></div><div><dt>Spending gap at 65</dt><dd>${money(path.gap65)}/mo</dd></div><div><dt>Extra saved towards CPF · ${r.retiringNow ? "today" : `to age ${Math.min(55, r.retire)}`}</dt><dd>${money(path.cpfFunding)}${unit}</dd></div><div class="outside-goal"><dt>Extra invested · ${r.retiringNow ? "today" : `to age ${r.retire}`}</dt><dd>${money(path.privateSaving)}${unit}</dd></div></dl><button type="button" class="scenario-select" data-path="${path.key}" aria-pressed="${path.key === selected}">${path.key === selected ? "Viewing this path" : "Explore this path"} →</button></article>`).join("")}</div></details>
    <section class="selected-funding card-surface" id="funding-steps" aria-labelledby="selected-path-title"><div class="funding-heading"><div><p class="form-kicker">3 · WHAT TO SAVE FROM YOUR SALARY</p><h3 id="selected-path-title">${pathName[s.key]}: your extra savings plan</h3></div><button type="button" class="text-button" commandfor="plan-settings" command="show-modal" data-panel="invest">Adjust my investments ↗</button></div>
      <div class="funding-pots"><article><span>Save extra towards the CPF target</span><strong>${money(s.cpfFunding)}<small>${r.retiringNow ? "capital needed now" : `a month until age ${Math.min(55, r.retire)}`}</small></strong><p>${s.cpfGap > 0.005 ? `Target at 55: ${money(s.balance)} − salary CPF ${money(r.cpf)} = ${money(s.cpfGap)} more to build. This monthly saving assumes 4% growth; it is additional to payroll CPF.` : "No extra CPF-target saving is assumed for this path. Your automatic salary contributions fund its modelled income."} ${s.cpfGap > 0.005 ? `This is a savings provision, not a required monthly CPF deduction.${s.key === "ers" ? " ERS funding may need to stay outside CPF until an eligible transfer or top-up from 55." : ""}` : ""}</p></article><article><span>Invest for the remaining spending gap</span><strong>${money(s.privateSaving)}<small>${r.retiringNow ? "capital shortfall now" : `a month until age ${r.retire}`}</small></strong><p>Targets a ${money(s.privateTarget)} portfolio at ${r.retire}, to fund the spending left after this path’s CPF income through age 90.</p></article></div>
      <div class="funding-total"><span>${r.retiringNow ? "Additional capital required today" : "Total extra to save from salary now"}</span><strong>${money(s.totalFunding)}${unit}</strong><small>${r.retiringNow ? "Compare these capital needs with available assets." : `${money(s.cpfFunding)} towards CPF + ${money(s.privateSaving)} invested for retirement = ${money(s.totalFunding)}/month extra. This does not include the ${money(r.employeeCpf)} already deducted as employee CPF.`}</small></div>
      ${r.retiringNow ? "" : `<div class="take-home-check"><span>What that leaves for today’s bills and tax</span><p>${money(r.afterCpf)} salary after CPF − ${money(s.totalFunding)} extra savings = <b>${signedMoney(remaining)}/month</b></p><small>${remaining < 0 ? "This plan exceeds the salary available. Review the target, balances, spending or retirement age." : "This is the amount left before your current living costs, income tax and emergency savings."}</small></div><p class="funding-phase">${r.retire > 55 ? `From age 55 to ${r.retire}, the CPF-target saving ends; this model keeps the separate ${money(s.privateSaving)}/month investment going. It does not automatically reinvest the freed ${money(s.cpfFunding)}/month.` : `Savings stop at retirement (${r.retire}); any CPF-target reserve is assumed to grow until 55.`}</p>`}
      <p class="funding-caution">${r.scenarios[0].firstShortfallAge === null ? "Your salary path already covers modelled spending from 65 to 90. A higher CPF target is optional; compare the extra lock-in and liquidity before funding it." : s.totalFunding > r.afterCpf && !r.retiringNow ? "This exceeds salary after employee CPF. Add actual balances, review the budget or retirement date, and check affordability before using these contribution amounts." : !r.refined ? "This starts from salary alone: existing CPF is excluded and future OA is assumed used for housing. Add known balances in Settings to refine any apparent target shortfall." : "Your entered CPF and housing details refine the salary projection. Check the two funding pots against your emergency reserve and current bills."}</p>
      <div class="investment-impact"><span class="form-kicker">WHAT OUTSIDE INVESTING ADDS</span><h4>${r.retiringNow ? "Compare your portfolio with the gap today" : `Investing ${money(s.chosenInvest)}/month could build ${money(s.illustratedPortfolio)} by ${r.retire}.`}</h4><p>${r.retiringNow ? `Your entered portfolio is ${money(s.illustratedPortfolio)} against a ${money(s.privateTarget)} target.` : `This includes ${money(Number(p.savings || 0))} already invested and assumes 4% net annual growth. The CPF-target reserve is excluded from this portfolio.`}</p><p><b>${s.remainingPortfolioGap > 0.5 ? `${money(s.remainingPortfolioGap)} portfolio shortfall remains${!r.retiringNow && p.invest != null ? `; roughly ${money(s.contributionShortfall)}/month more than your entered amount is needed` : ""}.` : "That reaches this portfolio target in the steady-return illustration."}</b></p><small>Investment withdrawals fund a finite period, not guaranteed lifelong income. Market falls, tax, fees and living beyond 90 can change the result.</small></div>
      ${selected === "ers" ? `<details class="result-details"><summary>What choosing ERS changes compared with FRS</summary><p class="result-detail-copy">ERS lowers the outside-investment target by ${money(Math.max(0, frs.privateSaving - ers.privateSaving))}${unit}, while requiring ${money(Math.max(0, ers.cpfFunding - frs.cpfFunding))}${unit} more earmarked for CPF. More CPF income needs funding first; compare liquidity and the combined commitment, not the payout alone.</p></details>` : ""}
      <details class="result-details"><summary>How to use this funding path</summary><ol class="personal-steps"><li>Keep emergency cash and housing money accessible before funding long-term targets.</li><li>Check the ${money(s.cpfGap)} CPF target gap against your dashboard. The reserve is a funding equivalent at an assumed 4%, not an instruction to top up that amount every month. ERS may require holding money outside CPF until an eligible RA top-up or transfer after 55.</li><li>Fund the separate outside-CPF investment pot. If using SRS, count those investments once and allow for access dates and withdrawal tax.</li><li>Review annually. Match the next spending years with cash and bond maturities as retirement gets closer.</li></ol><p class="result-footnote">An example ${money(r.topup)} eligible top-up now could grow to ${money(r.early)} by 55, versus ${money(r.later)} if delayed ${r.delay} years, at an assumed 4%. Actual eligibility and liquidity come first.</p>${r.housingShortfall ? `<p class="result-footnote">Your housing entry exceeds available OA by ${money(r.housingShortfall)} across the projection; that needs another funding source.</p>` : ""}<a class="text-link dark-link" href="https://www.cpf.gov.sg/member/tools-and-services/calculators" target="_blank" rel="noreferrer">Check personalised CPF payouts ↗</a></details>
    </section>
    <p class="comparison-footnote">Income references use CPF Board’s male Standard Plan examples starting at 65, scaled to a future retirement-sum scenario. CPF and investment results are illustrations, not personalised quotes or promised returns. CPF LIFE continues for life; the portfolio models spending only to 90. These are funding comparisons, not return rankings. ${r.retire < 65 ? `Your portfolio target includes the bridge from age ${r.retire} to 65.` : ""}</p>`;
  };
  Object.values(fields).forEach((id) =>
    $("#" + id).addEventListener("input", render),
  );
  out.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-path]");
    if (!button) return;
    selected = button.dataset.path;
    render();
    $(`button[data-path="${selected}"]`).focus({ preventScroll: true });
  });
  $("#reset-settings").addEventListener("click", () => {
    Object.values(fields)
      .filter((id) => id.startsWith("known-"))
      .forEach((id) => ($("#" + id).value = ""));
    render();
  });
  render();
}
function setupSettings() {
  const dialog = $("#plan-settings"),
    tabs = $$('.settings-tabs [role="tab"]');
  let lastInvoker = null;
  const selectSettingsTab = (name) => {
    tabs.forEach((tab) => {
      const active = tab.id === "tab-" + name;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      $("#" + tab.getAttribute("aria-controls")).hidden = !active;
    });
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () =>
      selectSettingsTab(tab.id.replace("tab-", "")),
    );
    tab.addEventListener("keydown", (event) => {
      let i = index;
      if (event.key === "ArrowRight") i = (i + 1) % tabs.length;
      else if (event.key === "ArrowLeft")
        i = (i + tabs.length - 1) % tabs.length;
      else if (event.key === "Home") i = 0;
      else if (event.key === "End") i = tabs.length - 1;
      else return;
      event.preventDefault();
      selectSettingsTab(tabs[i].id.replace("tab-", ""));
      tabs[i].focus();
    });
  });
  document.addEventListener("click", (event) => {
    const button = event.target.closest('button[commandfor="plan-settings"]');
    if (!button) return;
    const command = button.getAttribute("command");
    if (command === "show-modal") {
      lastInvoker = button;
      if (button.dataset.panel) selectSettingsTab(button.dataset.panel);
      button.setAttribute("aria-expanded", "true");
    }
    if (!("commandForElement" in HTMLButtonElement.prototype)) {
      event.preventDefault();
      if (command === "show-modal") dialog.showModal();
      else dialog.close();
    }
  });
  dialog.addEventListener("close", () => {
    $$('button[command="show-modal"]').forEach((button) =>
      button.setAttribute("aria-expanded", "false"),
    );
    if (lastInvoker?.isConnected) lastInvoker.focus({ preventScroll: true });
    else $(".settings-trigger").focus({ preventScroll: true });
  });
  dialog.addEventListener("click", (event) => {
    const r = dialog.getBoundingClientRect();
    if (
      event.target === dialog &&
      (event.clientX < r.left ||
        event.clientX > r.right ||
        event.clientY < r.top ||
        event.clientY > r.bottom)
    )
      dialog.close();
  });
  $$('button[command="show-modal"]').forEach((button) => {
    button.setAttribute("aria-haspopup", "dialog");
    button.setAttribute("aria-controls", "plan-settings");
  });
}
function setupDeepLinks() {
  const revealHash = (hash) => {
    const target = document.getElementById(hash.slice(1));
    if (!target) return;
    const details = target.matches("details")
      ? target
      : target.querySelector(".module-disclosure");
    if (details) details.open = true;
    let ancestor = target.closest("details");
    while (ancestor) {
      ancestor.open = true;
      ancestor = ancestor.parentElement.closest("details");
    }
  };
  document.addEventListener("click", (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (link) revealHash(link.getAttribute("href"));
  });
  window.addEventListener("hashchange", () => revealHash(location.hash));
  revealHash(location.hash);
}
function setupOfflineStatus() {
  const label = $("#offline-label");
  let prepared = false;
  const update = () => {
    label.textContent = !navigator.onLine
      ? "Offline mode"
      : prepared
        ? "Works offline"
        : "Preparing offline";
  };
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  update();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("sw.js", { updateViaCache: "none" })
      .then(() => navigator.serviceWorker.ready)
      .then(() => {
        prepared = true;
        update();
      })
      .catch(() => {
        label.textContent = "Browser mode";
      });
  } else label.textContent = "Browser mode";
}
setupCareBreakdown();
setupSimplePlan();
setupSettings();
setupDeepLinks();
setupOfflineStatus();
$$("form").forEach((form) =>
  form.addEventListener("submit", (event) => event.preventDefault()),
);
