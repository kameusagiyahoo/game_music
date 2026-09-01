import {
  HOT_SWAP_ROUTE_MATRIX_ID,
  HOT_SWAP_ROUTE_MATRIX_PACKS,
  createHotSwapRouteMatrixScenario,
} from "../src/music-qa-route-matrix.js";
import {
  createQaSession,
  addQaSample,
  finalizeQaSession,
} from "../src/music-qa-report.js";
import {
  QA_ROUTE_BASELINE_STORAGE_KEY,
  QA_ROUTE_BASELINE_MAX_HISTORY,
  getQaRouteMatrixBaselineEligibility,
  getQaRouteMatrixBaselineCompatibility,
  saveQaRouteMatrixBaseline,
  listQaRouteMatrixBaselines,
  loadQaRouteMatrixBaseline,
  loadLatestQaRouteMatrixBaseline,
  deleteQaRouteMatrixBaseline,
  clearQaRouteMatrixBaselines,
} from "../src/music-qa-route-baseline-registry.js";

const errors = [];
const map = new Map();
const storage = {
  getItem(key) { return map.has(key) ? map.get(key) : null; },
  setItem(key, value) { map.set(key, String(value)); },
  removeItem(key) { map.delete(key); },
};

function meter({
  packId,
  hotSwap,
  peak = -2,
  rms = -20,
  reduction = -1,
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
    stems: {},
  };
}

function packContracts({
  versionPatch = {},
  formatPatch = {},
  masteringPatch = {},
} = {}) {
  const definitions = {
    fantasy: ["2.0.0", "fantasy-gentle-v1"],
    neon: ["2.0.0", "neon-drive-v1"],
    pulse: ["1.4.1", "game-balanced-v1"],
    clockwork: ["2.0.0", "clockwork-balanced-v1"],
  };
  return HOT_SWAP_ROUTE_MATRIX_PACKS.map((id) => ({
    id,
    version: versionPatch[id] || definitions[id][0],
    masteringProfile: masteringPatch[id] || definitions[id][1],
    facadeApi: "1.5.0",
    audioFormat: formatPatch[id] || "m4a",
  }));
}

function buildReport({
  startPackId = "pulse",
  sampleRate = 48_000,
  versionPatch,
  formatPatch,
  masteringPatch,
  crossfadeCurve = "equal-power-v1",
  crossfadeBeats = 2,
  quantize = "bar",
  routeIntervalMs = 5_000,
  scenarioVersion = "1.0.0",
  coverageTargetSeconds = 6,
  generatedAtOffsetMs = 0,
} = {}) {
  const scenario = createHotSwapRouteMatrixScenario({ startId: startPackId });
  const session = createQaSession({
    startedAtMs: 100_000 + generatedAtOffsetMs,
    targetDurationSeconds: coverageTargetSeconds,
    sampleIntervalMs: 100,
    metadata: {
      packId: startPackId,
      packName: startPackId,
      packVersion: packContracts({ versionPatch })[0]?.version || "1.0.0",
      engine: "wav-stem",
      audioFormat: "m4a",
      masteringProfile: "route-matrix",
      facadeApi: "1.5.0",
      initialSampleRate: sampleRate,
      qaScenarioId: HOT_SWAP_ROUTE_MATRIX_ID,
      qaScenarioVersion: scenarioVersion,
      qaScenarioStatus: "completed",
      qaScenarioKind: "hot-swap-route-matrix",
      qaRouteMatrix: {
        schemaVersion: scenario.routeMatrixSchemaVersion,
        startPackId,
        routeCount: 12,
        routeIntervalMs,
        crossfadeBeats,
        quantize,
        crossfadeCurve,
        packContracts: packContracts({ versionPatch, formatPatch, masteringPatch }),
        routes: scenario.routes.map(({ index, id, fromId, toId }) => ({
          index, id, fromId, toId,
        })),
      },
      qaRouteMatrixExecution: {
        id: HOT_SWAP_ROUTE_MATRIX_ID,
        version: scenarioVersion,
        routeMatrixSchemaVersion: scenario.routeMatrixSchemaVersion,
        status: "completed",
        startPackId,
        endPackId: startPackId,
        routeCount: 12,
        completedRoutes: 12,
        routeIntervalMs,
        durationMs: 64_000,
        routes: scenario.routes.map(({ id, index, fromId, toId }) => ({
          id, index, fromId, toId, completed: true,
        })),
      },
    },
  });

  let capturedAtMs = session.startedAtMs;
  scenario.routes.forEach((route, routeIndex) => {
    const scheduledAt = 20 + routeIndex * 2;
    const points = [
      { progress: 0.10, rms: -20.0 },
      { progress: 0.40, rms: -20.4 },
      { progress: 0.60, rms: -20.4 },
      { progress: 0.90, rms: -20.0 },
    ];

    points.forEach((point, pointIndex) => {
      const angle = point.progress * Math.PI * 0.5;
      addQaSample(session, meter({
        packId: pointIndex < 2 ? route.fromId : route.toId,
        rms: point.rms,
        hotSwap: {
          phase: "crossfading",
          fromId: route.fromId,
          toId: route.toId,
          curve: crossfadeCurve,
          quantize,
          scheduledAt,
          fadeEnd: scheduledAt + 1,
          crossfadeBeats,
          fadeSeconds: 1,
          progress: point.progress,
          outgoingGain: Math.cos(angle),
          incomingGain: Math.sin(angle),
          powerCoefficientSum: 1,
        },
      }), {
        capturedAtMs,
        scenarioStage: `route:${route.fromId}->${route.toId}`,
      });
      capturedAtMs += 100;
    });

    addQaSample(session, meter({
      packId: route.toId,
      hotSwap: null,
    }), {
      capturedAtMs,
      scenarioStage: `route:${route.fromId}->${route.toId}`,
    });
    capturedAtMs += 100;
  });

  return finalizeQaSession(session, { endedAtMs: capturedAtMs });
}

