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

export const MUSIC_ENGINES = Object.freeze({
  PROCEDURAL: "procedural",
  WAV_STEM: "wav-stem",
});

export const GAME_IDS = Object.freeze({
  MYSTIC_MATCH: "mystic-match",
  ORBIT_RUSH: "orbit-rush",
  PULSE_FORGE: "pulse-forge",
  RUNE_RELAY: "rune-relay",
  AETHER_SHIFT: "aether-shift",
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
});

export const DEFAULT_MUSIC_SETTINGS = Object.freeze({
  proceduralPackId: "auto",
  wavStemPackId: "pulse",
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

function storage() {
  try {
    return globalThis.localStorage || null;
  } catch (_) {
    return null;
  }
}

function normalizeSettings(input = {}) {
  const proceduralPackId = input.proceduralPackId === "auto"
    ? "auto"
    : registry[input.proceduralPackId]?.engine === MUSIC_ENGINES.PROCEDURAL
      ? input.proceduralPackId
      : DEFAULT_MUSIC_SETTINGS.proceduralPackId;

  const wavStemPackId = registry[input.wavStemPackId]?.engine === MUSIC_ENGINES.WAV_STEM
    ? input.wavStemPackId
    : DEFAULT_MUSIC_SETTINGS.wavStemPackId;

  return {
    proceduralPackId,
    wavStemPackId,
    bgmEnabled: input.bgmEnabled === undefined ? DEFAULT_MUSIC_SETTINGS.bgmEnabled : Boolean(input.bgmEnabled),
    sfxEnabled: input.sfxEnabled === undefined ? DEFAULT_MUSIC_SETTINGS.sfxEnabled : Boolean(input.sfxEnabled),
    bgmVolume: clamp01(input.bgmVolume, DEFAULT_MUSIC_SETTINGS.bgmVolume),
    sfxVolume: clamp01(input.sfxVolume, DEFAULT_MUSIC_SETTINGS.sfxVolume),
  };
}

export function listMusicPacks({ engine } = {}) {
  return Object.values(registry).filter((entry) => !engine || entry.engine === engine);
}

export function listMusicPackManifests({ engine } = {}) {
  return listMusicPacks({ engine }).map((entry) => entry.manifest);
}

export function getMusicPackEntry(id) {
  return registry[id] || null;
}

export function getMusicPackManifest(id) {
  return registry[id]?.manifest || null;
}

export function getMusicRegistrySnapshot() {
  return Object.freeze({
    schemaVersion: MUSIC_PACK_SCHEMA_VERSION,
    facadeApi: MUSIC_FACADE_API_VERSION,
    packCount: entries.length,
    packs: Object.freeze(entries.map((entry) => Object.freeze({
      id: entry.id,
      version: entry.version,
      schemaVersion: entry.schemaVersion,
      name: entry.name,
      engine: entry.engine,
      states: entry.states,
      stems: entry.stems,
      stingers: entry.stingers,
      facadeApi: entry.facadeApi,
    }))),
  });
}

export function getMusicSettings() {
  const store = storage();
  if (!store) return { ...DEFAULT_MUSIC_SETTINGS };
  try {
    const parsed = JSON.parse(store.getItem(STORAGE_KEY) || "{}");
    return normalizeSettings(parsed);
  } catch (_) {
    return { ...DEFAULT_MUSIC_SETTINGS };
  }
}

export function saveMusicSettings(patch = {}) {
  const next = normalizeSettings({ ...getMusicSettings(), ...patch });
  const store = storage();
  if (store) {
    try { store.setItem(STORAGE_KEY, JSON.stringify(next)); } catch (_) {}
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("game-music-settings-change", { detail: next }));
  }
  return next;
}

export function resetMusicSettings() {
  const store = storage();
  if (store) {
    try { store.removeItem(STORAGE_KEY); } catch (_) {}
  }
  return saveMusicSettings(DEFAULT_MUSIC_SETTINGS);
}

export function resolveMusicPack(gameId, engine = MUSIC_ENGINES.PROCEDURAL) {
  const settings = getMusicSettings();
  let id;

  if (engine === MUSIC_ENGINES.WAV_STEM) {
    id = settings.wavStemPackId;
  } else {
    id = settings.proceduralPackId === "auto"
      ? GAME_DEFAULT_PACKS[gameId]
      : settings.proceduralPackId;
  }

  const entry = registry[id];
  if (entry?.engine === engine) return entry;

  const fallbackId = GAME_DEFAULT_PACKS[gameId];
  const fallback = registry[fallbackId];
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
