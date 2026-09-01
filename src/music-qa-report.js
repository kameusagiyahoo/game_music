const REPORT_SCHEMA_VERSION = "1.0.0";
const SILENCE_DB = -180;

export const HOT_SWAP_QA_POLICY = Object.freeze({
  failMinPowerCoefficientSum: 0.80,
  reviewMinPowerCoefficientSum: 0.95,
  failMaxOutputPeakDbfs: -0.15,
  reviewMaxOutputPeakDbfs: -0.50,
  failMaxLimiterReductionMagnitudeDb: 6.0,
  reviewMaxLimiterReductionMagnitudeDb: 3.0,
  failMidRmsDipDb: -9.0,
  reviewMidRmsDipDb: -5.0,
  minimumCrossfadeSamples: 3,
});

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

function hotSwapSnapshot(hotSwap) {
  if (!hotSwap) return null;
  return {
    phase: String(hotSwap.phase || "unknown"),
    fromId: hotSwap.fromId ? String(hotSwap.fromId) : null,
    toId: hotSwap.toId ? String(hotSwap.toId) : null,
    curve: hotSwap.curve ? String(hotSwap.curve) : null,
    quantize: hotSwap.quantize ? String(hotSwap.quantize) : null,
    scheduledAt: round(finite(hotSwap.scheduledAt, 0), 6),
    fadeEnd: round(finite(hotSwap.fadeEnd, 0), 6),
    crossfadeBeats: round(finite(hotSwap.crossfadeBeats, 0), 3),
    fadeSeconds: round(finite(hotSwap.fadeSeconds, 0), 6),
    progress: round(finite(hotSwap.progress, 0), 6),
    outgoingGain: round(finite(hotSwap.outgoingGain, 0), 6),
    incomingGain: round(finite(hotSwap.incomingGain, 0), 6),
    powerCoefficientSum: round(finite(hotSwap.powerCoefficientSum, 0), 6),
  };
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
  scenarioStage = null,
} = {}) {
  if (!session?.samples) throw new Error("QA session is not initialized");
  if (!meter) return null;

  const sample = {
    tMs: Math.max(0, finite(capturedAtMs, Date.now()) - session.startedAtMs),
    bar: Math.max(0, Math.floor(finite(bar, 0))),
    beat: Math.max(0, Math.floor(finite(beat, 0))),
    packId: meter.packId ? String(meter.packId) : null,
    mode: String(meter.mode || "unknown"),
    layerPreset: String(meter.layerPreset || "unknown"),
    scenarioStage: scenarioStage ? String(scenarioStage) : null,
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
    hotSwap: hotSwapSnapshot(meter.hotSwap),
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
    durationsMs.push(Math.min(Math.max(0, fallbackMs), remaining));
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

function summarizeScenarioStages(samples, durationsMs) {
  const stages = new Map();

  samples.forEach((sample, index) => {
    const key = sample.scenarioStage;
    if (!key) return;

    if (!stages.has(key)) {
      stages.set(key, {
        durationMs: 0,
        peak: SILENCE_DB,
        rmsPowerMs: 0,
        rmsDurationMs: 0,
        minReductionDb: 0,
        sampleCount: 0,
      });
    }

    const item = stages.get(key);
    const durationMs = durationsMs[index] || 0;
    item.durationMs += durationMs;
    item.peak = Math.max(item.peak, sample.outputPeakDbfs);
    item.rmsPowerMs += dbToPower(sample.outputRmsDbfs) * durationMs;
    item.rmsDurationMs += durationMs;
    item.minReductionDb = Math.min(item.minReductionDb, sample.limiterReductionDb);
    item.sampleCount += 1;
  });

  return Object.fromEntries(
    [...stages.entries()].map(([stage, item]) => [stage, {
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

function summarizeHotSwaps(samples, durationsMs) {
  const swaps = new Map();

  samples.forEach((sample, index) => {
    const hot = sample.hotSwap;
    if (!hot?.fromId || !hot?.toId) return;

    const key = [
      hot.fromId,
      hot.toId,
      Number(hot.scheduledAt || 0).toFixed(6),
    ].join("->");

    if (!swaps.has(key)) {
      swaps.set(key, {
        fromId: hot.fromId,
        toId: hot.toId,
        curve: hot.curve || null,
        quantize: hot.quantize || null,
        scheduledAt: hot.scheduledAt,
        fadeEnd: hot.fadeEnd,
        crossfadeBeats: hot.crossfadeBeats,
        fadeSeconds: hot.fadeSeconds,
        scheduledSampleCount: 0,
        crossfadeSampleCount: 0,
        durationMs: 0,
        peak: SILENCE_DB,
        minRms: Infinity,
        maxRms: SILENCE_DB,
        rmsPowerMs: 0,
        rmsDurationMs: 0,
        minReductionDb: 0,
        minPower: Infinity,
        maxPower: -Infinity,
        edgeRmsPowerMs: 0,
        edgeRmsDurationMs: 0,
        midRmsPowerMs: 0,
        midRmsDurationMs: 0,
      });
    }

    const item = swaps.get(key);
    if (hot.phase === "scheduled") item.scheduledSampleCount += 1;
    if (hot.phase !== "crossfading") return;

    const durationMs = durationsMs[index] || 0;
    item.crossfadeSampleCount += 1;
    item.durationMs += durationMs;
    item.peak = Math.max(item.peak, sample.outputPeakDbfs);
    item.minRms = Math.min(item.minRms, sample.outputRmsDbfs);
    item.maxRms = Math.max(item.maxRms, sample.outputRmsDbfs);
    item.rmsPowerMs += dbToPower(sample.outputRmsDbfs) * durationMs;
    item.rmsDurationMs += durationMs;
    item.minReductionDb = Math.min(item.minReductionDb, sample.limiterReductionDb);
    item.minPower = Math.min(item.minPower, finite(hot.powerCoefficientSum, 0));
    item.maxPower = Math.max(item.maxPower, finite(hot.powerCoefficientSum, 0));
    const progress = Math.max(0, Math.min(1, finite(hot.progress, 0)));
    if (progress <= 0.20 || progress >= 0.80) {
      item.edgeRmsPowerMs += dbToPower(sample.outputRmsDbfs) * durationMs;
      item.edgeRmsDurationMs += durationMs;
    }
    if (progress >= 0.35 && progress <= 0.65) {
      item.midRmsPowerMs += dbToPower(sample.outputRmsDbfs) * durationMs;
      item.midRmsDurationMs += durationMs;
    }
  });

  return [...swaps.values()].map((item) => {
    const edgeRmsDbfs = item.edgeRmsDurationMs > 0
      ? powerToDb(item.edgeRmsPowerMs / item.edgeRmsDurationMs)
      : null;
    const midRmsDbfs = item.midRmsDurationMs > 0
      ? powerToDb(item.midRmsPowerMs / item.midRmsDurationMs)
      : null;
    const midRmsDeltaDb = Number.isFinite(edgeRmsDbfs) && Number.isFinite(midRmsDbfs)
      ? midRmsDbfs - edgeRmsDbfs
      : null;

    return {
      fromId: item.fromId,
      toId: item.toId,
      curve: item.curve,
      quantize: item.quantize,
      scheduledAt: item.scheduledAt,
      fadeEnd: item.fadeEnd,
      crossfadeBeats: item.crossfadeBeats,
      fadeSeconds: item.fadeSeconds,
      scheduledSampleCount: item.scheduledSampleCount,
      crossfadeSampleCount: item.crossfadeSampleCount,
      durationSeconds: round(item.durationMs / 1000),
      maxOutputPeakDbfs: item.crossfadeSampleCount ? round(item.peak) : null,
      minOutputRmsDbfs: item.crossfadeSampleCount ? round(item.minRms) : null,
      maxOutputRmsDbfs: item.crossfadeSampleCount ? round(item.maxRms) : null,
      averageOutputRmsDbfs: item.rmsDurationMs > 0
        ? round(powerToDb(item.rmsPowerMs / item.rmsDurationMs))
        : null,
      edgeAverageOutputRmsDbfs: Number.isFinite(edgeRmsDbfs) ? round(edgeRmsDbfs) : null,
      midpointAverageOutputRmsDbfs: Number.isFinite(midRmsDbfs) ? round(midRmsDbfs) : null,
      midpointRmsDeltaDb: Number.isFinite(midRmsDeltaDb) ? round(midRmsDeltaDb) : null,
      maxLimiterReductionMagnitudeDb: round(Math.abs(item.minReductionDb)),
      minPowerCoefficientSum: Number.isFinite(item.minPower) ? round(item.minPower, 6) : null,
      maxPowerCoefficientSum: Number.isFinite(item.maxPower) ? round(item.maxPower, 6) : null,
    };
  });
}

export function evaluateHotSwapQa(
  hotSwaps = [],
  policy = HOT_SWAP_QA_POLICY,
) {
  const active = hotSwaps.filter((swap) => Number(swap?.crossfadeSampleCount || 0) > 0);

  if (!active.length) {
    return {
      status: "not-applicable",
      evaluatedCount: 0,
      failures: [],
      warnings: [],
      policy: { ...policy },
      swaps: [],
    };
  }

  const evaluations = active.map((swap) => {
    const failures = [];
    const warnings = [];
    const sampleCount = Number(swap.crossfadeSampleCount || 0);
    const minPower = Number(swap.minPowerCoefficientSum);
    const peak = Number(swap.maxOutputPeakDbfs);
    const reduction = Number(swap.maxLimiterReductionMagnitudeDb);
    const midRmsDelta = Number(swap.midpointRmsDeltaDb);

    if (sampleCount < policy.minimumCrossfadeSamples) {
      warnings.push(
        `crossfade samples ${sampleCount} < ${policy.minimumCrossfadeSamples}`
      );
    }

    if (Number.isFinite(minPower)) {
      if (minPower < policy.failMinPowerCoefficientSum) {
        failures.push(
          `power coefficient sum ${minPower.toFixed(4)} < ${policy.failMinPowerCoefficientSum.toFixed(2)}`
        );
      } else if (minPower < policy.reviewMinPowerCoefficientSum) {
        warnings.push(
          `power coefficient sum ${minPower.toFixed(4)} < ${policy.reviewMinPowerCoefficientSum.toFixed(2)}`
        );
      }
    }

    if (Number.isFinite(peak)) {
      if (peak > policy.failMaxOutputPeakDbfs) {
        failures.push(
          `output peak ${peak.toFixed(2)} dBFS > ${policy.failMaxOutputPeakDbfs.toFixed(2)} dBFS`
        );
      } else if (peak > policy.reviewMaxOutputPeakDbfs) {
        warnings.push(
          `output peak ${peak.toFixed(2)} dBFS > ${policy.reviewMaxOutputPeakDbfs.toFixed(2)} dBFS`
        );
      }
    }

    if (Number.isFinite(reduction)) {
      if (reduction > policy.failMaxLimiterReductionMagnitudeDb) {
        failures.push(
          `limiter reduction ${reduction.toFixed(2)} dB > ${policy.failMaxLimiterReductionMagnitudeDb.toFixed(1)} dB`
        );
      } else if (reduction > policy.reviewMaxLimiterReductionMagnitudeDb) {
        warnings.push(
          `limiter reduction ${reduction.toFixed(2)} dB > ${policy.reviewMaxLimiterReductionMagnitudeDb.toFixed(1)} dB`
        );
      }
    }

    if (Number.isFinite(midRmsDelta)) {
      if (midRmsDelta < policy.failMidRmsDipDb) {
        failures.push(
          `midpoint RMS delta ${midRmsDelta.toFixed(2)} dB < ${policy.failMidRmsDipDb.toFixed(1)} dB`
        );
      } else if (midRmsDelta < policy.reviewMidRmsDipDb) {
        warnings.push(
          `midpoint RMS delta ${midRmsDelta.toFixed(2)} dB < ${policy.reviewMidRmsDipDb.toFixed(1)} dB`
        );
      }
    }

    const status = failures.length ? "fail" : warnings.length ? "review" : "pass";
    return {
      fromId: swap.fromId,
      toId: swap.toId,
      curve: swap.curve,
      status,
      failures,
      warnings,
      metrics: {
        crossfadeSampleCount: sampleCount,
        maxOutputPeakDbfs: swap.maxOutputPeakDbfs,
        maxLimiterReductionMagnitudeDb: swap.maxLimiterReductionMagnitudeDb,
        minPowerCoefficientSum: swap.minPowerCoefficientSum,
        edgeAverageOutputRmsDbfs: swap.edgeAverageOutputRmsDbfs,
        midpointAverageOutputRmsDbfs: swap.midpointAverageOutputRmsDbfs,
        midpointRmsDeltaDb: swap.midpointRmsDeltaDb,
      },
    };
  });

  const failures = evaluations.flatMap((item) =>
    item.failures.map((message) => `${item.fromId}->${item.toId}: ${message}`)
  );
  const warnings = evaluations.flatMap((item) =>
    item.warnings.map((message) => `${item.fromId}->${item.toId}: ${message}`)
  );
  const status = failures.length ? "fail" : warnings.length ? "review" : "pass";

  return {
    status,
    evaluatedCount: evaluations.length,
    failures,
    warnings,
    policy: { ...policy },
    swaps: evaluations,
  };
}

function deriveEvents(samples) {
  const events = [];
  let lastMode = null;
  let lastScenarioStage = null;
  let lastStinger = null;
  let lastTransition = null;
  let lastHotSwap = null;

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

    if (sample.scenarioStage && sample.scenarioStage !== lastScenarioStage) {
      events.push({
        tSeconds: round(sample.tMs / 1000),
        type: "scenario-stage",
        name: sample.scenarioStage,
        state: "active",
        bar: sample.bar,
        beat: sample.beat,
        outputPeakDbfs: round(sample.outputPeakDbfs),
        limiterReductionDb: round(sample.limiterReductionDb),
      });
      lastScenarioStage = sample.scenarioStage;
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

    const hot = sample.hotSwap;
    if (hot?.fromId && hot?.toId) {
      const hotKey = [
        hot.fromId,
        hot.toId,
        hot.scheduledAt,
        hot.phase,
      ].join(":");
      if (!lastHotSwap || hotKey !== lastHotSwap.key) {
        events.push({
          tSeconds: round(sample.tMs / 1000),
          type: "hot-swap",
          name: `${hot.fromId}->${hot.toId}`,
          state: hot.phase,
          fromId: hot.fromId,
          toId: hot.toId,
          curve: hot.curve,
          progress: hot.progress,
          outgoingGain: hot.outgoingGain,
          incomingGain: hot.incomingGain,
          powerCoefficientSum: hot.powerCoefficientSum,
          bar: sample.bar,
          beat: sample.beat,
          outputPeakDbfs: round(sample.outputPeakDbfs),
          limiterReductionDb: round(sample.limiterReductionDb),
        });
      }
      lastHotSwap = { key: hotKey, ...hot };
    } else if (lastHotSwap) {
      if (lastHotSwap.phase !== "complete") {
        events.push({
          tSeconds: round(sample.tMs / 1000),
          type: "hot-swap",
          name: `${lastHotSwap.fromId}->${lastHotSwap.toId}`,
          state: "complete",
          fromId: lastHotSwap.fromId,
          toId: lastHotSwap.toId,
          curve: lastHotSwap.curve,
          progress: 1,
          outgoingGain: 0,
          incomingGain: 1,
          powerCoefficientSum: 1,
          bar: sample.bar,
          beat: sample.beat,
          outputPeakDbfs: round(sample.outputPeakDbfs),
          limiterReductionDb: round(sample.limiterReductionDb),
        });
      }
      lastHotSwap = null;
    }
  }

  return events;
}

function qaVerdict({
  clipRiskSeconds,
  limiterOver6Seconds,
  limiterOver3Seconds,
  durationSeconds,
  hotSwapQaStatus = "not-applicable",
}) {
  const duration = Math.max(0.001, durationSeconds);

  if (
    hotSwapQaStatus === "fail" ||
    clipRiskSeconds >= 0.1 ||
    limiterOver6Seconds >= Math.max(1, duration * 0.10)
  ) {
    return "fail";
  }
  if (
    hotSwapQaStatus === "review" ||
    limiterOver3Seconds >= Math.max(1, duration * 0.10)
  ) {
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

  const hotSwaps = summarizeHotSwaps(samples, durationsMs);
  const activeHotSwaps = hotSwaps.filter((item) => item.crossfadeSampleCount > 0);
  const hotSwapDurationSeconds = activeHotSwaps.reduce(
    (sum, item) => sum + Number(item.durationSeconds || 0),
    0,
  );
  const hotSwapPeakValues = activeHotSwaps
    .map((item) => item.maxOutputPeakDbfs)
    .filter((value) => Number.isFinite(Number(value)));
  const hotSwapRmsValues = activeHotSwaps
    .map((item) => item.minOutputRmsDbfs)
    .filter((value) => Number.isFinite(Number(value)));
  const hotSwapReductionValues = activeHotSwaps
    .map((item) => item.maxLimiterReductionMagnitudeDb)
    .filter((value) => Number.isFinite(Number(value)));
  const hotSwapPowerValues = activeHotSwaps
    .map((item) => item.minPowerCoefficientSum)
    .filter((value) => Number.isFinite(Number(value)));

  const hotSwapQa = evaluateHotSwapQa(hotSwaps);

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
    scenarioStages: summarizeScenarioStages(samples, durationsMs),
    hotSwapCount: hotSwaps.length,
    hotSwapCrossfadeSeconds: round(hotSwapDurationSeconds),
    hotSwapMaxOutputPeakDbfs: hotSwapPeakValues.length ? round(Math.max(...hotSwapPeakValues)) : null,
    hotSwapMinOutputRmsDbfs: hotSwapRmsValues.length ? round(Math.min(...hotSwapRmsValues)) : null,
    hotSwapMaxLimiterReductionMagnitudeDb: hotSwapReductionValues.length
      ? round(Math.max(...hotSwapReductionValues))
      : null,
    hotSwapMinPowerCoefficientSum: hotSwapPowerValues.length
      ? round(Math.min(...hotSwapPowerValues), 6)
      : null,
    hotSwapQa,
    hotSwaps,
  };
  summary.verdict = qaVerdict({
    ...summary,
    durationSeconds: observedDurationSeconds,
    hotSwapQaStatus: hotSwapQa.status,
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
    "t_seconds", "bar", "beat", "pack_id", "mode", "layer_preset", "scenario_stage", "sample_rate",
    "pre_peak_dbfs", "pre_rms_dbfs", "output_peak_dbfs", "output_rms_dbfs",
    "limiter_reduction_db", "stinger", "stinger_state",
    "transition_cue", "transition_state",
    "hot_swap_phase", "hot_swap_from", "hot_swap_to", "hot_swap_curve",
    "hot_swap_progress", "hot_swap_outgoing_gain", "hot_swap_incoming_gain",
    "hot_swap_power_coefficient_sum",
    ...stemNames.map((name) => `stem_${name}_gain`),
  ];

  const rows = (report?.samples || []).map((sample) => [
    round(sample.tMs / 1000),
    sample.bar,
    sample.beat,
    sample.packId,
    sample.mode,
    sample.layerPreset,
    sample.scenarioStage,
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
    sample.hotSwap?.phase,
    sample.hotSwap?.fromId,
    sample.hotSwap?.toId,
    sample.hotSwap?.curve,
    sample.hotSwap?.progress,
    sample.hotSwap?.outgoingGain,
    sample.hotSwap?.incomingGain,
    sample.hotSwap?.powerCoefficientSum,
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