const valid = buildReport();
const eligibility = getQaRouteMatrixBaselineEligibility(valid);
if (!eligibility.eligible) {
  errors.push("complete safe Route Matrix should be eligible: " + eligibility.failures.join("; "));
}
if (eligibility.matrixEvaluation.status !== "pass") {
  errors.push(`safe matrix gate should PASS: ${eligibility.matrixEvaluation.status}`);
}

const saved = saveQaRouteMatrixBaseline(valid, {
  storage,
  approvedAt: "2026-09-01T14:00:00.000Z",
});
if (!map.has(QA_ROUTE_BASELINE_STORAGE_KEY)) {
  errors.push("Route Matrix registry was not persisted");
}
if (saved.report.samples.length !== 0 || saved.report.events.length !== 0) {
  errors.push("Route Matrix baseline must drop raw samples/events");
}
if (saved.packContracts.length !== 4) {
  errors.push("Route Matrix baseline did not retain four Pack contracts");
}

const exact = getQaRouteMatrixBaselineCompatibility(saved, buildReport());
if (!exact.comparable || exact.status !== "exact") {
  errors.push(`same matrix device contract should be EXACT: ${exact.status}`);
}

const versionReview = getQaRouteMatrixBaselineCompatibility(
  saved,
  buildReport({ versionPatch: { neon: "2.1.0" } }),
);
if (!versionReview.comparable || versionReview.status !== "review") {
  errors.push("Pack-version-only Route Matrix change should be REVIEW + comparable");
}
if (!versionReview.warnings.some((item) => item.code === "pack-version:neon")) {
  errors.push("Neon version-change warning missing");
}

const formatMismatch = getQaRouteMatrixBaselineCompatibility(
  saved,
  buildReport({ formatPatch: { fantasy: "ogg" } }),
);
if (formatMismatch.comparable || formatMismatch.status !== "incompatible") {
  errors.push("M4A -> OGG Route Matrix contract should be INCOMPATIBLE");
}

const rateMismatch = getQaRouteMatrixBaselineCompatibility(
  saved,
  buildReport({ sampleRate: 44_100 }),
);
if (rateMismatch.comparable) {
  errors.push("48 kHz -> 44.1 kHz Route Matrix contract should be INCOMPATIBLE");
}

const masteringMismatch = getQaRouteMatrixBaselineCompatibility(
  saved,
  buildReport({ masteringPatch: { clockwork: "clockwork-v2" } }),
);
if (masteringMismatch.comparable) {
  errors.push("Clockwork mastering change should be INCOMPATIBLE");
}

