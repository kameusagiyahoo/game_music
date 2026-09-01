import {
  HOT_SWAP_ROUTE_MATRIX_ID,
  HOT_SWAP_ROUTE_MATRIX_PACKS,
  buildDirectedHotSwapRoutes,
  validateDirectedHotSwapRoutes,
  createHotSwapRouteMatrixScenario,
  hotSwapRouteMatrixExecutionSummary,
} from "../src/music-qa-route-matrix.js";
import {
  validateQaScenario,
  createQaScenarioRun,
  advanceQaScenarioRun,
  executeQaScenarioStep,
} from "../src/music-qa-scenario.js";
import {
  createQaSession,
  addQaSample,
  finalizeQaSession,
} from "../src/music-qa-report.js";

const errors = [];
const expectedRouteCount =
  HOT_SWAP_ROUTE_MATRIX_PACKS.length * (HOT_SWAP_ROUTE_MATRIX_PACKS.length - 1);

const pairKey = (fromId, toId) => `${fromId}->${toId}`;

for (const startId of HOT_SWAP_ROUTE_MATRIX_PACKS) {
  const routes = buildDirectedHotSwapRoutes(HOT_SWAP_ROUTE_MATRIX_PACKS, startId);
  const validation = validateDirectedHotSwapRoutes(
    routes,
    HOT_SWAP_ROUTE_MATRIX_PACKS,
    startId,
  );

  if (!validation.valid) {
    errors.push(`${startId}: matrix invalid: ${validation.errors.join("; ")}`);
  }
  if (routes.length !== expectedRouteCount) {
    errors.push(`${startId}: expected ${expectedRouteCount} routes, got ${routes.length}`);
  }
  if (new Set(routes.map((route) => pairKey(route.fromId, route.toId))).size !== expectedRouteCount) {
    errors.push(`${startId}: directed route set is not unique`);
  }
  if (routes[0]?.fromId !== startId) {
    errors.push(`${startId}: first route does not start at selected Pack`);
  }
  if (routes.at(-1)?.toId !== startId) {
    errors.push(`${startId}: matrix does not return to selected Pack`);
  }

  for (let index = 1; index < routes.length; index += 1) {
    if (routes[index - 1].toId !== routes[index].fromId) {
      errors.push(`${startId}: route continuity broken at ${index}`);
    }
  }
}

const scenario = createHotSwapRouteMatrixScenario({ startId: "pulse" });
const scenarioValidation = validateQaScenario(scenario);
if (!scenarioValidation.valid) {
  errors.push("route matrix scenario did not pass generic QA validation: " +
    scenarioValidation.errors.join("; "));
}
if (scenario.id !== HOT_SWAP_ROUTE_MATRIX_ID) {
  errors.push(`scenario id mismatch: ${scenario.id}`);
}
if (scenario.routeCount !== 12 || scenario.steps.length !== 12) {
  errors.push(`scenario should contain 12 routes: ${scenario.routeCount}/${scenario.steps.length}`);
}
if (scenario.durationMs !== 64_000) {
  errors.push(`scenario duration should be 64s, got ${scenario.durationMs}ms`);
}

scenario.steps.forEach((step, index) => {
  const expectedAt = 3_000 + index * 5_000;
  if (step.atMs !== expectedAt) {
    errors.push(`route step ${index} time mismatch: ${step.atMs} != ${expectedAt}`);
  }
  const [action] = step.actions;
  if (action?.type !== "pack" || action?.name !== step.toId) {
    errors.push(`route step ${index} pack action mismatch`);
  }
  if (
    action?.options?.quantize !== "bar" ||
    action?.options?.crossfadeBeats !== 2 ||
    action?.options?.crossfadeCurve !== "equal-power-v1" ||
    action?.options?.mode !== "normal"
  ) {
    errors.push(`route step ${index} Hot Swap options mismatch`);
  }
});

const calls = [];
const fakeMusic = {
  async pack(name, options) {
    calls.push({ name, options: { ...options } });
    return { id: name, pending: true };
  },
};

const startedAtMs = 10_000;
const run = createQaScenarioRun(scenario, { startedAtMs });

// Simulate the browser scheduler continuously. Jumping directly from 0s to
// the first 3s step would correctly look like a background/scheduler gap.
for (let elapsedMs = 0; elapsedMs <= scenario.durationMs; elapsedMs += 500) {
  await advanceQaScenarioRun(run, {
    nowMs: startedAtMs + elapsedMs,
    executeStep: (currentStep) => executeQaScenarioStep(fakeMusic, currentStep),
  });
}

if (run.status !== "completed") {
  errors.push(`route matrix virtual run should complete: ${run.status} / ${run.abortReason}`);
}
if (calls.length !== 12) {
  errors.push(`route matrix should call music.pack 12 times, got ${calls.length}`);
}

