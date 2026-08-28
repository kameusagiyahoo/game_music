let registrationPromise = null;

export function isMusicServiceWorkerSupported() {
  try {
    return typeof navigator !== "undefined" && "serviceWorker" in navigator;
  } catch (_) {
    return false;
  }
}

export async function ensureMusicServiceWorker() {
  if (!isMusicServiceWorkerSupported()) {
    return { supported: false, registered: false };
  }

  if (!registrationPromise) {
    const scriptUrl = new URL("../music-sw.js", import.meta.url);
    registrationPromise = navigator.serviceWorker.register(scriptUrl.href)
      .then((registration) => ({
        supported: true,
        registered: true,
        scope: registration.scope,
      }))
      .catch((error) => {
        registrationPromise = null;
        return {
          supported: true,
          registered: false,
          error: error?.message || String(error),
        };
      });
  }

  return registrationPromise;
}
