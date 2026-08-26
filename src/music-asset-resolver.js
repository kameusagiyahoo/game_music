import { MusicManager } from "./music-manager.js";
import { WavStemMusicManager } from "./wav-stem-manager.js";
import {
  MUSIC_ENGINES,
  configureMusicManager,
  getMusicPackEntry,
  getMusicSettings,
  resolveMusicPack,
} from "./music-registry.js";

export const MUSIC_CAPABILITIES = Object.freeze({
  [MUSIC_ENGINES.PROCEDURAL]: Object.freeze({
    quantizedModeTransition: true,
    quantizedPackSwitch: true,
    layerMix: true,
    wavStems: false,
    stingers: false,
  }),
  [MUSIC_ENGINES.WAV_STEM]: Object.freeze({
    quantizedModeTransition: false,
    quantizedPackSwitch: false,
    layerMix: true,
    wavStems: true,
    stingers: true,
  }),
});

export function resolveMusicAsset({ gameId, packId, engine } = {}) {
  if (packId) {
    const explicit = getMusicPackEntry(packId);
    if (!explicit) throw new Error(`Unknown Music Pack: ${packId}`);
    if (engine && explicit.engine !== engine) {
      throw new Error(`Music Pack ${packId} requires engine ${explicit.engine}, not ${engine}`);
    }
    return explicit;
  }

  if (!gameId) throw new Error("gameId or packId is required");
  const entry = resolveMusicPack(gameId, engine || MUSIC_ENGINES.PROCEDURAL);
  if (!entry) throw new Error(`No compatible Music Pack for ${gameId}`);
  return entry;
}

export function createMusicRuntime({
  gameId,
  packId,
  engine,
  callbacks = {},
  settings = getMusicSettings(),
} = {}) {
  const entry = resolveMusicAsset({ gameId, packId, engine });
  const options = {
    pack: entry.pack,
    onModeChange: callbacks.onModeChange,
    onSync: callbacks.onSync,
    onLayerChange: callbacks.onLayerChange,
    onPackChange: callbacks.onPackChange,
  };

  let manager;
  if (entry.engine === MUSIC_ENGINES.PROCEDURAL) {
    manager = new MusicManager(options);
  } else if (entry.engine === MUSIC_ENGINES.WAV_STEM) {
    manager = new WavStemMusicManager(options);
  } else {
    throw new Error(`Unsupported music engine: ${entry.engine}`);
  }

  configureMusicManager(manager, settings);

  return {
    entry,
    engine: entry.engine,
    manager,
    settings,
    capabilities: { ...(MUSIC_CAPABILITIES[entry.engine] || {}) },
  };
}

export function getRuntimeDescriptor(runtime) {
  if (!runtime) return null;
  return {
    packId: runtime.entry?.id || null,
    packName: runtime.entry?.name || null,
    engine: runtime.engine || null,
    capabilities: { ...(runtime.capabilities || {}) },
  };
}
