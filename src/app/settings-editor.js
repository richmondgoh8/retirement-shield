import {
  $,
  $$,
  money,
  svgWrap,
  html,
  raw,
  formatMoneyInput,
} from "./format.js";
import { attachDatePicker, syncDatePickers } from "./date-picker.js";

function buildSettingsSections() {
  const sections = [
    [
      "profile",
      "Profile & income",
      [
        ["birth", "Date of birth", [["person-dob", "date"]]],
        ["retire", "Retirement age", [["known-retire"]]],
        ["salary", "Gross monthly salary", [["person-salary", "monthly"]]],
        ["bonus", "Annual bonus", [["known-annual-bonus", "yearly"]]],
      ],
    ],
    [
      "cpf",
      "CPF",
      [
        [
          "cpf",
          "CPF balances and deductions",
          [
            ["known-oa", "money", "OA"],
            ["known-sa", "money", "SA"],
            ["known-ma", "money", "MA"],
            ["known-sa-invested", "money", "CPFIS-SA"],
            ["known-ma-spend", "monthly", "MediSave deductions"],
          ],
          { className: "settings-cpf-group" },
        ],
      ],
    ],
    [
      "housing",
      "Housing",
      [
        [
          "housing",
          "Housing arrangement",
          [["known-housing-mode", "option"]],
          {
            extra:
              '<p class="housing-calc-preview" id="known-housing-preview" aria-live="polite"></p>',
          },
        ],
        [
          "loan",
          "Loan details",
          [
            ["known-housing-balance", "money", "Loan left"],
            ["known-housing-years", "text", "Years left"],
            ["known-housing-rate", "text", "Interest (% p.a.)"],
            ["known-housing-parties", "option", "Split across"],
          ],
          { modes: "hdb bank" },
        ],
        [
          "manual",
          "Monthly housing from OA",
          [["known-housing", "monthly"]],
          { modes: "custom" },
        ],
      ],
    ],
    [
      "invest",
      "Investments",
      [
        [
          "holdings",
          "Investment balances",
          [
            ["known-equities", "money", "Global equities"],
            ["known-sg-dividends", "money", "SG dividends"],
          ],
        ],
        [
          "cash",
          "Cash & SSB",
          [["known-ssb-cash", "money"]],
          {
            derivedValue: true,
            extra: `<p id="settings-cash-accounts-note" class="settings-itemized-note" hidden><span></span></p>
          <button type="button" class="text-button" id="open-cash-breakdown-settings" data-go-tab="cash-accounts" data-open-page-cash-accounts>Edit accounts →</button>`,
          },
        ],
      ],
    ],
    [
      "srs-balance",
      "SRS holdings",
      [
        ["srs-balance", "SRS balance today", [["known-srs", "money"]]],
        ["srs-invest", "Funds invested in", [["known-srs-invested", "option"]]],
      ],
    ],
    [
      "srs",
      "SRS",
      [
        ["srs-annual", "Planned annual SRS", [["known-srs-annual", "yearly"]]],
        ["srs-age", "Withdrawal age", [["known-srs-age", "option"]]],
      ],
    ],
    [
      "tax",
      "Tax reliefs",
      [
        [
          "reliefs",
          "Existing IRAS reliefs",
          [["known-existing-reliefs", "yearly"]],
        ],
        [
          "top-up",
          "Spouse or family CPF top-up",
          [["known-family-rstu", "yearly"]],
        ],
      ],
    ],
  ];

  const pencil = svgWrap(
    '<path d="m13.5 6.5 4 4M4 20l4.5-1 11-11a2.8 2.8 0 0 0-4-4l-11 11L4 20Z"/>',
    15,
  );
  const buildReadout = ([id, format = "text", caption, display = id]) => {
    const value = html`<span
      data-plan-value="${display}"
      data-value-format="${format}"
    ></span>`;
    if (caption)
      return html`<span
        class="settings-value-pair${id === "known-ma-spend" ? " settings-value-monthly" : ""}"
        ><span class="settings-value-caption">${caption}</span
        >${raw(value)}</span
      >`;
    if (id === "person-dob") {
      return `${value}<span class="dob-age-pill" id="person-dob-age-badge" aria-live="polite"></span>`;
    }
    return value;
  };

  return sections
    .map(
      ([category, heading, rows]) =>
        html`<section
          class="card-surface settings-card settings-value-card settings-${category}-card"
          data-settings-scope="${["profile", "housing"].includes(category) ? "profile" : ["cpf", "invest", "srs-balance"].includes(category) ? "balances" : "tax"}"
          aria-labelledby="settings-${category}-heading"
        >
          <div class="settings-card-heading">
            <h2 id="settings-${category}-heading">${heading}</h2>
            ${
              category === "cpf"
                ? raw(
                    html`<button
                      type="button"
                      class="button button-small settings-cpf-edit"
                      data-settings-cpf-edit
                      aria-label="Edit CPF"
                    >
                      ${raw(pencil)}
                    </button>`,
                  )
                : ""
            }
          </div>
          ${rows.map(
            ([
              key,
              label,
              fields,
              { modes, derivedValue, extra, className } = {},
            ]) =>
              raw(
                html`<div
                  class="settings-value-row${className ? ` ${className}` : ""}"
                  data-settings-row="${key}"
                  data-settings-edit-label="${label}"
                  aria-expanded="false"
                  aria-controls="settings-editor-${key}"
                  ${modes ? raw(html`data-settings-when="${modes}" hidden`) : ""}
                >
                  <div class="settings-row-label">
                    <span
                      id="settings-label-${key}"
                      class="${className === "settings-cpf-group" ? "sr-only" : ""}"
                      >${label}</span
                    >
                  </div>
                  <span
                    class="overview-saving-figure settings-value-button"
                    data-settings-edit
                    aria-hidden="true"
                  >
                    <span class="settings-value-readout"
                      >${fields.map((field) => raw(buildReadout(field)))}</span
                    >
                    ${key === "cpf" ? "" : raw(pencil)}
                  </span>
                  ${derivedValue ? raw(html`<span class="settings-readonly-value" data-plan-value="${fields[0][0]}" data-value-format="${fields[0][1]}" hidden></span>`) : ""}
                  <div
                    class="settings-inline-editor"
                    id="settings-editor-${key}"
                    data-settings-sources="${fields.map(([id]) => id).join(" ")}"
                    role="group"
                    aria-labelledby="settings-label-${key}"
                    hidden
                  ></div>
                  ${extra ? raw(`<div class="settings-row-extra">${extra}</div>`) : ""}
                </div>`,
              ),
          )}
        </section>`,
    )
    .join("");
}

