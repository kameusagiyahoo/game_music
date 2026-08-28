const AUDIO_CACHE_NAME = "game-music-audio-v15";
const AUDIO_CACHE_PREFIX = "game-music-audio-v";
const AUDIO_PATH = /\/assets\/(?:stems|stingers)\//;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter((name) => name.startsWith(AUDIO_CACHE_PREFIX) && name !== AUDIO_CACHE_NAME)
        .map((name) => caches.delete(name)),
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !AUDIO_PATH.test(url.pathname)) return;

  event.respondWith((async () => {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  })());
});
