export const MODIFIER_STAT_IDS = Object.freeze([
  "normal",
  "double",
  "no-gamble",
  "decoy-rush",
  "sudden-death",
]);

function createModifierPoints() {
  return Object.fromEntries(MODIFIER_STAT_IDS.map((id) => [id, 0]));
}

export function createMatchStats(playerSlots = 4) {
  return Array.from({ length: playerSlots }, () => ({
    blindHits: 0,
    photoFinishes: 0,
    maxStreak: 0,
    successfulClaims: 0,
    modifierPoints: createModifierPoints(),
  }));
}

export function recordSuccessfulAwards(
  stats,
  {
    awards,
    modifierId = "normal",
    blind = false,
    photoFinish = false,
    streaks = [],
  },
) {
  const next = stats.map((entry) => ({
    ...entry,
    modifierPoints: { ...entry.modifierPoints },
  }));

  for (const award of awards || []) {
    const index = Number(award?.index);
    if (!Number.isInteger(index) || index < 0 || index >= next.length) continue;

    const entry = next[index];
    entry.successfulClaims += 1;
    if (blind) entry.blindHits += 1;
    if (photoFinish) entry.photoFinishes += 1;
    entry.maxStreak = Math.max(entry.maxStreak, Number(streaks[index]) || 0);

    if (!(modifierId in entry.modifierPoints)) {
      entry.modifierPoints[modifierId] = 0;
    }
    entry.modifierPoints[modifierId] += Math.max(0, Number(award.total) || 0);
  }

  return next;
}

export function getPlayerMatchSummary(stats, index, score = 0) {
  const entry = stats[index] || createMatchStats(1)[0];
  return {
    player: index + 1,
    score: Math.max(0, Number(score) || 0),
    blindHits: entry.blindHits,
    photoFinishes: entry.photoFinishes,
    maxStreak: entry.maxStreak,
    successfulClaims: entry.successfulClaims,
    modifierPoints: { ...entry.modifierPoints },
  };
}