export function setupInlineSettings(fields, formatRangeError) {
  const form = $("#quick-form");
  const fieldKeys = new Map(
    Object.entries(fields).map(([key, id]) => [id, key]),
  );
  const rows = new Map();
  let active = null;
  $(".settings-sections", form).insertAdjacentHTML(
    "afterbegin",
    buildSettingsSections(),
  );

  const saveIcon = svgWrap('<path d="m5 12 4 4L19 6"/>', 18);
  const cancelIcon = svgWrap('<path d="m6 6 12 12M18 6 6 18"/>', 18);
  const writeButton = (label, action, icon, isPrimary = false) =>
    html`<button
      type="button"
      class="button button-small settings-action-icon${isPrimary ? " button-primary" : ""}"
      data-settings-action="${action}"
      aria-label="${label}"
      title="${label}"
      ${action === "save" ? "disabled" : ""}
    >
      ${raw(icon)}
    </button>`;

  for (const row of $$("[data-settings-row]", form)) {
    const editor = $("[data-settings-sources]", row);
    const trigger = $("[data-settings-edit]", row);
    const controls = editor.dataset.settingsSources.split(" ").map((id) => {
      const source = document.getElementById(id);
      const sourceField = source.closest(".field");
      const draftField = sourceField.cloneNode(true);
      const draft = draftField.querySelector("input, select");
      const label = draftField.querySelector("label");
      const help = draftField.querySelector("small");
      const moneyInput =
        draft.type === "number" &&
        draft.previousElementSibling?.textContent.trim() === "$";
      draft.id = `settings-draft-${id}`;
      draft.removeAttribute("name");
      draft.dataset.settingsDraft = id;
      label.htmlFor = draft.id;
      if (moneyInput) {
        draft.type = "text";
        draft.inputMode = "decimal";
        draft.autocomplete = "off";
      }
      const shortLabel = {
        "known-oa": ["OA", "Ordinary Account (OA)"],
        "known-sa": ["SA", "Special Account (SA)"],
        "known-ma": ["MA", "MediSave Account (MA)"],
        "known-sa-invested": [
          "CPFIS-SA",
          "CPF Investment Scheme–Special Account (CPFIS-SA)",
        ],
        "known-ma-spend": [
          "MediSave deductions",
          "Monthly MediSave deductions",
        ],
      }[id];
      if (shortLabel) {
        label.dataset.settingsFullLabel = shortLabel[1];
        label.textContent = shortLabel[0];
        if (help) help.prepend(`${shortLabel[1]}. `);
      }
      if (id === "known-ma-spend") {
        draftField
          .querySelector(".input-wrap")
          ?.insertAdjacentHTML(
            "beforeend",
            '<span class="input-suffix">/mo</span>',
          );
      }
      editor.append(draftField);
      if (id === "person-dob") attachDatePicker(draft);
      return { source, draft, moneyInput };
    });

    const actions = document.createElement("div");
    actions.className = "settings-editor-actions";
    actions.innerHTML =
      writeButton("Save changes", "save", saveIcon, true) +
      writeButton("Discard changes", "cancel", cancelIcon);
    const error = document.createElement("p");
    error.id = `${editor.id}-error`;
    error.className = "settings-inline-error";
    error.setAttribute("role", "status");
    error.hidden = true;
    editor.append(error, actions);
    rows.set(row, {
      row,
      editor,
      trigger,
      controls,
      error,
      cpfEditButton: row
        .closest(".settings-value-card")
        .querySelector("[data-settings-cpf-edit]"),
      saveButton: $('[data-settings-action="save"]', actions),
    });
  }

  const canonicalValue = (control, value) => {
    let canonical = value.trim();
    if (control.moneyInput) canonical = canonical.replaceAll(",", "");
    if (!canonical && control.source.type === "number") canonical = "0";
    if (control.source.type === "number" && canonical !== "") {
      const numeric = Number(canonical);
      if (Number.isFinite(numeric)) return String(numeric);
    }
    return canonical;
  };
  const syncSaveButton = (editing) => {
    editing.saveButton.disabled = !editing.controls.some(
      (control) =>
        !control.draft.disabled &&
        canonicalValue(control, control.draft.value) !==
          canonicalValue(control, control.initialValue),
    );
  };

  const visibleControl = ({ draft }) =>
    document.getElementById(`${draft.id}-display`) ||
    $(
      `[data-choice-for="${draft.dataset.settingsDraft}"] input:checked`,
      draft.closest(".field"),
    ) ||
    draft;

  const clearError = (editing) => {
    editing.error.hidden = true;
    editing.error.textContent = "";
    for (const control of editing.controls) {
      const input = visibleControl(control);
      input.removeAttribute("aria-invalid");
      input.removeAttribute("aria-errormessage");
    }
  };

  const close = (refocus) => {
    const editing = active;
    editing.row.dataset.settingsEditing = "false";
    active = null;
    clearError(editing);
    editing.editor.hidden = true;
    editing.row.setAttribute("aria-expanded", "false");
    syncEditability(editing);
    if (refocus && canEdit(editing)) editing.row.focus({ preventScroll: true });
  };

  const canEdit = (editing) => editing.row.dataset.cashDriven !== "true";
  const syncEditability = (editing) => {
    const editable = canEdit(editing);
    editing.row.dataset.settingsEditable = String(editable);
    editing.trigger.hidden = !editable || active === editing;
    if (editing.cpfEditButton)
      editing.cpfEditButton.hidden = !editable || active === editing;
    if (editable && active !== editing) {
      editing.row.setAttribute("role", "button");
      editing.row.tabIndex = 0;
      editing.row.setAttribute(
        "aria-label",
        `Edit ${editing.row.dataset.settingsEditLabel}`,
      );
    } else {
      editing.row.removeAttribute("role");
      editing.row.removeAttribute("aria-label");
      if (active === editing) editing.row.tabIndex = -1;
      else editing.row.removeAttribute("tabindex");
    }
  };

  for (const editing of rows.values()) syncEditability(editing);

  const commit = (refocus = false) => {
    if (!active) return true;
    const editing = active;
    const changes = [];
    clearError(editing);
    for (const control of editing.controls) {
      const { source, draft, moneyInput } = control;
      if (
        draft.disabled ||
        (source.id === "known-ssb-cash" &&
          editing.row.dataset.cashDriven === "true")
      )
        continue;

      const entered = draft.value.trim();
      const value = canonicalValue(control, draft.value);
      if (
        !draft.validity.badInput &&
        value === canonicalValue(control, control.initialValue)
      )
        continue;
      const probe = source.cloneNode();
      probe.value = value;
      let problem = "";
      if (
        moneyInput &&
        entered &&
        (!Number.isFinite(Number(value)) ||
          probe.value === "" ||
          (entered.includes(",") &&
            !/^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d*)?(?:e[-+]?\d+)?$/i.test(
              entered,
            )))
      ) {
        problem = "Enter an amount, for example 1,250.50.";
      } else if (draft.validity.badInput || !probe.validity.valid) {
        problem = formatRangeError(probe, fieldKeys.get(source.id));
      } else if (source.id === "person-dob") {
        const dob = RetirementModel.computeAgeFromDob(value);
        if (!dob.valid || dob.age < 18 || dob.age > 54)
          problem = "Enter a valid date of birth for ages 18–54.";
      }
      if (problem) {
        const input = visibleControl(control);
        editing.error.textContent = problem;
        editing.error.hidden = false;
        input.setAttribute("aria-invalid", "true");
        input.setAttribute("aria-errormessage", editing.error.id);
        if (refocus) input.focus();
        return false;
      }
      if (
        canonicalValue(control, source.value) !== canonicalValue(control, value)
      )
        changes.push([source, value]);
    }
    close(refocus);
    for (const [source, value] of changes) {
      source.value = value;
      source.dispatchEvent(new Event("input", { bubbles: true }));
    }
    changes.at(-1)?.[0].dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  };

  const start = (editing) => {
    if (!canEdit(editing)) return;
    if (active) {
      if (active !== editing)
        visibleControl(
          active.controls.find((control) => !control.draft.disabled) ||
            active.controls[0],
        )?.focus();
      return;
    }
    active = editing;
    editing.row.dataset.settingsEditing = "true";
    editing.trigger.hidden = true;
    if (editing.cpfEditButton) editing.cpfEditButton.hidden = true;
    editing.row.setAttribute("aria-expanded", "true");
    editing.row.removeAttribute("role");
    editing.row.removeAttribute("aria-label");
    editing.row.tabIndex = -1;
    editing.editor.hidden = false;
    for (const control of editing.controls) {
      const { source, draft, moneyInput } = control;
      draft.disabled = source.disabled;
      draft.value =
        moneyInput && source.value !== ""
          ? formatMoneyInput(source.value)
          : source.value;
      control.initialValue = draft.value;
      if (draft.type === "number") {
        draft.min = source.min;
        draft.max = source.max;
      }
      draft.dispatchEvent(new Event("settings-draft-ready"));
    }
    syncDatePickers();
    syncSaveButton(editing);
    const input = editing.controls
      .map(visibleControl)
      .find((field) => !field.disabled);
    input?.focus({ preventScroll: true });
    input?.scrollIntoView({ block: "nearest", behavior: "instant" });
  };

  const isNestedControl = (target) =>
    Boolean(
      target.closest(
        'a[href], button, input, select, textarea, summary, [role="radio"], [data-settings-action]',
      ),
    );
  const handleRowClick = (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const cpfEditButton = target.closest("[data-settings-cpf-edit]");
    const row = cpfEditButton
      ? cpfEditButton
          .closest(".settings-value-card")
          .querySelector('[data-settings-row="cpf"]')
      : target.closest("[data-settings-row]");
    const editing = rows.get(row);
    const action = target.closest("[data-settings-action]")?.dataset
      .settingsAction;

    if (cpfEditButton && editing) {
      if (active && active !== editing && !commit(false)) return;
      if (!active) start(editing);
      return;
    }

    if (active && editing === active && action) {
      if (action === "save") commit(true);
      if (action === "cancel") close(true);
      return;
    }

    if (active && editing !== active) {
      if (!commit(false)) return;
      if (editing && !isNestedControl(target)) start(editing);
      return;
    }
    if (editing && !active && !isNestedControl(target)) start(editing);
  };
  form.addEventListener("click", handleRowClick);
  document.addEventListener("click", (event) => {
    if (!active || form.contains(event.target)) return;
    commit(false);
  });
  form.addEventListener("input", (event) => {
    if (!active?.editor.contains(event.target)) return;
    active.error.hidden = true;
    active.error.textContent = "";
    syncSaveButton(active);
  });
  form.addEventListener("keydown", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const row = target?.closest("[data-settings-row]");
    const rowEditing = rows.get(row);
    if (
      rowEditing &&
      row === target &&
      row.getAttribute("role") === "button" &&
      !isNestedControl(target)
    ) {
      if (event.key === "Enter") {
        event.preventDefault();
        start(rowEditing);
        return;
      }
      if (event.key === " ") {
        event.preventDefault();
        row.dataset.settingsSpacePending = "true";
        return;
      }
    }
    if (
      !active ||
      !target ||
      !active.editor.contains(target) ||
      event.isComposing ||
      event.keyCode === 229 ||
      $(".dp-popover")?.hidden === false
    )
      return;
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    } else if (event.key === "Enter" && event.target.matches("input, select")) {
      event.preventDefault();
      commit(true);
    }
  });
  form.addEventListener("keyup", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const row = target?.closest("[data-settings-row]");
    const editing = rows.get(row);
    if (
      editing &&
      row === target &&
      row.dataset.settingsSpacePending === "true"
    ) {
      delete row.dataset.settingsSpacePending;
      start(editing);
    }
  });
  form.addEventListener("change", (event) => {
    if (active?.editor.contains(event.target)) syncSaveButton(active);
  });
  document.addEventListener("plan-rendered", () => {
    const housing = $("#known-housing-mode").value;
    for (const row of $$("[data-settings-when]", form)) {
      row.hidden = !row.dataset.settingsWhen.split(" ").includes(housing);
    }
    for (const editing of rows.values()) {
      syncEditability(editing);
      if (!canEdit(editing) && active === editing) close(false);
    }
  });
  return () => commit(true);
}

