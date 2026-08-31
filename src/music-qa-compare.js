const COMPARE_SCHEMA_VERSION = "1.0.0";

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const round = (value, digits = 3) => {
  if (!Number.isFinite(Number(value))) return null;
  const factor = 10 ** digits;
  return Math.round(Number(value) * factor) / factor;
};

const STATUS_RANK = {
  improved: 0,
  pass: 1,
  changed: 2,
  review: 3,
  fail: 4,
};

function worseStatus(a, b) {
  return STATUS_RANK[a] >= STATUS_RANK[b] ? a : b;
}

function observedDuration(summary = {}) {
  return Math.max(
    0.001,
    finite(summary.observedDurationSeconds, finite(summary.durationSeconds, 0.001)),
  );
}

function rate(seconds, duration) {
  return finite(seconds, 0) / Math.max(0.001, duration);
}

function delta(current, baseline, digits = 3) {
  return round(finite(current, 0) - finite(baseline, 0), digits);
}

function verdictRank(value) {
  return { pass: 0, review: 1, fail: 2 }[String(value || "").toLowerCase()] ?? -1;
}

function classifyDelta(metric, value) {
  const d = finite(value, 0);

  if (metric === "peak") {
    if (d >= 3) return "fail";
    if (d >= 1.5) return "review";
    if (d <= -1.5) return "improved";
    return Math.abs(d) >= 0.75 ? "changed" : "pass";
  }

  if (metric === "reduction") {
    if (d >= 3) return "fail";
    if (d >= 1.5) return "review";
    if (d <= -1.5) return "improved";
    return Math.abs(d) >= 0.75 ? "changed" : "pass";
  }

  if (metric === "limiterRate") {
    if (d >= 0.10) return "fail";
    if (d >= 0.05) return "review";
    if (d <= -0.05) return "improved";
    return Math.abs(d) >= 0.025 ? "changed" : "pass";
  }

  if (metric === "clipRate") {
    if (d >= 0.002 || d > 0 && d * 60 >= 0.1) return "fail";
    if (d < 0) return "improved";
    return "pass";
  }

  if (metric === "rms") {
    if (Math.abs(d) >= 3) return "review";
    if (Math.abs(d) >= 1.5) return "changed";
    return "pass";
  }

  return "pass";
}

function compareMode(name, baselineMode, currentMode) {
  if (!baselineMode) {
    return {
      name,
      presence: "new",
      status: "changed",
      baseline: null,
      current: { ...currentMode },
      delta: null,
    };
  }
  if (!currentMode) {
    return {
      name,
      presence: "removed",
      status: "changed",
      baseline: { ...baselineMode },
      current: null,
      delta: null,
    };
  }

  const peakDelta = delta(currentMode.maxOutputPeakDbfs, baselineMode.maxOutputPeakDbfs);
  const rmsDelta = delta(currentMode.averageOutputRmsDbfs, baselineMode.averageOutputRmsDbfs);
  const reductionDelta = delta(
    currentMode.maxLimiterReductionMagnitudeDb,
    baselineMode.maxLimiterReductionMagnitudeDb,
  );

  let status = "pass";
  status = worseStatus(status, classifyDelta("peak", peakDelta));
  status = worseStatus(status, classifyDelta("reduction", reductionDelta));

  const improved =
    peakDelta <= -1 &&
    reductionDelta <= -1 &&
    status !== "review" &&
    status !== "fail";

  if (improved) status = "improved";

  return {
    name,
    presence: "both",
    status,
    baseline: { ...baselineMode },
    current: { ...currentMode },
    delta: {
      durationSeconds: delta(currentMode.durationSeconds, baselineMode.durationSeconds),
      maxOutputPeakDb: peakDelta,
      averageOutputRmsDb: rmsDelta,
      maxLimiterReductionMagnitudeDb: reductionDelta,
    },
  };
}

