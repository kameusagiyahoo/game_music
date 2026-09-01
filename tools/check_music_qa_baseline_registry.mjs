import {
  QA_BASELINE_STORAGE_KEY,
  QA_BASELINE_REGISTRY_SCHEMA_VERSION,
  QA_BASELINE_HISTORY_LIMIT,
  compactQaBaselineReport,
  getQaBaselineEligibility,
  saveQaPackBaseline,
  loadQaPackBaseline,
  loadQaPackBaselineEntry,
  listQaPackBaselineHistory,
  listQaPackBaselines,
  deleteQaPackBaselineEntry,
  deleteQaPackBaseline,
  clearQaPackBaselines,
  getQaBaselineCompatibility,
  createQaBaselineEntry,
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

for (const [label, candidate] of [
  ["missing format", report({ audioFormat: null })],
  ["missing sample rate", report({ sampleRate: 0 })],
  ["missing pack version", report({ packVersion: null })],
  ["missing mastering", report({ masteringProfile: null })],
  ["wrong scenario", report({ scenarioId: "manual-run" })],
  ["aborted scenario", report({ scenarioStatus: "aborted" })],
  ["low coverage", report({ coverage: 82 })],
  ["FAIL report", report({ verdict: "fail" })],
]) {
  if (getQaBaselineEligibility(candidate).eligible) {
    errors.push(label + " should be rejected");
  }
}

if (getQaBaselineEligibility(valid, { packId: "fantasy" }).eligible) {
  errors.push("pack mismatch should be rejected");
}

const compact = compactQaBaselineReport(valid);
if (compact.samples.length !== 0 || compact.events.length !== 0) {
  errors.push("compact baseline must drop raw samples/events");
}
if (compact.summary.averageOutputRmsDbfs !== valid.summary.averageOutputRmsDbfs) {
  errors.push("compact baseline lost summary metrics");
}

const compatibilityBaseline = createQaBaselineEntry(valid, {
  approvedAt: "2026-09-01T12:10:00.000Z",
});

const exactCompatibility = getQaBaselineCompatibility(compatibilityBaseline, report());
if (!exactCompatibility.comparable || exactCompatibility.status !== "exact") {
  errors.push("same device contract should be EXACT");
}

const legacyEntry = JSON.parse(JSON.stringify(compatibilityBaseline));
delete legacyEntry.audioFormat;
delete legacyEntry.sampleRate;
delete legacyEntry.facadeApi;
const legacyCompatibility = getQaBaselineCompatibility(legacyEntry, report());
if (!legacyCompatibility.comparable || legacyCompatibility.status !== "exact") {
  errors.push("legacy saved baseline metadata fallback should remain EXACT");
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

for (const [label, candidate] of [
  ["M4A -> OGG", report({ audioFormat: "ogg" })],
  ["48 kHz -> 44.1 kHz", report({ sampleRate: 44_100 })],
  ["mastering change", report({ masteringProfile: "other-mastering-v1" })],
  ["scenario change", report({ scenarioId: "pulse-standard-v2" })],
]) {
  const compatibility = getQaBaselineCompatibility(compatibilityBaseline, candidate);
  if (compatibility.comparable || compatibility.status !== "incompatible") {
    errors.push(label + " should be INCOMPATIBLE");
  }
}

// Legacy v1 storage must be readable as a one-entry history without data loss.
store.clear();
const legacySaved = createQaBaselineEntry(valid, {
  approvedAt: "2026-08-31T23:55:00.000Z",
});
store.set(QA_BASELINE_STORAGE_KEY, JSON.stringify({
  schemaVersion: "1.0.0",
  baselines: {
    pulse: {
      ...legacySaved,
      schemaVersion: "1.0.0",
    },
  },
}));

const migratedHistory = listQaPackBaselineHistory("pulse", { storage });
if (migratedHistory.length !== 1) {
  errors.push("legacy v1 baseline should migrate to one history entry");
}
if (migratedHistory[0]?.sourceGeneratedAt !== valid.generatedAt) {
  errors.push("legacy baseline report metadata was lost during migration");
}
if (!migratedHistory[0]?.id) {
  errors.push("legacy baseline migration should synthesize a stable entry id");
}

// Saving after legacy read should persist the new v2 schema.
saveQaPackBaseline(report({
  generatedAt: "2026-09-01T00:10:00.000Z",
}), {
  storage,
  approvedAt: "2026-09-01T00:11:00.000Z",
});
const persisted = JSON.parse(storage.getItem(QA_BASELINE_STORAGE_KEY));
if (persisted.schemaVersion !== QA_BASELINE_REGISTRY_SCHEMA_VERSION) {
  errors.push("legacy registry was not upgraded to current schema on save");
}
if (!Array.isArray(persisted.histories?.pulse)) {
  errors.push("current registry should persist per-pack histories");
}

// Build seven Pulse versions: only newest six may remain.
clearQaPackBaselines({ storage });
for (let index = 0; index < 7; index += 1) {
  const hour = String(10 + index).padStart(2, "0");
  saveQaPackBaseline(report({
    generatedAt: `2026-09-01T${hour}:00:00.000Z`,
    packVersion: `1.4.${index + 1}`,
  }), {
    storage,
    approvedAt: `2026-09-01T${hour}:05:00.000Z`,
  });
}

const pulseHistory = listQaPackBaselineHistory("pulse", { storage });
if (pulseHistory.length !== QA_BASELINE_HISTORY_LIMIT) {
  errors.push(
    `Pulse history should retain ${QA_BASELINE_HISTORY_LIMIT}, got ${pulseHistory.length}`
  );
}
if (pulseHistory[0]?.packVersion !== "1.4.7") {
  errors.push("latest Pulse baseline should be first in history");
}
if (pulseHistory.at(-1)?.packVersion !== "1.4.2") {
  errors.push("oldest retained Pulse baseline should be 1.4.2");
}
if (pulseHistory.some((entry) => entry.packVersion === "1.4.1")) {
  errors.push("seventh-oldest Pulse baseline should have been evicted");
}

const latestPulse = loadQaPackBaseline("pulse", { storage });
if (latestPulse?.id !== pulseHistory[0]?.id) {
  errors.push("loadQaPackBaseline should return latest history entry");
}
const selectedPulse = loadQaPackBaseline("pulse", {
  storage,
  id: pulseHistory[3].id,
});
if (selectedPulse?.id !== pulseHistory[3].id) {
  errors.push("pack history ID selection failed");
}
if (loadQaPackBaselineEntry(pulseHistory[2].id, { storage })?.id !== pulseHistory[2].id) {
  errors.push("global baseline entry ID lookup failed");
}

// Histories are per-pack and latest list remains backward compatible.
saveQaPackBaseline(report({
  packId: "fantasy",
  packVersion: "2.0.0",
  masteringProfile: "fantasy-gentle-v1",
  generatedAt: "2026-09-01T18:00:00.000Z",
}), {
  storage,
  approvedAt: "2026-09-01T18:05:00.000Z",
});
saveQaPackBaseline(report({
  packId: "fantasy",
  packVersion: "2.0.1",
  masteringProfile: "fantasy-gentle-v1",
  generatedAt: "2026-09-01T19:00:00.000Z",
}), {
  storage,
  approvedAt: "2026-09-01T19:05:00.000Z",
});

if (listQaPackBaselineHistory("fantasy", { storage }).length !== 2) {
  errors.push("Fantasy should keep its own two-entry history");
}
if (listQaPackBaselines({ storage }).length !== 2) {
  errors.push("listQaPackBaselines should return latest entry per Pack");
}
if (loadQaPackBaseline("fantasy", { storage })?.packVersion !== "2.0.1") {
  errors.push("Fantasy latest history lookup failed");
}

// Delete one selected entry only.
const deleteTarget = pulseHistory[2];
if (!deleteQaPackBaselineEntry(deleteTarget.id, { storage })) {
  errors.push("selected history entry delete failed");
}
const afterEntryDelete = listQaPackBaselineHistory("pulse", { storage });
if (afterEntryDelete.some((entry) => entry.id === deleteTarget.id)) {
  errors.push("selected history entry remained after delete");
}
if (afterEntryDelete.length !== QA_BASELINE_HISTORY_LIMIT - 1) {
  errors.push("selected entry delete should remove exactly one history item");
}

// Deleting by pack ID remains backward compatible and clears that Pack history only.
if (!deleteQaPackBaseline("fantasy", { storage })) {
  errors.push("Fantasy history delete failed");
}
if (listQaPackBaselineHistory("fantasy", { storage }).length !== 0) {
  errors.push("Fantasy history remained after pack delete");
}
if (listQaPackBaselineHistory("pulse", { storage }).length === 0) {
  errors.push("Pulse history should survive Fantasy pack delete");
}

// Corrupted storage must fail closed rather than crash.
storage.setItem(QA_BASELINE_STORAGE_KEY, "{broken-json");
if (listQaPackBaselines({ storage }).length !== 0) {
  errors.push("corrupted registry should read as empty");
}
if (listQaPackBaselineHistory("pulse", { storage }).length !== 0) {
  errors.push("corrupted registry history should read as empty");
}

saveQaPackBaseline(valid, { storage });
if (!clearQaPackBaselines({ storage })) {
  errors.push("clear registry failed");
}
if (loadQaPackBaseline("pulse", { storage })) {
  errors.push("baseline remained after clear");
}

if (errors.length) {
  console.error("Device QA Baseline History Check FAILED");
  errors.forEach((error) => console.error("- " + error));
  process.exit(1);
}

console.log("Device QA Baseline History Check PASSED");
console.log("- eligibility and Device Contract Gate: OK");
console.log("- legacy v1 single-entry storage -> v2 history migration: OK");
console.log("- per-Pack history: max 6 entries");
console.log("- seventh save evicts oldest entry");
console.log("- latest / ID-select / global ID lookup: OK");
console.log("- selected-entry delete / pack-history delete: OK");
console.log("- latest-per-Pack compatibility API: preserved");
console.log("- compact storage drops raw samples/events");
console.log("- corrupted localStorage fails closed");