const curveMismatch = getQaRouteMatrixBaselineCompatibility(
  saved,
  buildReport({ crossfadeCurve: "legacy-exponential-v1" }),
);
if (curveMismatch.comparable) {
  errors.push("Crossfade curve change should be INCOMPATIBLE");
}

const startMismatch = getQaRouteMatrixBaselineCompatibility(
  saved,
  buildReport({ startPackId: "fantasy" }),
);
if (startMismatch.comparable) {
  errors.push("Route Matrix start Pack change should be INCOMPATIBLE");
}

const incomplete = buildReport();
incomplete.metadata.qaRouteMatrixExecution.completedRoutes = 11;
const incompleteEligibility = getQaRouteMatrixBaselineEligibility(incomplete);
if (incompleteEligibility.eligible) {
  errors.push("11/12 Route Matrix must not be baseline-eligible");
}

const lowCoverage = buildReport({ coverageTargetSeconds: 8 });
const lowCoverageEligibility = getQaRouteMatrixBaselineEligibility(lowCoverage);
if (lowCoverageEligibility.eligible) {
  errors.push("low-coverage Route Matrix must not be baseline-eligible");
}

// Keep only the latest six history entries.
for (let index = 1; index <= 7; index += 1) {
  saveQaRouteMatrixBaseline(buildReport({
    startPackId: index % 2 ? "pulse" : "fantasy",
    generatedAtOffsetMs: index * 10_000,
  }), {
    storage,
    approvedAt: `2026-09-01T14:${String(index).padStart(2, "0")}:00.000Z`,
  });
}

const history = listQaRouteMatrixBaselines({ storage });
if (history.length !== QA_ROUTE_BASELINE_MAX_HISTORY) {
  errors.push(
    `history should retain ${QA_ROUTE_BASELINE_MAX_HISTORY}, got ${history.length}`
  );
}

const latest = loadLatestQaRouteMatrixBaseline({ storage });
if (!latest || latest.approvedAt !== "2026-09-01T14:07:00.000Z") {
  errors.push(`latest Route Matrix baseline mismatch: ${latest?.approvedAt}`);
}

const latestFantasy = loadLatestQaRouteMatrixBaseline({
  storage,
  startPackId: "fantasy",
});
if (!latestFantasy || latestFantasy.startPackId !== "fantasy") {
  errors.push("start-Pack-scoped latest Route Matrix baseline lookup failed");
}

const loaded = loadQaRouteMatrixBaseline(latest?.id, { storage });
if (!loaded || loaded.id !== latest.id) {
  errors.push("Route Matrix baseline history entry could not be loaded");
}

if (!deleteQaRouteMatrixBaseline(latest.id, { storage })) {
  errors.push("Route Matrix baseline delete failed");
}
if (loadQaRouteMatrixBaseline(latest.id, { storage })) {
  errors.push("deleted Route Matrix baseline remained loadable");
}

storage.setItem(QA_ROUTE_BASELINE_STORAGE_KEY, "{broken-json");
if (listQaRouteMatrixBaselines({ storage }).length !== 0) {
  errors.push("corrupted Route Matrix registry should fail closed");
}

saveQaRouteMatrixBaseline(valid, { storage });
if (!clearQaRouteMatrixBaselines({ storage })) {
  errors.push("Route Matrix baseline clear failed");
}
if (listQaRouteMatrixBaselines({ storage }).length !== 0) {
  errors.push("Route Matrix history remained after clear");
}

if (errors.length) {
  console.error("Route Matrix Device Baseline Registry Check FAILED");
  errors.forEach((error) => console.error("- " + error));
  process.exit(1);
}

console.log("Route Matrix Device Baseline Registry Check PASSED");
console.log("- safe 12/12 matrix -> baseline eligible");
console.log("- incomplete / low coverage -> blocked");
console.log("- compact storage drops raw samples/events");
console.log("- exact contract -> EXACT");
console.log("- Pack version only -> REVIEW + comparable");
console.log("- format/rate/mastering/curve/start mismatch -> INCOMPATIBLE");
console.log("- six-entry device history retention: OK");
console.log("- latest / start-Pack-scoped load / delete / clear: OK");
console.log("- corrupted localStorage fails closed");
