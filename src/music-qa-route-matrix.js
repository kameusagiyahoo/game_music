import { QA_SCENARIO_SCHEMA_VERSION } from "./music-qa-scenario.js";

export const HOT_SWAP_ROUTE_MATRIX_SCHEMA_VERSION = "1.0.0";
export const HOT_SWAP_ROUTE_MATRIX_ID = "hot-swap-route-matrix-v1";
export const HOT_SWAP_ROUTE_MATRIX_MIN_COVERAGE_PERCENT = 90;
export const HOT_SWAP_ROUTE_MATRIX_PACKS = Object.freeze([
  "fantasy",
  "neon",
  "pulse",
  "clockwork",
]);

export const HOT_SWAP_ROUTE_MATRIX_DEFAULTS = Object.freeze({
  firstSwapAtMs: 3_000,
  routeIntervalMs: 5_000,
  tailMs: 6_000,
  maxStepLatenessMs: 1_000,
  maxSchedulerGapMs: 1_500,
  quantize: "bar",
  crossfadeBeats: 2,
  crossfadeCurve: "equal-power-v1",
  mode: "normal",
});

const uniqueStrings = (values = []) =>
  [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];

export function buildDirectedHotSwapRoutes(
  packIds = HOT_SWAP_ROUTE_MATRIX_PACKS,
  startId = packIds?.[0],
) {
  const nodes = uniqueStrings(packIds);
  const start = String(startId || "");
  if (nodes.length < 2) throw new Error("Route Matrix requires at least two Pack IDs");
  if (!nodes.includes(start)) throw new Error("Route Matrix start Pack is not registered: " + start);

  // Complete directed graph without self loops. Every node has equal in/out
  // degree, so a deterministic Eulerian circuit covers every directed route
  // exactly once and returns to the starting Pack.
  const adjacency = Object.fromEntries(
    nodes.map((fromId) => [
      fromId,
      [...nodes].reverse().filter((toId) => toId !== fromId),
    ])
  );

  const stack = [start];
  const circuit = [];

  while (stack.length) {
    const current = stack.at(-1);
    const next = adjacency[current]?.pop();
    if (next) stack.push(next);
    else circuit.push(stack.pop());
  }

  circuit.reverse();

  const routes = [];
  for (let index = 0; index < circuit.length - 1; index += 1) {
    routes.push(Object.freeze({
      index,
      fromId: circuit[index],
      toId: circuit[index + 1],
      id: `route-${String(index + 1).padStart(2, "0")}-${circuit[index]}-to-${circuit[index + 1]}`,
    }));
  }

  const validation = validateDirectedHotSwapRoutes(routes, nodes, start);
  if (!validation.valid) {
    throw new Error("Invalid directed Hot Swap Route Matrix: " + validation.errors.join("; "));
  }

  return Object.freeze(routes);
}

