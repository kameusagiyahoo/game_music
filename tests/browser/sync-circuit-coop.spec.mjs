import { expect, test } from "@playwright/test";

function watchRuntimeErrors(page) {
  const errors = [];

  page.on("pageerror", (error) => {
    errors.push(`pageerror: ${error.message}`);
  });

  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(`console.error: ${message.text()}`);
    }
  });

  return errors;
}

test("Sync Circuit cooperation plan rotates LINK and schedules ALL SYNC", async ({ page }) => {
  const errors = watchRuntimeErrors(page);
  await page.goto("/games/sync-circuit/", { waitUntil: "domcontentloaded" });

  const result = await page.evaluate(async () => {
    const coop = await import("/games/sync-circuit/coop-mechanics.js");

    return {
      event1: coop.createCooperationPlan({
        players: 3,
        eventIndex: 1,
        randomValue: 0.5,
        overload: false,
      }),
      event5: coop.createCooperationPlan({
        players: 3,
        eventIndex: 5,
        randomValue: 0.5,
        overload: false,
      }),
      event6: coop.createCooperationPlan({
        players: 3,
        eventIndex: 6,
        randomValue: 0.5,
        overload: false,
      }),
      overloadAll: coop.createCooperationPlan({
        players: 4,
        eventIndex: 12,
        randomValue: 0.1,
        overload: true,
      }),
    };
  });

  expect(result.event1.type).toBe("single");
  expect(result.event1.targets).toEqual([1]);
  expect(result.event1.linkIndex).toBe(0);
  expect(result.event1.rescueAllowed).toBe(true);

  expect(result.event5.targets).toEqual([1]);
  expect(result.event5.linkIndex).toBe(2);

  expect(result.event6.type).toBe("all-sync");
  expect(result.event6.targets).toEqual([0, 1, 2]);
  expect(result.event6.windowMs).toBe(650);
  expect(result.event6.rescueAllowed).toBe(false);
  expect(result.event6.linkIndex).toBeNull();

  expect(result.overloadAll.targets).toEqual([0, 1, 2, 3]);
  expect(result.overloadAll.windowMs).toBe(480);

  expect(errors, errors.join("\n")).toEqual([]);
});

test("Sync Circuit rescue math rewards LINK and protects unresolved misses", async ({ page }) => {
  const errors = watchRuntimeErrors(page);
  await page.goto("/games/sync-circuit/", { waitUntil: "domcontentloaded" });

  const result = await page.evaluate(async () => {
    const coop = await import("/games/sync-circuit/coop-mechanics.js");

    const linkRescue = coop.resolveCooperativeOutcome({
      stability: 72,
      targetCount: 1,
      directHitCount: 0,
      rescuedCount: 1,
      linkRescueCount: 1,
      combo: 0,
    });

    const normalRescue = coop.resolveCooperativeOutcome({
      stability: 72,
      targetCount: 1,
      directHitCount: 0,
      rescuedCount: 1,
      linkRescueCount: 0,
      combo: 0,
    });

    const partialRescue = coop.resolveCooperativeOutcome({
      stability: 72,
      targetCount: 2,
      directHitCount: 0,
      rescuedCount: 1,
      linkRescueCount: 1,
      chord: true,
      combo: 4,
    });

    const allSync = coop.resolveCooperativeOutcome({
      stability: 72,
      targetCount: 3,
      directHitCount: 3,
      rescuedCount: 0,
      linkRescueCount: 0,
      chord: true,
      allSync: true,
      combo: 0,
    });

    return { linkRescue, normalRescue, partialRescue, allSync };
  });

  expect(result.linkRescue.complete).toBe(true);
  expect(result.linkRescue.delta).toBe(6);
  expect(result.linkRescue.stability).toBe(78);
  expect(result.linkRescue.nextCombo).toBe(1);

  expect(result.normalRescue.delta).toBe(3);
  expect(result.normalRescue.stability).toBe(75);

  expect(result.partialRescue.complete).toBe(false);
  expect(result.partialRescue.missing).toBe(1);
  expect(result.partialRescue.stability).toBe(60);
  expect(result.partialRescue.nextCombo).toBe(0);

  expect(result.allSync.complete).toBe(true);
  expect(result.allSync.delta).toBe(12);
  expect(result.allSync.stability).toBe(84);

  expect(errors, errors.join("\n")).toEqual([]);
});

test("Sync Circuit can recover a missed P1 pulse with P2 LINK RESCUE", async ({ page }) => {
  const errors = watchRuntimeErrors(page);
  await page.addInitScript(() => {
    Math.random = () => 0.1;
  });

  await page.goto("/games/sync-circuit/", { waitUntil: "networkidle" });
  await page.locator("#playerCount").selectOption("3");

  await page.evaluate(() => {
    const label = document.querySelector("#pulseLabel");
    const p2 = document.querySelector('.sync-pad[data-player="1"]');
    if (!label || !p2) throw new Error("Sync Circuit rescue controls missing");

    window.__syncCircuitRescued = new Promise((resolve) => {
      const rescue = () => {
        if (label.textContent !== "RESCUE") return;
        p2.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
        observer.disconnect();
        resolve(true);
      };
      const observer = new MutationObserver(rescue);
      observer.observe(label, { childList: true, subtree: true, characterData: true });
      rescue();
    });
  });

  await page.locator("#startButton").click();
  await expect(page.locator("#startButton")).toHaveText("プレイ中", { timeout: 30_000 });
  await page.evaluate(() => window.__syncCircuitRescued);

  await expect(page.locator("#stabilityValue")).toHaveText("78");
  await expect(page.locator("#syncValue")).toHaveText("1");
  await expect(page.locator("#comboValue")).toHaveText("×1");
  await expect(page.locator("#pulseLabel")).toHaveText("LINK RESCUE");

  expect(errors, errors.join("\n")).toEqual([]);
});
