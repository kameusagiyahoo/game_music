export const QA_SCENARIO_SCHEMA_VERSION = "1.0.0";

export const STANDARD_QA_SCENARIO = Object.freeze({
  schemaVersion: QA_SCENARIO_SCHEMA_VERSION,
  id: "pulse-standard-v1",
  name: "Pulse Standard 60s",
  version: "1.0.0",
  durationMs: 60_000,
  maxStepLatenessMs: 750,
  maxSchedulerGapMs: 1_500,
  steps: Object.freeze([
    Object.freeze({
      id: "normal",
      stage: "normal",
      label: "NORMAL",
      atMs: 0,
      actions: Object.freeze([
        Object.freeze({
          type: "state",
          name: "normal",
          options: Object.freeze({
            quantize: "immediate",
            transitionCue: false,
          }),
        }),
      ]),
    }),
    Object.freeze({
      id: "build",
      stage: "build",
      label: "BUILD",
      atMs: 10_000,
      actions: Object.freeze([
        Object.freeze({
          type: "transitionCue",
          name: "riser",
          options: Object.freeze({
            quantize: "bar",
            position: "before",
          }),
        }),
        Object.freeze({
          type: "layer",
          name: "build",
          alignToPreviousTransition: true,
          options: Object.freeze({ quantize: "bar" }),
        }),
      ]),
    }),
    Object.freeze({
      id: "overdrive",
      stage: "overdrive",
      label: "OVERDRIVE",
      atMs: 20_000,
      actions: Object.freeze([
        Object.freeze({
          type: "state",
          name: "tension",
          options: Object.freeze({ quantize: "bar" }),
        }),
      ]),
    }),
    Object.freeze({
      id: "result-victory",
      stage: "result",
      label: "RESULT + VICTORY",
      atMs: 40_000,
      actions: Object.freeze([
        Object.freeze({
          type: "state",
          name: "result",
          options: Object.freeze({ quantize: "bar" }),
        }),
        Object.freeze({
          type: "outcome",
          success: true,
          options: Object.freeze({ quantize: "bar" }),
        }),
      ]),
    }),
  ]),
});

const finite = (value, fallback = 0) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;

function cloneOptions(options = {}) {
  return { ...options };
}

