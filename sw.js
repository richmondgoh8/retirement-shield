/* Build fills the revision and the bounded list of app-owned public assets. */
const CACHE_PREFIX = "retirement-shield-";
const CACHE_NAME = CACHE_PREFIX + "__CACHE_VERSION__";
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
      await cache.addAll(APP_SHELL);
      await self.skipWaiting();
    })(),
  );
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

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.mode === "navigate" && isAppPage(url)) {
    event.respondWith(pageResponse(event.request));
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
