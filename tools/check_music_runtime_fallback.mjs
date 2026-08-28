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
  async decodeAudioData(data) {
    const marker = new TextDecoder().decode(new Uint8Array(data));
    if (marker.includes(".m4a")) throw new Error("simulated M4A decode failure");
    return { duration: 1 };
  }
}

globalThis.window = {
  AudioContext: FakeAudioContext,
  webkitAudioContext: FakeAudioContext,
  setInterval() { return 1; },
  clearInterval() {},
};

globalThis.fetch = async (url) => ({
  ok: true,
  status: 200,
  async arrayBuffer() {
    return new TextEncoder().encode(String(url)).buffer;
  },
});

const resolved = resolvePackAudioFormat(pulsePack, {
  support: { m4a: "probably", ogg: "probably", wav: "probably" },
  useSession: false,
});

const manager = new WavStemMusicManager({ pack: resolved.pack });
await manager.play("normal");

const info = manager.getAudioFormatInfo();
const debug = manager.getDebugState();

const errors = [];
if (info.format !== "ogg") errors.push(`expected final format ogg, got ${info.format}`);
if (!info.attempts.some((attempt) => attempt.stage === "stems" && attempt.format === "m4a")) {
  errors.push("expected a recorded M4A stem decode failure");
}
if (!debug.stemBuffersReady) errors.push("expected all stem buffers to be ready after OGG fallback");
if (!manager.running) errors.push("expected manager to be running after fallback");

manager.stop();

if (errors.length) {
  console.error("Music Runtime Decode Fallback Check FAILED");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log("Music Runtime Decode Fallback Check PASSED");
console.log(`- candidate chain: ${info.candidates.join(" -> ")}`);
console.log(`- final format: ${info.format}`);
console.log(`- recorded failures: ${info.attempts.length}`);
