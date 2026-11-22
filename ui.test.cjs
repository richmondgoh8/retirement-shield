const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawn } = require("node:child_process");

const DIST_DIR = path.resolve(__dirname, "dist");
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

function findChromeBinary() {
  return CHROME_CANDIDATES.find((bin) => fs.existsSync(bin)) || null;
}

function startStaticServer(rootDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlPath = (req.url || "/").split("?")[0];
      const rel = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
      const filePath = path.resolve(rootDir, rel);
      if (!filePath.startsWith(rootDir) || !fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end("Not Found");
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      });
      fs.createReadStream(filePath).pipe(res);
    });
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

async function launchChromeCDP(chromePath) {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "rs-ui-test-"));
  const proc = spawn(
    chromePath,
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--remote-debugging-port=0",
      `--user-data-dir=${userDataDir}`,
      "--window-size=1280,900",
      "about:blank",
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );

  const wsUrl = await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Timed out waiting for Chrome DevTools WS URL")),
      10000,
    );
    let stderrBuf = "";
    proc.stderr.on("data", (chunk) => {
      stderrBuf += chunk.toString();
      const match = stderrBuf.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
    proc.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Chrome exited early (${code}): ${stderrBuf}`));
    });
  });

  const baseHttp = wsUrl
    .replace(/^ws:/, "http:")
    .replace(/\/devtools\/.*$/, "");
  const targets = await (await fetch(`${baseHttp}/json/list`)).json();
  const pageTarget = targets.find((t) => t.type === "page") || targets[0];
  if (!pageTarget?.webSocketDebuggerUrl) {
    throw new Error("No page target found in headless Chrome");
  }

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });

  let nextId = 1;
  const pending = new Map();
  const exceptions = [];

  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    } else if (msg.method === "Runtime.exceptionThrown") {
      const desc =
        msg.params?.exceptionDetails?.exception?.description ||
        msg.params?.exceptionDetails?.text ||
        "Uncaught exception";
      exceptions.push(desc);
    }
  });

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });

  await send("Page.enable");
  await send("Runtime.enable");

  const evaluate = async (expression) => {
    const res = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (res.exceptionDetails) {
      throw new Error(
        res.exceptionDetails.exception?.description ||
          res.exceptionDetails.text,
      );
    }
    return res.result?.value;
  };

  const navigate = async (url) => {
    await send("Page.navigate", { url });
    for (let i = 0; i < 60; i++) {
      const ready = await evaluate(
        'document.readyState === "complete" && Boolean(document.querySelector("#overview-slot .overview-verdict"))',
      );
      if (ready) return;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(
      `Timed out waiting for app boot at ${url}${exceptions.length ? ` (exceptions: ${exceptions.join(" | ")})` : ""}`,
    );
  };

  const close = async () => {
    try {
      ws.close();
    } catch (_) {}
    if (proc.exitCode === null && proc.signalCode === null) {
      const exited = new Promise((resolve) => proc.once("exit", resolve));
      if (proc.kill("SIGKILL")) await exited;
    }
    fs.rmSync(userDataDir, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 50,
    });
  };

  return { send, evaluate, navigate, exceptions, close };
}

test("Browser UI smoke tests: 5 destinations, WAI-ARIA arrow keys, cashReturnRate reload, malformed #p= safety, modal Escape autosave, Dividend badge plain text", async (t) => {
  const chromePath = findChromeBinary();
  if (!chromePath) {
    t.skip("No local Chrome/Chromium binary found");
    return;
  }
  assert.ok(
    fs.existsSync(path.join(DIST_DIR, "index.html")),
    "Run npm run build before UI tests",
  );

  const { server, baseUrl } = await startStaticServer(DIST_DIR);
  const browser = await launchChromeCDP(chromePath);

  try {
    await browser.navigate(`${baseUrl}/`);
    assert.deepEqual(
      browser.exceptions,
      [],
      `Startup page exceptions: ${browser.exceptions.join("; ")}`,
    );

    const insights = await browser.evaluate(`(() => {
      const set = (id, value) => {
        const input = document.getElementById(id);
        input.value = value;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      };
      const findInsights = () => document.getElementById("fin-money-moves");
      const original = Object.fromEntries(
        ["known-invest", "known-srs", "known-srs-invested", "known-oa"].map((id) => [id, document.getElementById(id).value]),
      );
      const none = !findInsights();
      set("known-invest", "50");
      const hero = document.querySelector(".overview-verdict");
      const preview = {
        funded: hero.querySelector("[data-preview-funded]").textContent,
        rate: hero.querySelector("[data-preview-rate]").textContent,
        band: hero.querySelector("[data-preview-savings-band]").textContent,
      };
      hero.querySelector('[data-money-move="match-save"]').click();
      const matchesPreview =
        document.querySelector("#nav-badge-overview").textContent === preview.funded &&
        document.querySelector("[data-current-savings-rate]").textContent === preview.rate &&
        document.querySelector("[data-current-savings-band]").textContent === preview.band;
      set("known-invest", "50");
      set("known-srs", "1000");
      set("known-srs-invested", "cash");
      const single = findInsights();
      const singleRow = single.matches(".fin-move-row") &&
        !single.querySelector(".fin-move-rank, .fin-move-row, ol");
      const singleEdit = single.querySelector(".fin-move-link").textContent;
      const singleText = single.textContent;
      const singleAction = single.querySelector(".fin-move-cta").dataset.moneyMove;
      const singleTitle = single.querySelector(".fin-move-title");
      const luminance = (rgb) => rgb.match(/\\d+/g).map(Number).slice(0, 3)
        .map((channel) => channel / 255)
        .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
        .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
      const levels = [
        luminance(getComputedStyle(single).backgroundColor),
        luminance(getComputedStyle(singleTitle).color),
      ].sort((a, b) => b - a);
      const warningContrast = (levels[0] + 0.05) / (levels[1] + 0.05);
      set("known-oa", "40000");
      const rows = Array.from(findInsights().querySelectorAll("ol > li"));
      const ranks = rows.map((row) => row.querySelector(".fin-move-rank").textContent);
      const uniqueFigures = rows.every((row) => {
        const title = row.querySelector(".fin-move-title");
        const desc = row.querySelector(".fin-move-desc");
        const amounts = Array.from(title.querySelectorAll(".curr-wrap"));
        return amounts.every((amount) => !desc.textContent.includes(amount.textContent)) &&
          row.textContent.split("/mo").length <= 2;
      });
      for (const [id, value] of Object.entries(original)) set(id, value);
      return { none, matchesPreview, singleRow, singleEdit, singleText, singleAction, warningContrast, ranks, uniqueFigures };
    })()`);
    assert.equal(insights.none, true);
    assert.equal(insights.matchesPreview, true);
    assert.equal(insights.singleRow, true);
    assert.equal(insights.singleEdit, "Edit");
    assert.equal(insights.singleAction, "invest-srs");
    assert.ok(insights.singleText.split("/mo").length <= 2);
    assert.doesNotMatch(
      insights.singleText,
      /#1|Ranked by impact|Disappears once applied/,
    );
    assert.ok(insights.warningContrast >= 4.5);
    assert.deepEqual(insights.ranks, ["1.", "2.", "3."]);
    assert.equal(insights.uniqueFigures, true);

    const savings = await browser.evaluate(`(async () => {
      const find = (selector) => document.querySelector(selector);
      const apply = (key, value) => {
        const input = find(key);
        input.value = value;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      };
      const inputs = Array.from(document.querySelectorAll("[data-overview-saving]"));
      const sources = inputs.map((input) => "#"+input.dataset.overviewSaving);
      const original = sources.map((source) => find(source).value);
      const afterRender = () => new Promise((resolve) =>
        document.addEventListener("plan-rendered", resolve, { once: true }));
      const projections = find("#overview-saving-details");
      const allCollapsed = ["#overview-saving-details", "#overview-methodology", "#overview-portfolio-details", "#retirement-taps-card"]
        .every((selector) => !find(selector).open);
      const firstEditor = inputs[0].parentElement;
      const firstFigure = find("#overview-edit-known-cpf-extra");
      const initiallyHidden = firstEditor.hidden;
      firstFigure.click();
      const focusOpensEditor = !firstEditor.hidden && document.activeElement === inputs[0];
      firstFigure.focus();
      inputs[0].blur();
      projections.open = true;
      const nextRender = afterRender();
      inputs.forEach((input, i) => apply("#"+input.id, String((i + 1) * 100)));
      await nextRender;
      const edited = sources.map((source) => find(source).value);
      const editedTotal = find(".overview-savings-total").textContent;
      const projectionsOpen = find("#overview-saving-details").open;
      find('#overview-slot [data-use-suggested="known-invest"]').click();
      const suggested = find("#known-invest").value;
      apply("#known-invest", "4400");
      const cap = find('.overview-verdict [data-money-move="cap-affordable-save"]');
      const preview = {
        funded: find("[data-preview-funded]").textContent,
        rate: find("[data-preview-rate]").textContent,
        band: find("[data-preview-savings-band]").textContent,
      };
      cap.click();
      const matchesCap =
        find("#nav-badge-overview").textContent === preview.funded &&
        find("[data-current-savings-rate]").textContent === preview.rate &&
        find("[data-current-savings-band]").textContent === preview.band;
      sources.forEach((source, i) => apply(source, original[i]));
      find("#overview-saving-details").open = false;
      return { edited, editedTotal, projectionsOpen, suggested, matchesCap, allCollapsed, initiallyHidden, focusOpensEditor };
    })()`);
    assert.deepEqual(savings.edited, ["100", "200", "300"]);
    assert.match(savings.editedTotal, /600/);
    assert.equal(savings.projectionsOpen, true);
    assert.equal(savings.suggested, "");
    assert.equal(savings.matchesCap, true);
    assert.equal(savings.allCollapsed, true);
    assert.equal(savings.initiallyHidden, true);
    assert.equal(savings.focusOpensEditor, true);

    // 1. All five workspace destinations switch cleanly without runtime errors
    const workspaceNav = await browser.evaluate(`(() => {
      const tabs = [...document.querySelectorAll('.sidebar-nav [role="tab"]')];
      for (const btn of tabs) btn.click();
      tabs[0]?.click();
      const destinations = (selector) => [...document.querySelectorAll(selector)]
        .map((button) => button.dataset.destination);
      document.querySelector("#destination-plan").click();
      const profileVisibleByDefault = Boolean(document.querySelector('#tab-panel-profile [data-settings-row="birth"]')?.getClientRects().length);
      tabs[0]?.click();
      const sections = [...document.querySelectorAll(".workspace-sections")]
        .map((group) => [...group.querySelectorAll("[data-tab]")].map((tab) => tab.dataset.tab));
      return {
        desktop: destinations(".sidebar-nav [data-destination]"),
        mobile: destinations(".mobile-tabbar [data-destination]"),
        sections,
        profileVisibleByDefault,
      };
    })()`);
    assert.deepEqual(workspaceNav.desktop, [
      "overview",
      "plan",
      "accounts",
      "invest",
      "cpf-tax",
    ]);
    assert.deepEqual(workspaceNav.mobile, workspaceNav.desktop);
    assert.equal(workspaceNav.profileVisibleByDefault, true);
    assert.deepEqual(workspaceNav.sections, [
      ["profile", "budget", "trajectory"],
      ["balances", "cash-accounts", "cash-parking"],
      ["allocator", "dividend-calc", "priority-guide"],
      ["cpf-rules", "tax"],
    ]);

    // 2. WAI-ARIA keyboard ArrowDown on vertical .sidebar-nav moves active tab & roving tabindex
    const ariaResult = await browser.evaluate(`(() => {
      const nav = document.querySelector('.sidebar-nav');
      const tabs = [...nav.querySelectorAll('[role="tab"]')];
      tabs[0].focus();
      tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
      return {
        secondSelected: tabs[1].getAttribute('aria-selected'),
        secondTabIndex: tabs[1].getAttribute('tabindex'),
        firstTabIndex: tabs[0].getAttribute('tabindex'),
      };
    })()`);
    assert.equal(ariaResult.secondSelected, "true");
    assert.equal(ariaResult.secondTabIndex, "0");
    assert.equal(ariaResult.firstTabIndex, "-1");

    // 3. cashReturnRate = 0.05 (%) survives reload without 100x amplification or decimal corruption
    await browser.evaluate(`(() => {
      const inp = document.querySelector('#known-cash-return');
      inp.value = '0.05';
      inp.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await new Promise((r) => setTimeout(r, 200));
    await browser.navigate(`${baseUrl}/`);
    assert.deepEqual(
      browser.exceptions,
      [],
      `Startup page exceptions: ${browser.exceptions.join("; ")}`,
    );
    const cashRateAfterReload = await browser.evaluate(`(() => {
      const saved = JSON.parse(localStorage.getItem('rs_plan_state') || '{}');
      return {
        inputVal: document.querySelector('#known-cash-return')?.value,
        savedRate: saved.cashReturnRate,
        badgeText: document.querySelector('#nav-badge-cash')?.textContent?.trim(),
      };
    })()`);
    assert.equal(cashRateAfterReload.inputVal, "0.05");
    assert.equal(cashRateAfterReload.savedRate, "0.05");
    assert.equal(cashRateAfterReload.badgeText, "0.05%");

    // 4. Malformed #p=INVALID share hash preserves existing localStorage saved plan
    await browser.evaluate(`(() => {
      const sal = document.querySelector('#person-salary');
      sal.value = '9100';
      sal.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await new Promise((r) => setTimeout(r, 200));
    await browser.navigate(`${baseUrl}/#p=!!!NOT_VALID_BASE64!!!`);
    await new Promise((r) => setTimeout(r, 200));
    const salaryAfterBadHash = await browser.evaluate(
      `document.querySelector('#person-salary')?.value`,
    );
    assert.equal(
      salaryAfterBadHash,
      "9100",
      "Malformed #p= share link must not wipe saved localStorage plan",
    );

    // 5. Settings edits use one Save/Cancel model, with keyboard and zero behavior
    const salaryEdit = await browser.evaluate(`(() => {
      document.querySelector("#section-profile").click();
      const trigger = document.querySelector('[data-settings-row="salary"]');
      trigger.click();
      const draft = document.querySelector("#settings-draft-person-salary");
      const save = document.querySelector('#settings-editor-salary [data-settings-action="save"]');
      const initiallyDisabled = save.disabled;
      draft.value = '12,345';
      draft.dispatchEvent(new Event("input", { bubbles: true }));
      const enabledAfterChange = !save.disabled;
      draft.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
      const focusReturnedAfterSave = document.activeElement === trigger;
      trigger.click();
      const secondDraft = document.querySelector("#settings-draft-person-salary");
      secondDraft.value = "23456";
      secondDraft.dispatchEvent(new Event("input", { bubbles: true }));
      secondDraft.blur();
      const blurDidNotSave =
        document.querySelector("#person-salary").value === "12345" &&
        !document.querySelector("#settings-editor-salary").hidden;
      document.querySelector('#settings-editor-salary [data-settings-action="cancel"]').click();
      const focusReturnedAfterCancel = document.activeElement === trigger;
      document.querySelector("#destination-overview").click();
      return {
        value: document.querySelector("#person-salary").value,
        initiallyDisabled,
        enabledAfterChange,
        focusReturnedAfterSave,
        blurDidNotSave,
        focusReturnedAfterCancel,
      };
    })()`);
    assert.equal(salaryEdit.value, "12345");
    assert.equal(salaryEdit.initiallyDisabled, true);
    assert.equal(salaryEdit.enabledAfterChange, true);
    assert.equal(salaryEdit.focusReturnedAfterSave, true);
    assert.equal(salaryEdit.blurDidNotSave, true);
    assert.equal(salaryEdit.focusReturnedAfterCancel, true);

    const settingsRows = await browser.evaluate(`(async () => {
      document.querySelector("#section-profile").click();
      const cases = [
        ["birth", "person-dob", "date"],
        ["retire", "known-retire", "number"],
        ["salary", "person-salary", "number"],
        ["bonus", "known-annual-bonus", "number"],
        ["cpf", "known-oa", "number"],
        ["housing", "known-housing-mode", "choice"],
        ["loan", "known-housing-balance", "number", "bank"],
        ["manual", "known-housing", "number", "custom"],
        ["holdings", "known-equities", "number"],
        ["srs-balance", "known-srs", "number"],
        ["srs-annual", "known-srs-annual", "number"],
        ["srs-age", "known-srs-age", "choice"],
        ["srs-invest", "known-srs-invested", "choice"],
        ["reliefs", "known-existing-reliefs", "number"],
        ["top-up", "known-family-rstu", "number"],
      ];
      const failures = [];
      const originalHousing = document.querySelector("#known-housing-mode").value;
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const waitForSaved = async () => {
        for (let i = 0; i < 30; i++) {
          if ([...document.querySelectorAll("[data-plan-save-status]")]
            .some((status) => status.textContent.trim() === "Saved")) return true;
          await wait(50);
        }
        return false;
      };
      const writeDraftChange = (editor, sourceId, suffix) => {
        const draft = editor.querySelector('[data-settings-draft="' + sourceId + '"]');
        if (!draft) throw new Error("Missing draft for " + sourceId);
        if (draft.tagName === "SELECT") {
          const radios = [...editor.querySelectorAll('[data-choice-for="' + sourceId + '"] input[type="radio"]')];
          const next = radios.find((radio) => radio.value !== draft.value);
          if (next) {
            next.click();
            return editor.querySelector('[data-choice-for="' + sourceId + '"] input:checked');
          }
          const option = [...draft.options].find((item) => item.value !== draft.value);
          if (!option) throw new Error("No alternate option for " + sourceId);
          draft.value = option.value;
          draft.dispatchEvent(new Event("input", { bubbles: true }));
          draft.dispatchEvent(new Event("change", { bubbles: true }));
          return draft;
        }
        const source = document.getElementById(sourceId);
        let value;
        if (draft.type === "date") {
          value = suffix === "a" ? "1988-06-15" : "1989-07-16";
        } else if (source.type === "number") {
          const min = source.min === "" ? 0 : Number(source.min);
          const max = source.max === "" ? 1000000 : Number(source.max);
          const current = Number(
            String(draft.value || source.value || min).replaceAll(",", ""),
          );
          const step = source.step && source.step !== "any" ? Number(source.step) : 1;
          value = String(current + step <= max ? current + step : Math.max(min, current - step));
          if (value === (draft.value || source.value)) value = String(Math.min(max, current + 2 * step));
        } else {
          value = String(Number(draft.value || 0) + 1);
        }
        draft.value = value;
        draft.dispatchEvent(new Event("input", { bubbles: true }));
        draft.dispatchEvent(new Event("change", { bubbles: true }));
        return draft;
      };
      const sourceIds = new Set(cases.map(([, id]) => id));
      const sourceValues = Object.fromEntries(
        [...sourceIds].map((id) => [id, document.getElementById(id).value]),
      );
      for (const [key, sourceId, kind, mode] of cases) {
        try {
          if (mode) {
            const housing = document.querySelector("#known-housing-mode");
            housing.value = mode;
            housing.dispatchEvent(new Event("change", { bubbles: true }));
            await wait(80);
          }
          const row = document.querySelector('[data-settings-row="' + key + '"]');
          const scope = row.closest("[data-settings-scope]").dataset.settingsScope;
          document.querySelector("#section-" + scope).click();
          const inputs = document.querySelector("#top").closest("details");
          if (inputs) inputs.open = true;
          const editor = document.querySelector("#settings-editor-" + key);
          if (!row || !editor) throw new Error("Missing row/editor");
          if (key === "lifestyle") {
            const select = editor.querySelector("select");
            if (!select?.getClientRects().length || row.getAttribute("role") === "button" ||
              editor.querySelector("[data-settings-action]") ||
              ![...select.options].some((option) => option.value === "custom")) {
              throw new Error("Lifestyle must be a directly available dropdown with a Custom option");
            }
            continue;
          }
          if (row.getAttribute("role") !== "button" || row.tabIndex !== 0) {
            throw new Error("Row is not an accessible edit control");
          }
          const original = document.getElementById(sourceId).value;

          row.click();
          if (editor.hidden) throw new Error("Pointer click did not open editor");
          const save = editor.querySelector('[data-settings-action="save"]');
          if (!save.disabled)
            throw new Error("Save was enabled while the row was clean");
          let changed = writeDraftChange(editor, sourceId, "a");
          if (save.disabled) throw new Error("Save stayed disabled after change");
          save.click();
          if (!editor.hidden || document.activeElement !== row) {
            throw new Error(
              "✓ result: editorHidden=" +
                editor.hidden +
                ", focus=" +
                (document.activeElement?.id ||
                  document.activeElement?.className ||
                  document.activeElement?.tagName) +
                ", rowRole=" +
                row.getAttribute("role") +
                ", error=" +
                editor.querySelector(".settings-inline-error").textContent,
            );
          }
          if (document.getElementById(sourceId).value === original) {
            throw new Error("✓ did not commit the changed value");
          }
          if (!(await waitForSaved())) throw new Error("Saved status was not shown");

          row.focus();
          row.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
          if (editor.hidden) throw new Error("Enter did not open editor");
          changed = writeDraftChange(editor, sourceId, "b");
          changed.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
          if (!editor.hidden || document.activeElement !== row) {
            throw new Error("Enter did not save and return focus to the row");
          }
          if (!(await waitForSaved())) throw new Error("Saved status was not shown after Enter");

          row.click();
          writeDraftChange(editor, sourceId, "a");
          editor.querySelector('[data-settings-action="cancel"]').click();
          if (!editor.hidden || document.activeElement !== row) {
            throw new Error("✕ did not cancel and return focus to the row");
          }

          row.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));
          row.dispatchEvent(new KeyboardEvent("keyup", { key: " ", bubbles: true, cancelable: true }));
          if (editor.hidden) throw new Error("Space did not open editor");
          const escapeDraft = writeDraftChange(editor, sourceId, "b");
          escapeDraft.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
          if (!editor.hidden || document.activeElement !== row) {
            throw new Error("Escape did not cancel and return focus to the row");
          }

          if (key === "housing") {
            const help = editor.querySelector(".housing-mode-description");
            const draft = editor.querySelector(
              '[data-settings-draft="known-housing-mode"]',
            );
            if (!help || help.hidden || !help.textContent.trim()) {
              throw new Error("Housing option helper is missing");
            }
            if (draft.getAttribute("aria-describedby") !== help.id) {
              throw new Error("Housing helper is not associated with its control");
            }
          }
        } catch (error) {
          failures.push(key + ": " + error.message);
          const editor = document.querySelector("#settings-editor-" + key);
          if (editor && !editor.hidden) {
            editor.querySelector('[data-settings-action="cancel"]')?.click();
          }
        }
        const source = document.getElementById(sourceId);
        source.value = sourceValues[sourceId];
        source.dispatchEvent(new Event("input", { bubbles: true }));
        source.dispatchEvent(new Event("change", { bubbles: true }));
        if (mode) {
          const housing = document.querySelector("#known-housing-mode");
          housing.value = originalHousing;
          housing.dispatchEvent(new Event("change", { bubbles: true }));
          await wait(80);
        }
      }
      const housingVisibility = [];
      const housing = document.querySelector("#known-housing-mode");
      for (const mode of ["all-oa", "hdb", "bank", "paid-up", "custom"]) {
        housing.value = mode;
        document.dispatchEvent(new Event("plan-rendered"));
        housingVisibility.push([
          mode,
          !document.querySelector('[data-settings-row="loan"]').hidden,
          !document.querySelector('[data-settings-row="manual"]').hidden,
        ]);
      }
      housing.value = originalHousing;
      document.dispatchEvent(new Event("plan-rendered"));
      const toolActions = [...document.querySelectorAll("#plan-overflow button")];
      const toolsHaveActions = toolActions.length >= 6 && !document.querySelector("#plan-overflow [data-settings-row]");
      document.querySelector("#section-balances").click();
      const cashRow = document.querySelector('[data-settings-row="cash"]');
      cashRow.dataset.cashDriven = "true";
      cashRow.querySelector("[data-settings-edit]").hidden = true;
      document.dispatchEvent(new Event("plan-rendered"));
      const readonlyCashNotInteractive =
        cashRow.getAttribute("role") !== "button" &&
        !cashRow.hasAttribute("tabindex") &&
        cashRow.querySelector("[data-settings-edit]").hidden;
      cashRow.click();
      const readonlyCashStaysClosed = document.querySelector("#settings-editor-cash").hidden;
      cashRow.querySelector("#open-cash-breakdown-settings").click();
      const accountsLinkStaysSeparate = document.querySelector("#settings-editor-cash").hidden && document.body.dataset.view === "cash-accounts";
      cashRow.dataset.cashDriven = "false";
      cashRow.querySelector("[data-settings-edit]").hidden = false;
      document.dispatchEvent(new Event("plan-rendered"));
      document.querySelector("#destination-overview").click();
      return {
        rows: cases.map(([key]) => key),
        failures,
        housingVisibility,
        toolsHaveActions,
        readonlyCashNotInteractive,
        readonlyCashStaysClosed,
        accountsLinkStaysSeparate,
      };
    })()`);
    assert.deepEqual(
      settingsRows.failures,
      [],
      `Settings rows failing mouse/keyboard Save/Cancel: ${settingsRows.failures.join("; ")}`,
    );
    assert.equal(settingsRows.toolsHaveActions, true);
    assert.deepEqual(settingsRows.housingVisibility, [
      ["all-oa", false, false],
      ["hdb", true, false],
      ["bank", true, false],
      ["paid-up", false, false],
      ["custom", false, true],
    ]);
    assert.equal(
      settingsRows.readonlyCashNotInteractive,
      true,
      JSON.stringify(settingsRows),
    );
    assert.equal(settingsRows.readonlyCashStaysClosed, true);
    assert.equal(settingsRows.accountsLinkStaysSeparate, true);

    const outsideCommit = await browser.evaluate(`(() => {
      document.querySelector("#section-profile").click();
      const row = document.querySelector('[data-settings-row="salary"]');
      const editor = document.querySelector("#settings-editor-salary");
      const source = document.querySelector("#person-salary");
      const original = source.value;
      row.click();
      const draft = document.querySelector("#settings-draft-person-salary");
      draft.value = "8765";
      draft.dispatchEvent(new Event("input", { bubbles: true }));
      row.closest(".settings-value-card").querySelector("h2").click();
      const changedClickCommitted = editor.hidden && source.value === "8765";
      row.click();
      row.closest(".settings-value-card").querySelector("h2").click();
      const unchangedClickClosed = editor.hidden && source.value === "8765";
      source.value = original;
      source.dispatchEvent(new Event("input", { bubbles: true }));
      source.dispatchEvent(new Event("change", { bubbles: true }));
      return { changedClickCommitted, unchangedClickClosed };
    })()`);
    assert.equal(outsideCommit.changedClickCommitted, true);
    assert.equal(outsideCommit.unchangedClickClosed, true);

    const cpfInline = await browser.evaluate(`(() => {
      document.querySelector("#section-balances").click();
      const row = document.querySelector('[data-settings-row="cpf"]');
      const oaSource = document.querySelector("#known-oa");
      const before = oaSource.value;
      oaSource.value = "123";
      oaSource.dispatchEvent(new Event("input", { bubbles: true }));
      row.querySelector("[data-settings-edit]").click();
      const editor = document.querySelector("#settings-editor-cpf");
      const labels = [...editor.querySelectorAll(".field-label > label")].map((label) => label.textContent.trim());
      const help = editor.querySelector('.field-help-trigger[aria-label="More about Ordinary Account (OA)"]');
      const helpText = help?.getAttribute("aria-controls");
      const monthly = editor.querySelector('[data-settings-draft="known-ma-spend"]');
      const fields = ["known-oa", "known-sa", "known-ma", "known-sa-invested"].map((id) => editor.querySelector('[data-settings-draft="' + id + '"]'));
      const tops = fields.map((input) => Math.round(input.getBoundingClientRect().top));
      const save = editor.querySelector('[data-settings-action="save"]');
      const trigger = row.querySelector("[data-settings-edit]");
      const oa = editor.querySelector('[data-settings-draft="known-oa"]');
      oa.value = "";
      oa.dispatchEvent(new Event("input", { bubbles: true }));
      const enabledAfterEmpty = !save.disabled;
      save.click();
      const sourceAfterEmpty = document.querySelector("#known-oa").value;
      const summaryAfterEmpty = row.querySelector('[data-plan-value="known-oa"]').textContent;
      trigger.click();
      const inputAfterEmpty = document.querySelector("#settings-draft-known-oa").value;
      document.querySelector("#settings-draft-known-oa").dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
      );
      oaSource.value = before;
      oaSource.dispatchEvent(new Event("input", { bubbles: true }));
      help?.click();
      const tooltipDidNotStartRow = editor.hidden;
      const helpPanel = helpText && document.getElementById(helpText);
      if (helpPanel?.matches(":popover-open")) helpPanel.hidePopover();
      return {
        labels,
        tooltip: helpText ? document.getElementById(helpText)?.textContent : "",
        monthlySuffix: monthly?.closest(".input-wrap")?.querySelector(".input-suffix")?.textContent,
        summarySuffix: row.querySelector('[data-plan-value="known-ma-spend"]')?.textContent,
        tops,
        saveInitiallyDisabled: save.disabled,
        enabledAfterEmpty,
        sourceAfterEmpty,
        summaryAfterEmpty,
        inputAfterEmpty,
        before,
        headingHidden: getComputedStyle(row.querySelector(".settings-row-label span")).position === "absolute",
        headingClass: row.querySelector(".settings-row-label span").className,
        tooltipDidNotStartRow,
      };
    })()`);
    assert.deepEqual(cpfInline.labels, [
      "OA",
      "SA",
      "MA",
      "CPFIS-SA",
      "MediSave deductions",
    ]);
    assert.match(cpfInline.tooltip, /Ordinary Account \(OA\)/);
    assert.equal(cpfInline.monthlySuffix, "/mo");
    assert.match(cpfInline.summarySuffix, /\/mo$/);
    assert.equal(new Set(cpfInline.tops).size, 1);
    assert.equal(cpfInline.saveInitiallyDisabled, true);
    assert.equal(cpfInline.enabledAfterEmpty, true);
    assert.equal(cpfInline.sourceAfterEmpty, "0");
    assert.equal(cpfInline.summaryAfterEmpty, "$0");
    assert.equal(cpfInline.inputAfterEmpty, "0");
    assert.equal(cpfInline.headingHidden, true, JSON.stringify(cpfInline));
    assert.equal(cpfInline.tooltipDidNotStartRow, true);

    await browser.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    });
    const settingsLayout = await browser.evaluate(`(() => {
      document.querySelector("#section-profile").click();
      const profile = document.querySelector(".settings-profile-card");
      const profileRows = [...profile.querySelectorAll("[data-settings-row]")];
      const birthRow = profile.querySelector('[data-settings-row="birth"]');
      const birthEditor = document.querySelector("#settings-editor-birth");
      birthRow.click();
      const birthInput =
        birthEditor.querySelector("#settings-draft-person-dob-display") ||
        birthEditor.querySelector('[data-settings-draft="person-dob"]');
      const birthField = birthInput.closest(".field");
      const birthActions = [...birthEditor.querySelectorAll(".settings-editor-actions button")];
      const birthCenters = [
        birthRow.querySelector(".settings-row-label").getBoundingClientRect(),
        birthInput.getBoundingClientRect(),
        ...birthActions.map((button) => button.getBoundingClientRect()),
      ].map((rect) => rect.top + rect.height / 2);
      const birthGeometry = [
        birthRow,
        birthRow.querySelector(".settings-row-label"),
        birthEditor,
        birthField,
        birthField.querySelector(".input-wrap"),
        birthInput,
        ...birthActions,
      ].map((element) => {
        const rect = element.getBoundingClientRect();
        return [
          element.className || element.id,
          Math.round(rect.top),
          Math.round(rect.height),
          getComputedStyle(element).display,
        ];
      });
      const birthResult = {
        profileRowsFlex: profileRows.every((row) => getComputedStyle(row).display === "flex"),
        profileRowsCentered: profileRows.every((row) => getComputedStyle(row).alignItems === "center"),
        birthPadding: [
          getComputedStyle(birthRow).paddingBlockStart,
          getComputedStyle(birthRow).paddingBlockEnd,
        ],
        birthFieldWidth: Math.round(birthField.getBoundingClientRect().width),
        birthInputHeight: Math.round(birthInput.getBoundingClientRect().height),
        birthActionSizes: birthActions.map((button) => [
          Math.round(button.getBoundingClientRect().width),
          Math.round(button.getBoundingClientRect().height),
        ]),
        birthCenters,
        birthGeometry,
      };
      birthEditor.querySelector('[data-settings-action="cancel"]').click();
      profile.querySelector('[data-settings-row="retire"]').click();
      const retireEditor = document.querySelector("#settings-editor-retire");
      const retireInput = retireEditor.querySelector('[data-settings-draft="known-retire"]');
      const retireFieldWidth = Math.round(retireInput.closest(".field").getBoundingClientRect().width);
      const retireInputHeight = Math.round(retireInput.getBoundingClientRect().height);
      retireEditor.querySelector('[data-settings-action="cancel"]').click();

      document.querySelector("#section-balances").click();
      const cpfCard = document.querySelector(".settings-cpf-card");
      const cpfRow = cpfCard.querySelector('[data-settings-row="cpf"]');
      const cpfEdit = cpfCard.querySelector("[data-settings-cpf-edit]");
      const summaryColumns = getComputedStyle(
        cpfRow.querySelector(".settings-value-readout"),
      ).gridTemplateColumns.split(" ").length;
      cpfEdit.click();
      let cpfEditor = document.querySelector("#settings-editor-cpf");
      const cpfInput = cpfEditor.querySelector('[data-settings-draft="known-oa"]');
      let cpfActions = [...cpfEditor.querySelectorAll(".settings-editor-actions button")];
      const initialSaveDisabled = cpfActions[0].disabled;
      cpfInput.value = "123";
      cpfInput.dispatchEvent(new Event("input", { bubbles: true }));
      cpfEditor = document.querySelector("#settings-editor-cpf");
      cpfActions = [...cpfEditor.querySelectorAll(".settings-editor-actions button")];
      return {
        ...birthResult,
        retireFieldWidth,
        retireInputHeight,
        cpfEditorInBalances: Boolean(cpfCard.closest("#tab-panel-balances")),
        cpfEditName: cpfEdit.getAttribute("aria-label"),
        cpfEditHiddenWhileEditing: cpfEdit.hidden,
        cpfSummaryColumns: summaryColumns,
        cpfEditorColumns: getComputedStyle(cpfEditor).gridTemplateColumns.split(" ").length,
        cpfMonthlyColumn: getComputedStyle(
          cpfEditor.querySelector('[data-settings-draft="known-ma-spend"]').closest(".field"),
        ).gridColumn,
        cpfBorderTop: getComputedStyle(cpfRow).borderTopWidth,
        cpfInputHeight: Math.round(cpfInput.getBoundingClientRect().height),
        cpfActionSizes: cpfActions.map((button) => [
          Math.round(button.getBoundingClientRect().width),
          Math.round(button.getBoundingClientRect().height),
        ]),
        cpfInitialSaveDisabled: initialSaveDisabled,
        cpfSaveEnabledAfterChange: !cpfActions[0].disabled,
        cpfSaveClass: cpfActions[0].className,
        cpfCancelBackground: getComputedStyle(cpfActions[1]).backgroundColor,
        cpfInputWidths: [
          ...cpfEditor.querySelectorAll(".field input:not([type=radio])"),
        ].map((input) => Math.round(input.getBoundingClientRect().width)),
      };
    })()`);
    assert.equal(settingsLayout.profileRowsFlex, true);
    assert.equal(settingsLayout.profileRowsCentered, true);
    assert.deepEqual(settingsLayout.birthPadding, ["16px", "16px"]);
    assert.equal(
      settingsLayout.birthFieldWidth,
      settingsLayout.retireFieldWidth,
    );
    assert.equal(
      settingsLayout.birthInputHeight,
      settingsLayout.retireInputHeight,
    );
    assert.deepEqual(settingsLayout.birthActionSizes, [
      [40, 40],
      [40, 40],
    ]);
    assert.ok(
      Math.max(...settingsLayout.birthCenters) -
        Math.min(...settingsLayout.birthCenters) <=
        1,
      JSON.stringify(settingsLayout.birthGeometry),
    );
    assert.equal(settingsLayout.cpfEditorInBalances, true);
    assert.equal(settingsLayout.cpfEditName, "Edit CPF");
    assert.equal(settingsLayout.cpfEditHiddenWhileEditing, true);
    assert.equal(settingsLayout.cpfSummaryColumns, 5);
    assert.equal(settingsLayout.cpfEditorColumns, 5);
    assert.equal(settingsLayout.cpfMonthlyColumn, "auto");
    assert.equal(new Set(settingsLayout.cpfInputWidths.slice(0, 4)).size, 1);
    assert.ok(
      settingsLayout.cpfInputWidths[4] < settingsLayout.cpfInputWidths[0],
    );
    assert.equal(settingsLayout.cpfBorderTop, "0px");
    assert.equal(settingsLayout.cpfInputHeight, 40);
    assert.deepEqual(settingsLayout.cpfActionSizes, [
      [40, 40],
      [40, 40],
    ]);
    assert.equal(settingsLayout.cpfInitialSaveDisabled, true);
    assert.equal(settingsLayout.cpfSaveEnabledAfterChange, true);
    assert.match(settingsLayout.cpfSaveClass, /\bbutton-primary\b/);
    assert.equal(settingsLayout.cpfCancelBackground, "rgba(0, 0, 0, 0)");
    await browser.evaluate(
      `document.querySelector('#settings-editor-cpf [data-settings-action="cancel"]').click()`,
    );

    await browser.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await browser.send("Emulation.setTouchEmulationEnabled", {
      enabled: true,
      maxTouchPoints: 1,
    });
    const cpfMobile = await browser.evaluate(`(() => {
      const row = document.querySelector('[data-settings-row="cpf"]');
      row.querySelector("[data-settings-edit]").click();
      const editor = document.querySelector("#settings-editor-cpf");
      const input = editor.querySelector('[data-settings-draft="known-oa"]');
      const monthly = editor.querySelector('[data-settings-draft="known-ma-spend"]');
      const columns = getComputedStyle(editor).gridTemplateColumns.split(" ").length;
      const inputHeight = Math.round(input.getBoundingClientRect().height);
      const saveButtons = [...editor.querySelectorAll(".settings-editor-actions button")].map((button) => Math.round(button.getBoundingClientRect().width));
      const monthlyColumn = getComputedStyle(monthly.closest(".field")).gridColumn;
      const overflow = document.documentElement.scrollWidth - innerWidth;
      editor.querySelector('[data-settings-action="cancel"]').click();
      document.querySelector("#section-profile").click();
      const salaryRow = document.querySelector('[data-settings-row="salary"]');
      const salaryTrigger = salaryRow.querySelector("[data-settings-edit]");
      const closedHeight = salaryRow.getBoundingClientRect().height;
      salaryTrigger.click();
      const openedHeight = salaryRow.getBoundingClientRect().height;
      const salaryDraft = document.querySelector("#settings-draft-person-salary");
      const duplicateLabelHidden =
        getComputedStyle(salaryDraft.closest(".field").querySelector(".field-label")).position === "absolute";
      document.querySelector('#settings-editor-salary [data-settings-action="cancel"]').click();
      return {
        columns, inputHeight, saveButtons, monthlyColumn, overflow,
        singleEditHeightShift: Math.abs(openedHeight - closedHeight),
        duplicateLabelHidden,
      };
    })()`);
    assert.equal(cpfMobile.columns, 2);
    assert.equal(cpfMobile.inputHeight, 44);
    assert.equal(cpfMobile.monthlyColumn, "1 / -1");
    assert.ok(cpfMobile.saveButtons.every((width) => width === 40));
    assert.ok(cpfMobile.overflow <= 0);
    assert.ok(cpfMobile.singleEditHeightShift <= 4);
    assert.equal(cpfMobile.duplicateLabelHidden, true);

    const editStateKeys = [
      "birth",
      "retire",
      "salary",
      "bonus",
      "cpf",
      "housing",
      "loan",
      "manual",
      "holdings",
      "srs-balance",
      "srs-annual",
      "srs-age",
      "srs-invest",
      "reliefs",
      "top-up",
    ];
    const screenshotDir = path.join(
      __dirname,
      "artifacts",
      "settings-edit-states",
    );
    const captureEditState = async (viewport, key) => {
      const shot = await browser.send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: false,
      });
      const dir = path.join(screenshotDir, viewport);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, `${key}.png`),
        Buffer.from(shot.data, "base64"),
      );
    };
    const captureScreenshots = process.env.CAPTURE_SETTINGS_EDIT_STATES === "1";

    if (captureScreenshots) {
      await browser.send("Emulation.setDeviceMetricsOverride", {
        width: 1440,
        height: 1000,
        deviceScaleFactor: 1,
        mobile: false,
      });
      for (const key of editStateKeys) {
        await browser.evaluate(`(() => {
          const housing = document.querySelector("#known-housing-mode");
          if ("${key}" === "loan") housing.value = "bank";
          if ("${key}" === "manual") housing.value = "custom";
          if ("${key}" === "loan" || "${key}" === "manual") {
            housing.dispatchEvent(new Event("change", { bubbles: true }));
          }
          const row = document.querySelector('[data-settings-row="${key}"]');
          const scope = row.closest("[data-settings-scope]").dataset.settingsScope;
          document.querySelector("#section-" + scope).click();
          const inputs = document.querySelector("#top").closest("details");
          if (inputs) inputs.open = true;
          row.scrollIntoView({ block: "center", behavior: "instant" });
          row.click();
        })()`);
        const opened = await browser.evaluate(
          `!document.querySelector("#settings-editor-${key}").hidden`,
        );
        assert.equal(
          opened,
          true,
          `Desktop screenshot row did not open: ${key}`,
        );
        await captureEditState("1440", key);
        await browser.evaluate(
          `document.querySelector('#settings-editor-${key} [data-settings-action="cancel"]').click()`,
        );
        if (key === "loan" || key === "manual") {
          await browser.evaluate(`(() => {
            const housing = document.querySelector("#known-housing-mode");
            housing.value = "all-oa";
            housing.dispatchEvent(new Event("change", { bubbles: true }));
          })()`);
        }
      }
    }

    await browser.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await browser.send("Emulation.setTouchEmulationEnabled", {
      enabled: true,
      maxTouchPoints: 1,
    });
    const touchFailuresList = [];
    for (const key of editStateKeys) {
      const point = await browser.evaluate(`(async () => {
        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        const housing = document.querySelector("#known-housing-mode");
        if ("${key}" === "loan") housing.value = "bank";
        if ("${key}" === "manual") housing.value = "custom";
        if ("${key}" === "loan" || "${key}" === "manual") {
          housing.dispatchEvent(new Event("change", { bubbles: true }));
          await wait(80);
        }
        const row = document.querySelector('[data-settings-row="${key}"]');
        const scope = row.closest("[data-settings-scope]").dataset.settingsScope;
        document.querySelector("#section-" + scope).click();
        const inputs = document.querySelector("#top").closest("details");
        if (inputs) inputs.open = true;
        row.scrollIntoView({ block: "center", behavior: "instant" });
        await new Promise(requestAnimationFrame);
        const affordance = row.querySelector("[data-settings-edit]");
        const rect = affordance.getBoundingClientRect();
        return {
          point: {
            x: Math.round(rect.left + Math.min(rect.width / 2, 64)),
            y: Math.round(rect.top + rect.height / 2),
            id: 1,
            radiusX: 1,
            radiusY: 1,
            force: 1,
          },
          pencilVisible: !affordance.hidden,
        };
      })()`);
      if (!point?.point) {
        touchFailuresList.push(`${key}: no touch target`);
        continue;
      }
      await browser.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [point.point],
      });
      await browser.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      const touchResult = await browser.evaluate(`(() => {
        const key = "${key}";
        const row = document.querySelector('[data-settings-row="' + key + '"]');
        const editor = document.querySelector("#settings-editor-" + key);
        const opened = !editor.hidden;
        const pencilVisible = !row.querySelector("[data-settings-edit]").hidden;
        const editorRect = editor.getBoundingClientRect();
        const rowRect = row.getBoundingClientRect();
        return {
          opened,
          editorWidth: Math.round(editorRect.width),
          rowWidth: Math.round(rowRect.width),
          overflow: document.documentElement.scrollWidth - innerWidth,
        };
      })()`);
      if (!touchResult.opened)
        touchFailuresList.push(`${key}: touch did not open`);
      if (!point.pencilVisible)
        touchFailuresList.push(`${key}: touch pencil hidden`);
      if (touchResult.overflow > 0)
        touchFailuresList.push(
          `${key}: page overflow ${touchResult.overflow}px`,
        );
      if (captureScreenshots) await captureEditState("390", key);
      await browser.evaluate(`(() => {
        document.querySelector('#settings-editor-${key} [data-settings-action="cancel"]')?.click();
        if ("${key}" === "loan" || "${key}" === "manual") {
          const housing = document.querySelector("#known-housing-mode");
          housing.value = "all-oa";
          housing.dispatchEvent(new Event("change", { bubbles: true }));
        }
      })()`);
    }
    await browser.send("Emulation.setTouchEmulationEnabled", {
      enabled: false,
    });
    assert.deepEqual(
      touchFailuresList,
      [],
      `Settings rows failing 390px touch activation: ${touchFailuresList.join("; ")}`,
    );
    await browser.send("Emulation.clearDeviceMetricsOverride");
    await browser.evaluate(
      `document.querySelector("#destination-overview").click()`,
    );

    // 6. Dividend & Yield Target Monthly Income live edit renders plain text in #div-header-badge (no raw HTML)
    const divBadge = await browser.evaluate(`(() => {
      document.querySelector('[data-tab="dividend-calc"]').click();
      const targetTab = document.querySelector('.div-mode-bar [data-div-mode="target"]');
      if (targetTab) targetTab.click();
      const inp = document.querySelector('#div-target-monthly');
      inp.focus();
      inp.value = '4500';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      return document.querySelector('#div-header-badge')?.textContent || '';
    })()`);
    assert.ok(divBadge.length > 0);
    assert.equal(
      divBadge.includes("<span"),
      false,
      `#div-header-badge must not contain raw HTML: ${divBadge}`,
    );

    // 7. Accessibility invariants: vertical tablist orientation, aria-controls, SVG chart labels
    const a11yAudit = await browser.evaluate(`(() => {
      document.querySelector('[data-destination="overview"]').click();
      const nav = document.querySelector('.sidebar-nav');
      const tabs = [...nav.querySelectorAll('[role="tab"]')];
      const allHaveControls = tabs.every((t) => {
        const id = t.getAttribute('aria-controls');
        return Boolean(id && document.getElementById(id));
      });
      const nwSvg = document.querySelector('#overview-slot svg[role="img"]');
      return {
        orientation: nav.getAttribute('aria-orientation'),
        allHaveControls,
        svgLabel: nwSvg?.getAttribute('aria-label') || '',
      };
    })()`);
    assert.equal(a11yAudit.orientation, "vertical");
    assert.equal(a11yAudit.allHaveControls, true);
    assert.ok(a11yAudit.svgLabel.length > 10);

    // 8. Hidden-input validation & Quick Edit close clamping + keyboard focus return after edit
    const qeCheck = await browser.evaluate(`(async () => {
      const source = document.querySelector("#known-invest");
      source.value = "-500";
      source.dispatchEvent(new Event("change", { bubbles: true }));
      const trigger = document.querySelector('#plan-error-banner [data-quick-edit="invest"]');
      trigger.click();
      const dlg = document.querySelector('#quick-edit-modal');
      if (!dlg.open) throw new Error("Fix value did not open Quick Edit");
      const inv = document.querySelector('#qe-invest');
      inv.value = '-500';
      inv.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 60));
      const errVisible = !document.querySelector('#plan-error-banner').hidden;
      await new Promise((resolve) => {
        dlg.addEventListener("close", resolve, { once: true });
        dlg.close();
      });
      return {
        errVisible,
        clampedInvest: document.querySelector('#known-invest')?.value,
        activeTag: document.activeElement?.tagName,
      };
    })()`);
    assert.equal(
      qeCheck.errVisible,
      true,
      "Negative hidden invest must trigger validation error",
    );
    assert.equal(
      qeCheck.clampedInvest,
      "0",
      "Closing Quick Edit must clamp negative invest to 0",
    );
    assert.notEqual(
      qeCheck.activeTag,
      "BODY",
      "Closing Quick Edit after live edit must not drop focus to <body>",
    );

    // 9. Clearing pre-filled #known-equities to blank stays blank on reload (does not resurrect $34,000)
    await browser.evaluate(`(() => {
      const eq = document.querySelector('#known-equities');
      eq.value = '';
      eq.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await new Promise((r) => setTimeout(r, 200));
    await browser.navigate(`${baseUrl}/`);
    const eqAfterReload = await browser.evaluate(
      `document.querySelector('#known-equities')?.value`,
    );
    assert.equal(eqAfterReload, "");

    // 10. Fresh Grad persona preset selects 5.5% return without blanking #known-return
    const freshGradReturn = await browser.evaluate(`(async () => {
      document.querySelector("#section-profile").click();
      document.querySelector("#plan-overflow").open = true;
      document.querySelector('[commandfor="starter-plan-dialog"][command="show-modal"]').click();
      const btn = document.querySelector('[data-persona-preset="fresh-grad"]');
      btn.click();
      const dialog = document.querySelector("#replace-plan-dialog");
      await new Promise((resolve) => {
        dialog.addEventListener("close", resolve, { once: true });
        dialog.querySelector('button[value="replace"]').click();
      });
      const sel = document.querySelector('#known-return');
      return { value: sel?.value, selectedIndex: sel?.selectedIndex };
    })()`);
    assert.equal(freshGradReturn.value, "0.055");
    assert.ok(freshGradReturn.selectedIndex >= 0);

    // 11. Desktop 1280px Overview tab has zero horizontal overflow (docOverflow <= 0)
    await browser.navigate(`${baseUrl}/`);
    const desktopOverflow = await browser.evaluate(
      `document.documentElement.scrollWidth - window.innerWidth`,
    );
    assert.ok(
      desktopOverflow <= 0,
      `Desktop Overview must not overflow horizontally (got +${desktopOverflow}px)`,
    );

    // 12. Stored plan version "3" (from JSON import) survives page reload without wiping rs_plan_state
    await new Promise((r) => setTimeout(r, 350));
    await browser.evaluate(`(() => {
      localStorage.setItem("rs_plan_version", "3");
      localStorage.setItem("rs_plan_state", JSON.stringify({
        version: "3",
        lifestyle: "cca",
        age: "41",
        retire: "62",
        salary: "9500"
      }));
    })()`);
    await browser.navigate(`${baseUrl}/`);
    const importedState = await browser.evaluate(`(() => {
      const raw = localStorage.getItem("rs_plan_state");
      return {
        version: localStorage.getItem("rs_plan_version"),
        parsed: raw ? JSON.parse(raw) : null,
      };
    })()`);
    assert.equal(importedState.version, "3");
    assert.equal(
      importedState.parsed?.age,
      "41",
      "Plan saved under rs_plan_version=3 must persist across reload",
    );

    // 13. Custom cash account XSS payload in #p= is escaped in Cash Parking banner
    const xssPayload = encodeURIComponent(
      JSON.stringify([
        [
          "custom",
          "<img src=x onerror=window.__xss=1>",
          150000,
          100000,
          3,
          0.05,
        ],
      ]),
    );
    await browser.navigate(
      `${baseUrl}/#version=3&lifestyle=cca&age=35&retire=65&salary=8000&longevityAge=95&housingMode=bank&housingBalance=0&housingYears=0&cashMode=itemized&cashItems=${xssPayload}`,
    );
    await browser.evaluate(
      `document.querySelector('button[data-tab="cash-accounts"]')?.click()`,
    );
    await new Promise((r) => setTimeout(r, 150));
    const xssCheck = await browser.evaluate(`({
      horizon: document.querySelector("#known-longevity")?.selectedOptions[0]?.text,
      legacyLoanAccepted: document.querySelector("#plan-error-banner")?.hidden,
      fired: Boolean(window.__xss),
      renderedHtml: document.querySelector('#cash-accounts')?.innerHTML || '',
    })`);
    assert.equal(xssCheck.horizon, "Age 95 (default)");
    assert.equal(xssCheck.legacyLoanAccepted, true);
    assert.equal(
      xssCheck.fired,
      false,
      "Cash account names must be HTML-escaped",
    );
    assert.ok(
      xssCheck.renderedHtml.includes("&lt;img"),
      "Escaped cash account name must render in Cash Parking banner",
    );

    // 14. Overview statutory disclaimer shows real 2026 CPF/BHS caps (never $0) & post55 label targets switch
    await browser.navigate(`${baseUrl}/`);
    await new Promise((r) => setTimeout(r, 250));
    const phase1UiCheck = await browser.evaluate(`({
      disclaimer: document.querySelector('.ember-disclaimer-body')?.textContent || '',
      post55For: document.querySelector('#post55-toggle-label')?.getAttribute('for') || '',
    })`);
    assert.ok(
      phase1UiCheck.disclaimer.includes("$8,000/mo") &&
        phase1UiCheck.disclaimer.includes("$79,000"),
      `Overview disclaimer must display $8,000/mo OW ceiling and $79,000 BHS, got: ${phase1UiCheck.disclaimer}`,
    );
    assert.equal(
      phase1UiCheck.post55For,
      "post55-toggle-switch",
      "post55 label must target #post55-toggle-switch directly, not hidden select",
    );

    // 15. Document-targeted keydown/click events must not throw when event.target lacks .closest()
    await browser.evaluate(`(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      document.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    })()`);
    await new Promise((r) => setTimeout(r, 80));

    // 16. Dividend Calculator preset chips stay active on live input & Trajectory chart supports keyboard scrubbing
    await browser.evaluate(
      `document.querySelector('button[data-tab="dividend-calc"]')?.click()`,
    );
    await new Promise((r) => setTimeout(r, 150));
    await browser.evaluate(`(() => {
      document.querySelector('[data-div-mode="lump"]')?.click();
    })()`);
    await new Promise((r) => setTimeout(r, 100));
    await browser.evaluate(`(() => {
      const capInput = document.getElementById("div-calc-capital");
      if (capInput) {
        capInput.value = "500000";
        capInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
    })()`);
    await new Promise((r) => setTimeout(r, 220));
    const divPresetSync = await browser.evaluate(`(() => {
      const chip = document.querySelector('.div-preset-chip[data-div-cap-pick="500000"]');
      return {
        ok: Boolean(chip?.classList.contains("is-active") && chip?.getAttribute("aria-pressed") === "true"),
      };
    })()`);
    assert.equal(
      divPresetSync.ok,
      true,
      "Dividend Calculator preset chip must stay active after live input",
    );

    await browser.evaluate(
      `document.querySelector('button[data-tab="trajectory"]')?.click()`,
    );
    await new Promise((r) => setTimeout(r, 150));
    const chartKeyRes = await browser.evaluate(`(() => {
      const chart = document.getElementById("trajectory-chart");
      if (!chart) return { ok: false };
      chart.focus();
      chart.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      const sr = document.getElementById("sr-status")?.textContent || "";
      const ttVisible = !document.getElementById("chart-tooltip")?.hidden;
      return { ok: chart.getAttribute("tabindex") === "0" && ttVisible && sr.includes("Age") };
    })()`);
    assert.equal(
      chartKeyRes.ok,
      true,
      "Trajectory chart must be keyboard-focusable and show tooltip + live announcement on ArrowRight",
    );

    // 17. WAI-ARIA tablist arrow traversal keeps focus in tablist, Settings preserves tabindex="0", tabpanels have aria-labelledby, and MAS securities show SG Gov Backed
    const tabA11yAudit = await browser.evaluate(`(() => {
      const nav = document.querySelector(".sidebar-nav");
      const firstTab = nav.querySelector('[role="tab"][data-destination="overview"]');
      firstTab.click();
      firstTab.focus();
      firstTab.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      const activeAfter1 = document.activeElement?.dataset?.destination || "";
      document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
      const activeAfter2 = document.activeElement?.dataset?.destination || "";
      const panels = [...document.querySelectorAll('[role="tabpanel"]')];
      const allPanelsLabelled = panels.length >= 15 && panels.every((p) => {
        const ref = p.getAttribute("aria-labelledby");
        return Boolean(ref && document.getElementById(ref));
      });
      const priorityGuidePanelLabelled = Boolean(
        document.querySelector('#tab-panel-priority-guide[aria-labelledby="section-priority-guide"]'),
      );
      document.querySelector("#section-profile")?.click();
      const tabbableWhileSettings = nav.querySelectorAll('[role="tab"][tabindex="0"]').length;
      document.querySelector("#destination-overview")?.click();
      document.querySelector('[data-tab="cash-parking"]')?.click();
      const cashText = document.getElementById("cash-parking-slot")?.textContent || "";
      return {
        activeAfter1,
        activeAfter2,
        allPanelsLabelled,
        priorityGuidePanelLabelled,
        tabbableWhileSettings,
        hasSgGovBacked: cashText.includes("SG Gov Backed"),
      };
    })()`);
    assert.equal(tabA11yAudit.activeAfter1, "plan");
    assert.equal(tabA11yAudit.activeAfter2, "accounts");
    assert.equal(tabA11yAudit.allPanelsLabelled, true);
    assert.equal(tabA11yAudit.priorityGuidePanelLabelled, true);
    assert.ok(
      tabA11yAudit.tabbableWhileSettings >= 1,
      "Sidebar tablist must keep at least one tabindex=0 tab while Settings is open",
    );
    assert.equal(
      tabA11yAudit.hasSgGovBacked,
      true,
      "Cash Parking must badge MAS SSB / T-Bills as SG Gov Backed",
    );

    const settingsSummary = await browser.evaluate(`(async () => {
      const find = (selector) => document.querySelector(selector);
      const set = (field, value) => {
        field.value = value;
        field.dispatchEvent(new Event("change", { bubbles: true }));
      };
      const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
      const afterClose = (dialog, selector) => new Promise((resolve) => {
        dialog.addEventListener("close", resolve, { once: true });
        dialog.querySelector(selector).click();
      });
      find("#section-profile").click();
      const salary = find("#person-salary");
      const summary = find('[data-plan-value="person-salary"]');
      const before = summary.textContent;
      const original = salary.value;
      const editIncome = find('[data-settings-row="salary"]');
      editIncome.click();
      await nextFrame();
      const draft = find("#settings-draft-person-salary");
      const salaryFocused = document.activeElement === draft;
      const formattedInitially = draft.value.includes(",") || Number(original) < 1000;
      const key = (input, key) => input.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
      draft.value = "6,250";
      const draftIsolated = salary.value === original;
      key(draft, "Enter");
      const saved = summary.textContent;
      const restoredFocus = document.activeElement === editIncome;
      editIncome.click();
      draft.value = "99,999";
      key(draft, "Escape");
      const escaped = salary.value === "6250";
      editIncome.click();
      draft.value = original;
      key(draft, "Enter");
      find('#section-budget').click();
      find('#budget-slot [data-quick-edit=budget]').click();
      const budgetDialog = find("#expense-modal");
      const editBudgetOpened = budgetDialog.open;
      await afterClose(budgetDialog, ".qe-footer-actions [data-exp-modal-close]");
      find("#section-profile").click();
      const loan = find('[data-choice-for="known-housing-mode"]');
      const originalHousing = find("#known-housing-mode").value;
      find('[data-settings-row="housing"] [data-settings-edit]').click();
      loan.querySelector('[value="hdb"]').click();
      find('#settings-editor-housing [data-settings-action="save"]').click();
      const loanShown = !find('[data-settings-row="loan"]').hidden;
      find('[data-settings-row="housing"] [data-settings-edit]').click();
      loan.querySelector('[value="paid-up"]').click();
      find('#settings-editor-housing [data-settings-action="save"]').click();
      const paidUpHidesLoan = find('[data-settings-row="loan"]').hidden;
      find('[data-settings-row="housing"] [data-settings-edit]').click();
      Array.from(loan.querySelectorAll("input")).find((el) => el.value === originalHousing).click();
      find('#settings-editor-housing [data-settings-action="save"]').click();
      const openAssumptions = find('[commandfor="plan-settings"][command="show-modal"]');
      find("#plan-overflow").open = true;
      openAssumptions.click();
      const assumptionHorizonLabels = Array.from(find('[data-choice-for="known-longevity"]').querySelectorAll("span")).map((el) => el.textContent);
      const assumptionsOpened = find("#plan-settings").open;
      find("#plan-settings").close();
      const planInputsInProfile = Boolean(find("#tab-panel-profile #top"));
      find("#section-cash-parking").click();
      const cashOptionsOpened = !find("#tab-panel-cash-parking").hidden;
      const age95Choices = Array.from(find("#known-longevity").options)
        .filter((option) => option.text.startsWith("Age 95")).length;
      return {
        before, salaryFocused, formattedInitially, draftIsolated, saved, restoredFocus, escaped,
        editBudgetOpened, planInputsInProfile, cashOptionsOpened, age95Choices,
        loanShown, paidUpHidesLoan, assumptionHorizonLabels, assumptionsOpened,
      };
    })()`);
    assert.ok(settingsSummary.before.endsWith("/mo"));
    assert.equal(settingsSummary.salaryFocused, true);
    assert.equal(settingsSummary.formattedInitially, true);
    assert.equal(settingsSummary.draftIsolated, true);
    assert.equal(settingsSummary.escaped, true);
    assert.equal(settingsSummary.saved, "$6,250/mo");
    assert.equal(settingsSummary.restoredFocus, true);
    assert.equal(settingsSummary.editBudgetOpened, true);
    assert.equal(settingsSummary.planInputsInProfile, true);
    assert.equal(settingsSummary.cashOptionsOpened, true);
    assert.equal(settingsSummary.age95Choices, 1);

    assert.equal(settingsSummary.loanShown, true);
    assert.equal(settingsSummary.paidUpHidesLoan, true);
    assert.equal(settingsSummary.assumptionsOpened, true);
    assert.deepEqual(settingsSummary.assumptionHorizonLabels, [
      "85",
      "90",
      "95 (default)",
      "100",
    ]);

    const replacements = await browser.evaluate(`(async () => {
      const find = (selector) => document.querySelector(selector);
      const settle = () => new Promise((resolve) => setTimeout(resolve, 90));
      find("#section-profile").click();
      find("#plan-overflow").open = true;
      find('[commandfor="starter-plan-dialog"][command="show-modal"]').click();
      const before = find("#person-salary").value;
      const replace = find("#replace-plan-dialog");
      const example = find('[data-persona-preset="fresh-grad"]');
      example.click();
      const examplePrompt = replace.open && find("#replace-plan-message").textContent.includes("replace your current plan");
      find('#replace-plan-dialog button[value="cancel"]').click();
      await settle();
      const exampleCanceled = find("#person-salary").value === before;
      example.click();
      find('#replace-plan-dialog button[value="replace"]').click();
      await settle();
      const loaded = find("#person-salary").value;
      find("[data-toast-undo]").click();
      const exampleUndone = find("#person-salary").value === before;
      const file = new File([JSON.stringify({ version:"3", lifestyle:"cca", salary:"7250" })], "test.json");
      const transfer = new DataTransfer();
      transfer.items.add(file);
      const input = find("#import-json-file");
      input.files = transfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await settle();
      const importPrompt = replace.open && find("#person-salary").value === before;
      find('#replace-plan-dialog button[value="replace"]').click();
      await settle();
      const imported = find("#person-salary").value;
      find("[data-toast-undo]").click();
      const importUndone = find("#person-salary").value === before;
      find("#destination-overview").click();
      return { examplePrompt, exampleCanceled, loaded, exampleUndone, importPrompt, imported, importUndone };
    })()`);
    assert.deepEqual(replacements, {
      examplePrompt: true,
      exampleCanceled: true,
      loaded: "4500",
      exampleUndone: true,
      importPrompt: true,
      imported: "7250",
      importUndone: true,
    });

    const resetUndo = await browser.evaluate(`(async () => {
      const find = (selector) => document.querySelector(selector);
      const salary = find("#person-salary").value;
      find("#plan-overflow").open = true;
      find("[data-sg-reset]").click();
      const resetSalary = find("#person-salary").value;
      const undo = find("[data-toast-undo]");
      const undoShown = !undo.hidden && !find("#ui-toast").hidden;
      undo.click();
      return {
        salary, resetSalary, undoShown,
        restoredSalary: find("#person-salary").value,
        savedSalary: JSON.parse(localStorage.getItem("rs_plan_state")).salary,
        saveStatus: find("#plan-save-status").textContent
      };
    })()`);
    assert.equal(resetUndo.resetSalary, "5500");
    assert.equal(resetUndo.undoShown, true);
    assert.equal(resetUndo.restoredSalary, resetUndo.salary);
    assert.equal(resetUndo.savedSalary, resetUndo.salary);
    assert.equal(resetUndo.saveStatus, "Saved");

    const allocation = await browser.evaluate(`(async () => {
      const find = (selector) => document.querySelector(selector);
      find('[data-destination="overview"]').click();
      find("#overview-saving-details").open = true;
      find('#overview-saving-details [data-go-tab="allocator"]').click();
      const equity = find("#bogle-target-slider");
      const sg = find("#bogle-sg-slider");
      const original = [equity.value, sg.value];
      const set = (field, value) => {
        field.value = value;
        field.dispatchEvent(new Event("input", { bubbles: true }));
      };
      const settle = () => new Promise((resolve) => setTimeout(resolve, 120));
      const percentages = () => [...find(".allocator-target-readout").querySelectorAll("strong")]
        .map((element) => element.textContent);
      set(equity, "80");
      set(sg, "25");
      await settle();
      const mixed = percentages();
      set(equity, "0");
      await settle();
      const bondsOnly = percentages();
      const sgDisabled = sg.disabled;
      set(equity, original[0]);
      set(sg, original[1]);
      await settle();
      return { mixed, bondsOnly, sgDisabled };
    })()`);
    assert.deepEqual(allocation.mixed, ["60%", "20%", "20%"]);
    assert.deepEqual(allocation.bondsOnly, ["0%", "0%", "100%"]);
    assert.equal(allocation.sgDisabled, true);

    // 18. Phase 1-5 regressions: Stacked NW keyboard nav (no TypeError), Trajectory Inspector non-zero balances, lump-sum Rebalance preserves #known-savings, and Expense modal remove button role
    const phaseRegRes = await browser.evaluate(`(() => {
      // (a) Stacked Net Worth chart keyboard nav on Overview
      document.querySelector('[data-destination="overview"]')?.click();
      const nwChart = document.getElementById("dash-networth-chart");
      nwChart?.focus();
      nwChart?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      const nwSr = document.getElementById("sr-status")?.textContent || "";

      // (b) Trajectory Year Inspector on working-age year (step +1 to age+1 so balances are non-zero)
      document.querySelector('[data-tab="trajectory"]')?.click();
      const trajRow =
        document.querySelector('#trajectory-values tr[data-inspect-age]') ||
        document.querySelector('tr[data-inspect-age]');
      trajRow?.click();
      document.querySelector('[data-inspect-step="1"]')?.click();
      const inspText = document.getElementById("trajectory-year-inspector")?.textContent || "";

      // (c) Lump-sum #known-savings + Rebalance preserves total instead of wiping to $0
      document.querySelector('[data-destination="overview"]')?.click();
      const savEl = document.getElementById("known-savings");
      for (const id of ["known-equities", "known-sg-dividends", "known-ssb-cash", "known-srs"]) {
        const el = document.getElementById(id);
        if (el) el.value = "";
      }
      if (savEl) {
        savEl.value = "150000";
        savEl.dispatchEvent(new Event("input", { bubbles: true }));
      }
      document.getElementById("known-target-equity").value = "90";
      document.getElementById("known-target-equity").dispatchEvent(new Event("input", { bubbles: true }));
      const rebBtn = document.querySelector('[data-money-move="rebalance-portfolio"]');
      let afterRebTotal = null;
      if (rebBtn) {
        rebBtn.click();
        afterRebTotal = Number(document.getElementById("known-savings")?.value || 0);
      }

      // (d) Expense modal remove button does not carry role="cell"
      const budgetBtn = document.querySelector('[data-quick-edit="budget"]');
      budgetBtn?.click();
      document.querySelector('[data-exp-enter-custom]')?.click();
      document.querySelector('[data-exp-custom-mode="itemized"]')?.click();
      const removeBtn = document.querySelector(".exp-remove-btn");
      const removeRole = removeBtn ? removeBtn.getAttribute("role") : "missing";
      document.getElementById("exp-dialog")?.close();

      return {
        nwSrOk: nwSr.includes("Age") && nwSr.includes("total net worth"),
        inspText,
        inspOk:
          inspText.includes("Audit Breakdown") &&
          inspText.includes("Accumulating") &&
          !inspText.includes("OA $0 · SA $0 · MA $0") &&
          !inspText.includes("Equities $0"),
        afterRebTotal,
        removeRole,
      };
    })()`);
    assert.equal(
      phaseRegRes.nwSrOk,
      true,
      "Stacked Net Worth chart keyboard ArrowRight must update #sr-status without throwing",
    );
    assert.equal(
      phaseRegRes.inspOk,
      true,
      `Trajectory Year Inspector must render Audit Breakdown with non-zero CPF balances (got: ${phaseRegRes.inspText})`,
    );
    if (phaseRegRes.afterRebTotal != null) {
      assert.ok(
        Math.abs(phaseRegRes.afterRebTotal - 150000) <= 5,
        `Rebalance on lump-sum $150,000 must preserve total (~$150,000), got $${phaseRegRes.afterRebTotal}`,
      );
    }
    assert.equal(
      phaseRegRes.removeRole,
      null,
      "Expense modal remove <button> must not override its button role with role='cell'",
    );

    // 19. Phase 2 UI regressions: dynamic srsZeroTaxCap in 4-Tap SRS UI, Money Moves srsAge: 64 & 0% rate safety, and Print Sheet basis === "nominal" consistency
    const phase2UiRes = await browser.evaluate(`(() => {
      document.querySelector('[data-destination="overview"]')?.click();
      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.value = String(val);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      };

      // (a) Dynamic srsZeroTaxCap in Overview 4-Tap SRS card & aria-label (5% global return => ~$309k, not $400k)
      setVal("known-return", "0.05");
      setVal("known-srs", 100000);
      setVal("known-srs-annual", 10000);
      setVal("known-srs-invested", "global");
      const tapsCard = document.getElementById("retirement-taps-card");
      const tapsText = tapsCard?.textContent || "";
      const tap2Aria =
        tapsCard?.querySelector('[aria-label*="SRS pot toward"]')?.getAttribute("aria-label") || "";

      // (b) Money Moves srsAge: 64 shows "until age 64" (not "until age 63")
      setVal("known-srs-age", "64");
      setVal("known-srs-invested", "cash");
      const movesTextAge64 = document.getElementById("overview-slot")?.textContent || "";

      // (c) Money Moves 0% return rate & 0% cash rate safety (no falsy-zero || fallback)
      setVal("known-srs-invested", "global");
      setVal("known-srs", 0);
      setVal("known-srs-annual", 0);
      setVal("known-savings", "");
      setVal("known-equities", 0);
      setVal("known-sg-dividends", 0);
      setVal("known-ssb-cash", 120000);
      setVal("known-target-equity", 80);
      setVal("known-return", "0.05");
      setVal("known-cash-return", "0");
      const extractRebBoost = () => {
        const btn = document.querySelector('[data-money-move="rebalance-portfolio"]');
        const cardText = btn?.closest(".fin-move-row")?.textContent || "";
        const m = cardText.match(/\\+\\$([\\d,]+)\\/yr/);
        return m ? Number(m[1].replace(/,/g, "")) : null;
      };
      const boostZeroCash = extractRebBoost();
      setVal("known-cash-return", "2.39");
      const boostDefaultCash = extractRebBoost();
      setVal("known-return", "0");
      const boostZeroReturn = extractRebBoost();

      return {
        tapsText,
        tap2Aria,
        movesTextAge64,
        boostZeroCash,
        boostDefaultCash,
        boostZeroReturn,
      };
    })()`);
    assert.ok(
      phase2UiRes.tapsText.includes("$309k") &&
        !phase2UiRes.tapsText.includes("vs $400k") &&
        !phase2UiRes.tapsText.includes("≤$400k"),
      `Overview 4-Tap SRS card must display dynamic srsZeroTaxCap ($309k) instead of hardcoded $400k`,
    );
    assert.ok(
      phase2UiRes.tap2Aria.includes("$308,869") &&
        !phase2UiRes.tap2Aria.includes("$400,000"),
      `Tap 2 progressbar aria-label must reflect dynamic srsZeroTaxCap, got: ${phase2UiRes.tap2Aria}`,
    );
    assert.ok(
      phase2UiRes.movesTextAge64.includes("until age 64") &&
        !phase2UiRes.movesTextAge64.includes("until age 63"),
      "Money Moves idle SRS cash card must interpolate srsStartAge (age 64), not hardcoded age 63",
    );
    assert.ok(
      phase2UiRes.boostZeroCash != null &&
        phase2UiRes.boostDefaultCash != null &&
        phase2UiRes.boostZeroReturn != null,
      `Expected rebalance boost numbers for 0% rate checks, got ${JSON.stringify(phase2UiRes)}`,
    );
    assert.ok(
      phase2UiRes.boostZeroCash > phase2UiRes.boostDefaultCash * 1.5,
      `0% cash rate must not fall back to 2.39% (boostZeroCash=${phase2UiRes.boostZeroCash} vs boostDefaultCash=${phase2UiRes.boostDefaultCash})`,
    );
    assert.ok(
      phase2UiRes.boostZeroReturn < phase2UiRes.boostDefaultCash,
      `0% equity return rate must not fall back to 5% (boostZeroReturn=${phase2UiRes.boostZeroReturn} vs boostDefaultCash=${phase2UiRes.boostDefaultCash})`,
    );

    // (d) Print Sheet basis === "nominal" consistency via dev ESM import in live DOM
    const { server: devServer, baseUrl: devBaseUrl } =
      await startStaticServer(__dirname);
    try {
      await browser.navigate(`${devBaseUrl}/index.html`);
      await new Promise((r) => setTimeout(r, 250));
      const printNominalRes = await browser.evaluate(`(async () => {
        const { renderPrintSheet } = await import("/src/app/print-sheet.js");
        const { getMilestoneNodes, buildFundingSourcesList } = await import("/src/app/views-overview.js");
        const M = window.RetirementModel;
        const p = {
          ...M.SG_DEFAULT_PLAN,
          age: 35,
          retire: 65,
          salary: 9000,
          srs: 80000,
          srsAnnual: 10000,
          srsInvestedIn: "global",
        };
        const solved = M.solveBucketAwareSimulation(p, "frs");
        const r = M.todayPlan(solved.summary);
        const s = M.todayPlan({ ...solved.summary, scenarios: [solved.simulation.selectedScenario] }).scenarios[0];
        const bogle = M.bogleheadAllocation(p, solved.simulation.invest);
        const tax = M.taxSweetSpot(p, solved.summary);
        const guide = M.outsideAllocationGuide(r, solved.simulation);
        const basePayload = {
          r,
          s,
          simulation: solved.simulation,
          fire: solved.fire,
          bogle,
          tax,
          guide,
          p,
        };
        renderPrintSheet({ ...basePayload, basis: "today" });
        const todaySourcesText = document.querySelector("#print-sheet .poster-source-list")?.textContent || "";
        const todayMilestones = getMilestoneNodes(solved.fire, r, s, solved.simulation, "today");

        renderPrintSheet({ ...basePayload, basis: "nominal" });
        const nominalSourcesText = document.querySelector("#print-sheet .poster-source-list")?.textContent || "";
        const nominalHeaderText = document.querySelector("#print-sheet .poster-strategy-panel")?.textContent || "";
        const nominalMilestones = getMilestoneNodes(solved.fire, r, s, solved.simulation, "nominal");
        const pmNom = M.buildPrintReportModel({
          summary: r,
          selectedScenario: s,
          simulation: solved.simulation,
          fire: solved.fire,
          bogle,
          tax,
          guide,
          params: p,
          basis: "nominal",
        });
        const { fundingSources: nomFs } = buildFundingSourcesList(pmNom.taps, r, s, pmNom.cpfCovPct, "nominal");
        const { fundingSources: todFs } = buildFundingSourcesList(pmNom.taps, r, s, pmNom.cpfCovPct, "today");
        const parseFirstDollar = (str) => {
          const plain = String(str || "").replace(/<[^>]+>/g, "");
          const m = plain.match(/\\$([\\d,]+)/);
          return m ? Number(m[1].replace(/,/g, "")) : 0;
        };

        // 4-combination (r.moneyBasis x basis) parity: raw nominal solved.summary vs M.todayPlan(solved.summary)
        const p4 = {
          ...M.SG_DEFAULT_PLAN,
          age: 35,
          retire: 60,
          salary: 9000,
          oa: 100000,
          sa: 80000,
          ma: 50000,
          investments: 150000,
          ssbCash: 60000,
          srs: 20000,
          srsAnnual: 3000,
          srsInvestedIn: "global",
          inflation: 0.025,
          returnRate: 0.055,
          cashSaving: 500,
          invest: 2000,
        };
        const solved4 = M.solveBucketAwareSimulation(p4, "frs");
        const rNom4 = solved4.summary;
        const sNom4 = solved4.simulation.selectedScenario;
        const rTod4 = M.todayPlan(rNom4);
        const sTod4 = M.todayPlan({ ...rNom4, scenarios: [sNom4] }).scenarios[0];
        const bogle4 = M.bogleheadAllocation(p4, solved4.simulation.invest);
        const tax4 = M.taxSweetSpot(p4, rNom4);
        const guideNom4 = M.outsideAllocationGuide(rNom4, solved4.simulation);
        const guideTod4 = M.outsideAllocationGuide(rTod4, solved4.simulation);

        const runCombo = (rIn, sIn, guideIn, basisVal) => {
          const pm = M.buildPrintReportModel({
            summary: rIn,
            selectedScenario: sIn,
            simulation: solved4.simulation,
            fire: solved4.fire,
            bogle: bogle4,
            tax: tax4,
            guide: guideIn,
            params: p4,
            basis: basisVal,
          });
          const milestones = getMilestoneNodes(
            solved4.fire,
            rIn,
            sIn,
            solved4.simulation,
            basisVal,
          ).map((x) => ({ badge: x.badge, metric: x.metric, sub: x.sub }));
          const sources = buildFundingSourcesList(
            pm.taps,
            rIn,
            sIn,
            pm.cpfCovPct,
            basisVal,
          ).fundingSources.map((x) => ({ name: x.name, count: x.count, score: x.score }));
          renderPrintSheet({
            r: rIn,
            s: sIn,
            simulation: solved4.simulation,
            fire: solved4.fire,
            bogle: bogle4,
            tax: tax4,
            guide: guideIn,
            p: p4,
            basis: basisVal,
          });
          const printBudgetHeader =
            document.querySelector("#print-sheet .poster-budget-panel .poster-panel-head small")
              ?.textContent || "";
          const printSourcesText =
            document.querySelector("#print-sheet .poster-source-list")?.textContent || "";
          const printStrategyRows = Array.from(
            document.querySelectorAll("#print-sheet .poster-mini-table tbody tr"),
          ).map((tr) => tr.textContent.replace(/\\s+/g, " ").trim());
          return { milestones, sources, printBudgetHeader, printSourcesText, printStrategyRows };
        };

        const comboTodayFromToday = runCombo(rTod4, sTod4, guideTod4, "today");
        const comboTodayFromNom = runCombo(rNom4, sNom4, guideNom4, "today");
        const comboNomFromToday = runCombo(rTod4, sTod4, guideTod4, "nominal");
        const comboNomFromNom = runCombo(rNom4, sNom4, guideNom4, "nominal");

        return {
          todayHasTodaysDollar: todaySourcesText.includes("(today’s $)"),
          nominalHasTodaysDollar: nominalSourcesText.includes("(today’s $)"),
          nominalHasHeader: nominalHeaderText.includes("Future Nominal $"),
          todayRetMetric: parseFirstDollar(todayMilestones[2].metric),
          nominalRetMetric: parseFirstDollar(nominalMilestones[2].metric),
          todayTap1Payout: parseFirstDollar(todFs[0].count),
          nominalTap1Payout: parseFirstDollar(nomFs[0].count),
          todayTap2Draw: parseFirstDollar(todFs[1].count),
          nominalTap2Draw: parseFirstDollar(nomFs[1].count),
          comboTodayFromToday,
          comboTodayFromNom,
          comboNomFromToday,
          comboNomFromNom,
        };
      })()`);
      assert.equal(
        printNominalRes.todayHasTodaysDollar,
        true,
        "Print Sheet in today basis should label Tap 2 SRS draw with (today’s $)",
      );
      assert.equal(
        printNominalRes.nominalHasTodaysDollar,
        false,
        "Print Sheet in nominal basis must NOT render (today’s $) in Tap 2 SRS funding source",
      );
      assert.equal(
        printNominalRes.nominalHasHeader,
        true,
        "Print Sheet in nominal basis must display Future Nominal $ header",
      );
      assert.ok(
        printNominalRes.nominalRetMetric > printNominalRes.todayRetMetric,
        `Nominal retirement milestone net worth (${printNominalRes.nominalRetMetric}) must exceed today's $ (${printNominalRes.todayRetMetric})`,
      );
      assert.ok(
        printNominalRes.nominalTap1Payout > printNominalRes.todayTap1Payout,
        `Nominal Tap 1 CPF LIFE payout (${printNominalRes.nominalTap1Payout}) must exceed today's $ (${printNominalRes.todayTap1Payout})`,
      );
      assert.ok(
        printNominalRes.nominalTap2Draw > printNominalRes.todayTap2Draw,
        `Nominal Tap 2 SRS draw (${printNominalRes.nominalTap2Draw}) must exceed today's $ (${printNominalRes.todayTap2Draw})`,
      );
      assert.deepEqual(
        printNominalRes.comboTodayFromNom,
        printNominalRes.comboTodayFromToday,
        "basis='today' outputs must match whether r/s come from raw nominal solved.summary or todayPlan(solved.summary)",
      );
      assert.deepEqual(
        printNominalRes.comboNomFromNom,
        printNominalRes.comboNomFromToday,
        "basis='nominal' outputs must match whether r/s come from raw nominal solved.summary or todayPlan(solved.summary)",
      );
      assert.notEqual(
        printNominalRes.comboNomFromNom.printBudgetHeader,
        printNominalRes.comboTodayFromNom.printBudgetHeader,
        "Print Sheet budget header must differ between basis='nominal' and basis='today' when inflation > 0",
      );

      // 20. Phase 3 regressions: Mobile responsive SVG viewBox (< 520px), compactPrint guard,
      // collapsible #retirement-taps-card hash-routing & h3 heading, 320px tick legibility,
      // resize 520->1280 sync, table <caption> + .num-col, and clean aria-labels
      await browser.send("Emulation.setDeviceMetricsOverride", {
        width: 375,
        height: 812,
        deviceScaleFactor: 2,
        mobile: true,
      });
      await browser.evaluate(`(() => {
        window.dispatchEvent(new Event("resize"));
      })()`);
      await new Promise((r) => setTimeout(r, 250));
      const m3Res = await browser.evaluate(`(() => {
        const dashSvg = document.querySelector("#dash-networth-chart svg");
        const dashVb = (dashSvg?.getAttribute("viewBox") || "").split(/\\s+/).map(Number);
        const printNwSvg = document.querySelector("#print-nw-chart svg");
        const printNwVb = (printNwSvg?.getAttribute("viewBox") || "").split(/\\s+/).map(Number);
        const chartArea = document.querySelector("#dash-networth-chart");
        const chartMinH = chartArea ? getComputedStyle(chartArea).minHeight : "";
        const tapsEl = document.getElementById("retirement-taps-card");
        const tapsTag = tapsEl?.tagName || "";
        const tapsHeading = Boolean(
          tapsEl?.querySelector("summary h2#taps-blueprint-title"),
        );
        if (tapsEl && tapsEl.tagName === "DETAILS") tapsEl.open = false;
        location.hash = "#retirement-taps-card";
        window.dispatchEvent(new HashChangeEvent("hashchange"));
        const tapsOpenedByHash = Boolean(tapsEl?.open);
        const finTable = document.querySelector("#cpf-strategy-slot .fin-table");
        const finCaption = Boolean(finTable?.querySelector("caption"));
        const finNumCols = finTable?.querySelectorAll("thead th.num-col").length || 0;
        const printTable = document.querySelector("#print-sheet .poster-mini-table");
        const printCaption = Boolean(printTable?.querySelector("caption"));
        const printNumCols = printTable?.querySelectorAll("thead th.num-col").length || 0;
        const badAria = Array.from(document.querySelectorAll("[aria-label]")).some((el) =>
          (el.getAttribute("aria-label") || "").includes("curr-wrap"),
        );
        return {
          dashVbW: dashVb[2] || 0,
          printNwVbW: printNwVb[2] || 0,
          chartMinH,
          tapsTag,
          tapsHeading,
          tapsOpenedByHash,
          finCaption,
          finNumCols,
          printCaption,
          printNumCols,
          badAria,
        };
      })()`);

      // Narrow 320x568 viewport check: viewBox in [240, 520) and effective tick font >= 8.5px
      await browser.send("Emulation.setDeviceMetricsOverride", {
        width: 320,
        height: 568,
        deviceScaleFactor: 2,
        mobile: true,
      });
      await browser.evaluate(`(() => {
        window.dispatchEvent(new Event("resize"));
      })()`);
      await new Promise((r) => setTimeout(r, 250));
      const m3NarrowRes = await browser.evaluate(`(() => {
        const dashSvg = document.querySelector("#dash-networth-chart svg");
        const dashVb = (dashSvg?.getAttribute("viewBox") || "").split(/\\s+/).map(Number);
        const vbW = dashVb[2] || 0;
        const rectW = dashSvg?.getBoundingClientRect().width || 0;
        const scale = vbW > 0 ? rectW / vbW : 0;
        const tickSizes = Array.from(dashSvg?.querySelectorAll("text[font-size]") || [])
          .map((t) => Number(t.getAttribute("font-size")) * scale)
          .filter((n) => Number.isFinite(n) && n > 0)
          .sort((a, b) => a - b);
        const medianTickPx = tickSizes.length
          ? tickSizes[Math.floor(tickSizes.length / 2)]
          : 0;
        return { vbW, medianTickPx };
      })()`);

      // Resize transition 520x812 -> 1280x900 on Trajectory tab must update #trajectory-chart to desktop
      await browser.send("Emulation.setDeviceMetricsOverride", {
        width: 520,
        height: 812,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await browser.evaluate(`(() => {
        document.querySelector('[data-tab="trajectory"]')?.click();
        window.dispatchEvent(new Event("resize"));
      })()`);
      await new Promise((r) => setTimeout(r, 250));
      const trajAt520W = await browser.evaluate(`(() => {
        const svg = document.querySelector("#trajectory-chart svg");
        const vb = (svg?.getAttribute("viewBox") || "").split(/\\s+/).map(Number);
        return vb[2] || 0;
      })()`);
      await browser.send("Emulation.setDeviceMetricsOverride", {
        width: 1280,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await browser.evaluate(`(() => {
        window.dispatchEvent(new Event("resize"));
      })()`);
      await new Promise((r) => setTimeout(r, 250));
      const trajAt1280W = await browser.evaluate(`(() => {
        const svg = document.querySelector("#trajectory-chart svg");
        const vb = (svg?.getAttribute("viewBox") || "").split(/\\s+/).map(Number);
        return vb[2] || 0;
      })()`);
      await browser.send("Emulation.clearDeviceMetricsOverride");
      assert.ok(
        m3Res.dashVbW >= 240 && m3Res.dashVbW < 520,
        `Mobile #dash-networth-chart viewBox width must be in [240, 520), got ${m3Res.dashVbW}`,
      );
      assert.ok(
        m3NarrowRes.vbW >= 240 && m3NarrowRes.vbW < 520,
        `320x568 #dash-networth-chart viewBox width must be in [240, 520), got ${m3NarrowRes.vbW}`,
      );
      assert.ok(
        m3NarrowRes.medianTickPx >= 8.5,
        `320x568 #dash-networth-chart effective median tick font must be >= 8.5px, got ${m3NarrowRes.medianTickPx.toFixed(2)}px`,
      );
      assert.ok(
        trajAt520W >= 240 && trajAt520W < 520,
        `520x812 #trajectory-chart viewBox width should be mobile (< 520), got ${trajAt520W}`,
      );
      assert.ok(
        trajAt1280W >= 760,
        `Resize 520x812 -> 1280x900 must update #trajectory-chart viewBox width to desktop (>= 760), got ${trajAt1280W}`,
      );
      assert.equal(
        m3Res.printNwVbW,
        680,
        "Print sheet #print-nw-chart (compactPrint: true) must retain desktop 680 viewBox width on mobile",
      );
      assert.equal(
        m3Res.chartMinH,
        "0px",
        `Mobile .chart-area min-height should be 0px, got ${m3Res.chartMinH}`,
      );
      assert.equal(
        m3Res.tapsTag,
        "DETAILS",
        "#retirement-taps-card should be a <details> disclosure",
      );
      assert.equal(
        m3Res.tapsHeading,
        true,
        "The income sources disclosure must use its section heading as the toggle",
      );
      assert.equal(
        m3Res.tapsOpenedByHash,
        true,
        "Hash navigation to #retirement-taps-card must auto-open the <details> disclosure",
      );
      assert.equal(
        m3Res.finCaption,
        true,
        "CPF Milestones path table must have a <caption>",
      );
      assert.equal(
        m3Res.finNumCols,
        4,
        "CPF Milestones path table must have 4 numeric .num-col headers",
      );
      assert.equal(
        m3Res.printCaption,
        true,
        "Print Sheet table must have a <caption>",
      );
      assert.equal(
        m3Res.printNumCols,
        4,
        "Print Sheet table must have 4 numeric .num-col headers",
      );
      assert.equal(
        m3Res.badAria,
        false,
        "No aria-label may contain raw curr-wrap HTML",
      );

      // An explicitly custom budget can have the same total as the preset.
      await browser.navigate(
        `${devBaseUrl}/?test=budget-mode#version=3&lifestyle=cca&spend=2800&expMode=figure`,
      );
      const budgetMenu = await browser.evaluate(`(() => {
        const readMenu = () => ({
          label: document.querySelector("#exp-card-dropdown-label").textContent,
          selected: [...document.querySelectorAll("#exp-card-dropdown-menu [aria-checked=true] strong")]
            .map((option) => option.textContent),
          total: document.querySelector(".overview-budget-total").textContent,
        });
        document.querySelector("#exp-card-dropdown-btn").click();
        const custom = readMenu();
        document.querySelector('#exp-card-dropdown-menu [data-switch-lifestyle="cca"]').click();
        return { custom, preset: readMenu() };
      })()`);
      assert.equal(budgetMenu.custom.label, "Custom budget");
      assert.deepEqual(budgetMenu.custom.selected, ["Custom"]);
      assert.equal(budgetMenu.preset.label, "Community Care Apartments");
      assert.deepEqual(budgetMenu.preset.selected, [
        "Community Care Apartments",
      ]);
      assert.match(budgetMenu.custom.total, /\$2,800/);
      assert.equal(budgetMenu.custom.total, budgetMenu.preset.total);

      // Phase 4 (F16): XSS regression test across custom expenses, cash accounts, URL hash, search, and print sheet
      const xssPayload = "<img src=x onerror=window.__xss=1>";
      const xssSearch = "<img src=x onerror=window.__xss=2>";
      const xssExpItems = JSON.stringify([
        [xssPayload, "food", 1800],
        ["Utilities & WiFi", "housing", 500],
      ]);
      const xssCashItems = JSON.stringify([
        ["custom", xssPayload, 150000, 100000, 3.0, 0.05],
      ]);
      const xssHash =
        "#version=3&lifestyle=cca&salary=6000&spend=2300&expMode=itemized&expItems=" +
        encodeURIComponent(xssExpItems) +
        "&cashMode=itemized&cashItems=" +
        encodeURIComponent(xssCashItems);
      await browser.navigate(`${devBaseUrl}/${xssHash}`);
      await new Promise((r) => setTimeout(r, 250));

      const xssCheck = await browser.evaluate(`(async () => {
        const payload = ${JSON.stringify(xssPayload)};
        const searchPayload = ${JSON.stringify(xssSearch)};
        document.querySelector("#section-budget").click();
        const overviewChipText = document.querySelector("#budget-slot #exp-preview-slot")?.textContent || "";

        // Open custom expense modal to verify editable rows
        document.querySelector('#exp-card-dropdown-btn')?.click();
        document.querySelector('[data-select-custom]')?.click();
        await new Promise((r) => setTimeout(r, 120));
        const expNameVal = document.querySelector('#exp-items-body input[data-exp-field="name"]')?.value || "";
        document.querySelector('#expense-modal')?.close();

        // Check the editor in Cash accounts and the search empty state in Cash options.
        document.querySelector('#section-cash-accounts').click();
        await new Promise((r) => setTimeout(r, 150));
        const cashNameVal = document.querySelector('#cash-accounts input[data-cash-acc-field="name"]')?.value || "";
        const cashAlertText = document.querySelector('#cash-acc-alerts-page')?.textContent || "";
        document.querySelector('#section-cash-parking').click();
        const searchInput = document.querySelector('#cash-search-input');
        if (searchInput) {
          searchInput.value = searchPayload;
          searchInput.dispatchEvent(new Event("input", { bubbles: true }));
        }
        await new Promise((r) => setTimeout(r, 120));
        const cashEmptyText = document.querySelector('.cash-empty-state')?.textContent || "";

        // Trigger print sheet render
        window.dispatchEvent(new Event("beforeprint"));
        await new Promise((r) => setTimeout(r, 120));
        const printSheetReady = Boolean(document.querySelector('#print-sheet .poster-sheet'));

        return {
          xssGlobal: window.__xss,
          injectedImgs: document.querySelectorAll('img[src="x"]').length,
          overviewHasLiteral: overviewChipText.includes(payload),
          expModalHasLiteral: expNameVal === payload,
          cashNameHasLiteral: cashNameVal === payload,
          cashAlertHasLiteral: cashAlertText.includes(payload),
          cashSearchHasLiteral: cashEmptyText.includes(searchPayload),
          printSheetReady,
        };
      })()`);

      assert.equal(
        xssCheck.xssGlobal,
        undefined,
        "XSS payload must NEVER execute",
      );
      assert.equal(
        xssCheck.injectedImgs,
        0,
        "XSS payload must NEVER inject an <img> element into the DOM",
      );
      assert.equal(
        xssCheck.overviewHasLiteral,
        true,
        "Overview expense chip must render escaped literal payload text",
      );
      assert.equal(
        xssCheck.expModalHasLiteral,
        true,
        "Expense modal input must preserve literal payload value",
      );
      assert.equal(
        xssCheck.cashNameHasLiteral,
        true,
        "Cash Parking account input must preserve literal payload value",
      );
      assert.equal(
        xssCheck.cashAlertHasLiteral,
        true,
        "Cash Parking overflow alert must render escaped literal payload text",
      );
      assert.equal(
        xssCheck.cashSearchHasLiteral,
        true,
        "Cash Parking empty-search state must render escaped literal payload text",
      );
      assert.equal(
        xssCheck.printSheetReady,
        true,
        "Print sheet must render cleanly with XSS payloads in state",
      );

      // Allocation must show the monthly SRS deduction from the investment pool.
      await browser.navigate(
        `${devBaseUrl}/#version=3&salary=8000&invest=2500&srs=15300`,
      );
      await new Promise((r) => setTimeout(r, 200));
      const allocationSrsCheck = await browser.evaluate(`(async () => {
        const srsEl = document.querySelector('#known-srs-annual');
        if (srsEl) {
          srsEl.value = '15300';
          srsEl.dispatchEvent(new Event('input', { bubbles: true }));
        }
        const invEl = document.querySelector('#known-invest');
        if (invEl) {
          invEl.value = '2500';
          invEl.dispatchEvent(new Event('input', { bubbles: true }));
        }
        await new Promise((r) => setTimeout(r, 120));
        document.querySelector('#section-allocator').click();
        await new Promise((r) => setTimeout(r, 120));
        return [...document.querySelectorAll('.allocator-paycheck-detail')]
          .find((row) => row.querySelector('dt')?.textContent === 'Allocated to SRS')
          ?.querySelector('dd')?.textContent;
      })()`);
      assert.equal(allocationSrsCheck, "$1,275/mo");

      // Tier 5 (Fix 1): Cash Parking overflow-suppression UI regression test when baseRatePct >= ssbBenchmarkPct
      const highBaseCashItems = JSON.stringify([
        ["custom", "HighBase Bank", 120000, 50000, 4.0, 5.0],
      ]);
      await browser.navigate(
        `${devBaseUrl}/?t=t5-cash#version=3&lifestyle=cca&salary=6000&cashMode=itemized&cashItems=${encodeURIComponent(highBaseCashItems)}`,
      );
      for (let i = 0; i < 60; i++) {
        const loaded = await browser.evaluate(
          'location.search === "?t=t5-cash" && document.readyState === "complete" && Boolean(document.querySelector("#overview-slot .overview-verdict"))',
        );
        if (loaded) break;
        await new Promise((r) => setTimeout(r, 100));
      }
      await new Promise((r) => setTimeout(r, 150));
      const highBaseCheck = await browser.evaluate(`(async () => {
        document.querySelector("#section-cash-accounts").click();
        await new Promise((r) => setTimeout(r, 150));
        const summaryText = (document.querySelector('#cash-acc-summary-page')?.textContent || '').replace(/\\s+/g, ' ').trim();
        const alertsText = (document.querySelector('#cash-acc-alerts-page')?.textContent || '').replace(/\\s+/g, ' ').trim();
        return { summaryText, alertsText };
      })()`);
      assert.ok(
        highBaseCheck.summaryText.length > 0,
        "Cash Accounts summary should render for custom HighBase Bank account",
      );
      for (const forbidden of [
        "Bonus Cap Overflow Detected",
        "dragging account EIR",
        "Dragged down by",
        "Sweep adds +$0/yr",
      ]) {
        assert.ok(
          !highBaseCheck.summaryText.includes(forbidden) &&
            !highBaseCheck.alertsText.includes(forbidden),
          `HighBase Bank (baseRatePct >= SSB, sweepAnnualGain === 0) must not show "${forbidden}", got summary="${highBaseCheck.summaryText}" alerts="${highBaseCheck.alertsText}"`,
        );
      }
      assert.ok(
        highBaseCheck.alertsText.includes("SDIC"),
        `HighBase Bank ($120k) should still show SDIC notice, got: ${highBaseCheck.alertsText}`,
      );

      const groupedMoney = await browser.evaluate(`(() => {
        const balance = document.querySelector("[data-cash-acc-field=balance]");
        const initial = balance.value;
        balance.focus();
        const set = (value, type) => {
          balance.value = value;
          balance.dispatchEvent(new Event(type, { bubbles: true }));
        };
        set("120,123.45", "input");
        set("", "input");
        set("120,12.45", "input");
        set("120,12.45", "change");
        return { initial, displayed: balance.value, stored: document.querySelector("#known-ssb-cash").value };
      })()`);
      assert.deepEqual(groupedMoney, {
        initial: "120,000",
        displayed: "120,123.45",
        stored: "120123.45",
      });

      // Tier 5 (Fix 2): Mobile 4-milestone SVG pill non-overlap regression test across chart modes + compactPrint invariant
      await browser.navigate(
        `${devBaseUrl}/?t=t5-charts#version=3&lifestyle=cca&age=35&retire=60&salary=8000&srs=15300&srsAge=63`,
      );
      for (let i = 0; i < 60; i++) {
        const loaded = await browser.evaluate(
          'location.search === "?t=t5-charts" && document.readyState === "complete" && Boolean(document.querySelector("#overview-slot .overview-verdict"))',
        );
        if (loaded) break;
        await new Promise((r) => setTimeout(r, 100));
      }
      await new Promise((r) => setTimeout(r, 150));
      for (const vp of [
        { width: 375, height: 812 },
        { width: 320, height: 568 },
      ]) {
        await browser.send("Emulation.setDeviceMetricsOverride", {
          width: vp.width,
          height: vp.height,
          deviceScaleFactor: 2,
          mobile: true,
        });
        await browser.evaluate(`(() => {
          document.querySelector('[data-tab="trajectory"]')?.click();
          window.dispatchEvent(new Event("resize"));
        })()`);
        await new Promise((r) => setTimeout(r, 250));
        const pillCheck = await browser.evaluate(`(async () => {
          const checkSvg = (svg) => {
            const rects = Array.from(svg?.querySelectorAll(".nw-milestone-flag rect") || []).map((r) => ({
              x: Number(r.getAttribute("x")),
              y: Number(r.getAttribute("y")),
              w: Number(r.getAttribute("width")),
              h: Number(r.getAttribute("height")),
            }));
            const overlaps = [];
            for (let i = 0; i < rects.length; i++) {
              for (let j = i + 1; j < rects.length; j++) {
                const a = rects[i], b = rects[j];
                const hit = !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
                if (hit) overlaps.push([i, j, a, b]);
              }
            }
            return { count: rects.length, overlaps };
          };
          const modes = {};
          for (const mode of ["networth", "waterfall", "cashflow", "portfolio"]) {
            document.querySelector('[data-chart-mode="' + mode + '"]')?.click();
            await new Promise((r) => setTimeout(r, 100));
            modes[mode] = checkSvg(document.querySelector("#trajectory-chart svg"));
          }
          window.dispatchEvent(new Event("beforeprint"));
          await new Promise((r) => setTimeout(r, 120));
          const printVb = document.querySelector("#print-nw-chart svg")?.getAttribute("viewBox") || "";
          return { modes, printVb };
        })()`);
        for (const mode of ["networth", "waterfall", "cashflow", "portfolio"]) {
          assert.ok(
            pillCheck.modes[mode].count >= 4,
            `${vp.width}x${vp.height} ${mode} chart should render >= 4 milestone pills, got ${pillCheck.modes[mode].count}`,
          );
          assert.equal(
            pillCheck.modes[mode].overlaps.length,
            0,
            `${vp.width}x${vp.height} ${mode} chart must have 0 milestone pill overlaps, got ${JSON.stringify(pillCheck.modes[mode].overlaps)}`,
          );
        }
        assert.equal(
          pillCheck.printVb,
          "0 0 680 176",
          `${vp.width}x${vp.height} compactPrint #print-nw-chart must keep viewBox="0 0 680 176", got "${pillCheck.printVb}"`,
        );
      }
      await browser.send("Emulation.clearDeviceMetricsOverride");

      // Regression: deferred tab (CPF Milestones) must seed animation baselines on first visit
      // so the very first BRS/FRS/ERS toggle glides dynamically instead of snapping statically.
      await browser.navigate(`${devBaseUrl}/index.html`);
      await new Promise((r) => setTimeout(r, 250));
      const firstToggleMorph = await browser.evaluate(`(() => {
        document.querySelector('[data-tab="cpf-rules"]')?.click();
        const ersBtn = document.querySelector('#cpf-rules-slot button[data-learn="ers"]');
        if (!ersBtn) return { ok: false, reason: "no-ers-btn" };
        ersBtn.click();
        const targetEl = document.querySelector('#cpf-rules-slot [data-anim-key="lesson-target"]');
        const nomEl = document.querySelector('#cpf-rules-slot [data-anim-key="lesson-target-nom"]');
        return {
          ok: true,
          targetMorphing: Boolean(targetEl?.classList.contains("is-morphing")),
          nomMorphing: Boolean(nomEl?.classList.contains("is-morphing")),
        };
      })()`);
      assert.equal(
        firstToggleMorph.ok,
        true,
        `CPF Milestones tab should render ERS toggle button: ${JSON.stringify(firstToggleMorph)}`,
      );
      assert.equal(
        firstToggleMorph.targetMorphing,
        true,
        "First BRS/FRS/ERS toggle on deferred CPF Milestones tab must trigger dynamic number motion (is-morphing)",
      );
      assert.equal(
        firstToggleMorph.nomMorphing,
        true,
        "First BRS/FRS/ERS toggle must also animate nominal target (lesson-target-nom)",
      );

      // Regression: custom Calendar Date Picker (DD MMM YYYY + Day / Month / Decade popover)
      const dpCheck = await browser.evaluate(`(async () => {
        document.querySelector('[data-destination="overview"]')?.click();
        await new Promise((r) => setTimeout(r, 80));
        document.querySelector("#section-profile")?.click();
        document.querySelector('[data-settings-row="birth"] [data-settings-edit]')?.click();
        await new Promise((r) => setTimeout(r, 100));
        const dlgOpenBefore = !document.querySelector("#settings-editor-birth").hidden;
        const dispBefore = document.querySelector('#settings-draft-person-dob-display')?.value || "";
        const trig = document.querySelector('#top .dp-trigger-btn');
        trig?.click();
        const popOpen1 = Boolean(document.querySelector('.dp-popover'));
        // Switch to Decade/Year view -> pick 1988 -> pick Aug -> pick 15
        document.querySelector('.dp-popover [data-dp-mode="years"]')?.click();
        const decadeLabelBefore = document.querySelector('.dp-popover .dp-decade-label')?.textContent || "";
        if (!document.querySelector('.dp-popover [data-dp-year="1988"]')) {
          document.querySelector('.dp-popover [data-dp-nav="prev"]')?.click();
        }
        document.querySelector('.dp-popover [data-dp-year="1988"]')?.click();
        document.querySelector('.dp-popover [data-dp-month="7"]')?.click();
        document.querySelector('.dp-popover [data-dp-day="1988-08-15"]')?.click();
        await new Promise((r) => setTimeout(r, 80));
        const popClosedAfterPick = !document.querySelector('.dp-popover');
        const dispAfter = document.querySelector('#settings-draft-person-dob-display')?.value || "";
        // Verify Escape closes calendar popover without closing the date-of-birth editor
        trig?.click();
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
        const popClosedOnEsc = !document.querySelector('.dp-popover');
        const dlgStillOpen = !document.querySelector("#settings-editor-birth").hidden;
        document.querySelector("#settings-draft-person-dob-display").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
        const isoAfter = document.querySelector("#person-dob").value;
        document.querySelector('#destination-overview')?.click();
        return {
          dlgOpenBefore,
          dispBefore,
          popOpen1,
          decadeLabelBefore,
          popClosedAfterPick,
          isoAfter,
          dispAfter,
          popClosedOnEsc,
          dlgStillOpen,
        };
      })()`);
      assert.equal(
        dpCheck.dlgOpenBefore,
        true,
        "Settings date of birth editor should open",
      );
      assert.match(
        dpCheck.dispBefore,
        /^\d{2} [A-Z][a-z]{2} \d{4}$/,
        `Display input should use DD MMM YYYY format, got "${dpCheck.dispBefore}"`,
      );
      assert.equal(
        dpCheck.popOpen1,
        true,
        "Clicking calendar icon must open .dp-popover",
      );
      assert.equal(
        dpCheck.popClosedAfterPick,
        true,
        "Picking a day must close .dp-popover",
      );
      assert.equal(
        dpCheck.isoAfter,
        "1988-08-15",
        "Picking 15 Aug 1988 must update ISO #person-dob",
      );
      assert.equal(
        dpCheck.dispAfter,
        "15 Aug 1988",
        "Picking 15 Aug 1988 must display '15 Aug 1988'",
      );
      assert.equal(
        dpCheck.popClosedOnEsc,
        true,
        "Escape must close .dp-popover",
      );
      assert.equal(
        dpCheck.dlgStillOpen,
        true,
        "Escape on the calendar must keep the Settings editor open",
      );
    } finally {
      devServer.close();
    }

    await browser.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await browser.navigate(
      `${baseUrl}/?test=readiness#version=3&age=35&retire=65&lifestyle=cca&equities=650000`,
    );
    const readiness = await browser.evaluate(`(() => {
      const hero = document.querySelector(".overview-verdict");
      const funded = hero.querySelector(".overview-funded");
      const footer = [...hero.querySelectorAll(".overview-hero-summary .curr-num")];
      window.dispatchEvent(new Event("beforeprint"));
      return {
        earliestAge: hero.querySelector(".overview-hero-figure").textContent,
        ageLabel: hero.querySelector(".overview-safe-age").textContent,
        action: hero.querySelector(".overview-hero-actions button").textContent,
        fundingLabel: funded.previousElementSibling.textContent,
        funding: funded.textContent.trim(),
        sidebarFunding: document.querySelector("#nav-badge-overview").textContent,
        printFunding: document.querySelector("#print-sheet .fin-gauge-svg text").textContent,
        valueTops: footer.map((value) => value.getBoundingClientRect().top),
      };
    })()`);
    assert.equal(readiness.earliestAge, "Age 55");
    assert.match(readiness.ageLabel, /^Earliest projected retirement/);
    assert.equal(readiness.action, "Review retirement age");
    assert.equal(readiness.fundingLabel, "Funded at target age 65");
    assert.match(readiness.funding, /^\d+%$/);
    assert.ok(Number.parseInt(readiness.funding, 10) > 150);
    assert.equal(readiness.sidebarFunding, readiness.funding);
    assert.equal(readiness.printFunding, readiness.funding);
    assert.equal(readiness.valueTops.length, 3);
    assert.ok(
      Math.max(...readiness.valueTops) - Math.min(...readiness.valueTops) <= 1,
    );

    assert.deepEqual(
      browser.exceptions,
      [],
      `Unexpected uncaught page exceptions: ${browser.exceptions.join("; ")}`,
    );
  } finally {
    await browser.close();
    server.close();
  }
});
