import {
  clampStability,
  createPulsePlan,
  resolvePulseOutcome,
} from "./sync-engine.js";

export const RESCUE_WINDOW_MS = 260;
export const LINK_RESCUE_BONUS = 3;
export const RESCUE_GAIN_COST = 2;

export const ADAPTIVE_PROFILES = Object.freeze({
  assist: Object.freeze({
    id: "assist",
    label: "ASSIST",
    windowScale: 1.18,
  }),
  balanced: Object.freeze({
    id: "balanced",
    label: "BALANCED",
    windowScale: 1,
  }),
  intense: Object.freeze({
    id: "intense",
    label: "INTENSE",
    windowScale: 0.84,
  }),
});

const ADAPTIVE_HISTORY_SIZE = 6;
let adaptiveHistory = [];
let adaptiveStability = 72;
let adaptiveProfile = ADAPTIVE_PROFILES.balanced;

function normalizePlayers(players) {
  return Math.max(2, Math.min(4, Math.floor(Number(players) || 2)));
}

function findLinkIndex(players, targets, eventIndex) {
  const count = normalizePlayers(players);
  const blocked = new Set(targets);
  const rolePhase = Math.floor((Math.max(1, eventIndex) - 1) / 4) % count;

  for (let offset = 0; offset < count; offset += 1) {
    const candidate = (rolePhase + offset) % count;
    if (!blocked.has(candidate)) return candidate;
  }

  return null;
}

function selectAdaptiveProfile() {
  if (adaptiveHistory.length < 3) {
    return ADAPTIVE_PROFILES.balanced;
  }

  const successes = adaptiveHistory.filter((entry) => entry.complete).length;
  const rescueHeavy = adaptiveHistory.filter((entry) => entry.rescuedCount > 0).length;
  const successRate = successes / adaptiveHistory.length;

  if (
    adaptiveStability <= 40 ||
    successRate < 0.55 ||
    rescueHeavy >= Math.ceil(adaptiveHistory.length / 2)
  ) {
    return ADAPTIVE_PROFILES.assist;
  }

  if (
    adaptiveStability >= 80 &&
    successRate >= 0.85 &&
    rescueHeavy === 0
  ) {
    return ADAPTIVE_PROFILES.intense;
  }

  return ADAPTIVE_PROFILES.balanced;
}

function recordAdaptiveOutcome(outcome) {
  adaptiveStability = outcome.stability;
  adaptiveHistory.push({
    complete: Boolean(outcome.complete),
    rescuedCount: Math.max(0, Number(outcome.rescuedCount) || 0),
  });
  adaptiveHistory = adaptiveHistory.slice(-ADAPTIVE_HISTORY_SIZE);
  adaptiveProfile = selectAdaptiveProfile();
}

export function resetAdaptiveDifficulty() {
  adaptiveHistory = [];
  adaptiveStability = 72;
  adaptiveProfile = ADAPTIVE_PROFILES.balanced;
  return getAdaptiveDifficultySnapshot();
}

export function getAdaptiveDifficultySnapshot() {
  const successes = adaptiveHistory.filter((entry) => entry.complete).length;
  const successRate = adaptiveHistory.length
    ? successes / adaptiveHistory.length
    : 0;

  return {
    profile: adaptiveProfile.id,
    label: adaptiveProfile.label,
    stability: adaptiveStability,
    sampleSize: adaptiveHistory.length,
    successRate,
    windowScale: adaptiveProfile.windowScale,
  };
}

export function applyAdaptiveWindow(windowMs, profile = adaptiveProfile) {
  const base = Math.max(120, Number(windowMs) || 120);
  return Math.round(base * profile.windowScale);
}

export function createCooperationPlan({
  players,
  eventIndex,
  randomValue,
  overload = false,
}) {
  const count = normalizePlayers(players);
  const index = Math.max(1, Math.floor(Number(eventIndex) || 1));

  if (index === 1) resetAdaptiveDifficulty();
  const profile = selectAdaptiveProfile();
  adaptiveProfile = profile;
  const allSync = index % 6 === 0;

  if (allSync) {
    const baseWindowMs = overload ? 480 : 650;
    return {
      type: "all-sync",
      chord: true,
      allSync: true,
      targets: Array.from({ length: count }, (_, playerIndex) => playerIndex),
      windowMs: applyAdaptiveWindow(baseWindowMs, profile),
      baseWindowMs,
      rescueAllowed: false,
      linkIndex: null,
      difficulty: profile.id,
      difficultyLabel: profile.label,
    };
  }

  const pulse = createPulsePlan({
    players: count,
    eventIndex: index,
    randomValue,
    overload,
  });
  const linkIndex = findLinkIndex(count, pulse.targets, index);
  const baseWindowMs = pulse.windowMs;

  return {
    ...pulse,
    type: pulse.chord ? "chord" : "single",
    allSync: false,
    windowMs: applyAdaptiveWindow(baseWindowMs, profile),
    baseWindowMs,
    rescueAllowed: linkIndex !== null,
    linkIndex,
    difficulty: profile.id,
    difficultyLabel: profile.label,
  };
}

export function canPlayerRescue({
  playerIndex,
  targets,
  rescuers,
  rescueSlots,
}) {
  const index = Number(playerIndex);
  if (!Number.isInteger(index) || index < 0) return false;
  if (rescueSlots <= 0) return false;
  if (targets.has(index)) return false;
  if (rescuers.has(index)) return false;
  return rescuers.size < rescueSlots;
}

export function resolveCooperativeOutcome({
  stability,
  targetCount,
  directHitCount,
  rescuedCount = 0,
  linkRescueCount = 0,
  chord = false,
  allSync = false,
  combo = 0,
}) {
  const targets = Math.max(1, Math.floor(Number(targetCount) || 1));
  const directHits = Math.max(0, Math.min(targets, Math.floor(Number(directHitCount) || 0)));
  const rescued = Math.max(0, Math.min(targets - directHits, Math.floor(Number(rescuedCount) || 0)));
  const effectiveHits = directHits + rescued;

  const base = resolvePulseOutcome({
    stability,
    targetCount: targets,
    hitCount: effectiveHits,
    chord: chord || allSync,
    combo,
  });

  if (!base.complete) {
    const outcome = {
      ...base,
      rescuedCount: rescued,
      linkRescueCount: 0,
      rescueAdjusted: false,
    };
    recordAdaptiveOutcome(outcome);
    return outcome;
  }

  const links = Math.max(0, Math.min(rescued, Math.floor(Number(linkRescueCount) || 0)));
  const allSyncBonus = allSync ? 4 : 0;
  const adjustedDelta = Math.max(
    1,
    base.delta + allSyncBonus - rescued * RESCUE_GAIN_COST + links * LINK_RESCUE_BONUS,
  );

  const outcome = {
    ...base,
    stability: clampStability(stability + adjustedDelta),
    delta: adjustedDelta,
    rescuedCount: rescued,
    linkRescueCount: links,
    rescueAdjusted: rescued > 0,
  };
  recordAdaptiveOutcome(outcome);
  return outcome;
}
