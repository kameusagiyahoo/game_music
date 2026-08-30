const REPORT_SCHEMA_VERSION = "1.0.0";
const SILENCE_DB = -180;

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const round = (value, digits = 3) => {
  if (!Number.isFinite(Number(value))) return null;
  const factor = 10 ** digits;
  return Math.round(Number(value) * factor) / factor;
};
const dbToPower = (db) => 10 ** (finite(db, SILENCE_DB) / 10);
const powerToDb = (power) => 10 * Math.log10(Math.max(Number(power) || 0, 1e-18));

function eventName(event) {
  return event?.name ? String(event.name) : null;
}

function eventState(event) {
  if (!event?.name) return null;
  if (event.playing) return "playing";
  if (event.pending) return "pending";
  return "idle";
}

function stemGains(stems = {}) {
  return Object.fromEntries(
    Object.entries(stems).map(([name, value]) => [name, round(finite(value?.gain, 0), 4)])
  );
}

export function createQaSession({
  metadata = {},
  targetDurationSeconds = 60,
  sampleIntervalMs = 100,
  startedAtMs = Date.now(),
} = {}) {
  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    startedAtMs: finite(startedAtMs, Date.now()),
    targetDurationSeconds: Math.max(1, finite(targetDurationSeconds, 60)),
    sampleIntervalMs: Math.max(20, finite(sampleIntervalMs, 100)),
    metadata: { ...metadata },
    samples: [],
  };
}

export function addQaSample(session, meter, {
  capturedAtMs = Date.now(),
  bar = 0,
  beat = 0,
} = {}) {
  if (!session?.samples) throw new Error("QA session is not initialized");
  if (!meter) return null;

  const sample = {
    tMs: Math.max(0, finite(capturedAtMs, Date.now()) - session.startedAtMs),
    bar: Math.max(0, Math.floor(finite(bar, 0))),
    beat: Math.max(0, Math.floor(finite(beat, 0))),
    mode: String(meter.mode || "unknown"),
    layerPreset: String(meter.layerPreset || "unknown"),
    sampleRate: Math.max(0, finite(meter.sampleRate, 0)),
    prePeakDbfs: finite(meter.preLimiter?.peakDbfs, SILENCE_DB),
    preRmsDbfs: finite(meter.preLimiter?.rmsDbfs, SILENCE_DB),
    outputPeakDbfs: finite(meter.output?.peakDbfs, SILENCE_DB),
    outputRmsDbfs: finite(meter.output?.rmsDbfs, SILENCE_DB),
    limiterReductionDb: Math.min(0, finite(meter.limiterReductionDb, 0)),
    stinger: {
      name: eventName(meter.stinger),
      state: eventState(meter.stinger),
    },
    transitionCue: {
      name: eventName(meter.transitionCue),
      state: eventState(meter.transitionCue),
    },
    stems: stemGains(meter.stems),
  };

  session.samples.push(sample);
  return sample;
}

function sampleDurations(samples, endedAtMs, startedAtMs, fallbackMs) {
  const durationsMs = [];
  let samplingGapMs = 0;
  let maxSampleGapMs = 0;
  const maxObservedIntervalMs = Math.max(fallbackMs, fallbackMs * 2.5);

  samples.forEach((sample, index) => {
    const next = samples[index + 1];
    if (next) {
      const rawGap = Math.max(0, next.tMs - sample.tMs);
      maxSampleGapMs = Math.max(maxSampleGapMs, rawGap);
      const observed = Math.min(rawGap, maxObservedIntervalMs);
      durationsMs.push(observed);
      samplingGapMs += Math.max(0, rawGap - observed);
      return;
    }

    const elapsedAtEnd = Math.max(0, finite(endedAtMs, startedAtMs) - startedAtMs);
    const remaining = Math.max(0, elapsedAtEnd - sample.tMs);
    durationsMs.push(Math.min(Math.max(0, fallbackMs), remaining || fallbackMs));
  });

  return {
    durationsMs,
    samplingGapMs,
    maxSampleGapMs,
  };
}

