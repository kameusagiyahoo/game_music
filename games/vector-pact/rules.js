export const CHOICES = Object.freeze(["left", "center", "right"]);
export const ROUND_RULES = Object.freeze({
  match: Object.freeze({ id: "match", label: "MATCH", description: "多数派と同じ方向を選ぶ" }),
  split: Object.freeze({ id: "split", label: "SPLIT", description: "少数派または単独方向を選ぶ" }),
});

export function normalizeChoice(choice) {
  return CHOICES.includes(choice) ? choice : null;
}

export function resolveRound({ rule = "match", choices = [] } = {}) {
  const validChoices = choices.map(normalizeChoice);
  const counts = Object.fromEntries(CHOICES.map((choice) => [choice, 0]));
  validChoices.forEach((choice) => { if (choice) counts[choice] += 1; });

  const used = CHOICES.filter((choice) => counts[choice] > 0);
  if (!used.length) return { winners: [], counts, points: validChoices.map(() => 0), resolvedRule: rule };

  let winnerChoices = [];
  if (rule === "split") {
    const minimum = Math.min(...used.map((choice) => counts[choice]));
    winnerChoices = used.filter((choice) => counts[choice] === minimum);
  } else {
    const maximum = Math.max(...used.map((choice) => counts[choice]));
    winnerChoices = used.filter((choice) => counts[choice] === maximum);
  }

  const winners = [];
  const points = validChoices.map((choice, index) => {
    const won = choice && winnerChoices.includes(choice);
    if (won) winners.push(index);
    return won ? 1 : 0;
  });

  return { winners, counts, points, winnerChoices, resolvedRule: rule };
}

export function getRoundRule(roundNumber) {
  return Number(roundNumber) % 2 === 0 ? ROUND_RULES.split : ROUND_RULES.match;
}
