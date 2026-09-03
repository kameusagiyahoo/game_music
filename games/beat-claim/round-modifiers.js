export const ROUND_MODIFIERS = Object.freeze({
  normal: Object.freeze({
    id: "normal",
    label: "NORMAL",
    description: "Standard rules",
    musicState: "normal",
    scoreMultiplier: 1,
    allowGamble: true,
    liveProbability: 0.72,
    liveWindowMs: 390,
    penaltyMultiplier: 1,
  }),
  double: Object.freeze({
    id: "double",
    label: "DOUBLE SCORE",
    description: "All successful base points are doubled",
    musicState: "build",
    scoreMultiplier: 2,
    allowGamble: true,
    liveProbability: 0.72,
    liveWindowMs: 390,
    penaltyMultiplier: 1,
  }),
  noGamble: Object.freeze({
    id: "no-gamble",
    label: "NO GAMBLE",
    description: "The signal is revealed immediately",
    musicState: "normal",
    scoreMultiplier: 1,
    allowGamble: false,
    liveProbability: 0.72,
    liveWindowMs: 390,
    penaltyMultiplier: 1,
  }),
  decoyRush: Object.freeze({
    id: "decoy-rush",
    label: "DECOY RUSH",
    description: "DECOY probability rises to 60%",
    musicState: "tension",
    scoreMultiplier: 1,
    allowGamble: true,
    liveProbability: 0.40,
    liveWindowMs: 390,
    penaltyMultiplier: 1,
  }),
  suddenDeath: Object.freeze({
    id: "sudden-death",
    label: "SUDDEN DEATH",
    description: "No gamble, guaranteed LIVE, 260ms, triple base score",
    musicState: "tension",
    scoreMultiplier: 3,
    allowGamble: false,
    liveProbability: 1,
    liveWindowMs: 260,
    penaltyMultiplier: 1,
  }),
});

const ROUND_SEQUENCE = Object.freeze([
  ROUND_MODIFIERS.normal,
  ROUND_MODIFIERS.double,
  ROUND_MODIFIERS.noGamble,
  ROUND_MODIFIERS.decoyRush,
  ROUND_MODIFIERS.normal,
  ROUND_MODIFIERS.suddenDeath,
]);

export function getRoundModifier(roundNumber) {
  const number = Math.max(1, Math.floor(Number(roundNumber) || 1));
  return ROUND_SEQUENCE[(number - 1) % ROUND_SEQUENCE.length];
}

export function applySuccessModifier(basePoints, modifier) {
  const multiplier = Math.max(1, Number(modifier?.scoreMultiplier) || 1);
  return Math.round(Math.max(0, Number(basePoints) || 0) * multiplier);
}

export function applyPenaltyModifier(amount, modifier) {
  const multiplier = Math.max(1, Number(modifier?.penaltyMultiplier) || 1);
  return Math.round(Math.max(0, Number(amount) || 0) * multiplier);
}

export function rollHiddenSignal(randomValue, modifier) {
  const probability = Math.min(
    1,
    Math.max(0, Number(modifier?.liveProbability) || 0),
  );
  const roll = Math.min(1, Math.max(0, Number(randomValue) || 0));
  return roll < probability ? "live" : "decoy";
}
