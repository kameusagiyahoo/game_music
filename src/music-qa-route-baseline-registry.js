import { validateQaReport } from "./music-qa-compare.js";
import { compactQaBaselineReport } from "./music-qa-baseline-registry.js";
import {
  HOT_SWAP_ROUTE_MATRIX_ID,
  HOT_SWAP_ROUTE_MATRIX_MIN_COVERAGE_PERCENT,
  HOT_SWAP_ROUTE_MATRIX_PACKS,
  evaluateHotSwapRouteMatrixReport,
} from "./music-qa-route-matrix.js";

export const QA_ROUTE_BASELINE_SCHEMA_VERSION = "1.0.0";
export const QA_ROUTE_BASELINE_STORAGE_KEY = "game-music-qa-route-matrix-baselines-v1";
export const QA_ROUTE_BASELINE_MAX_HISTORY = 6;
export const QA_ROUTE_BASELINE_COMPATIBILITY_SCHEMA_VERSION = "1.0.0";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getStorage(explicitStorage) {
  if (explicitStorage) return explicitStorage;
  try {
    return globalThis.localStorage || null;
  } catch (_) {
    return null;
  }
}

function emptyRegistry() {
  return {
    schemaVersion: QA_ROUTE_BASELINE_SCHEMA_VERSION,
    entries: [],
  };
}

function readRegistry(storage) {
  if (!storage) return emptyRegistry();

  try {
    const parsed = JSON.parse(storage.getItem(QA_ROUTE_BASELINE_STORAGE_KEY) || "{}");
    if (
      parsed?.schemaVersion !== QA_ROUTE_BASELINE_SCHEMA_VERSION ||
      !Array.isArray(parsed?.entries)
    ) {
      return emptyRegistry();
    }
    return {
      schemaVersion: QA_ROUTE_BASELINE_SCHEMA_VERSION,
      entries: parsed.entries.filter((entry) => entry?.id && entry?.report),
    };
  } catch (_) {
    return emptyRegistry();
  }
}

function writeRegistry(storage, registry) {
  if (!storage) throw new Error("Route Matrix baseline storage is unavailable");
  storage.setItem(QA_ROUTE_BASELINE_STORAGE_KEY, JSON.stringify(registry));
}

function normalizeFormat(value) {
  const text = String(value || "").trim().toLowerCase();
  return text || null;
}

function normalizePackContracts(values = []) {
  return (Array.isArray(values) ? values : [])
    .map((item) => ({
      id: String(item?.id || "").trim() || null,
      version: String(item?.version || "").trim() || null,
      masteringProfile: String(item?.masteringProfile || "").trim() || null,
      facadeApi: String(item?.facadeApi || "").trim() || null,
      audioFormat: normalizeFormat(item?.audioFormat),
    }))
    .filter((item) => item.id)
    .sort((a, b) => a.id.localeCompare(b.id));
}

function routeContract(report = {}) {
  const metadata = report?.metadata || {};
  const matrix = metadata.qaRouteMatrix || {};
  const execution = metadata.qaRouteMatrixExecution || {};
  const packs = normalizePackContracts(matrix.packContracts);

  return {
    scenarioId: String(metadata.qaScenarioId || "") || null,
    scenarioVersion: String(metadata.qaScenarioVersion || "") || null,
    routeMatrixSchemaVersion:
      String(matrix.schemaVersion || execution.routeMatrixSchemaVersion || "") || null,
    startPackId:
      String(matrix.startPackId || execution.startPackId || metadata.packId || "") || null,
    routeCount: Number(matrix.routeCount || execution.routeCount || 0) || null,
    routeIntervalMs: Number(matrix.routeIntervalMs || execution.routeIntervalMs || 0) || null,
    durationMs: Number(execution.durationMs || report.targetDurationSeconds * 1000 || 0) || null,
    quantize: String(matrix.quantize || "") || null,
    crossfadeBeats: Number(matrix.crossfadeBeats || 0) || null,
    crossfadeCurve: String(matrix.crossfadeCurve || "") || null,
    sampleRate: Number(metadata.initialSampleRate || 0) || null,
    facadeApi: String(metadata.facadeApi || "") || null,
    packIds: packs.map((item) => item.id),
    packContracts: packs,
  };
}

