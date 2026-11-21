const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const sharp = require("sharp");

const manifest = JSON.parse(fs.readFileSync("dist/manifest.webmanifest"));

test("install assets have actual declared dimensions and maskable artwork is opaque", async () => {
  for (const icon of manifest.icons) {
    const file = path.join("dist", icon.src);
    const image = sharp(file);
    const meta = await image.metadata();
    assert.equal(`${meta.width}x${meta.height}`, icon.sizes);
    assert.equal(meta.format, "png");
    if (icon.purpose === "maskable") {
      assert.equal((await image.stats()).isOpaque, true);
    }
  }
  const apple = await sharp("dist/assets/apple-touch-icon.png").metadata();
  assert.equal(apple.width, 180);
  assert.equal(apple.height, 180);
  assert.equal(
    (await sharp("dist/assets/apple-touch-icon.png").stats()).isOpaque,
    true,
  );
});

test("manifest identity, scope, launch and shortcuts remain within the app", () => {
  const base = new URL("https://example.test/retirement-shield/");
  assert.equal(
    new URL(manifest.id, base).href,
    new URL(manifest.start_url, base).href,
  );
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.theme_color, "#f4f6fa");
  assert.equal(manifest.background_color, "#f4f6fa");
  assert.ok(
    manifest.icons.some(
      (icon) => icon.sizes === "192x192" && icon.purpose === "any",
    ),
  );
  assert.ok(
    manifest.icons.some(
      (icon) => icon.sizes === "512x512" && icon.purpose === "any",
    ),
  );
  for (const shortcut of manifest.shortcuts) {
    assert.ok(new URL(shortcut.url, base).href.startsWith(base.href));
  }
  for (const icon of manifest.icons) {
    assert.ok(new URL(icon.src, base).href.startsWith(base.href));
  }
  assert.equal(new URL(manifest.scope, base).href, base.href);
});

