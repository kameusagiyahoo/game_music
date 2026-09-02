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
if (JSON.stringify(wavIds) !== JSON.stringify(["clockwork", "fantasy", "neon", "pulse"])) {
  errors.push(`expected Clockwork/Fantasy/Neon/Pulse wav packs, got ${wavIds.join(",")}`);
}
for (const [id, version] of [
  ["fantasy", "2.0.0"],
  ["neon", "2.0.0"],
  ["clockwork", "2.0.0"],
]) {
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
  [GAME_IDS.AETHER_SHIFT, "clockwork"],
];

for (const [gameId, expected] of autoCases) {
  resetMusicSettings();
  const entry = resolveMusicAsset({ gameId });
  if (entry.id !== expected || entry.engine !== MUSIC_ENGINES.WAV_STEM) {
    errors.push(`${gameId} AUTO should resolve ${expected} WAV, got ${entry.id}/${entry.engine}`);
  }
}

// Explicit v29 WAV selection remains an override.
resetMusicSettings();
saveMusicSettings({ wavStemPackId: "clockwork" });
const explicitClockwork = getMusicSettings();
if (explicitClockwork.wavStemPackId !== "clockwork" || explicitClockwork.wavStemSelectionVersion !== 4) {
  errors.push("explicit Clockwork WAV selection was not persisted as v4");
}
const orbitClockworkOverride = resolveMusicAsset({ gameId: GAME_IDS.ORBIT_RUSH });
if (orbitClockworkOverride.id !== "clockwork") {
  errors.push(`explicit Clockwork override should apply to Orbit, got ${orbitClockworkOverride.id}`);
}

// v26 and earlier: Pulse was the only WAV option and behaved like a default.
store.set(STORAGE_KEY, JSON.stringify({
  proceduralPackId: "auto",
  wavStemPackId: "pulse",
  bgmEnabled: true,
  sfxEnabled: true,
  bgmVolume: 0.8,
  sfxVolume: 0.74,
}));
const pulseLegacy = getMusicSettings();
if (pulseLegacy.wavStemPackId !== "auto" || pulseLegacy.wavStemSelectionVersion !== 4) {
  errors.push(`legacy Pulse-only setting did not migrate to AUTO: ${JSON.stringify(pulseLegacy)}`);
}

// v27: Neon was procedural. Preserve an explicit Neon choice when WAV was AUTO.
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
  neonLegacy.wavStemPackId !== "neon" ||
  neonLegacy.wavStemSelectionVersion !== 4
) {
  errors.push(`legacy Neon procedural selection did not migrate to Neon WAV: ${JSON.stringify(neonLegacy)}`);
}

// v28: Clockwork was the final procedural pack. Preserve it when WAV was AUTO.
store.set(STORAGE_KEY, JSON.stringify({
  proceduralPackId: "clockwork",
  wavStemPackId: "auto",
  wavStemSelectionVersion: 3,
  bgmEnabled: true,
  sfxEnabled: true,
  bgmVolume: 0.8,
  sfxVolume: 0.74,
}));
const clockworkLegacy = getMusicSettings();
if (
  clockworkLegacy.wavStemPackId !== "clockwork" ||
  clockworkLegacy.wavStemSelectionVersion !== 4
) {
  errors.push(`legacy Clockwork procedural selection did not migrate to Clockwork WAV: ${JSON.stringify(clockworkLegacy)}`);
}
const aetherMigrated = resolveMusicAsset({ gameId: GAME_IDS.AETHER_SHIFT });
if (aetherMigrated.id !== "clockwork") {
  errors.push(`migrated Aether should resolve Clockwork WAV, got ${aetherMigrated.id}`);
}

// Existing explicit WAV selections must win over procedural migrations.
for (const explicitId of ["fantasy", "neon", "pulse"]) {
  store.set(STORAGE_KEY, JSON.stringify({
    proceduralPackId: "clockwork",
    wavStemPackId: explicitId,
    wavStemSelectionVersion: 3,
    bgmEnabled: true,
    sfxEnabled: true,
    bgmVolume: 0.8,
    sfxVolume: 0.74,
  }));
  const preserved = getMusicSettings();
  if (preserved.wavStemPackId !== explicitId || preserved.wavStemSelectionVersion !== 4) {
    errors.push(`explicit ${explicitId} WAV selection was overwritten by Clockwork migration: ${JSON.stringify(preserved)}`);
  }
}

if (errors.length) {
  console.error("All Real-Audio Registry Check FAILED");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log("All Real-Audio Registry Check PASSED");
console.log("- wav-stem packs: Fantasy + Neon + Pulse + Clockwork");
console.log("- runtime registry exposes WAV-stem packs only");
console.log("- game AUTO defaults resolve to real-audio packs");
console.log("- legacy Pulse-only -> AUTO migration");
console.log("- legacy Neon procedural -> Neon WAV migration");
console.log("- legacy Clockwork procedural -> Clockwork WAV migration");
console.log("- explicit WAV choices -> preserved");
