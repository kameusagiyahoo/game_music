import { validateQaReport } from "./music-qa-compare.js";

export const QA_BASELINE_REGISTRY_SCHEMA_VERSION = "1.0.0";
export const QA_BASELINE_STORAGE_KEY = "game-music-qa-pack-baselines-v1";
export const QA_BASELINE_MIN_COVERAGE_PERCENT = 90;

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
    schemaVersion: QA_BASELINE_REGISTRY_SCHEMA_VERSION,
    baselines: {},
  };
}

function readRegistry(storage) {
  if (!storage) return emptyRegistry();

  try {
    const parsed = JSON.parse(storage.getItem(QA_BASELINE_STORAGE_KEY) || "{}");
    if (
      parsed?.schemaVersion !== QA_BASELINE_REGISTRY_SCHEMA_VERSION ||
      !parsed?.baselines ||
      typeof parsed.baselines !== "object"
    ) {
      return emptyRegistry();
    }
    return {
      schemaVersion: QA_BASELINE_REGISTRY_SCHEMA_VERSION,
      baselines: { ...parsed.baselines },
    };
  } catch (_) {
    return emptyRegistry();
  }
}

function writeRegistry(storage, registry) {
  if (!storage) {
    throw new Error("QA baseline storage is unavailable");
  }
  storage.setItem(QA_BASELINE_STORAGE_KEY, JSON.stringify(registry));
}

export function compactQaBaselineReport(report) {
  return {
    schemaVersion: report.schemaVersion,
    generatedAt: report.generatedAt || null,
    targetDurationSeconds: report.targetDurationSeconds ?? null,
    metadata: clone(report.metadata || {}),
    summary: clone(report.summary || {}),
    events: [],
    samples: [],
  };
}

export function getQaBaselineEligibility(report, {
  packId = report?.metadata?.packId,
  minCoveragePercent = QA_BASELINE_MIN_COVERAGE_PERCENT,
} = {}) {
  const failures = [];
  const validation = validateQaReport(report);

  if (!validation.valid) {
    failures.push(...validation.errors);
  }

  const reportPackId = String(report?.metadata?.packId || "");
  const expectedPackId = String(packId || reportPackId || "");
  const scenarioId = String(report?.metadata?.qaScenarioId || "");
  const scenarioStatus = String(report?.metadata?.qaScenarioStatus || "");
  const expectedScenarioId = expectedPackId
    ? `${expectedPackId}-standard-v1`
    : "";
  const coverage = Number(report?.summary?.samplingCoveragePercent ?? 0);
  const verdict = String(report?.summary?.verdict || "").toLowerCase();

  if (!expectedPackId) failures.push("Pack ID is missing");
  if (expectedPackId && reportPackId !== expectedPackId) {
    failures.push(`Pack ID mismatch: expected ${expectedPackId}, got ${reportPackId || "missing"}`);
  }
  if (!expectedScenarioId || scenarioId !== expectedScenarioId) {
    failures.push(
      `Standard Scenario mismatch: expected ${expectedScenarioId || "<pack>-standard-v1"}, got ${scenarioId || "missing"}`
    );
  }
  if (scenarioStatus !== "completed") {
    failures.push(`Scenario must be completed, got ${scenarioStatus || "missing"}`);
  }
  if (!Number.isFinite(coverage) || coverage < Number(minCoveragePercent)) {
    failures.push(
      `Sampling coverage ${Number.isFinite(coverage) ? coverage.toFixed(1) : "invalid"}% < ${Number(minCoveragePercent).toFixed(1)}%`
    );
  }
  if (verdict === "fail") {
    failures.push("FAIL report cannot be approved as a device baseline");
  }

  return {
    eligible: failures.length === 0,
    failures,
    packId: expectedPackId || null,
    scenarioId: scenarioId || null,
    coveragePercent: Number.isFinite(coverage) ? coverage : null,
    verdict: verdict || null,
  };
}

export function createQaBaselineEntry(report, {
  approvedAt = new Date().toISOString(),
} = {}) {
  const eligibility = getQaBaselineEligibility(report);
  if (!eligibility.eligible) {
    throw new Error("QA baseline is not eligible: " + eligibility.failures.join("; "));
  }

  const compactReport = compactQaBaselineReport(report);
  return {
    schemaVersion: QA_BASELINE_REGISTRY_SCHEMA_VERSION,
    packId: eligibility.packId,
    packVersion: report.metadata?.packVersion || null,
    masteringProfile: report.metadata?.masteringProfile || null,
    scenarioId: eligibility.scenarioId,
    scenarioVersion: report.metadata?.qaScenarioVersion || null,
    sampleRate: Number(report.metadata?.initialSampleRate || 0) || null,
    coveragePercent: eligibility.coveragePercent,
    verdict: eligibility.verdict,
    sourceGeneratedAt: report.generatedAt || null,
    approvedAt,
    report: compactReport,
  };
}

export function saveQaPackBaseline(report, {
  storage: explicitStorage,
  approvedAt,
} = {}) {
  const storage = getStorage(explicitStorage);
  const entry = createQaBaselineEntry(report, { approvedAt });
  const registry = readRegistry(storage);

  registry.baselines[entry.packId] = entry;
  writeRegistry(storage, registry);
  return clone(entry);
}

export function loadQaPackBaseline(packId, {
  storage: explicitStorage,
} = {}) {
  const storage = getStorage(explicitStorage);
  const registry = readRegistry(storage);
  const entry = registry.baselines[String(packId || "")];
  if (!entry?.report) return null;

  const validation = validateQaReport(entry.report);
  if (!validation.valid) return null;
  return clone(entry);
}

export function listQaPackBaselines({
  storage: explicitStorage,
} = {}) {
  const storage = getStorage(explicitStorage);
  const registry = readRegistry(storage);

  return Object.values(registry.baselines)
    .filter((entry) => entry?.packId && entry?.report)
    .map((entry) => clone(entry))
    .sort((a, b) => String(a.packId).localeCompare(String(b.packId)));
}

export function deleteQaPackBaseline(packId, {
  storage: explicitStorage,
} = {}) {
  const storage = getStorage(explicitStorage);
  const registry = readRegistry(storage);
  const key = String(packId || "");
  if (!registry.baselines[key]) return false;

  delete registry.baselines[key];
  writeRegistry(storage, registry);
  return true;
}

export function clearQaPackBaselines({
  storage: explicitStorage,
} = {}) {
  const storage = getStorage(explicitStorage);
  if (!storage) return false;
  storage.removeItem(QA_BASELINE_STORAGE_KEY);
  return true;
}
