import {
  applyMusicState,
  createMusicRuntime,
  playMusicOutcome,
} from "../src/music-asset-resolver.js";

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

const sourceStarts = [];

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
    sourceStarts.push(time);
  }
  stop() {}
}

class FakeOscillator extends FakeNode {
  constructor() {
    super();
    this.type = "sine";
    this.frequency = {
      setValueAtTime() {},
      exponentialRampToValueAtTime() {},
    };
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
    if (marker.includes("/fill.")) return { duration: 0.82 };
    if (marker.includes("/whoosh.")) return { duration: 0.72 };
    if (marker.includes("/riser.")) return { duration: 1.12 };
    if (marker.includes("/impact.")) return { duration: 0.95 };
    if (marker.includes("/victory.")) return { duration: 2.25 };
    return { duration: 1 };
  }
}

let intervalCallback = null;

globalThis.window = {
  AudioContext: FakeAudioContext,
  webkitAudioContext: FakeAudioContext,
  setInterval(callback) {
    intervalCallback = callback;
    return 1;
  },
  clearInterval() {},
};

globalThis.fetch = async (url) => ({
  ok: true,
  status: 200,
  async arrayBuffer() {
    return new TextEncoder().encode(String(url)).buffer;
  },
});

const runtime = createMusicRuntime({
  packId: "pulse",
  formatOptions: {
    support: { m4a: "probably", ogg: "probably", wav: "probably" },
    useSession: false,
  },
});
const music = runtime.manager;
await music.play("normal");

const errors = [];
const near = (a, b, epsilon = 0.001) => Math.abs(a - b) <= epsilon;
const beatSeconds = 60 / 112;
const barSeconds = beatSeconds * 4;
const transportStart = music.transportStart;

music.context.currentTime = transportStart + 0.20;

const config = music.getTransitionCueForMode("overdrive");
if (config?.cue !== "fill" || config?.position !== "before") {
  errors.push(`overdrive cue map mismatch: ${JSON.stringify(config)}`);
}

const stateResult = await applyMusicState(runtime, "tension", { quantize: "bar" });
const cue = stateResult.transitionCue;

if (cue?.name !== "fill") errors.push(`expected fill cue, got ${cue?.name}`);
if (cue?.position !== "before") errors.push(`expected before position, got ${cue?.position}`);
if (!cue?.transitionAt || !cue?.scheduledAt) errors.push("transition cue timing metadata missing");
if (!near(cue.scheduledAt + cue.duration, cue.transitionAt)) {
  errors.push(`fill does not end at transition boundary: ${cue.scheduledAt} + ${cue.duration} != ${cue.transitionAt}`);
}
if (!near(cue.transitionAt, transportStart + barSeconds)) {
  errors.push(`fill transition boundary mismatch: ${cue.transitionAt}`);
}
if (!near(runtime.lastTransitionAt, cue.transitionAt)) {
  errors.push("runtime lastTransitionAt does not match cue transitionAt");
}
if (!near(music.pendingModeTransition?.scheduledAt, cue.transitionAt)) {
  errors.push("mode transition is not aligned with cue transitionAt");
}
if (!near(music.pendingLayerScheduledAt, cue.transitionAt)) {
  errors.push("layer transition is not aligned with cue transitionAt");
}

const outcome = await playMusicOutcome(runtime, true, { quantize: "bar" });
if (!near(outcome.scheduledAt, cue.transitionAt)) {
  errors.push(`Victory Stinger is not aligned with State transition: ${outcome.scheduledAt}`);
}

music.context.currentTime = cue.transitionAt + 0.003;
intervalCallback?.();

if (music.mode !== "overdrive") errors.push(`mode did not become overdrive: ${music.mode}`);
if (music.layerPreset !== "overdrive") errors.push(`layer preset did not become overdrive: ${music.layerPreset}`);

music.context.currentTime = cue.transitionAt + barSeconds * 0.25;
const impact = await music.playTransitionCue("impact", {
  quantize: "bar",
  position: "at",
});
const expectedImpact = cue.transitionAt + barSeconds;

if (!near(impact.scheduledAt, expectedImpact)) {
  errors.push(`impact did not start at next bar: ${impact.scheduledAt}`);
}
if (!near(impact.transitionAt, impact.scheduledAt)) {
  errors.push("impact transitionAt should equal scheduledAt");
}

if (!sourceStarts.some((time) => near(time, cue.scheduledAt))) {
  errors.push("fill AudioBufferSource was not scheduled at pre-roll start");
}
if (!sourceStarts.some((time) => near(time, cue.transitionAt))) {
  errors.push("Victory Stinger was not scheduled at transition boundary");
}
if (!sourceStarts.some((time) => near(time, impact.scheduledAt))) {
  errors.push("impact AudioBufferSource was not scheduled at bar boundary");
}

music.stop();

if (errors.length) {
  console.error("Music Transition Cue Check FAILED");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log("Music Transition Cue Check PASSED");
console.log(`- fill start: ${cue.scheduledAt.toFixed(4)}s`);
console.log(`- fill ends / state starts: ${cue.transitionAt.toFixed(4)}s`);
console.log(`- victory aligned: ${outcome.scheduledAt.toFixed(4)}s`);
console.log(`- impact starts: ${impact.scheduledAt.toFixed(4)}s`);