function baselineContract(entry) {
  const fromReport = routeContract(entry?.report || entry || {});
  return {
    scenarioId: entry?.scenarioId || fromReport.scenarioId,
    scenarioVersion: entry?.scenarioVersion || fromReport.scenarioVersion,
    routeMatrixSchemaVersion:
      entry?.routeMatrixSchemaVersion || fromReport.routeMatrixSchemaVersion,
    startPackId: entry?.startPackId || fromReport.startPackId,
    routeCount: Number(entry?.routeCount || fromReport.routeCount || 0) || null,
    routeIntervalMs:
      Number(entry?.routeIntervalMs || fromReport.routeIntervalMs || 0) || null,
    durationMs: Number(entry?.durationMs || fromReport.durationMs || 0) || null,
    quantize: entry?.quantize || fromReport.quantize,
    crossfadeBeats:
      Number(entry?.crossfadeBeats || fromReport.crossfadeBeats || 0) || null,
    crossfadeCurve: entry?.crossfadeCurve || fromReport.crossfadeCurve,
    sampleRate: Number(entry?.sampleRate || fromReport.sampleRate || 0) || null,
    facadeApi: entry?.facadeApi || fromReport.facadeApi,
    packIds: Array.isArray(entry?.packIds) ? [...entry.packIds] : fromReport.packIds,
    packContracts: normalizePackContracts(
      entry?.packContracts?.length ? entry.packContracts : fromReport.packContracts
    ),
  };
}

function sameStringList(a = [], b = []) {
  return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
}

function packMap(contracts = []) {
  return Object.fromEntries(normalizePackContracts(contracts).map((item) => [item.id, item]));
}

export function getQaRouteMatrixBaselineEligibility(report, {
  minCoveragePercent = HOT_SWAP_ROUTE_MATRIX_MIN_COVERAGE_PERCENT,
} = {}) {
  const failures = [];
  const validation = validateQaReport(report);

  if (!validation.valid) failures.push(...validation.errors);

  const matrixEvaluation = evaluateHotSwapRouteMatrixReport(report, {
    minCoveragePercent,
  });
  const contract = routeContract(report);
  const coverage = Number(report?.summary?.samplingCoveragePercent);

  if (contract.scenarioId !== HOT_SWAP_ROUTE_MATRIX_ID) {
    failures.push(
      `Route Matrix Scenario mismatch: expected ${HOT_SWAP_ROUTE_MATRIX_ID}, got ${contract.scenarioId || "missing"}`
    );
  }
  if (!contract.scenarioVersion) failures.push("Route Matrix Scenario version is missing");
  if (!contract.routeMatrixSchemaVersion) failures.push("Route Matrix schema version is missing");
  if (!contract.startPackId) failures.push("Route Matrix start Pack is missing");
  if (contract.routeCount !== 12) failures.push(`Route count must be 12, got ${contract.routeCount || 0}`);
  if (!contract.routeIntervalMs) failures.push("Route interval is missing");
  if (!contract.durationMs) failures.push("Route Matrix duration is missing");
  if (!contract.quantize) failures.push("Route Matrix quantize mode is missing");
  if (!contract.crossfadeBeats) failures.push("Route Matrix crossfade beats are missing");
  if (!contract.crossfadeCurve) failures.push("Route Matrix crossfade curve is missing");
  if (!contract.sampleRate) failures.push("AudioContext sample rate is missing");

  if (!sameStringList(contract.packIds, HOT_SWAP_ROUTE_MATRIX_PACKS)) {
    failures.push(
      `Route Matrix Pack contract must contain ${HOT_SWAP_ROUTE_MATRIX_PACKS.join(", ")}`
    );
  }

  const contracts = packMap(contract.packContracts);
  for (const packId of HOT_SWAP_ROUTE_MATRIX_PACKS) {
    const item = contracts[packId];
    if (!item) {
      failures.push(`Pack contract is missing: ${packId}`);
      continue;
    }
    if (!item.version) failures.push(`Pack version is missing: ${packId}`);
    if (!item.masteringProfile) failures.push(`Mastering profile is missing: ${packId}`);
    if (!item.audioFormat) failures.push(`Audio format is missing: ${packId}`);
  }

  if (!Number.isFinite(coverage) || coverage < Number(minCoveragePercent)) {
    failures.push(
      `Sampling coverage ${Number.isFinite(coverage) ? coverage.toFixed(1) : "invalid"}% < ${Number(minCoveragePercent).toFixed(1)}%`
    );
  }

  if (matrixEvaluation.status === "fail") {
    failures.push(...matrixEvaluation.failures.map((message) => `Route Matrix: ${message}`));
  }

  return {
    eligible: failures.length === 0,
    failures,
    matrixEvaluation,
    contract,
  };
}

