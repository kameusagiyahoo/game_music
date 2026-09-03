const STREAK_BONUSES = Object.freeze([0, 0, 4, 8, 12]);

export function getLeaderScore(scores, players) {
  return Math.max(...scores.slice(0, players));
}

export function getScoreGap(scores, index, players) {
  return Math.max(0, getLeaderScore(scores, players) - scores[index]);
}

export function getComebackBonus(scores, index, players) {
  const gap = getScoreGap(scores, index, players);
  if (gap >= 30) return 10;
  if (gap >= 15) return 5;
  return 0;
}

export function getStreakBonus(streak) {
  return STREAK_BONUSES[Math.min(streak, STREAK_BONUSES.length - 1)] || 0;
}

export function calculateSharedSuccessAwards({
  scores,
  streaks,
  winners,
  players,
}) {
  const normalizedWinners = [...new Map(
    (winners || [])
      .filter((winner) => Number.isInteger(winner?.index) && winner.index >= 0 && winner.index < players)
      .map((winner) => [winner.index, {
        index: winner.index,
        basePoints: Math.max(0, Number(winner.basePoints) || 0),
      }]),
  ).values()];

  const winnerIndexes = new Set(normalizedWinners.map((winner) => winner.index));
  const nextStreaks = streaks.map((streak, index) =>
    winnerIndexes.has(index) ? streak + 1 : 0
  );
  const nextScores = [...scores];

  const awards = normalizedWinners.map((winner) => {
    const comebackBonus = getComebackBonus(scores, winner.index, players);
    const streakBonus = getStreakBonus(nextStreaks[winner.index]);
    const total = winner.basePoints + comebackBonus + streakBonus;
    nextScores[winner.index] += total;
    return {
      index: winner.index,
      basePoints: winner.basePoints,
      total,
      comebackBonus,
      streakBonus,
    };
  });

  return {
    awards,
    nextScores,
    nextStreaks,
  };
}

export function calculateSuccessAward({
  scores,
  streaks,
  index,
  players,
  basePoints,
}) {
  const result = calculateSharedSuccessAwards({
    scores,
    streaks,
    players,
    winners: [{ index, basePoints }],
  });
  const award = result.awards[0] || {
    index,
    basePoints: 0,
    total: 0,
    comebackBonus: 0,
    streakBonus: 0,
  };

  return {
    ...award,
    nextScores: result.nextScores,
    nextStreaks: result.nextStreaks,
  };
}

export function calculatePenalty({
  scores,
  streaks,
  index,
  amount,
}) {
  const nextScores = scores.map((score, playerIndex) =>
    playerIndex === index ? Math.max(0, score - amount) : score
  );
  const nextStreaks = streaks.map((streak, playerIndex) =>
    playerIndex === index ? 0 : streak
  );

  return {
    nextScores,
    nextStreaks,
  };
}
