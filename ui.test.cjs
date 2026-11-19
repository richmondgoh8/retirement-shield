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
        'document.readyState === "complete" && Boolean(document.querySelector("#overview-slot .fin-top-kpis"))',
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
    try {
      proc.kill("SIGKILL");
    } catch (_) {}
    fs.rmSync(userDataDir, { recursive: true, force: true });
  };

  return { send, evaluate, navigate, exceptions, close };
}

test("Browser UI smoke tests: 7 tabs, WAI-ARIA arrow keys, cashReturnRate reload, malformed #p= safety, modal Escape revert, Dividend badge plain text", async (t) => {
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

    // 1. All 7 workspace tabs switch cleanly without runtime errors
    const tabCount = await browser.evaluate(`(() => {
      const tabs = [...document.querySelectorAll('.sidebar-nav [role="tab"]')];
      for (const btn of tabs) btn.click();
      tabs[0]?.click();
      return tabs.length;
    })()`);
    assert.equal(tabCount, 7);

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

    // 5. Quick Edit modal Escape / cancel reverts unsaved salary edit
    const modalRevert = await browser.evaluate(`(() => {
      const trigger = document.querySelector('[data-quick-edit="salary"]');
      trigger.click();
      const dlg = document.querySelector('#quick-edit-modal');
      const qeSal = document.querySelector('#qe-salary');
      qeSal.value = '12345';
      qeSal.dispatchEvent(new Event('change', { bubbles: true }));
      const duringEdit = document.querySelector('#person-salary').value;
      dlg.dispatchEvent(new Event('cancel', { cancelable: true }));
      dlg.close('cancel');
      return {
        duringEdit,
        afterCancel: document.querySelector('#person-salary').value,
      };
    })()`);
    assert.equal(modalRevert.duringEdit, "12345");
    assert.equal(modalRevert.afterCancel, "9100");

    // 6. Dividend & Yield Target Monthly Income live edit renders plain text in #div-header-badge (no raw HTML)
    const divBadge = await browser.evaluate(`(() => {
      document.querySelector('.sidebar-nav [data-tab="dividend-calc"]').click();
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
      document.querySelector('.sidebar-nav [data-tab="overview"]').click();
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
      const trigger = document.querySelector('[data-quick-edit="invest"]');
      trigger?.click();
      const dlg = document.querySelector('#quick-edit-modal');
      const inv = document.querySelector('#qe-invest');
      inv.value = '-500';
      inv.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 60));
      const errVisible = !document.querySelector('#plan-error')?.hidden;
      dlg.close('done');
      await new Promise((r) => setTimeout(r, 60));
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
    const freshGradReturn = await browser.evaluate(`(() => {
      const btn = document.querySelector('[data-persona-preset="fresh-grad"]');
      btn?.click();
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
        ["custom", "<img src=x onerror=window.__xss=1>", 150000, 100000, 3, 0.05],
      ]),
    );
    await browser.navigate(
      `${baseUrl}/#version=3&lifestyle=cca&age=35&retire=65&salary=8000&cashMode=itemized&cashItems=${xssPayload}`,
    );
    await browser.evaluate(
      `document.querySelector('button[data-tab="cash-parking"]')?.click()`,
    );
    await new Promise((r) => setTimeout(r, 150));
    const xssCheck = await browser.evaluate(`({
      fired: Boolean(window.__xss),
      renderedHtml: document.querySelector('#cash-parking-slot')?.innerHTML || '',
    })`);
    assert.equal(xssCheck.fired, false, "Cash account names must be HTML-escaped");
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
