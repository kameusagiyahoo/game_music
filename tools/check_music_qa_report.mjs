import {
  createQaSession,
  addQaSample,
  finalizeQaSession,
  qaReportToCsv,
  qaReportFilename,
} from "../src/music-qa-report.js";

const errors = [];
const near = (a, b, epsilon = 0.02) => Math.abs(Number(a) - Number(b)) <= epsilon;

function meter({
  mode = "normal",
  preset = "focus",
  prePeak = -2,
  preRms = -18,
  outPeak = -3,
  outRms = -20,
  reduction = 0,
  stinger = null,
  transitionCue = null,
} = {}) {
  return {
    mode,
    layerPreset: preset,
    sampleRate: 48_000,
    preLimiter: { peakDbfs: prePeak, rmsDbfs: preRms },
    output: { peakDbfs: outPeak, rmsDbfs: outRms },
    limiterReductionDb: reduction,
    stinger,
    transitionCue,
    stems: {
      drums: { gain: 0.8, active: true },
      bass: { gain: 0.6, active: true },
    },
  };
}

const session = createQaSession({
  startedAtMs: 1_000,
  targetDurationSeconds: 1,
  sampleIntervalMs: 100,
  metadata: {
    packId: "pulse",
    packVersion: "1.4.0",
    masteringProfile: "game-balanced-v1",
  },
});

addQaSample(session, meter({
  outPeak: -1.0,
  outRms: -20,
  reduction: 0,
}), { capturedAtMs: 1_000, bar: 1, beat: 1 });

addQaSample(session, meter({
  outPeak: -0.5,
  outRms: -20,
  reduction: -3.5,
  stinger: { name: "victory", pending: true, playing: false },
}), { capturedAtMs: 1_100, bar: 1, beat: 2 });

addQaSample(session, meter({
  mode: "result",
  preset: "result",
  outPeak: -0.1,
  outRms: -10,
  reduction: -6.5,
  stinger: { name: "victory", pending: false, playing: true },
  transitionCue: { name: "impact", pending: true, playing: false },
}), { capturedAtMs: 1_200, bar: 1, beat: 3 });

addQaSample(session, meter({
  mode: "result",
  preset: "result",
  outPeak: -2.0,
  outRms: -10,
  reduction: -2.0,
  transitionCue: { name: "impact", pending: false, playing: true },
}), { capturedAtMs: 1_300, bar: 1, beat: 4 });

const report = finalizeQaSession(session, { endedAtMs: 1_400 });
const summary = report.summary;

if (!near(summary.durationSeconds, 0.4)) errors.push(`duration mismatch: ${summary.durationSeconds}`);
if (!near(summary.observedDurationSeconds, 0.4)) errors.push(`observed duration mismatch: ${summary.observedDurationSeconds}`);
if (!near(summary.samplingCoveragePercent, 100)) errors.push(`coverage mismatch: ${summary.samplingCoveragePercent}`);
if (summary.sampleCount !== 4) errors.push(`sample count mismatch: ${summary.sampleCount}`);
if (!near(summary.maxOutputPeakDbfs, -0.1)) errors.push(`max output peak mismatch: ${summary.maxOutputPeakDbfs}`);
if (!near(summary.averageOutputRmsDbfs, -12.596, 0.03)) {
  errors.push(`power-averaged RMS mismatch: ${summary.averageOutputRmsDbfs}`);
}
if (!near(summary.maxLimiterReductionMagnitudeDb, 6.5)) {
  errors.push(`max limiter reduction mismatch: ${summary.maxLimiterReductionMagnitudeDb}`);
}
if (!near(summary.limiterOver3Seconds, 0.2)) errors.push(`>=3 dB duration mismatch: ${summary.limiterOver3Seconds}`);
if (!near(summary.limiterOver6Seconds, 0.1)) errors.push(`>=6 dB duration mismatch: ${summary.limiterOver6Seconds}`);
if (!near(summary.clipRiskSeconds, 0.1)) errors.push(`clip-risk duration mismatch: ${summary.clipRiskSeconds}`);
if (summary.verdict !== "fail") errors.push(`expected fail verdict, got ${summary.verdict}`);

