import { applyMusicState } from "../src/music-asset-resolver.js";
import { MUSIC_FACADE_API_VERSION } from "../src/music-pack-manifest.js";
import {
  STANDARD_QA_SCENARIO,
  validateQaScenario,
  createQaScenarioRun,
  advanceQaScenarioRun,
  cancelQaScenarioRun,
  getQaScenarioProgress,
  executeQaScenarioStep,
  qaScenarioExecutionSummary,
} from "../src/music-qa-scenario.js";

const errors = [];
const calls = [];

const fakeMusic = {
  async state(name, options = {}) {
    calls.push({ type: "state", name, options: { ...options } });
    return { state: name };
  },
  async layer(name, options = {}) {
    calls.push({ type: "layer", name, options: { ...options } });
    return { preset: name };
  },
  async transitionCue(name, options = {}) {
    calls.push({ type: "transitionCue", name, options: { ...options } });
    return {
      name,
      transitionAt: 12.345,
      scheduledAt: 11.234,
    };
  },
  async outcome(success, options = {}) {
    calls.push({ type: "outcome", success, options: { ...options } });
    return { success };
  },
};

const validation = validateQaScenario(STANDARD_QA_SCENARIO);
if (!validation.valid) errors.push(`standard scenario invalid: ${validation.errors.join("; ")}`);
if (STANDARD_QA_SCENARIO.durationMs !== 60_000) errors.push("standard scenario duration must be 60 seconds");
if (STANDARD_QA_SCENARIO.steps.length !== 4) errors.push("standard scenario must contain 4 steps");
if (MUSIC_FACADE_API_VERSION !== "1.5.0") {
  errors.push(`Facade API should be 1.5.0, got ${MUSIC_FACADE_API_VERSION}`);
}

const run = createQaScenarioRun(STANDARD_QA_SCENARIO, { startedAtMs: 1000 });
const executeStep = (step) => executeQaScenarioStep(fakeMusic, step);

async function advanceRegularly(run, execute, targetNowMs, stepMs = 1000) {
  let current = Number(run.lastAdvanceAtMs ?? run.startedAtMs);
  while (current + stepMs < targetNowMs && run.status === "running") {
    current += stepMs;
    await advanceQaScenarioRun(run, { nowMs: current, executeStep: execute });
  }
  if (run.status === "running" && current < targetNowMs) {
    await advanceQaScenarioRun(run, { nowMs: targetNowMs, executeStep: execute });
  }
}


await advanceQaScenarioRun(run, { nowMs: 1000, executeStep });
if (calls.length !== 1 || calls[0].type !== "state" || calls[0].name !== "normal") {
  errors.push(`0s action mismatch: ${JSON.stringify(calls)}`);
}
if (calls[0]?.options?.quantize !== "immediate" || calls[0]?.options?.transitionCue !== false) {
  errors.push("NORMAL must start immediate with transition cue disabled");
}

await advanceRegularly(run, executeStep, 11_000);
if (calls[1]?.type !== "transitionCue" || calls[1]?.name !== "riser") {
  errors.push(`10s BUILD riser mismatch: ${JSON.stringify(calls[1])}`);
}
if (calls[1]?.options?.quantize !== "bar" || calls[1]?.options?.position !== "before") {
  errors.push("BUILD riser must be pre-bar quantized");
}
if (calls[2]?.type !== "layer" || calls[2]?.name !== "build") {
  errors.push(`10s BUILD layer mismatch: ${JSON.stringify(calls[2])}`);
}
if (calls[2]?.options?.quantize !== "bar") errors.push("BUILD layer must be bar quantized");
if (calls[2]?.options?.scheduledAt !== 12.345) {
  errors.push(`BUILD layer was not aligned to riser transition: ${calls[2]?.options?.scheduledAt}`);
}

await advanceRegularly(run, executeStep, 21_000);
if (calls[3]?.type !== "state" || calls[3]?.name !== "tension") {
  errors.push(`20s OVERDRIVE action mismatch: ${JSON.stringify(calls[3])}`);
}

await advanceRegularly(run, executeStep, 41_000);
if (calls[4]?.type !== "state" || calls[4]?.name !== "result") {
  errors.push(`40s RESULT action mismatch: ${JSON.stringify(calls[4])}`);
}
if (calls[5]?.type !== "outcome" || calls[5]?.success !== true) {
  errors.push(`40s VICTORY action mismatch: ${JSON.stringify(calls[5])}`);
}
if (calls[4]?.options?.quantize !== "bar" || calls[5]?.options?.quantize !== "bar") {
  errors.push("RESULT and VICTORY must both be bar quantized");
}

await advanceRegularly(run, executeStep, 61_000);
if (run.status !== "completed") errors.push(`standard scenario did not complete: ${run.status} / ${run.abortReason}`);

const summary = qaScenarioExecutionSummary(run);
if (summary.completedSteps !== 4 || summary.totalSteps !== 4) {
  errors.push(`scenario completion count mismatch: ${summary.completedSteps}/${summary.totalSteps}`);
}
if (summary.maxDriftMs !== 0) errors.push(`exact virtual run should have 0ms drift: ${summary.maxDriftMs}`);
if (summary.currentStage !== "result") {
  errors.push(`final scenario stage should be result, got ${summary.currentStage}`);
}

