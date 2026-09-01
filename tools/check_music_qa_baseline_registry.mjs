import {
  QA_BASELINE_STORAGE_KEY,
  compactQaBaselineReport,
  getQaBaselineEligibility,
  saveQaPackBaseline,
  loadQaPackBaseline,
  listQaPackBaselines,
  deleteQaPackBaseline,
  clearQaPackBaselines,
  getQaBaselineCompatibility,
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
  audioFormat = "m4a",
  facadeApi = "1.5.0",
  scenarioVersion = "1.0.0",
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
      audioFormat,
      facadeApi,
      initialSampleRate: sampleRate,
      qaScenarioId: scenarioId,
      qaScenarioVersion: scenarioVersion,
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


const missingFormat = getQaBaselineEligibility(report({ audioFormat: null }));
if (missingFormat.eligible) errors.push("baseline without audio format should be rejected");

const missingRate = getQaBaselineEligibility(report({ sampleRate: 0 }));
if (missingRate.eligible) errors.push("baseline without sample rate should be rejected");

const missingVersion = getQaBaselineEligibility(report({ packVersion: null }));
if (missingVersion.eligible) errors.push("baseline without pack version should be rejected");

const missingMastering = getQaBaselineEligibility(report({ masteringProfile: null }));
if (missingMastering.eligible) errors.push("baseline without mastering profile should be rejected");

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


const compatibilityBaseline = saveQaPackBaseline(valid, {
  storage,
  approvedAt: "2026-09-01T12:10:00.000Z",
});

const exactCompatibility = getQaBaselineCompatibility(
  compatibilityBaseline,
  report(),
);
if (!exactCompatibility.comparable || exactCompatibility.status !== "exact") {
  errors.push("same device contract should be EXACT");
}

const versionCompatibility = getQaBaselineCompatibility(
  compatibilityBaseline,
  report({ packVersion: "1.5.0" }),
);
if (!versionCompatibility.comparable || versionCompatibility.status !== "review") {
  errors.push("pack-version-only change should be REVIEW but comparable");
}
if (!versionCompatibility.warnings.some((item) => item.code === "pack-version")) {
  errors.push("pack-version REVIEW warning missing");
}

const formatCompatibility = getQaBaselineCompatibility(
  compatibilityBaseline,
  report({ audioFormat: "ogg" }),
);
if (formatCompatibility.comparable || formatCompatibility.status !== "incompatible") {
  errors.push("M4A -> OGG should be INCOMPATIBLE");
}

const rateCompatibility = getQaBaselineCompatibility(
  compatibilityBaseline,
  report({ sampleRate: 44_100 }),
);
if (rateCompatibility.comparable || rateCompatibility.status !== "incompatible") {
  errors.push("48 kHz -> 44.1 kHz should be INCOMPATIBLE");
}

const masteringCompatibility = getQaBaselineCompatibility(
  compatibilityBaseline,
  report({ masteringProfile: "other-mastering-v1" }),
);
if (masteringCompatibility.comparable) {
  errors.push("mastering-profile change should be INCOMPATIBLE");
}

const scenarioCompatibility = getQaBaselineCompatibility(
  compatibilityBaseline,
  report({ scenarioId: "pulse-standard-v2" }),
);
if (scenarioCompatibility.comparable) {
  errors.push("scenario change should be INCOMPATIBLE");
}

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
console.log("- completed Standard 60s report with device contract: eligible");
console.log("- missing format/rate/version/mastering: blocked");
console.log("- wrong/aborted/low-coverage/FAIL reports: blocked");
console.log("- EXACT same-contract comparison: OK");
console.log("- pack version only: REVIEW + comparable");
console.log("- format/sample-rate/mastering/scenario mismatch: INCOMPATIBLE");
console.log("- per-pack save/load/replace/delete: OK");
console.log("- compact storage drops raw samples/events");
console.log("- corrupted localStorage fails closed");
