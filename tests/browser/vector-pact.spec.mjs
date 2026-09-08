import { expect, test } from "@playwright/test";

test("Vector Pact exposes 2-4 players and resolves MATCH/SPLIT deterministically", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });

  await page.goto("/games/vector-pact/", { waitUntil: "networkidle" });
  await expect(page).toHaveTitle("Vector Pact");
  await expect(page.locator("#playerCount")).toHaveValue("2");
  await expect(page.locator(".vector-player:not([hidden])")).toHaveCount(2);

  await page.locator("#playerCount").selectOption("4");
  await expect(page.locator("#playerCountValue")).toHaveText("4");
  await expect(page.locator(".vector-player:not([hidden])")).toHaveCount(4);

  const result = await page.evaluate(async () => {
    const engine = await import("/games/vector-pact/vector-engine.js");
    const choices = ["left", "left", "right", "center"];
    return {
      match: engine.resolveVectorRound({ choices, rule: engine.getVectorRoundRule(1) }),
      split: engine.resolveVectorRound({ choices, rule: engine.getVectorRoundRule(2) }),
    };
  });

  expect(result.match.awards).toEqual([2, 2, 0, 0]);
  expect(result.match.winners).toEqual([0, 1]);
  expect(result.split.awards).toEqual([0, 0, 3, 3]);
  expect(result.split.winners).toEqual([2, 3]);
  expect(errors).toEqual([]);
});

test("Vector Pact keeps choices hidden until all players lock, then reveals them", async ({ page }) => {
  await page.goto("/games/vector-pact/", { waitUntil: "networkidle" });
  await page.locator("#startButton").click();
  await expect(page.locator("#ruleValue")).toHaveText("MATCH", { timeout: 30_000 });

  const cards = page.locator(".vector-player:not([hidden])");
  await cards.nth(0).locator('[data-choice="left"]').click();
  await expect(cards.nth(0)).toHaveClass(/is-locked/);
  await expect(cards.nth(0).locator("small")).toHaveText("LOCKED");
  await expect(page.locator("#lockedValue")).toHaveText("1 / 2");

  await cards.nth(1).locator('[data-choice="left"]').click();
  await expect(cards.nth(0)).toHaveClass(/is-revealed/);
  await expect(cards.nth(0).locator("small")).toContainText("LEFT · +2");
  await expect(cards.nth(1).locator("small")).toContainText("LEFT · +2");
  await expect(page.locator("#scoreP1")).toHaveText("2");
  await expect(page.locator("#scoreP2")).toHaveText("2");
});
