/**
 * Fast, minimal custom Calendar Date Picker popover (`DD MMM YYYY` input + Day / Month / Decade views).
 * Backs an existing ISO (`YYYY-MM-DD`) `<input>` so all model, share-codec, and form listeners stay untouched.
 */

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

const pad2 = (n) => String(n).padStart(2, "0");

export function parseIsoDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || "").trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  const d = new Date(year, month, day);
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month ||
    d.getDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

export function toIsoDate(year, month, day) {
  return `${String(year).padStart(4, "0")}-${pad2(month + 1)}-${pad2(day)}`;
}

export function formatDisplayDate(iso) {
  const parsed = parseIsoDate(iso);
  if (!parsed) return "";
  return `${pad2(parsed.day)} ${MONTHS_SHORT[parsed.month]} ${parsed.year}`;
}

export function parseUserDateInput(raw) {
  const str = String(raw || "").trim();
  if (!str) return null;

  // ISO: YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(str);
  if (isoMatch) {
    const iso = toIsoDate(
      Number(isoMatch[1]),
      Number(isoMatch[2]) - 1,
      Number(isoMatch[3]),
    );
    return parseIsoDate(iso) ? iso : null;
  }

  // DD MMM YYYY (e.g. "01 Jan 1991" or "1 jan 1991")
  const dmyText = /^(\d{1,2})[\s/-]+([a-zA-Z]{3,9})[\s,/-]+(\d{4})$/.exec(str);
  if (dmyText) {
    const day = Number(dmyText[1]);
    const monPrefix = dmyText[2].slice(0, 3).toLowerCase();
    const month = MONTHS_SHORT.findIndex((m) => m.toLowerCase() === monPrefix);
    const year = Number(dmyText[3]);
    if (month >= 0) {
      const iso = toIsoDate(year, month, day);
      return parseIsoDate(iso) ? iso : null;
    }
  }

  // DD/MM/YYYY or DD-MM-YYYY (Singapore standard)
  const dmyNum = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(str);
  if (dmyNum) {
    const iso = toIsoDate(
      Number(dmyNum[3]),
      Number(dmyNum[2]) - 1,
      Number(dmyNum[1]),
    );
    return parseIsoDate(iso) ? iso : null;
  }

  return null;
}

const instances = new Map();
let activePopover = null;

function createCalendarIconSvg() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="3"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
}

function getBounds(backingInput) {
  const minIso = backingInput.min || "1900-01-01";
  const maxIso = backingInput.max || "2100-12-31";
  return {
    minIso,
    maxIso,
    min: parseIsoDate(minIso) || { year: 1900, month: 0, day: 1 },
    max: parseIsoDate(maxIso) || { year: 2100, month: 11, day: 31 },
  };
}

function isIsoInRange(iso, bounds) {
  return iso >= bounds.minIso && iso <= bounds.maxIso;
}

function isMonthInRange(year, month, bounds) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  const firstIso = toIsoDate(year, month, 1);
  const lastIso = toIsoDate(year, month, lastDay);
  return lastIso >= bounds.minIso && firstIso <= bounds.maxIso;
}

function isYearInRange(year, bounds) {
  return year >= bounds.min.year && year <= bounds.max.year;
}

function closeActivePopover(restoreFocus = false) {
  if (!activePopover) return;
  const { popover, triggerBtn, cleanup } = activePopover;
  activePopover = null;
  cleanup();
  triggerBtn.setAttribute("aria-expanded", "false");
  try {
    if (popover.matches(":popover-open")) popover.hidePopover();
  } catch {
    // Fallback if popover API unsupported
  }
  popover.hidden = true;
  popover.remove();
  if (restoreFocus && triggerBtn.isConnected) {
    triggerBtn.focus({ preventScroll: true });
  }
}