function summarizeModes(samples, durationsMs) {
  const modes = new Map();

  samples.forEach((sample, index) => {
    const key = sample.mode || "unknown";
    if (!modes.has(key)) {
      modes.set(key, {
        durationMs: 0,
        peak: SILENCE_DB,
        rmsPowerMs: 0,
        rmsDurationMs: 0,
        minReductionDb: 0,
        sampleCount: 0,
      });
    }

    const item = modes.get(key);
    const durationMs = durationsMs[index] || 0;
    item.durationMs += durationMs;
    item.peak = Math.max(item.peak, sample.outputPeakDbfs);
    item.rmsPowerMs += dbToPower(sample.outputRmsDbfs) * durationMs;
    item.rmsDurationMs += durationMs;
    item.minReductionDb = Math.min(item.minReductionDb, sample.limiterReductionDb);
    item.sampleCount += 1;
  });

  return Object.fromEntries(
    [...modes.entries()].map(([mode, item]) => [mode, {
      durationSeconds: round(item.durationMs / 1000),
      sampleCount: item.sampleCount,
      maxOutputPeakDbfs: round(item.peak),
      averageOutputRmsDbfs: round(
        item.rmsDurationMs > 0 ? powerToDb(item.rmsPowerMs / item.rmsDurationMs) : SILENCE_DB
      ),
      maxLimiterReductionMagnitudeDb: round(Math.abs(item.minReductionDb)),
    }])
  );
}

function deriveEvents(samples) {
  const events = [];
  let lastMode = null;
  let lastStinger = null;
  let lastTransition = null;

  for (const sample of samples) {
    if (sample.mode && sample.mode !== lastMode) {
      events.push({
        tSeconds: round(sample.tMs / 1000),
        type: "mode",
        name: sample.mode,
        state: "active",
        bar: sample.bar,
        beat: sample.beat,
        outputPeakDbfs: round(sample.outputPeakDbfs),
        limiterReductionDb: round(sample.limiterReductionDb),
      });
      lastMode = sample.mode;
    }

    const stingerKey = sample.stinger?.name
      ? `${sample.stinger.name}:${sample.stinger.state || "idle"}`
      : null;
    if (stingerKey && stingerKey !== lastStinger) {
      events.push({
        tSeconds: round(sample.tMs / 1000),
        type: "stinger",
        name: sample.stinger.name,
        state: sample.stinger.state,
        bar: sample.bar,
        beat: sample.beat,
        outputPeakDbfs: round(sample.outputPeakDbfs),
        limiterReductionDb: round(sample.limiterReductionDb),
      });
    }
    lastStinger = stingerKey;

    const transitionKey = sample.transitionCue?.name
      ? `${sample.transitionCue.name}:${sample.transitionCue.state || "idle"}`
      : null;
    if (transitionKey && transitionKey !== lastTransition) {
      events.push({
        tSeconds: round(sample.tMs / 1000),
        type: "transition-cue",
        name: sample.transitionCue.name,
        state: sample.transitionCue.state,
        bar: sample.bar,
        beat: sample.beat,
        outputPeakDbfs: round(sample.outputPeakDbfs),
        limiterReductionDb: round(sample.limiterReductionDb),
      });
    }
    lastTransition = transitionKey;
  }

  return events;
}

function qaVerdict({
  clipRiskSeconds,
  limiterOver6Seconds,
  limiterOver3Seconds,
  durationSeconds,
}) {
  const duration = Math.max(0.001, durationSeconds);

  if (clipRiskSeconds >= 0.1 || limiterOver6Seconds >= Math.max(1, duration * 0.10)) {
    return "fail";
  }
  if (limiterOver3Seconds >= Math.max(1, duration * 0.10)) {
    return "review";
  }
  return "pass";
}

