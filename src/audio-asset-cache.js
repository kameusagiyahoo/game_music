export const AUDIO_PERSISTENT_CACHE_NAME = "game-music-audio-v15";

const byteCache = new Map();

let cacheHits = 0;
let cacheMisses = 0;
let memoryHits = 0;
let persistentHits = 0;
let persistentMisses = 0;
let persistentWrites = 0;
let totalFetchedBytes = 0;

function keyOf(url) {
  return String(url || "");
}

function cloneBuffer(buffer) {
  return buffer.slice(0);
}

function persistentCacheApi() {
  try {
    return typeof caches !== "undefined" ? caches : null;
  } catch (_) {
    return null;
  }
}

async function openPersistentCache() {
  const api = persistentCacheApi();
  if (!api?.open) return null;
  try {
    return await api.open(AUDIO_PERSISTENT_CACHE_NAME);
  } catch (_) {
    return null;
  }
}

async function readPersistentResponse(key) {
  const cache = await openPersistentCache();
  if (!cache?.match) return null;
  try {
    const response = await cache.match(key);
    if (!response) {
      persistentMisses += 1;
      return null;
    }
    persistentHits += 1;
    return response;
  } catch (_) {
    return null;
  }
}

async function writePersistentResponse(key, response) {
  const cache = await openPersistentCache();
  if (!cache?.put || !response?.clone) return false;
  try {
    await cache.put(key, response.clone());
    persistentWrites += 1;
    return true;
  } catch (_) {
    return false;
  }
}

export async function getAudioBytes(url, { cache = "force-cache", persistent = true } = {}) {
  const key = keyOf(url);
  if (!key) throw new Error("Audio asset URL is required");

  const existing = byteCache.get(key);
  if (existing) {
    cacheHits += 1;
    memoryHits += 1;
    const data = await existing.promise;
    return cloneBuffer(data);
  }

  cacheMisses += 1;
  const record = {
    url: key,
    state: "loading",
    source: "pending",
    bytes: 0,
    createdAt: Date.now(),
    promise: null,
  };

  record.promise = (async () => {
    if (persistent) {
      const cachedResponse = await readPersistentResponse(key);
      if (cachedResponse) {
        const data = await cachedResponse.arrayBuffer();
        record.state = "ready";
        record.source = "persistent";
        record.bytes = data.byteLength;
        return data;
      }
    }

    const response = await fetch(key, { cache });
    if (!response.ok) {
      throw new Error(`Failed to load audio asset: ${response.status} ${key}`);
    }

    if (persistent) await writePersistentResponse(key, response);

    const data = await response.arrayBuffer();
    record.state = "ready";
    record.source = "network";
    record.bytes = data.byteLength;
    totalFetchedBytes += data.byteLength;
    return data;
  })().catch((error) => {
    byteCache.delete(key);
    throw error;
  });

  byteCache.set(key, record);
  const data = await record.promise;
  return cloneBuffer(data);
}

export async function preloadAudioUrls(
  urls,
  { concurrency = 4, cache = "force-cache", persistent = true } = {},
) {
  const queue = [...new Set((urls || []).filter(Boolean).map(keyOf))];
  const workerCount = Math.max(1, Math.min(Number(concurrency) || 4, queue.length || 1));
  let cursor = 0;
  let loaded = 0;

  const workers = Array.from({ length: workerCount }, async () => {
    while (cursor < queue.length) {
      const index = cursor;
      cursor += 1;
      await getAudioBytes(queue[index], { cache, persistent });
      loaded += 1;
    }
  });

  await Promise.all(workers);
  return {
    requested: queue.length,
    loaded,
    cache: getAudioAssetCacheInfo(),
  };
}

export function hasAudioBytes(url) {
  return byteCache.get(keyOf(url))?.state === "ready";
}

export function clearAudioAssetCache() {
  byteCache.clear();
  cacheHits = 0;
  cacheMisses = 0;
  memoryHits = 0;
  totalFetchedBytes = 0;
}

export async function clearPersistentAudioCache() {
  const api = persistentCacheApi();
  if (!api?.delete) return false;
  try {
    const deleted = await api.delete(AUDIO_PERSISTENT_CACHE_NAME);
    persistentHits = 0;
    persistentMisses = 0;
    persistentWrites = 0;
    return deleted;
  } catch (_) {
    return false;
  }
}

export async function getPersistentAudioCacheInfo() {
  const cache = await openPersistentCache();
  if (!cache?.keys) {
    return {
      supported: false,
      name: AUDIO_PERSISTENT_CACHE_NAME,
      entries: 0,
    };
  }

  try {
    const keys = await cache.keys();
    return {
      supported: true,
      name: AUDIO_PERSISTENT_CACHE_NAME,
      entries: keys.length,
    };
  } catch (_) {
    return {
      supported: true,
      name: AUDIO_PERSISTENT_CACHE_NAME,
      entries: 0,
    };
  }
}

export function getAudioAssetCacheInfo() {
  let ready = 0;
  let loading = 0;
  let bytes = 0;
  let networkEntries = 0;
  let persistentEntries = 0;

  for (const record of byteCache.values()) {
    if (record.state === "ready") ready += 1;
    else loading += 1;
    bytes += Number(record.bytes || 0);
    if (record.source === "network") networkEntries += 1;
    if (record.source === "persistent") persistentEntries += 1;
  }

  return {
    entries: byteCache.size,
    ready,
    loading,
    bytes,
    hits: cacheHits,
    misses: cacheMisses,
    memoryHits,
    networkEntries,
    persistentEntries,
    persistentSupported: Boolean(persistentCacheApi()?.open),
    persistentHits,
    persistentMisses,
    persistentWrites,
    fetchedBytes: totalFetchedBytes,
    persistentCacheName: AUDIO_PERSISTENT_CACHE_NAME,
  };
}