function positionPopover(popover, anchorEl) {
  const rect = anchorEl.getBoundingClientRect();
  const popW = Math.min(312, window.innerWidth - 24);
  popover.style.width = `${popW}px`;
  const popH = popover.offsetHeight || 316;
  const spaceBelow = window.innerHeight - rect.bottom - 12;
  const spaceAbove = rect.top - 12;
  const placeAbove = spaceBelow < popH && spaceAbove > spaceBelow;

  let left = rect.right - popW;
  if (left < 12) left = Math.max(12, rect.left);
  if (left + popW > window.innerWidth - 12) {
    left = Math.max(12, window.innerWidth - popW - 12);
  }
  const top = placeAbove
    ? Math.max(12, rect.top - popH - 6)
    : Math.min(window.innerHeight - popH - 12, rect.bottom + 6);

  popover.style.left = `${Math.round(left)}px`;
  popover.style.top = `${Math.round(top)}px`;
}

function openPopoverFor(inst) {
  const { backingInput, wrap, triggerBtn, commitIso } = inst;
  if (activePopover && activePopover.backingInput === backingInput) {
    closeActivePopover(false);
    return;
  }
  closeActivePopover(false);

  const bounds = getBounds(backingInput);
  const selected = parseIsoDate(backingInput.value) || {
    year: new Date().getFullYear() - 35,
    month: 0,
    day: 1,
  };
  const today = new Date();
  const todayIso = toIsoDate(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  let mode = "days"; // "days" | "months" | "years"
  let viewYear = selected.year;
  let viewMonth = selected.month;
  let decadeStart = Math.floor((viewYear - 1) / 10) * 10 + 1;

  const popover = document.createElement("div");
  popover.className = "dp-popover";
  popover.setAttribute("role", "dialog");
  popover.setAttribute("aria-label", "Choose date");
  popover.setAttribute("popover", "manual");

  // Mount inside nearest open <dialog> so top-layer stacking works even without Popover API
  const host = backingInput.closest("dialog") || document.body;
  host.appendChild(popover);

  const renderBody = () => {
    const selectedIso = backingInput.value || "";

    if (mode === "days") {
      const firstDow = new Date(viewYear, viewMonth, 1).getDay();
      const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
      const prevDisabled = !isMonthInRange(
        viewMonth === 0 ? viewYear - 1 : viewYear,
        viewMonth === 0 ? 11 : viewMonth - 1,
        bounds,
      );
      const nextDisabled = !isMonthInRange(
        viewMonth === 11 ? viewYear + 1 : viewYear,
        viewMonth === 11 ? 0 : viewMonth + 1,
        bounds,
      );

      let cellsHtml = "";
      for (let i = 0; i < firstDow; i++) {
        cellsHtml += `<span class="dp-day-spacer" aria-hidden="true"></span>`;
      }
      for (let d = 1; d <= daysInMonth; d++) {
        const iso = toIsoDate(viewYear, viewMonth, d);
        const disabled = !isIsoInRange(iso, bounds);
        const isSel = iso === selectedIso;
        const isToday = iso === todayIso;
        const cls = [
          "dp-day-btn",
          isSel ? "is-selected" : "",
          isToday && !isSel ? "is-today" : "",
        ]
          .filter(Boolean)
          .join(" ");
        cellsHtml += `<button type="button" class="${cls}" data-dp-day="${iso}" aria-pressed="${isSel}"${disabled ? " disabled" : ""}>${d}</button>`;
      }

      popover.innerHTML = `
        <div class="dp-header">
          <button type="button" class="dp-nav-btn" data-dp-nav="prev" aria-label="Previous month"${prevDisabled ? " disabled" : ""}>&#8249;</button>
          <div class="dp-header-pills">
            <button type="button" class="dp-pill-btn" data-dp-mode="months" aria-label="Choose month">${MONTHS_SHORT[viewMonth]}</button>
            <button type="button" class="dp-pill-btn" data-dp-mode="years" aria-label="Choose year">${viewYear}</button>
          </div>
          <button type="button" class="dp-nav-btn" data-dp-nav="next" aria-label="Next month"${nextDisabled ? " disabled" : ""}>&#8250;</button>
        </div>
        <div class="dp-weekdays" aria-hidden="true">${WEEKDAYS.map((w) => `<span>${w}</span>`).join("")}</div>
        <div class="dp-days-grid">${cellsHtml}</div>
      `;
    } else if (mode === "months") {
      const prevDisabled = !isYearInRange(viewYear - 1, bounds);
      const nextDisabled = !isYearInRange(viewYear + 1, bounds);
      const selParsed = parseIsoDate(selectedIso);
      const monthsHtml = MONTHS_SHORT.map((label, idx) => {
        const disabled = !isMonthInRange(viewYear, idx, bounds);
        const isSel =
          selParsed && selParsed.year === viewYear && selParsed.month === idx;
        return `<button type="button" class="dp-grid-pill${isSel ? " is-selected" : ""}" data-dp-month="${idx}" aria-pressed="${Boolean(isSel)}"${disabled ? " disabled" : ""}>${label}</button>`;
      }).join("");

      popover.innerHTML = `
        <div class="dp-header">
          <button type="button" class="dp-nav-btn" data-dp-nav="prev" aria-label="Previous year"${prevDisabled ? " disabled" : ""}>&#8249;</button>
          <div class="dp-header-pills">
            <button type="button" class="dp-pill-btn" data-dp-mode="years" aria-label="Choose year">${viewYear}</button>
          </div>
          <button type="button" class="dp-nav-btn" data-dp-nav="next" aria-label="Next year"${nextDisabled ? " disabled" : ""}>&#8250;</button>
        </div>
        <div class="dp-pill-grid">${monthsHtml}</div>
      `;
    } else {
      const decadeEnd = decadeStart + 9;
      const prevDisabled = decadeStart - 1 < bounds.min.year;
      const nextDisabled = decadeEnd + 1 > bounds.max.year;
      const selParsed = parseIsoDate(selectedIso);
      let yearsHtml = "";
      for (let y = decadeStart; y <= decadeEnd; y++) {
        const disabled = !isYearInRange(y, bounds);
        const isSel = selParsed && selParsed.year === y;
        yearsHtml += `<button type="button" class="dp-grid-pill${isSel ? " is-selected" : ""}" data-dp-year="${y}" aria-pressed="${Boolean(isSel)}"${disabled ? " disabled" : ""}>${y}</button>`;
      }

      popover.innerHTML = `
        <div class="dp-header">
          <button type="button" class="dp-nav-btn" data-dp-nav="prev" aria-label="Previous decade"${prevDisabled ? " disabled" : ""}>&#8249;</button>
          <span class="dp-decade-label">${decadeStart} – ${decadeEnd}</span>
          <button type="button" class="dp-nav-btn" data-dp-nav="next" aria-label="Next decade"${nextDisabled ? " disabled" : ""}>&#8250;</button>
        </div>
        <div class="dp-pill-grid">${yearsHtml}</div>
      `;
    }
    positionPopover(popover, wrap);
    const focusTarget = popover.querySelector(
      ".dp-day-btn.is-selected:not(:disabled), .dp-grid-pill.is-selected:not(:disabled), .dp-pill-btn:not(:disabled), .dp-nav-btn:not(:disabled)",
    );
    focusTarget?.focus({ preventScroll: true });
  };

  popover.addEventListener("click", (event) => {
    const btn = event.target.closest("button");
    if (!btn || btn.disabled) return;
    event.stopPropagation();

    if (btn.dataset.dpMode) {
      mode = btn.dataset.dpMode;
      if (mode === "years") {
        decadeStart = Math.floor((viewYear - 1) / 10) * 10 + 1;
      }
      renderBody();
      return;
    }

    if (btn.dataset.dpNav) {
      const dir = btn.dataset.dpNav === "prev" ? -1 : 1;
      if (mode === "days") {
        viewMonth += dir;
        if (viewMonth < 0) {
          viewMonth = 11;
          viewYear -= 1;
        } else if (viewMonth > 11) {
          viewMonth = 0;
          viewYear += 1;
        }
      } else if (mode === "months") {
        viewYear += dir;
      } else {
        decadeStart += dir * 10;
      }
      renderBody();
      return;
    }

    if (btn.dataset.dpYear != null) {
      viewYear = Number(btn.dataset.dpYear);
      mode = "months";
      renderBody();
      return;
    }

    if (btn.dataset.dpMonth != null) {
      viewMonth = Number(btn.dataset.dpMonth);
      mode = "days";
      renderBody();
      return;
    }

    if (btn.dataset.dpDay) {
      commitIso(btn.dataset.dpDay);
      closeActivePopover(true);
    }
  });

  const onOutsidePointer = (event) => {
    if (popover.contains(event.target) || wrap.contains(event.target)) {
      return;
    }
    closeActivePopover(false);
  };

  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeActivePopover(true);
    }
  };

  const onReposition = () => {
    if (popover.isConnected) positionPopover(popover, wrap);
  };

  document.addEventListener("pointerdown", onOutsidePointer, true);
  document.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("resize", onReposition);
  window.addEventListener("scroll", onReposition, true);

  activePopover = {
    backingInput,
    popover,
    triggerBtn,
    cleanup: () => {
      document.removeEventListener("pointerdown", onOutsidePointer, true);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    },
  };

  triggerBtn.setAttribute("aria-expanded", "true");
  try {
    popover.showPopover();
  } catch {
    popover.hidden = false;
  }
  renderBody();
}

