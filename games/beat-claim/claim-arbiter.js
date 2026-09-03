export const CLAIM_ARBITRATION_MS = 36;
export const PHOTO_FINISH_MS = 8;

function normalizeTimestamp(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export function resolveClaimBatch(
  claims,
  { photoFinishMs = PHOTO_FINISH_MS } = {},
) {
  const earliestByPlayer = new Map();

  for (const claim of claims || []) {
    const index = Number(claim?.index);
    if (!Number.isInteger(index) || index < 0) continue;

    const at = normalizeTimestamp(claim?.at);
    if (at === null) continue;

    const current = earliestByPlayer.get(index);
    if (!current || at < current.at) {
      earliestByPlayer.set(index, { index, at });
    }
  }

  const orderedClaims = [...earliestByPlayer.values()]
    .sort((a, b) => a.at - b.at || a.index - b.index);

  if (orderedClaims.length === 0) {
    return {
      claims: [],
      winnerClaims: [],
      winnerIndexes: [],
      earliestAt: null,
      spreadMs: 0,
      photoFinish: false,
    };
  }

  const earliestAt = orderedClaims[0].at;
  const winnerClaims = orderedClaims.filter(
    (claim) => claim.at - earliestAt <= Math.max(0, photoFinishMs),
  );
  const spreadMs = winnerClaims.at(-1).at - earliestAt;

  return {
    claims: orderedClaims,
    winnerClaims,
    winnerIndexes: winnerClaims.map((claim) => claim.index),
    earliestAt,
    spreadMs,
    photoFinish: winnerClaims.length > 1,
  };
}
