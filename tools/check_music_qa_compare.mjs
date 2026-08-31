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

// Validation and export.
const invalid = validateQaReport({ metadata: {}, summary: {} });
if (invalid.valid) errors.push("invalid QA report passed validation");

const csv = qaComparisonToCsv(comparison);
if (!csv.includes("max_output_peak_dbfs")) errors.push("comparison CSV peak row missing");
if (!csv.includes("mode:overdrive:limiter_reduction_db")) errors.push("comparison CSV mode row missing");

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
console.log("- CSV export: OK");
