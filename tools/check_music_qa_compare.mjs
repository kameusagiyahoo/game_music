import {
  validateQaReport,
  compareQaReports,
  qaComparisonToCsv,
  qaComparisonFilename,
} from "../src/music-qa-compare.js";

const errors = [];
const near = (a, b, epsilon = 0.0001) => Math.abs(Number(a) - Number(b)) <= epsilon;

function report({
  generatedAt = "2026-09-01T00:00:00.000Z",
  packVersion = "1.4.0",
  sampleRate = 48_000,
  duration = 60,
  coverage = 100,
  peak = -1.5,
  rms = -18,
  reduction = 2,
  over3 = 3,
  over6 = 0,
  clip = 0,
  verdict = "pass",
  modes = {},
  hotSwaps = [],
  hotSwapQa = null,
} = {}) {
  return {
    schemaVersion: "1.0.0",
    generatedAt,
    metadata: {
      packId: "pulse",
      packVersion,
      masteringProfile: "game-balanced-v1",
      initialSampleRate: sampleRate,
    },
    summary: {
      durationSeconds: duration,
      observedDurationSeconds: duration,
      samplingCoveragePercent: coverage,
      maxOutputPeakDbfs: peak,
      averageOutputRmsDbfs: rms,
      maxLimiterReductionMagnitudeDb: reduction,
      limiterOver3Seconds: over3,
      limiterOver6Seconds: over6,
      clipRiskSeconds: clip,
      verdict,
      modes,
      hotSwaps,
      hotSwapQa: hotSwapQa || {
        status: hotSwaps.length ? "pass" : "not-applicable",
        evaluatedCount: hotSwaps.length,
        failures: [],
        warnings: [],
        swaps: [],
      },
    },
    events: [],
    samples: [],
  };
}

const baseline = report({
  modes: {
    normal: {
      durationSeconds: 30,
      maxOutputPeakDbfs: -3,
      averageOutputRmsDbfs: -20,
      maxLimiterReductionMagnitudeDb: 1,
    },
    overdrive: {
      durationSeconds: 30,
      maxOutputPeakDbfs: -1.5,
      averageOutputRmsDbfs: -17,
      maxLimiterReductionMagnitudeDb: 2.5,
    },
  },
});

const regression = report({
  generatedAt: "2026-09-01T00:10:00.000Z",
  packVersion: "1.5.0",
  peak: -0.2,
  rms: -17.3,
  reduction: 6,
  over3: 10,
  over6: 4,
  clip: 0.2,
  verdict: "fail",
  modes: {
    normal: {
      durationSeconds: 30,
      maxOutputPeakDbfs: -2.8,
      averageOutputRmsDbfs: -19.8,
      maxLimiterReductionMagnitudeDb: 1.2,
    },
    overdrive: {
      durationSeconds: 25,
      maxOutputPeakDbfs: 0.5,
      averageOutputRmsDbfs: -16,
      maxLimiterReductionMagnitudeDb: 5,
    },
    result: {
      durationSeconds: 5,
      maxOutputPeakDbfs: -0.2,
      averageOutputRmsDbfs: -15,
      maxLimiterReductionMagnitudeDb: 6,
    },
  },
});

const comparison = compareQaReports(baseline, regression);

if (!comparison.valid) errors.push("regression comparison should be valid");
if (comparison.status !== "fail") errors.push(`expected fail comparison, got ${comparison.status}`);
if (!near(comparison.metrics.maxOutputPeakDb.delta, 1.3)) {
  errors.push(`peak delta mismatch: ${comparison.metrics.maxOutputPeakDb.delta}`);
}
if (!near(comparison.metrics.averageOutputRmsDb.delta, 0.7)) {
  errors.push(`RMS delta mismatch: ${comparison.metrics.averageOutputRmsDb.delta}`);
}
if (!near(comparison.metrics.maxLimiterReductionMagnitudeDb.delta, 4)) {
  errors.push("limiter reduction delta mismatch");
}
if (!near(comparison.metrics.limiterOver3.deltaRate, 7 / 60)) {
  errors.push(`limiter >=3 rate mismatch: ${comparison.metrics.limiterOver3.deltaRate}`);
}
if (comparison.summary.rmsDirection !== "louder") errors.push("RMS direction should be louder");
if (comparison.summary.limiterDirection !== "more") errors.push("limiter direction should be more");
if (!["review", "fail"].includes(comparison.modes.overdrive?.status)) {
  errors.push(`overdrive regression not detected: ${comparison.modes.overdrive?.status}`);
}
if (comparison.modes.result?.presence !== "new") errors.push("new result mode not detected");

// Raw seconds differ, normalized rate is identical.
const sixtySeconds = report({
  duration: 60,
  over3: 6,
  over6: 0,
  modes: {},
});
const thirtySeconds = report({
  duration: 30,
  over3: 3,
  over6: 0,
  modes: {},
});
const normalized = compareQaReports(sixtySeconds, thirtySeconds);