export function getQaRouteMatrixBaselineCompatibility(baseline, currentReport) {
  const failures = [];
  const warnings = [];
  const baselineValidation = validateQaReport(baseline?.report || baseline);
  const currentValidation = validateQaReport(currentReport);

  if (!baselineValidation.valid) {
    failures.push(...baselineValidation.errors.map((message) => `Baseline report: ${message}`));
  }
  if (!currentValidation.valid) {
    failures.push(...currentValidation.errors.map((message) => `Current report: ${message}`));
  }

  const before = baselineContract(baseline);
  const after = routeContract(currentReport);

  const hardMatch = (field, label, formatter = (value) => value ?? "missing") => {
    if (before[field] == null || after[field] == null || before[field] === "" || after[field] === "") {
      failures.push(`${label} is required: ${formatter(before[field])} -> ${formatter(after[field])}`);
      return;
    }
    if (before[field] !== after[field]) {
      failures.push(`${label} mismatch: ${formatter(before[field])} -> ${formatter(after[field])}`);
    }
  };

  hardMatch("scenarioId", "Scenario ID");
  hardMatch("scenarioVersion", "Scenario version");
  hardMatch("routeMatrixSchemaVersion", "Route Matrix schema");
  hardMatch("startPackId", "Start Pack");
  hardMatch("routeCount", "Route count");
  hardMatch("routeIntervalMs", "Route interval", (value) => `${value ?? "missing"} ms`);
  hardMatch("durationMs", "Route Matrix duration", (value) => `${value ?? "missing"} ms`);
  hardMatch("quantize", "Quantize");
  hardMatch("crossfadeBeats", "Crossfade beats");
  hardMatch("crossfadeCurve", "Crossfade curve");
  hardMatch("sampleRate", "AudioContext sample rate", (value) => `${value ?? "missing"} Hz`);

  if (!sameStringList(before.packIds, after.packIds)) {
    failures.push(
      `Pack set mismatch: ${before.packIds.join(",") || "missing"} -> ${after.packIds.join(",") || "missing"}`
    );
  }

  const beforePacks = packMap(before.packContracts);
  const afterPacks = packMap(after.packContracts);
  for (const packId of HOT_SWAP_ROUTE_MATRIX_PACKS) {
    const oldPack = beforePacks[packId];
    const newPack = afterPacks[packId];
    if (!oldPack || !newPack) {
      failures.push(`Pack contract missing for compatibility: ${packId}`);
      continue;
    }

    if (!oldPack.audioFormat || !newPack.audioFormat) {
      failures.push(
        `${packId} audio format is required: ${oldPack.audioFormat || "missing"} -> ${newPack.audioFormat || "missing"}`
      );
    } else if (oldPack.audioFormat !== newPack.audioFormat) {
      failures.push(
        `${packId} audio format mismatch: ${oldPack.audioFormat.toUpperCase()} -> ${newPack.audioFormat.toUpperCase()}`
      );
    }

    if (!oldPack.masteringProfile || !newPack.masteringProfile) {
      failures.push(`${packId} mastering profile is required`);
    } else if (oldPack.masteringProfile !== newPack.masteringProfile) {
      failures.push(
        `${packId} mastering profile mismatch: ${oldPack.masteringProfile} -> ${newPack.masteringProfile}`
      );
    }

    if (!oldPack.version || !newPack.version) {
      warnings.push({
        code: `pack-version-missing:${packId}`,
        message: `${packId} version is incomplete: ${oldPack.version || "missing"} -> ${newPack.version || "missing"}`,
      });
    } else if (oldPack.version !== newPack.version) {
      warnings.push({
        code: `pack-version:${packId}`,
        message: `${packId} version changed: ${oldPack.version} -> ${newPack.version}`,
      });
    }

    if (
      oldPack.facadeApi &&
      newPack.facadeApi &&
      oldPack.facadeApi !== newPack.facadeApi
    ) {
      warnings.push({
        code: `facade-api:${packId}`,
        message: `${packId} Facade API changed: ${oldPack.facadeApi} -> ${newPack.facadeApi}`,
      });
    }
  }

  if (
    before.facadeApi &&
    after.facadeApi &&
    before.facadeApi !== after.facadeApi
  ) {
    warnings.push({
      code: "facade-api",
      message: `Route Matrix Facade API changed: ${before.facadeApi} -> ${after.facadeApi}`,
    });
  }

  const comparable = failures.length === 0;
  const status = !comparable
    ? "incompatible"
    : warnings.length
      ? "review"
      : "exact";

  return {
    schemaVersion: QA_ROUTE_BASELINE_COMPATIBILITY_SCHEMA_VERSION,
    comparable,
    status,
    failures,
    warnings,
    baseline: before,
    current: after,
  };
}

