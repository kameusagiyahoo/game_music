import { clearAudioAssetCache, getAudioAssetCacheInfo } from "../src/audio-asset-cache.js";
import { pulsePack } from "../src/music-packs/pulse.js";
import { resolvePackAudioFormat } from "../src/music-format-resolver.js";
import { WavStemMusicManager } from "../src/wav-stem-manager.js";

class FakeAudioParam {
  constructor(value = 1) { this.value = value; }
  cancelScheduledValues() {}
  setValueAtTime(value) { this.value = value; }
  exponentialRampToValueAtTime(value) { this.value = value; }
}

class FakeNode {
  connect() { return this; }
  disconnect() {}
}

class FakeGain extends FakeNode {
  constructor() {
    super();
    this.gain = new FakeAudioParam(1);
  }
}

class FakeCompressor extends FakeNode {
  constructor() {
    super();
    this.threshold = { value: 0 };
    this.knee = { value: 0 };
    this.ratio = { value: 0 };
    this.attack = { value: 0 };
    this.release = { value: 0 };
  }
}

class FakeBufferSource extends FakeNode {
  constructor() {
    super();
    this.buffer = null;
    this.loop = false;
    this.loopStart = 0;
    this.loopEnd = 0;
    this.onended = null;
  }
  start() {}
  stop() {}
}

class FakeOscillator extends FakeNode {
  constructor() {
    super();
    this.type = "sine";
    this.frequency = { setValueAtTime() {} };
  }
  start() {}
  stop() {}
}

class FakeAudioContext {
  constructor() {
    this.state = "running";
    this.currentTime = 0;
    this.destination = {};
  }
  createGain() { return new FakeGain(); }
  createDynamicsCompressor() { return new FakeCompressor(); }
  createBufferSource() { return new FakeBufferSource(); }
  createOscillator() { return new FakeOscillator(); }
  async resume() {}
  async decodeAudioData() { return { duration: 1 }; }
}

globalThis.window = {
  AudioContext: FakeAudioContext,
  webkitAudioContext: FakeAudioContext,
  setInterval() { return 1; },
  clearInterval() {},
};

let fetchCount = 0;
globalThis.fetch = async (url) => {
  fetchCount += 1;
  return {
    ok: true,
    status: 200,
    async arrayBuffer() {
      return new TextEncoder().encode(String(url)).buffer;
    },
  };
};

clearAudioAssetCache();

const resolved = resolvePackAudioFormat(pulsePack, {
  support: { m4a: "probably", ogg: "probably", wav: "probably" },
  useSession: false,
});

const manager = new WavStemMusicManager({ pack: resolved.pack });

const preload = await manager.preload({ stingers: true });
const fetchesAfterPreload = fetchCount;
const cacheAfterPreload = getAudioAssetCacheInfo();

await manager.play("normal");
const fetchesAfterPlay = fetchCount;

await manager.playStinger("victory");
const fetchesAfterStinger = fetchCount;

const errors = [];
if (preload.state !== "ready") errors.push(`expected preload ready, got ${preload.state}`);
if (preload.requested !== 7) errors.push(`expected 7 preload assets, got ${preload.requested}`);
if (fetchesAfterPreload !== 7) errors.push(`expected 7 network fetches during preload, got ${fetchesAfterPreload}`);
if (fetchesAfterPlay !== fetchesAfterPreload) {
  errors.push(`play triggered extra network fetches: ${fetchesAfterPreload} -> ${fetchesAfterPlay}`);
}
if (fetchesAfterStinger !== fetchesAfterPreload) {
  errors.push(`stinger triggered extra network fetches: ${fetchesAfterPreload} -> ${fetchesAfterStinger}`);
}
if (cacheAfterPreload.ready !== 7) errors.push(`expected 7 ready cache entries, got ${cacheAfterPreload.ready}`);
if (getAudioAssetCacheInfo().hits < 6) errors.push("expected cache hits from 5 stems and victory stinger");

manager.stop();

if (errors.length) {
  console.error("Music Preload Cache Check FAILED");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log("Music Preload Cache Check PASSED");
console.log(`- preload network fetches: ${fetchesAfterPreload}`);
console.log(`- fetches after play: ${fetchesAfterPlay}`);
console.log(`- fetches after stinger: ${fetchesAfterStinger}`);
console.log(`- cache hits: ${getAudioAssetCacheInfo().hits}`);
