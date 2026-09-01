import {
  GAME_IDS,
  MUSIC_ENGINES,
  getMusicPackEntry,
  getMusicSettings,
  resetMusicSettings,
  saveMusicSettings,
  listMusicPacks,
} from "../src/music-registry.js";
import { resolveMusicAsset } from "../src/music-asset-resolver.js";

const STORAGE_KEY = "game-music-global-settings-v1";
const store = new Map();

globalThis.localStorage = {
  getItem(key) { return store.has(key) ? store.get(key) : null; },
  setItem(key, value) { store.set(key, String(value)); },
  removeItem(key) { store.delete(key); },
};

const errors = [];

resetMusicSettings();

const wavPacks = listMusicPacks({ engine: MUSIC_ENGINES.WAV_STEM });
const wavIds = wavPacks.map((entry) => entry.id).sort();

if (JSON.stringify(wavIds) !== JSON.stringify(["fantasy", "neon", "pulse"])) {
  errors.push(`expected Fantasy/Neon/Pulse wav packs, got ${wavIds.join(",")}`);
}

for (const [id, version] of [["fantasy", "2.0.0"], ["neon", "2.0.0"]]) {
  const entry = getMusicPackEntry(id);
  if (entry?.engine !== MUSIC_ENGINES.WAV_STEM) {
    errors.push(`${id} engine should be wav-stem, got ${entry?.engine}`);
  }
  if (entry?.version !== version) {
    errors.push(`${id} version should be ${version}, got ${entry?.version}`);
  }
  if (entry?.stems?.length !== 5 || entry?.stingers?.length !== 2 || entry?.transitionCues?.length !== 4) {
    errors.push(`${id} manifest asset counts mismatch`);
  }
  if (JSON.stringify(entry?.formats) !== JSON.stringify(["m4a", "ogg", "wav"])) {
    errors.push(`${id} formats mismatch: ${entry?.formats?.join(",")}`);
  }
}

const autoCases = [
  [GAME_IDS.MYSTIC_MATCH, "fantasy"],
  [GAME_IDS.ORBIT_RUSH, "neon"],
  [GAME_IDS.PULSE_FORGE, "pulse"],
  [GAME_IDS.RUNE_RELAY, "fantasy"],
];

for (const [gameId, expected] of autoCases) {
  resetMusicSettings();
  const entry = resolveMusicAsset({ gameId });
  if (entry.id !== expected || entry.engine !== MUSIC_ENGINES.WAV_STEM) {
    errors.push(`${gameId} AUTO should resolve ${expected} WAV, got ${entry.id}/${entry.engine}`);
  }
}

// Explicit v28 WAV selection remains an override.
resetMusicSettings();
saveMusicSettings({ wavStemPackId: "pulse" });
const settingsAfterPulse = getMusicSettings();
if (settingsAfterPulse.wavStemPackId !== "pulse" || settingsAfterPulse.wavStemSelectionVersion !== 3) {
  errors.push("explicit Pulse WAV selection was not persisted as v3");
}
const orbitPulseOverride = resolveMusicAsset({ gameId: GAME_IDS.ORBIT_RUSH });
if (orbitPulseOverride.id !== "pulse") {
  errors.push(`explicit Pulse override should apply to Orbit, got ${orbitPulseOverride.id}`);
}

// v26 and earlier: Pulse was the only WAV option and behaved like a default.
// Migrate the legacy value to AUTO.
store.set(STORAGE_KEY, JSON.stringify({
  proceduralPackId: "auto",
  wavStemPackId: "pulse",
  bgmEnabled: true,
  sfxEnabled: true,
  bgmVolume: 0.8,
  sfxVolume: 0.74,
}));
const pulseLegacy = getMusicSettings();
if (pulseLegacy.wavStemPackId !== "auto" || pulseLegacy.wavStemSelectionVersion !== 3) {
  errors.push(`legacy Pulse-only setting did not migrate to AUTO: ${JSON.stringify(pulseLegacy)}`);
}

// v27: Neon was a procedural option. Preserve an explicit Neon choice by
// moving it to WAV when the WAV side was still AUTO.
store.set(STORAGE_KEY, JSON.stringify({
  proceduralPackId: "neon",
  wavStemPackId: "auto",
  wavStemSelectionVersion: 2,
  bgmEnabled: true,
  sfxEnabled: true,
  bgmVolume: 0.8,
  sfxVolume: 0.74,
}));
const neonLegacy = getMusicSettings();
if (
  neonLegacy.proceduralPackId !== "auto" ||
  neonLegacy.wavStemPackId !== "neon" ||
  neonLegacy.wavStemSelectionVersion !== 3
) {
  errors.push(`legacy Neon procedural selection did not migrate to Neon WAV: ${JSON.stringify(neonLegacy)}`);
}
const orbitMigrated = resolveMusicAsset({ gameId: GAME_IDS.ORBIT_RUSH });
if (orbitMigrated.id !== "neon") {
  errors.push(`migrated Orbit should resolve Neon WAV, got ${orbitMigrated.id}`);
}

// Do not overwrite a v27 explicit WAV choice when migrating Neon procedural.
store.set(STORAGE_KEY, JSON.stringify({
  proceduralPackId: "neon",
  wavStemPackId: "fantasy",
  wavStemSelectionVersion: 2,
  bgmEnabled: true,
  sfxEnabled: true,
  bgmVolume: 0.8,
  sfxVolume: 0.74,
}));
const explicitFantasy = getMusicSettings();
if (
  explicitFantasy.proceduralPackId !== "auto" ||
  explicitFantasy.wavStemPackId !== "fantasy" ||
  explicitFantasy.wavStemSelectionVersion !== 3
) {
  errors.push(`explicit Fantasy WAV selection was overwritten during Neon migration: ${JSON.stringify(explicitFantasy)}`);
}

// v27 explicit Pulse must also remain explicit when upgrading selection schema.
store.set(STORAGE_KEY, JSON.stringify({
  proceduralPackId: "auto",
  wavStemPackId: "pulse",
  wavStemSelectionVersion: 2,
  bgmEnabled: true,
  sfxEnabled: true,
  bgmVolume: 0.8,
  sfxVolume: 0.74,
}));
const explicitPulseV27 = getMusicSettings();
if (explicitPulseV27.wavStemPackId !== "pulse" || explicitPulseV27.wavStemSelectionVersion !== 3) {
  errors.push(`v27 explicit Pulse WAV was not preserved: ${JSON.stringify(explicitPulseV27)}`);
}

if (errors.length) {
  console.error("Multi WAV Pack Registry Check FAILED");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log("Multi WAV Pack Registry Check PASSED");
console.log("- wav-stem packs: Fantasy + Neon + Pulse");
console.log("- Mystic AUTO -> Fantasy WAV");
console.log("- Orbit AUTO -> Neon WAV");
console.log("- Pulse Forge AUTO -> Pulse WAV");
console.log("- Rune Relay AUTO -> Fantasy WAV");
console.log("- legacy Pulse-only setting -> AUTO migration");
console.log("- legacy Neon procedural -> Neon WAV migration");
console.log("- explicit v27 WAV choices -> preserved");
