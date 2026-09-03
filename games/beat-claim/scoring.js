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

export function calculateSuccessAward({
  scores,
  streaks,
  index,
  players,
  basePoints,
}) {
  const comebackBonus = getComebackBonus(scores, index, players);
  const nextStreaks = streaks.map((streak, playerIndex) =>
    playerIndex === index ? streak + 1 : 0
  );
  const streakBonus = getStreakBonus(nextStreaks[index]);
  const total = basePoints + comebackBonus + streakBonus;
  const nextScores = scores.map((score, playerIndex) =>
    playerIndex === index ? score + total : score
  );

  return {
    total,
    comebackBonus,
    streakBonus,
    nextScores,
    nextStreaks,
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
