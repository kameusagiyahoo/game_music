const AUDIO_CACHE_NAME = "game-music-audio-v15";
const AUDIO_CACHE_PREFIX = "game-music-audio-v";

/*
 * Compatibility Service Worker.
 *
 * Persistent audio caching is owned by src/audio-asset-cache.js.
 * This worker intentionally has no fetch handler so audio requests are never
 * intercepted or written a second time. Keeping the worker registered lets
 * browsers that already installed older caching versions upgrade to this
 * pass-through implementation safely.
 */

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
