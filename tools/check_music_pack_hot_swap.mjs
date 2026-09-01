import { WavStemMusicManager } from "../src/wav-stem-manager.js";
import { createMusicFacade } from "../src/music-facade.js";
import { pulsePack } from "../src/music-packs/pulse.js";
import { fantasyPack } from "../src/music-packs/fantasy.js";
import { neonPack } from "../src/music-packs/neon.js";
import { clockworkPack } from "../src/music-packs/clockwork.js";

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
  setValueCurveAtTime(values, time, duration) {
    const curve = Array.from(values);
    this.value = curve.at(-1);
    this.events.push(["curve", curve, time, duration]);
  }
  exponentialRampToValueAtTime(value, time) {
    this.value = value;
    this.events.push(["exp", value, time]);
  }
}

class FakeNode {
  constructor() { this.connections = []; }
  connect(target) {
    this.connections.push(target);
    return target;
  }
  disconnect() { this.disconnected = true; }
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
    this.threshold = new FakeAudioParam(0);
    this.knee = new FakeAudioParam(0);
    this.ratio = new FakeAudioParam(1);
    this.attack = new FakeAudioParam(0);
    this.release = new FakeAudioParam(0);
    this.reduction = 0;
  }
}

const sourceEvents = [];

class FakeBufferSource extends FakeNode {
  constructor() {
    super();
    this.buffer = null;
    this.loop = false;
    this.loopStart = 0;
    this.loopEnd = 0;
    this.onended = null;
    this.stopCalls = [];
  }
  start(time = 0) {
    this.startedAt = time;
    sourceEvents.push({
      type: "start",
      time,
      label: this.buffer?.label || "",
      source: this,
    });
  }
  stop(time = null) {
    this.stopCalls.push(time);
    sourceEvents.push({
      type: "stop",
      time,
      label: this.buffer?.label || "",
      source: this,
    });
  }
}

