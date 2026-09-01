import {
  QA_BASELINE_STORAGE_KEY,
  compactQaBaselineReport,
  getQaBaselineEligibility,
  saveQaPackBaseline,
  loadQaPackBaseline,
  listQaPackBaselines,
  deleteQaPackBaseline,
  clearQaPackBaselines,
} from "../src/music-qa-baseline-registry.js";

const store = new Map();
const storage = {
  getItem(key) { return store.has(key) ? store.get(key) : null; },
  setItem(key, value) { store.set(key, String(value)); },
  removeItem(key) { store.delete(key); },
};

const errors = [];

function report({
  packId = "pulse",
  scenarioId = packId + "-standard-v1",
  scenarioStatus = "completed",
  coverage = 98,
  verdict = "pass",
  generatedAt = "2026-09-01T12:00:00.000Z",
  sampleRate = 48_000,
  packVersion = "1.4.1",
  masteringProfile = "game-balanced-v1",
} = {}) {
  return {
    schemaVersion: "1.0.0",
    generatedAt,
    targetDurationSeconds: 60,
    metadata: {
      packId,
      packName: packId.toUpperCase(),
      packVersion,
      masteringProfile,
      initialSampleRate: sampleRate,
      qaScenarioId: scenarioId,
      qaScenarioVersion: "1.0.0",
      qaScenarioStatus: scenarioStatus,
    },
    summary: {
      durationSeconds: 60,
      observedDurationSeconds: 58.8,
      samplingCoveragePercent: coverage,
      maxOutputPeakDbfs: -1.5,
      averageOutputRmsDbfs: -18.4,
      maxLimiterReductionMagnitudeDb: 2.1,
      limiterOver3Seconds: 0.5,
      limiterOver6Seconds: 0,
      clipRiskSeconds: 0,
      verdict,
      modes: {},
      scenarioStages: {},
      hotSwaps: [],
      hotSwapQa: {
        status: "not-applicable",
        evaluatedCount: 0,
        failures: [],
        warnings: [],
        swaps: [],
      },
    },
    events: [{ type: "test-event" }],
    samples: [
      { capturedAtMs: 1, outputPeakDbfs: -2 },
      { capturedAtMs: 2, outputPeakDbfs: -1.5 },
    ],
  };
}

const valid = report();
const eligibility = getQaBaselineEligibility(valid);
if (!eligibility.eligible) {
  errors.push("completed standard report should be eligible: " + eligibility.failures.join("; "));
}

const compact = compactQaBaselineReport(valid);
if (compact.samples.length !== 0 || compact.events.length !== 0) {
  errors.push("compact baseline must drop raw samples/events");
}
if (compact.summary.averageOutputRmsDbfs !== valid.summary.averageOutputRmsDbfs) {
  errors.push("compact baseline lost summary metrics");
}

const wrongScenario = getQaBaselineEligibility(report({ scenarioId: "manual-run" }));
if (wrongScenario.eligible) errors.push("wrong scenario should be rejected");

const aborted = getQaBaselineEligibility(report({ scenarioStatus: "aborted" }));
if (aborted.eligible) errors.push("aborted scenario should be rejected");

const lowCoverage = getQaBaselineEligibility(report({ coverage: 82 }));
if (lowCoverage.eligible) errors.push("low coverage should be rejected");

const failedReport = getQaBaselineEligibility(report({ verdict: "fail" }));
if (failedReport.eligible) errors.push("FAIL report should be rejected");

const wrongPack = getQaBaselineEligibility(valid, { packId: "fantasy" });
if (wrongPack.eligible) errors.push("pack mismatch should be rejected");

const savedPulse = saveQaPackBaseline(valid, {
  storage,
  approvedAt: "2026-09-01T12:10:00.000Z",
});
if (savedPulse.packId !== "pulse") errors.push("saved Pulse baseline pack mismatch");
if (!store.has(QA_BASELINE_STORAGE_KEY)) errors.push("baseline registry was not persisted");

const loadedPulse = loadQaPackBaseline("pulse", { storage });
if (!loadedPulse) errors.push("saved Pulse baseline could not be loaded");
if (loadedPulse?.report?.samples?.length !== 0) {
  errors.push("loaded baseline should remain compact");
}

saveQaPackBaseline(report({
  packId: "fantasy",
  packVersion: "2.0.0",
  masteringProfile: "fantasy-gentle-v1",
}), { storage });

if (listQaPackBaselines({ storage }).length !== 2) {
  errors.push("expected two pack baselines");
}

// Saving the same pack replaces only that pack entry.
saveQaPackBaseline(report({
  packId: "pulse",
  generatedAt: "2026-09-01T13:00:00.000Z",
}), { storage });
if (listQaPackBaselines({ storage }).length !== 2) {
  errors.push("same-pack save should replace rather than append");
}
if (loadQaPackBaseline("pulse", { storage })?.sourceGeneratedAt !== "2026-09-01T13:00:00.000Z") {
  errors.push("same-pack baseline was not replaced");
}

if (!deleteQaPackBaseline("fantasy", { storage })) {
  errors.push("Fantasy baseline delete failed");
}
if (loadQaPackBaseline("fantasy", { storage })) {
  errors.push("Fantasy baseline remained after delete");
}

// Corrupted storage must fail closed rather than crash.
storage.setItem(QA_BASELINE_STORAGE_KEY, "{broken-json");
if (listQaPackBaselines({ storage }).length !== 0) {
  errors.push("corrupted registry should read as empty");
}

saveQaPackBaseline(valid, { storage });
if (!clearQaPackBaselines({ storage })) {
  errors.push("clear registry failed");
}
if (loadQaPackBaseline("pulse", { storage })) {
  errors.push("baseline remained after clear");
}

if (errors.length) {
  console.error("Device QA Baseline Registry Check FAILED");
  errors.forEach((error) => console.error("- " + error));
  process.exit(1);
}

console.log("Device QA Baseline Registry Check PASSED");
console.log("- completed Standard 60s report: eligible");
console.log("- wrong/aborted/low-coverage/FAIL reports: blocked");
console.log("- per-pack save/load/replace/delete: OK");
console.log("- compact storage drops raw samples/events");
console.log("- corrupted localStorage fails closed");
