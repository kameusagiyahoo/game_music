import { expect, test } from "@playwright/test";

const games = [
  { name: "Mystic Match", path: "/", title: "Mystic Match" },
  { name: "Orbit Rush", path: "/games/orbit-rush/", title: "Orbit Rush" },
  { name: "Pulse Forge", path: "/games/pulse-forge/", title: "Pulse Forge" },
  { name: "Rune Relay", path: "/games/rune-relay/", title: "Rune Relay" },
  { name: "Aether Shift", path: "/games/aether-shift/", title: "Aether Shift" },
  { name: "Beat Claim", path: "/games/beat-claim/", title: "Beat Claim" },
];

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

for (const game of games) {
  test(`${game.name} loads on WebKit/iPhone without runtime errors`, async ({ page }) => {
    const errors = watchRuntimeErrors(page);

    await page.goto(game.path, { waitUntil: "networkidle" });

    await expect(page).toHaveTitle(game.title);
    await expect(page.locator("#startButton")).toBeVisible();
    await expect(page.locator("#soundButton")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#bgmToggle")).toBeVisible();
    await expect(page.locator("#sfxToggle")).toBeVisible();
    await expect(page.locator("#bgmVolume")).toBeVisible();
    await expect(page.locator("#sfxVolume")).toBeVisible();

    await page.locator("#bgmVolume").fill("0");
    await expect(page.locator("#bgmVolumeValue")).toHaveText("0");

    expect(errors, errors.join("\n")).toEqual([]);
  });
}

test("MusicFacade resolves every game to the production WAV-stem engine in WebKit", async ({ page }) => {
  const errors = watchRuntimeErrors(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const descriptors = await page.evaluate(async () => {
    const { createMusicFacade } = await import("/src/music-facade.js");
    const { GAME_IDS } = await import("/src/music-registry.js");

    return Object.values(GAME_IDS).map((gameId) => {
      const music = createMusicFacade({ gameId });
      const info = music.info();
      music.stop();
      return {
        gameId,
        engine: info.engine,
        packId: info.id,
      };
    });
  });

  expect(descriptors).toHaveLength(6);
  for (const descriptor of descriptors) {
    expect(descriptor.engine).toBe("wav-stem");
    expect(descriptor.packId).toBeTruthy();
  }
  expect(errors, errors.join("\n")).toEqual([]);
});

test("Mystic Match can start and reach its Result state", async ({ page }) => {
  const errors = watchRuntimeErrors(page);
  await page.clock.install();
  await page.goto("/", { waitUntil: "networkidle" });

  await page.locator("#startButton").click();
  await expect(page.locator("#startButton")).toHaveText("プレイ中", { timeout: 30_000 });
  await expect(page.locator("#musicState")).not.toContainText("READY", { timeout: 12_000 });

  await page.clock.fastForward(46_000);
  await expect(page.locator("#resultOverlay")).toBeVisible();
  await expect(page.locator("#resultTitle")).toHaveText("TIME UP");

  expect(errors, errors.join("\n")).toEqual([]);
});

test("Rune Relay and Aether Shift can change game-local packs before play", async ({ page }) => {
  const errors = watchRuntimeErrors(page);

  await page.goto("/games/rune-relay/", { waitUntil: "networkidle" });
  const runeButtons = page.locator("#packButtons [data-pack]");
  await expect(runeButtons).toHaveCount(4);
  const runeInitial = await page.locator("#currentPack").textContent();
  const runeActiveId = await page.locator("#packButtons .pack-button.is-active").getAttribute("data-pack");
  const runeTarget = page.locator("#packButtons .pack-button:not(.is-active)").first();
  const runeTargetId = await runeTarget.getAttribute("data-pack");
  expect(runeActiveId).toBeTruthy();
  expect(runeTargetId).toBeTruthy();
  expect(runeTargetId).not.toBe(runeActiveId);
  await runeTarget.click();
  await expect(page.locator("#packButtons .pack-button.is-active")).toHaveAttribute("data-pack", runeTargetId);
  await expect(page.locator("#currentPack")).not.toHaveText(runeInitial || "");

  await page.goto("/games/aether-shift/", { waitUntil: "networkidle" });
  await expect(page.locator("#engineState")).toHaveText("WAV-STEM");
  const aetherButtons = page.locator("#packButtons [data-pack]");
  await expect(aetherButtons).toHaveCount(4);
  const aetherInitial = await page.locator("#currentPack").textContent();
  const aetherActiveId = await page.locator("#packButtons .pack-button.is-active").getAttribute("data-pack");
  const aetherTarget = page.locator("#packButtons .pack-button:not(.is-active)").first();
  const aetherTargetId = await aetherTarget.getAttribute("data-pack");
  expect(aetherActiveId).toBeTruthy();
  expect(aetherTargetId).toBeTruthy();
  expect(aetherTargetId).not.toBe(aetherActiveId);
  await aetherTarget.click();
  await expect(page.locator("#packButtons .pack-button.is-active")).toHaveAttribute("data-pack", aetherTargetId);
  await expect(page.locator("#currentPack")).not.toHaveText(aetherInitial || "");
  await expect(page.locator("#engineState")).toHaveText("WAV-STEM");

  expect(errors, errors.join("\n")).toEqual([]);
});


test("Beat Claim exposes 2-4 player local multiplayer controls", async ({ page }) => {
  const errors = watchRuntimeErrors(page);
  await page.goto("/games/beat-claim/", { waitUntil: "networkidle" });

  await expect(page.locator("#playerCount")).toHaveValue("2");
  await expect(page.locator(".claim-pad:not([hidden])")).toHaveCount(2);

  await page.locator("#playerCount").selectOption("4");
  await expect(page.locator(".claim-pad:not([hidden])")).toHaveCount(4);
  await expect(page.locator("#playerCountValue")).toHaveText("4");

  expect(errors, errors.join("\n")).toEqual([]);
});
