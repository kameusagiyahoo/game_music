import { fantasyPack, fantasyManifest } from "./music-packs/fantasy.js";
import { neonPack, neonManifest } from "./music-packs/neon.js";
import { clockworkPack, clockworkManifest } from "./music-packs/clockwork.js";
import { pulsePack, pulseManifest } from "./music-packs/pulse.js";
import {
  createRegistryEntry,
  MUSIC_PACK_SCHEMA_VERSION,
  MUSIC_FACADE_API_VERSION,
} from "./music-pack-manifest.js";

const STORAGE_KEY = "game-music-global-settings-v1";

export const MUSIC_ENGINES = Object.freeze({ WAV_STEM: "wav-stem" });

export const GAME_IDS = Object.freeze({
  MYSTIC_MATCH: "mystic-match",
  ORBIT_RUSH: "orbit-rush",
  PULSE_FORGE: "pulse-forge",
  RUNE_RELAY: "rune-relay",
  AETHER_SHIFT: "aether-shift",
  BEAT_CLAIM: "beat-claim",
  SYNC_CIRCUIT: "sync-circuit",
  VECTOR_PACT: "vector-pact",
});

const entries = [
  createRegistryEntry(fantasyManifest, fantasyPack),
  createRegistryEntry(neonManifest, neonPack),
  createRegistryEntry(clockworkManifest, clockworkPack),
  createRegistryEntry(pulseManifest, pulsePack),
];
const registry = Object.freeze(Object.fromEntries(entries.map((entry) => [entry.id, entry])));

export const GAME_DEFAULT_PACKS = Object.freeze({
  [GAME_IDS.MYSTIC_MATCH]: "fantasy",
  [GAME_IDS.ORBIT_RUSH]: "neon",
  [GAME_IDS.PULSE_FORGE]: "pulse",
  [GAME_IDS.RUNE_RELAY]: "fantasy",
  [GAME_IDS.AETHER_SHIFT]: "clockwork",
  [GAME_IDS.BEAT_CLAIM]: "pulse",
  [GAME_IDS.SYNC_CIRCUIT]: "clockwork",
  [GAME_IDS.VECTOR_PACT]: "neon",
});

const WAV_STEM_SELECTION_VERSION = 4;
export const DEFAULT_MUSIC_SETTINGS = Object.freeze({
  wavStemPackId: "auto",
  wavStemSelectionVersion: WAV_STEM_SELECTION_VERSION,
  bgmEnabled: true,
  sfxEnabled: true,
  bgmVolume: 0.80,
  sfxVolume: 0.74,
});

const clamp01 = (value, fallback) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(1, number));
};
function storage() { try { return globalThis.localStorage || null; } catch (_) { return null; } }

function normalizeSettings(input = {}) {
  const selectionVersion = Number(input.wavStemSelectionVersion || 0);
  const legacyPulseOnlySelection = selectionVersion < 2 && input.wavStemPackId === "pulse";
  let requestedWavPackId = legacyPulseOnlySelection ? "auto" : input.wavStemPackId;
  const migrateNeonToWav = selectionVersion < 3 && input.proceduralPackId === "neon" && (!requestedWavPackId || requestedWavPackId === "auto");
  if (migrateNeonToWav) requestedWavPackId = "neon";
  const migrateClockworkToWav = selectionVersion < 4 && input.proceduralPackId === "clockwork" && (!requestedWavPackId || requestedWavPackId === "auto");
  if (migrateClockworkToWav) requestedWavPackId = "clockwork";
  const wavStemPackId = requestedWavPackId === "auto" ? "auto" : registry[requestedWavPackId]?.engine === MUSIC_ENGINES.WAV_STEM ? requestedWavPackId : DEFAULT_MUSIC_SETTINGS.wavStemPackId;
  return {
    wavStemPackId,
    wavStemSelectionVersion: WAV_STEM_SELECTION_VERSION,
    bgmEnabled: input.bgmEnabled === undefined ? DEFAULT_MUSIC_SETTINGS.bgmEnabled : Boolean(input.bgmEnabled),
    sfxEnabled: input.sfxEnabled === undefined ? DEFAULT_MUSIC_SETTINGS.sfxEnabled : Boolean(input.sfxEnabled),
    bgmVolume: clamp01(input.bgmVolume, DEFAULT_MUSIC_SETTINGS.bgmVolume),
    sfxVolume: clamp01(input.sfxVolume, DEFAULT_MUSIC_SETTINGS.sfxVolume),
  };
}

