export const HOT_SWAP_COMPARE_POLICY = Object.freeze({
  reviewPeakIncreaseDb: 1.0,
  failPeakIncreaseDb: 2.0,
  reviewLimiterIncreaseDb: 1.0,
  failLimiterIncreaseDb: 2.5,
  reviewMidpointRmsDropDb: -2.0,
  failMidpointRmsDropDb: -4.0,
  reviewPowerDrop: -0.03,
  failPowerDrop: -0.08,
  reviewDurationRelativeChange: 0.20,
  failDurationRelativeChange: 0.40,
});

const round = (value, digits = 3) => {
  if (!Number.isFinite(Number(value))) return null;
  const factor = 10 ** digits;
  return Math.round(Number(value) * factor) / factor;
};

function optionalNumber(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function optionalDelta(current, baseline, digits = 3) {
  const currentNumber = optionalNumber(current);
  const baselineNumber = optionalNumber(baseline);
  if (currentNumber == null || baselineNumber == null) return null;
  return round(currentNumber - baselineNumber, digits);
}

function enumerateHotSwaps(swaps = []) {
  const counts = new Map();
  return (Array.isArray(swaps) ? swaps : []).map((swap) => {
    const fromId = String(swap?.fromId || "?");
    const toId = String(swap?.toId || "?");
    const route = fromId + "->" + toId;
    const occurrence = (counts.get(route) || 0) + 1;
    counts.set(route, occurrence);
    return {
      key: route + "#" + occurrence,
      route,
      occurrence,
      swap,
    };
  });
}

function compareHotSwapItem(
  route,
  occurrence,
  baselineSwap,
  currentSwap,
  policy = HOT_SWAP_COMPARE_POLICY,
) {
  if (!baselineSwap || !currentSwap) {
    return {
      key: route + "#" + occurrence,
      route,
      occurrence,
      presence: baselineSwap ? "removed" : "new",
      status: "review",
      baseline: baselineSwap ? { ...baselineSwap } : null,
      current: currentSwap ? { ...currentSwap } : null,
      delta: null,
      failures: [],
      warnings: [
        baselineSwap
          ? "Hot Swap route is missing from the current report"
          : "Hot Swap route is new compared with the baseline",
      ],
    };
  }

  const peakDelta = optionalDelta(
    currentSwap.maxOutputPeakDbfs,
    baselineSwap.maxOutputPeakDbfs,
  );
  const limiterDelta = optionalDelta(
    currentSwap.maxLimiterReductionMagnitudeDb,
    baselineSwap.maxLimiterReductionMagnitudeDb,
  );
  const midpointRmsDelta = optionalDelta(
    currentSwap.midpointRmsDeltaDb,
    baselineSwap.midpointRmsDeltaDb,
  );
  const powerDelta = optionalDelta(
    currentSwap.minPowerCoefficientSum,
    baselineSwap.minPowerCoefficientSum,
    6,
  );
  const durationDelta = optionalDelta(
    currentSwap.durationSeconds,
    baselineSwap.durationSeconds,
  );
  const baselineDuration = optionalNumber(baselineSwap.durationSeconds);
  const durationRelative =
    durationDelta != null && baselineDuration != null && baselineDuration > 0
      ? round(durationDelta / baselineDuration, 4)
      : null;

  const warnings = [];
  const failures = [];
  let improved = false;

  if (peakDelta != null) {
    if (peakDelta >= policy.failPeakIncreaseDb) {
      failures.push(
        "peak +" + peakDelta.toFixed(2) + " dB >= +" +
        policy.failPeakIncreaseDb.toFixed(1) + " dB"
      );
    } else if (peakDelta >= policy.reviewPeakIncreaseDb) {
      warnings.push(
        "peak +" + peakDelta.toFixed(2) + " dB >= +" +
        policy.reviewPeakIncreaseDb.toFixed(1) + " dB"
      );
    } else if (peakDelta <= -policy.reviewPeakIncreaseDb) {
      improved = true;
    }
  }

  if (limiterDelta != null) {
    if (limiterDelta >= policy.failLimiterIncreaseDb) {
      failures.push(
        "limiter +" + limiterDelta.toFixed(2) + " dB >= +" +
        policy.failLimiterIncreaseDb.toFixed(1) + " dB"
      );
    } else if (limiterDelta >= policy.reviewLimiterIncreaseDb) {
      warnings.push(
        "limiter +" + limiterDelta.toFixed(2) + " dB >= +" +
        policy.reviewLimiterIncreaseDb.toFixed(1) + " dB"
      );
    } else if (limiterDelta <= -policy.reviewLimiterIncreaseDb) {
      improved = true;
    }
  }

  if (midpointRmsDelta != null) {
    if (midpointRmsDelta <= policy.failMidpointRmsDropDb) {
      failures.push(
        "midpoint RMS delta " + midpointRmsDelta.toFixed(2) + " dB <= " +
        policy.failMidpointRmsDropDb.toFixed(1) + " dB"
      );
    } else if (midpointRmsDelta <= policy.reviewMidpointRmsDropDb) {
      warnings.push(
        "midpoint RMS delta " + midpointRmsDelta.toFixed(2) + " dB <= " +
        policy.reviewMidpointRmsDropDb.toFixed(1) + " dB"
      );
    } else if (midpointRmsDelta >= Math.abs(policy.reviewMidpointRmsDropDb)) {
      improved = true;
    }
  }

  if (powerDelta != null) {
    if (powerDelta <= policy.failPowerDrop) {
      failures.push(
        "minimum power sum delta " + powerDelta.toFixed(4) + " <= " +
        policy.failPowerDrop.toFixed(2)
      );
    } else if (powerDelta <= policy.reviewPowerDrop) {
      warnings.push(
        "minimum power sum delta " + powerDelta.toFixed(4) + " <= " +
        policy.reviewPowerDrop.toFixed(2)
      );
    } else if (powerDelta >= Math.abs(policy.reviewPowerDrop)) {
      improved = true;
    }
  }

  if (durationRelative != null) {
    const magnitude = Math.abs(durationRelative);
    if (magnitude >= policy.failDurationRelativeChange) {
      failures.push(
        "crossfade duration changed " + (durationRelative * 100).toFixed(1) + "%"
      );
    } else if (magnitude >= policy.reviewDurationRelativeChange) {
      warnings.push(
        "crossfade duration changed " + (durationRelative * 100).toFixed(1) + "%"
      );
    }
  }

  const baselineCurve = String(baselineSwap.curve || "");
  const currentCurve = String(currentSwap.curve || "");
  if (baselineCurve && currentCurve && baselineCurve !== currentCurve) {
    warnings.push("curve changed: " + baselineCurve + " -> " + currentCurve);
  }

  const baselineQuantize = String(baselineSwap.quantize || "");
  const currentQuantize = String(currentSwap.quantize || "");
  if (baselineQuantize && currentQuantize && baselineQuantize !== currentQuantize) {
    warnings.push("quantize changed: " + baselineQuantize + " -> " + currentQuantize);
  }

  const status = failures.length
    ? "fail"
    : warnings.length
      ? "review"
      : improved
        ? "improved"
        : "pass";

  return {
    key: route + "#" + occurrence,
    route,
    occurrence,
    presence: "both",
    status,
    baseline: { ...baselineSwap },
    current: { ...currentSwap },
    delta: {
      maxOutputPeakDb: peakDelta,
      maxLimiterReductionMagnitudeDb: limiterDelta,
      midpointRmsDeltaDb: midpointRmsDelta,
      minPowerCoefficientSum: powerDelta,
      durationSeconds: durationDelta,
      durationRelative,
    },
    failures,
    warnings,
  };
}

export function compareHotSwapSummaries(
  baselineSummary = {},
  currentSummary = {},
  policy = HOT_SWAP_COMPARE_POLICY,
) {
  const baselineItems = enumerateHotSwaps(baselineSummary.hotSwaps || []);
  const currentItems = enumerateHotSwaps(currentSummary.hotSwaps || []);
  const baselineMap = new Map(baselineItems.map((item) => [item.key, item]));
  const currentMap = new Map(currentItems.map((item) => [item.key, item]));
  const keys = [...new Set([
    ...baselineItems.map((item) => item.key),
    ...currentItems.map((item) => item.key),
  ])];

  if (!keys.length) {
    return {
      status: "not-applicable",
      baselineCount: 0,
      currentCount: 0,
      comparedCount: 0,
      regressionCount: 0,
      improvementCount: 0,
      routeChangeCount: 0,
      policy: { ...policy },
      items: [],
    };
  }

  const items = keys.map((key) => {
    const baselineItem = baselineMap.get(key);
    const currentItem = currentMap.get(key);
    const item = baselineItem || currentItem;
    return compareHotSwapItem(
      item.route,
      item.occurrence,
      baselineItem?.swap || null,
      currentItem?.swap || null,
      policy,
    );
  });

  const failures = items.filter((item) => item.status === "fail");
  const reviews = items.filter((item) => item.status === "review");
  const improvements = items.filter((item) => item.status === "improved");
  const routeChanges = items.filter((item) => item.presence !== "both");

  const status = failures.length
    ? "fail"
    : reviews.length
      ? "review"
      : improvements.length
        ? "improved"
        : "pass";

  return {
    status,
    baselineCount: baselineItems.length,
    currentCount: currentItems.length,
    comparedCount: items.filter((item) => item.presence === "both").length,
    regressionCount: failures.length + reviews.length,
    improvementCount: improvements.length,
    routeChangeCount: routeChanges.length,
    policy: { ...policy },
    items,
  };
}