/**
 * Upgrade an ISO `<input type="date">` inside `.dob-input-wrap` to the clean
 * `DD MMM YYYY` + Calendar Icon + Day/Month/Decade popover module.
 */
export function attachDatePicker(backingInput) {
  if (!backingInput || instances.has(backingInput)) return null;
  const wrap = backingInput.closest(".dob-input-wrap");
  if (!wrap) return null;

  backingInput.classList.add("dob-native-backing");
  backingInput.tabIndex = -1;
  backingInput.setAttribute("aria-hidden", "true");

  const displayInput = document.createElement("input");
  displayInput.type = "text";
  displayInput.className = "dp-display-input";
  displayInput.id = `${backingInput.id}-display`;
  displayInput.placeholder = "DD MMM YYYY";
  displayInput.autocomplete = "bday";
  displayInput.setAttribute(
    "aria-label",
    backingInput.getAttribute("aria-label") || "Date of birth (DD MMM YYYY)",
  );
  displayInput.value = formatDisplayDate(backingInput.value);

  const triggerBtn = document.createElement("button");
  triggerBtn.type = "button";
  triggerBtn.className = "dp-trigger-btn";
  triggerBtn.setAttribute("aria-label", "Open calendar");
  triggerBtn.setAttribute("aria-haspopup", "dialog");
  triggerBtn.setAttribute("aria-expanded", "false");
  triggerBtn.innerHTML = createCalendarIconSvg();

  // Re-point any associated <label for="..."> to the visible display input
  const label = document.querySelector(`label[for="${backingInput.id}"]`);
  if (label) label.setAttribute("for", displayInput.id);

  // Forward programmatic focus on the date value to the display input
  backingInput.addEventListener("focus", () => {
    displayInput.focus({ preventScroll: true });
  });

  const commitIso = (iso) => {
    const bounds = getBounds(backingInput);
    if (!isIsoInRange(iso, bounds)) return;
    backingInput.value = iso;
    displayInput.value = formatDisplayDate(iso);
    backingInput.dispatchEvent(new Event("input", { bubbles: true }));
    backingInput.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const syncFromBacking = () => {
    if (document.activeElement === displayInput) return;
    displayInput.value = formatDisplayDate(backingInput.value);
  };

  displayInput.addEventListener("change", () => {
    const parsedIso = parseUserDateInput(displayInput.value);
    if (parsedIso) {
      commitIso(parsedIso);
    } else if (!displayInput.value.trim()) {
      backingInput.value = "";
      backingInput.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      displayInput.value = formatDisplayDate(backingInput.value);
    }
  });

  displayInput.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" && event.altKey) {
      event.preventDefault();
      openPopoverFor(inst);
    } else if (event.key === "Enter") {
      const parsedIso = parseUserDateInput(displayInput.value);
      if (parsedIso) {
        event.preventDefault();
        commitIso(parsedIso);
      }
    }
  });

  const inst = {
    backingInput,
    displayInput,
    triggerBtn,
    wrap,
    commitIso,
    syncFromBacking,
  };

  triggerBtn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openPopoverFor(inst);
  });

  wrap.appendChild(displayInput);
  wrap.appendChild(triggerBtn);
  instances.set(backingInput, inst);
  return inst;
}

/** Sync all attached custom date pickers from their underlying ISO inputs. */
export function syncDatePickers() {
  for (const inst of instances.values()) {
    inst.syncFromBacking();
  }
}