function compatibilityWarnings(baseline, current) {
  const warnings = [];
  const bMeta = baseline?.metadata || {};
  const cMeta = current?.metadata || {};
  const bSummary = baseline?.summary || {};
  const cSummary = current?.summary || {};

  if (baseline?.schemaVersion !== current?.schemaVersion) {
    warnings.push({
      code: "schema-version",
      severity: "review",
      message: `Report schema differs: ${baseline?.schemaVersion || "?"} → ${current?.schemaVersion || "?"}`,
    });
  }
  if (bMeta.packId && cMeta.packId && bMeta.packId !== cMeta.packId) {
    warnings.push({
      code: "pack-id",
      severity: "review",
      message: `Different packs: ${bMeta.packId} → ${cMeta.packId}`,
    });
  }
  if (
    bMeta.masteringProfile &&
    cMeta.masteringProfile &&
    bMeta.masteringProfile !== cMeta.masteringProfile
  ) {
    warnings.push({
      code: "mastering-profile",
      severity: "review",
      message: `Mastering profile changed: ${bMeta.masteringProfile} → ${cMeta.masteringProfile}`,
    });
  }
  if (
    bMeta.initialSampleRate &&
    cMeta.initialSampleRate &&
    Number(bMeta.initialSampleRate) !== Number(cMeta.initialSampleRate)
  ) {
    warnings.push({
      code: "sample-rate",
      severity: "info",
      message: `AudioContext sample rate differs: ${bMeta.initialSampleRate} → ${cMeta.initialSampleRate} Hz`,
    });
  }

  const baselineScenarioId = bMeta.qaScenarioId || bMeta.qaScenarioExecution?.id || null;
  const currentScenarioId = cMeta.qaScenarioId || cMeta.qaScenarioExecution?.id || null;
  if (baselineScenarioId !== currentScenarioId) {
    warnings.push({
      code: "scenario-id",
      severity: "review",
      message: `QA scenario differs: ${baselineScenarioId || "manual"} → ${currentScenarioId || "manual"}`,
    });
  }

  for (const [label, meta] of [["baseline", bMeta], ["current", cMeta]]) {
    const execution = meta.qaScenarioExecution || null;
    if (execution && execution.status !== "completed") {
      warnings.push({
        code: `${label}-scenario-status`,
        severity: "review",
        message: `${label} QA scenario did not complete: ${execution.status}${execution.abortReason ? ` (${execution.abortReason})` : ""}`,
      });
    }
    if (execution && Number(execution.maxDriftMs || 0) > 500) {
      warnings.push({
        code: `${label}-scenario-drift`,
        severity: "review",
        message: `${label} QA scenario max drift is ${Math.round(Number(execution.maxDriftMs))} ms`,
      });
    }
  }

  for (const [label, summary] of [["baseline", bSummary], ["current", cSummary]]) {
    const coverage = finite(summary.samplingCoveragePercent, 100);
    if (coverage < 80) {
      warnings.push({
        code: `${label}-coverage`,
        severity: "review",
        message: `${label} sampling coverage is only ${round(coverage, 1)}%`,
      });
    }
  }

  return warnings;
}

