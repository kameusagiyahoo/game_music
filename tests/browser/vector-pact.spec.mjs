import { expect, test } from "@playwright/test";

test("Vector Pact exposes 2-4 players and resolves MATCH/SPLIT deterministically", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });

  await page.goto("/games/vector-pact/", { waitUntil: "networkidle" });
  await expect(page).toHaveTitle("Vector Pact");
  await expect(page.locator("#playerCount")).toHaveValue("2");

  await page.locator("#playerCount").selectOption("4");
  await expect(page.locator("#playerCountValue")).toHaveText("4");

  const result = await page.evaluate(async () => {
    const engine = await import("/games/vector-pact/vector-engine.js");
    const match = engine.resolveVectorRound({
      choices: ["left", "left", "right", "center"],
      rule: engine.getVectorRoundRule(1),
    });
    const split = engine.resolveVectorRound({
      choices: ["left", "left", "right", "center"],
      rule: engine.getVectorRoundRule(2),
    });
    return { match, split };
  });

  expect(result.match.awards).toEqual([2, 2, 0, 0]);
  expect(result.match.winners).toEqual([0, 1]);
  expect(result.split.awards).toEqual([0, 0, 3, 3]);
  expect(result.split.winners).toEqual([2, 3]);
  expect(errors).toEqual([]);
});

test("Vector Pact locks choices until every player has selected, then reveals", async ({ page }) => {
  await page.goto("/games/vector-pact/", { waitUntil: "networkidle" });
  await page.locator("#startButton").click();
  await expect(page.locator("#stateValue")).toHaveText("CHOOSE", { timeout: 30000 });

  const cards = page.locator(".vector-player");
  await cards.nth(0).locator("button").nth(0).click();
  await expect(cards.nth(0)).toHaveClass(/is-locked/);
  await expect(cards.nth(0).locator(".vector-player-head span")).toHaveText("LOCKED");

  await cards.nth(1).locator("button").nth(0).click();
  await expect(page.locator("#stateValue")).toHaveText("REVEAL");
  await expect(cards.nth(0).locator(".vector-player-head span")).toHaveText("LEFT");
  await expect(cards.nth(1).locator(".vector-player-head span")).toHaveText("LEFT");
});
