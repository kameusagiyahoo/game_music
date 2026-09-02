import { expect, test } from "@playwright/test";

const games = [
  { name: "Mystic Match", path: "/", title: "Mystic Match" },
  { name: "Orbit Rush", path: "/games/orbit-rush/", title: "Orbit Rush" },
  { name: "Pulse Forge", path: "/games/pulse-forge/", title: "Pulse Forge" },
  { name: "Rune Relay", path: "/games/rune-relay/", title: "Rune Relay" },
  { name: "Aether Shift", path: "/games/aether-shift/", title: "Aether Shift" },
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

  expect(descriptors).toHaveLength(5);
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
  const runeTarget = runeButtons.filter({ hasNotText: runeInitial || "__none__" }).first();
  if (await runeTarget.count()) {
    await runeTarget.click();
  } else {
    await runeButtons.nth(1).click();
  }
  await expect(page.locator("#currentPack")).not.toHaveText(runeInitial || "");

  await page.goto("/games/aether-shift/", { waitUntil: "networkidle" });
  await expect(page.locator("#engineState")).toHaveText("WAV-STEM");
  const aetherButtons = page.locator("#packButtons [data-pack]");
  await expect(aetherButtons).toHaveCount(4);
  const aetherInitial = await page.locator("#currentPack").textContent();
  const aetherTarget = aetherButtons.filter({ hasNotText: aetherInitial || "__none__" }).first();
  if (await aetherTarget.count()) {
    await aetherTarget.click();
  } else {
    await aetherButtons.nth(1).click();
  }
  await expect(page.locator("#currentPack")).not.toHaveText(aetherInitial || "");
  await expect(page.locator("#engineState")).toHaveText("WAV-STEM");

  expect(errors, errors.join("\n")).toEqual([]);
});