const expectedTargets = scenario.routes.map((route) => route.toId);
if (JSON.stringify(calls.map((call) => call.name)) !== JSON.stringify(expectedTargets)) {
  errors.push("music.pack target order does not match route matrix");
}

const summary = hotSwapRouteMatrixExecutionSummary(run);
if (
  summary.completedRoutes !== 12 ||
  summary.routeCount !== 12 ||
  summary.startPackId !== "pulse" ||
  summary.endPackId !== "pulse"
) {
  errors.push(`route matrix execution summary mismatch: ${JSON.stringify(summary)}`);
}

const driftRun = createQaScenarioRun(scenario, { startedAtMs: 50_000 });
// Keep scheduler gaps <= 1.5s, then intentionally execute the first 3s step
// 1.1s late so the timing-drift guard, not the background guard, fires.
for (const elapsedMs of [0, 1_500, 2_900, 4_100]) {
  await advanceQaScenarioRun(driftRun, {
    nowMs: 50_000 + elapsedMs,
    executeStep: (step) => executeQaScenarioStep(fakeMusic, step),
  });
}
if (driftRun.status !== "aborted" || !String(driftRun.abortReason).startsWith("timing-drift:")) {
  errors.push(`route matrix 1.1s drift should abort: ${driftRun.status}/${driftRun.abortReason}`);
}

// Synthetic meter coverage: all 12 directed routes must remain distinct in one QA Report.
function meter({
  packId,
  hotSwap,
  peak = -2.0,
  rms = -20.0,
  reduction = -1.0,
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

const qaSession = createQaSession({
  startedAtMs: 100_000,
  targetDurationSeconds: 10,
  sampleIntervalMs: 100,
  metadata: {
    packId: "pulse",
    qaScenarioId: HOT_SWAP_ROUTE_MATRIX_ID,
    qaScenarioStatus: "completed",
  },
});

let captureAt = 100_000;
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
    addQaSample(qaSession, meter({
      packId: pointIndex < 2 ? route.fromId : route.toId,
      rms: point.rms,
      hotSwap: {
        phase: "crossfading",
        fromId: route.fromId,
        toId: route.toId,
        curve: "equal-power-v1",
        quantize: "bar",
        scheduledAt,
        fadeEnd: scheduledAt + 1,
        crossfadeBeats: 2,
        fadeSeconds: 1,
        progress: point.progress,
        outgoingGain: Math.cos(angle),
        incomingGain: Math.sin(angle),
        powerCoefficientSum: 1,
      },
    }), {
      capturedAtMs: captureAt,
      scenarioStage: `route:${route.fromId}->${route.toId}`,
    });
    captureAt += 100;
  });

  addQaSample(qaSession, meter({
    packId: route.toId,
    hotSwap: null,
  }), {
    capturedAtMs: captureAt,
    scenarioStage: `route:${route.fromId}->${route.toId}`,
  });
  captureAt += 100;
});

const qaReport = finalizeQaSession(qaSession, { endedAtMs: captureAt });
if (qaReport.summary.hotSwapCount !== 12) {
  errors.push(`QA Report should summarize 12 Hot Swaps, got ${qaReport.summary.hotSwapCount}`);
}
if (qaReport.summary.hotSwapQa?.evaluatedCount !== 12) {
  errors.push(`Hot Swap QA should evaluate 12 routes, got ${qaReport.summary.hotSwapQa?.evaluatedCount}`);
}
if (qaReport.summary.hotSwapQa?.status !== "pass") {
  errors.push(`synthetic safe matrix should PASS: ${qaReport.summary.hotSwapQa?.status}`);
}

const summarizedRoutes = new Set(
  (qaReport.summary.hotSwaps || []).map((swap) => pairKey(swap.fromId, swap.toId))
);
if (summarizedRoutes.size !== 12) {
  errors.push(`QA Report lost directed route identity: ${summarizedRoutes.size}/12`);
}

for (const fromId of HOT_SWAP_ROUTE_MATRIX_PACKS) {
  for (const toId of HOT_SWAP_ROUTE_MATRIX_PACKS) {
    if (fromId === toId) continue;
    if (!summarizedRoutes.has(pairKey(fromId, toId))) {
      errors.push(`QA Report missing route ${fromId}->${toId}`);
    }
  }
}

if (errors.length) {
  console.error("Hot Swap Route Matrix QA Check FAILED");
  errors.forEach((error) => console.error("- " + error));
  process.exit(1);
}

console.log("Hot Swap Route Matrix QA Check PASSED");
console.log("- 4 packs -> 12 unique directed routes: OK");
console.log("- deterministic Eulerian circuit returns to start Pack: OK");
console.log("- 64 second fixed route timeline: OK");
console.log("- bar / 2 beat / equal-power pack actions: OK");
console.log("- 1.1 second timing drift abort: OK");
console.log("- 12-route QA Report aggregation: OK");
console.log("- 12-route Hot Swap safety gate: PASS");
