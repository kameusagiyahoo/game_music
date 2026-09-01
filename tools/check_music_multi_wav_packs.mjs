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

if (JSON.stringify(wavIds) !== JSON.stringify(["fantasy", "pulse"])) {
  errors.push(`expected Fantasy/Pulse wav packs, got ${wavIds.join(",")}`);
}

const fantasy = getMusicPackEntry("fantasy");
if (fantasy?.engine !== MUSIC_ENGINES.WAV_STEM) {
  errors.push(`Fantasy engine should be wav-stem, got ${fantasy?.engine}`);
}
if (fantasy?.version !== "2.0.0") {
  errors.push(`Fantasy version should be 2.0.0, got ${fantasy?.version}`);
}
if (fantasy?.stems?.length !== 5 || fantasy?.stingers?.length !== 2 || fantasy?.transitionCues?.length !== 4) {
  errors.push("Fantasy manifest asset counts mismatch");
}
if (JSON.stringify(fantasy?.formats) !== JSON.stringify(["m4a", "ogg", "wav"])) {
  errors.push(`Fantasy formats mismatch: ${fantasy?.formats?.join(",")}`);
}

const mysticAuto = resolveMusicAsset({ gameId: GAME_IDS.MYSTIC_MATCH });
if (mysticAuto.id !== "fantasy" || mysticAuto.engine !== MUSIC_ENGINES.WAV_STEM) {
  errors.push(`Mystic AUTO should resolve Fantasy WAV, got ${mysticAuto.id}/${mysticAuto.engine}`);
}

const pulseAuto = resolveMusicAsset({ gameId: GAME_IDS.PULSE_FORGE });
if (pulseAuto.id !== "pulse" || pulseAuto.engine !== MUSIC_ENGINES.WAV_STEM) {
  errors.push(`Pulse Forge AUTO should resolve Pulse WAV, got ${pulseAuto.id}/${pulseAuto.engine}`);
}

const runeAuto = resolveMusicAsset({ gameId: GAME_IDS.RUNE_RELAY });
if (runeAuto.id !== "fantasy" || runeAuto.engine !== MUSIC_ENGINES.WAV_STEM) {
  errors.push(`Rune AUTO should resolve Fantasy WAV, got ${runeAuto.id}/${runeAuto.engine}`);
}

// Explicit v27 WAV selection overrides a WAV-default game.
saveMusicSettings({ wavStemPackId: "pulse" });
const settingsAfterPulse = getMusicSettings();
if (settingsAfterPulse.wavStemPackId !== "pulse" || settingsAfterPulse.wavStemSelectionVersion !== 2) {
  errors.push("explicit Pulse WAV selection was not persisted as v2");
}
const mysticPulseOverride = resolveMusicAsset({ gameId: GAME_IDS.MYSTIC_MATCH });
if (mysticPulseOverride.id !== "pulse") {
  errors.push(`explicit Pulse override should apply to Mystic, got ${mysticPulseOverride.id}`);
}

// Legacy pre-v27 storage used Pulse as the only/default WAV pack.
// It must migrate to AUTO so Fantasy defaults are not silently replaced.
store.set("game-music-global-settings-v1", JSON.stringify({
  proceduralPackId: "auto",
  wavStemPackId: "pulse",
  bgmEnabled: true,
  sfxEnabled: true,
  bgmVolume: 0.8,
  sfxVolume: 0.74,
}));
const migrated = getMusicSettings();
if (migrated.wavStemPackId !== "auto" || migrated.wavStemSelectionVersion !== 2) {
  errors.push(`legacy Pulse-only setting did not migrate to AUTO: ${JSON.stringify(migrated)}`);
}
const mysticMigrated = resolveMusicAsset({ gameId: GAME_IDS.MYSTIC_MATCH });
if (mysticMigrated.id !== "fantasy") {
  errors.push(`migrated Mystic default should return Fantasy, got ${mysticMigrated.id}`);
}

if (errors.length) {
  console.error("Multi WAV Pack Registry Check FAILED");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log("Multi WAV Pack Registry Check PASSED");
console.log("- wav-stem packs: Fantasy v2.0.0 + Pulse");
console.log("- Mystic AUTO -> Fantasy WAV");
console.log("- Pulse Forge AUTO -> Pulse WAV");
console.log("- Rune Relay AUTO -> Fantasy WAV");
console.log("- explicit Pulse override -> preserved");
console.log("- legacy Pulse-only setting -> AUTO migration");