export function syncSettingsCashBalance(opts) {
  const cashNote = $("#settings-cash-accounts-note");
  if (cashNote) {
    const active = Boolean(opts.useItemizedCashAccounts);
    const count = Number(opts.cashAccountsCount || 0);
    const row = cashNote.closest("[data-settings-row]");
    if (row) {
      row.dataset.cashDriven = String(active);
      $("[data-settings-edit]", row).hidden =
        active || !$("[data-settings-sources]", row).hidden;
      $(".settings-readonly-value", row).hidden = !active;
    }
    if (active && count > 0) {
      const rawCash = ($("#known-ssb-cash")?.value || "").trim();
      const eirStr =
        opts.cashEffectiveRatePct != null
          ? ` @ ${Number(opts.cashEffectiveRatePct).toFixed(2)}% EIR`
          : "";
      const msg = `Driven by ${count} cash & SSB account${count === 1 ? "" : "s"} (${money(Number(rawCash || 0))}${eirStr}).`;
      const span = cashNote.querySelector("span");
      if (span) span.textContent = msg;
      else cashNote.textContent = msg;
      cashNote.hidden = false;
    } else {
      const span = cashNote.querySelector("span");
      if (span) span.textContent = "";
      else cashNote.textContent = "";
      cashNote.hidden = true;
    }
  }
}
