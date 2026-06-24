const SCORE_FLOW_CACHE = "scoreflow-v1.0.4";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./firebase-config.js",
  "./manifest.json"
];

const STATIC_ASSETS = [
  "./app-icon-180.png",
  "./app-icon-192.png",
  "./app-icon-512.png",
  "./splash-logo.png",
  "./volleyball.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SCORE_FLOW_CACHE).then(async (cache) => {
      await cache.addAll(CORE_ASSETS);

      // Image files are cached one-by-one so a missing/replaced branding file
      // never breaks the whole service worker install.
      await Promise.allSettled(STATIC_ASSETS.map((asset) => cache.add(asset)));
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => key !== SCORE_FLOW_CACHE ? caches.delete(key) : null))
    )
  );
  self.clients.claim();
});

function isAppShellFile(requestUrl) {
  return requestUrl.pathname.endsWith("/") ||
    requestUrl.pathname.endsWith(".html") ||
    requestUrl.pathname.endsWith(".css") ||
    requestUrl.pathname.endsWith(".js") ||
    requestUrl.pathname.endsWith(".json");
}

function isStaticBrandingFile(requestUrl) {
  return requestUrl.pathname.endsWith(".png") ||
    requestUrl.pathname.endsWith(".jpg") ||
    requestUrl.pathname.endsWith(".jpeg") ||
    requestUrl.pathname.endsWith(".svg") ||
    requestUrl.pathname.endsWith(".webp") ||
    requestUrl.pathname.endsWith(".ico");
}

async function networkFirst(request) {
  const cache = await caches.open(SCORE_FLOW_CACHE);
  try {
    const response = await fetch(request, { cache: "no-store" });
    if (response && response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(SCORE_FLOW_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response && response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);

  if (requestUrl.origin !== self.location.origin || event.request.method !== "GET") {
    return;
  }

  if (isAppShellFile(requestUrl)) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  if (isStaticBrandingFile(requestUrl)) {
    event.respondWith(networkFirst(event.request));
  }
});