if (!near(normalized.metrics.limiterOver3.deltaSeconds, -3)) {
  errors.push("raw limiter seconds delta mismatch");
}
if (!near(normalized.metrics.limiterOver3.deltaRate, 0)) {
  errors.push(`duration-normalized limiter rate should be unchanged: ${normalized.metrics.limiterOver3.deltaRate}`);
}
if (normalized.status === "review" || normalized.status === "fail") {
  errors.push(`normalized equal-rate comparison should not regress: ${normalized.status}`);
}

// Clear improvement in a common mode.
const hot = report({
  peak: -0.5,
  reduction: 5,
  over3: 12,
  modes: {
    overdrive: {
      durationSeconds: 60,
      maxOutputPeakDbfs: -0.5,
      averageOutputRmsDbfs: -17,
      maxLimiterReductionMagnitudeDb: 5,
    },
  },
});
const safer = report({
  peak: -3,
  reduction: 2,
  over3: 2,
  modes: {
    overdrive: {
      durationSeconds: 60,
      maxOutputPeakDbfs: -3,
      averageOutputRmsDbfs: -18,
      maxLimiterReductionMagnitudeDb: 2,
    },
  },
});
const improvement = compareQaReports(hot, safer);
if (improvement.status !== "improved") {
  errors.push(`expected improved comparison, got ${improvement.status}`);
}
if (improvement.modes.overdrive?.status !== "improved") {
  errors.push("overdrive mode improvement not detected");
}

// Hot Swap baseline regression comparison.
const swap = ({
  fromId = "pulse",
  toId = "fantasy",
  curve = "equal-power-v1",
  quantize = "bar",
  durationSeconds = 1,
  peak = -2,
  reduction = 1,
  midpointRmsDelta = -0.5,
  minPower = 1,
} = {}) => ({
  fromId,
  toId,
  curve,
  quantize,
  durationSeconds,
  crossfadeSampleCount: 10,
  maxOutputPeakDbfs: peak,
  maxLimiterReductionMagnitudeDb: reduction,
  midpointRmsDeltaDb: midpointRmsDelta,
  minPowerCoefficientSum: minPower,
});

const hotBaseline = report({
  hotSwaps: [swap()],
});
const hotSame = report({
  generatedAt: "2026-09-01T00:20:00.000Z",
  hotSwaps: [swap()],
});
const hotSameComparison = compareQaReports(hotBaseline, hotSame);
if (hotSameComparison.hotSwaps?.status !== "pass") {
  errors.push(`identical Hot Swap should pass: ${hotSameComparison.hotSwaps?.status}`);
}
if (hotSameComparison.status !== "pass") {
  errors.push(`identical Hot Swap overall should pass: ${hotSameComparison.status}`);
}

const hotPeakRegression = report({
  hotSwaps: [swap({ peak: 0.1 })],
});
const hotPeakComparison = compareQaReports(hotBaseline, hotPeakRegression);
if (hotPeakComparison.hotSwaps?.status !== "fail") {
  errors.push(`Hot Swap +2.1 dB peak should fail: ${hotPeakComparison.hotSwaps?.status}`);
}
if (hotPeakComparison.status !== "fail") {
  errors.push("Hot Swap regression did not propagate to overall comparison");
}

const hotLimiterRegression = report({
  hotSwaps: [swap({ reduction: 3.6 })],
});
if (compareQaReports(hotBaseline, hotLimiterRegression).hotSwaps?.status !== "fail") {
  errors.push("Hot Swap +2.6 dB limiter regression was not rejected");
}

const hotMidRmsRegression = report({
  hotSwaps: [swap({ midpointRmsDelta: -4.7 })],
});
if (compareQaReports(hotBaseline, hotMidRmsRegression).hotSwaps?.status !== "fail") {
  errors.push("Hot Swap midpoint RMS regression was not rejected");
}

const hotPowerRegression = report({
  hotSwaps: [swap({ minPower: 0.91 })],
});
if (compareQaReports(hotBaseline, hotPowerRegression).hotSwaps?.status !== "fail") {
  errors.push("Hot Swap power sum regression was not rejected");
}

const hotDurationReview = report({
  hotSwaps: [swap({ durationSeconds: 1.25 })],
});
if (compareQaReports(hotBaseline, hotDurationReview).hotSwaps?.status !== "review") {
  errors.push("Hot Swap +25% duration change should require review");
}

const hotRouteChange = report({
  hotSwaps: [swap({ toId: "neon" })],
});
const hotRouteComparison = compareQaReports(hotBaseline, hotRouteChange);
if (hotRouteComparison.hotSwaps?.status !== "review") {
  errors.push("Hot Swap route change should require review");
}
if (hotRouteComparison.hotSwaps?.routeChangeCount !== 2) {
  errors.push(`Hot Swap route change count mismatch: ${hotRouteComparison.hotSwaps?.routeChangeCount}`);
}

const hotCurveChange = report({
  hotSwaps: [swap({ curve: "exponential-v30" })],
});
if (compareQaReports(hotBaseline, hotCurveChange).hotSwaps?.status !== "review") {
  errors.push("Hot Swap curve change should require review");
}