export function finalizeQaSession(session, {
  endedAtMs = Date.now(),
} = {}) {
  if (!session?.samples) throw new Error("QA session is not initialized");

  const samples = session.samples.map((sample) => ({ ...sample }));
  const ended = Math.max(session.startedAtMs, finite(endedAtMs, Date.now()));
  const durationSeconds = Math.max(0, (ended - session.startedAtMs) / 1000);
  const sampling = sampleDurations(
    samples,
    ended,
    session.startedAtMs,
    session.sampleIntervalMs,
  );
  const durationsMs = sampling.durationsMs;

  let maxPrePeak = SILENCE_DB;
  let maxOutputPeak = SILENCE_DB;
  let outputPowerMs = 0;
  let outputDurationMs = 0;
  let minReductionDb = 0;
  let limiterOver3Ms = 0;
  let limiterOver6Ms = 0;
  let clipRiskMs = 0;

  samples.forEach((sample, index) => {
    const durationMs = durationsMs[index] || 0;
    maxPrePeak = Math.max(maxPrePeak, sample.prePeakDbfs);
    maxOutputPeak = Math.max(maxOutputPeak, sample.outputPeakDbfs);
    outputPowerMs += dbToPower(sample.outputRmsDbfs) * durationMs;
    outputDurationMs += durationMs;
    minReductionDb = Math.min(minReductionDb, sample.limiterReductionDb);

    if (sample.limiterReductionDb <= -3) limiterOver3Ms += durationMs;
    if (sample.limiterReductionDb <= -6) limiterOver6Ms += durationMs;
    if (sample.outputPeakDbfs > -0.15) clipRiskMs += durationMs;
  });

  const observedDurationSeconds = durationsMs.reduce((sum, value) => sum + value, 0) / 1000;
  const coveragePercent = durationSeconds > 0
    ? Math.min(100, observedDurationSeconds / durationSeconds * 100)
    : 0;

  const summary = {
    durationSeconds: round(durationSeconds),
    observedDurationSeconds: round(observedDurationSeconds),
    samplingCoveragePercent: round(coveragePercent, 1),
    samplingGapSeconds: round(sampling.samplingGapMs / 1000),
    maxSampleGapMs: round(sampling.maxSampleGapMs, 1),
    sampleCount: samples.length,
    maxPreLimiterPeakDbfs: round(maxPrePeak),
    maxOutputPeakDbfs: round(maxOutputPeak),
    averageOutputRmsDbfs: round(
      outputDurationMs > 0 ? powerToDb(outputPowerMs / outputDurationMs) : SILENCE_DB
    ),
    maxLimiterReductionMagnitudeDb: round(Math.abs(minReductionDb)),
    minLimiterReductionDb: round(minReductionDb),
    limiterOver3Seconds: round(limiterOver3Ms / 1000),
    limiterOver6Seconds: round(limiterOver6Ms / 1000),
    clipRiskSeconds: round(clipRiskMs / 1000),
    modes: summarizeModes(samples, durationsMs),
  };
  summary.verdict = qaVerdict({
    ...summary,
    durationSeconds: observedDurationSeconds,
  });

  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    generatedAt: new Date(ended).toISOString(),
    startedAt: new Date(session.startedAtMs).toISOString(),
    endedAt: new Date(ended).toISOString(),
    targetDurationSeconds: session.targetDurationSeconds,
    sampleIntervalMs: session.sampleIntervalMs,
    metadata: { ...session.metadata },
    summary,
    events: deriveEvents(samples),
    samples,
  };
}

function csvCell(value) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function qaReportToCsv(report) {
  const stemNames = [...new Set(
    (report?.samples || []).flatMap((sample) => Object.keys(sample.stems || {}))
  )].sort();

  const header = [
    "t_seconds", "bar", "beat", "mode", "layer_preset", "sample_rate",
    "pre_peak_dbfs", "pre_rms_dbfs", "output_peak_dbfs", "output_rms_dbfs",
    "limiter_reduction_db", "stinger", "stinger_state",
    "transition_cue", "transition_state",
    ...stemNames.map((name) => `stem_${name}_gain`),
  ];

  const rows = (report?.samples || []).map((sample) => [
    round(sample.tMs / 1000),
    sample.bar,
    sample.beat,
    sample.mode,
    sample.layerPreset,
    sample.sampleRate,
    round(sample.prePeakDbfs),
    round(sample.preRmsDbfs),
    round(sample.outputPeakDbfs),
    round(sample.outputRmsDbfs),
    round(sample.limiterReductionDb),
    sample.stinger?.name,
    sample.stinger?.state,
    sample.transitionCue?.name,
    sample.transitionCue?.state,
    ...stemNames.map((name) => sample.stems?.[name] ?? ""),
  ]);

  return [header, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\n");
}

export function qaReportFilename(report, extension = "json") {
  const stamp = String(report?.generatedAt || new Date().toISOString())
    .replaceAll(":", "-")
    .replace(/\.\d{3}Z$/, "Z");
  const pack = String(report?.metadata?.packId || "music").replace(/[^a-z0-9_-]+/gi, "-");
  return `game-music-qa-${pack}-${stamp}.${extension}`;
}
