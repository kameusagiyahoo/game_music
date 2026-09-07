import { expect, test } from "@playwright/test";

test("Sync Circuit adaptive difficulty moves between assist balanced and intense", async ({ page }) => {
  await page.goto("/games/sync-circuit/", { waitUntil: "domcontentloaded" });

  const result = await page.evaluate(async () => {
    const coop = await import("/games/sync-circuit/coop-mechanics.js");

    coop.resetAdaptiveDifficulty();
    const initial = coop.createCooperationPlan({
      players: 2,
      eventIndex: 1,
      randomValue: 0,
      overload: false,
    });

    let stability = 72;
    for (let i = 0; i < 3; i += 1) {
      const outcome = coop.resolveCooperativeOutcome({
        stability,
        targetCount: 1,
        directHitCount: 0,
        combo: 0,
      });
      stability = outcome.stability;
    }
    const assistSnapshot = coop.getAdaptiveDifficultySnapshot();
    const assistPlan = coop.createCooperationPlan({
      players: 2,
      eventIndex: 4,
      randomValue: 0,
      overload: false,
    });

    coop.resetAdaptiveDifficulty();
    stability = 82;
    for (let i = 0; i < 6; i += 1) {
      const outcome = coop.resolveCooperativeOutcome({
        stability,
        targetCount: 1,
        directHitCount: 1,
        combo: i,
      });
      stability = outcome.stability;
    }
    const intenseSnapshot = coop.getAdaptiveDifficultySnapshot();
    const intensePlan = coop.createCooperationPlan({
      players: 2,
      eventIndex: 7,
      randomValue: 0,
      overload: false,
    });

    return {
      initial,
      assistSnapshot,
      assistPlan,
      intenseSnapshot,
      intensePlan,
    };
  });

  expect(result.initial.difficulty).toBe("balanced");
  expect(result.initial.windowMs).toBe(480);

  expect(result.assistSnapshot.profile).toBe("assist");
  expect(result.assistSnapshot.sampleSize).toBe(3);
  expect(result.assistPlan.difficulty).toBe("assist");
  expect(result.assistPlan.baseWindowMs).toBe(520);
  expect(result.assistPlan.windowMs).toBe(614);

  expect(result.intenseSnapshot.profile).toBe("intense");
  expect(result.intenseSnapshot.sampleSize).toBe(6);
  expect(result.intensePlan.difficulty).toBe("intense");
  expect(result.intensePlan.baseWindowMs).toBe(480);
  expect(result.intensePlan.windowMs).toBe(403);
});

test("Sync Circuit event one resets adaptive history", async ({ page }) => {
  await page.goto("/games/sync-circuit/", { waitUntil: "domcontentloaded" });

  const result = await page.evaluate(async () => {
    const coop = await import("/games/sync-circuit/coop-mechanics.js");
    coop.resetAdaptiveDifficulty();

    let stability = 72;
    for (let i = 0; i < 4; i += 1) {
      const outcome = coop.resolveCooperativeOutcome({
        stability,
        targetCount: 1,
        directHitCount: 0,
        combo: 0,
      });
      stability = outcome.stability;
    }

    const before = coop.getAdaptiveDifficultySnapshot();
    const firstPlan = coop.createCooperationPlan({
      players: 3,
      eventIndex: 1,
      randomValue: 0.5,
      overload: false,
    });
    const after = coop.getAdaptiveDifficultySnapshot();
    return { before, firstPlan, after };
  });

  expect(result.before.profile).toBe("assist");
  expect(result.before.sampleSize).toBe(4);
  expect(result.firstPlan.difficulty).toBe("balanced");
  expect(result.after.profile).toBe("balanced");
  expect(result.after.sampleSize).toBe(0);
});