test("narrow PWA header keeps the update banner bounded", () => {
  const css = fs.readFileSync("styles.css", "utf8");
  assert.match(
    css,
    /@media \(max-width: 370px\)\s*\{[^]*?\.header-actions \.update-ready-button\s*\{[^]*?max-width:\s*112px;[^]*?min-width:\s*112px;/,
  );
});

test("Account, housing and profile inputs have one editor in Settings", () => {
  const html = fs.readFileSync("index.html", "utf8");
  const quickEdit = html
    .split('id="quick-edit-modal"')[1]
    .split("</dialog>")[0];
  assert.doesNotMatch(
    quickEdit,
    /id="qe-(?:panel-(?:age|income|balances)|annual-bonus|cash-return)"/,
  );
  const settings = html.split('id="quick-form"')[1].split("</form>")[0];
  for (const id of [
    "person-dob",
    "known-annual-bonus",
    "known-oa",
    "known-sa",
    "known-ma",
    "known-sa-invested",
    "known-srs",
    "known-srs-invested",
    "known-housing-mode",
    "known-equities",
    "known-sg-dividends",
    "known-ssb-cash",
  ]) {
    assert.ok(settings.includes(`id="${id}"`), id);
  }
  assert.equal(Array.from(html.matchAll(/\bdata-sg-reset\b/g)).length, 1);
});

test("production HTML and CSS reference existing local hashed files and no external font CDN", () => {
  const html = fs.readFileSync("dist/index.html", "utf8");
  assert.equal(html.includes("fonts.googleapis.com"), false);
  assert.equal(html.includes("fonts.gstatic.com"), false);

  const files = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)]
    .map((match) => match[1])
    .filter((file) => !file.includes(":"));
  for (const file of files) {
    assert.ok(fs.existsSync(path.join("dist", file)), file);
  }

  const cssFile = files.find((file) => file.endsWith(".css"));
  const css = fs.readFileSync(path.join("dist", cssFile), "utf8");
  for (const match of css.matchAll(/url\(["']?([^)'" ]+)["']?\)/g)) {
    assert.ok(
      fs.existsSync(path.resolve("dist", path.dirname(cssFile), match[1])),
      match[1],
    );
  }

  assert.match(html, /assets\/app\.[a-f0-9]{12}\.js/);
  assert.match(html, /assets\/styles\.[a-f0-9]{12}\.css/);
  assert.equal(fs.existsSync("dist/app.js"), false);
  assert.match(html, /name="viewport"[^>]*viewport-fit=cover/);
  assert.match(html, /name="apple-mobile-web-app-capable"\s+content="yes"/);
  assert.match(html, /name="theme-color" content="#f4f6fa"/);
  assert.match(html, /rel="apple-touch-icon"[^>]*sizes="180x180"/);
});

test("service worker is valid JS with concrete build revision, bounded cache, and offline fallback", () => {
  const rawSw = fs.readFileSync("sw.js", "utf8");
  assert.doesNotThrow(
    () => new vm.Script(rawSw),
    "Unbuilt source sw.js must be syntactically valid JS for local dev",
  );
  assert.equal(rawSw.includes("__PRECACHE__"), false);
  assert.equal(rawSw.includes("__CACHE_VERSION__"), false);
  assert.equal(rawSw.includes("return cached || fetch(request);"), false);
  assert.ok(rawSw.includes("status: 503"));

  const distSw = fs.readFileSync("dist/sw.js", "utf8");
  const html = fs.readFileSync("dist/index.html", "utf8");
  assert.equal(distSw.includes("__PRECACHE__"), false);
  assert.equal(distSw.includes("__CACHE_VERSION__"), false);
  assert.ok(distSw.includes("retirement-shield-"));
  assert.match(distSw, /cache:\s*"reload"/);

  const revMatch = html.match(
    /<meta name="app-revision" content="([a-f0-9]{12})"/,
  );
  assert.ok(revMatch, "index.html should embed 12-hex app-revision meta tag");
  assert.ok(
    distSw.includes(`retirement-shield-${revMatch[1]}`),
    "dist/sw.js cache version should match dist/index.html app-revision",
  );

  const app = fs.readFileSync("app.js", "utf8");
  assert.match(app, /register\("sw\.js", \{ updateViaCache: "none" \}\)/);
  assert.match(
    app,
    /swRegRef\.waiting\.postMessage\(\{ type: "SKIP_WAITING" \}\)/,
  );
  assert.match(app, /addEventListener\("controllerchange"/);
  assert.match(
    app,
    /if \(reloadingOnSwChange\) \{\s*window\.location\.reload\(\)/,
  );
});

test("static structural invariants: defined CSS tokens, print font floor, and unique HTML IDs", () => {
  const srcCss = fs.readFileSync("styles.css", "utf8");
  const srcHtml = fs.readFileSync("index.html", "utf8");

  // 1. Every var(--*) referenced in styles.css is defined (excluding runtime inline vars)
  const definedVars = new Set(
    [...srcCss.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)].map((m) => m[1]),
  );
  const runtimeVars = new Set([
    "--seg-idx",
    "--seg-count",
    "--item-idx",
    "--glider-w",
    "--glider-x",
    "--src-bg",
    "--stagger",
  ]);
  const undefinedVars = [...srcCss.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)/g)]
    .map((m) => m[1])
    .filter((v) => !definedVars.has(v) && !runtimeVars.has(v));
  assert.deepEqual(undefinedVars, []);

  // 2. Print stylesheet enforces 6.5pt minimum legibility floor
  const printIdx = srcCss.indexOf("@media print {");
  assert.ok(printIdx !== -1);
  const subFloorPts = [
    ...srcCss.slice(printIdx).matchAll(/font-size:\s*(\d+(?:\.\d+)?)pt/g),
  ]
    .map((m) => parseFloat(m[1]))
    .filter((pt) => pt < 6.5);
  assert.deepEqual(subFloorPts, []);

  // 3. Zero duplicate static IDs in index.html
  const ids = [...srcHtml.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  const seen = new Set();
  const duplicates = [];
  for (const id of ids) {
    if (seen.has(id)) duplicates.push(id);
    seen.add(id);
  }
  assert.deepEqual(duplicates, []);
});

test("service worker runtime behavior: install precache, stale cache eviction, safe pageResponse, and networkFirstJson offline fallback", async () => {
  const swSrc = fs.readFileSync("dist/sw.js", "utf8");
  const cacheMap = new Map();
  const openCache = (name) => {
    if (!cacheMap.has(name)) cacheMap.set(name, new Map());
    const store = cacheMap.get(name);
    return {
      async put(req, res) {
        const key = typeof req === "string" ? req : req.url;
        store.set(key, res);
      },
      async match(req) {
        const key = typeof req === "string" ? req : req.url;
        return store.get(key);
      },
    };
  };
  const listeners = new Map();
  let fetchImpl = async (req) => {
    const url = typeof req === "string" ? req : req.url;
    return new Response(`body-v1:${url}`, {
      status: 200,
      headers: {
        "content-type": url.endsWith(".json")
          ? "application/json"
          : "text/html",
      },
    });
  };
  const sandbox = {
    URL,
    Request,
    Response,
    fetch: (...args) => fetchImpl(...args),
    caches: {
      async open(name) {
        return openCache(name);
      },
      async keys() {
        return [...cacheMap.keys()];
      },
      async delete(name) {
        return cacheMap.delete(name);
      },
    },
    self: {
      location: new URL("https://example.test/retirement-shield/sw.js"),
      registration: { scope: "https://example.test/retirement-shield/" },
      clients: { async claim() {} },
      skipWaiting() {},
      addEventListener(type, fn) {
        listeners.set(type, fn);
      },
    },
  };
  vm.runInNewContext(swSrc, sandbox, { filename: "dist/sw.js" });

  // The active app can identify the worker revision, then promote a waiting
  // worker without deleting browser storage or unrelated caches.
  let skipWaitingCalls = 0;
  sandbox.self.skipWaiting = () => {
    skipWaitingCalls += 1;
  };
  let versionMessage;
  listeners.get("message")({
    data: { type: "GET_VERSION" },
    ports: [
      {
        postMessage(message) {
          versionMessage = message;
        },
      },
    ],
  });
  const builtCacheName = swSrc.match(/CACHE_NAME="([^"]+)"/)?.[1];
  assert.deepEqual(JSON.parse(JSON.stringify(versionMessage)), {
    cacheVersion: builtCacheName,
  });
  assert.match(builtCacheName || "", /^retirement-shield-[a-f0-9]{12}$/);
  listeners.get("message")({ data: { type: "SKIP_WAITING" } });
  assert.equal(skipWaitingCalls, 1);

  // 1. Install precaches APP_SHELL
  let waitPromise;
  listeners.get("install")({
    waitUntil(p) {
      waitPromise = p;
    },
  });
  await waitPromise;
  const activeCacheName = [...cacheMap.keys()][0];
  assert.ok(activeCacheName.startsWith("retirement-shield-"));
  const activeStore = cacheMap.get(activeCacheName);
  const shellUrl = "https://example.test/retirement-shield/index.html";
  assert.ok(activeStore.has(shellUrl), "install must precache index.html");

  // 2. Activate deletes stale caches with same prefix
  cacheMap.set("retirement-shield-oldrev", new Map());
  cacheMap.set("unrelated-cache", new Map());
  listeners.get("activate")({
    waitUntil(p) {
      waitPromise = p;
    },
  });
  await waitPromise;
  assert.equal(cacheMap.has("retirement-shield-oldrev"), false);
  assert.equal(cacheMap.has("unrelated-cache"), true);
  assert.equal(cacheMap.has(activeCacheName), true);

  // 3. pageResponse serves live network HTML without overwriting precached shellURL
  fetchImpl = async () =>
    new Response("<html>NEW-BUILD-HTML</html>", {
      status: 200,
      headers: { "content-type": "text/html" },
    });
  let respPromise;
  listeners.get("fetch")({
    request: {
      method: "GET",
      mode: "navigate",
      url: "https://example.test/retirement-shield/",
    },
    respondWith(p) {
      respPromise = p;
    },
  });
  const liveResp = await respPromise;
  assert.equal(await liveResp.text(), "<html>NEW-BUILD-HTML</html>");
  // Precached shell must still be original v1 so offline reload stays consistent with v1 hashed assets
  assert.equal(
    await activeStore.get(shellUrl).clone().text(),
    `body-v1:${shellUrl}`,
  );

  // 4. Offline navigate falls back to precached v1 shell
  fetchImpl = async () => {
    throw new Error("offline");
  };
  listeners.get("fetch")({
    request: {
      method: "GET",
      mode: "navigate",
      url: "https://example.test/retirement-shield/",
    },
    respondWith(p) {
      respPromise = p;
    },
  });
  const offlineResp = await respPromise;
  assert.equal(await offlineResp.text(), `body-v1:${shellUrl}`);

  // 5. mas-rates.json uses network-first and falls back to precached JSON offline
  const masUrl = "https://example.test/retirement-shield/assets/mas-rates.json";
  listeners.get("fetch")({
    request: { method: "GET", mode: "cors", url: masUrl },
    respondWith(p) {
      respPromise = p;
    },
  });
  const masOfflineResp = await respPromise;
  assert.equal(await masOfflineResp.text(), `body-v1:${masUrl}`);
});

test("dev SW precaches all src/app modules and dist/index.html loads IIFE app bundle as classic defer script", () => {
  const devSw = fs.readFileSync("sw.js", "utf8");
  const appModules = fs
    .readdirSync(path.join("src", "app"))
    .filter((f) => f.endsWith(".js"));
  for (const mod of appModules) {
    assert.ok(
      devSw.includes(`./src/app/${mod}`),
      `Dev sw.js APP_SHELL must include ./src/app/${mod}`,
    );
  }
  const distHtml = fs.readFileSync(path.join("dist", "index.html"), "utf8");
  assert.ok(
    /<script src="assets\/app\.[0-9a-f]{12}\.js" defer><\/script>/.test(
      distHtml,
    ),
    "Production dist/index.html must load bundled IIFE app.js with defer (not type=module)",
  );
});
