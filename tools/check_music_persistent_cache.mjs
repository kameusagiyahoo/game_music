import { readFileSync } from "node:fs";
import {
  AUDIO_PERSISTENT_CACHE_NAME,
  AUDIO_PERSISTENT_CACHE_OWNER,
  clearAudioAssetCache,
  clearPersistentAudioCache,
  getAudioAssetCacheInfo,
} from "../src/audio-asset-cache.js";
import { createMusicRuntime } from "../src/music-asset-resolver.js";
import { resolvePackAudioFormat } from "../src/music-format-resolver.js";
import { pulsePack } from "../src/music-packs/pulse.js";
import { WavStemMusicManager } from "../src/wav-stem-manager.js";

class FakeResponse {
  constructor(body = "") {
    this.ok = true;
    this.status = 200;
    this.body = typeof body === "string"
      ? new TextEncoder().encode(body)
      : new Uint8Array(body);
  }

  clone() {
    return new FakeResponse(this.body.slice());
  }

  async arrayBuffer() {
    return this.body.slice().buffer;
  }
}

class FakeCache {
  constructor() {
    this.store = new Map();
  }

  keyOf(request) {
    return typeof request === "string" ? request : request?.url;
  }

  async match(request) {
    const value = this.store.get(this.keyOf(request));
    return value ? value.clone() : undefined;
  }

  async put(request, response) {
    this.store.set(this.keyOf(request), response.clone());
  }

  async delete(request) {
    return this.store.delete(this.keyOf(request));
  }

  async keys() {
    return [...this.store.keys()].map((url) => ({ url }));
  }
}

const stores = new Map();
globalThis.caches = {
  async open(name) {
    if (!stores.has(name)) stores.set(name, new FakeCache());
    return stores.get(name);
  },
  async delete(name) {
    return stores.delete(name);
  },
  async keys() {
    return [...stores.keys()];
  },
};

let fetchCount = 0;
globalThis.fetch = async (url) => {
  fetchCount += 1;
  return new FakeResponse(String(url));
};

await clearPersistentAudioCache();
clearAudioAssetCache();

const resolved = resolvePackAudioFormat(pulsePack, {
  support: { m4a: "probably", ogg: "probably", wav: "probably" },
  useSession: false,
});

const first = new WavStemMusicManager({ pack: resolved.pack });
const firstPreload = await first.preload({ stingers: true, transitions: true });
const networkAfterFirstLoad = fetchCount;

clearAudioAssetCache();

const second = new WavStemMusicManager({ pack: resolved.pack });
const secondPreload = await second.preload({ stingers: true, transitions: true });
const networkAfterSecondLoad = fetchCount;
const secondCache = getAudioAssetCacheInfo();

const runtime = createMusicRuntime({
  packId: "pulse",
  formatOptions: {
    support: { m4a: "probably", ogg: "probably", wav: "probably" },
    useSession: false,
  },
});
const versionedUrl = runtime.manager.pack.audioStems.files.drums;

const serviceWorkerSource = readFileSync(new URL("../music-sw.js", import.meta.url), "utf-8");

const errors = [];

if (firstPreload.state !== "ready") errors.push(`first preload state: ${firstPreload.state}`);
if (firstPreload.requested !== 11) errors.push(`first preload expected 11 assets, got ${firstPreload.requested}`);
if (networkAfterFirstLoad !== 11) errors.push(`expected 11 initial network fetches, got ${networkAfterFirstLoad}`);

if (secondPreload.state !== "ready") errors.push(`second preload state: ${secondPreload.state}`);
if (networkAfterSecondLoad !== networkAfterFirstLoad) {
  errors.push(`persistent reload caused network fetches: ${networkAfterFirstLoad} -> ${networkAfterSecondLoad}`);
}
if (secondCache.persistentHits < 11) errors.push(`expected >=11 persistent hits, got ${secondCache.persistentHits}`);
if (secondCache.persistentEntries < 11) errors.push(`expected >=11 memory entries restored from persistent cache, got ${secondCache.persistentEntries}`);

if (!versionedUrl.includes("gmv=1.4.1")) {
  errors.push(`runtime asset URL is not Pack-versioned: ${versionedUrl}`);
}

if (AUDIO_PERSISTENT_CACHE_OWNER !== "application") {
  errors.push(`expected application cache ownership, got ${AUDIO_PERSISTENT_CACHE_OWNER}`);
}
if (!serviceWorkerSource.includes(AUDIO_PERSISTENT_CACHE_NAME)) {
  errors.push("Compatibility Service Worker must preserve the current application-owned cache name");
}
if (serviceWorkerSource.includes('addEventListener("fetch"') || serviceWorkerSource.includes("respondWith(")) {
  errors.push("Service Worker must not intercept audio fetches");
}
if (serviceWorkerSource.includes("cache.put(")) {
  errors.push("Service Worker must not write persistent audio cache entries");
}

const persistentStore = stores.get(AUDIO_PERSISTENT_CACHE_NAME);
if (!persistentStore || persistentStore.store.size !== 11) {
  errors.push(`expected 11 persistent entries, got ${persistentStore?.store.size ?? 0}`);
}

if (errors.length) {
  console.error("Music Persistent Cache Check FAILED");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log("Music Persistent Cache Check PASSED");
console.log(`- initial network fetches: ${networkAfterFirstLoad}`);
console.log(`- network fetches after memory reset: ${networkAfterSecondLoad}`);
console.log(`- persistent hits: ${secondCache.persistentHits}`);
console.log(`- versioned URL: ${versionedUrl}`);
console.log(`- cache name: ${AUDIO_PERSISTENT_CACHE_NAME}`);
console.log(`- cache owner: ${AUDIO_PERSISTENT_CACHE_OWNER}`);
console.log("- service worker: pass-through compatibility shell");
