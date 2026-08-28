const byteCache = new Map();

let cacheHits = 0;
let cacheMisses = 0;
let totalFetchedBytes = 0;

function keyOf(url) {
  return String(url || "");
}

function cloneBuffer(buffer) {
  return buffer.slice(0);
}

export async function getAudioBytes(url, { cache = "force-cache" } = {}) {
  const key = keyOf(url);
  if (!key) throw new Error("Audio asset URL is required");

  const existing = byteCache.get(key);
  if (existing) {
    cacheHits += 1;
    const data = await existing.promise;
    return cloneBuffer(data);
  }

  cacheMisses += 1;
  const record = {
    url: key,
    state: "loading",
    bytes: 0,
    createdAt: Date.now(),
    promise: null,
  };

  record.promise = (async () => {
    const response = await fetch(key, { cache });
    if (!response.ok) {
      throw new Error(`Failed to preload audio asset: ${response.status} ${key}`);
    }

    const data = await response.arrayBuffer();
    record.state = "ready";
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

export async function preloadAudioUrls(urls, { concurrency = 4, cache = "force-cache" } = {}) {
  const queue = [...new Set((urls || []).filter(Boolean).map(keyOf))];
  const workerCount = Math.max(1, Math.min(Number(concurrency) || 4, queue.length || 1));
  let cursor = 0;
  let loaded = 0;

  const workers = Array.from({ length: workerCount }, async () => {
    while (cursor < queue.length) {
      const index = cursor;
      cursor += 1;
      await getAudioBytes(queue[index], { cache });
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
  totalFetchedBytes = 0;
}

export function getAudioAssetCacheInfo() {
  let ready = 0;
  let loading = 0;
  let bytes = 0;

  for (const record of byteCache.values()) {
    if (record.state === "ready") ready += 1;
    else loading += 1;
    bytes += Number(record.bytes || 0);
  }

  return {
    entries: byteCache.size,
    ready,
    loading,
    bytes,
    hits: cacheHits,
    misses: cacheMisses,
    fetchedBytes: totalFetchedBytes,
  };
}
