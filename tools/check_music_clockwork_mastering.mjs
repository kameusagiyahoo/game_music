import { WavStemMusicManager } from "../src/wav-stem-manager.js";
import { clockworkPack } from "../src/music-packs/clockwork.js";

class FakeAudioParam {
  constructor(value = 0) { this.value = value; }
  cancelScheduledValues() {}
  setValueAtTime(value) { this.value = value; }
  exponentialRampToValueAtTime(value) { this.value = value; }
}

class FakeNode {
  constructor() { this.connections = []; }
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
    this.sampleRate = 48_000;
    this.destination = new FakeNode();
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
const near = (a, b, epsilon = 1e-6) =>
  Math.abs(Number(a) - Number(b)) <= epsilon;

const manager = new WavStemMusicManager({ pack: clockworkPack });
await manager.init();

const info = manager.getMasteringInfo();
const expectedTrim = 10 ** (-3.5 / 20);

if (info.profile !== "clockwork-balanced-v1") {
  errors.push(`profile mismatch: ${info.profile}`);
}
if (!near(info.headroomDb, -3.5)) {
  errors.push(`headroom mismatch: ${info.headroomDb}`);
}
if (!near(info.trimGain, expectedTrim)) {
  errors.push(`trim gain mismatch: ${info.trimGain}`);
}
if (!near(info.limiter.thresholdDb, -1.75)) {
  errors.push(`limiter threshold mismatch: ${info.limiter.thresholdDb}`);
}
if (!near(info.limiter.kneeDb, 0)) {
  errors.push(`limiter knee mismatch: ${info.limiter.kneeDb}`);
}
if (!near(info.limiter.ratio, 20)) {
  errors.push(`limiter ratio mismatch: ${info.limiter.ratio}`);
}
if (!near(info.limiter.attack, 0.0035)) {
  errors.push(`limiter attack mismatch: ${info.limiter.attack}`);
}
if (!near(info.limiter.release, 0.14)) {
  errors.push(`limiter release mismatch: ${info.limiter.release}`);
}
if (manager.master.connections[0] !== manager.masterTrim) {
  errors.push("master is not connected to Clockwork headroom trim");
}
if (manager.masterTrim.connections[0] !== manager.limiter) {
  errors.push("Clockwork headroom trim is not connected to limiter");
}
if (!manager.limiter.connections.includes(manager.context.destination)) {
  errors.push("Clockwork limiter is not connected to destination");
}

if (errors.length) {
  console.error("Clockwork Runtime Mastering Check FAILED");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log("Clockwork Runtime Mastering Check PASSED");
console.log("- profile: clockwork-balanced-v1");
console.log("- headroom: -3.5 dB");
console.log("- limiter: -1.75 dB / 20:1");
console.log("- attack/release: 3.5 ms / 140 ms");
console.log("- graph: Master -> Trim -> Limiter -> Destination");
