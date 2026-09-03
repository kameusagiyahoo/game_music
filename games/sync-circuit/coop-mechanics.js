import {
  clampStability,
  createPulsePlan,
  resolvePulseOutcome,
} from "./sync-engine.js";

export const RESCUE_WINDOW_MS = 260;
export const LINK_RESCUE_BONUS = 3;
export const RESCUE_GAIN_COST = 2;

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

export function createCooperationPlan({
  players,
  eventIndex,
  randomValue,
  overload = false,
}) {
  const count = normalizePlayers(players);
  const index = Math.max(1, Math.floor(Number(eventIndex) || 1));
  const allSync = index % 6 === 0;

  if (allSync) {
    return {
      type: "all-sync",
      chord: true,
      allSync: true,
      targets: Array.from({ length: count }, (_, playerIndex) => playerIndex),
      windowMs: overload ? 480 : 650,
      rescueAllowed: false,
      linkIndex: null,
    };
  }

  const pulse = createPulsePlan({
    players: count,
    eventIndex: index,
    randomValue,
    overload,
  });
  const linkIndex = findLinkIndex(count, pulse.targets, index);

  return {
    ...pulse,
    type: pulse.chord ? "chord" : "single",
    allSync: false,
    rescueAllowed: linkIndex !== null,
    linkIndex,
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
    return {
      ...base,
      rescuedCount: rescued,
      linkRescueCount: 0,
      rescueAdjusted: false,
    };
  }

  const links = Math.max(0, Math.min(rescued, Math.floor(Number(linkRescueCount) || 0)));
  const allSyncBonus = allSync ? 4 : 0;
  const adjustedDelta = Math.max(
    1,
    base.delta + allSyncBonus - rescued * RESCUE_GAIN_COST + links * LINK_RESCUE_BONUS,
  );

  return {
    ...base,
    stability: clampStability(stability + adjustedDelta),
    delta: adjustedDelta,
    rescuedCount: rescued,
    linkRescueCount: links,
    rescueAdjusted: rescued > 0,
  };
}
