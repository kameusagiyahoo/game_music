import { createMusicFacade } from "../src/music-facade.js";
import { WavStemMusicManager } from "../src/wav-stem-manager.js";
import { pulsePack } from "../src/music-packs/pulse.js";

class FakeAudioParam {
  constructor(value = 0) {
    this.value = value;
  }
  cancelScheduledValues() {}
  setValueAtTime(value) { this.value = value; }
  exponentialRampToValueAtTime(value) { this.value = value; }
}

class FakeNode {
  constructor(name = "node") {
    this.name = name;
    this.connections = [];
  }
  connect(target) {
    this.connections.push(target);
    return target;
  }
  disconnect() {}
}

class FakeGain extends FakeNode {
  constructor(name = "gain") {
    super(name);
    this.gain = new FakeAudioParam(1);
  }
}

let analyserCount = 0;
class FakeAnalyser extends FakeNode {
  constructor() {
    super("analyser");
    this.fftSize = 512;
    this.smoothingTimeConstant = 0;
    this.index = analyserCount++;
  }
  getFloatTimeDomainData(target) {
    const scale = this.index % 2 === 0 ? 0.5 : 0.25;
    const pattern = [scale, -scale, scale / 2, -scale / 2];
    for (let i = 0; i < target.length; i += 1) {
      target[i] = pattern[i % pattern.length];
    }
  }
}

class FakeCompressor extends FakeNode {
  constructor() {
    super("compressor");
    this.threshold = { value: 0 };
    this.knee = { value: 0 };
    this.ratio = { value: 1 };
    this.attack = { value: 0 };
    this.release = { value: 0 };
    this.reduction = -2.75;
  }
}

class FakeAudioContext {
  constructor() {
    this.state = "running";
    this.currentTime = 4.25;
    this.sampleRate = 48_000;
    this.destination = new FakeNode("destination");
  }
  createGain() { return new FakeGain(); }
  createDynamicsCompressor() { return new FakeCompressor(); }
  createAnalyser() { return new FakeAnalyser(); }
  async resume() {}
}

globalThis.window = {
  AudioContext: FakeAudioContext,
  webkitAudioContext: FakeAudioContext,
};

const errors = [];
const near = (a, b, epsilon = 0.03) => Math.abs(Number(a) - Number(b)) <= epsilon;

const manager = new WavStemMusicManager({ pack: pulsePack });
await manager.init();

const meter = manager.getMeterSnapshot();

if (!meter.supported) errors.push("meter should be supported when createAnalyser exists");
if (meter.sampleRate !== 48_000) errors.push(`expected actual AudioContext sample rate 48000, got ${meter.sampleRate}`);
if (!near(meter.preLimiter.peakDbfs, -6.02)) {
  errors.push(`pre-limiter peak mismatch: ${meter.preLimiter.peakDbfs}`);
}
if (!near(meter.preLimiter.rmsDbfs, -8.06)) {
  errors.push(`pre-limiter RMS mismatch: ${meter.preLimiter.rmsDbfs}`);
}
if (!near(meter.output.peakDbfs, -12.04)) {
  errors.push(`output peak mismatch: ${meter.output.peakDbfs}`);
}
if (!near(meter.output.rmsDbfs, -14.08)) {
  errors.push(`output RMS mismatch: ${meter.output.rmsDbfs}`);
}
if (!near(meter.limiterReductionDb, -2.75)) {
  errors.push(`limiter reduction mismatch: ${meter.limiterReductionDb}`);
}

if (manager.masterTrim.connections[0] !== manager.limiter) {
  errors.push("main mastering path changed: masterTrim must connect directly to limiter");
}
if (!manager.masterTrim.connections.includes(manager.preMasterAnalyser)) {
  errors.push("pre-limiter analyser is not on monitor branch");
}
if (!manager.limiter.connections.includes(manager.context.destination)) {
  errors.push("main limiter output is not connected to destination");
}
if (!manager.limiter.connections.includes(manager.outputAnalyser)) {
  errors.push("output analyser is not connected to limiter monitor branch");
}
if (manager.meterSink?.gain?.value !== 0) {
  errors.push(`meter sink must be silent, got gain=${manager.meterSink?.gain?.value}`);
}
if (!manager.meterSink?.connections?.includes(manager.context.destination)) {
  errors.push("meter sink is not connected to destination");
}

const facade = createMusicFacade({
  packId: "pulse",
  formatOptions: {
    support: { m4a: "probably", ogg: "probably", wav: "probably" },
    useSession: false,
  },
});
await facade.runtime.manager.init();
const facadeMeter = facade.meter();

if (!facade.capabilities.realtimeMeter) {
  errors.push("Facade realtimeMeter capability is false");
}
if (!facadeMeter.supported) {
  errors.push("Facade meter() did not return active meter");
}
if (!near(facadeMeter.limiterReductionDb, -2.75)) {
  errors.push("Facade meter() limiter reduction mismatch");
}

const noAnalyserContext = globalThis.window.AudioContext;
class NoAnalyserContext extends FakeAudioContext {
  constructor() {
    super();
    this.createAnalyser = undefined;
  }
}
globalThis.window.AudioContext = NoAnalyserContext;
globalThis.window.webkitAudioContext = NoAnalyserContext;
const fallback = new WavStemMusicManager({ pack: pulsePack });
await fallback.init();
if (fallback.getMeterSnapshot().supported) {
  errors.push("meter should degrade gracefully when AnalyserNode is unavailable");
}
globalThis.window.AudioContext = noAnalyserContext;
globalThis.window.webkitAudioContext = noAnalyserContext;

if (errors.length) {
  console.error("Music Realtime Meter Check FAILED");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log("Music Realtime Meter Check PASSED");
console.log(`- pre peak: ${meter.preLimiter.peakDbfs.toFixed(2)} dBFS`);
console.log(`- output peak: ${meter.output.peakDbfs.toFixed(2)} dBFS`);
console.log(`- limiter reduction: ${meter.limiterReductionDb.toFixed(2)} dB`);
console.log(`- AudioContext sample rate: ${meter.sampleRate} Hz`);
console.log("- zero-gain monitoring branch: OK");
console.log("- Facade meter(): OK");
