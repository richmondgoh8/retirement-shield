/* Build fills the revision and the bounded list of app-owned public assets. */
const CACHE_PREFIX = "retirement-shield-";
const CACHE_NAME = "retirement-shield-dev";
const APP_SHELL = [
  "./index.html",
  "./styles.css",
  "./model.js",
  "./app.js",
  "./manifest.webmanifest",
  "./favicon.svg",
  "./favicon.ico",
  "./assets/inter-latin.woff2",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/icon-maskable-512.png",
  "./assets/apple-touch-icon.png",
  "./assets/mas-rates.json",
];
const appURL = (path) => new URL(path, self.registration.scope).href;
const assetURLs = new Set(APP_SHELL.map(appURL));
const shellURL = appURL("./index.html");
const isAppPage = (url) =>
  url.pathname === new URL(self.registration.scope).pathname ||
  url.href.split("?")[0] === shellURL;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await Promise.all(
        APP_SHELL.map(async (item) => {
          const url = appURL(item);
          const response = await fetch(new Request(url, { cache: "reload" }));
          if (!response.ok) throw new Error(`Failed to precache ${item}`);
          await cache.put(url, response);
        }),
      );
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "GET_VERSION") {
    event.ports?.[0]?.postMessage({ cacheVersion: CACHE_NAME });
  } else if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

async function pageResponse(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request, { cache: "no-cache" });
    if (response.type === "opaqueredirect") return response;
    if (!response.ok) throw new Error("App temporarily unavailable");
    // Do not overwrite precached shellURL with a newer build's HTML whose hashed
    // JS/CSS bundles are absent from this worker's APP_SHELL cache.
    return response;
  } catch {
    return (
      (await cache.match(shellURL)) ||
      new Response(
        "Open Retirement Shield online once to prepare offline access.",
        {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        },
      )
    );
  }
}

async function networkFirstJson(request) {
  const cache = await caches.open(CACHE_NAME);
  const canonicalKey = appURL("./assets/mas-rates.json");
  let lastResponse = null;
  try {
    const response = await fetch(request, { cache: "no-cache" });
    lastResponse = response;
    if (response.ok && !response.redirected) {
      await cache.put(canonicalKey, response.clone());
      return response;
    }
  } catch {
    // Offline or transient network error falls back to precached snapshot.
  }
  const cached =
    (await cache.match(canonicalKey)) ||
    (await cache.match(request, { ignoreSearch: true }));
  return (
    cached ||
    lastResponse ||
    new Response("{}", {
      status: 503,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    })
  );
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.mode === "navigate" && isAppPage(url)) {
    event.respondWith(pageResponse(event.request));
    return;
  }
  if (url.pathname.endsWith("/assets/mas-rates.json")) {
    event.respondWith(networkFirstJson(event.request));
    return;
  }
  // Requests outside this build's asset list pass through untouched.
  if (!assetURLs.has(url.href) || url.href === shellURL) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(event.request);
      if (cached) return cached;
      try {
        const response = await fetch(event.request);
        if (response.ok && !response.redirected)
          await cache.put(event.request, response.clone());
        return response;
      } catch {
        return new Response("Offline asset unavailable.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
    })(),
  );
});
