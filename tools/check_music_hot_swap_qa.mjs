import {
  WavStemMusicManager,
  PACK_CROSSFADE_CURVE,
  LEGACY_PACK_CROSSFADE_CURVE,
  samplePackCrossfadePoint,
} from "../src/wav-stem-manager.js";
import { pulsePack } from "../src/music-packs/pulse.js";
import {
  createQaSession,
  addQaSample,
  finalizeQaSession,
  qaReportToCsv,
  evaluateHotSwapQa,
} from "../src/music-qa-report.js";

const errors = [];
const near = (a, b, epsilon = 0.02) =>
  Math.abs(Number(a) - Number(b)) <= epsilon;

class FakeParam {
  constructor(value = 1) { this.value = value; }
  cancelScheduledValues() {}
  setValueAtTime(value) { this.value = value; }
  exponentialRampToValueAtTime(value) { this.value = value; }
  setValueCurveAtTime() {}
}

class FakeNode {
  constructor() { this.connections = []; }
  connect(target) { this.connections.push(target); return target; }
  disconnect() {}
}

class FakeGain extends FakeNode {
  constructor() { super(); this.gain = new FakeParam(1); }
}

class FakeCompressor extends FakeNode {
  constructor() {
    super();
    this.threshold = { value: 0 };
    this.knee = { value: 0 };
    this.ratio = { value: 1 };
    this.attack = { value: 0 };
    this.release = { value: 0 };
    this.reduction = -1.5;
  }
}

class FakeAnalyser extends FakeNode {
  constructor() {
    super();
    this.fftSize = 512;
    this.smoothingTimeConstant = 0;
  }
  getFloatTimeDomainData(target) {
    for (let i = 0; i < target.length; i += 1) {
      target[i] = i % 2 ? -0.2 : 0.2;
    }
  }
}