export function createQaRouteMatrixBaselineEntry(report, {
  approvedAt = new Date().toISOString(),
} = {}) {
  const eligibility = getQaRouteMatrixBaselineEligibility(report);
  if (!eligibility.eligible) {
    throw new Error(
      "Route Matrix baseline is not eligible: " + eligibility.failures.join("; ")
    );
  }

  const contract = eligibility.contract;
  const compactReport = compactQaBaselineReport(report);
  const id = [
    HOT_SWAP_ROUTE_MATRIX_ID,
    contract.startPackId,
    String(approvedAt).replace(/[^0-9TZ]/g, ""),
  ].join(":");

  return {
    schemaVersion: QA_ROUTE_BASELINE_SCHEMA_VERSION,
    id,
    approvedAt,
    sourceGeneratedAt: report.generatedAt || null,
    scenarioId: contract.scenarioId,
    scenarioVersion: contract.scenarioVersion,
    routeMatrixSchemaVersion: contract.routeMatrixSchemaVersion,
    startPackId: contract.startPackId,
    routeCount: contract.routeCount,
    routeIntervalMs: contract.routeIntervalMs,
    durationMs: contract.durationMs,
    quantize: contract.quantize,
    crossfadeBeats: contract.crossfadeBeats,
    crossfadeCurve: contract.crossfadeCurve,
    sampleRate: contract.sampleRate,
    facadeApi: contract.facadeApi,
    packIds: [...contract.packIds],
    packContracts: clone(contract.packContracts),
    coveragePercent: Number(report?.summary?.samplingCoveragePercent || 0),
    verdict: String(report?.summary?.verdict || "") || null,
    hotSwapQaStatus: String(report?.summary?.hotSwapQa?.status || "") || null,
    report: compactReport,
  };
}

export function saveQaRouteMatrixBaseline(report, {
  storage: explicitStorage,
  approvedAt,
  maxHistory = QA_ROUTE_BASELINE_MAX_HISTORY,
} = {}) {
  const storage = getStorage(explicitStorage);
  const entry = createQaRouteMatrixBaselineEntry(report, { approvedAt });
  const registry = readRegistry(storage);

  registry.entries = [
    entry,
    ...registry.entries.filter((item) => item.id !== entry.id),
  ].slice(0, Math.max(1, Number(maxHistory) || QA_ROUTE_BASELINE_MAX_HISTORY));

  writeRegistry(storage, registry);
  return clone(entry);
}

export function listQaRouteMatrixBaselines({
  storage: explicitStorage,
} = {}) {
  const registry = readRegistry(getStorage(explicitStorage));
  return registry.entries
    .filter((entry) => entry?.id && entry?.report)
    .map((entry) => clone(entry))
    .sort((a, b) => String(b.approvedAt || "").localeCompare(String(a.approvedAt || "")));
}

export function loadQaRouteMatrixBaseline(id, {
  storage: explicitStorage,
} = {}) {
  const entry = listQaRouteMatrixBaselines({ storage: explicitStorage })
    .find((item) => item.id === String(id || ""));
  if (!entry) return null;
  const validation = validateQaReport(entry.report);
  return validation.valid ? entry : null;
}

export function loadLatestQaRouteMatrixBaseline({
  storage: explicitStorage,
  startPackId,
} = {}) {
  const entries = listQaRouteMatrixBaselines({ storage: explicitStorage });
  const match = startPackId
    ? entries.find((entry) => entry.startPackId === String(startPackId))
    : entries[0];
  return match || null;
}

export function deleteQaRouteMatrixBaseline(id, {
  storage: explicitStorage,
} = {}) {
  const storage = getStorage(explicitStorage);
  const registry = readRegistry(storage);
  const before = registry.entries.length;
  registry.entries = registry.entries.filter((entry) => entry.id !== String(id || ""));
  if (registry.entries.length === before) return false;
  writeRegistry(storage, registry);
  return true;
}

export function clearQaRouteMatrixBaselines({
  storage: explicitStorage,
} = {}) {
  const storage = getStorage(explicitStorage);
  if (!storage) return false;
  storage.removeItem(QA_ROUTE_BASELINE_STORAGE_KEY);
  return true;
}