const completeProgress = getQaScenarioProgress(run, 61_000);
if (completeProgress.progress !== 1 || completeProgress.remainingMs !== 0) {
  errors.push("completed scenario progress must be 100%");
}

// Timing drift: scheduler stays alive, but BUILD executes 1000 ms late (> 750 ms).
const lateCalls = [];
const lateMusic = {
  async state(name) { lateCalls.push({ type: "state", name }); },
  async layer(name) { lateCalls.push({ type: "layer", name }); },
  async transitionCue(name) { lateCalls.push({ type: "transitionCue", name }); return {}; },
  async outcome() {},
};
const lateRun = createQaScenarioRun(STANDARD_QA_SCENARIO, { startedAtMs: 0 });
const lateExecute = (step) => executeQaScenarioStep(lateMusic, step);
await advanceQaScenarioRun(lateRun, { nowMs: 0, executeStep: lateExecute });
for (let now = 1000; now <= 9000; now += 1000) {
  await advanceQaScenarioRun(lateRun, { nowMs: now, executeStep: lateExecute });
}
await advanceQaScenarioRun(lateRun, { nowMs: 9500, executeStep: lateExecute });
await advanceQaScenarioRun(lateRun, { nowMs: 11_000, executeStep: lateExecute });
if (lateRun.status !== "aborted") errors.push(`late scenario should abort, got ${lateRun.status}`);
if (!String(lateRun.abortReason).startsWith("timing-drift:build:1000ms")) {
  errors.push(`late scenario abort reason mismatch: ${lateRun.abortReason}`);
}
if (lateCalls.some((call) => call.name === "riser" || call.name === "build")) {
  errors.push("late BUILD actions must not execute after timing-drift abort");
}

// Scheduler gap has a distinct abort reason and wins before step catch-up.
const gapRun = createQaScenarioRun(STANDARD_QA_SCENARIO, { startedAtMs: 0 });
await advanceQaScenarioRun(gapRun, {
  nowMs: 0,
  executeStep: lateExecute,
});
await advanceQaScenarioRun(gapRun, {
  nowMs: 2000,
  executeStep: lateExecute,
});
if (gapRun.status !== "aborted" || gapRun.abortReason !== "scheduler-gap:2000ms") {
  errors.push(`scheduler gap guard mismatch: ${gapRun.status} / ${gapRun.abortReason}`);
}

// Manual cancellation.
const cancelRun = createQaScenarioRun(STANDARD_QA_SCENARIO, { startedAtMs: 500 });
cancelQaScenarioRun(cancelRun, { nowMs: 2500, reason: "user-cancelled" });
if (cancelRun.status !== "aborted" || cancelRun.abortReason !== "user-cancelled") {
  errors.push("scenario cancellation mismatch");
}

// Action failure.
const failedRun = createQaScenarioRun(STANDARD_QA_SCENARIO, { startedAtMs: 0 });
await advanceQaScenarioRun(failedRun, {
  nowMs: 0,
  executeStep: async () => { throw new Error("synthetic failure"); },
});
if (failedRun.status !== "aborted" || !String(failedRun.abortReason).startsWith("step-failed:normal:")) {
  errors.push(`step failure did not abort scenario: ${failedRun.abortReason}`);
}

// Shared build state must map Pulse/WAV to mode=build and preset=build.
const resolverCalls = [];
const runtime = {
  engine: "wav-stem",
  capabilities: { transitionCues: false },
  entry: {
    pack: {
      modes: { build: {} },
      layerPresets: { build: {} },
    },
  },
  manager: {
    async setLayerPreset(name, options) {
      resolverCalls.push({ type: "layer", name, options });
    },
    async transitionTo(name, options) {
      resolverCalls.push({ type: "mode", name, options });
    },
  },
};

const buildResult = await applyMusicState(runtime, "build", {
  quantize: "immediate",
  transitionCue: false,
});
if (buildResult?.mode !== "build" || buildResult?.preset !== "build") {
  errors.push(`build resolver result mismatch: ${JSON.stringify(buildResult)}`);
}
if (resolverCalls[0]?.type !== "layer" || resolverCalls[0]?.name !== "build") {
  errors.push("build resolver did not apply build layer preset");
}
if (resolverCalls[1]?.type !== "mode" || resolverCalls[1]?.name !== "build") {
  errors.push("build resolver did not transition to build mode");
}

if (errors.length) {
  console.error("Music QA Scenario Check FAILED");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log("Music QA Scenario Check PASSED");
console.log("- timeline: NORMAL 0s → RISER+BUILD 10s → OVERDRIVE 20s → RESULT+VICTORY 40s");
console.log("- duration: 60s");
console.log("- exact virtual drift: 0 ms");
console.log("- BUILD riser/layer boundary alignment: OK");
console.log(`- late-step abort: ${lateRun.abortReason}`);
console.log(`- scheduler-gap abort: ${gapRun.abortReason}`);
console.log("- shared build state mapping: OK");
console.log("- Facade API 1.5.0: OK");