export function validateQaReport(report) {
  const errors = [];
  if (!report || typeof report !== "object") errors.push("report must be an object");
  if (!report?.summary || typeof report.summary !== "object") errors.push("summary is missing");
  if (!report?.metadata || typeof report.metadata !== "object") errors.push("metadata is missing");
  if (!Array.isArray(report?.samples)) errors.push("samples must be an array");
  if (!Array.isArray(report?.events)) errors.push("events must be an array");

  const required = [
    "maxOutputPeakDbfs",
    "averageOutputRmsDbfs",
    "maxLimiterReductionMagnitudeDb",
    "limiterOver3Seconds",
    "limiterOver6Seconds",
    "clipRiskSeconds",
  ];
  for (const key of required) {
    if (!Number.isFinite(Number(report?.summary?.[key]))) {
      errors.push(`summary.${key} must be numeric`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function compareQaReports(baseline, current) {
  const baselineValidation = validateQaReport(baseline);
  const currentValidation = validateQaReport(current);

  if (!baselineValidation.valid || !currentValidation.valid) {
    return {
      schemaVersion: COMPARE_SCHEMA_VERSION,
      valid: false,
      errors: [
        ...baselineValidation.errors.map((message) => `baseline: ${message}`),
        ...currentValidation.errors.map((message) => `current: ${message}`),
      ],
    };
  }

  const b = baseline.summary;
  const c = current.summary;
  const bDuration = observedDuration(b);
  const cDuration = observedDuration(c);

  const metrics = {
    maxOutputPeakDb: {
      baseline: round(b.maxOutputPeakDbfs),
      current: round(c.maxOutputPeakDbfs),
      delta: delta(c.maxOutputPeakDbfs, b.maxOutputPeakDbfs),
    },
    averageOutputRmsDb: {
      baseline: round(b.averageOutputRmsDbfs),
      current: round(c.averageOutputRmsDbfs),
      delta: delta(c.averageOutputRmsDbfs, b.averageOutputRmsDbfs),
    },
    maxLimiterReductionMagnitudeDb: {
      baseline: round(b.maxLimiterReductionMagnitudeDb),
      current: round(c.maxLimiterReductionMagnitudeDb),
      delta: delta(c.maxLimiterReductionMagnitudeDb, b.maxLimiterReductionMagnitudeDb),
    },
    limiterOver3: {
      baselineSeconds: round(b.limiterOver3Seconds),
      currentSeconds: round(c.limiterOver3Seconds),
      deltaSeconds: delta(c.limiterOver3Seconds, b.limiterOver3Seconds),
      baselineRate: round(rate(b.limiterOver3Seconds, bDuration), 5),
      currentRate: round(rate(c.limiterOver3Seconds, cDuration), 5),
    },
    limiterOver6: {
      baselineSeconds: round(b.limiterOver6Seconds),
      currentSeconds: round(c.limiterOver6Seconds),
      deltaSeconds: delta(c.limiterOver6Seconds, b.limiterOver6Seconds),
      baselineRate: round(rate(b.limiterOver6Seconds, bDuration), 5),
      currentRate: round(rate(c.limiterOver6Seconds, cDuration), 5),
    },
    clipRisk: {
      baselineSeconds: round(b.clipRiskSeconds),
      currentSeconds: round(c.clipRiskSeconds),
      deltaSeconds: delta(c.clipRiskSeconds, b.clipRiskSeconds),
      baselineRate: round(rate(b.clipRiskSeconds, bDuration), 5),
      currentRate: round(rate(c.clipRiskSeconds, cDuration), 5),
    },
    coveragePercent: {
      baseline: round(finite(b.samplingCoveragePercent, 100), 1),
      current: round(finite(c.samplingCoveragePercent, 100), 1),
      delta: delta(
        finite(c.samplingCoveragePercent, 100),
        finite(b.samplingCoveragePercent, 100),
        1,
      ),
    },
  };

  metrics.limiterOver3.deltaRate = round(
    metrics.limiterOver3.currentRate - metrics.limiterOver3.baselineRate,
    5,
  );
  metrics.limiterOver6.deltaRate = round(
    metrics.limiterOver6.currentRate - metrics.limiterOver6.baselineRate,
    5,
  );
  metrics.clipRisk.deltaRate = round(
    metrics.clipRisk.currentRate - metrics.clipRisk.baselineRate,
    5,
  );

  const modeNames = [...new Set([
    ...Object.keys(b.modes || {}),
    ...Object.keys(c.modes || {}),
  ])].sort();
  const modes = Object.fromEntries(
    modeNames.map((name) => [name, compareMode(name, b.modes?.[name], c.modes?.[name])])
  );

  const stageNames = [...new Set([
    ...Object.keys(b.scenarioStages || {}),
    ...Object.keys(c.scenarioStages || {}),
  ])].sort();
  const scenarioStages = Object.fromEntries(
    stageNames.map((name) => [
      name,
      compareMode(name, b.scenarioStages?.[name], c.scenarioStages?.[name]),
    ])
  );

  const warnings = compatibilityWarnings(baseline, current);

  let status = "pass";
  status = worseStatus(status, classifyDelta("peak", metrics.maxOutputPeakDb.delta));
  status = worseStatus(
    status,
    classifyDelta("reduction", metrics.maxLimiterReductionMagnitudeDb.delta),
  );
  status = worseStatus(status, classifyDelta("limiterRate", metrics.limiterOver3.deltaRate));
  status = worseStatus(status, classifyDelta("limiterRate", metrics.limiterOver6.deltaRate));
  status = worseStatus(status, classifyDelta("clipRate", metrics.clipRisk.deltaRate));

  const baselineVerdictRank = verdictRank(b.verdict);
  const currentVerdictRank = verdictRank(c.verdict);
  if (currentVerdictRank > baselineVerdictRank && currentVerdictRank >= 2) {
    status = "fail";
  } else if (currentVerdictRank > baselineVerdictRank) {
    status = worseStatus(status, "review");
  }

  for (const warning of warnings) {
    if (warning.severity === "review") status = worseStatus(status, "review");
  }
  for (const mode of Object.values(modes)) {
    if (mode.status === "fail") status = "fail";
    else if (mode.status === "review") status = worseStatus(status, "review");
  }
  for (const stage of Object.values(scenarioStages)) {
    if (stage.status === "fail") status = "fail";
    else if (stage.status === "review") status = worseStatus(status, "review");
  }

  const regressionCount = Object.values(modes)
    .filter((mode) => mode.status === "review" || mode.status === "fail").length;
  const improvementCount = Object.values(modes)
    .filter((mode) => mode.status === "improved").length;
  const regressionStageCount = Object.values(scenarioStages)
    .filter((stage) => stage.status === "review" || stage.status === "fail").length;
  const improvedStageCount = Object.values(scenarioStages)
    .filter((stage) => stage.status === "improved").length;

  if (
    status === "pass" &&
    (improvementCount > 0 || improvedStageCount > 0) &&
    metrics.maxOutputPeakDb.delta <= 0 &&
    metrics.maxLimiterReductionMagnitudeDb.delta <= 0 &&
    metrics.limiterOver3.deltaRate <= 0
  ) {
    status = "improved";
  }

  return {
    schemaVersion: COMPARE_SCHEMA_VERSION,
    valid: true,
    generatedAt: new Date().toISOString(),
    baseline: {
      generatedAt: baseline.generatedAt || null,
      packId: baseline.metadata?.packId || null,
      packVersion: baseline.metadata?.packVersion || null,
      verdict: b.verdict || null,
      observedDurationSeconds: round(bDuration),
      scenarioId: baseline.metadata?.qaScenarioId || baseline.metadata?.qaScenarioExecution?.id || null,
    },
    current: {
      generatedAt: current.generatedAt || null,
      packId: current.metadata?.packId || null,
      packVersion: current.metadata?.packVersion || null,
      verdict: c.verdict || null,
      observedDurationSeconds: round(cDuration),
      scenarioId: current.metadata?.qaScenarioId || current.metadata?.qaScenarioExecution?.id || null,
    },
    status,
    metrics,
    modes,
    scenarioStages,
    warnings,
    summary: {
      regressionModeCount: regressionCount,
      improvedModeCount: improvementCount,
      changedModeCount: Object.values(modes).filter((mode) => mode.status === "changed").length,
      regressionStageCount,
      improvedStageCount,
      changedStageCount: Object.values(scenarioStages).filter((stage) => stage.status === "changed").length,
      peakDirection: metrics.maxOutputPeakDb.delta > 0.25
        ? "hotter"
        : metrics.maxOutputPeakDb.delta < -0.25 ? "safer" : "stable",
      rmsDirection: metrics.averageOutputRmsDb.delta > 0.5
        ? "louder"
        : metrics.averageOutputRmsDb.delta < -0.5 ? "quieter" : "stable",
      limiterDirection: metrics.maxLimiterReductionMagnitudeDb.delta > 0.5
        ? "more"
        : metrics.maxLimiterReductionMagnitudeDb.delta < -0.5 ? "less" : "stable",
    },
  };
}

function csvCell(value) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function qaComparisonToCsv(comparison) {
  if (!comparison?.valid) return "status,error\ninvalid,comparison";

  const rows = [
    ["metric", "baseline", "current", "delta", "status"],
    [
      "max_output_peak_dbfs",
      comparison.metrics.maxOutputPeakDb.baseline,
      comparison.metrics.maxOutputPeakDb.current,
      comparison.metrics.maxOutputPeakDb.delta,
      classifyDelta("peak", comparison.metrics.maxOutputPeakDb.delta),
    ],
    [
      "average_output_rms_dbfs",
      comparison.metrics.averageOutputRmsDb.baseline,
      comparison.metrics.averageOutputRmsDb.current,
      comparison.metrics.averageOutputRmsDb.delta,
      classifyDelta("rms", comparison.metrics.averageOutputRmsDb.delta),
    ],
    [
      "max_limiter_reduction_magnitude_db",
      comparison.metrics.maxLimiterReductionMagnitudeDb.baseline,
      comparison.metrics.maxLimiterReductionMagnitudeDb.current,
      comparison.metrics.maxLimiterReductionMagnitudeDb.delta,
      classifyDelta("reduction", comparison.metrics.maxLimiterReductionMagnitudeDb.delta),
    ],
    [
      "limiter_over_3_rate",
      comparison.metrics.limiterOver3.baselineRate,
      comparison.metrics.limiterOver3.currentRate,
      comparison.metrics.limiterOver3.deltaRate,
      classifyDelta("limiterRate", comparison.metrics.limiterOver3.deltaRate),
    ],
    [
      "limiter_over_6_rate",
      comparison.metrics.limiterOver6.baselineRate,
      comparison.metrics.limiterOver6.currentRate,
      comparison.metrics.limiterOver6.deltaRate,
      classifyDelta("limiterRate", comparison.metrics.limiterOver6.deltaRate),
    ],
    [
      "clip_risk_rate",
      comparison.metrics.clipRisk.baselineRate,
      comparison.metrics.clipRisk.currentRate,
      comparison.metrics.clipRisk.deltaRate,
      classifyDelta("clipRate", comparison.metrics.clipRisk.deltaRate),
    ],
  ];

  for (const [name, mode] of Object.entries(comparison.modes || {})) {
    rows.push([
      `mode:${name}:peak_db`,
      mode.baseline?.maxOutputPeakDbfs ?? "",
      mode.current?.maxOutputPeakDbfs ?? "",
      mode.delta?.maxOutputPeakDb ?? "",
      mode.status,
    ]);
    rows.push([
      `mode:${name}:limiter_reduction_db`,
      mode.baseline?.maxLimiterReductionMagnitudeDb ?? "",
      mode.current?.maxLimiterReductionMagnitudeDb ?? "",
      mode.delta?.maxLimiterReductionMagnitudeDb ?? "",
      mode.status,
    ]);
  }

  for (const [name, stage] of Object.entries(comparison.scenarioStages || {})) {
    rows.push([
      `scenario-stage:${name}:peak_db`,
      stage.baseline?.maxOutputPeakDbfs ?? "",
      stage.current?.maxOutputPeakDbfs ?? "",
      stage.delta?.maxOutputPeakDb ?? "",
      stage.status,
    ]);
    rows.push([
      `scenario-stage:${name}:limiter_reduction_db`,
      stage.baseline?.maxLimiterReductionMagnitudeDb ?? "",
      stage.current?.maxLimiterReductionMagnitudeDb ?? "",
      stage.delta?.maxLimiterReductionMagnitudeDb ?? "",
      stage.status,
    ]);
  }

  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

export function qaComparisonFilename(comparison, extension = "json") {
  const stamp = String(comparison?.generatedAt || new Date().toISOString())
    .replaceAll(":", "-")
    .replace(/\.\d{3}Z$/, "Z");
  const pack = String(comparison?.current?.packId || comparison?.baseline?.packId || "music")
    .replace(/[^a-z0-9_-]+/gi, "-");
  return `game-music-qa-compare-${pack}-${stamp}.${extension}`;
}