export function listMusicPacks({ engine } = {}) { return Object.values(registry).filter((entry) => !engine || entry.engine === engine); }
export function listMusicPackManifests({ engine } = {}) { return listMusicPacks({ engine }).map((entry) => entry.manifest); }
export function getMusicPackEntry(id) { return registry[id] || null; }
export function getMusicPackManifest(id) { return registry[id]?.manifest || null; }
export function getMusicRegistrySnapshot() {
  return Object.freeze({
    schemaVersion: MUSIC_PACK_SCHEMA_VERSION,
    facadeApi: MUSIC_FACADE_API_VERSION,
    packCount: entries.length,
    packs: Object.freeze(entries.map((entry) => Object.freeze({
      id: entry.id, version: entry.version, schemaVersion: entry.schemaVersion, name: entry.name, engine: entry.engine,
      states: entry.states, stems: entry.stems, stingers: entry.stingers, transitionCues: entry.transitionCues,
      masteringProfile: entry.masteringProfile, formats: entry.formats, facadeApi: entry.facadeApi,
    }))),
  });
}
export function getMusicSettings() {
  const store = storage();
  if (!store) return { ...DEFAULT_MUSIC_SETTINGS };
  try { return normalizeSettings(JSON.parse(store.getItem(STORAGE_KEY) || "{}")); } catch (_) { return { ...DEFAULT_MUSIC_SETTINGS }; }
}
export function saveMusicSettings(patch = {}) {
  const next = normalizeSettings({ ...getMusicSettings(), ...patch });
  const store = storage();
  if (store) { try { store.setItem(STORAGE_KEY, JSON.stringify(next)); } catch (_) {} }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("game-music-settings-change", { detail: next }));
  return next;
}
export function resetMusicSettings() {
  const store = storage();
  if (store) { try { store.removeItem(STORAGE_KEY); } catch (_) {} }
  return saveMusicSettings(DEFAULT_MUSIC_SETTINGS);
}
export function resolveMusicPack(gameId, engine = MUSIC_ENGINES.WAV_STEM) {
  if (engine !== MUSIC_ENGINES.WAV_STEM) return null;
  const settings = getMusicSettings();
  const id = settings.wavStemPackId === "auto" ? GAME_DEFAULT_PACKS[gameId] : settings.wavStemPackId;
  const entry = registry[id];
  if (entry?.engine === engine) return entry;
  const fallback = registry[GAME_DEFAULT_PACKS[gameId]];
  if (fallback?.engine === engine) return fallback;
  return listMusicPacks({ engine })[0] || null;
}
export function configureMusicManager(manager, settings = getMusicSettings()) {
  manager.musicEnabled = settings.bgmEnabled;
  manager.sfxEnabled = settings.sfxEnabled;
  manager.setMusicVolume(settings.bgmVolume);
  manager.setSfxVolume(settings.sfxVolume);
  return settings;
}
export function applyMusicSettingsToControls(controls, settings = getMusicSettings()) {
  if (controls.bgmToggle) controls.bgmToggle.checked = settings.bgmEnabled;
  if (controls.sfxToggle) controls.sfxToggle.checked = settings.sfxEnabled;
  if (controls.bgmVolume) controls.bgmVolume.value = String(Math.round(settings.bgmVolume * 100));
  if (controls.sfxVolume) controls.sfxVolume.value = String(Math.round(settings.sfxVolume * 100));
  if (controls.bgmVolumeValue) controls.bgmVolumeValue.textContent = String(Math.round(settings.bgmVolume * 100));
  if (controls.sfxVolumeValue) controls.sfxVolumeValue.textContent = String(Math.round(settings.sfxVolume * 100));
}