class FakeAudioContext {
  constructor() {
    this.currentTime = 11;
    this.state = "running";
    this.sampleRate = 48_000;
    this.destination = new FakeNode();
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

const midpoint = samplePackCrossfadePoint({
  mode: PACK_CROSSFADE_CURVE,
  progress: 0.5,
  outgoingGain: 1,
});
if (!near(midpoint.outgoingGain, Math.SQRT1_2, 0.001)) {
  errors.push(`equal-power outgoing midpoint mismatch: ${midpoint.outgoingGain}`);
}
if (!near(midpoint.incomingGain, Math.SQRT1_2, 0.001)) {
  errors.push(`equal-power incoming midpoint mismatch: ${midpoint.incomingGain}`);
}
if (!near(midpoint.powerCoefficientSum, 1, 0.001)) {
  errors.push(`equal-power midpoint sum mismatch: ${midpoint.powerCoefficientSum}`);
}

const legacyMidpoint = samplePackCrossfadePoint({
  mode: LEGACY_PACK_CROSSFADE_CURVE,
  progress: 0.5,
  outgoingGain: 1,
});
if (!(legacyMidpoint.powerCoefficientSum < 0.001)) {
  errors.push(`legacy midpoint should dip strongly: ${legacyMidpoint.powerCoefficientSum}`);
}

const manager = new WavStemMusicManager({ pack: pulsePack });
await manager.init();
manager.pendingPackSwitch = {
  fromPack: { id: "pulse", name: "Pulse" },
  nextPack: { id: "fantasy", name: "Fantasy" },
  scheduledAt: 10,
  fadeEnd: 12,
  fadeSeconds: 2,
  crossfadeBeats: 2,
  quantize: "bar",
  crossfadeCurve: PACK_CROSSFADE_CURVE,
  crossfadePoints: 129,
  outgoingStartGain: 1,
  committed: true,
};

const meter = manager.getMeterSnapshot();
if (meter.packId !== "pulse") errors.push(`meter pack id mismatch: ${meter.packId}`);
if (meter.hotSwap?.phase !== "crossfading") {
  errors.push(`meter hot-swap phase mismatch: ${meter.hotSwap?.phase}`);
}
if (!near(meter.hotSwap?.progress, 0.5, 0.001)) {
  errors.push(`meter hot-swap progress mismatch: ${meter.hotSwap?.progress}`);
}
if (!near(meter.hotSwap?.powerCoefficientSum, 1, 0.001)) {
  errors.push(`meter hot-swap power sum mismatch: ${meter.hotSwap?.powerCoefficientSum}`);
}

function qaMeter({
  packId = "pulse",
  peak = -2,
  rms = -20,
  reduction = 0,
  hotSwap = null,
} = {}) {
  return {
    packId,
    mode: "normal",
    layerPreset: "focus",
    sampleRate: 48_000,
    preLimiter: { peakDbfs: peak + 1, rmsDbfs: rms + 1 },
    output: { peakDbfs: peak, rmsDbfs: rms },
    limiterReductionDb: reduction,
    stinger: null,
    transitionCue: null,
    hotSwap,
    stems: {
      drums: { gain: 0.6, active: true },
      bass: { gain: 0.5, active: true },
    },
  };
}

const hot = (progress, phase = "crossfading") => {
  const point = samplePackCrossfadePoint({
    mode: PACK_CROSSFADE_CURVE,
    progress,
  });
  return {
    phase,
    fromId: "pulse",
    toId: "fantasy",
    curve: PACK_CROSSFADE_CURVE,
    quantize: "bar",
    scheduledAt: 10,
    fadeEnd: 10.4,
    fadeSeconds: 0.4,
    crossfadeBeats: 1,
    ...point,
  };
};

const session = createQaSession({
  startedAtMs: 1_000,
  sampleIntervalMs: 100,
  targetDurationSeconds: 1,
  metadata: { packId: "pulse" },
});

addQaSample(session, qaMeter({
  hotSwap: hot(0, "scheduled"),
  peak: -2.5,
  rms: -20,
}), { capturedAtMs: 1_000, bar: 1, beat: 1 });

addQaSample(session, qaMeter({
  hotSwap: hot(0.25),
  peak: -1.8,
  rms: -19,
  reduction: -2,
}), { capturedAtMs: 1_100, bar: 1, beat: 2 });

addQaSample(session, qaMeter({
  hotSwap: hot(0.5),
  peak: -0.8,
  rms: -22,
  reduction: -4.5,
}), { capturedAtMs: 1_200, bar: 1, beat: 3 });

addQaSample(session, qaMeter({
  packId: "fantasy",
  hotSwap: hot(0.75),
  peak: -1.2,
  rms: -18,
  reduction: -3,
}), { capturedAtMs: 1_300, bar: 1, beat: 4 });

addQaSample(session, qaMeter({
  packId: "fantasy",
  hotSwap: null,
  peak: -2,
  rms: -20,
}), { capturedAtMs: 1_400, bar: 2, beat: 1 });

const report = finalizeQaSession(session, { endedAtMs: 1_500 });
const summary = report.summary;

if (summary.hotSwapCount !== 1) {
  errors.push(`expected one hot swap, got ${summary.hotSwapCount}`);
}
if (!near(summary.hotSwapCrossfadeSeconds, 0.3, 0.02)) {
  errors.push(`hot-swap duration mismatch: ${summary.hotSwapCrossfadeSeconds}`);
}
if (!near(summary.hotSwapMaxOutputPeakDbfs, -0.8, 0.02)) {
  errors.push(`hot-swap peak mismatch: ${summary.hotSwapMaxOutputPeakDbfs}`);
}
if (!near(summary.hotSwapMinOutputRmsDbfs, -22, 0.02)) {
  errors.push(`hot-swap min RMS mismatch: ${summary.hotSwapMinOutputRmsDbfs}`);
}
if (!near(summary.hotSwapMaxLimiterReductionMagnitudeDb, 4.5, 0.02)) {
  errors.push(
    `hot-swap limiter mismatch: ${summary.hotSwapMaxLimiterReductionMagnitudeDb}`
  );
}
if (!near(summary.hotSwapMinPowerCoefficientSum, 1, 0.001)) {
  errors.push(
    `hot-swap power floor mismatch: ${summary.hotSwapMinPowerCoefficientSum}`
  );
}

const swap = summary.hotSwaps?.[0];
if (swap?.fromId !== "pulse" || swap?.toId !== "fantasy") {
  errors.push(`hot-swap route mismatch: ${swap?.fromId}->${swap?.toId}`);
}
if (swap?.curve !== PACK_CROSSFADE_CURVE) {
  errors.push(`hot-swap curve mismatch: ${swap?.curve}`);
}
if (swap?.crossfadeSampleCount !== 3) {
  errors.push(`hot-swap sample count mismatch: ${swap?.crossfadeSampleCount}`);
}

if (summary.hotSwapQa?.status !== "review") {
  errors.push(
    `expected current synthetic hot swap to REVIEW, got ${summary.hotSwapQa?.status}`
  );
}
if (summary.verdict !== "review") {
  errors.push(`hot-swap REVIEW should propagate to report verdict: ${summary.verdict}`);
}

const hotEvents = report.events.filter((event) => event.type === "hot-swap");
if (!hotEvents.some((event) => event.state === "scheduled")) {
  errors.push("scheduled hot-swap event missing");
}
if (!hotEvents.some((event) => event.state === "crossfading")) {
  errors.push("crossfading hot-swap event missing");
}
if (!hotEvents.some((event) => event.state === "complete")) {
  errors.push("complete hot-swap event missing");
}

const csv = qaReportToCsv(report);
const header = csv.split("\n")[0];
for (const column of [
  "pack_id",
  "hot_swap_phase",
  "hot_swap_from",
  "hot_swap_to",
  "hot_swap_curve",
  "hot_swap_progress",
  "hot_swap_power_coefficient_sum",
]) {
  if (!header.includes(column)) errors.push(`CSV column missing: ${column}`);
}


const safeGate = evaluateHotSwapQa([{
  fromId: "pulse",
  toId: "fantasy",
  curve: PACK_CROSSFADE_CURVE,
  crossfadeSampleCount: 10,
  maxOutputPeakDbfs: -2.0,
  maxLimiterReductionMagnitudeDb: 1.2,
  minPowerCoefficientSum: 0.9999,
  edgeAverageOutputRmsDbfs: -20.0,
  midpointAverageOutputRmsDbfs: -20.6,
  midpointRmsDeltaDb: -0.6,
}]);
if (safeGate.status !== "pass") {
  errors.push(`safe Hot Swap gate should PASS: ${safeGate.status}`);
}

const legacyGate = evaluateHotSwapQa([{
  fromId: "pulse",
  toId: "fantasy",
  curve: LEGACY_PACK_CROSSFADE_CURVE,
  crossfadeSampleCount: 10,
  maxOutputPeakDbfs: -2.0,
  maxLimiterReductionMagnitudeDb: 1.0,
  minPowerCoefficientSum: 0.0002,
  edgeAverageOutputRmsDbfs: -20.0,
  midpointAverageOutputRmsDbfs: -20.5,
  midpointRmsDeltaDb: -0.5,
}]);
if (legacyGate.status !== "fail") {
  errors.push(`legacy power collapse should FAIL: ${legacyGate.status}`);
}
if (!legacyGate.failures.some((message) => message.includes("power coefficient"))) {
  errors.push("legacy power-collapse failure reason missing");
}

const rmsDipGate = evaluateHotSwapQa([{
  fromId: "fantasy",
  toId: "neon",
  curve: PACK_CROSSFADE_CURVE,
  crossfadeSampleCount: 10,
  maxOutputPeakDbfs: -2.0,
  maxLimiterReductionMagnitudeDb: 1.0,
  minPowerCoefficientSum: 1.0,
  edgeAverageOutputRmsDbfs: -20.0,
  midpointAverageOutputRmsDbfs: -30.5,
  midpointRmsDeltaDb: -10.5,
}]);
if (rmsDipGate.status !== "fail") {
  errors.push(`midpoint RMS dip should FAIL: ${rmsDipGate.status}`);
}

const limiterGate = evaluateHotSwapQa([{
  fromId: "neon",
  toId: "clockwork",
  curve: PACK_CROSSFADE_CURVE,
  crossfadeSampleCount: 10,
  maxOutputPeakDbfs: -1.0,
  maxLimiterReductionMagnitudeDb: 7.0,
  minPowerCoefficientSum: 1.0,
  edgeAverageOutputRmsDbfs: -20.0,
  midpointAverageOutputRmsDbfs: -21.0,
  midpointRmsDeltaDb: -1.0,
}]);
if (limiterGate.status !== "fail") {
  errors.push(`7 dB limiter Hot Swap should FAIL: ${limiterGate.status}`);
}

const peakGate = evaluateHotSwapQa([{
  fromId: "clockwork",
  toId: "pulse",
  curve: PACK_CROSSFADE_CURVE,
  crossfadeSampleCount: 10,
  maxOutputPeakDbfs: -0.05,
  maxLimiterReductionMagnitudeDb: 1.0,
  minPowerCoefficientSum: 1.0,
  edgeAverageOutputRmsDbfs: -20.0,
  midpointAverageOutputRmsDbfs: -20.5,
  midpointRmsDeltaDb: -0.5,
}]);
if (peakGate.status !== "fail") {
  errors.push(`-0.05 dBFS Hot Swap peak should FAIL: ${peakGate.status}`);
}

const sparseGate = evaluateHotSwapQa([{
  fromId: "pulse",
  toId: "neon",
  curve: PACK_CROSSFADE_CURVE,
  crossfadeSampleCount: 2,
  maxOutputPeakDbfs: -2.0,
  maxLimiterReductionMagnitudeDb: 1.0,
  minPowerCoefficientSum: 1.0,
  midpointRmsDeltaDb: null,
}]);
if (sparseGate.status !== "review") {
  errors.push(`sparse Hot Swap should REVIEW: ${sparseGate.status}`);
}

const noSwapGate = evaluateHotSwapQa([]);
if (noSwapGate.status !== "not-applicable") {
  errors.push(`no Hot Swap should be not-applicable: ${noSwapGate.status}`);
}

// Verify a Hot Swap hard failure propagates into the overall QA verdict.
const failSession = createQaSession({
  startedAtMs: 2_000,
  sampleIntervalMs: 100,
  targetDurationSeconds: 1,
});
for (let index = 0; index < 5; index += 1) {
  const progress = index / 4;
  const bad = hot(progress);
  if (index === 2) bad.powerCoefficientSum = 0.0002;
  addQaSample(failSession, qaMeter({
    hotSwap: bad,
    peak: -2,
    rms: -20,
    reduction: -1,
  }), {
    capturedAtMs: 2_000 + index * 100,
  });
}
const failReport = finalizeQaSession(failSession, { endedAtMs: 2_500 });
if (failReport.summary.hotSwapQa?.status !== "fail") {
  errors.push("Hot Swap hard failure did not produce hotSwapQa FAIL");
}
if (failReport.summary.verdict !== "fail") {
  errors.push("Hot Swap hard failure did not propagate to overall QA verdict");
}

if (errors.length) {
  console.error("Hot Swap QA Integration Check FAILED");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log("Hot Swap QA Integration Check PASSED");
console.log("- realtime meter hot-swap metadata: OK");
console.log("- equal-power midpoint: 0.7071 / 0.7071 / power=1.0");
console.log("- legacy midpoint dip remains measurable: OK");
console.log("- QA crossfade window summary: OK");
console.log("- Hot Swap safety gate PASS / REVIEW / FAIL semantics: OK");
console.log("- Hot Swap hard failure propagates to overall QA verdict: OK");
console.log("- scheduled/crossfading/complete events: OK");
console.log("- CSV hot-swap columns: OK");
