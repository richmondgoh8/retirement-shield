/* Build fills the revision and the bounded list of app-owned public assets. */
const CACHE_PREFIX = "retirement-shield-";
const CACHE_NAME = "retirement-shield-__CACHE_VERSION__";
const APP_SHELL = __PRECACHE__;
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
      await self.skipWaiting();
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
    if (response.status >= 500) throw new Error("App temporarily unavailable");
    // Do not store auth redirects, access errors or other non-app responses.
    if (
      response.ok &&
      !response.redirected &&
      response.headers.get("content-type")?.includes("text/html")
    ) {
      await cache.put(shellURL, response.clone());
    }
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
  try {
    const response = await fetch(request, { cache: "no-cache" });
    if (response.ok && !response.redirected) {
      await cache.put(request, response.clone());
      return response;
    }
  } catch {
    // Offline or transient network error falls back to precached snapshot.
  }
  const cached = await cache.match(request);
  return cached || fetch(request);
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
      const response = await fetch(event.request);
      if (response.ok && !response.redirected)
        await cache.put(event.request, response.clone());
      return response;
    })(),
  );
});
