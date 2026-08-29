import { createMusicRuntime, getRuntimeDescriptor } from "../src/music-asset-resolver.js";
import { pulsePack } from "../src/music-packs/pulse.js";
import { WavStemMusicManager } from "../src/wav-stem-manager.js";

class FakeAudioParam {
  constructor(value = 0) {
    this.value = value;
  }
  cancelScheduledValues() {}
  setValueAtTime(value) { this.value = value; }
  exponentialRampToValueAtTime(value) { this.value = value; }
}

class FakeNode {
  constructor() {
    this.connections = [];
  }
  connect(target) {
    this.connections.push(target);
    return target;
  }
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
    this.ratio = { value: 1 };
    this.attack = { value: 0 };
    this.release = { value: 0 };
    this.reduction = 0;
  }
}

class FakeAudioContext {
  constructor() {
    this.state = "running";
    this.currentTime = 0;
    this.destination = { name: "destination" };
  }
  createGain() { return new FakeGain(); }
  createDynamicsCompressor() { return new FakeCompressor(); }
  async resume() {}
}

globalThis.window = {
  AudioContext: FakeAudioContext,
  webkitAudioContext: FakeAudioContext,
};

const errors = [];
const near = (a, b, epsilon = 1e-6) => Math.abs(Number(a) - Number(b)) <= epsilon;
const expectedTrimGain = 10 ** (-3 / 20);

const manager = new WavStemMusicManager({ pack: pulsePack });
await manager.init();

const info = manager.getMasteringInfo();

if (info.profile !== "game-balanced-v1") {
  errors.push(`mastering profile mismatch: ${info.profile}`);
}
if (!near(info.headroomDb, -3)) {
  errors.push(`headroom mismatch: ${info.headroomDb}`);
}
if (!near(info.trimGain, expectedTrimGain)) {
  errors.push(`trim gain mismatch: ${info.trimGain}`);
}
if (!near(info.limiter.thresholdDb, -1.5)) {
  errors.push(`limiter threshold mismatch: ${info.limiter.thresholdDb}`);
}
if (!near(info.limiter.kneeDb, 0)) {
  errors.push(`limiter knee mismatch: ${info.limiter.kneeDb}`);
}
if (!near(info.limiter.ratio, 20)) {
  errors.push(`limiter ratio mismatch: ${info.limiter.ratio}`);
}
if (!near(info.limiter.attack, 0.003)) {
  errors.push(`limiter attack mismatch: ${info.limiter.attack}`);
}
if (!near(info.limiter.release, 0.12)) {
  errors.push(`limiter release mismatch: ${info.limiter.release}`);
}

if (manager.master.connections[0] !== manager.masterTrim) {
  errors.push("master is not connected to headroom trim");
}
if (manager.masterTrim.connections[0] !== manager.limiter) {
  errors.push("headroom trim is not connected to limiter");
}
if (manager.limiter.connections[0] !== manager.context.destination) {
  errors.push("limiter is not connected to AudioContext destination");
}

const runtime = createMusicRuntime({
  packId: "pulse",
  formatOptions: {
    support: { m4a: "probably", ogg: "probably", wav: "probably" },
    useSession: false,
  },
});
const descriptor = getRuntimeDescriptor(runtime);

if (!descriptor?.capabilities?.mastering) {
  errors.push("runtime mastering capability is not enabled");
}
if (descriptor?.masteringProfile !== "game-balanced-v1") {
  errors.push(`runtime mastering profile mismatch: ${descriptor?.masteringProfile}`);
}
if (descriptor?.mastering?.profile !== "game-balanced-v1") {
  errors.push("runtime descriptor does not expose manager mastering state");
}

if (errors.length) {
  console.error("Music Mastering Runtime Check FAILED");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log("Music Mastering Runtime Check PASSED");
console.log(`- profile: ${info.profile}`);
console.log(`- headroom: ${info.headroomDb} dB`);
console.log(`- trim gain: ${info.trimGain.toFixed(6)}`);
console.log(`- limiter threshold: ${info.limiter.thresholdDb} dB`);
console.log(`- limiter ratio: ${info.limiter.ratio}:1`);
