import { validateQaReport } from "./music-qa-compare.js";

export const QA_BASELINE_REGISTRY_SCHEMA_VERSION = "2.0.0";
export const QA_BASELINE_STORAGE_KEY = "game-music-qa-pack-baselines-v1";
export const QA_BASELINE_MIN_COVERAGE_PERCENT = 90;
export const QA_BASELINE_COMPATIBILITY_SCHEMA_VERSION = "1.0.0";
export const QA_BASELINE_HISTORY_LIMIT = 6;

const LEGACY_SCHEMA_VERSION = "1.0.0";

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
    histories: {},
  };
}

function entryId(entry = {}) {
  if (entry.id) return String(entry.id);
  const packId = String(entry.packId || "pack");
  const approvedAt = String(entry.approvedAt || "unknown");
  const generatedAt = String(entry.sourceGeneratedAt || entry.report?.generatedAt || "unknown");
  return [packId, approvedAt, generatedAt]
    .join("::")
    .replace(/[^a-zA-Z0-9_.:-]/g, "-");
}

function normalizeEntry(entry) {
  if (!entry?.packId || !entry?.report) return null;
  return {
    ...clone(entry),
    id: entryId(entry),
    schemaVersion: QA_BASELINE_REGISTRY_SCHEMA_VERSION,
  };
}

function normalizeHistory(entries = []) {
  const seen = new Set();
  return entries
    .map(normalizeEntry)
    .filter(Boolean)
    .sort((a, b) =>
      String(b.approvedAt || b.sourceGeneratedAt || "")
        .localeCompare(String(a.approvedAt || a.sourceGeneratedAt || ""))
    )
    .filter((entry) => {
      if (seen.has(entry.id)) return false;
      seen.add(entry.id);
      return true;
    })
    .slice(0, QA_BASELINE_HISTORY_LIMIT);
}

function migrateLegacyRegistry(parsed) {
  const registry = emptyRegistry();
  for (const [packId, entry] of Object.entries(parsed?.baselines || {})) {
    const normalized = normalizeEntry({ ...entry, packId: entry?.packId || packId });
    if (normalized) registry.histories[packId] = [normalized];
  }
  return registry;
}