if (!near(summary.modes.normal?.durationSeconds, 0.2)) errors.push("normal mode duration mismatch");
if (!near(summary.modes.normal?.averageOutputRmsDbfs, -20)) errors.push("normal mode RMS mismatch");
if (!near(summary.modes.result?.durationSeconds, 0.2)) errors.push("result mode duration mismatch");
if (!near(summary.modes.result?.averageOutputRmsDbfs, -10)) errors.push("result mode RMS mismatch");

if (report.events.length !== 6) {
  errors.push(`expected 6 derived events, got ${report.events.length}`);
}
if (!report.events.some((event) => event.type === "stinger" && event.name === "victory" && event.state === "playing")) {
  errors.push("victory playing event missing");
}
if (!report.events.some((event) => event.type === "transition-cue" && event.name === "impact" && event.state === "playing")) {
  errors.push("impact playing event missing");
}

const csv = qaReportToCsv(report);
const csvLines = csv.split("\n");
if (csvLines.length !== 5) errors.push(`CSV line count mismatch: ${csvLines.length}`);
if (!csvLines[0].includes("output_peak_dbfs")) errors.push("CSV output_peak_dbfs column missing");
if (!csvLines[0].includes("stem_bass_gain") || !csvLines[0].includes("stem_drums_gain")) {
  errors.push("CSV stem gain columns missing");
}

const filename = qaReportFilename(report, "json");
if (!filename.startsWith("game-music-qa-pulse-") || !filename.endsWith(".json")) {
  errors.push(`QA filename mismatch: ${filename}`);
}

// Long Safari/background gap must not be counted as observed limiter time.
const gapSession = createQaSession({
  startedAtMs: 0,
  sampleIntervalMs: 100,
});
addQaSample(gapSession, meter({ reduction: -6 }), { capturedAtMs: 0 });
addQaSample(gapSession, meter({ reduction: -6 }), { capturedAtMs: 100 });
addQaSample(gapSession, meter({ reduction: -6 }), { capturedAtMs: 1_100 });
const gapReport = finalizeQaSession(gapSession, { endedAtMs: 1_200 });

if (!near(gapReport.summary.durationSeconds, 1.2)) errors.push("gap wall-clock duration mismatch");
if (!near(gapReport.summary.observedDurationSeconds, 0.45)) {
  errors.push(`gap observed duration mismatch: ${gapReport.summary.observedDurationSeconds}`);
}
if (!near(gapReport.summary.samplingGapSeconds, 0.75)) {
  errors.push(`sampling gap mismatch: ${gapReport.summary.samplingGapSeconds}`);
}
if (!near(gapReport.summary.samplingCoveragePercent, 37.5)) {
  errors.push(`sampling coverage mismatch: ${gapReport.summary.samplingCoveragePercent}`);
}
if (!near(gapReport.summary.maxSampleGapMs, 1000)) {
  errors.push(`max sample gap mismatch: ${gapReport.summary.maxSampleGapMs}`);
}
if (!near(gapReport.summary.limiterOver6Seconds, 0.45)) {
  errors.push("background gap was incorrectly counted as limiter time");
}

if (errors.length) {
  console.error("Music QA Report Check FAILED");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log("Music QA Report Check PASSED");
console.log(`- samples: ${summary.sampleCount}`);
console.log(`- average RMS: ${summary.averageOutputRmsDbfs.toFixed(2)} dBFS`);
console.log(`- max reduction: ${summary.maxLimiterReductionMagnitudeDb.toFixed(2)} dB`);
console.log(`- events: ${report.events.length}`);
console.log(`- gap coverage: ${gapReport.summary.samplingCoveragePercent.toFixed(1)}%`);
console.log("- CSV export: OK");