const hotImproved = report({
  peak: -2.5,
  reduction: 1,
  over3: 1,
  hotSwaps: [swap({
    peak: -3.2,
    reduction: 0,
    midpointRmsDelta: 1.6,
    minPower: 1.04,
  })],
});
const hotImprovedBaseline = report({
  peak: -1.5,
  reduction: 2,
  over3: 3,
  hotSwaps: [swap()],
});
const hotImprovementComparison = compareQaReports(hotImprovedBaseline, hotImproved);
if (hotImprovementComparison.hotSwaps?.status !== "improved") {
  errors.push(`Hot Swap improvement not detected: ${hotImprovementComparison.hotSwaps?.status}`);
}
if (hotImprovementComparison.status !== "improved") {
  errors.push(`Hot Swap improvement should contribute to overall improved: ${hotImprovementComparison.status}`);
}

// Coverage/sample-rate warnings should be visible and make comparison reviewable.
const lowCoverage = report({
  duration: 60,
  coverage: 72,
  sampleRate: 44_100,
});
const warnings = compareQaReports(baseline, lowCoverage);
if (!warnings.warnings.some((warning) => warning.code === "current-coverage")) {
  errors.push("low current coverage warning missing");
}
if (!warnings.warnings.some((warning) => warning.code === "sample-rate")) {
  errors.push("sample-rate warning missing");
}
if (warnings.status !== "review") {
  errors.push(`low-coverage comparison should require review: ${warnings.status}`);
}

// Scenario mismatch / abort must make a comparison reviewable.
const manualBaseline = report();
const scenarioCurrent = report();
scenarioCurrent.metadata.qaScenarioId = "pulse-standard-v1";
scenarioCurrent.metadata.qaScenarioExecution = {
  id: "pulse-standard-v1",
  version: "1.0.0",
  status: "completed",
  maxDriftMs: 120,
};
const scenarioMismatch = compareQaReports(manualBaseline, scenarioCurrent);
if (!scenarioMismatch.warnings.some((warning) => warning.code === "scenario-id")) {
  errors.push("manual vs automated scenario warning missing");
}
if (scenarioMismatch.status !== "review") {
  errors.push(`scenario mismatch should require review: ${scenarioMismatch.status}`);
}

const abortedBaseline = report();
const abortedCurrent = report();
abortedBaseline.metadata.qaScenarioId = "pulse-standard-v1";
abortedBaseline.metadata.qaScenarioExecution = {
  id: "pulse-standard-v1",
  version: "1.0.0",
  status: "completed",
  maxDriftMs: 90,
};
abortedCurrent.metadata.qaScenarioId = "pulse-standard-v1";
abortedCurrent.metadata.qaScenarioExecution = {
  id: "pulse-standard-v1",
  version: "1.0.0",
  status: "aborted",
  abortReason: "timing-drift:build:1100ms",
  maxDriftMs: 1100,
};
const abortedComparison = compareQaReports(abortedBaseline, abortedCurrent);
if (!abortedComparison.warnings.some((warning) => warning.code === "current-scenario-status")) {
  errors.push("aborted scenario status warning missing");
}
if (!abortedComparison.warnings.some((warning) => warning.code === "current-scenario-drift")) {
  errors.push("scenario drift warning missing");
}
if (abortedComparison.status !== "review") {
  errors.push(`aborted scenario comparison should require review: ${abortedComparison.status}`);
}

// Validation and export.
const invalid = validateQaReport({ metadata: {}, summary: {} });
if (invalid.valid) errors.push("invalid QA report passed validation");

const csv = qaComparisonToCsv(comparison);
if (!csv.includes("max_output_peak_dbfs")) errors.push("comparison CSV peak row missing");
if (!csv.includes("mode:overdrive:limiter_reduction_db")) errors.push("comparison CSV mode row missing");
const hotCsv = qaComparisonToCsv(hotPeakComparison);
if (!hotCsv.includes("hot-swap:pulse->fantasy#1:peak_db")) {
  errors.push("comparison CSV Hot Swap peak row missing");
}
if (!hotCsv.includes("hot-swap:pulse->fantasy#1:min_power_sum")) {
  errors.push("comparison CSV Hot Swap power row missing");
}

const filename = qaComparisonFilename(comparison, "json");
if (!filename.startsWith("game-music-qa-compare-pulse-") || !filename.endsWith(".json")) {
  errors.push(`comparison filename mismatch: ${filename}`);
}

if (errors.length) {
  console.error("Music QA Comparison Check FAILED");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log("Music QA Comparison Check PASSED");
console.log(`- regression status: ${comparison.status}`);
console.log(`- peak delta: ${comparison.metrics.maxOutputPeakDb.delta.toFixed(2)} dB`);
console.log(`- limiter >=3 rate delta: ${(comparison.metrics.limiterOver3.deltaRate * 100).toFixed(1)} pp`);
console.log(`- improvement status: ${improvement.status}`);
console.log("- duration normalization: OK");
console.log("- coverage warnings: OK");
console.log("- scenario compatibility warnings: OK");
console.log("- Hot Swap baseline regression compare: OK");
console.log("- Hot Swap route/curve compatibility: OK");
console.log("- Hot Swap CSV export: OK");
console.log("- CSV export: OK");
