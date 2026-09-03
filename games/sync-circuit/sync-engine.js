export const STABILITY_START = 72;
export const STABILITY_MAX = 100;
export const WRONG_TAP_PENALTY = 6;
export const MISS_PENALTY = 12;

export function clampStability(value) {
  return Math.max(0, Math.min(STABILITY_MAX, Math.round(Number(value) || 0)));
}

export function createPulsePlan({
  players,
  eventIndex,
  randomValue,
  overload = false,
}) {
  const count = Math.max(2, Math.min(4, Math.floor(Number(players) || 2)));
  const index = Math.max(1, Math.floor(Number(eventIndex) || 1));
  const roll = Math.min(0.999999, Math.max(0, Number(randomValue) || 0));

  const chord = count > 1 && (
    overload
      ? index % 2 === 0
      : index >= 4 && index % 4 === 0
  );

  const primary = Math.floor(roll * count);
  const targets = [primary];

  if (chord) {
    const offset = 1 + ((index - 1) % (count - 1));
    targets.push((primary + offset) % count);
  }

  return {
    chord,
    targets: [...new Set(targets)],
    windowMs: overload ? 360 : chord ? 520 : 480,
  };
}

export function applyWrongTap(stability) {
  return clampStability(stability - WRONG_TAP_PENALTY);
}

export function resolvePulseOutcome({
  stability,
  targetCount,
  hitCount,
  chord = false,
  combo = 0,
}) {
  const targets = Math.max(1, Math.floor(Number(targetCount) || 1));
  const hits = Math.max(0, Math.min(targets, Math.floor(Number(hitCount) || 0)));
  const complete = hits === targets;

  if (complete) {
    const nextCombo = combo + 1;
    const comboBonus = Math.min(3, Math.floor(nextCombo / 3));
    const gain = (chord ? 8 : 5) + comboBonus;
    return {
      complete: true,
      stability: clampStability(stability + gain),
      delta: gain,
      nextCombo,
      missing: 0,
    };
  }

  const missing = targets - hits;
  const loss = missing * MISS_PENALTY;
  return {
    complete: false,
    stability: clampStability(stability - loss),
    delta: -loss,
    nextCombo: 0,
    missing,
  };
}
