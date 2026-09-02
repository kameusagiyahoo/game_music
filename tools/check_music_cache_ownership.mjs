import fs from "node:fs";
import {
  AUDIO_PERSISTENT_CACHE_NAME,
  AUDIO_PERSISTENT_CACHE_OWNER,
  getAudioAssetCacheInfo,
} from "../src/audio-asset-cache.js";
import { MUSIC_CAPABILITIES } from "../src/music-asset-resolver.js";
import { MUSIC_ENGINES } from "../src/music-registry.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const appCacheSource = fs.readFileSync("src/audio-asset-cache.js", "utf8");
const workerSource = fs.readFileSync("music-sw.js", "utf8");
const registrationSource = fs.readFileSync("src/music-service-worker.js", "utf8");

assert(
  AUDIO_PERSISTENT_CACHE_OWNER === "application",
  `persistent cache owner must be application, got ${AUDIO_PERSISTENT_CACHE_OWNER}`,
);
assert(
  appCacheSource.includes("cache.match(") && appCacheSource.includes("cache.put("),
  "application cache module must own persistent cache reads and writes",
);
assert(
  appCacheSource.includes("pruneOlderAssetVersions"),
  "application cache module must own gmv version pruning",
);
assert(
  !workerSource.includes('addEventListener("fetch"'),
  "compatibility Service Worker must not register a fetch handler",
);
assert(
  !workerSource.includes("respondWith("),
  "compatibility Service Worker must not intercept requests",
);
assert(
  !workerSource.includes("cache.put("),
  "compatibility Service Worker must not write audio responses",
);
assert(
  workerSource.includes(AUDIO_PERSISTENT_CACHE_NAME),
  "compatibility Service Worker must preserve the active application cache while deleting older cache generations",
);
assert(
  registrationSource.includes('audioCacheOwner: "application"'),
  "service worker registration result must expose application cache ownership",
);
assert(
  registrationSource.includes("interceptsAudioFetch: false"),
  "service worker registration result must report pass-through behavior",
);
assert(
  MUSIC_CAPABILITIES[MUSIC_ENGINES.WAV_STEM]?.persistentAudioCache === true,
  "WAV-stem capability must keep persistent application caching enabled",
);
assert(
  MUSIC_CAPABILITIES[MUSIC_ENGINES.WAV_STEM]?.serviceWorkerCache === false,
  "WAV-stem capability must report service-worker caching disabled",
);

const info = getAudioAssetCacheInfo();
assert(info.persistentCacheOwner === "application", "cache metrics must expose application ownership");

console.log("Audio cache ownership check PASSED");
console.log("- memory cache: application");
console.log("- persistent Cache API: application");
console.log("- Service Worker: pass-through compatibility only");