function readRegistry(storage) {
  if (!storage) return emptyRegistry();

  try {
    const parsed = JSON.parse(storage.getItem(QA_BASELINE_STORAGE_KEY) || "{}");

    if (
      parsed?.schemaVersion === LEGACY_SCHEMA_VERSION &&
      parsed?.baselines &&
      typeof parsed.baselines === "object"
    ) {
      return migrateLegacyRegistry(parsed);
    }

    if (
      parsed?.schemaVersion !== QA_BASELINE_REGISTRY_SCHEMA_VERSION ||
      !parsed?.histories ||
      typeof parsed.histories !== "object"
    ) {
      return emptyRegistry();
    }

    const histories = {};
    for (const [packId, entries] of Object.entries(parsed.histories)) {
      const history = normalizeHistory(Array.isArray(entries) ? entries : []);
      if (history.length) histories[packId] = history;
    }

    return {
      schemaVersion: QA_BASELINE_REGISTRY_SCHEMA_VERSION,
      histories,
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

function normalizeFormat(value) {
  const text = String(value || "").trim().toLowerCase();
  return text || null;
}

function reportContract(report = {}) {
  const metadata = report?.metadata || {};
  return {
    packId: String(metadata.packId || "") || null,
    packVersion: String(metadata.packVersion || "") || null,
    audioFormat: normalizeFormat(metadata.audioFormat),
    masteringProfile: String(metadata.masteringProfile || "") || null,
    facadeApi: String(metadata.facadeApi || "") || null,
    scenarioId: String(metadata.qaScenarioId || metadata.qaScenarioExecution?.id || "") || null,
    scenarioVersion: String(metadata.qaScenarioVersion || "") || null,
    sampleRate: Number(metadata.initialSampleRate || 0) || null,
  };
}

function baselineContract(baseline) {
  const report = baseline?.report || baseline || {};
  const fromReport = reportContract(report);
  return {
    packId: baseline?.packId || fromReport.packId,
    packVersion: baseline?.packVersion || fromReport.packVersion,
    audioFormat: normalizeFormat(baseline?.audioFormat || fromReport.audioFormat),
    masteringProfile: baseline?.masteringProfile || fromReport.masteringProfile,
    facadeApi: baseline?.facadeApi || fromReport.facadeApi,
    scenarioId: baseline?.scenarioId || fromReport.scenarioId,
    scenarioVersion: baseline?.scenarioVersion || fromReport.scenarioVersion,
    sampleRate: Number(baseline?.sampleRate || fromReport.sampleRate || 0) || null,
  };
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

  const contract = reportContract(report);
  const reportPackId = String(contract.packId || "");
  const expectedPackId = String(packId || reportPackId || "");
  const scenarioId = String(contract.scenarioId || "");
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
  if (!contract.packVersion) failures.push("Pack version is missing");
  if (!contract.audioFormat) failures.push("Audio format is missing");
  if (!contract.masteringProfile) failures.push("Mastering profile is missing");
  if (!contract.scenarioVersion) failures.push("Scenario version is missing");
  if (!contract.sampleRate) failures.push("AudioContext sample rate is missing");

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
    contract,
  };
}

export function getQaBaselineCompatibility(baseline, currentReport) {
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
  const after = reportContract(currentReport);

  const hardMatch = (field, label, formatter = (value) => value || "missing") => {
    if (!before[field] || !after[field]) {
      failures.push(`${label} is required: ${formatter(before[field])} -> ${formatter(after[field])}`);
      return;
    }
    if (before[field] !== after[field]) {
      failures.push(`${label} mismatch: ${formatter(before[field])} -> ${formatter(after[field])}`);
    }
  };

  hardMatch("packId", "Pack ID");
  hardMatch("audioFormat", "Audio format", (value) => String(value || "missing").toUpperCase());
  hardMatch("masteringProfile", "Mastering profile");
  hardMatch("scenarioId", "Scenario ID");
  hardMatch("scenarioVersion", "Scenario version");

  if (!before.sampleRate || !after.sampleRate) {
    failures.push(
      `AudioContext sample rate is required: ${before.sampleRate || "missing"} -> ${after.sampleRate || "missing"}`
    );
  } else if (Number(before.sampleRate) !== Number(after.sampleRate)) {
    failures.push(
      `AudioContext sample rate mismatch: ${before.sampleRate} -> ${after.sampleRate} Hz`
    );
  }

  if (!before.packVersion || !after.packVersion) {
    warnings.push({
      code: "pack-version-missing",
      message: `Pack version is incomplete: ${before.packVersion || "missing"} -> ${after.packVersion || "missing"}`,
    });
  } else if (before.packVersion !== after.packVersion) {
    warnings.push({
      code: "pack-version",
      message: `Pack version changed: ${before.packVersion} -> ${after.packVersion}`,
    });
  }

  if (
    before.facadeApi &&
    after.facadeApi &&
    before.facadeApi !== after.facadeApi
  ) {
    warnings.push({
      code: "facade-api",
      message: `Facade API changed: ${before.facadeApi} -> ${after.facadeApi}`,
    });
  }

  const comparable = failures.length === 0;
  const status = !comparable
    ? "incompatible"
    : warnings.length
      ? "review"
      : "exact";

  return {
    schemaVersion: QA_BASELINE_COMPATIBILITY_SCHEMA_VERSION,
    comparable,
    status,
    failures,
    warnings,
    baseline: before,
    current: after,
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
  const contract = eligibility.contract;
  const entry = {
    schemaVersion: QA_BASELINE_REGISTRY_SCHEMA_VERSION,
    packId: eligibility.packId,
    packVersion: contract.packVersion,
    audioFormat: contract.audioFormat,
    masteringProfile: contract.masteringProfile,
    facadeApi: contract.facadeApi,
    scenarioId: eligibility.scenarioId,
    scenarioVersion: contract.scenarioVersion,
    sampleRate: contract.sampleRate,
    coveragePercent: eligibility.coveragePercent,
    verdict: eligibility.verdict,
    sourceGeneratedAt: report.generatedAt || null,
    approvedAt,
    report: compactReport,
  };
  return { ...entry, id: entryId(entry) };
}

export function saveQaPackBaseline(report, {
  storage: explicitStorage,
  approvedAt,
} = {}) {
  const storage = getStorage(explicitStorage);
  const entry = createQaBaselineEntry(report, { approvedAt });
  const registry = readRegistry(storage);
  const history = normalizeHistory([
    entry,
    ...(registry.histories[entry.packId] || []),
  ]);

  registry.histories[entry.packId] = history;
  writeRegistry(storage, registry);
  return clone(history.find((item) => item.id === entry.id) || history[0]);
}

export function listQaPackBaselineHistory(packId, {
  storage: explicitStorage,
} = {}) {
  const storage = getStorage(explicitStorage);
  const registry = readRegistry(storage);
  return clone(registry.histories[String(packId || "")] || []);
}

export function loadQaPackBaseline(packId, {
  storage: explicitStorage,
  id = null,
} = {}) {
  const history = listQaPackBaselineHistory(packId, { storage: explicitStorage });
  const entry = id
    ? history.find((item) => item.id === String(id))
    : history[0];
  if (!entry?.report) return null;

  const validation = validateQaReport(entry.report);
  if (!validation.valid) return null;
  return clone(entry);
}

export function loadQaPackBaselineEntry(id, {
  storage: explicitStorage,
} = {}) {
  const storage = getStorage(explicitStorage);
  const registry = readRegistry(storage);
  const targetId = String(id || "");

  for (const history of Object.values(registry.histories)) {
    const entry = history.find((item) => item.id === targetId);
    if (!entry?.report) continue;
    const validation = validateQaReport(entry.report);
    if (validation.valid) return clone(entry);
  }
  return null;
}

export function listQaPackBaselines({
  storage: explicitStorage,
} = {}) {
  const storage = getStorage(explicitStorage);
  const registry = readRegistry(storage);

  return Object.values(registry.histories)
    .map((history) => history?.[0])
    .filter((entry) => entry?.packId && entry?.report)
    .map((entry) => clone(entry))
    .sort((a, b) => String(a.packId).localeCompare(String(b.packId)));
}

export function deleteQaPackBaselineEntry(id, {
  storage: explicitStorage,
} = {}) {
  const storage = getStorage(explicitStorage);
  const registry = readRegistry(storage);
  const targetId = String(id || "");
  let deleted = false;

  for (const [packId, history] of Object.entries(registry.histories)) {
    const next = history.filter((entry) => entry.id !== targetId);
    if (next.length === history.length) continue;
    deleted = true;
    if (next.length) registry.histories[packId] = next;
    else delete registry.histories[packId];
    break;
  }

  if (deleted) writeRegistry(storage, registry);
  return deleted;
}

export function deleteQaPackBaseline(packId, {
  storage: explicitStorage,
} = {}) {
  const storage = getStorage(explicitStorage);
  const registry = readRegistry(storage);
  const key = String(packId || "");
  if (!registry.histories[key]?.length) return false;

  delete registry.histories[key];
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