class FakeAudioContext {
  constructor() {
    this.state = "running";
    this.currentTime = 0;
    this.sampleRate = 44_100;
    this.destination = new FakeNode();
  }
  createGain() { return new FakeGain(); }
  createDynamicsCompressor() { return new FakeCompressor(); }
  createBufferSource() { return new FakeBufferSource(); }
  async resume() {}
  async decodeAudioData(data) {
    const label = new TextDecoder().decode(new Uint8Array(data));
    const duration = label.includes("/fantasy/")
      ? 8.8889
      : label.includes("/neon/")
        ? 7.2727
        : label.includes("/clockwork/")
          ? 8.8889
          : 8.5714;
    return { duration, label };
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
  setTimeout(callback) {
    callback();
    return 1;
  },
  clearTimeout() {},
  dispatchEvent() {},
};

const storageMap = new Map();
const storage = {
  getItem(key) { return storageMap.has(key) ? storageMap.get(key) : null; },
  setItem(key, value) { storageMap.set(key, String(value)); },
  removeItem(key) { storageMap.delete(key); },
};
globalThis.localStorage = storage;
globalThis.sessionStorage = storage;

globalThis.fetch = async (url) => ({
  ok: true,
  status: 200,
  clone() { return this; },
  async arrayBuffer() {
    return new TextEncoder().encode(String(url)).buffer;
  },
});

const errors = [];
const near = (a, b, epsilon = 0.0002) =>
  Math.abs(Number(a) - Number(b)) <= epsilon;

const packEvents = [];
const manager = new WavStemMusicManager({
  pack: pulsePack,
  onPackChange(info) { packEvents.push(info); },
});

await manager.play("normal");
const context = manager.context;
const originalContext = context;
const pulseTransportStart = manager.transportStart;
const pulseBeat = 60 / 112;

context.currentTime = pulseTransportStart + 0.20;
const swap = await manager.switchPack(fantasyPack, {
  quantize: "bar",
  crossfadeBeats: 2,
  mode: "overdrive",
});

const expectedBoundary = pulseTransportStart + pulseBeat * 4;
const expectedFadeEnd = expectedBoundary + pulseBeat * 2;

if (!near(swap.scheduledAt, expectedBoundary)) {
  errors.push(`Pulse -> Fantasy boundary mismatch: ${swap.scheduledAt}`);
}
if (!near(swap.fadeEnd, expectedFadeEnd)) {
  errors.push(`Pulse -> Fantasy fade end mismatch: ${swap.fadeEnd}`);
}
if (manager.getPackInfo().id !== "pulse") {
  errors.push("active pack changed before quantized boundary");
}
if (manager.getPackInfo().pendingId !== "fantasy") {
  errors.push("Fantasy was not exposed as pending pack");
}
if (manager.getPackInfo().hotSwap?.curve !== "equal-power-v1") {
  errors.push(`hot swap curve mismatch: ${manager.getPackInfo().hotSwap?.curve}`);
}
if (manager.getPackInfo().hotSwap?.curvePoints !== 129) {
  errors.push(`hot swap curve point count mismatch: ${manager.getPackInfo().hotSwap?.curvePoints}`);
}

const scheduledSwap = manager.pendingPackSwitch;
const outgoingCurveEvent = scheduledSwap?.oldPackGain?.gain?.events
  ?.find((event) => event[0] === "curve");
const incomingCurveEvent = scheduledSwap?.nextPackGain?.gain?.events
  ?.find((event) => event[0] === "curve");
if (!outgoingCurveEvent || !incomingCurveEvent) {
  errors.push("hot swap did not schedule equal-power AudioParam curves");
} else {
  if (!near(outgoingCurveEvent[2], expectedBoundary) || !near(incomingCurveEvent[2], expectedBoundary)) {
    errors.push("equal-power curves did not start at the pack boundary");
  }
  if (!near(outgoingCurveEvent[3], pulseBeat * 2) || !near(incomingCurveEvent[3], pulseBeat * 2)) {
    errors.push("equal-power curve duration does not match two beats");
  }
  const mid = Math.floor((outgoingCurveEvent[1].length - 1) / 2);
  if (!near(outgoingCurveEvent[1][mid], Math.SQRT1_2, 0.0003)) {
    errors.push("outgoing hot-swap midpoint is not equal-power");
  }
  if (!near(incomingCurveEvent[1][mid], Math.SQRT1_2, 0.0003)) {
    errors.push("incoming hot-swap midpoint is not equal-power");
  }
}

const fantasyStarts = sourceEvents.filter(
  (event) => event.type === "start" && event.label.includes("/fantasy/")
);
if (fantasyStarts.length !== 5) {
  errors.push(`expected 5 scheduled Fantasy stems, got ${fantasyStarts.length}`);
}
if (fantasyStarts.some((event) => !near(event.time, expectedBoundary))) {
  errors.push("Fantasy stems were not scheduled at the exact same bar boundary");
}

context.currentTime = expectedBoundary + 0.001;
intervalCallback?.();

if (manager.context !== originalContext) {
  errors.push("hot swap replaced AudioContext");
}
if (manager.getPackInfo().id !== "fantasy") {
  errors.push(`Fantasy did not become active at boundary: ${manager.getPackInfo().id}`);
}
if (manager.getPackInfo().pendingId !== null) {
  errors.push("pending pack remained after boundary activation");
}
if (manager.getPackInfo().hotSwap?.phase !== "crossfading") {
  errors.push("hot swap did not enter crossfading phase");
}
if (!near(manager.transportStart, expectedBoundary)) {
  errors.push("new Fantasy transport did not restart at swap boundary");
}
if (manager.mode !== "overdrive" || manager.layerPreset !== "overdrive") {
  errors.push(`target state was not preserved: ${manager.mode}/${manager.layerPreset}`);
}
if (manager.getMasteringInfo().profile !== "fantasy-gentle-v1") {
  errors.push(`Fantasy mastering profile not active: ${manager.getMasteringInfo().profile}`);
}
if (!packEvents.some((event) => event.id === "fantasy" && event.phase === "crossfading")) {
  errors.push("onPackChange did not report Fantasy boundary activation");
}

context.currentTime = expectedFadeEnd + 0.01;
intervalCallback?.();

if (manager.getPackInfo().hotSwap !== null) {
  errors.push("hot swap state remained after fade cleanup");
}
if (!packEvents.some((event) => event.id === "fantasy" && event.phase === "complete")) {
  errors.push("onPackChange did not report completed crossfade");
}

// Cancellation must leave the active pack untouched.
context.currentTime = manager.transportStart + 0.15;
await manager.switchPack(neonPack, {
  quantize: "bar",
  crossfadeBeats: 1.5,
  mode: "normal",
});
if (manager.getPackInfo().pendingId !== "neon") {
  errors.push("Neon cancellation fixture was not pending");
}
if (!manager.cancelPendingPackSwitch()) {
  errors.push("pending Neon hot swap could not be cancelled");
}
if (manager.getPackInfo().id !== "fantasy" || manager.getPackInfo().pendingId !== null) {
  errors.push("cancelled swap changed the active Fantasy pack");
}

// Updating the same pending pack must not create a second decode/schedule.
// It should only change the target state.
context.currentTime = manager.transportStart + 0.22;
await manager.switchPack(clockworkPack, {
  quantize: "bar",
  crossfadeBeats: 1,
  mode: "normal",
});
const clockworkStartsBefore = sourceEvents.filter(
  (event) => event.type === "start" && event.label.includes("/clockwork/")
).length;
const pendingClockwork = manager.getPackInfo().hotSwap;
await manager.switchPack(clockworkPack, {
  quantize: "bar",
  crossfadeBeats: 1,
  mode: "tension",
});
const clockworkStartsAfter = sourceEvents.filter(
  (event) => event.type === "start" && event.label.includes("/clockwork/")
).length;

if (clockworkStartsAfter !== clockworkStartsBefore) {
  errors.push("updating pending Clockwork state scheduled duplicate stem sources");
}

context.currentTime = Number(pendingClockwork?.scheduledAt || 0) + 0.001;
intervalCallback?.();
if (manager.getPackInfo().id !== "clockwork") {
  errors.push("Clockwork did not activate at updated pending boundary");
}
if (manager.mode !== "overdrive" || manager.layerPreset !== "overdrive") {
  errors.push(`tension alias did not map to Clockwork overdrive: ${manager.mode}/${manager.layerPreset}`);
}

manager.stop();

// Facade integration: runtime entry must update only at the actual boundary.
intervalCallback = null;
sourceEvents.length = 0;
storageMap.clear();

const facadeEvents = [];
const facade = createMusicFacade({
  packId: "pulse",
  formatOptions: {
    support: { m4a: "probably", ogg: "probably", wav: "probably" },
    useSession: false,
  },
  callbacks: {
    onPackChange(info) { facadeEvents.push(info); },
  },
});

await facade.start("normal");
const facadeContext = facade.runtime.manager.context;
const facadeStart = facade.runtime.manager.transportStart;
facadeContext.currentTime = facadeStart + 0.18;
const facadeSwap = await facade.pack("fantasy", {
  quantize: "bar",
  crossfadeBeats: 2,
  mode: "normal",
});

if (facade.entry.id !== "pulse") {
  errors.push("Facade entry changed before pack boundary");
}
if (facade.info().pendingId !== "fantasy") {
  errors.push("Facade did not expose pending Fantasy pack");
}
if (facade.capabilities.hotSwapPackCrossfade !== true) {
  errors.push("Facade capability hotSwapPackCrossfade is not enabled");
}

facadeContext.currentTime = facadeSwap.hotSwap?.scheduledAt
  ? facadeSwap.hotSwap.scheduledAt + 0.001
  : facadeStart + (60 / 112) * 4 + 0.001;
intervalCallback?.();

if (facade.entry.id !== "fantasy") {
  errors.push(`Facade runtime entry did not update at boundary: ${facade.entry.id}`);
}
if (!facadeEvents.some((event) => event.id === "fantasy" && event.phase === "crossfading")) {
  errors.push("Facade callback did not receive Fantasy hot-swap activation");
}

facade.stop();

if (errors.length) {
  console.error("Real Audio Pack Hot Swap Check FAILED");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log("Real Audio Pack Hot Swap Check PASSED");
console.log("- same AudioContext across pack switch: OK");
console.log("- 5 replacement stems start at exact next-bar boundary: OK");
console.log("- old/new packs crossfade for configured beats: OK");
console.log("- equal-power pack crossfade curve: OK");
console.log("- BPM transport restarts at new pack boundary: OK");
console.log("- pending pack cancellation: OK");
console.log("- pending state update without duplicate decode: OK");
console.log("- Facade runtime entry updates at activation boundary: OK");