export function validateQaScenario(scenario) {
  const errors = [];

  if (!scenario || typeof scenario !== "object") {
    errors.push("scenario must be an object");
    return { valid: false, errors };
  }
  if (!scenario.id || typeof scenario.id !== "string") {
    errors.push("scenario.id must be a non-empty string");
  }
  if (!scenario.version || typeof scenario.version !== "string") {
    errors.push("scenario.version must be a non-empty string");
  }
  if (!Number.isFinite(Number(scenario.durationMs)) || Number(scenario.durationMs) <= 0) {
    errors.push("scenario.durationMs must be > 0");
  }
  if (!Array.isArray(scenario.steps) || scenario.steps.length === 0) {
    errors.push("scenario.steps must contain at least one step");
    return { valid: errors.length === 0, errors };
  }

  let previousAt = -1;
  const ids = new Set();

  scenario.steps.forEach((step, index) => {
    const prefix = `steps[${index}]`;
    if (!step?.id || typeof step.id !== "string") {
      errors.push(`${prefix}.id must be a non-empty string`);
    } else if (ids.has(step.id)) {
      errors.push(`${prefix}.id is duplicated: ${step.id}`);
    } else {
      ids.add(step.id);
    }

    const atMs = finite(step?.atMs, Number.NaN);
    if (!Number.isFinite(atMs) || atMs < 0) {
      errors.push(`${prefix}.atMs must be >= 0`);
    } else {
      if (atMs < previousAt) errors.push(`${prefix}.atMs must be sorted`);
      if (atMs >= finite(scenario.durationMs, 0)) {
        errors.push(`${prefix}.atMs must be before durationMs`);
      }
      previousAt = atMs;
    }

    if (!Array.isArray(step?.actions) || step.actions.length === 0) {
      errors.push(`${prefix}.actions must contain at least one action`);
      return;
    }

    step.actions.forEach((action, actionIndex) => {
      const actionPrefix = `${prefix}.actions[${actionIndex}]`;
      if (
        action?.type === "state" ||
        action?.type === "layer" ||
        action?.type === "transitionCue"
      ) {
        if (!action.name || typeof action.name !== "string") {
          errors.push(`${actionPrefix}.name is required for ${action.type} action`);
        }
      } else if (action?.type === "outcome") {
        if (typeof action.success !== "boolean") {
          errors.push(`${actionPrefix}.success must be boolean`);
        }
      } else {
        errors.push(`${actionPrefix}.type is unsupported: ${action?.type}`);
      }
    });
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function createQaScenarioRun(
  scenario = STANDARD_QA_SCENARIO,
  { startedAtMs = 0 } = {},
) {
  const validation = validateQaScenario(scenario);
  if (!validation.valid) {
    throw new Error(`Invalid QA scenario: ${validation.errors.join("; ")}`);
  }

  return {
    scenario,
    startedAtMs: finite(startedAtMs, 0),
    status: "running",
    nextStepIndex: 0,
    currentStage: scenario.steps?.[0]?.stage || scenario.steps?.[0]?.id || null,
    lastAdvanceAtMs: finite(startedAtMs, 0),
    executions: [],
    abortReason: null,
    completedAtMs: null,
  };
}

export function cancelQaScenarioRun(run, {
  nowMs = run?.startedAtMs || 0,
  reason = "cancelled",
} = {}) {
  if (!run || run.status !== "running") return run;
  run.status = "aborted";
  run.abortReason = String(reason || "cancelled");
  run.completedAtMs = finite(nowMs, run.startedAtMs);
  return run;
}

export function getQaScenarioProgress(run, nowMs = run?.startedAtMs || 0) {
  if (!run) {
    return {
      status: "idle",
      elapsedMs: 0,
      remainingMs: 0,
      progress: 0,
      nextStep: null,
      currentStage: null,
    };
  }

  const durationMs = finite(run.scenario?.durationMs, 0);
  const elapsedMs = Math.max(0, finite(nowMs, run.startedAtMs) - run.startedAtMs);
  const clamped = Math.min(durationMs, elapsedMs);

  return {
    status: run.status,
    elapsedMs: clamped,
    remainingMs: Math.max(0, durationMs - clamped),
    progress: durationMs > 0 ? clamped / durationMs : 0,
    nextStep: run.scenario?.steps?.[run.nextStepIndex] || null,
    currentStage: run.currentStage || null,
  };
}

export async function executeQaScenarioStep(music, step) {
  if (!music) throw new Error("music facade is required");

  const results = [];
  let alignedTransitionAt = null;

  for (const action of step.actions || []) {
    const options = cloneOptions(action.options);

    if (action.alignToPreviousTransition && alignedTransitionAt) {
      options.scheduledAt = alignedTransitionAt;
    }

    if (action.type === "state") {
      results.push(await music.state(action.name, options));
    } else if (action.type === "layer") {
      results.push(await music.layer(action.name, options));
    } else if (action.type === "transitionCue") {
      const result = await music.transitionCue(action.name, options);
      alignedTransitionAt = Number(result?.transitionAt || result?.scheduledAt || 0) || null;
      results.push(result);
    } else if (action.type === "outcome") {
      results.push(await music.outcome(Boolean(action.success), options));
    } else {
      throw new Error(`Unsupported QA scenario action: ${action.type}`);
    }
  }
  return results;
}

export async function advanceQaScenarioRun(run, {
  nowMs,
  executeStep,
} = {}) {
  if (!run || run.status !== "running") return run;
  if (typeof executeStep !== "function") {
    throw new Error("advanceQaScenarioRun requires executeStep");
  }

  const currentTime = finite(nowMs, run.startedAtMs);
  const elapsedMs = Math.max(0, currentTime - run.startedAtMs);
  const steps = run.scenario.steps;
  const maxLate = Math.max(0, finite(run.scenario.maxStepLatenessMs, 750));
  const maxSchedulerGap = Math.max(250, finite(run.scenario.maxSchedulerGapMs, 1_500));

  if (
    run.lastAdvanceAtMs != null &&
    currentTime - run.lastAdvanceAtMs > maxSchedulerGap
  ) {
    run.status = "aborted";
    run.abortReason = `scheduler-gap:${Math.round(currentTime - run.lastAdvanceAtMs)}ms`;
    run.completedAtMs = currentTime;
    return run;
  }
  run.lastAdvanceAtMs = currentTime;

  while (run.nextStepIndex < steps.length) {
    const step = steps[run.nextStepIndex];
    if (elapsedMs < step.atMs) break;

    const driftMs = elapsedMs - step.atMs;
    if (driftMs > maxLate) {
      run.status = "aborted";
      run.abortReason = `timing-drift:${step.id}:${Math.round(driftMs)}ms`;
      run.completedAtMs = currentTime;
      return run;
    }

    const execution = {
      stepId: step.id,
      label: step.label || step.id,
      stage: step.stage || step.id,
      scheduledAtMs: step.atMs,
      executedAtMs: elapsedMs,
      driftMs,
      status: "running",
    };
    run.executions.push(execution);
    run.currentStage = step.stage || step.id;

    try {
      await executeStep(step);
      execution.status = "completed";
    } catch (error) {
      execution.status = "failed";
      execution.error = error?.message || String(error);
      run.status = "aborted";
      run.abortReason = `step-failed:${step.id}:${execution.error}`;
      run.completedAtMs = currentTime;
      return run;
    }

    run.nextStepIndex += 1;
  }

  if (
    elapsedMs >= run.scenario.durationMs &&
    run.nextStepIndex >= run.scenario.steps.length
  ) {
    run.status = "completed";
    run.completedAtMs = currentTime;
  }

  return run;
}

export function qaScenarioExecutionSummary(run) {
  if (!run) return null;

  const maxDriftMs = run.executions.reduce(
    (max, execution) => Math.max(max, Math.abs(finite(execution.driftMs, 0))),
    0,
  );

  return {
    id: run.scenario?.id || null,
    version: run.scenario?.version || null,
    schemaVersion: run.scenario?.schemaVersion || QA_SCENARIO_SCHEMA_VERSION,
    durationMs: finite(run.scenario?.durationMs, 0),
    status: run.status,
    abortReason: run.abortReason,
    maxDriftMs: Math.round(maxDriftMs),
    completedSteps: run.executions.filter((execution) => execution.status === "completed").length,
    totalSteps: run.scenario?.steps?.length || 0,
    currentStage: run.currentStage || null,
    executions: run.executions.map((execution) => ({ ...execution })),
  };
}
