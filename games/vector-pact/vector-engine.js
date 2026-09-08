export const VECTOR_DIRECTIONS = Object.freeze(["left", "center", "right"]);

export const VECTOR_RULES = Object.freeze({
  MATCH: "match",
  SPLIT: "split",
});

export function getVectorRoundRule(roundNumber) {
  const round = Math.max(1, Math.floor(Number(roundNumber) || 1));
  const id = round % 2 === 1 ? VECTOR_RULES.MATCH : VECTOR_RULES.SPLIT;

  if (id === VECTOR_RULES.MATCH) {
    return Object.freeze({
      id,
      label: "MATCH",
      description: "誰かと同じ方向なら +2",
      musicState: "build",
      transitionCue: "fill",
    });
  }

  return Object.freeze({
    id,
    label: "SPLIT",
    description: "自分だけの方向なら +3",
    musicState: "tension",
    transitionCue: "whoosh",
  });
}

function normalizeChoice(choice) {
  const value = String(choice || "").toLowerCase();
  return VECTOR_DIRECTIONS.includes(value) ? value : null;
}

export function resolveVectorRound({ choices = [], rule } = {}) {
  const normalizedChoices = choices.map(normalizeChoice);
  if (!normalizedChoices.length || normalizedChoices.some((choice) => !choice)) {
    throw new Error("Vector Pact requires one valid direction per player");
  }

  const ruleId = typeof rule === "string" ? rule : rule?.id;
  if (![VECTOR_RULES.MATCH, VECTOR_RULES.SPLIT].includes(ruleId)) {
    throw new Error(`Unknown Vector Pact rule: ${ruleId}`);
  }

  const counts = Object.fromEntries(VECTOR_DIRECTIONS.map((direction) => [direction, 0]));
  normalizedChoices.forEach((choice) => { counts[choice] += 1; });

  const awards = normalizedChoices.map((choice) => {
    if (ruleId === VECTOR_RULES.MATCH) return counts[choice] >= 2 ? 2 : 0;
    return counts[choice] === 1 ? 3 : 0;
  });

  const maxAward = Math.max(...awards);
  const winners = maxAward > 0
    ? awards.map((points, index) => points === maxAward ? index : -1).filter((index) => index >= 0)
    : [];

  return Object.freeze({
    rule: ruleId,
    choices: Object.freeze([...normalizedChoices]),
    counts: Object.freeze({ ...counts }),
    awards: Object.freeze(awards),
    winners: Object.freeze(winners),
    maxAward,
  });
}
