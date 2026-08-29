import { MusicManager } from "../src/music-manager.js";
import { WavStemMusicManager } from "../src/wav-stem-manager.js";
import { pulsePack } from "../src/music-packs/pulse.js";
import { fantasyPack } from "../src/music-packs/fantasy.js";

class FakeAudioParam {
  constructor(value = 1) {
    this.value = value;
    this.events = [];
  }
  cancelScheduledValues(time) { this.events.push(["cancel", time]); }
  setValueAtTime(value, time) {
    this.value = value;
    this.events.push(["set", value, time]);
  }
  exponentialRampToValueAtTime(value, time) {
    this.value = value;
    this.events.push(["exp", value, time]);
  }
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

const sourceStartTimes = [];

class FakeBufferSource extends FakeNode {
  constructor() {
    super();
    this.buffer = null;
    this.loop = false;
    this.loopStart = 0;
    this.loopEnd = 0;
    this.onended = null;
  }
  start(time = 0) {
    this.startedAt = time;
    sourceStartTimes.push(time);
  }
  stop() {}
}

class FakeOscillator extends FakeNode {
  constructor() {
    super();
    this.type = "sine";
    this.frequency = {
      value: 0,
      setValueAtTime() {},
      exponentialRampToValueAtTime() {},
    };
  }
  start() {}
  stop() {}
}

class FakeBiquad extends FakeNode {
  constructor() {
    super();
    this.type = "highpass";
    this.frequency = { value: 0 };
  }
}

class FakeAudioContext {
  constructor() {
    this.state = "running";
    this.currentTime = 0;
    this.sampleRate = 44100;
    this.destination = {};
  }
  createGain() { return new FakeGain(); }
  createDynamicsCompressor() { return new FakeCompressor(); }
  createBufferSource() { return new FakeBufferSource(); }
  createOscillator() { return new FakeOscillator(); }
  createBiquadFilter() { return new FakeBiquad(); }
  createBuffer(channels, length) {
    return {
      getChannelData() { return new Float32Array(length); },
    };
  }
  async resume() {}
  async decodeAudioData() { return { duration: 1 }; }
}

let intervalCallback = null;
let timeoutCallback = null;

globalThis.window = {
  AudioContext: FakeAudioContext,
  webkitAudioContext: FakeAudioContext,
  setInterval(callback) {
    intervalCallback = callback;
    return 1;
  },
  clearInterval() {},
  setTimeout(callback) {
    timeoutCallback = callback;
    return 1;
  },
  clearTimeout() {},
};

globalThis.fetch = async (url) => ({
  ok: true,
  status: 200,
  clone() { return this; },
  async arrayBuffer() {
    return new TextEncoder().encode(String(url)).buffer;
  },
});

const errors = [];
const near = (a, b, epsilon = 0.0001) => Math.abs(a - b) <= epsilon;

// WAV engine: exact AudioContext quantization.
const wav = new WavStemMusicManager({ pack: pulsePack });
await wav.play("normal");

const beatSeconds = 60 / 112;
const transportStart = wav.transportStart;

wav.context.currentTime = transportStart + 0.22;
const nextBeat = wav.getQuantizedTime("beat");
const nextBar = wav.getQuantizedTime("bar");

if (!near(nextBeat, transportStart + beatSeconds)) {
  errors.push(`WAV next beat mismatch: ${nextBeat}`);
}
if (!near(nextBar, transportStart + beatSeconds * 4)) {
  errors.push(`WAV next bar mismatch: ${nextBar}`);
}

await wav.transitionTo("result", { quantize: "beat" });
await wav.setLayerPreset("result", { quantize: "beat", fadeBeats: 1 });

if (wav.mode !== "normal") errors.push("WAV mode changed before beat boundary");

wav.context.currentTime = transportStart + beatSeconds + 0.001;
intervalCallback?.();

if (wav.mode !== "result") errors.push("WAV mode did not change at beat boundary");
if (wav.layerPreset !== "result") errors.push("WAV layer preset did not change at beat boundary");

wav.context.currentTime = transportStart + beatSeconds * 1.25;
const expectedStingerBar = transportStart + beatSeconds * 4;
const stinger = await wav.playStinger("victory", {
  quantize: "bar",
  duck: 0.26,
  attack: 0.06,
  release: 0.30,
});

if (!near(stinger.scheduledAt, expectedStingerBar)) {
  errors.push(`Stinger scheduledAt mismatch: ${stinger.scheduledAt}`);
}
if (!near(sourceStartTimes.at(-1), expectedStingerBar)) {
  errors.push(`AudioBufferSource.start did not use bar boundary: ${sourceStartTimes.at(-1)}`);
}
if (!wav.getStingerInfo().pending) errors.push("Stinger should be pending before scheduled bar");

const duckEvent = wav.musicRoot.gain.events
  .filter((event) => event[0] === "exp")
  .at(-1);
if (!duckEvent || !near(duckEvent[2], expectedStingerBar)) {
  errors.push("BGM duck ramp does not end at Stinger boundary");
}

if (!wav.cancelPendingStinger()) errors.push("Pending Stinger could not be cancelled");
if (wav.getStingerInfo().pending) errors.push("Pending Stinger remained after cancellation");

wav.stop();

// Procedural engine: beat boundary transition.
let proceduralMode = "normal";
const procedural = new MusicManager({
  pack: fantasyPack,
  onModeChange(_label, info = {}) {
    if (info.mode) proceduralMode = info.mode;
  },
});

await procedural.play("normal");
await procedural.transitionTo("tension", {
  quantize: "beat",
  crossfadeBeats: 0.5,
});

if (procedural.mode !== "normal") errors.push("Procedural mode changed before beat boundary");

// play() has already executed step 0. Advance step 1 and then step 2 (next beat).
timeoutCallback?.();
timeoutCallback?.();

if (procedural.mode !== "tension" || proceduralMode !== "tension") {
  errors.push(`Procedural mode did not switch on beat boundary: ${procedural.mode}`);
}

procedural.stop();

if (errors.length) {
  console.error("Music Quantization Check FAILED");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log("Music Quantization Check PASSED");
console.log(`- WAV beat: ${nextBeat.toFixed(4)}s`);
console.log(`- WAV bar: ${nextBar.toFixed(4)}s`);
console.log(`- Stinger bar start: ${stinger.scheduledAt.toFixed(4)}s`);
console.log("- WAV mode/layer beat quantization: OK");
console.log("- procedural mode beat quantization: OK");
