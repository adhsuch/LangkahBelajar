// Offline support for the app shell and stored materials. Child data is never cached here.
const CACHE = "langkahbelajar-v1";
const MATERIALS = "/api/materials/stored";
const AUDIO_MANIFEST = "/audio/id/manifest.json";

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

// Hashed bundles are read from the page, so the app opens offline after the very first visit.
async function precache() {
  const html = await (await fetch("/")).text();
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1]);
  const cache = await caches.open(CACHE);
  await cache.addAll(["/", "/icon.svg", "/manifest.webmanifest", ...assets]);
  // One missing clip must not block installing the offline app.
  const manifest = await fetch(AUDIO_MANIFEST).then((response) => response.json()).catch(() => ({ clips: {} }));
  await Promise.allSettled([cache.add(AUDIO_MANIFEST), ...Object.values(manifest.clips ?? {}).map((file) => cache.add(file))]);
}

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()),
  );
});

async function networkFirst(request, cacheKey) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(cacheKey, response.clone());
    return response;
  } catch (error) {
    const stored = await cache.match(cacheKey);
    if (stored) return stored;
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const stored = await cache.match(request);
  if (stored) return stored;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

// Media elements send Range requests, and the Cache API cannot store a partial response.
async function cachedAudio(request) {
  const cache = await caches.open(CACHE);
  let full = await cache.match(request.url);
  if (!full) {
    full = await fetch(request.url);
    if (!full.ok) return full;
    await cache.put(request.url, full.clone());
  }
  const range = /bytes=(\d+)-(\d*)/.exec(request.headers.get("range") ?? "");
  if (!range) return full;
  const body = await full.arrayBuffer();
  const start = Number(range[1]);
  const end = range[2] ? Math.min(Number(range[2]), body.byteLength - 1) : body.byteLength - 1;
  return new Response(body.slice(start, end + 1), {
    status: 206,
    headers: {
      "content-type": full.headers.get("content-type") ?? "audio/mpeg",
      "content-range": `bytes ${start}-${end}/${body.byteLength}`,
      "content-length": String(end - start + 1),
      "accept-ranges": "bytes",
    },
  });
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname === MATERIALS) event.respondWith(networkFirst(event.request, MATERIALS));
  else if (url.pathname === AUDIO_MANIFEST) event.respondWith(networkFirst(event.request, AUDIO_MANIFEST));
  else if (url.pathname.startsWith("/audio/")) event.respondWith(cachedAudio(event.request));
  else if (url.pathname.startsWith("/api/")) return;
  else if (event.request.mode === "navigate") event.respondWith(networkFirst(event.request, "/"));
  else if (url.pathname.startsWith("/assets/")) event.respondWith(cacheFirst(event.request));
});
