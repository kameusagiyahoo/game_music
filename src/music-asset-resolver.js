import { MusicManager } from "./music-manager.js";
import { WavStemMusicManager } from "./wav-stem-manager.js";
import {
  GAME_DEFAULT_PACKS,
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

  let targetEngine = engine;
  if (!targetEngine) {
    const defaultPackId = GAME_DEFAULT_PACKS[gameId];
    targetEngine = getMusicPackEntry(defaultPackId)?.engine || MUSIC_ENGINES.PROCEDURAL;
  }

  const entry = resolveMusicPack(gameId, targetEngine);
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

const STATE_MAP = Object.freeze({
  normal: Object.freeze({
    [MUSIC_ENGINES.PROCEDURAL]: { mode: "normal", preset: null },
    [MUSIC_ENGINES.WAV_STEM]: { mode: "normal", preset: "focus" },
  }),
  tension: Object.freeze({
    [MUSIC_ENGINES.PROCEDURAL]: { mode: "tension", preset: null },
    [MUSIC_ENGINES.WAV_STEM]: { mode: "overdrive", preset: "overdrive" },
  }),
  result: Object.freeze({
    [MUSIC_ENGINES.PROCEDURAL]: { mode: "result", preset: null },
    [MUSIC_ENGINES.WAV_STEM]: { mode: "result", preset: "result" },
  }),
});

export async function applyMusicState(runtime, state, options = {}) {
  if (!runtime?.manager) return null;
  const mapping = STATE_MAP[state]?.[runtime.engine];
  if (!mapping) throw new Error(`Unsupported music state: ${state}`);

  const manager = runtime.manager;
  const quantize = options.quantize || "bar";

  if (
    mapping.preset &&
    runtime.entry?.pack?.layerPresets?.[mapping.preset] &&
    typeof manager.setLayerPreset === "function"
  ) {
    await manager.setLayerPreset(mapping.preset, {
      quantize,
      fadeBeats: Number(options.fadeBeats ?? 1),
      seconds: options.seconds,
    });
  }

  if (mapping.mode && runtime.entry?.pack?.modes?.[mapping.mode] && typeof manager.transitionTo === "function") {
    if (runtime.engine === MUSIC_ENGINES.PROCEDURAL) {
      await manager.transitionTo(mapping.mode, {
        quantize,
        crossfadeBeats: Number(options.crossfadeBeats ?? 1.5),
        seconds: options.seconds,
      });
    } else {
      await manager.transitionTo(mapping.mode);
    }
  }

  return { state, ...mapping };
}

export async function playMusicOutcome(runtime, success, options = {}) {
  if (!runtime?.manager) return null;
  const manager = runtime.manager;

  if (runtime.capabilities?.stingers && typeof manager.playStinger === "function") {
    const name = success ? "victory" : "gameover";
    await manager.playStinger(name, {
      duck: Number(options.duck ?? 0.28),
      attack: Number(options.attack ?? 0.06),
      release: Number(options.release ?? 0.32),
    });
    return { type: "stinger", name };
  }

  if (typeof manager.sfx === "function") {
    const name = success ? "win" : "lose";
    manager.sfx(name);
    return { type: "sfx", name };
  }

  return null;
}

export function stopMusicRuntime(runtime) {
  try { runtime?.manager?.stop?.(); } catch (_) {}
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
