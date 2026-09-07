import { expect, test } from "@playwright/test";

test("Sync Circuit adaptive difficulty UI shows profile changes", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/games/sync-circuit/", { waitUntil: "networkidle" });

  await expect(page.locator("#difficultyValue")).toHaveText("BALANCED");
  await expect(page.locator("#difficultyWindow")).toHaveText("WINDOW ×1.00");
  await expect(page.locator("body")).toHaveAttribute("data-adaptive-difficulty", "balanced");

  await page.evaluate(async () => {
    const coop = await import("/games/sync-circuit/coop-mechanics.js");
    coop.resetAdaptiveDifficulty();
    for (let i = 0; i < 3; i += 1) {
      coop.resolveCooperativeOutcome({
        stability: 36,
        targetCount: 1,
        directHitCount: 0,
        rescuedCount: 0,
        linkRescueCount: 0,
        chord: false,
        allSync: false,
        combo: 0,
      });
    }
  });

  await expect(page.locator("#difficultyValue")).toHaveText("ASSIST");
  await expect(page.locator("#difficultyWindow")).toHaveText("WINDOW ×1.18");
  await expect(page.locator("body")).toHaveAttribute("data-adaptive-difficulty", "assist");
  await expect(page.locator("#difficultyFlashValue")).toHaveText("ASSIST");
  await expect(page.locator("#difficultyFlash")).toBeVisible();

  await page.evaluate(async () => {
    const coop = await import("/games/sync-circuit/coop-mechanics.js");
    coop.resetAdaptiveDifficulty();
    for (let i = 0; i < 6; i += 1) {
      coop.resolveCooperativeOutcome({
        stability: 92,
        targetCount: 1,
        directHitCount: 1,
        rescuedCount: 0,
        linkRescueCount: 0,
        chord: false,
        allSync: false,
        combo: i,
      });
    }
  });

  await expect(page.locator("#difficultyValue")).toHaveText("INTENSE");
  await expect(page.locator("#difficultyWindow")).toHaveText("WINDOW ×0.84");
  await expect(page.locator("body")).toHaveAttribute("data-adaptive-difficulty", "intense");
  await expect(page.locator("#difficultyFlashValue")).toHaveText("INTENSE");

  expect(errors, errors.join("\n")).toEqual([]);
});