export function validateDirectedHotSwapRoutes(
  routes,
  packIds = HOT_SWAP_ROUTE_MATRIX_PACKS,
  startId = packIds?.[0],
) {
  const nodes = uniqueStrings(packIds);
  const expectedCount = nodes.length * (nodes.length - 1);
  const errors = [];
  const seen = new Set();

  if (!Array.isArray(routes)) {
    return { valid: false, errors: ["routes must be an array"], expectedCount, routeCount: 0 };
  }

  if (routes.length !== expectedCount) {
    errors.push(`route count ${routes.length} != expected ${expectedCount}`);
  }

  routes.forEach((route, index) => {
    const fromId = String(route?.fromId || "");
    const toId = String(route?.toId || "");
    if (!nodes.includes(fromId)) errors.push(`route[${index}] unknown fromId: ${fromId}`);
    if (!nodes.includes(toId)) errors.push(`route[${index}] unknown toId: ${toId}`);
    if (fromId === toId) errors.push(`route[${index}] contains self route: ${fromId}`);

    const key = `${fromId}->${toId}`;
    if (seen.has(key)) errors.push(`duplicate route: ${key}`);
    seen.add(key);

    if (index === 0 && fromId !== startId) {
      errors.push(`first route starts at ${fromId}, expected ${startId}`);
    }
    if (index > 0 && routes[index - 1]?.toId !== fromId) {
      errors.push(
        `route continuity broken at ${index}: ${routes[index - 1]?.toId} -> ${fromId}`
      );
    }
  });

  for (const fromId of nodes) {
    for (const toId of nodes) {
      if (fromId === toId) continue;
      const key = `${fromId}->${toId}`;
      if (!seen.has(key)) errors.push("missing route: " + key);
    }
  }

  if (routes.length && routes.at(-1)?.toId !== startId) {
    errors.push(
      `matrix does not return to start Pack: ${routes.at(-1)?.toId} -> ${startId}`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    expectedCount,
    routeCount: routes.length,
    uniqueRouteCount: seen.size,
  };
}

export function createHotSwapRouteMatrixScenario({
  packIds = HOT_SWAP_ROUTE_MATRIX_PACKS,
  startId = packIds?.[0],
  firstSwapAtMs = HOT_SWAP_ROUTE_MATRIX_DEFAULTS.firstSwapAtMs,
  routeIntervalMs = HOT_SWAP_ROUTE_MATRIX_DEFAULTS.routeIntervalMs,
  tailMs = HOT_SWAP_ROUTE_MATRIX_DEFAULTS.tailMs,
  maxStepLatenessMs = HOT_SWAP_ROUTE_MATRIX_DEFAULTS.maxStepLatenessMs,
  maxSchedulerGapMs = HOT_SWAP_ROUTE_MATRIX_DEFAULTS.maxSchedulerGapMs,
  quantize = HOT_SWAP_ROUTE_MATRIX_DEFAULTS.quantize,
  crossfadeBeats = HOT_SWAP_ROUTE_MATRIX_DEFAULTS.crossfadeBeats,
  crossfadeCurve = HOT_SWAP_ROUTE_MATRIX_DEFAULTS.crossfadeCurve,
  mode = HOT_SWAP_ROUTE_MATRIX_DEFAULTS.mode,
} = {}) {
  const nodes = uniqueStrings(packIds);
  const routes = buildDirectedHotSwapRoutes(nodes, startId);
  const firstAt = Math.max(0, Number(firstSwapAtMs) || 0);
  const interval = Math.max(1_000, Number(routeIntervalMs) || 5_000);
  const tail = Math.max(3_500, Number(tailMs) || 6_000);
  const steps = routes.map((route, index) => Object.freeze({
    id: route.id,
    stage: `route:${route.fromId}->${route.toId}`,
    label: `${route.fromId.toUpperCase()} → ${route.toId.toUpperCase()}`,
    atMs: firstAt + index * interval,
    routeIndex: index,
    fromId: route.fromId,
    toId: route.toId,
    actions: Object.freeze([
      Object.freeze({
        type: "pack",
        name: route.toId,
        options: Object.freeze({
          quantize,
          crossfadeBeats,
          crossfadeCurve,
          mode,
        }),
      }),
    ]),
  }));

  const lastAtMs = steps.at(-1)?.atMs || 0;
  const durationMs = lastAtMs + tail;

  return Object.freeze({
    schemaVersion: QA_SCENARIO_SCHEMA_VERSION,
    routeMatrixSchemaVersion: HOT_SWAP_ROUTE_MATRIX_SCHEMA_VERSION,
    id: HOT_SWAP_ROUTE_MATRIX_ID,
    name: "Hot Swap Route Matrix",
    version: "1.0.0",
    startPackId: startId,
    packIds: Object.freeze([...nodes]),
    routeCount: routes.length,
    routes,
    firstSwapAtMs: firstAt,
    routeIntervalMs: interval,
    tailMs: tail,
    durationMs,
    maxStepLatenessMs: Math.max(250, Number(maxStepLatenessMs) || 1_000),
    maxSchedulerGapMs: Math.max(500, Number(maxSchedulerGapMs) || 1_500),
    steps: Object.freeze(steps),
  });
}

export function hotSwapRouteMatrixExecutionSummary(run) {
  if (!run) return null;
  const scenario = run.scenario || {};
  const completed = new Set(
    (run.executions || [])
      .filter((execution) => execution.status === "completed")
      .map((execution) => execution.stepId)
  );

  const routes = (scenario.routes || []).map((route) => ({
    id: route.id,
    index: route.index,
    fromId: route.fromId,
    toId: route.toId,
    completed: completed.has(route.id),
  }));

  return {
    id: scenario.id || HOT_SWAP_ROUTE_MATRIX_ID,
    version: scenario.version || "1.0.0",
    routeMatrixSchemaVersion:
      scenario.routeMatrixSchemaVersion || HOT_SWAP_ROUTE_MATRIX_SCHEMA_VERSION,
    status: run.status,
    abortReason: run.abortReason || null,
    startPackId: scenario.startPackId || null,
    endPackId: routes.at(-1)?.completed ? routes.at(-1)?.toId || null : null,
    routeCount: routes.length,
    completedRoutes: routes.filter((route) => route.completed).length,
    routeIntervalMs: Number(scenario.routeIntervalMs || 0),
    durationMs: Number(scenario.durationMs || 0),
    routes,
  };
}


export function evaluateHotSwapRouteMatrixReport(report, {
  packIds = HOT_SWAP_ROUTE_MATRIX_PACKS,
  minCoveragePercent = HOT_SWAP_ROUTE_MATRIX_MIN_COVERAGE_PERCENT,
} = {}) {
  const nodes = uniqueStrings(packIds);
  const expectedRouteCount = nodes.length * (nodes.length - 1);
  const expectedRoutes = new Set();

  for (const fromId of nodes) {
    for (const toId of nodes) {
      if (fromId !== toId) expectedRoutes.add(`${fromId}->${toId}`);
    }
  }

  const failures = [];
  const warnings = [];
  const metadata = report?.metadata || {};
  const summary = report?.summary || {};
  const matrixExecution = metadata.qaRouteMatrixExecution || {};
  const scenarioId = String(metadata.qaScenarioId || "");
  const scenarioStatus = String(metadata.qaScenarioStatus || "");
  const coverage = Number(summary.samplingCoveragePercent);
  const verdict = String(summary.verdict || "").toLowerCase();
  const hotSwapQaStatus = String(summary.hotSwapQa?.status || "not-applicable").toLowerCase();
  const observed = Array.isArray(summary.hotSwaps) ? summary.hotSwaps : [];
  const observedRoutes = new Set(
    observed
      .filter((swap) => swap?.fromId && swap?.toId)
      .map((swap) => `${swap.fromId}->${swap.toId}`)
  );

  if (scenarioId !== HOT_SWAP_ROUTE_MATRIX_ID) {
    failures.push(
      `Scenario ID ${scenarioId || "missing"} != ${HOT_SWAP_ROUTE_MATRIX_ID}`
    );
  }
  if (scenarioStatus !== "completed") {
    failures.push(`Scenario status must be completed, got ${scenarioStatus || "missing"}`);
  }

  if (Number(matrixExecution.routeCount || 0) !== expectedRouteCount) {
    failures.push(
      `matrix route count ${Number(matrixExecution.routeCount || 0)} != ${expectedRouteCount}`
    );
  }
  if (Number(matrixExecution.completedRoutes || 0) !== expectedRouteCount) {
    failures.push(
      `matrix completed routes ${Number(matrixExecution.completedRoutes || 0)} != ${expectedRouteCount}`
    );
  }

  if (Number(summary.hotSwapCount || 0) !== expectedRouteCount) {
    failures.push(
      `observed Hot Swap count ${Number(summary.hotSwapCount || 0)} != ${expectedRouteCount}`
    );
  }
  if (Number(summary.hotSwapQa?.evaluatedCount || 0) !== expectedRouteCount) {
    failures.push(
      `Hot Swap QA evaluated count ${Number(summary.hotSwapQa?.evaluatedCount || 0)} != ${expectedRouteCount}`
    );
  }
  if (observedRoutes.size !== expectedRouteCount) {
    failures.push(
      `unique observed directed routes ${observedRoutes.size} != ${expectedRouteCount}`
    );
  }

  for (const route of expectedRoutes) {
    if (!observedRoutes.has(route)) failures.push(`missing observed route: ${route}`);
  }
  for (const route of observedRoutes) {
    if (!expectedRoutes.has(route)) failures.push(`unexpected observed route: ${route}`);
  }

  if (!Number.isFinite(coverage)) {
    warnings.push("Sampling coverage is unavailable");
  } else if (coverage < Number(minCoveragePercent)) {
    warnings.push(
      `Sampling coverage ${coverage.toFixed(1)}% < ${Number(minCoveragePercent).toFixed(1)}%`
    );
  }

  if (hotSwapQaStatus === "fail") {
    failures.push("Hot Swap QA verdict is FAIL");
  } else if (hotSwapQaStatus === "review") {
    warnings.push("Hot Swap QA verdict requires REVIEW");
  } else if (hotSwapQaStatus !== "pass") {
    warnings.push(`Hot Swap QA verdict is ${hotSwapQaStatus || "unknown"}`);
  }

  if (verdict === "fail") {
    failures.push("Overall QA verdict is FAIL");
  } else if (verdict === "review") {
    warnings.push("Overall QA verdict requires REVIEW");
  }

  const status = failures.length
    ? "fail"
    : warnings.length
      ? "review"
      : "pass";

  return {
    status,
    expectedRouteCount,
    observedRouteCount: Number(summary.hotSwapCount || 0),
    uniqueObservedRouteCount: observedRoutes.size,
    evaluatedRouteCount: Number(summary.hotSwapQa?.evaluatedCount || 0),
    completedRouteCount: Number(matrixExecution.completedRoutes || 0),
    samplingCoveragePercent: Number.isFinite(coverage) ? coverage : null,
    hotSwapQaStatus,
    overallVerdict: verdict || null,
    failures,
    warnings,
  };
}
